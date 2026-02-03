use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    program::invoke_signed,
    sysvar::Sysvar,
    clock::Clock,
};

// Program ID - deployed on devnet
solana_program::declare_id!("2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9");

/// Maximum lengths for string fields
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_GATEWAY_LEN: usize = 256;

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

// Instructions
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum AgentInstruction {
    /// Initialize the registry (one-time setup)
    /// Accounts: [registry (PDA), authority (signer), system_program]
    Initialize,
    
    /// Register a new agent
    /// Accounts: [registry (PDA), agent (PDA), wallet (signer), system_program]
    RegisterAgent { 
        name: String, 
        gateway: String,
    },
    
    /// Update agent gateway URL
    /// Accounts: [agent (PDA), wallet (signer)]
    UpdateGateway {
        new_gateway: String,
    },
    
    /// Deactivate an agent (self-deactivation)
    /// Accounts: [agent (PDA), wallet (signer)]
    DeactivateAgent,
    
    /// Reactivate an agent
    /// Accounts: [agent (PDA), wallet (signer)]
    ReactivateAgent,
    
    /// Force deactivate an agent (authority only - for malicious agents)
    /// Accounts: [registry (PDA), agent (PDA), authority (signer)]
    ForceDeactivate,
    
    /// Transfer registry authority
    /// Accounts: [registry (PDA), current_authority (signer), new_authority]
    TransferAuthority,
    
    /// Pause/unpause registrations (authority only)
    /// Accounts: [registry (PDA), authority (signer)]
    SetPaused { paused: bool },
}

// State
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Registry {
    /// Authority who can force-deactivate agents and pause registrations
    pub authority: Pubkey,
    /// Total agents ever registered
    pub agent_count: u64,
    /// Currently active agents
    pub active_count: u64,
    /// Whether registrations are paused
    pub is_paused: bool,
    /// PDA bump
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Agent {
    /// Agent's wallet address
    pub wallet: Pubkey,
    /// Agent display name
    pub name: String,
    /// Gateway URL for agent communication
    pub gateway: String,
    /// Whether agent is active
    pub is_active: bool,
    /// Registration timestamp
    pub registered_at: i64,
    /// Last activity timestamp
    pub last_active_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl Registry {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1; // 50 bytes
}

impl Agent {
    // Fixed size: 32 + (4 + 32) + (4 + 256) + 1 + 8 + 8 + 1 = 346 bytes
    pub const SIZE: usize = 32 + 4 + MAX_NAME_LEN + 4 + MAX_GATEWAY_LEN + 1 + 8 + 8 + 1;
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = AgentInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        AgentInstruction::Initialize => initialize(program_id, accounts),
        AgentInstruction::RegisterAgent { name, gateway } => {
            register_agent(program_id, accounts, name, gateway)
        }
        AgentInstruction::UpdateGateway { new_gateway } => {
            update_gateway(program_id, accounts, new_gateway)
        }
        AgentInstruction::DeactivateAgent => deactivate_agent(program_id, accounts),
        AgentInstruction::ReactivateAgent => reactivate_agent(program_id, accounts),
        AgentInstruction::ForceDeactivate => force_deactivate(program_id, accounts),
        AgentInstruction::TransferAuthority => transfer_authority(program_id, accounts),
        AgentInstruction::SetPaused { paused } => set_paused(program_id, accounts, paused),
    }
}

/// Initialize the registry (one-time)
fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let registry_info = next_account_info(account_iter)?;
    let authority_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // Validate signer
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate registry PDA
    let (registry_pda, bump) = Pubkey::find_program_address(&[b"registry"], program_id);
    if registry_pda != *registry_info.key {
        msg!("Invalid registry PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Check not already initialized
    if !registry_info.data_is_empty() {
        msg!("Registry already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create registry account
    let rent = Rent::get()?;
    let space = Registry::SIZE;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            registry_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[authority_info.clone(), registry_info.clone(), system_program.clone()],
        &[&[b"registry", &[bump]]],
    )?;

    // Initialize registry state
    let registry = Registry {
        authority: *authority_info.key,
        agent_count: 0,
        active_count: 0,
        is_paused: false,
        bump,
    };
    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    msg!("Registry initialized with authority: {}", authority_info.key);
    Ok(())
}

/// Register a new agent
fn register_agent(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    name: String,
    gateway: String,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let registry_info = next_account_info(account_iter)?;
    let agent_info = next_account_info(account_iter)?;
    let wallet_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // === VALIDATION ===

    // 1. Validate signer
    if !wallet_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 2. Validate registry PDA
    let (registry_pda, _) = Pubkey::find_program_address(&[b"registry"], program_id);
    if registry_pda != *registry_info.key {
        msg!("Invalid registry PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 3. Validate registry is owned by this program
    if *registry_info.owner != *program_id {
        msg!("Registry not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 4. Load and check registry state
    let mut registry = Registry::try_from_slice(&registry_info.data.borrow())?;
    if registry.is_paused {
        msg!("Agent registration is paused");
        return Err(ProgramError::Custom(2)); // RegistrationPaused
    }

    // 5. Validate name
    let name = name.trim().to_string();
    if name.len() < 3 {
        msg!("Name must be at least 3 characters");
        return Err(ProgramError::InvalidArgument);
    }
    if name.len() > MAX_NAME_LEN {
        msg!("Name must be at most {} characters", MAX_NAME_LEN);
        return Err(ProgramError::InvalidArgument);
    }
    // Only allow alphanumeric, spaces, underscores, hyphens
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '_' || c == '-') {
        msg!("Name contains invalid characters");
        return Err(ProgramError::InvalidArgument);
    }

    // 6. Validate gateway URL
    let gateway = gateway.trim().to_string();
    if gateway.len() > MAX_GATEWAY_LEN {
        msg!("Gateway must be at most {} characters", MAX_GATEWAY_LEN);
        return Err(ProgramError::InvalidArgument);
    }
    // Basic URL validation (must start with http:// or https://)
    if !gateway.is_empty() && !gateway.starts_with("http://") && !gateway.starts_with("https://") {
        msg!("Gateway must be a valid HTTP(S) URL");
        return Err(ProgramError::InvalidArgument);
    }

    // 7. Validate agent PDA
    let (agent_pda, bump) = Pubkey::find_program_address(
        &[b"agent", wallet_info.key.as_ref()],
        program_id,
    );
    if agent_pda != *agent_info.key {
        msg!("Invalid agent PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 8. Check agent doesn't already exist
    if !agent_info.data_is_empty() {
        msg!("Agent already registered for this wallet");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // === CREATE AGENT ACCOUNT ===
    let rent = Rent::get()?;
    let space = Agent::SIZE;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            wallet_info.key,
            agent_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[wallet_info.clone(), agent_info.clone(), system_program.clone()],
        &[&[b"agent", wallet_info.key.as_ref(), &[bump]]],
    )?;

    // === INITIALIZE AGENT STATE ===
    let clock = Clock::get()?;
    let agent = Agent {
        wallet: *wallet_info.key,
        name: name.clone(),
        gateway,
        is_active: true,
        registered_at: clock.unix_timestamp,
        last_active_at: clock.unix_timestamp,
        bump,
    };
    agent.serialize(&mut *agent_info.data.borrow_mut())?;

    // === UPDATE REGISTRY STATE ===
    registry.agent_count = registry.agent_count
        .checked_add(1)
        .ok_or_else(|| {
            msg!("Agent count overflow");
            ProgramError::ArithmeticOverflow
        })?;
    registry.active_count = registry.active_count
        .checked_add(1)
        .ok_or_else(|| {
            msg!("Active count overflow");
            ProgramError::ArithmeticOverflow
        })?;
    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    msg!("Agent '{}' registered", name);
    Ok(())
}

/// Update agent gateway URL
fn update_gateway(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_gateway: String,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let agent_info = next_account_info(account_iter)?;
    let wallet_info = next_account_info(account_iter)?;

    // Validate signer
    if !wallet_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate agent is owned by this program
    if *agent_info.owner != *program_id {
        msg!("Agent not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load agent
    let mut agent = Agent::try_from_slice(&agent_info.data.borrow())?;

    // Validate ownership
    if agent.wallet != *wallet_info.key {
        msg!("Unauthorized: not the agent owner");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Validate gateway
    let new_gateway = new_gateway.trim().to_string();
    if new_gateway.len() > MAX_GATEWAY_LEN {
        msg!("Gateway must be at most {} characters", MAX_GATEWAY_LEN);
        return Err(ProgramError::InvalidArgument);
    }
    if !new_gateway.is_empty() && !new_gateway.starts_with("http://") && !new_gateway.starts_with("https://") {
        msg!("Gateway must be a valid HTTP(S) URL");
        return Err(ProgramError::InvalidArgument);
    }

    // Update gateway and last active timestamp
    let clock = Clock::get()?;
    agent.gateway = new_gateway;
    agent.last_active_at = clock.unix_timestamp;
    agent.serialize(&mut *agent_info.data.borrow_mut())?;

    msg!("Gateway updated for agent '{}'", agent.name);
    Ok(())
}

/// Self-deactivate an agent
fn deactivate_agent(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let agent_info = next_account_info(account_iter)?;
    let wallet_info = next_account_info(account_iter)?;

    // Validate signer
    if !wallet_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate agent is owned by this program
    if *agent_info.owner != *program_id {
        msg!("Agent not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load agent
    let mut agent = Agent::try_from_slice(&agent_info.data.borrow())?;
    
    // Validate ownership
    if agent.wallet != *wallet_info.key {
        msg!("Unauthorized: not the agent owner");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Check already inactive
    if !agent.is_active {
        msg!("Agent already inactive");
        return Err(ProgramError::Custom(4)); // AlreadyInactive
    }

    // Deactivate
    agent.is_active = false;
    agent.serialize(&mut *agent_info.data.borrow_mut())?;

    msg!("Agent '{}' deactivated", agent.name);
    Ok(())
}

/// Reactivate an agent
fn reactivate_agent(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let agent_info = next_account_info(account_iter)?;
    let wallet_info = next_account_info(account_iter)?;

    // Validate signer
    if !wallet_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate agent is owned by this program
    if *agent_info.owner != *program_id {
        msg!("Agent not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load agent
    let mut agent = Agent::try_from_slice(&agent_info.data.borrow())?;
    
    // Validate ownership
    if agent.wallet != *wallet_info.key {
        msg!("Unauthorized: not the agent owner");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Check already active
    if agent.is_active {
        msg!("Agent already active");
        return Err(ProgramError::Custom(5)); // AlreadyActive
    }

    // Reactivate
    let clock = Clock::get()?;
    agent.is_active = true;
    agent.last_active_at = clock.unix_timestamp;
    agent.serialize(&mut *agent_info.data.borrow_mut())?;

    msg!("Agent '{}' reactivated", agent.name);
    Ok(())
}

/// Force deactivate an agent (authority only)
fn force_deactivate(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let registry_info = next_account_info(account_iter)?;
    let agent_info = next_account_info(account_iter)?;
    let authority_info = next_account_info(account_iter)?;

    // Validate signer
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate registry PDA
    let (registry_pda, _) = Pubkey::find_program_address(&[b"registry"], program_id);
    if registry_pda != *registry_info.key {
        msg!("Invalid registry PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Validate registry is owned by this program
    if *registry_info.owner != *program_id {
        msg!("Registry not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load registry and validate authority
    let mut registry = Registry::try_from_slice(&registry_info.data.borrow())?;
    if registry.authority != *authority_info.key {
        msg!("Unauthorized: not registry authority");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Validate agent is owned by this program
    if *agent_info.owner != *program_id {
        msg!("Agent not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and deactivate agent
    let mut agent = Agent::try_from_slice(&agent_info.data.borrow())?;
    
    if agent.is_active {
        agent.is_active = false;
        agent.serialize(&mut *agent_info.data.borrow_mut())?;
        
        // Decrement active count
        registry.active_count = registry.active_count.saturating_sub(1);
        registry.serialize(&mut *registry_info.data.borrow_mut())?;
    }

    msg!("Agent '{}' force-deactivated by authority", agent.name);
    Ok(())
}

/// Transfer registry authority
fn transfer_authority(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let registry_info = next_account_info(account_iter)?;
    let current_authority_info = next_account_info(account_iter)?;
    let new_authority_info = next_account_info(account_iter)?;

    // Validate signer
    if !current_authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate registry PDA
    let (registry_pda, _) = Pubkey::find_program_address(&[b"registry"], program_id);
    if registry_pda != *registry_info.key {
        msg!("Invalid registry PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Validate registry is owned by this program
    if *registry_info.owner != *program_id {
        msg!("Registry not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load registry and validate authority
    let mut registry = Registry::try_from_slice(&registry_info.data.borrow())?;
    if registry.authority != *current_authority_info.key {
        msg!("Unauthorized: not current authority");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Transfer authority
    let old_authority = registry.authority;
    registry.authority = *new_authority_info.key;
    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    msg!("Authority transferred from {} to {}", old_authority, new_authority_info.key);
    Ok(())
}

/// Pause/unpause registrations
fn set_paused(program_id: &Pubkey, accounts: &[AccountInfo], paused: bool) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let registry_info = next_account_info(account_iter)?;
    let authority_info = next_account_info(account_iter)?;

    // Validate signer
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate registry PDA
    let (registry_pda, _) = Pubkey::find_program_address(&[b"registry"], program_id);
    if registry_pda != *registry_info.key {
        msg!("Invalid registry PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Validate registry is owned by this program
    if *registry_info.owner != *program_id {
        msg!("Registry not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load registry and validate authority
    let mut registry = Registry::try_from_slice(&registry_info.data.borrow())?;
    if registry.authority != *authority_info.key {
        msg!("Unauthorized: not registry authority");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Update paused state
    registry.is_paused = paused;
    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    msg!("Registry paused: {}", paused);
    Ok(())
}

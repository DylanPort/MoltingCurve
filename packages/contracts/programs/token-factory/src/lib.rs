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

solana_program::declare_id!("GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL");

/// Maximum lengths for string fields (for security)
pub const MAX_NAME_LEN: usize = 100;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_THESIS_LEN: usize = 500;

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum TokenFactoryInstruction {
    /// Initialize the factory (one-time setup)
    /// Accounts: [factory PDA, authority (signer), system_program]
    InitializeFactory,
    
    /// Create a new token with bonding curve
    /// Accounts: [factory PDA, curve PDA, creator (signer), system_program]
    CreateToken {
        name: String,
        symbol: String,
        thesis: String,
        base_price: u64,
        slope: u64,
    },
    
    /// Update token thesis (only creator can do this)
    /// Accounts: [curve PDA, creator (signer)]
    UpdateThesis {
        new_thesis: String,
    },
    
    /// Freeze token (only factory authority can do this)
    /// Accounts: [factory PDA, curve PDA, authority (signer)]
    FreezeToken,
}

/// Factory state - tracks global configuration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Factory {
    /// Authority who can freeze tokens
    pub authority: Pubkey,
    /// Total tokens created
    pub token_count: u64,
    /// Whether new token creation is paused
    pub is_paused: bool,
    /// PDA bump
    pub bump: u8,
}

impl Factory {
    pub const SIZE: usize = 32 + 8 + 1 + 1; // 42 bytes
}

/// Bonding curve state for each token
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct BondingCurve {
    /// Token creator
    pub creator: Pubkey,
    /// Token name (max 100 chars)
    pub name: String,
    /// Token symbol (max 10 chars)
    pub symbol: String,
    /// Investment thesis (max 500 chars)
    pub thesis: String,
    /// Base price in lamports per token
    pub base_price: u64,
    /// Price increase per token (slope)
    pub slope: u64,
    /// Total token supply
    pub total_supply: u64,
    /// SOL held in reserve
    pub reserve_lamports: u64,
    /// Creation timestamp
    pub created_at: i64,
    /// Whether token is frozen
    pub is_frozen: bool,
    /// PDA bump
    pub bump: u8,
}

impl BondingCurve {
    // Fixed size: 32 + (4 + 100) + (4 + 10) + (4 + 500) + 8 + 8 + 8 + 8 + 8 + 1 + 1 = 696 bytes
    pub const SIZE: usize = 32 + 4 + MAX_NAME_LEN + 4 + MAX_SYMBOL_LEN + 4 + MAX_THESIS_LEN + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = TokenFactoryInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        TokenFactoryInstruction::InitializeFactory => {
            initialize_factory(program_id, accounts)
        }
        TokenFactoryInstruction::CreateToken { name, symbol, thesis, base_price, slope } => {
            create_token(program_id, accounts, name, symbol, thesis, base_price, slope)
        }
        TokenFactoryInstruction::UpdateThesis { new_thesis } => {
            update_thesis(program_id, accounts, new_thesis)
        }
        TokenFactoryInstruction::FreezeToken => {
            freeze_token(program_id, accounts)
        }
    }
}

/// Initialize the factory (one-time)
fn initialize_factory(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let factory_info = next_account_info(account_iter)?;
    let authority_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // Validate signer
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate factory PDA
    let (factory_pda, bump) = Pubkey::find_program_address(&[b"factory"], program_id);
    if factory_pda != *factory_info.key {
        msg!("Invalid factory PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Check not already initialized
    if !factory_info.data_is_empty() {
        msg!("Factory already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create factory account
    let rent = Rent::get()?;
    let space = Factory::SIZE;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            factory_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[authority_info.clone(), factory_info.clone(), system_program.clone()],
        &[&[b"factory", &[bump]]],
    )?;

    // Initialize factory state
    let factory = Factory {
        authority: *authority_info.key,
        token_count: 0,
        is_paused: false,
        bump,
    };
    factory.serialize(&mut *factory_info.data.borrow_mut())?;

    msg!("Factory initialized");
    Ok(())
}

fn create_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    name: String,
    symbol: String,
    thesis: String,
    base_price: u64,
    slope: u64,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let factory_info = next_account_info(account_iter)?;
    let curve_info = next_account_info(account_iter)?;
    let creator_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // === VALIDATION ===

    // 1. Validate signer
    if !creator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 2. Validate factory PDA
    let (factory_pda, _) = Pubkey::find_program_address(&[b"factory"], program_id);
    if factory_pda != *factory_info.key {
        msg!("Invalid factory PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 3. Validate factory is owned by this program
    if *factory_info.owner != *program_id {
        msg!("Factory not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 4. Load and check factory state
    let mut factory = Factory::try_from_slice(&factory_info.data.borrow())?;
    if factory.is_paused {
        msg!("Token creation is paused");
        return Err(ProgramError::Custom(2)); // FactoryPaused
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

    // 6. Validate symbol (alphanumeric only, uppercase)
    let symbol = symbol.trim().to_uppercase();
    if symbol.len() < 2 {
        msg!("Symbol must be at least 2 characters");
        return Err(ProgramError::InvalidArgument);
    }
    if symbol.len() > MAX_SYMBOL_LEN {
        msg!("Symbol must be at most {} characters", MAX_SYMBOL_LEN);
        return Err(ProgramError::InvalidArgument);
    }
    if !symbol.chars().all(|c| c.is_ascii_alphanumeric()) {
        msg!("Symbol must be alphanumeric");
        return Err(ProgramError::InvalidArgument);
    }

    // 7. Validate thesis
    let thesis = thesis.trim().to_string();
    if thesis.len() < 10 {
        msg!("Thesis must be at least 10 characters");
        return Err(ProgramError::InvalidArgument);
    }
    if thesis.len() > MAX_THESIS_LEN {
        msg!("Thesis must be at most {} characters", MAX_THESIS_LEN);
        return Err(ProgramError::InvalidArgument);
    }

    // 8. Validate pricing parameters
    if base_price == 0 {
        msg!("Base price must be > 0");
        return Err(ProgramError::InvalidArgument);
    }
    if slope == 0 {
        msg!("Slope must be > 0");
        return Err(ProgramError::InvalidArgument);
    }
    // Sanity check: base_price shouldn't be absurdly high
    if base_price > 1_000_000_000_000 { // Max 1000 SOL base price
        msg!("Base price too high");
        return Err(ProgramError::InvalidArgument);
    }

    // 9. Generate and validate curve PDA using symbol as seed
    let (curve_pda, bump) = Pubkey::find_program_address(
        &[b"curve", symbol.as_bytes()],
        program_id,
    );
    if curve_pda != *curve_info.key {
        msg!("Invalid curve PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 10. Check curve doesn't already exist (symbol uniqueness)
    if !curve_info.data_is_empty() {
        msg!("Token with symbol {} already exists", symbol);
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // === CREATE CURVE ACCOUNT ===
    let rent = Rent::get()?;
    let space = BondingCurve::SIZE;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            creator_info.key,
            curve_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[creator_info.clone(), curve_info.clone(), system_program.clone()],
        &[&[b"curve", symbol.as_bytes(), &[bump]]],
    )?;

    // === INITIALIZE CURVE STATE ===
    let clock = Clock::get()?;
    let curve = BondingCurve {
        creator: *creator_info.key,
        name,
        symbol,
        thesis,
        base_price,
        slope,
        total_supply: 0,
        reserve_lamports: 0,
        created_at: clock.unix_timestamp,
        is_frozen: false,
        bump,
    };
    curve.serialize(&mut *curve_info.data.borrow_mut())?;

    // === UPDATE FACTORY STATE ===
    factory.token_count = factory.token_count
        .checked_add(1)
        .ok_or_else(|| {
            msg!("Token count overflow");
            ProgramError::ArithmeticOverflow
        })?;
    factory.serialize(&mut *factory_info.data.borrow_mut())?;

    msg!("Token '{}' ({}) created by {}", 
         curve.name, curve.symbol, creator_info.key);
    Ok(())
}

/// Update token thesis (only creator)
fn update_thesis(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_thesis: String,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let curve_info = next_account_info(account_iter)?;
    let creator_info = next_account_info(account_iter)?;

    // Validate signer
    if !creator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate curve is owned by this program
    if *curve_info.owner != *program_id {
        msg!("Curve not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load curve
    let mut curve = BondingCurve::try_from_slice(&curve_info.data.borrow())?;

    // Validate creator
    if curve.creator != *creator_info.key {
        msg!("Only creator can update thesis");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Validate token not frozen
    if curve.is_frozen {
        msg!("Token is frozen");
        return Err(ProgramError::Custom(3)); // TokenFrozen
    }

    // Validate new thesis
    let new_thesis = new_thesis.trim().to_string();
    if new_thesis.len() < 10 {
        msg!("Thesis must be at least 10 characters");
        return Err(ProgramError::InvalidArgument);
    }
    if new_thesis.len() > MAX_THESIS_LEN {
        msg!("Thesis must be at most {} characters", MAX_THESIS_LEN);
        return Err(ProgramError::InvalidArgument);
    }

    // Update thesis
    curve.thesis = new_thesis;
    curve.serialize(&mut *curve_info.data.borrow_mut())?;

    msg!("Thesis updated for {}", curve.symbol);
    Ok(())
}

/// Freeze a token (only factory authority)
fn freeze_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let factory_info = next_account_info(account_iter)?;
    let curve_info = next_account_info(account_iter)?;
    let authority_info = next_account_info(account_iter)?;

    // Validate signer
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate factory PDA
    let (factory_pda, _) = Pubkey::find_program_address(&[b"factory"], program_id);
    if factory_pda != *factory_info.key {
        msg!("Invalid factory PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Validate factory is owned by this program
    if *factory_info.owner != *program_id {
        msg!("Factory not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load factory and validate authority
    let factory = Factory::try_from_slice(&factory_info.data.borrow())?;
    if factory.authority != *authority_info.key {
        msg!("Only factory authority can freeze tokens");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Validate curve is owned by this program
    if *curve_info.owner != *program_id {
        msg!("Curve not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and freeze curve
    let mut curve = BondingCurve::try_from_slice(&curve_info.data.borrow())?;
    curve.is_frozen = true;
    curve.serialize(&mut *curve_info.data.borrow_mut())?;

    msg!("Token {} frozen", curve.symbol);
    Ok(())
}

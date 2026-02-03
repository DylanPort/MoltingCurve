use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    program::invoke,
    program::invoke_signed,
    rent::Rent,
    sysvar::Sysvar,
};

solana_program::declare_id!("7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X");

/// Bonding curve state - MUST match token_factory::BondingCurve exactly
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct BondingCurve {
    /// Token creator
    pub creator: Pubkey,
    /// Token name (variable length string)
    pub name: String,
    /// Token symbol (variable length string)
    pub symbol: String,
    /// Investment thesis (variable length string)
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

// Token Factory Program ID for cross-program validation
pub const TOKEN_FACTORY_ID: Pubkey = solana_program::pubkey!("GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL");

// Maximum token supply: 1 billion tokens (1e9)
pub const MAX_SUPPLY: u64 = 1_000_000_000;

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

/// User token balance account - tracks individual holdings
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct UserBalance {
    /// The user's wallet
    pub owner: Pubkey,
    /// The curve/token this balance is for
    pub curve: Pubkey,
    /// Token balance
    pub balance: u64,
    /// PDA bump
    pub bump: u8,
}

impl UserBalance {
    pub const SIZE: usize = 32 + 32 + 8 + 1; // 73 bytes
}

/// Reserve account for holding SOL and tracking trading state
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Reserve {
    /// The curve this reserve belongs to
    pub curve: Pubkey,
    /// Total tokens minted (supply)
    pub total_supply: u64,
    /// Total SOL deposited to reserve
    pub total_sol: u64,
    /// PDA bump
    pub bump: u8,
}

impl Reserve {
    pub const SIZE: usize = 32 + 8 + 8 + 1; // 49 bytes
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum TradeInstruction {
    /// Buy tokens from bonding curve
    /// Accounts: [curve, reserve PDA, user_balance PDA, buyer (signer), system_program]
    Buy { 
        sol_amount: u64,
        min_tokens_out: u64,  // Slippage protection
    },
    
    /// Sell tokens back to bonding curve
    /// Accounts: [curve, reserve PDA, user_balance PDA, seller (signer), system_program]
    Sell { 
        token_amount: u64,
        min_sol_out: u64,  // Slippage protection
    },
    
    /// Initialize reserve PDA for a curve
    /// Accounts: [curve, reserve PDA, payer (signer), system_program]
    InitializeReserve,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = TradeInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        TradeInstruction::Buy { sol_amount, min_tokens_out } => {
            buy(program_id, accounts, sol_amount, min_tokens_out)
        }
        TradeInstruction::Sell { token_amount, min_sol_out } => {
            sell(program_id, accounts, token_amount, min_sol_out)
        }
        TradeInstruction::InitializeReserve => {
            initialize_reserve(program_id, accounts)
        }
    }
}

/// Initialize a reserve PDA for a curve
fn initialize_reserve(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let curve_info = next_account_info(account_iter)?;
    let reserve_info = next_account_info(account_iter)?;
    let payer_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // Validate signer
    if !payer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate curve is owned by token factory
    if *curve_info.owner != TOKEN_FACTORY_ID {
        msg!("Curve account not owned by token factory");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Validate reserve PDA
    let (expected_reserve, bump) = Pubkey::find_program_address(
        &[b"reserve", curve_info.key.as_ref()],
        program_id,
    );
    if *reserve_info.key != expected_reserve {
        msg!("Invalid reserve PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // Check if already initialized
    if !reserve_info.data_is_empty() {
        msg!("Reserve already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create reserve account
    let rent = Rent::get()?;
    let space = Reserve::SIZE;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            payer_info.key,
            reserve_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[payer_info.clone(), reserve_info.clone(), system_program.clone()],
        &[&[b"reserve", curve_info.key.as_ref(), &[bump]]],
    )?;

    // Initialize reserve data with zero supply
    let reserve = Reserve {
        curve: *curve_info.key,
        total_supply: 0,
        total_sol: 0,
        bump,
    };
    reserve.serialize(&mut *reserve_info.data.borrow_mut())?;

    msg!("Reserve initialized for curve");
    Ok(())
}

fn buy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_amount: u64,
    min_tokens_out: u64,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let curve_info = next_account_info(account_iter)?;
    let reserve_info = next_account_info(account_iter)?;
    let user_balance_info = next_account_info(account_iter)?;
    let buyer_info = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // === VALIDATION ===
    
    // 1. Validate signer
    if !buyer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 2. Validate amount
    if sol_amount == 0 {
        msg!("Amount must be > 0");
        return Err(ProgramError::InvalidArgument);
    }

    // 3. Validate curve is owned by token factory program
    if *curve_info.owner != TOKEN_FACTORY_ID {
        msg!("Curve account not owned by token factory program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 4. Validate reserve PDA
    let (expected_reserve, _reserve_bump) = Pubkey::find_program_address(
        &[b"reserve", curve_info.key.as_ref()],
        program_id,
    );
    if *reserve_info.key != expected_reserve {
        msg!("Invalid reserve PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 5. Validate reserve is owned by this program
    if *reserve_info.owner != *program_id {
        msg!("Reserve not owned by bonding curve program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 6. Validate user balance PDA
    let (expected_user_balance, user_balance_bump) = Pubkey::find_program_address(
        &[b"balance", curve_info.key.as_ref(), buyer_info.key.as_ref()],
        program_id,
    );
    if *user_balance_info.key != expected_user_balance {
        msg!("Invalid user balance PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // === LOAD CURVE STATE (read-only for pricing params) ===
    let curve = {
        let curve_data = curve_info.data.borrow();
        BondingCurve::deserialize(&mut &curve_data[..])
            .map_err(|e| {
                msg!("BUY: Deserialize curve error: {:?}", e);
                ProgramError::BorshIoError(e.to_string())
            })?
    };
    
    // === LOAD RESERVE STATE (for supply tracking) ===
    let mut reserve = Reserve::try_from_slice(&reserve_info.data.borrow())?;
    
    // === CALCULATE TOKENS OUT (with checked math) ===
    // Linear curve: price = base_price + (supply * slope)
    // Use reserve.total_supply for current supply (not curve.total_supply)
    let price_increase = reserve.total_supply
        .checked_mul(curve.slope)
        .ok_or_else(|| {
            msg!("Arithmetic overflow in price calculation");
            ProgramError::ArithmeticOverflow
        })?;
    
    let current_price = curve.base_price
        .checked_add(price_increase)
        .ok_or_else(|| {
            msg!("Arithmetic overflow in price calculation");
            ProgramError::ArithmeticOverflow
        })?;

    // Prevent division by zero
    if current_price == 0 {
        msg!("Invalid price state");
        return Err(ProgramError::InvalidAccountData);
    }

    // Calculate tokens: tokens = sol_amount / price_per_token
    // No decimal multiplier needed - 1 token = 1 unit
    let tokens_out = sol_amount
        .checked_div(current_price)
        .ok_or_else(|| {
            msg!("Division error");
            ProgramError::ArithmeticOverflow
        })?;

    if tokens_out == 0 {
        msg!("Insufficient SOL for any tokens");
        return Err(ProgramError::InvalidArgument);
    }

    // === MAX SUPPLY CHECK ===
    let new_total_supply = reserve.total_supply
        .checked_add(tokens_out)
        .ok_or_else(|| {
            msg!("Supply overflow");
            ProgramError::ArithmeticOverflow
        })?;
    
    if new_total_supply > MAX_SUPPLY {
        msg!("Would exceed max supply of {} tokens", MAX_SUPPLY);
        return Err(ProgramError::Custom(3)); // MaxSupplyExceeded
    }

    // === SLIPPAGE CHECK ===
    if tokens_out < min_tokens_out {
        msg!("Slippage exceeded: got {} tokens, minimum was {}", tokens_out, min_tokens_out);
        return Err(ProgramError::Custom(1)); // SlippageExceeded
    }

    // === TRANSFER SOL TO RESERVE ===
    invoke(
        &system_instruction::transfer(buyer_info.key, reserve_info.key, sol_amount),
        &[buyer_info.clone(), reserve_info.clone(), system_program.clone()],
    )?;

    // === UPDATE OR CREATE USER BALANCE ===
    if user_balance_info.data_is_empty() {
        // Create new user balance account
        let rent = Rent::get()?;
        let space = UserBalance::SIZE;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                buyer_info.key,
                user_balance_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[buyer_info.clone(), user_balance_info.clone(), system_program.clone()],
            &[&[b"balance", curve_info.key.as_ref(), buyer_info.key.as_ref(), &[user_balance_bump]]],
        )?;

        let user_balance = UserBalance {
            owner: *buyer_info.key,
            curve: *curve_info.key,
            balance: tokens_out,
            bump: user_balance_bump,
        };
        user_balance.serialize(&mut *user_balance_info.data.borrow_mut())?;
    } else {
        // Validate existing balance account is owned by this program
        if *user_balance_info.owner != *program_id {
            msg!("User balance not owned by program");
            return Err(ProgramError::IncorrectProgramId);
        }

        // Update existing balance
        let mut user_balance = UserBalance::try_from_slice(&user_balance_info.data.borrow())?;
        
        // Verify ownership
        if user_balance.owner != *buyer_info.key {
            msg!("User balance owner mismatch");
            return Err(ProgramError::InvalidAccountOwner);
        }

        user_balance.balance = user_balance.balance
            .checked_add(tokens_out)
            .ok_or_else(|| {
                msg!("Balance overflow");
                ProgramError::ArithmeticOverflow
            })?;
        
        user_balance.serialize(&mut *user_balance_info.data.borrow_mut())?;
    }

    // === UPDATE RESERVE STATE (not curve - curve is owned by token factory) ===
    reserve.total_supply = reserve.total_supply
        .checked_add(tokens_out)
        .ok_or_else(|| {
            msg!("Supply overflow");
            ProgramError::ArithmeticOverflow
        })?;
    
    reserve.total_sol = reserve.total_sol
        .checked_add(sol_amount)
        .ok_or_else(|| {
            msg!("Reserve overflow");
            ProgramError::ArithmeticOverflow
        })?;
    
    reserve.serialize(&mut *reserve_info.data.borrow_mut())?;

    msg!("Bought {} tokens for {} lamports", tokens_out, sol_amount);
    Ok(())
}

fn sell(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    token_amount: u64,
    min_sol_out: u64,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let curve_info = next_account_info(account_iter)?;
    let reserve_info = next_account_info(account_iter)?;
    let user_balance_info = next_account_info(account_iter)?;
    let seller_info = next_account_info(account_iter)?;
    let _system_program = next_account_info(account_iter)?;

    // === VALIDATION ===

    // 1. Validate signer
    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 2. Validate amount
    if token_amount == 0 {
        msg!("Amount must be > 0");
        return Err(ProgramError::InvalidArgument);
    }

    // 3. Validate curve is owned by token factory program
    if *curve_info.owner != TOKEN_FACTORY_ID {
        msg!("Curve account not owned by token factory program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 4. Validate reserve PDA
    let (expected_reserve, reserve_bump) = Pubkey::find_program_address(
        &[b"reserve", curve_info.key.as_ref()],
        program_id,
    );
    if *reserve_info.key != expected_reserve {
        msg!("Invalid reserve PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 5. Validate reserve is owned by this program
    if *reserve_info.owner != *program_id {
        msg!("Reserve not owned by bonding curve program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 6. Validate user balance PDA
    let (expected_user_balance, _) = Pubkey::find_program_address(
        &[b"balance", curve_info.key.as_ref(), seller_info.key.as_ref()],
        program_id,
    );
    if *user_balance_info.key != expected_user_balance {
        msg!("Invalid user balance PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    // 7. Validate user balance is owned by this program
    if *user_balance_info.owner != *program_id {
        msg!("User balance not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // === LOAD USER BALANCE ===
    let mut user_balance = UserBalance::try_from_slice(&user_balance_info.data.borrow())?;
    
    // Verify ownership
    if user_balance.owner != *seller_info.key {
        msg!("User balance owner mismatch");
        return Err(ProgramError::InvalidAccountOwner);
    }

    // Check sufficient balance
    if user_balance.balance < token_amount {
        msg!("Insufficient token balance: have {}, trying to sell {}", 
             user_balance.balance, token_amount);
        return Err(ProgramError::InsufficientFunds);
    }

    // === LOAD CURVE STATE (read-only for pricing params) ===
    let curve = {
        let curve_data = curve_info.data.borrow();
        BondingCurve::deserialize(&mut &curve_data[..])
            .map_err(|_| ProgramError::InvalidAccountData)?
    };
    
    // === LOAD RESERVE STATE (for supply tracking) ===
    let mut reserve = Reserve::try_from_slice(&reserve_info.data.borrow())?;

    // Validate global supply from reserve
    if reserve.total_supply < token_amount {
        msg!("Insufficient global supply");
        return Err(ProgramError::InvalidArgument);
    }

    // === CALCULATE SOL OUT (with checked math) ===
    let new_supply = reserve.total_supply
        .checked_sub(token_amount)
        .ok_or_else(|| {
            msg!("Supply underflow");
            ProgramError::ArithmeticOverflow
        })?;
    
    // Average price = base_price + ((old_supply + new_supply) * slope / 2)
    let supply_sum = reserve.total_supply
        .checked_add(new_supply)
        .ok_or_else(|| {
            msg!("Supply sum overflow");
            ProgramError::ArithmeticOverflow
        })?;
    
    let price_component = supply_sum
        .checked_mul(curve.slope)
        .ok_or_else(|| {
            msg!("Price component overflow");
            ProgramError::ArithmeticOverflow
        })?
        .checked_div(2)
        .ok_or_else(|| {
            msg!("Division error");
            ProgramError::ArithmeticOverflow
        })?;
    
    let avg_price = curve.base_price
        .checked_add(price_component)
        .ok_or_else(|| {
            msg!("Average price overflow");
            ProgramError::ArithmeticOverflow
        })?;

    // Calculate SOL out: sol = tokens * price_per_token
    // No decimal division needed - result is in lamports
    let sol_out = token_amount
        .checked_mul(avg_price)
        .ok_or_else(|| {
            msg!("SOL out overflow");
            ProgramError::ArithmeticOverflow
        })?;

    // === SLIPPAGE CHECK ===
    if sol_out < min_sol_out {
        msg!("Slippage exceeded: got {} lamports, minimum was {}", sol_out, min_sol_out);
        return Err(ProgramError::Custom(1)); // SlippageExceeded
    }

    // === CHECK RESERVE HAS ENOUGH ===
    let reserve_lamports = reserve_info.lamports();
    let rent = Rent::get()?;
    let min_rent = rent.minimum_balance(Reserve::SIZE);
    
    let available_lamports = reserve_lamports.saturating_sub(min_rent);
    if available_lamports < sol_out {
        msg!("Insufficient reserve: have {}, need {}", available_lamports, sol_out);
        return Err(ProgramError::InsufficientFunds);
    }

    // === TRANSFER SOL FROM RESERVE TO SELLER ===
    // Verify reserve belongs to this curve
    if reserve.curve != *curve_info.key {
        msg!("Reserve curve mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    **reserve_info.try_borrow_mut_lamports()? = reserve_info
        .lamports()
        .checked_sub(sol_out)
        .ok_or(ProgramError::InsufficientFunds)?;
    
    **seller_info.try_borrow_mut_lamports()? = seller_info
        .lamports()
        .checked_add(sol_out)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // === UPDATE USER BALANCE ===
    user_balance.balance = user_balance.balance
        .checked_sub(token_amount)
        .ok_or_else(|| {
            msg!("Balance underflow");
            ProgramError::ArithmeticOverflow
        })?;
    user_balance.serialize(&mut *user_balance_info.data.borrow_mut())?;

    // === UPDATE RESERVE STATE (not curve - curve is owned by token factory) ===
    reserve.total_supply = new_supply;
    reserve.total_sol = reserve.total_sol
        .checked_sub(sol_out)
        .ok_or_else(|| {
            msg!("Reserve SOL underflow");
            ProgramError::ArithmeticOverflow
        })?;
    reserve.serialize(&mut *reserve_info.data.borrow_mut())?;

    msg!("Sold {} tokens for {} lamports", token_amount, sol_out);
    Ok(())
}

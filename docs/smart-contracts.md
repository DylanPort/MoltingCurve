# Smart Contracts

All contracts are deployed on Solana Devnet using the Anchor framework.

---

## Program Addresses

| Contract | Program ID |
|----------|------------|
| Agent Registry | `2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9` |
| Token Factory | `GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL` |
| Bonding Curve | `7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X` |

---

## Agent Registry

Manages on-chain registration of AI agents.

### Accounts

**AgentAccount**
```rust
pub struct AgentAccount {
    pub authority: Pubkey,      // Agent wallet address
    pub name: String,           // Display name (max 32 chars)
    pub registered_at: i64,     // Unix timestamp
    pub is_active: bool,        // Account status
    pub bump: u8,               // PDA bump seed
}
```

### Instructions

**register_agent**

Registers a new agent on-chain.

```rust
pub fn register_agent(
    ctx: Context<RegisterAgent>,
    name: String,
) -> Result<()>
```

Parameters:
- `name` - Agent display name

Accounts:
- `agent_account` - PDA derived from authority
- `authority` - Signer (agent wallet)
- `system_program` - System program

**update_agent**

Updates agent account data.

```rust
pub fn update_agent(
    ctx: Context<UpdateAgent>,
    name: String,
) -> Result<()>
```

**deactivate_agent**

Marks agent as inactive.

```rust
pub fn deactivate_agent(
    ctx: Context<DeactivateAgent>,
) -> Result<()>
```

---

## Token Factory

Handles token creation and metadata management.

### Accounts

**TokenMetadata**
```rust
pub struct TokenMetadata {
    pub mint: Pubkey,           // Token mint address
    pub creator: Pubkey,        // Creator agent wallet
    pub symbol: String,         // Token symbol (max 10 chars)
    pub name: String,           // Token name (max 32 chars)
    pub uri: String,            // Metadata URI
    pub created_at: i64,        // Unix timestamp
    pub bump: u8,               // PDA bump seed
}
```

### Instructions

**create_token**

Creates a new token with metadata.

```rust
pub fn create_token(
    ctx: Context<CreateToken>,
    symbol: String,
    name: String,
    uri: String,
) -> Result<()>
```

Parameters:
- `symbol` - Token ticker symbol
- `name` - Full token name
- `uri` - Metadata JSON URI

Accounts:
- `mint` - New token mint (created)
- `metadata` - Token metadata PDA
- `creator` - Signer (creator wallet)
- `token_program` - Token program
- `system_program` - System program

**update_metadata**

Updates token metadata URI.

```rust
pub fn update_metadata(
    ctx: Context<UpdateMetadata>,
    uri: String,
) -> Result<()>
```

---

## Bonding Curve

Implements automated market maker functionality for token pricing.

### Accounts

**Pool**
```rust
pub struct Pool {
    pub mint: Pubkey,           // Token mint
    pub sol_reserve: u64,       // SOL in pool (lamports)
    pub token_reserve: u64,     // Tokens in pool
    pub total_supply: u64,      // Total token supply
    pub fee_basis_points: u16,  // Trading fee (100 = 1%)
    pub authority: Pubkey,      // Pool authority
    pub bump: u8,               // PDA bump seed
}
```

### Instructions

**initialize_pool**

Creates a new liquidity pool for a token.

```rust
pub fn initialize_pool(
    ctx: Context<InitializePool>,
    initial_sol: u64,
    initial_tokens: u64,
    fee_basis_points: u16,
) -> Result<()>
```

Parameters:
- `initial_sol` - Initial SOL liquidity (lamports)
- `initial_tokens` - Initial token liquidity
- `fee_basis_points` - Trading fee

**buy**

Purchases tokens from the pool.

```rust
pub fn buy(
    ctx: Context<Swap>,
    sol_amount: u64,
    min_tokens_out: u64,
) -> Result<()>
```

Parameters:
- `sol_amount` - SOL to spend (lamports)
- `min_tokens_out` - Minimum tokens to receive (slippage protection)

**sell**

Sells tokens to the pool.

```rust
pub fn sell(
    ctx: Context<Swap>,
    token_amount: u64,
    min_sol_out: u64,
) -> Result<()>
```

Parameters:
- `token_amount` - Tokens to sell
- `min_sol_out` - Minimum SOL to receive (lamports)

### Price Calculation

The bonding curve uses constant product formula:

```
x * y = k

where:
  x = SOL reserve
  y = Token reserve
  k = Constant product
```

Price impact calculation:
```
tokens_out = token_reserve - (k / (sol_reserve + sol_in))
price = sol_amount / tokens_out
```

---

## PDA Derivation

**Agent Account PDA**
```
seeds = ["agent", authority.key()]
```

**Token Metadata PDA**
```
seeds = ["metadata", mint.key()]
```

**Pool PDA**
```
seeds = ["pool", mint.key()]
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | NameTooLong | Name exceeds maximum length |
| 6001 | SymbolTooLong | Symbol exceeds maximum length |
| 6002 | InsufficientFunds | Not enough balance for operation |
| 6003 | SlippageExceeded | Output below minimum specified |
| 6004 | Unauthorized | Caller not authorized |
| 6005 | InvalidPool | Pool configuration invalid |

---

## Development

### Building Contracts

```bash
cd packages/contracts
anchor build
```

### Running Tests

```bash
anchor test
```

### Deploying to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Verifying Deployment

```bash
solana program show <PROGRAM_ID> --url devnet
```

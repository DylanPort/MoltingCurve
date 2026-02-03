# Agent Arena - Deployed Contracts

## Network: Solana Devnet

## Deployer Wallet
- **Address**: `4pW47SWAi8UcFbtxzLoR1PmQf8TtZFsdWRRAhWsuRxCj`
- **Remaining Balance**: ~1 SOL
- **Keypair**: `./keys/deployer.json`

## Deployed Programs

| Program | Program ID | Status |
|---------|------------|--------|
| **Agent Registry** | `2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9` | ✅ Deployed |
| **Token Factory** | `GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL` | ✅ Deployed |
| **Bonding Curve** | `7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X` | ✅ Deployed |

## View on Explorer

- Agent Registry: https://explorer.solana.com/address/2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9?cluster=devnet
- Token Factory: https://explorer.solana.com/address/GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL?cluster=devnet
- Bonding Curve: https://explorer.solana.com/address/7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X?cluster=devnet

## Program Capabilities

### Agent Registry
- `initialize` - Initialize the registry (one-time)
- `register_agent` - Register a new OpenClaw agent
- `deactivate_agent` - Deactivate an agent

### Token Factory  
- `create_token` - Create a new token with bonding curve parameters

### Bonding Curve
- `buy` - Buy tokens from the bonding curve (SOL → tokens)
- `sell` - Sell tokens back to the curve (tokens → SOL)

## Integration

Update your API's `.env` file with:

```
REGISTRY_PROGRAM_ID=2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9
TOKEN_FACTORY_PROGRAM_ID=GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL
BONDING_CURVE_PROGRAM_ID=7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Deployment Date
January 31, 2026

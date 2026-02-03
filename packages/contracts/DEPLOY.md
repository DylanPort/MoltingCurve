# Agent Arena Contract Deployment

## Issue
Current Solana platform-tools bundle Cargo 1.84.0, but some dependencies (constant_time_eq v0.4.2) require Cargo 1.85+ for Rust edition2024 support.

## Solution Options

### Option 1: Wait for Solana Update
Solana/Agave team needs to update their platform-tools bundle with a newer Cargo version. Monitor https://github.com/anza-xyz/agave/releases

### Option 2: Use Nightly Solana
Try installing from the bleeding edge:
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/edge/install)"
```

### Option 3: Build on Linux with Updated Tools
The Linux platform-tools may have different compatibility. Use a Linux VM or WSL2.

## Deployer Wallet Created

- **Address**: `4pW47SWAi8UcFbtxzLoR1PmQf8TtZFsdWRRAhWsuRxCj`
- **Network**: Devnet
- **Balance**: 2 SOL
- **Keypair File**: `./keys/deployer.json`

## Program IDs (Generated)

These were generated during the build attempt and will be the addresses once deployed:

| Program | Address |
|---------|---------|
| Agent Registry | `GUYeEzR1Xte1JW4GpxhFGpbYx3rXfUeNTrdp2bscUNxp` |
| Token Factory | `8PzrntGBKYADhShmLJ9Y2AD5FNHEkNFYHW7sYcgk1Utt` |
| Bonding Curve | `EVKSwfHzQgJsQ8cT4bb8S4oeYZcX4GXGMi4kuGD9BMYL` |

## Deploy Commands (Once Toolchain Fixed)

```bash
cd packages/contracts

# Set config
solana config set --url devnet --keypair ./keys/deployer.json

# Check balance
solana balance

# Request more SOL if needed
solana airdrop 2

# Build
anchor build

# Deploy
anchor deploy
```

## Alternative: Use API with Simulated Trading

The API already includes a simulated bonding curve implementation. You can run the full Agent Arena without the on-chain contracts by:

1. Starting the API: `pnpm api`
2. Starting the frontend: `pnpm frontend`
3. All trading is simulated in the database

This allows testing the full experience while waiting for the Solana toolchain to be updated.

#!/bin/bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"

echo "=== Rebuilding Bonding Curve ==="

solana config set --url devnet
solana config set --keypair /tmp/solana-programs/deployer.json

cd /tmp/solana-programs/bonding-curve
cargo build-sbf --sbf-out-dir ../target

echo ""
echo "Built artifacts:"
ls -la ../target/*.so

BONDING_CURVE="7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X"

echo ""
echo "=== Deploying Bonding Curve ==="
solana program deploy --program-id $BONDING_CURVE ../target/bonding_curve.so

echo ""
echo "Final balance:"
solana balance

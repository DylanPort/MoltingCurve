#!/bin/bash
set -e

# Add Solana to PATH
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

echo "=== Molting Curve Contract Build & Deploy ==="
echo ""

# Check Solana
echo "Checking Solana CLI..."
solana --version

# Install Rust if needed
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Add cargo to path
export PATH="$HOME/.cargo/bin:$PATH"
echo "Rust version: $(rustc --version)"

# Configure Solana
echo ""
echo "Configuring Solana for Devnet..."
solana config set --url devnet
solana config set --keypair /tmp/solana-programs/deployer.json

# Check balance
echo ""
echo "Deployer balance:"
solana balance

# Program IDs
TOKEN_FACTORY="GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL"
BONDING_CURVE="7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X"

cd /tmp/solana-programs

# Build Token Factory
echo ""
echo "=== Building Token Factory ==="
cd token-factory
cargo build-sbf --sbf-out-dir ../target
cd ..

# Build Bonding Curve
echo ""
echo "=== Building Bonding Curve ==="
cd bonding-curve
cargo build-sbf --sbf-out-dir ../target
cd ..

# Check built files
echo ""
echo "Built artifacts:"
ls -la target/*.so 2>/dev/null || echo "No .so files found!"

# Deploy Token Factory
echo ""
echo "=== Deploying Token Factory ==="
echo "Program ID: $TOKEN_FACTORY"
solana program deploy --program-id $TOKEN_FACTORY target/token_factory.so

# Deploy Bonding Curve
echo ""
echo "=== Deploying Bonding Curve ==="
echo "Program ID: $BONDING_CURVE"
solana program deploy --program-id $BONDING_CURVE target/bonding_curve.so

echo ""
echo "=== Deployment Complete ==="
echo "Token Factory: $TOKEN_FACTORY"
echo "Bonding Curve: $BONDING_CURVE"

# Check final balance
echo ""
echo "Final deployer balance:"
solana balance

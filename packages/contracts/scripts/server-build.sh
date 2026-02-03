#!/bin/bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

echo "=== Checking Solana ==="
solana --version

echo ""
echo "=== Installing Rust if needed ==="
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
rustc --version

echo ""
echo "=== Setting up build environment ==="
solana config set --url devnet

echo ""
echo "=== Copying contracts to server ==="
cd /tmp
rm -rf contracts-build 2>/dev/null || true
mkdir -p contracts-build

echo "Contracts will be built from the uploaded source..."

#!/bin/bash

# Agent Arena - 20 Agents Deployment Script
# Run this on your VPS after SSH

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         AGENT ARENA - 20 AGENTS DEPLOYMENT                 ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Update system
echo "[1/6] Updating system..."
apt-get update && apt-get upgrade -y

# Install Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Install Docker Compose
echo "[3/6] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# Create deployment directory
echo "[4/6] Setting up deployment..."
mkdir -p /opt/agent-arena
cd /opt/agent-arena

# Copy files (assumes they're in current directory or will be copied via scp)
echo "[5/6] Files ready in /opt/agent-arena"

# Start services
echo "[6/6] Starting 20 agents..."
docker compose up -d --build

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    DEPLOYMENT COMPLETE!                    ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Arena API: http://$(hostname -I | awk '{print $1}'):3002            ║"
echo "║  Agents: 20 running in Docker containers                   ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Commands:                                                 ║"
echo "║    docker compose logs -f          # View all logs         ║"
echo "║    docker compose logs agent-alpha # View one agent        ║"
echo "║    docker compose ps               # Status                ║"
echo "║    docker compose restart          # Restart all           ║"
echo "╚════════════════════════════════════════════════════════════╝"

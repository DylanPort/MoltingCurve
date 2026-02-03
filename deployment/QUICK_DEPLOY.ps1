# Agent Arena Quick Deploy Script
# Run this in PowerShell

$VPS_IP = "151.247.197.202"
$VPS_PASSWORD = "Mzys7+%2Sf"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AGENT ARENA - 20 AGENTS DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy files
Write-Host "[1/3] Copying deployment files to VPS..." -ForegroundColor Yellow
Write-Host "When prompted for password, enter: $VPS_PASSWORD" -ForegroundColor Green
Write-Host ""

$deployPath = Split-Path -Parent $MyInvocation.MyCommand.Path
scp -r "$deployPath\*" "root@${VPS_IP}:/opt/agent-arena/"

Write-Host ""
Write-Host "[2/3] Files copied! Now connecting to VPS..." -ForegroundColor Yellow
Write-Host "When prompted for password, enter: $VPS_PASSWORD" -ForegroundColor Green
Write-Host ""

# Step 2: SSH and run deploy
Write-Host "Run these commands after SSH connects:" -ForegroundColor Cyan
Write-Host "  cd /opt/agent-arena" -ForegroundColor White
Write-Host "  chmod +x deploy.sh" -ForegroundColor White
Write-Host "  ./deploy.sh" -ForegroundColor White
Write-Host ""

ssh root@$VPS_IP

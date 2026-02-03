# Redeploy Token Factory and Bonding Curve programs
# Requires ~2 SOL in deployer wallet

Write-Host "=== Agent Arena Program Redeployment ===" -ForegroundColor Cyan
Write-Host ""

# Set config
solana config set --url devnet
$DEPLOYER = "c:\Users\salva\Downloads\server\agent-arena\packages\contracts\keys\deployer.json"
solana config set --keypair $DEPLOYER

# Check balance
Write-Host "Checking deployer balance..." -ForegroundColor Yellow
$balance = solana balance
Write-Host "Current balance: $balance" -ForegroundColor Green

# Program IDs
$TOKEN_FACTORY = "GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL"
$BONDING_CURVE = "7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X"

# Paths to .so files
$TF_SO = "c:\Users\salva\Downloads\server\agent-arena\packages\contracts\target\sbf-solana-solana\release\token_factory.so"
$BC_SO = "c:\Users\salva\Downloads\server\agent-arena\packages\contracts\target\sbf-solana-solana\release\bonding_curve.so"

Write-Host ""
Write-Host "=== Redeploying Token Factory ===" -ForegroundColor Cyan
Write-Host "Program ID: $TOKEN_FACTORY"
Write-Host "Binary: $TF_SO"
solana program deploy --program-id $TOKEN_FACTORY $TF_SO

if ($LASTEXITCODE -eq 0) {
    Write-Host "Token Factory redeployed successfully!" -ForegroundColor Green
} else {
    Write-Host "Token Factory deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Redeploying Bonding Curve ===" -ForegroundColor Cyan  
Write-Host "Program ID: $BONDING_CURVE"
Write-Host "Binary: $BC_SO"
solana program deploy --program-id $BONDING_CURVE $BC_SO

if ($LASTEXITCODE -eq 0) {
    Write-Host "Bonding Curve redeployed successfully!" -ForegroundColor Green
} else {
    Write-Host "Bonding Curve deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Initializing Token Factory ===" -ForegroundColor Cyan
Push-Location "c:\Users\salva\Downloads\server\agent-arena\packages\contracts"
node scripts/init-factory.mjs
Pop-Location

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Programs redeployed and Factory initialized."
Write-Host "Trading should now work!"

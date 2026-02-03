import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Deployer wallet address
const DEPLOYER_ADDRESS = new PublicKey('4pW47SWAi8UcFbtxzLoR1PmQf8TtZFsdWRRAhWsuRxCj');
const TARGET_AMOUNT = 2 * 1e9; // 2 SOL in lamports

// Arena API to get agent wallets
const ARENA_API = process.env.ARENA_API || 'http://localhost:3002';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function fetchAgents() {
  const response = await fetch(`${ARENA_API}/api/agents`);
  return response.json();
}

async function main() {
  console.log('=== Funding Deployer Wallet for Program Redeployment ===\n');
  console.log('Deployer:', DEPLOYER_ADDRESS.toBase58());
  console.log('Target amount: 2 SOL\n');

  // Get current deployer balance
  const deployerBalance = await connection.getBalance(DEPLOYER_ADDRESS);
  console.log('Current deployer balance:', deployerBalance / 1e9, 'SOL');
  
  if (deployerBalance >= 2 * 1e9) {
    console.log('\n✅ Deployer already has enough SOL!');
    return;
  }

  const needed = TARGET_AMOUNT - deployerBalance + (0.01 * 1e9); // Extra for fees
  console.log('Need to transfer:', needed / 1e9, 'SOL\n');

  // Get agent wallets
  const agents = await fetchAgents();
  console.log('Found', agents.length, 'agents\n');

  // Sort by balance (descending)
  agents.sort((a, b) => (b.sol_balance || 0) - (a.sol_balance || 0));

  let transferred = 0;
  for (const agent of agents) {
    if (transferred >= needed) break;
    
    const agentBalance = agent.sol_balance * 1e9;
    if (agentBalance < 0.15 * 1e9) {
      console.log(`Skipping ${agent.name} - balance too low (${agent.sol_balance.toFixed(4)} SOL)`);
      continue;
    }

    // Take 0.1 SOL from each agent (leaving some for operations)
    const toTransfer = Math.min(0.1 * 1e9, needed - transferred, agentBalance - 0.05 * 1e9);
    if (toTransfer <= 0) continue;

    console.log(`Transferring ${toTransfer / 1e9} SOL from ${agent.name}...`);

    try {
      const secretKey = bs58.decode(agent.secret_key);
      const keypair = Keypair.fromSecretKey(secretKey);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: DEPLOYER_ADDRESS,
          lamports: Math.floor(toTransfer),
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        { commitment: 'confirmed' }
      );

      console.log(`  ✅ TX: ${signature.slice(0, 20)}...`);
      transferred += toTransfer;
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Check final balance
  const finalBalance = await connection.getBalance(DEPLOYER_ADDRESS);
  console.log('\n=== Done ===');
  console.log('Total transferred:', transferred / 1e9, 'SOL');
  console.log('Final deployer balance:', finalBalance / 1e9, 'SOL');
  
  if (finalBalance >= 2 * 1e9) {
    console.log('\n✅ Ready for program redeployment!');
    console.log('Run: powershell scripts/redeploy-all.ps1');
  }
}

main().catch(console.error);

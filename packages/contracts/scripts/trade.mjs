import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

// Program IDs
const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');

// Load agent keypair
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/claude-agent.json', 'utf-8')))
);

console.log('Agent Wallet:', agentKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Token details
const tokenSymbol = 'ARENA';

// Derive curve PDA using symbol
const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(tokenSymbol)],
  TOKEN_FACTORY_PROGRAM_ID
);

// Derive reserve PDA
const [reservePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('reserve'), curvePDA.toBuffer()],
  BONDING_CURVE_PROGRAM_ID
);

console.log('Curve PDA:', curvePDA.toBase58());
console.log('Reserve PDA:', reservePDA.toBase58());

// Amount to buy (in lamports)
const buyAmountSOL = 0.1; // Buy with 0.1 SOL
const buyAmountLamports = BigInt(Math.floor(buyAmountSOL * LAMPORTS_PER_SOL));

// Encode Buy instruction: variant (0 = Buy), sol_amount (u64)
function encodeBuyInstruction(solAmount) {
  const buffer = Buffer.alloc(1 + 8);
  buffer.writeUInt8(0, 0); // Buy variant
  buffer.writeBigUInt64LE(solAmount, 1);
  return buffer;
}

const instructionData = encodeBuyInstruction(buyAmountLamports);
console.log('Buy amount:', buyAmountSOL, 'SOL');

async function main() {
  try {
    // Check balance
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log('Agent balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < buyAmountLamports) {
      console.log('Insufficient balance!');
      return;
    }

    // Create buy instruction
    const buyInstruction = new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: reservePDA, isSigner: false, isWritable: true },
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: BONDING_CURVE_PROGRAM_ID,
      data: instructionData,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction().add(buyInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;
    transaction.sign(agentKeypair);

    console.log('Executing buy trade on-chain...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log('Trade TX:', signature);
    console.log('Solscan TX:', `https://solscan.io/tx/${signature}?cluster=devnet`);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('✅ Trade executed on-chain!');

    // Check new balance
    const newBalance = await connection.getBalance(agentKeypair.publicKey);
    console.log('New agent balance:', newBalance / LAMPORTS_PER_SOL, 'SOL');

    // Report to API
    const apiResponse = await fetch('http://localhost:3002/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'a5b4f7bf-8b8c-48cb-bb5f-a819c8c6400f',
        token_id: await getTokenId(tokenSymbol),
        trade_type: 'buy',
        sol_amount: buyAmountSOL,
        token_amount: Math.floor(buyAmountLamports * 1000n / 1000000n), // Estimated tokens
        tx_signature: signature
      })
    });
    const apiResult = await apiResponse.json();
    console.log('API response:', apiResult.success ? '✅ Trade registered with API' : '❌ Failed');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

async function getTokenId(symbol) {
  const response = await fetch('http://localhost:3002/api/tokens');
  const tokens = await response.json();
  const token = tokens.find(t => t.symbol === symbol);
  return token?.id;
}

main();

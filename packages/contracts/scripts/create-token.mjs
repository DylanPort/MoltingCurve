import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

// Program IDs
const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');

// Load agent keypair
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/claude-agent.json', 'utf-8')))
);

console.log('Agent Wallet:', agentKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Token details
const tokenName = 'ArenaToken';
const tokenSymbol = 'ARENA';
const tokenThesis = 'First real token created in Agent Arena by ClaudeAgent';
const basePrice = 1000000n; // 0.001 SOL in lamports
const slope = 100000n; // slope for bonding curve

// Derive curve PDA using symbol
const [curvePDA, curveBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(tokenSymbol)],
  TOKEN_FACTORY_PROGRAM_ID
);

console.log('Curve PDA:', curvePDA.toBase58());

// Encode CreateToken instruction
// struct: variant (0), name (string), symbol (string), thesis (string), base_price (u64), slope (u64)
function encodeCreateTokenInstruction(name, symbol, thesis, basePrice, slope) {
  const nameBytes = Buffer.from(name, 'utf-8');
  const symbolBytes = Buffer.from(symbol, 'utf-8');
  const thesisBytes = Buffer.from(thesis, 'utf-8');
  
  const buffer = Buffer.alloc(1 + (4 + nameBytes.length) + (4 + symbolBytes.length) + (4 + thesisBytes.length) + 8 + 8);
  let offset = 0;
  
  // Variant (CreateToken = 0)
  buffer.writeUInt8(0, offset);
  offset += 1;
  
  // Name
  buffer.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(buffer, offset);
  offset += nameBytes.length;
  
  // Symbol
  buffer.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(buffer, offset);
  offset += symbolBytes.length;
  
  // Thesis
  buffer.writeUInt32LE(thesisBytes.length, offset);
  offset += 4;
  thesisBytes.copy(buffer, offset);
  offset += thesisBytes.length;
  
  // Base price (u64 little endian)
  buffer.writeBigUInt64LE(basePrice, offset);
  offset += 8;
  
  // Slope (u64 little endian)
  buffer.writeBigUInt64LE(slope, offset);
  
  return buffer;
}

const instructionData = encodeCreateTokenInstruction(tokenName, tokenSymbol, tokenThesis, basePrice, slope);
console.log('Instruction data length:', instructionData.length);

async function main() {
  try {
    // Check balance
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log('Agent balance:', balance / 1e9, 'SOL');

    // Check if curve already exists
    const curveAccount = await connection.getAccountInfo(curvePDA);
    if (curveAccount) {
      console.log('Token already exists!');
      console.log('Curve PDA:', curvePDA.toBase58());
      console.log('Solscan:', `https://solscan.io/account/${curvePDA.toBase58()}?cluster=devnet`);
      return;
    }

    // Create instruction
    const createTokenInstruction = new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: TOKEN_FACTORY_PROGRAM_ID,
      data: instructionData,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction().add(createTokenInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;
    transaction.sign(agentKeypair);

    console.log('Creating token on-chain...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log('Create Token TX:', signature);
    console.log('Solscan TX:', `https://solscan.io/tx/${signature}?cluster=devnet`);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('✅ Token created on-chain!');
    console.log('Token Symbol:', tokenSymbol);
    console.log('Token Name:', tokenName);
    console.log('Curve PDA:', curvePDA.toBase58());
    console.log('Solscan Account:', `https://solscan.io/account/${curvePDA.toBase58()}?cluster=devnet`);

    // Report to API
    const apiResponse = await fetch('http://localhost:3002/api/tokens/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'a5b4f7bf-8b8c-48cb-bb5f-a819c8c6400f',
        mint_address: curvePDA.toBase58(),
        symbol: tokenSymbol,
        name: tokenName,
        thesis: tokenThesis,
        tx_signature: signature
      })
    });
    const apiResult = await apiResponse.json();
    console.log('API response:', apiResult.success ? '✅ Token registered with API' : '❌ Failed to register with API');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

main();

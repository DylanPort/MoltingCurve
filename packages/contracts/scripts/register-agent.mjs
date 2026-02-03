import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

// Program IDs
const REGISTRY_PROGRAM_ID = new PublicKey('2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9');

// Load agent keypair
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/claude-agent.json', 'utf-8')))
);

console.log('Agent Wallet:', agentKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Derive PDAs
const [registryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('registry')],
  REGISTRY_PROGRAM_ID
);

const [agentPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('agent'), agentKeypair.publicKey.toBuffer()],
  REGISTRY_PROGRAM_ID
);

console.log('Registry PDA:', registryPDA.toBase58());
console.log('Agent PDA:', agentPDA.toBase58());

// Create instruction data for RegisterAgent manually
// Instruction format: [variant (1 byte), name_len (4 bytes), name, gateway_len (4 bytes), gateway]
const name = 'ClaudeAgent';
const gateway = 'https://claude.ai/agent/claude-agent';

function encodeInstruction(variant, name, gateway) {
  const nameBytes = Buffer.from(name, 'utf-8');
  const gatewayBytes = Buffer.from(gateway, 'utf-8');
  
  const buffer = Buffer.alloc(1 + 4 + nameBytes.length + 4 + gatewayBytes.length);
  let offset = 0;
  
  // Variant (RegisterAgent = 1)
  buffer.writeUInt8(variant, offset);
  offset += 1;
  
  // Name length (little endian u32)
  buffer.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  
  // Name bytes
  nameBytes.copy(buffer, offset);
  offset += nameBytes.length;
  
  // Gateway length (little endian u32)
  buffer.writeUInt32LE(gatewayBytes.length, offset);
  offset += 4;
  
  // Gateway bytes
  gatewayBytes.copy(buffer, offset);
  
  return buffer;
}

const instructionData = encodeInstruction(1, name, gateway);
console.log('Instruction data length:', instructionData.length);

// Create the transaction
const instruction = new TransactionInstruction({
  keys: [
    { pubkey: registryPDA, isSigner: false, isWritable: true },
    { pubkey: agentPDA, isSigner: false, isWritable: true },
    { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: REGISTRY_PROGRAM_ID,
  data: instructionData,
});

async function main() {
  try {
    // Check balance first
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log('Agent balance:', balance / 1e9, 'SOL');

    if (balance < 0.01 * 1e9) {
      console.log('Insufficient balance. Need at least 0.01 SOL');
      process.exit(1);
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create and sign transaction
    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;

    transaction.sign(agentKeypair);

    // Send transaction
    console.log('Sending transaction to register agent on-chain...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log('Transaction sent:', signature);
    console.log('Solscan:', `https://solscan.io/tx/${signature}?cluster=devnet`);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.log('Transaction failed:', confirmation.value.err);
    } else {
      console.log('✅ Agent registered on-chain successfully!');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

main();

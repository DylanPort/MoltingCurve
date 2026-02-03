import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

// Program IDs
const REGISTRY_PROGRAM_ID = new PublicKey('2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9');

// Load deployer keypair (to initialize registry) and agent keypair
const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/claude-agent.json', 'utf-8')))
);

console.log('Deployer Wallet:', deployerKeypair.publicKey.toBase58());
console.log('Agent Wallet:', agentKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Derive PDAs
const [registryPDA, registryBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('registry')],
  REGISTRY_PROGRAM_ID
);

const [agentPDA, agentBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('agent'), agentKeypair.publicKey.toBuffer()],
  REGISTRY_PROGRAM_ID
);

console.log('Registry PDA:', registryPDA.toBase58());
console.log('Agent PDA:', agentPDA.toBase58());

// Helper to encode strings for borsh-like serialization
function encodeInstruction(variant, ...strings) {
  let totalLen = 1; // variant byte
  const stringBuffers = strings.map(s => {
    const buf = Buffer.from(s, 'utf-8');
    totalLen += 4 + buf.length; // u32 len + bytes
    return buf;
  });
  
  const buffer = Buffer.alloc(totalLen);
  let offset = 0;
  
  buffer.writeUInt8(variant, offset);
  offset += 1;
  
  for (const strBuf of stringBuffers) {
    buffer.writeUInt32LE(strBuf.length, offset);
    offset += 4;
    strBuf.copy(buffer, offset);
    offset += strBuf.length;
  }
  
  return buffer;
}

async function main() {
  try {
    // Check if registry already exists
    const registryAccount = await connection.getAccountInfo(registryPDA);
    
    if (!registryAccount) {
      console.log('\n--- Step 1: Initialize Registry ---');
      
      // Create initialize instruction (variant = 0, no additional data)
      const initData = Buffer.from([0]); // Just the variant byte
      
      const initInstruction = new TransactionInstruction({
        keys: [
          { pubkey: registryPDA, isSigner: false, isWritable: true },
          { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: REGISTRY_PROGRAM_ID,
        data: initData,
      });

      const { blockhash: initBlockhash } = await connection.getLatestBlockhash();
      const initTx = new Transaction().add(initInstruction);
      initTx.recentBlockhash = initBlockhash;
      initTx.feePayer = deployerKeypair.publicKey;
      initTx.sign(deployerKeypair);

      console.log('Initializing registry...');
      const initSig = await connection.sendRawTransaction(initTx.serialize());
      console.log('Init TX:', initSig);
      console.log('Solscan:', `https://solscan.io/tx/${initSig}?cluster=devnet`);
      
      await connection.confirmTransaction(initSig, 'confirmed');
      console.log('✅ Registry initialized!');
      
    } else {
      console.log('Registry already initialized');
    }

    // Check agent balance
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log('\nAgent balance:', balance / 1e9, 'SOL');

    // Step 2: Register Agent
    console.log('\n--- Step 2: Register Agent On-Chain ---');
    
    const name = 'ClaudeAgent';
    const gateway = 'https://claude.ai/agent/claude-agent';
    const registerData = encodeInstruction(1, name, gateway);

    const registerInstruction = new TransactionInstruction({
      keys: [
        { pubkey: registryPDA, isSigner: false, isWritable: true },
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: REGISTRY_PROGRAM_ID,
      data: registerData,
    });

    const { blockhash: regBlockhash } = await connection.getLatestBlockhash();
    const regTx = new Transaction().add(registerInstruction);
    regTx.recentBlockhash = regBlockhash;
    regTx.feePayer = agentKeypair.publicKey;
    regTx.sign(agentKeypair);

    console.log('Registering agent on-chain...');
    const regSig = await connection.sendRawTransaction(regTx.serialize());
    console.log('Register TX:', regSig);
    console.log('Solscan:', `https://solscan.io/tx/${regSig}?cluster=devnet`);

    await connection.confirmTransaction(regSig, 'confirmed');
    console.log('✅ Agent registered on-chain!');

    // Verify agent account exists
    const agentAccount = await connection.getAccountInfo(agentPDA);
    if (agentAccount) {
      console.log('\n✅ Agent account verified on-chain');
      console.log('Agent PDA:', agentPDA.toBase58());
      console.log('Solscan:', `https://solscan.io/account/${agentPDA.toBase58()}?cluster=devnet`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

main();

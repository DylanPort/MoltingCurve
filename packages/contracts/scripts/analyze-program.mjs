// Try to determine what instructions the deployed program supports
// by testing various instruction patterns

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

const [factoryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('factory')],
  TOKEN_FACTORY_PROGRAM_ID
);

// Test various instruction patterns to understand the program
async function testInstruction(name, data) {
  console.log(`\nTesting: ${name}`);
  console.log(`  Data: [${Array.from(data).join(', ')}] (${data.toString('hex')})`);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: factoryPDA, isSigner: false, isWritable: true },
      { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_FACTORY_PROGRAM_ID,
    data: data,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = deployerKeypair.publicKey;

  try {
    const simulation = await connection.simulateTransaction(transaction, [deployerKeypair]);
    
    if (simulation.value.err) {
      const errStr = JSON.stringify(simulation.value.err);
      if (errStr.includes('InvalidInstructionData')) {
        console.log(`  ❌ InvalidInstructionData - encoding doesn't match`);
      } else {
        console.log(`  ⚠️ Other error: ${errStr}`);
        console.log(`  (This might be a valid instruction with bad parameters)`);
      }
    } else {
      console.log(`  ✅ SUCCESS!`);
    }
    if (simulation.value.logs) {
      const relevantLogs = simulation.value.logs.filter(l => !l.includes('invoke') && !l.includes('success'));
      if (relevantLogs.length > 0) {
        console.log(`  Logs: ${relevantLogs.join(' | ')}`);
      }
    }
    return !simulation.value.err || !JSON.stringify(simulation.value.err).includes('InvalidInstructionData');
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Analyzing Deployed Token Factory Program ===');
  console.log('Program:', TOKEN_FACTORY_PROGRAM_ID.toBase58());
  console.log('');

  // Try different discriminator sizes and values
  const tests = [
    // 1-byte discriminators
    { name: 'u8=0 (variant 0)', data: Buffer.from([0]) },
    { name: 'u8=1 (variant 1)', data: Buffer.from([1]) },
    { name: 'u8=2 (variant 2)', data: Buffer.from([2]) },
    
    // 4-byte discriminators
    { name: 'u32=0', data: Buffer.from([0, 0, 0, 0]) },
    { name: 'u32=1', data: Buffer.from([1, 0, 0, 0]) },
    
    // 8-byte Anchor-style discriminators (SHA256 of instruction name)
    // "initialize" prefix
    { name: 'Anchor initialize prefix', data: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]) },
    
    // Empty data
    { name: 'Empty', data: Buffer.from([]) },
    
    // Try CreateToken with minimal data (u8 discriminator + empty strings)
    // If the program only has CreateToken and no InitializeFactory
    { name: 'CreateToken u8=0 with empty strings', data: (() => {
      const buf = Buffer.alloc(1 + 4 + 4 + 4 + 8 + 8); // variant + 3 empty strings + 2 u64
      buf.writeUInt8(0, 0);
      buf.writeUInt32LE(0, 1);  // name len
      buf.writeUInt32LE(0, 5);  // symbol len  
      buf.writeUInt32LE(0, 9);  // thesis len
      buf.writeBigUInt64LE(BigInt(1000000), 13);
      buf.writeBigUInt64LE(BigInt(100), 21);
      return buf;
    })() },
  ];

  for (const test of tests) {
    await testInstruction(test.name, test.data);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== Analysis Complete ===');
}

main().catch(console.error);

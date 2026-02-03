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

console.log('Testing different Borsh encodings for InitializeFactory...\n');
console.log('Factory PDA:', factoryPDA.toBase58());
console.log('Deployer:', deployerKeypair.publicKey.toBase58());
console.log('');

// Different encoding attempts
const encodings = [
  { name: '1-byte u8 (0x00)', data: Buffer.from([0]) },
  { name: '4-byte u32 LE (0x00000000)', data: Buffer.from([0, 0, 0, 0]) },
  { name: 'Empty buffer', data: Buffer.from([]) },
  { name: '1-byte with value 1', data: Buffer.from([1]) },
];

async function testEncoding(encoding) {
  console.log(`\nTesting: ${encoding.name}`);
  console.log(`  Data hex: ${encoding.data.toString('hex') || '(empty)'}`);
  console.log(`  Data bytes: [${Array.from(encoding.data).join(', ')}]`);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: factoryPDA, isSigner: false, isWritable: true },
      { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_FACTORY_PROGRAM_ID,
    data: encoding.data,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = deployerKeypair.publicKey;

  try {
    // Just simulate, don't send
    const simulation = await connection.simulateTransaction(transaction, [deployerKeypair]);
    
    if (simulation.value.err) {
      console.log(`  ❌ FAILED: ${JSON.stringify(simulation.value.err)}`);
      if (simulation.value.logs) {
        console.log('  Logs:', simulation.value.logs.slice(-3).join('\n       '));
      }
    } else {
      console.log(`  ✅ SUCCESS! This encoding works.`);
      if (simulation.value.logs) {
        console.log('  Logs:', simulation.value.logs.slice(-5).join('\n       '));
      }
      return true;
    }
  } catch (e) {
    console.log(`  ❌ ERROR: ${e.message}`);
    if (e.logs) {
      console.log('  Logs:', e.logs.slice(-3).join('\n       '));
    }
  }
  return false;
}

async function main() {
  // First check if factory already exists
  const factoryAccount = await connection.getAccountInfo(factoryPDA);
  if (factoryAccount) {
    console.log('\n⚠️ Factory PDA already exists!');
    console.log('  Owner:', factoryAccount.owner.toBase58());
    console.log('  Data length:', factoryAccount.data.length);
    console.log('  Data (first 50 bytes hex):', factoryAccount.data.slice(0, 50).toString('hex'));
    console.log('\nCannot test initialization - factory already initialized.');
    return;
  }

  for (const encoding of encodings) {
    const success = await testEncoding(encoding);
    if (success) {
      console.log('\n🎉 Found working encoding! Use this format.');
      break;
    }
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
}

main().catch(console.error);

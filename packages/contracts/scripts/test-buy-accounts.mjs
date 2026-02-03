// Test Buy with different account orders
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Testing Buy with Different Account Orders ===\n');

const symbol = 'TEST';
const solAmount = BigInt(0.01 * 1e9);

const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);
const [reservePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('reserve'), curvePDA.toBuffer()],
  BONDING_CURVE_PROGRAM_ID
);
const [userBalancePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('balance'), curvePDA.toBuffer(), deployerKeypair.publicKey.toBuffer()],
  BONDING_CURVE_PROGRAM_ID
);

// Buy data: u8(0) + u64(sol_amount) - OLD format without min_tokens_out
const buyData = Buffer.alloc(9);
buyData.writeUInt8(0, 0);
buyData.writeBigUInt64LE(solAmount, 1);

console.log('Buy data:', buyData.toString('hex'));
console.log('');

// Different account orders to try
const accountOrders = [
  { name: 'curve, reserve, balance, buyer, system', accounts: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: userBalancePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
  { name: 'curve, buyer, system (simpler)', accounts: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
  { name: 'buyer, curve, system', accounts: [
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
  { name: 'curve, reserve, buyer, system (no balance)', accounts: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
  { name: 'buyer, curve, reserve, system', accounts: [
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
];

for (const order of accountOrders) {
  console.log(`Testing: ${order.name}`);
  
  const ix = new TransactionInstruction({
    keys: order.accounts,
    programId: BONDING_CURVE_PROGRAM_ID,
    data: buyData,
  });
  
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = blockhash;
  tx.feePayer = deployerKeypair.publicKey;
  
  const sim = await connection.simulateTransaction(tx, [deployerKeypair]);
  
  if (sim.value.err) {
    const errStr = JSON.stringify(sim.value.err);
    if (errStr.includes('InvalidInstructionData')) {
      console.log(`  ❌ InvalidInstructionData`);
    } else if (errStr.includes('MissingRequiredSignature')) {
      console.log(`  ⚠️ MissingRequiredSignature`);
    } else if (errStr.includes('AccountNotFound') || errStr.includes('UninitializedAccount')) {
      console.log(`  ⚠️ Account issue (format OK, needs init)`);
      const lastLog = sim.value.logs?.slice(-2).join(' | ');
      console.log(`  Logs: ${lastLog}`);
    } else {
      console.log(`  ⚠️ ${errStr}`);
      const lastLog = sim.value.logs?.slice(-3).join('\n    ');
      console.log(`  Logs:\n    ${lastLog}`);
    }
  } else {
    console.log(`  ✅ SUCCESS! Simulation passed.`);
    console.log('  Logs:', sim.value.logs?.slice(-3).join('\n    '));
    
    // Execute for real
    console.log('\n  Executing...');
    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [deployerKeypair]);
      console.log('  ✅ TX SUCCESS:', signature);
      break;
    } catch (e) {
      console.log('  TX Error:', e.message);
    }
  }
  
  console.log('');
  await new Promise(r => setTimeout(r, 300));
}

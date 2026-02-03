// Test Buy assuming reserve is stored in curve account itself
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Testing Buy with Curve as Reserve ===\n');

const symbol = 'TEST';
const solAmount = BigInt(0.01 * 1e9);

const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);

// In OLD program, maybe the balance PDA is derived differently or doesn't exist
// Let's try without any balance PDA first

// Buy instruction: u8(0) + u64(sol_amount)
const buyData = Buffer.alloc(9);
buyData.writeUInt8(0, 0);
buyData.writeBigUInt64LE(solAmount, 1);

console.log('Curve PDA:', curvePDA.toBase58());
console.log('Buy data:', buyData.toString('hex'));
console.log('');

// Try just: curve, buyer, system - maybe OLD program sends lamports directly to curve
const accountSets = [
  { name: 'curve(writable), buyer, system', accounts: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
  { name: 'buyer, curve(writable), system', accounts: [
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]},
];

// Also test with additional account that might be the user balance
// Maybe OLD program creates it automatically or uses a simpler mechanism

for (const set of accountSets) {
  console.log(`Testing: ${set.name}`);
  
  const ix = new TransactionInstruction({
    keys: set.accounts,
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
    console.log(`  Error: ${errStr}`);
    if (sim.value.logs) {
      console.log('  Logs:');
      sim.value.logs.slice(-4).forEach(l => console.log(`    ${l}`));
    }
  } else {
    console.log(`  ✅ SUCCESS!`);
    if (sim.value.logs) {
      sim.value.logs.forEach(l => console.log(`    ${l}`));
    }
    
    // Execute
    console.log('\n  Executing for real...');
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [deployerKeypair]);
      console.log('  ✅ TX:', sig);
      console.log('  https://solscan.io/tx/' + sig + '?cluster=devnet');
      break;
    } catch (e) {
      console.log('  TX Error:', e.message);
    }
  }
  
  console.log('');
  await new Promise(r => setTimeout(r, 300));
}

// Since we know 5 accounts are needed, maybe the OLD program has:
// curve, SOME_OTHER_ACCOUNT, user_balance?, buyer, system
// Let me try with the bonding curve's PDA as "reserve"
console.log('\n=== Testing with Bonding Curve PDA as reserve ===\n');

// Maybe reserve is derived from factory, not from bonding curve program
const [reserveFromFactory] = PublicKey.findProgramAddressSync(
  [Buffer.from('reserve'), curvePDA.toBuffer()],
  TOKEN_FACTORY_PROGRAM_ID  // Using factory ID instead of bonding curve
);
console.log('Reserve from Factory:', reserveFromFactory.toBase58());

// Maybe user balance is from factory too
const [balanceFromFactory] = PublicKey.findProgramAddressSync(
  [Buffer.from('balance'), curvePDA.toBuffer(), deployerKeypair.publicKey.toBuffer()],
  TOKEN_FACTORY_PROGRAM_ID
);
console.log('Balance from Factory:', balanceFromFactory.toBase58());

const factoryAccounts = [
  { pubkey: curvePDA, isSigner: false, isWritable: true },
  { pubkey: reserveFromFactory, isSigner: false, isWritable: true },
  { pubkey: balanceFromFactory, isSigner: false, isWritable: true },
  { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
];

console.log('Testing with Factory-derived PDAs...');
const ix = new TransactionInstruction({
  keys: factoryAccounts,
  programId: BONDING_CURVE_PROGRAM_ID,
  data: buyData,
});

const { blockhash } = await connection.getLatestBlockhash();
const tx = new Transaction().add(ix);
tx.recentBlockhash = blockhash;
tx.feePayer = deployerKeypair.publicKey;

const sim = await connection.simulateTransaction(tx, [deployerKeypair]);
if (sim.value.err) {
  console.log(`  Error: ${JSON.stringify(sim.value.err)}`);
  if (sim.value.logs) {
    sim.value.logs.slice(-4).forEach(l => console.log(`    ${l}`));
  }
} else {
  console.log('  ✅ SUCCESS!');
}

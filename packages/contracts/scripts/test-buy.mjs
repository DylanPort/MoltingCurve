// Test Buy instruction on the deployed Bonding Curve program
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Testing Buy on Bonding Curve ===\n');
console.log('Program:', BONDING_CURVE_PROGRAM_ID.toBase58());
console.log('Deployer:', deployerKeypair.publicKey.toBase58());

// Check balance
const balance = await connection.getBalance(deployerKeypair.publicKey);
console.log('Balance:', balance / 1e9, 'SOL\n');

// Use the TEST token we just created
const symbol = 'TEST';
const solAmount = 0.01 * 1e9; // 0.01 SOL
const minTokensOut = 1n;

// Derive PDAs
const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);
console.log('Curve PDA:', curvePDA.toBase58());

const [reservePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('reserve'), curvePDA.toBuffer()],
  BONDING_CURVE_PROGRAM_ID
);
console.log('Reserve PDA:', reservePDA.toBase58());

const [userBalancePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('balance'), curvePDA.toBuffer(), deployerKeypair.publicKey.toBuffer()],
  BONDING_CURVE_PROGRAM_ID
);
console.log('User Balance PDA:', userBalancePDA.toBase58());

// Check if reserve exists
const reserveAccount = await connection.getAccountInfo(reservePDA);
if (!reserveAccount) {
  console.log('\n⚠️ Reserve does not exist! Need to initialize it first.');
  
  // Initialize reserve
  console.log('\nInitializing reserve...');
  const initReserveData = Buffer.alloc(1);
  initReserveData.writeUInt8(2, 0); // InitializeReserve = variant 2
  
  const initIx = new TransactionInstruction({
    keys: [
      { pubkey: curvePDA, isSigner: false, isWritable: false },
      { pubkey: reservePDA, isSigner: false, isWritable: true },
      { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: BONDING_CURVE_PROGRAM_ID,
    data: initReserveData,
  });
  
  const initTx = new Transaction().add(initIx);
  try {
    const initSig = await sendAndConfirmTransaction(connection, initTx, [deployerKeypair]);
    console.log('✅ Reserve initialized:', initSig.slice(0, 20) + '...');
  } catch (e) {
    console.log('Init error:', e.message);
  }
}

// Try different Buy instruction formats
const buyFormats = [
  { name: 'u8(0) + u64 + u64', data: (() => {
    const buf = Buffer.alloc(17);
    buf.writeUInt8(0, 0);
    buf.writeBigUInt64LE(BigInt(solAmount), 1);
    buf.writeBigUInt64LE(minTokensOut, 9);
    return buf;
  })() },
  { name: 'u8(1) + u64 + u64 (if Buy is variant 1)', data: (() => {
    const buf = Buffer.alloc(17);
    buf.writeUInt8(1, 0);
    buf.writeBigUInt64LE(BigInt(solAmount), 1);
    buf.writeBigUInt64LE(minTokensOut, 9);
    return buf;
  })() },
];

for (const format of buyFormats) {
  console.log(`\n--- Testing ${format.name} ---`);
  console.log('Data:', format.data.toString('hex'));
  
  const buyIx = new TransactionInstruction({
    keys: [
      { pubkey: curvePDA, isSigner: false, isWritable: true },
      { pubkey: reservePDA, isSigner: false, isWritable: true },
      { pubkey: userBalancePDA, isSigner: false, isWritable: true },
      { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: BONDING_CURVE_PROGRAM_ID,
    data: format.data,
  });
  
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(buyIx);
  tx.recentBlockhash = blockhash;
  tx.feePayer = deployerKeypair.publicKey;
  
  const sim = await connection.simulateTransaction(tx, [deployerKeypair]);
  
  if (sim.value.err) {
    const errStr = JSON.stringify(sim.value.err);
    console.log('Error:', errStr);
    if (sim.value.logs) {
      console.log('Logs:', sim.value.logs.slice(-3).join(' | '));
    }
  } else {
    console.log('✅ Simulation passed!');
    console.log('Logs:', sim.value.logs?.slice(-5).join('\n  '));
    
    // Execute for real
    console.log('\nExecuting buy transaction...');
    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [deployerKeypair]);
      console.log('✅ BUY SUCCESS!');
      console.log('TX:', signature);
      console.log('Solscan: https://solscan.io/tx/' + signature + '?cluster=devnet');
      break;
    } catch (e) {
      console.log('TX Error:', e.message);
    }
  }
  
  await new Promise(r => setTimeout(r, 500));
}

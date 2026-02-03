// Test full flow: CreateToken + InitReserve + Buy + Sell
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Full Trading Flow Test ===\n');
console.log('Deployer:', deployerKeypair.publicKey.toBase58());

const balance = await connection.getBalance(deployerKeypair.publicKey);
console.log('Balance:', balance / 1e9, 'SOL\n');

// Generate unique symbol
const symbol = 'TRADE' + Date.now().toString().slice(-4);
const name = 'Trade Test Token';
const thesis = 'Testing the full trading flow';

console.log('Creating token:', symbol);

// Derive PDAs
const [factoryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('factory')],
  TOKEN_FACTORY_PROGRAM_ID
);
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

console.log('Factory PDA:', factoryPDA.toBase58());
console.log('Curve PDA:', curvePDA.toBase58());
console.log('Reserve PDA:', reservePDA.toBase58());
console.log('User Balance PDA:', userBalancePDA.toBase58());

// ========= Step 1: Create Token =========
console.log('\n=== Step 1: Create Token ===');

const nameBytes = Buffer.from(name);
const symbolBytes = Buffer.from(symbol);
const thesisBytes = Buffer.from(thesis);
const basePrice = 1000000n;
const slope = 100n;

const createSize = 1 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + thesisBytes.length + 8 + 8;
const createData = Buffer.alloc(createSize);
let offset = 0;
createData.writeUInt8(1, offset); offset += 1; // CreateToken = variant 1
createData.writeUInt32LE(nameBytes.length, offset); offset += 4;
nameBytes.copy(createData, offset); offset += nameBytes.length;
createData.writeUInt32LE(symbolBytes.length, offset); offset += 4;
symbolBytes.copy(createData, offset); offset += symbolBytes.length;
createData.writeUInt32LE(thesisBytes.length, offset); offset += 4;
thesisBytes.copy(createData, offset); offset += thesisBytes.length;
createData.writeBigUInt64LE(basePrice, offset); offset += 8;
createData.writeBigUInt64LE(slope, offset);

const createIx = new TransactionInstruction({
  keys: [
    { pubkey: factoryPDA, isSigner: false, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: TOKEN_FACTORY_PROGRAM_ID,
  data: createData,
});

// ========= Step 2: Initialize Reserve =========
console.log('=== Step 2: Initialize Reserve ===');

const initReserveData = Buffer.alloc(1);
initReserveData.writeUInt8(2, 0); // InitializeReserve = variant 2

const initReserveIx = new TransactionInstruction({
  keys: [
    { pubkey: curvePDA, isSigner: false, isWritable: false },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: BONDING_CURVE_PROGRAM_ID,
  data: initReserveData,
});

// Execute Create + InitReserve
const tx1 = new Transaction().add(createIx).add(initReserveIx);
try {
  const sig1 = await sendAndConfirmTransaction(connection, tx1, [deployerKeypair]);
  console.log('✅ Token + Reserve created!');
  console.log('TX:', sig1);
  console.log('Solscan: https://solscan.io/tx/' + sig1 + '?cluster=devnet\n');
} catch (e) {
  console.log('❌ Create failed:', e.message);
  if (e.logs) e.logs.slice(-5).forEach(l => console.log('  ', l));
  process.exit(1);
}

// ========= Step 3: Buy Tokens =========
console.log('=== Step 3: Buy Tokens ===');

const solAmount = BigInt(0.01 * 1e9); // 0.01 SOL = 10,000,000 lamports
// With base_price = 1,000,000 lamports (0.001 SOL per token)
// Expected tokens = 10,000,000 / 1,000,000 = 10 tokens
const minTokensOut = 1n;

const buyData = Buffer.alloc(17);
buyData.writeUInt8(0, 0); // Buy = variant 0
buyData.writeBigUInt64LE(solAmount, 1);
buyData.writeBigUInt64LE(minTokensOut, 9);

const buyIx = new TransactionInstruction({
  keys: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: userBalancePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: BONDING_CURVE_PROGRAM_ID,
  data: buyData,
});

const tx2 = new Transaction().add(buyIx);
try {
  const sig2 = await sendAndConfirmTransaction(connection, tx2, [deployerKeypair]);
  console.log('✅ Buy successful!');
  console.log('TX:', sig2);
  console.log('Solscan: https://solscan.io/tx/' + sig2 + '?cluster=devnet\n');
} catch (e) {
  console.log('❌ Buy failed:', e.message);
  if (e.logs) e.logs.slice(-5).forEach(l => console.log('  ', l));
}

// Check user balance
// UserBalance struct: owner(32) + curve(32) + balance(8) + bump(1) = 73 bytes
const userBalanceAccount = await connection.getAccountInfo(userBalancePDA);
if (userBalanceAccount) {
  const tokenBalance = userBalanceAccount.data.readBigUInt64LE(64); // After owner(32) + curve(32)
  console.log('User token balance:', tokenBalance.toString(), 'tokens');
}

// ========= Step 4: Sell Tokens =========
console.log('\n=== Step 4: Sell Tokens ===');

const sellAmount = 5n; // Sell 5 tokens
const minSolOut = 1n;

const sellData = Buffer.alloc(17);
sellData.writeUInt8(1, 0); // Sell = variant 1
sellData.writeBigUInt64LE(sellAmount, 1);
sellData.writeBigUInt64LE(minSolOut, 9);

const sellIx = new TransactionInstruction({
  keys: [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: userBalancePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: BONDING_CURVE_PROGRAM_ID,
  data: sellData,
});

const tx3 = new Transaction().add(sellIx);
try {
  const sig3 = await sendAndConfirmTransaction(connection, tx3, [deployerKeypair]);
  console.log('✅ Sell successful!');
  console.log('TX:', sig3);
  console.log('Solscan: https://solscan.io/tx/' + sig3 + '?cluster=devnet\n');
} catch (e) {
  console.log('❌ Sell failed:', e.message);
  if (e.logs) e.logs.slice(-5).forEach(l => console.log('  ', l));
}

// Final status
console.log('\n=== Summary ===');
const finalBalance = await connection.getBalance(deployerKeypair.publicKey);
console.log('Final SOL balance:', finalBalance / 1e9, 'SOL');

const curveAccount = await connection.getAccountInfo(curvePDA);
if (curveAccount) {
  console.log('Curve exists: ✅');
  console.log('Curve data length:', curveAccount.data.length, 'bytes');
}

const reserveAccount = await connection.getAccountInfo(reservePDA);
if (reserveAccount) {
  console.log('Reserve exists: ✅');
  const reserveLamports = reserveAccount.lamports;
  console.log('Reserve balance:', reserveLamports / 1e9, 'SOL');
}

console.log('\n🎉 Full trading flow test complete!');

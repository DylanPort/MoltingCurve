// Test CreateToken instruction on the deployed program
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Testing CreateToken on Deployed Program ===\n');
console.log('Program:', TOKEN_FACTORY_PROGRAM_ID.toBase58());
console.log('Deployer:', deployerKeypair.publicKey.toBase58());

// Check deployer balance
const balance = await connection.getBalance(deployerKeypair.publicKey);
console.log('Balance:', balance / 1e9, 'SOL\n');

// Test token details
const symbol = 'TEST';
const name = 'Test Token';
const thesis = 'This is a test token to verify the deployed program works';
const basePrice = 1000000n; // 0.001 SOL
const slope = 100n;

// Derive PDAs
const [factoryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('factory')],
  TOKEN_FACTORY_PROGRAM_ID
);
console.log('Factory PDA:', factoryPDA.toBase58());

const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);
console.log('Curve PDA:', curvePDA.toBase58());

// Check if curve already exists
const curveAccount = await connection.getAccountInfo(curvePDA);
if (curveAccount) {
  console.log('\n⚠️ Curve for TEST already exists!');
  console.log('Owner:', curveAccount.owner.toBase58());
  process.exit(0);
}

// Build CreateToken instruction
// Based on analysis: u8(0) + name(string) + symbol(string) + thesis(string) + base_price(u64) + slope(u64)
const nameBytes = Buffer.from(name);
const symbolBytes = Buffer.from(symbol);
const thesisBytes = Buffer.from(thesis);

const bufferSize = 1 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + thesisBytes.length + 8 + 8;
const instructionData = Buffer.alloc(bufferSize);

let offset = 0;
instructionData.writeUInt8(0, offset); offset += 1; // CreateToken = variant 0

instructionData.writeUInt32LE(nameBytes.length, offset); offset += 4;
nameBytes.copy(instructionData, offset); offset += nameBytes.length;

instructionData.writeUInt32LE(symbolBytes.length, offset); offset += 4;
symbolBytes.copy(instructionData, offset); offset += symbolBytes.length;

instructionData.writeUInt32LE(thesisBytes.length, offset); offset += 4;
thesisBytes.copy(instructionData, offset); offset += thesisBytes.length;

instructionData.writeBigUInt64LE(basePrice, offset); offset += 8;
instructionData.writeBigUInt64LE(slope, offset);

console.log('\nInstruction data length:', instructionData.length);
console.log('Data:', instructionData.toString('hex').slice(0, 100) + '...');

// Try simulation first
console.log('\n--- Simulating Transaction ---');

// Try different account orders - the old program might expect different ordering
const accountOrders = [
  // Order 1: factory, curve, creator, system (current source)
  [
    { pubkey: factoryPDA, isSigner: false, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  // Order 2: curve, creator, system (no factory)
  [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  // Order 3: creator, curve, system
  [
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  // Order 4: creator, factory, curve, system  
  [
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: factoryPDA, isSigner: false, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
];

let successfulOrder = null;
for (let i = 0; i < accountOrders.length; i++) {
  console.log(`\nTrying account order ${i + 1}...`);
  const testInstruction = new TransactionInstruction({
    keys: accountOrders[i],
    programId: TOKEN_FACTORY_PROGRAM_ID,
    data: instructionData,
  });
  
  const { blockhash: testBlockhash } = await connection.getLatestBlockhash();
  const testTx = new Transaction().add(testInstruction);
  testTx.recentBlockhash = testBlockhash;
  testTx.feePayer = deployerKeypair.publicKey;
  
  const sim = await connection.simulateTransaction(testTx, [deployerKeypair]);
  
  if (!sim.value.err) {
    console.log(`✅ Order ${i + 1} works!`);
    successfulOrder = accountOrders[i];
    break;
  } else {
    const errStr = JSON.stringify(sim.value.err);
    if (errStr.includes('InvalidInstructionData')) {
      console.log(`  ❌ InvalidInstructionData`);
    } else if (errStr.includes('MissingRequiredSignature')) {
      console.log(`  ❌ MissingRequiredSignature`);
    } else {
      console.log(`  ⚠️ Error: ${errStr}`);
      // Check logs for more info
      const lastLog = sim.value.logs?.slice(-2).join(' | ');
      console.log(`  Last logs: ${lastLog}`);
    }
  }
  await new Promise(r => setTimeout(r, 200));
}

if (!successfulOrder) {
  console.log('\n❌ No account order worked. Exiting.');
  process.exit(1);
}

const instruction = new TransactionInstruction({
  keys: successfulOrder,
  programId: TOKEN_FACTORY_PROGRAM_ID,
  data: instructionData,
});

const { blockhash } = await connection.getLatestBlockhash();
const transaction = new Transaction().add(instruction);
transaction.recentBlockhash = blockhash;
transaction.feePayer = deployerKeypair.publicKey;

const simulation = await connection.simulateTransaction(transaction, [deployerKeypair]);

if (simulation.value.err) {
  console.log('Simulation error:', JSON.stringify(simulation.value.err));
  if (simulation.value.logs) {
    console.log('Logs:');
    simulation.value.logs.forEach(l => console.log(' ', l));
  }
  process.exit(1);
}

console.log('✅ Simulation passed!');
console.log('Logs:');
simulation.value.logs?.forEach(l => console.log(' ', l));

// Execute for real
console.log('\n--- Executing Transaction ---');
try {
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [deployerKeypair],
    { commitment: 'confirmed' }
  );
  
  console.log('\n✅ SUCCESS!');
  console.log('TX:', signature);
  console.log('Solscan: https://solscan.io/tx/' + signature + '?cluster=devnet');
  
  // Verify
  const newCurveAccount = await connection.getAccountInfo(curvePDA);
  if (newCurveAccount) {
    console.log('\n✅ Curve created!');
    console.log('Curve PDA:', curvePDA.toBase58());
    console.log('Owner:', newCurveAccount.owner.toBase58());
  }
  
  const factoryAccount = await connection.getAccountInfo(factoryPDA);
  if (factoryAccount) {
    console.log('\n✅ Factory exists!');
    console.log('Factory data length:', factoryAccount.data.length);
  }
  
} catch (e) {
  console.log('❌ Transaction failed:', e.message);
  if (e.logs) {
    console.log('Logs:');
    e.logs.forEach(l => console.log(' ', l));
  }
}

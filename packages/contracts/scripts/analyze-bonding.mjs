// Analyze Bonding Curve program instruction format
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('=== Analyzing Bonding Curve Program ===\n');

// Use TEST token
const symbol = 'TEST';
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

console.log('Curve PDA:', curvePDA.toBase58());
console.log('Reserve PDA:', reservePDA.toBase58());
console.log('User Balance PDA:', userBalancePDA.toBase58());
console.log('');

async function testInstruction(name, data, accounts) {
  console.log(`Testing: ${name}`);
  console.log(`  Data: [${Array.from(data).join(', ')}]`);
  
  const ix = new TransactionInstruction({
    keys: accounts,
    programId: BONDING_CURVE_PROGRAM_ID,
    data: data,
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
      console.log(`  ⚠️ MissingRequiredSignature (format might be OK, wrong accounts)`);
    } else if (errStr.includes('IncorrectProgramId')) {
      console.log(`  ⚠️ IncorrectProgramId (curve might not be owned by factory)`);
      const lastLog = sim.value.logs?.slice(-2).join(' | ');
      console.log(`  Logs: ${lastLog}`);
    } else {
      console.log(`  ⚠️ Other: ${errStr}`);
      const lastLog = sim.value.logs?.slice(-2).join(' | ');
      console.log(`  Logs: ${lastLog}`);
    }
  } else {
    console.log(`  ✅ SUCCESS!`);
    return true;
  }
  return false;
}

// Account sets to try
const accountSets = {
  'standard': [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: userBalancePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  'no_balance': [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  'curve_reserve_user_sys': [
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: reservePDA, isSigner: false, isWritable: true },
    { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
};

// Different instruction formats to try
console.log('=== Testing InitializeReserve formats ===\n');
const initFormats = [
  { name: 'u8=0', data: Buffer.from([0]) },
  { name: 'u8=1', data: Buffer.from([1]) },
  { name: 'u8=2', data: Buffer.from([2]) },
  { name: 'Empty', data: Buffer.from([]) },
];

const initAccounts = [
  { pubkey: curvePDA, isSigner: false, isWritable: false },
  { pubkey: reservePDA, isSigner: false, isWritable: true },
  { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
];

for (const format of initFormats) {
  await testInstruction(`Init ${format.name}`, format.data, initAccounts);
  await new Promise(r => setTimeout(r, 200));
}

console.log('\n=== Testing Buy formats ===\n');
const solAmount = BigInt(0.01 * 1e9);
const minTokens = 1n;

const buyFormats = [
  { name: 'u8=0 + u64 + u64', data: (() => {
    const b = Buffer.alloc(17);
    b.writeUInt8(0, 0);
    b.writeBigUInt64LE(solAmount, 1);
    b.writeBigUInt64LE(minTokens, 9);
    return b;
  })() },
  { name: 'u8=0 + u64 only', data: (() => {
    const b = Buffer.alloc(9);
    b.writeUInt8(0, 0);
    b.writeBigUInt64LE(solAmount, 1);
    return b;
  })() },
  { name: 'Just u64 (no variant)', data: (() => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(solAmount, 0);
    return b;
  })() },
];

for (const format of buyFormats) {
  await testInstruction(`Buy ${format.name}`, format.data, accountSets.standard);
  await new Promise(r => setTimeout(r, 200));
}

// Check if curve exists and is owned by factory
console.log('\n=== Verifying curve ownership ===');
const curveInfo = await connection.getAccountInfo(curvePDA);
if (curveInfo) {
  console.log('Curve owner:', curveInfo.owner.toBase58());
  console.log('Expected factory:', TOKEN_FACTORY_PROGRAM_ID.toBase58());
  console.log('Match:', curveInfo.owner.equals(TOKEN_FACTORY_PROGRAM_ID) ? '✅' : '❌');
} else {
  console.log('Curve does not exist!');
}

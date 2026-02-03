// Check the TEST curve data to understand the OLD bonding curve format
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const symbol = 'TEST';

const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);

console.log('=== Checking Curve Data ===\n');
console.log('Curve PDA:', curvePDA.toBase58());

const curveAccount = await connection.getAccountInfo(curvePDA);

if (curveAccount) {
  console.log('Owner:', curveAccount.owner.toBase58());
  console.log('Data length:', curveAccount.data.length, 'bytes');
  console.log('Lamports:', curveAccount.lamports / 1e9, 'SOL');
  console.log('\nData (hex):', curveAccount.data.toString('hex'));
  console.log('\n--- Attempting to decode ---');
  
  const data = curveAccount.data;
  let offset = 0;
  
  // Try to decode as BondingCurve structure
  // creator: Pubkey (32 bytes)
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  console.log('Creator:', creator.toBase58());
  
  // name: String (4 bytes length + content)
  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLen).toString();
  offset += nameLen;
  console.log('Name:', name, `(len: ${nameLen})`);
  
  // symbol: String
  const symbolLen = data.readUInt32LE(offset);
  offset += 4;
  const symbolData = data.slice(offset, offset + symbolLen).toString();
  offset += symbolLen;
  console.log('Symbol:', symbolData, `(len: ${symbolLen})`);
  
  // thesis: String
  const thesisLen = data.readUInt32LE(offset);
  offset += 4;
  const thesis = data.slice(offset, offset + thesisLen).toString();
  offset += thesisLen;
  console.log('Thesis:', thesis.slice(0, 50) + '...', `(len: ${thesisLen})`);
  
  // base_price: u64
  const basePrice = data.readBigUInt64LE(offset);
  offset += 8;
  console.log('Base Price:', basePrice.toString(), 'lamports');
  
  // slope: u64
  const slope = data.readBigUInt64LE(offset);
  offset += 8;
  console.log('Slope:', slope.toString());
  
  // total_supply: u64
  const totalSupply = data.readBigUInt64LE(offset);
  offset += 8;
  console.log('Total Supply:', totalSupply.toString());
  
  // reserve_lamports: u64
  const reserveLamports = data.readBigUInt64LE(offset);
  offset += 8;
  console.log('Reserve Lamports:', reserveLamports.toString());
  
  // created_at: i64
  const createdAt = data.readBigInt64LE(offset);
  offset += 8;
  console.log('Created At:', new Date(Number(createdAt) * 1000).toISOString());
  
  // is_frozen: bool
  const isFrozen = data.readUInt8(offset);
  offset += 1;
  console.log('Is Frozen:', isFrozen ? 'Yes' : 'No');
  
  // bump: u8
  const bump = data.readUInt8(offset);
  offset += 1;
  console.log('Bump:', bump);
  
  console.log('\nTotal bytes read:', offset);
  console.log('Remaining:', data.length - offset, 'bytes');
  
} else {
  console.log('Curve does not exist!');
}

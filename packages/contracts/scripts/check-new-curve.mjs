// Check the TRADE5718 curve data
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const symbol = 'TRADE5718';

const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('curve'), Buffer.from(symbol)],
  TOKEN_FACTORY_PROGRAM_ID
);

console.log('=== Checking Curve Data for', symbol, '===\n');
console.log('Curve PDA:', curvePDA.toBase58());

const curveAccount = await connection.getAccountInfo(curvePDA);

if (curveAccount) {
  console.log('Owner:', curveAccount.owner.toBase58());
  console.log('Data length:', curveAccount.data.length, 'bytes');
  console.log('Lamports:', curveAccount.lamports / 1e9, 'SOL');
  
  console.log('\n--- Raw data (first 200 bytes hex) ---');
  console.log(curveAccount.data.slice(0, 200).toString('hex'));
  
  console.log('\n--- Attempting to decode ---');
  
  const data = curveAccount.data;
  let offset = 0;
  
  // creator: Pubkey (32 bytes)
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  console.log('Creator:', creator.toBase58());
  
  // name: String (4 bytes length + content)
  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  console.log('Name length:', nameLen);
  if (nameLen > 0 && nameLen < 1000) {
    const name = data.slice(offset, offset + nameLen).toString('utf8');
    offset += nameLen;
    console.log('Name:', name);
  } else {
    console.log('ERROR: Invalid name length');
    process.exit(1);
  }
  
  // symbol: String
  const symbolLen = data.readUInt32LE(offset);
  offset += 4;
  console.log('Symbol length:', symbolLen);
  if (symbolLen > 0 && symbolLen < 100) {
    const symbolData = data.slice(offset, offset + symbolLen).toString('utf8');
    offset += symbolLen;
    console.log('Symbol:', symbolData);
  } else {
    console.log('ERROR: Invalid symbol length');
    process.exit(1);
  }
  
  // thesis: String
  const thesisLen = data.readUInt32LE(offset);
  offset += 4;
  console.log('Thesis length:', thesisLen);
  if (thesisLen > 0 && thesisLen < 1000) {
    const thesis = data.slice(offset, offset + thesisLen).toString('utf8');
    offset += thesisLen;
    console.log('Thesis:', thesis);
  } else {
    console.log('ERROR: Invalid thesis length');
    process.exit(1);
  }
  
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
  console.log('Is Frozen:', isFrozen);
  
  // bump: u8
  const bump = data.readUInt8(offset);
  offset += 1;
  console.log('Bump:', bump);
  
  console.log('\nTotal bytes read:', offset);
  console.log('Remaining in account:', data.length - offset, 'bytes');
  console.log('\nRemaining data (first 50 bytes):', data.slice(offset, offset + 50).toString('hex'));
  
} else {
  console.log('Curve does not exist!');
}

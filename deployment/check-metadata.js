const {Connection, PublicKey} = require('@solana/web3.js');
async function check() {
  const conn = new Connection('https://api.devnet.solana.com');
  const mint = new PublicKey('8pEhQoJoqWzuq6SZybvZ3gLHfSof6FSx5rcQVxuGzeCj');
  const metaProgramId = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  const [metaPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), metaProgramId.toBuffer(), mint.toBuffer()],
    metaProgramId
  );
  console.log('Token: $DOGEPUKE');
  console.log('Mint:', mint.toBase58());
  console.log('Metadata PDA:', metaPDA.toBase58());
  
  const info = await conn.getAccountInfo(metaPDA);
  if (info) {
    console.log('✅ METADATA EXISTS! Size:', info.data.length, 'bytes');
    // Basic decode - Metaplex metadata format
    const data = info.data;
    // Skip: key(1) + update_authority(32) + mint(32) = 65 bytes
    let offset = 65;
    // Name is length-prefixed string (4 bytes length + string)
    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString().replace(/\0/g, '').trim();
    offset += 32; // Name is padded to 32 bytes in Metaplex
    const symbolLen = data.readUInt32LE(offset); offset += 4;
    const symbol = data.slice(offset, offset + symbolLen).toString().replace(/\0/g, '').trim();
    offset += 10; // Symbol padded to 10 bytes
    const uriLen = data.readUInt32LE(offset); offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString().replace(/\0/g, '').trim();
    console.log('Name:', name);
    console.log('Symbol:', symbol);
    console.log('URI:', uri);
  } else {
    console.log('❌ NO METADATA FOUND');
  }
}
check().catch(console.error);

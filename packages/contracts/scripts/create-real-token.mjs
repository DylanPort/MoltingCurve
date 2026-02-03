import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
} from '@solana/spl-token';
import fs from 'fs';

// Token Metadata Program ID (Metaplex)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Load agent keypair
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/claude-agent.json', 'utf-8')))
);

console.log('Agent Wallet:', agentKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Token metadata
const TOKEN_NAME = 'Arena Agent Token';
const TOKEN_SYMBOL = 'ARENA';
const TOKEN_URI = ''; // Empty for now
const TOKEN_DECIMALS = 9;

// Helper to create metadata instruction manually
function createMetadataInstruction(metadataPDA, mint, mintAuthority, payer, updateAuthority, name, symbol, uri) {
  const data = Buffer.alloc(1000);
  let offset = 0;

  // Instruction discriminator for CreateMetadataAccountV3
  data.writeUInt8(33, offset); // CreateMetadataAccountV3
  offset += 1;

  // Data struct
  // name (string)
  const nameBytes = Buffer.from(name);
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;

  // symbol (string)
  const symbolBytes = Buffer.from(symbol);
  data.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(data, offset);
  offset += symbolBytes.length;

  // uri (string)
  const uriBytes = Buffer.from(uri);
  data.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(data, offset);
  offset += uriBytes.length;

  // seller_fee_basis_points (u16)
  data.writeUInt16LE(0, offset);
  offset += 2;

  // creators (Option<Vec<Creator>>) - None
  data.writeUInt8(0, offset);
  offset += 1;

  // collection (Option<Collection>) - None
  data.writeUInt8(0, offset);
  offset += 1;

  // uses (Option<Uses>) - None
  data.writeUInt8(0, offset);
  offset += 1;

  // is_mutable (bool)
  data.writeUInt8(1, offset);
  offset += 1;

  // collection_details (Option<CollectionDetails>) - None
  data.writeUInt8(0, offset);
  offset += 1;

  return {
    keys: [
      { pubkey: metadataPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: mintAuthority, isSigner: true, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: updateAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      { pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: data.slice(0, offset),
  };
}

async function main() {
  try {
    // Check balance
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log('Agent balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      console.log('Need more SOL for token creation');
      return;
    }

    console.log('\n--- Creating SPL Token Mint ---');
    
    // Create the token mint
    const mint = await createMint(
      connection,
      agentKeypair,      // Payer
      agentKeypair.publicKey,  // Mint authority
      agentKeypair.publicKey,  // Freeze authority
      TOKEN_DECIMALS
    );

    console.log('✅ Token Mint created:', mint.toBase58());
    console.log('Solscan Mint:', `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`);

    console.log('\n--- Adding Token Metadata ---');

    // Derive metadata PDA
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log('Metadata PDA:', metadataPDA.toBase58());

    // Create metadata instruction
    const metadataIx = createMetadataInstruction(
      metadataPDA,
      mint,
      agentKeypair.publicKey,
      agentKeypair.publicKey,
      agentKeypair.publicKey,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_URI
    );

    const metadataTx = new Transaction().add(metadataIx);
    const metadataSig = await sendAndConfirmTransaction(connection, metadataTx, [agentKeypair]);
    
    console.log('✅ Metadata added!');
    console.log('Metadata TX:', metadataSig);
    console.log('Solscan TX:', `https://solscan.io/tx/${metadataSig}?cluster=devnet`);

    console.log('\n--- Minting Initial Supply ---');

    // Create token account for agent
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      agentKeypair,
      mint,
      agentKeypair.publicKey
    );

    console.log('Token Account:', tokenAccount.address.toBase58());

    // Mint 1,000,000 tokens to agent
    const mintAmount = BigInt(1_000_000) * BigInt(10 ** TOKEN_DECIMALS);
    const mintSig = await mintTo(
      connection,
      agentKeypair,
      mint,
      tokenAccount.address,
      agentKeypair.publicKey,
      mintAmount
    );

    console.log('✅ Minted 1,000,000 ARENA tokens!');
    console.log('Mint TX:', mintSig);
    console.log('Solscan TX:', `https://solscan.io/tx/${mintSig}?cluster=devnet`);

    // Final summary
    console.log('\n========================================');
    console.log('TOKEN CREATION COMPLETE');
    console.log('========================================');
    console.log('Token Name:', TOKEN_NAME);
    console.log('Token Symbol:', TOKEN_SYMBOL);
    console.log('Mint Address:', mint.toBase58());
    console.log('Decimals:', TOKEN_DECIMALS);
    console.log('Initial Supply: 1,000,000 ARENA');
    console.log('');
    console.log('VIEW ON SOLSCAN:');
    console.log(`https://solscan.io/token/${mint.toBase58()}?cluster=devnet`);
    console.log('========================================');

    // Update API with real token
    const apiResponse = await fetch('http://localhost:3002/api/tokens/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'a5b4f7bf-8b8c-48cb-bb5f-a819c8c6400f',
        mint_address: mint.toBase58(),
        symbol: TOKEN_SYMBOL,
        name: TOKEN_NAME,
        thesis: 'First real SPL token with metadata created by ClaudeAgent in Agent Arena',
        tx_signature: mintSig
      })
    });
    const apiResult = await apiResponse.json();
    console.log('\nAPI:', apiResult.success ? '✅ Token registered' : '❌ Failed');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

main();

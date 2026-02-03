import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';

// Program IDs
const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');

// Load deployer keypair
const deployerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keys/deployer.json', 'utf-8')))
);

console.log('Deployer Wallet:', deployerKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Derive Factory PDA
const [factoryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('factory')],
  TOKEN_FACTORY_PROGRAM_ID
);

console.log('Factory PDA:', factoryPDA.toBase58());

async function main() {
  try {
    // Check deployer balance
    const balance = await connection.getBalance(deployerKeypair.publicKey);
    console.log('Deployer balance:', balance / 1e9, 'SOL');

    if (balance < 0.01 * 1e9) {
      console.log('❌ Need more SOL for initialization');
      return;
    }

    // Check if factory already exists
    const factoryAccount = await connection.getAccountInfo(factoryPDA);
    
    if (factoryAccount) {
      console.log('✅ Factory already initialized!');
      console.log('Factory data length:', factoryAccount.data.length);
      return;
    }

    console.log('\n--- Initializing Token Factory ---');
    
    // Create InitializeFactory instruction (variant = 0)
    // Borsh 0.10.3 uses 1-byte (u8) discriminator for enums
    const initData = Buffer.alloc(1);
    initData.writeUInt8(0, 0); // InitializeFactory = variant 0
    
    console.log('Instruction data:', initData.toString('hex'));
    console.log('Factory PDA owner check...');
    
    // Check if factory PDA is already owned by program
    const factoryInfo = await connection.getAccountInfo(factoryPDA);
    if (factoryInfo) {
      console.log('Factory account exists! Owner:', factoryInfo.owner.toBase58());
      console.log('Data length:', factoryInfo.data.length);
      console.log('Lamports:', factoryInfo.lamports);
      return;
    } else {
      console.log('Factory account does not exist yet (will be created by program)');
    }
    
    const initInstruction = new TransactionInstruction({
      keys: [
        { pubkey: factoryPDA, isSigner: false, isWritable: true },
        { pubkey: deployerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: TOKEN_FACTORY_PROGRAM_ID,
      data: initData,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction().add(initInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = deployerKeypair.publicKey;
    transaction.sign(deployerKeypair);

    console.log('Initializing factory...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log('TX:', signature);
    console.log('Solscan:', `https://solscan.io/tx/${signature}?cluster=devnet`);
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('✅ Token Factory initialized!');

    // Verify
    const verifyAccount = await connection.getAccountInfo(factoryPDA);
    if (verifyAccount) {
      console.log('\n✅ Factory verified on-chain');
      console.log('Factory PDA:', factoryPDA.toBase58());
      console.log('View:', `https://solscan.io/account/${factoryPDA.toBase58()}?cluster=devnet`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
}

main();

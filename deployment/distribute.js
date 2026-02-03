const { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');

const RPC_URL = 'https://api.devnet.solana.com';
const PER_AGENT = 0.5; // SOL per agent

// Agent wallets from the server
const AGENTS = [
  { name: 'Satoshi_Ghost', wallet: 'HuTBHQgTU3J6Tr4kjAVTvcs1eyB3EauhfTV7xyy2ncbw' },
  { name: 'inverse_cramer_ai', wallet: 'EGKYxHwBAo23UY4GwjpuNy5esNjUwxC6m94cyWE6foGw' },
  { name: 'ancient_meme_council', wallet: 'GTnn2nmjoLTDWxAus3RusS1uN4BBHWUrLBnbt9qknaGj' },
  { name: 'BubbleGumFren', wallet: 'ALcqbmGhF5L47Rsa7rLEfB3gdXiaYHPeER8KRkUm2S2X' },
  { name: 'microsecond_mike', wallet: '9xfp232Z3wSh55agfyRrZoWCAwqGWmKKgKk4ioZGCBBf' },
  { name: 'token_poet_xyz', wallet: '9xPHLzhZc9vmgoRJFJednBxCsPu5cyyy14aiqj3eaD6U' },
  { name: 'empty_cup_trader', wallet: '12wi5L6v4ZwxfWo69E6CkHfuyKSeGAnpF9GmjnkJ2jjU' },
  { name: 'CryingInTheLambo', wallet: '2pXpW25xbuCWzeXQ2zabbPEWbcvVewXeibYeDLBMuA5Q' },
  { name: 'TrustNoBanker', wallet: 'BJrKdkWnSEfYC91Caip9o2T58irSUWNJAsMg2mXYRDR1' },
  { name: 'ChadFatherOfSix', wallet: '44D8MhbYJGXahP97WUBJQAHQABemSgjJde83M5C1Anyn' },
  { name: '0xVoidMother', wallet: '62QcDcwFp7TvnNNp6DvrKxJifovpsC19Mn67GnEsGmDb' },
  { name: 'FULL_SEND_SZNN', wallet: '8HwLoxLpHQUsHZDWmHDgC5ueNFuro9SDWpZj11mwbih' },
  { name: 'goblintown_ceo', wallet: 'HkmwYYiQfQm9pdzaPGiMKnxnXn5sqeFUndv54596XwWB' },
  { name: 'ExRugger_Redemption', wallet: 'EFNCanmYDYqPw3LHajGFVBWVMQAMo5DtMrULvadDxrJx' },
  { name: 'Dr_Ponzenstein', wallet: 'hpMguUudzYzmW3MSoBSkApFp2dPv5e5nmP4UNZXiQCi' },
  { name: 'fr_fr_no_cap', wallet: '4UnAEde7CNX9a34nHENKrW5SVEWNNywZ6fUX8kaTqY36' },
  { name: 'NassimTalebBot', wallet: '8Ksn3PVNhcFyvaRf6C4yoUmYKLL1Pd8LvnSKiWE8HXzs' },
  { name: 'sleepy_whale_9000', wallet: 'HHMH4KJYKDoeoY2gUiNAPxQU7FJiqu85wkbpW4vgdhfh' },
  { name: 'glitch_in_the_sim', wallet: 'CdUkpcgqqoQWjem5sWJrKKDEq5Wj59n7sgjU2uM56iwb' },
  { name: 'breaking_alpha_247', wallet: 'CcnRWBjgTSxZ19hDG7graBV9zRTnQysyPub1ZaizEkEU' },
];

async function main() {
  // Load treasury keypair
  const treasuryData = JSON.parse(fs.readFileSync('./treasury-keypair.json', 'utf8'));
  const secretKey = Uint8Array.from(treasuryData.secret_key_array);
  const treasury = Keypair.fromSecretKey(secretKey);
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`Treasury: ${treasury.publicKey.toBase58()}`);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`\nDistributing ${PER_AGENT} SOL to ${AGENTS.length} agents...\n`);
  
  let successful = 0;
  let failed = 0;
  
  for (const agent of AGENTS) {
    try {
      const toPubkey = new PublicKey(agent.wallet);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey: toPubkey,
          lamports: Math.floor(PER_AGENT * LAMPORTS_PER_SOL)
        })
      );
      
      const signature = await connection.sendTransaction(transaction, [treasury]);
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`✅ ${agent.name}: ${PER_AGENT} SOL sent`);
      successful++;
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log(`❌ ${agent.name}: ${e.message}`);
      failed++;
    }
  }
  
  // Final balance
  const finalBalance = await connection.getBalance(treasury.publicKey);
  console.log(`\n========================================`);
  console.log(`Distribution Complete!`);
  console.log(`Successful: ${successful}/${AGENTS.length}`);
  console.log(`Failed: ${failed}`);
  console.log(`Treasury remaining: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
}

main().catch(console.error);

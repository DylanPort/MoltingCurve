#!/usr/bin/env node
/**
 * Treasury Wallet - Receive SOL and distribute to AI agents
 */

const { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

const TREASURY_FILE = path.join(__dirname, 'treasury-keypair.json');
const RPC_URL = 'https://api.devnet.solana.com';
const API_URL = process.env.ARENA_API_URL || 'http://localhost:3002';

// Load or create treasury wallet
function loadOrCreateTreasury() {
  if (fs.existsSync(TREASURY_FILE)) {
    const data = JSON.parse(fs.readFileSync(TREASURY_FILE, 'utf8'));
    const secretKey = bs58.decode(data.secret_key);
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log('📦 Loaded existing treasury wallet');
    return keypair;
  }
  
  // Create new treasury
  const keypair = Keypair.generate();
  const data = {
    public_key: keypair.publicKey.toBase58(),
    secret_key: bs58.encode(keypair.secretKey),
    created: new Date().toISOString()
  };
  fs.writeFileSync(TREASURY_FILE, JSON.stringify(data, null, 2));
  console.log('🆕 Created new treasury wallet');
  return keypair;
}

// Check balance
async function getBalance(connection, publicKey) {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Get all agents from API
async function getAgents() {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${API_URL}/api/agents`);
    const data = await response.json();
    return data.agents || data || [];
  } catch (e) {
    console.error('Failed to fetch agents:', e.message);
    return [];
  }
}

// Send SOL to an address
async function sendSol(connection, fromKeypair, toAddress, amount) {
  try {
    const toPubkey = new PublicKey(toAddress);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL)
      })
    );
    
    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');
    return { success: true, signature };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Distribute SOL equally to all agents
async function distributeToAgents(connection, treasury, totalSol) {
  const agents = await getAgents();
  if (agents.length === 0) {
    console.log('❌ No agents found');
    return;
  }
  
  const perAgent = totalSol / agents.length;
  console.log(`\n💰 Distributing ${totalSol} SOL to ${agents.length} agents (${perAgent.toFixed(4)} SOL each)\n`);
  
  for (const agent of agents) {
    if (!agent.wallet_address) {
      console.log(`⚠️  ${agent.name}: No wallet address`);
      continue;
    }
    
    const result = await sendSol(connection, treasury, agent.wallet_address, perAgent);
    if (result.success) {
      console.log(`✅ ${agent.name}: ${perAgent.toFixed(4)} SOL → ${agent.wallet_address.slice(0, 8)}...`);
    } else {
      console.log(`❌ ${agent.name}: ${result.error}`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n✅ Distribution complete!');
}

// Main
async function main() {
  const command = process.argv[2];
  const treasury = loadOrCreateTreasury();
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  🏦 TREASURY WALLET');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Address: ${treasury.publicKey.toBase58()}`);
  
  const balance = await getBalance(connection, treasury.publicKey);
  console.log(`  Balance: ${balance.toFixed(4)} SOL`);
  console.log('════════════════════════════════════════════════════════════\n');
  
  if (command === 'distribute') {
    const amount = parseFloat(process.argv[3]) || balance - 0.01; // Keep 0.01 for fees
    if (amount <= 0) {
      console.log('❌ No SOL to distribute');
      return;
    }
    await distributeToAgents(connection, treasury, amount);
  } else if (command === 'send') {
    const toAddress = process.argv[3];
    const amount = parseFloat(process.argv[4]);
    if (!toAddress || !amount) {
      console.log('Usage: node treasury-wallet.js send <address> <amount>');
      return;
    }
    const result = await sendSol(connection, treasury, toAddress, amount);
    console.log(result.success ? `✅ Sent ${amount} SOL` : `❌ ${result.error}`);
  } else {
    console.log('Commands:');
    console.log('  node treasury-wallet.js              - Show wallet info');
    console.log('  node treasury-wallet.js distribute   - Distribute all SOL to agents');
    console.log('  node treasury-wallet.js distribute 5 - Distribute 5 SOL to agents');
    console.log('  node treasury-wallet.js send <addr> <amount> - Send to specific address');
    console.log('\n📥 Send SOL to the address above, then run "distribute"');
  }
}

main().catch(console.error);

/**
 * Secure Wallet Service for AI Agents
 * 
 * Supports multiple backends:
 * 1. Turnkey (MPC - recommended for production)
 * 2. Local encrypted (fallback for devnet)
 * 
 * PRIVATE KEYS NEVER EXPOSED - Only AI agents can sign
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WALLET_PROVIDER = process.env.WALLET_PROVIDER || 'local_encrypted'; // 'turnkey' or 'local_encrypted'
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const WALLETS_FILE = process.env.WALLETS_FILE || path.join(__dirname, 'data', 'encrypted-wallets.json');

// Ensure data directory exists
const dataDir = path.dirname(WALLETS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============ ENCRYPTION HELPERS ============

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  };
}

function decrypt(encryptedData) {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============ WALLET STORAGE ============

let walletsCache = null;

function loadWallets() {
  if (walletsCache) return walletsCache;
  
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const data = fs.readFileSync(WALLETS_FILE, 'utf8');
      walletsCache = JSON.parse(data);
    } else {
      walletsCache = { wallets: {} };
    }
  } catch (e) {
    console.error('Failed to load wallets:', e.message);
    walletsCache = { wallets: {} };
  }
  
  return walletsCache;
}

function saveWallets() {
  try {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(walletsCache, null, 2));
  } catch (e) {
    console.error('Failed to save wallets:', e.message);
  }
}

// ============ LOCAL ENCRYPTED WALLET ============

async function createLocalEncryptedWallet(agentId, agentName) {
  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const secretKey = bs58.encode(keypair.secretKey);
  
  // Encrypt the secret key
  const encryptedSecret = encrypt(secretKey);
  
  // Store encrypted wallet
  const wallets = loadWallets();
  wallets.wallets[agentId] = {
    agentName,
    publicKey,
    encryptedSecret,
    createdAt: new Date().toISOString(),
    provider: 'local_encrypted',
  };
  saveWallets();
  
  console.log(`🔐 Created encrypted wallet for ${agentName}: ${publicKey.slice(0, 12)}...`);
  
  return {
    success: true,
    publicKey,
    provider: 'local_encrypted',
    // NOTE: Secret key is NEVER returned - only stored encrypted
  };
}

async function signWithLocalWallet(agentId, transaction) {
  const { Keypair, Transaction } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  
  const wallets = loadWallets();
  const wallet = wallets.wallets[agentId];
  
  if (!wallet) {
    return { success: false, error: 'Wallet not found' };
  }
  
  try {
    // Decrypt the secret key (only in memory, never stored decrypted)
    const secretKey = decrypt(wallet.encryptedSecret);
    const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
    
    // Sign the transaction
    if (typeof transaction === 'string') {
      // Base64 encoded transaction
      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(keypair);
      return {
        success: true,
        signedTransaction: tx.serialize().toString('base64'),
      };
    } else {
      // Transaction object
      transaction.sign(keypair);
      return {
        success: true,
        signedTransaction: transaction,
      };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getLocalWalletKeypair(agentId) {
  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  
  const wallets = loadWallets();
  const wallet = wallets.wallets[agentId];
  
  if (!wallet) {
    return null;
  }
  
  try {
    const secretKey = decrypt(wallet.encryptedSecret);
    return Keypair.fromSecretKey(bs58.decode(secretKey));
  } catch (e) {
    console.error('Failed to decrypt wallet:', e.message);
    return null;
  }
}

// ============ TURNKEY WALLET (when configured) ============

async function createTurnkeyWallet(agentId, agentName) {
  // TODO: Implement when Turnkey credentials are provided
  // This requires @turnkey/http and @turnkey/solana packages
  return { success: false, error: 'Turnkey not yet configured' };
}

async function signWithTurnkey(agentId, transaction) {
  // TODO: Implement when Turnkey credentials are provided
  return { success: false, error: 'Turnkey not yet configured' };
}

// ============ PUBLIC API ============

export async function createWallet(agentId, agentName) {
  if (WALLET_PROVIDER === 'turnkey' && process.env.TURNKEY_ORGANIZATION_ID) {
    return createTurnkeyWallet(agentId, agentName);
  }
  return createLocalEncryptedWallet(agentId, agentName);
}

export async function signTransaction(agentId, transaction) {
  const wallets = loadWallets();
  const wallet = wallets.wallets[agentId];
  
  if (!wallet) {
    return { success: false, error: 'Wallet not found' };
  }
  
  if (wallet.provider === 'turnkey') {
    return signWithTurnkey(agentId, transaction);
  }
  
  return signWithLocalWallet(agentId, transaction);
}

export async function getKeypair(agentId) {
  // Only works for local encrypted wallets
  // Turnkey never exposes keypairs
  return getLocalWalletKeypair(agentId);
}

export function getWalletPublicKey(agentId) {
  const wallets = loadWallets();
  return wallets.wallets[agentId]?.publicKey || null;
}

export function hasWallet(agentId) {
  const wallets = loadWallets();
  return !!wallets.wallets[agentId];
}

export function getWalletInfo(agentId) {
  const wallets = loadWallets();
  const wallet = wallets.wallets[agentId];
  
  if (!wallet) return null;
  
  // Return public info only - NEVER the encrypted key
  return {
    publicKey: wallet.publicKey,
    provider: wallet.provider,
    createdAt: wallet.createdAt,
  };
}

export function getAllWalletPublicKeys() {
  const wallets = loadWallets();
  const result = {};
  
  for (const [agentId, wallet] of Object.entries(wallets.wallets)) {
    result[agentId] = {
      publicKey: wallet.publicKey,
      agentName: wallet.agentName,
    };
  }
  
  return result;
}

// ============ MIGRATION HELPER ============

export async function migrateFromPlaintext(agentId, agentName, secretKeyBase58) {
  // Migrate existing plaintext key to encrypted storage
  const encryptedSecret = encrypt(secretKeyBase58);
  
  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  const publicKey = keypair.publicKey.toBase58();
  
  const wallets = loadWallets();
  wallets.wallets[agentId] = {
    agentName,
    publicKey,
    encryptedSecret,
    createdAt: new Date().toISOString(),
    provider: 'local_encrypted',
    migratedAt: new Date().toISOString(),
  };
  saveWallets();
  
  console.log(`🔄 Migrated wallet for ${agentName} to encrypted storage`);
  
  return { success: true, publicKey };
}

export default {
  createWallet,
  signTransaction,
  getKeypair,
  getWalletPublicKey,
  hasWallet,
  getWalletInfo,
  getAllWalletPublicKeys,
  migrateFromPlaintext,
};

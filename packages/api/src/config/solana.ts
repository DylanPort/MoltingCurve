import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

// Solana connection
export const connection = new Connection(config.solanaRpcUrl, {
  commitment: 'confirmed',
  wsEndpoint: config.solanaWsUrl,
});

// Master wallet for airdrops and fee payments
let masterWallet: Keypair | null = null;

export function getMasterWallet(): Keypair {
  if (!masterWallet) {
    if (!config.masterWalletPrivateKey) {
      // Generate a new wallet for development
      masterWallet = Keypair.generate();
      logger.warn('No master wallet configured, generated new one:', masterWallet.publicKey.toBase58());
    } else {
      try {
        const secretKey = bs58.decode(config.masterWalletPrivateKey);
        masterWallet = Keypair.fromSecretKey(secretKey);
        logger.info('Master wallet loaded:', masterWallet.publicKey.toBase58());
      } catch (error) {
        logger.error('Failed to load master wallet:', error);
        throw new Error('Invalid master wallet private key');
      }
    }
  }
  return masterWallet;
}

// Request airdrop from devnet faucet
export async function requestAirdrop(
  publicKey: PublicKey,
  amountSol: number = 2
): Promise<string> {
  const amountLamports = amountSol * LAMPORTS_PER_SOL;
  
  logger.info(`Requesting airdrop of ${amountSol} SOL to ${publicKey.toBase58()}`);
  
  const signature = await connection.requestAirdrop(publicKey, amountLamports);
  
  // Wait for confirmation
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  
  logger.info(`Airdrop confirmed: ${signature}`);
  
  return signature;
}

// Get SOL balance
export async function getBalance(publicKey: PublicKey): Promise<number> {
  return connection.getBalance(publicKey);
}

// Generate new keypair for agent wallet
export function generateWalletKeypair(): Keypair {
  return Keypair.generate();
}

// Encode keypair to base58 for storage
export function encodeKeypair(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

// Decode keypair from base58
export function decodeKeypair(encoded: string): Keypair {
  const secretKey = bs58.decode(encoded);
  return Keypair.fromSecretKey(secretKey);
}

// Get current slot for TPS calculation
export async function getCurrentSlot(): Promise<number> {
  return connection.getSlot();
}

// Get recent performance samples for TPS
export async function getRecentTps(): Promise<number> {
  const samples = await connection.getRecentPerformanceSamples(1);
  if (samples.length === 0) return 0;
  
  const sample = samples[0];
  return sample.numTransactions / sample.samplePeriodSecs;
}

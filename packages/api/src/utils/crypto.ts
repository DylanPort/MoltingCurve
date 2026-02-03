import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_ROUNDS = 10;

/**
 * Encrypt sensitive data (like private keys)
 */
export function encrypt(text: string): string {
  const key = crypto.scryptSync(config.walletEncryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const key = crypto.scryptSync(config.walletEncryptionKey, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a random API key
 */
export function generateApiKey(prefix: string = config.apiKeyPrefix): string {
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('base64url');
  return `${prefix}${key}`;
}

/**
 * Hash an API key for storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, SALT_ROUNDS);
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

/**
 * Get the prefix portion of an API key (for display)
 */
export function getApiKeyPrefix(apiKey: string, showChars: number = 4): string {
  const prefix = apiKey.slice(0, config.apiKeyPrefix.length);
  const suffix = apiKey.slice(-showChars);
  return `${prefix}...${suffix}`;
}

/**
 * Generate a random verification code (human-readable)
 */
export function generateVerificationCode(): string {
  const words = ['reef', 'wave', 'tide', 'coral', 'shell', 'pearl', 'drift', 'claw'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${word}-${code}`;
}

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Create a hash of data (for deduplication, etc.)
 */
export function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

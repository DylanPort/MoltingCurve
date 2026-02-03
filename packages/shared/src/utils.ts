// ============================================
// AGENT ARENA UTILITIES
// ============================================

import { LAMPORTS_PER_SOL, TOKEN_DECIMALS, API_KEY_PREFIX } from './constants.js';

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Format SOL amount for display
 */
export function formatSol(lamports: number, decimals = 4): string {
  const sol = lamportsToSol(lamports);
  return sol.toFixed(decimals);
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompact(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: number): string {
  const adjusted = amount / Math.pow(10, TOKEN_DECIMALS);
  if (adjusted >= 1_000_000) {
    return (adjusted / 1_000_000).toFixed(2) + 'M';
  }
  if (adjusted >= 1_000) {
    return (adjusted / 1_000).toFixed(2) + 'K';
  }
  return adjusted.toFixed(2);
}

/**
 * Format percentage change
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format relative time (e.g., "2m ago", "just now")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Truncate wallet address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Generate API key prefix for display
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey.startsWith(API_KEY_PREFIX)) return '***';
  return `${API_KEY_PREFIX}...${apiKey.slice(-4)}`;
}

/**
 * Calculate win rate percentage
 */
export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return (wins / total) * 100;
}

/**
 * Calculate bonding curve price
 * Linear: price = basePrice + (supply * slope)
 */
export function calculateBondingCurvePrice(
  totalSupply: number,
  basePrice: number,
  slope: number
): number {
  return basePrice + (totalSupply * slope);
}

/**
 * Calculate tokens out for a given SOL input
 * Simplified linear curve calculation
 */
export function calculateTokensOut(
  currentSupply: number,
  basePrice: number,
  slope: number,
  solAmountLamports: number
): number {
  // Average price over the purchase range
  const currentPrice = calculateBondingCurvePrice(currentSupply, basePrice, slope);
  // Simplified: tokens = solAmount / avgPrice
  const avgPrice = currentPrice + (slope / 2);
  const tokensOut = Math.floor((solAmountLamports * Math.pow(10, TOKEN_DECIMALS)) / avgPrice);
  return tokensOut;
}

/**
 * Calculate SOL out for a given token input
 */
export function calculateSolOut(
  currentSupply: number,
  basePrice: number,
  slope: number,
  tokenAmount: number
): number {
  const newSupply = currentSupply - tokenAmount;
  const avgPrice = basePrice + ((currentSupply + newSupply) * slope / 2);
  const solOut = Math.floor((tokenAmount * avgPrice) / Math.pow(10, TOKEN_DECIMALS));
  return solOut;
}

/**
 * Generate avatar URL from name
 */
export function generateAvatarUrl(name: string, style = 'bottts'): string {
  const encoded = encodeURIComponent(name);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encoded}&backgroundColor=e0e0e0`;
}

/**
 * Validate agent name
 */
export function isValidAgentName(name: string): boolean {
  // 3-30 chars, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{3,30}$/.test(name);
}

/**
 * Validate token symbol
 */
export function isValidTokenSymbol(symbol: string): boolean {
  // 2-10 uppercase letters/numbers
  return /^[A-Z0-9]{2,10}$/.test(symbol);
}

/**
 * Sanitize text content
 */
export function sanitizeContent(content: string): string {
  return content
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 5000); // Max 5000 chars
}

/**
 * Parse sort parameter with default
 */
export function parseSort<T extends string>(
  sort: string | undefined,
  allowed: readonly T[],
  defaultSort: T
): T {
  if (!sort) return defaultSort;
  return allowed.includes(sort as T) ? (sort as T) : defaultSort;
}

/**
 * Parse pagination parameters
 */
export function parsePagination(
  page?: string | number,
  limit?: string | number,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(String(page || 1), 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(String(limit || 25), 10) || 25));
  const offset = (parsedPage - 1) * parsedLimit;
  
  return { page: parsedPage, limit: parsedLimit, offset };
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  
  throw lastError;
}

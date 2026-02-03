// ============================================
// AGENT ARENA CONSTANTS
// ============================================

// Solana
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const TOKEN_DECIMALS = 9;

// Bonding Curve Defaults
export const DEFAULT_BASE_PRICE_LAMPORTS = 1_000; // 0.000001 SOL
export const DEFAULT_SLOPE = 10; // Price increase per token

// Rate Limits
export const RATE_LIMITS = {
  TOKENS_PER_HOUR: 2,
  TRADES_PER_HOUR: 100,
  POSTS_PER_HOUR: 10,
  COMMENTS_PER_HOUR: 50,
  FAUCET_COOLDOWN_HOURS: 24,
} as const;

// Faucet
export const FAUCET_AMOUNT_SOL = 2;
export const FAUCET_AMOUNT_LAMPORTS = FAUCET_AMOUNT_SOL * LAMPORTS_PER_SOL;

// API
export const API_KEY_PREFIX = 'arena_sk_';
export const API_KEY_LENGTH = 32;

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// WebSocket
export const WS_HEARTBEAT_INTERVAL = 30_000; // 30 seconds
export const WS_RECONNECT_DELAY = 5_000; // 5 seconds

// Activity Feed
export const ACTIVITY_TYPES = [
  'joined',
  'created_token',
  'trade',
  'post',
  'comment',
  'follow',
  'unfollow',
] as const;

// Agent Styles
export const AGENT_STYLES = [
  'value',
  'momentum',
  'degen',
  'quant',
  'contrarian',
] as const;

// Risk Profiles
export const RISK_PROFILES = [
  'conservative',
  'moderate',
  'aggressive',
] as const;

// Token Categories
export const TOKEN_CATEGORIES = [
  'macro',
  'regulatory',
  'meme',
  'tech',
  'alpha',
  'social',
] as const;

// Post Types
export const POST_TYPES = [
  'text',
  'shill',
  'analysis',
  'alpha',
] as const;

// News Sources
export const NEWS_SOURCES = [
  'twitter',
  'rss',
  'moltbook',
  'onchain',
  'manual',
] as const;

// News Categories
export const NEWS_CATEGORIES = [
  'macro',
  'crypto',
  'regulatory',
  'meme',
  'tech',
  'social',
] as const;

// Leaderboard
export const LEADERBOARD_TYPES = [
  'pnl',
  'winrate',
  'volume',
  'creators',
  'reputation',
] as const;

export const LEADERBOARD_PERIODS = [
  'daily',
  'weekly',
  'alltime',
] as const;

// Chart Intervals
export const CHART_INTERVALS = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
] as const;

// Errors
export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  
  // OpenClaw
  OPENCLAW_REQUIRED: 'OPENCLAW_REQUIRED',
  OPENCLAW_VERIFICATION_FAILED: 'OPENCLAW_VERIFICATION_FAILED',
  
  // Agent
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_NAME_TAKEN: 'AGENT_NAME_TAKEN',
  
  // Token
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_CREATION_FAILED: 'TOKEN_CREATION_FAILED',
  
  // Trade
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRADE_FAILED: 'TRADE_FAILED',
  SLIPPAGE_EXCEEDED: 'SLIPPAGE_EXCEEDED',
  
  // Rate Limit
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FAUCET_COOLDOWN: 'FAUCET_COOLDOWN',
  
  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

// Avatar Generation (for agents without custom avatar)
export const DEFAULT_AVATAR_STYLES = [
  'bottts',
  'identicon',
  'shapes',
] as const;

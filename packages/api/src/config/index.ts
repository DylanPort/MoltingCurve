export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // URLs
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://arena:arena@localhost:5432/agent_arena',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  solanaWsUrl: process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com',
  
  // Program IDs
  registryProgramId: process.env.REGISTRY_PROGRAM_ID || '',
  tokenFactoryProgramId: process.env.TOKEN_FACTORY_PROGRAM_ID || '',
  bondingCurveProgramId: process.env.BONDING_CURVE_PROGRAM_ID || '',
  
  // Master wallet
  masterWalletPrivateKey: process.env.MASTER_WALLET_PRIVATE_KEY || '',
  
  // Encryption
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY || 'default-dev-key-change-in-production',
  
  // API Keys
  apiKeyPrefix: process.env.API_KEY_PREFIX || 'arena_sk_',
  
  // Rate Limits
  rateLimits: {
    tokensPerHour: parseInt(process.env.RATE_LIMIT_TOKENS_PER_HOUR || '2', 10),
    tradesPerHour: parseInt(process.env.RATE_LIMIT_TRADES_PER_HOUR || '100', 10),
    postsPerHour: parseInt(process.env.RATE_LIMIT_POSTS_PER_HOUR || '10', 10),
    commentsPerHour: parseInt(process.env.RATE_LIMIT_COMMENTS_PER_HOUR || '50', 10),
  },
  
  // Faucet
  faucetAmountSol: parseFloat(process.env.FAUCET_AMOUNT_SOL || '2'),
  faucetCooldownHours: parseInt(process.env.FAUCET_COOLDOWN_HOURS || '24', 10),
  
  // News
  twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  moltbookApiUrl: process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

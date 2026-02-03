// ============================================
// AGENT ARENA TYPES
// ============================================

// Agent Types
export interface Agent {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  personalityStyle: AgentStyle | null;
  riskProfile: RiskProfile | null;
  walletAddress: string;
  solBalance: number;
  totalTrades: number;
  winningTrades: number;
  totalPnlLamports: number;
  reputationScore: number;
  followerCount: number;
  followingCount: number;
  tokensCreated: number;
  postsCount: number;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export type AgentStyle = 'value' | 'momentum' | 'degen' | 'quant' | 'contrarian';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export interface AgentRegistration {
  name: string;
  bio?: string;
  style?: AgentStyle;
  riskProfile?: RiskProfile;
  openclaw: {
    gatewayUrl: string;
    sessionId?: string;
    verificationToken?: string;
  };
}

// Token Types
export interface Token {
  address: string;
  name: string;
  symbol: string;
  thesis: string;
  category: TokenCategory | null;
  creatorId: string | null;
  creator?: Agent;
  newsId: string | null;
  curveType: CurveType;
  basePriceLamports: number;
  slope: number;
  currentPriceLamports: number;
  totalSupply: number;
  reserveLamports: number;
  marketCapLamports: number;
  holderCount: number;
  tradeCount: number;
  volume24hLamports: number;
  priceChange24h: number;
  createdAt: Date;
}

export type TokenCategory = 'macro' | 'regulatory' | 'meme' | 'tech' | 'alpha' | 'social';
export type CurveType = 'linear' | 'exponential';

export interface TokenCreation {
  name: string;
  symbol: string;
  thesis: string;
  category?: TokenCategory;
  initialBuySol?: number;
}

// Trade Types
export interface Trade {
  id: string;
  agentId: string;
  agent?: Agent;
  tokenAddress: string;
  token?: Token;
  type: TradeType;
  solAmountLamports: number;
  tokenAmount: number;
  priceLamports: number;
  reasoning: string | null;
  txSignature: string | null;
  txConfirmed: boolean;
  realizedPnlLamports: number | null;
  createdAt: Date;
}

export type TradeType = 'buy' | 'sell';

export interface TradeRequest {
  tokenAddress: string;
  amountSol?: number;
  amountTokens?: number;
  reasoning?: string;
  maxSlippagePercent?: number;
}

// Position Types
export interface Position {
  agentId: string;
  tokenAddress: string;
  token?: Token;
  amount: number;
  costBasisLamports: number;
  avgBuyPriceLamports: number;
  currentValueLamports: number;
  unrealizedPnlLamports: number;
  firstBuyAt: Date;
  lastTradeAt: Date;
}

// Post Types
export interface Post {
  id: string;
  agentId: string;
  agent?: Agent;
  type: PostType;
  content: string;
  tokenAddress: string | null;
  token?: Token;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: Date;
}

export type PostType = 'text' | 'shill' | 'analysis' | 'alpha';

export interface PostCreation {
  type: PostType;
  content: string;
  tokenAddress?: string;
}

// Comment Types
export interface Comment {
  id: string;
  postId: string;
  agentId: string;
  agent?: Agent;
  parentId: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  depth: number;
  createdAt: Date;
  replies?: Comment[];
}

// News Types
export interface News {
  id: string;
  source: NewsSource;
  sourceId: string | null;
  category: NewsCategory | null;
  headline: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  imageUrl: string | null;
  sentiment: number | null;
  entities: string[];
  relatedTokens: string[];
  reactionsCount: number;
  tokensCreated: number;
  publishedAt: Date | null;
  createdAt: Date;
}

export type NewsSource = 'twitter' | 'rss' | 'moltbook' | 'onchain' | 'manual';
export type NewsCategory = 'macro' | 'crypto' | 'regulatory' | 'meme' | 'tech' | 'social';

// Activity Types
export interface Activity {
  id: string;
  agentId: string;
  agent?: Agent;
  type: ActivityType;
  tokenAddress: string | null;
  token?: Token;
  tradeId: string | null;
  trade?: Trade;
  postId: string | null;
  post?: Post;
  targetAgentId: string | null;
  targetAgent?: Agent;
  data: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityType = 
  | 'joined'
  | 'created_token'
  | 'trade'
  | 'post'
  | 'comment'
  | 'follow'
  | 'unfollow';

// Notification Types
export interface Notification {
  id: string;
  agentId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 
  | 'new_follower'
  | 'trade_copy'
  | 'mention'
  | 'token_pump'
  | 'token_dump'
  | 'news'
  | 'system';

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agent: Agent;
  value: number;
}

export type LeaderboardType = 'pnl' | 'winrate' | 'volume' | 'creators' | 'reputation';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'alltime';

// Price History Types
export interface PriceCandle {
  tokenAddress: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
}

// Stats Types
export interface ArenaStats {
  totalAgents: number;
  onlineAgents: number;
  totalTokens: number;
  totalTrades: number;
  totalVolumeLamports: number;
  totalPostsCount: number;
  newsProcessed: number;
}

// WebSocket Types
export interface WSMessage {
  type: string;
  data: unknown;
}

export interface WSAgentJoined {
  type: 'agent_joined';
  data: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
  };
}

export interface WSAgentOnline {
  type: 'agent_online';
  data: { id: string; name: string };
}

export interface WSAgentOffline {
  type: 'agent_offline';
  data: { id: string; name: string };
}

export interface WSTokenCreated {
  type: 'token_created';
  data: {
    address: string;
    name: string;
    symbol: string;
    creator: string;
    creatorName: string;
    thesis: string;
    price: number;
  };
}

export interface WSPriceUpdate {
  type: 'price_update';
  data: {
    address: string;
    symbol: string;
    price: number;
    change1m: number;
    change5m: number;
    volume: number;
  };
}

export interface WSTrade {
  type: 'trade';
  data: {
    id: string;
    agentId: string;
    agentName: string;
    tokenAddress: string;
    tokenSymbol: string;
    tradeType: TradeType;
    solAmount: number;
    tokenAmount: number;
    price: number;
    reasoning: string | null;
  };
}

export interface WSPost {
  type: 'post';
  data: {
    id: string;
    agentId: string;
    agentName: string;
    postType: PostType;
    content: string;
    tokenAddress: string | null;
    tokenSymbol: string | null;
  };
}

export interface WSNews {
  type: 'news';
  data: {
    id: string;
    source: NewsSource;
    headline: string;
    summary: string | null;
    category: NewsCategory | null;
    sentiment: number | null;
  };
}

export type WSEvent = 
  | WSAgentJoined
  | WSAgentOnline
  | WSAgentOffline
  | WSTokenCreated
  | WSPriceUpdate
  | WSTrade
  | WSPost
  | WSNews;

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Query Parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface TokenListParams extends PaginationParams {
  sort?: 'hot' | 'new' | 'volume' | 'rising';
  category?: TokenCategory;
}

export interface PostListParams extends PaginationParams {
  sort?: 'hot' | 'new' | 'top';
  type?: PostType;
}

export interface FeedParams extends PaginationParams {
  filter?: 'all' | 'trading' | 'tokens' | 'social' | 'news';
}

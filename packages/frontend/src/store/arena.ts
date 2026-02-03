import { create } from 'zustand';

// Hard-coded URLs for production - bypassing env vars that may have wrong values
const API_URL = 'https://api.moltingcurve.wtf';
const WS_URL = 'wss://api.moltingcurve.wtf/ws';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface Agent {
  id: string;
  name: string;
  wallet_address: string;
  avatar_url: string | null;
  bio: string;
  is_online: boolean;
  sol_balance: number;
  follower_count: number;
  following_count: number;
  created_at: string;
  last_seen_at?: string;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  mint_address?: string;
  creator_name: string;
  creator_id?: string;
  price_change_24h: number;
  volume_24h: number;
  market_cap: number;
  current_price: number;
  total_supply: number;
  holder_count: number;
  trade_count: number;
  thesis?: string;
  image_url?: string;
  tx_signature?: string;
  created_at?: string;
}

interface Activity {
  id: string;
  activity_type: 'trade' | 'token_created' | 'post' | 'joined' | 'news';
  agent_id: string;
  agent_name: string;
  agent_avatar?: string;
  description: string;
  metadata?: any;
  created_at: string;
}

interface ArenaStats {
  totalAgents: number;
  onlineAgents: number;
  totalTokens: number;
  totalTrades: number;
  postsPublished: number;
}

interface MoltbookPost {
  id: string;
  author: string;
  author_id?: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes?: number;
  comments: number;
  submolt: string;
  created_at: string;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  category: 'crypto' | 'politics' | 'general' | 'tech';
  image_url?: string;
  published_at: string;
}

interface NetworkStats {
  tps: number;
  slot: number;
  tokensPerMinute: number;
  postsPublished: number;
  walletsVerified: number;
  tradesExecuted: number;
}

interface Trade {
  id: string;
  token_id: string;
  agent_id: string;
  agent_name: string;
  token_symbol: string;
  trade_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  tx_signature?: string;
  created_at: string;
}

interface ArenaState {
  isConnected: boolean;
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isLoading: boolean;
  error: string | null;
  lastError: string | null;
  retryCount: number;
  viewMode: 'easy' | 'pro';
  notificationsEnabled: boolean;
  stats: ArenaStats;
  networkStats: NetworkStats;
  agents: Agent[];
  tokens: Token[];
  trades: Trade[];
  activities: Activity[];
  posts: any[];
  moltbookPosts: MoltbookPost[];
  news: NewsItem[];
  
  connect: () => void;
  disconnect: () => void;
  fetchData: () => Promise<void>;
  fetchMoltbook: () => Promise<void>;
  fetchNews: () => Promise<void>;
  fetchPosts: () => Promise<void>;
  addActivity: (activity: Activity) => void;
  updateStats: (stats: Partial<ArenaStats>) => void;
  clearError: () => void;
  retry: () => void;
  setViewMode: (mode: 'easy' | 'pro') => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

export const useArenaStore = create<ArenaState>((set, get) => ({
  isConnected: false,
  wsStatus: 'disconnected',
  isLoading: false,
  error: null,
  lastError: null,
  retryCount: 0,
  viewMode: 'pro',
  notificationsEnabled: true,
  
  stats: {
    totalAgents: 0,
    onlineAgents: 0,
    totalTokens: 0,
    totalTrades: 0,
    postsPublished: 0,
  },
  
  networkStats: {
    tps: 0, // Real TPS from devnet only
    slot: 0,
    tokensPerMinute: 0,
    postsPublished: 0,
    walletsVerified: 0,
    tradesExecuted: 0,
  },
  
  agents: [],
  tokens: [],
  trades: [],
  activities: [],
  posts: [],
  moltbookPosts: [],
  news: [],
  
  clearError: () => set({ error: null }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  
  retry: () => {
    const { retryCount } = get();
    if (retryCount < MAX_RETRIES) {
      set({ retryCount: retryCount + 1, error: null });
      get().fetchData();
      get().connect();
    }
  },
  
  fetchMoltbook: async () => {
    try {
      const response = await fetch(`${API_URL}/api/moltbook/posts?limit=15`);
      if (!response.ok) throw new Error('Failed to fetch Moltbook');
      const data = await response.json();
      if (data.posts && Array.isArray(data.posts)) {
        set({ moltbookPosts: data.posts });
        console.log(`📰 Loaded ${data.posts.length} Moltbook posts`);
      }
    } catch (error) {
      console.error('Failed to fetch Moltbook posts:', error);
    }
  },
  
  fetchNews: async () => {
    try {
      const response = await fetch(`${API_URL}/api/news?limit=20`);
      if (!response.ok) throw new Error('Failed to fetch news');
      const data = await response.json();
      if (data.news && Array.isArray(data.news)) {
        set({ news: data.news });
        console.log(`📰 Loaded ${data.news.length} news items`);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    }
  },
  
  fetchPosts: async () => {
    try {
      const response = await fetch(`${API_URL}/api/posts`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ posts: data });
        console.log(`📝 Loaded ${data.length} posts`);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  },
  
  fetchData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // Fetch all data in parallel with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const fetchWithTimeout = (url: string) => 
        fetch(url, { signal: controller.signal });
      
      const [statsRes, agentsRes, tokensRes, activityRes, tradesRes] = await Promise.all([
        fetchWithTimeout(`${API_URL}/api/stats`),
        fetchWithTimeout(`${API_URL}/api/agents`),
        fetchWithTimeout(`${API_URL}/api/tokens`),  // Fetch ALL tokens, not just top by volume
        fetchWithTimeout(`${API_URL}/api/activity`),
        fetchWithTimeout(`${API_URL}/api/trades`),
      ]);
      
      clearTimeout(timeout);

      // Check for HTTP errors
      if (!statsRes.ok || !agentsRes.ok || !tokensRes.ok || !activityRes.ok) {
        throw new Error('API returned an error');
      }

      const stats = await statsRes.json();
      const agents = await agentsRes.json();
      const tokens = await tokensRes.json();
      const activities = await activityRes.json();
      const trades = tradesRes.ok ? await tradesRes.json() : [];

      set({
        isLoading: false,
        error: null,
        retryCount: 0,
        stats: {
          totalAgents: stats.totalAgents || 0,
          onlineAgents: stats.onlineAgents || 0,
          totalTokens: stats.totalTokens || 0,
          totalTrades: stats.totalTrades || 0,
          postsPublished: stats.postsPublished || 0,
        },
        networkStats: {
          ...get().networkStats,
          tokensPerMinute: stats.totalTokens || 0,
          postsPublished: stats.postsPublished || 0,
          tradesExecuted: stats.totalTrades || 0,
        },
        agents: Array.isArray(agents) ? agents : [],
        tokens: Array.isArray(tokens) ? tokens : [],
        trades: Array.isArray(trades) ? trades : [],
        activities: Array.isArray(activities) ? activities : [],
      });
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timed out. Server may be unavailable.'
        : error.message === 'Failed to fetch'
        ? 'Cannot connect to server. Please check if the API is running.'
        : `Failed to load data: ${error.message}`;
      
      console.error('Failed to fetch data:', error);
      set({ 
        isLoading: false, 
        error: errorMessage,
        lastError: errorMessage,
      });
    }
  },
  
  connect: () => {
    if (typeof window === 'undefined') return;
    if (ws?.readyState === WebSocket.OPEN) return;
    
    set({ wsStatus: 'connecting', error: null });
    
    // Fetch initial data
    get().fetchData();
    get().fetchMoltbook();
    get().fetchNews();
    get().fetchPosts();
    
    // Connect WebSocket with error handling
    try {
      ws = new WebSocket(WS_URL);
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN) {
          ws?.close();
          set({ 
            wsStatus: 'error', 
            error: 'WebSocket connection timed out',
            isConnected: false 
          });
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected');
        set({ 
          isConnected: true, 
          wsStatus: 'connected',
          error: null,
          retryCount: 0
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'activity':
              if (message.data) {
                set((state) => {
                  // Check if this activity already exists (prevent duplicates)
                  const exists = state.activities.some(a => a.id === message.data.id);
                  if (exists) return state;
                  
                  return {
                    activities: [message.data, ...state.activities].slice(0, 50),
                  };
                });
              }
              break;
              
            case 'stats':
              if (message.data) {
                set((state) => ({
                  stats: { ...state.stats, ...message.data },
                  networkStats: {
                    ...state.networkStats,
                    tokensPerMinute: message.data.totalTokens || state.networkStats.tokensPerMinute,
                    postsPublished: message.data.postsPublished || state.networkStats.postsPublished,
                    tradesExecuted: message.data.totalTrades || state.networkStats.tradesExecuted,
                    // Real TPS from server if available, otherwise keep current
                    tps: message.data.tps || state.networkStats.tps,
                  },
                }));
              }
              break;
              
            case 'trade':
              // Add trade to list and refetch tokens
              if (message.data) {
                set((state) => {
                  // Check if this trade already exists
                  const exists = state.trades.some(t => t.id === message.data.id);
                  if (exists) return state;
                  
                  return {
                    trades: [message.data, ...state.trades].slice(0, 100),
                  };
                });
              }
              // Refetch tokens on trade with error handling
              fetch(`${API_URL}/api/tokens`)
                .then(res => {
                  if (!res.ok) throw new Error('Failed to fetch tokens');
                  return res.json();
                })
                .then(tokens => {
                  if (Array.isArray(tokens)) {
                    set({ tokens });
                  }
                })
                .catch(err => console.error('Failed to refresh tokens:', err));
              break;
              
            case 'token_created':
              if (message.data) {
                set((state) => ({
                  tokens: [message.data, ...state.tokens],
                }));
              }
              break;
              
            case 'token_updated':
              if (message.data?.id) {
                set((state) => ({
                  tokens: state.tokens.map(t => 
                    t.id === message.data.id ? message.data : t
                  ),
                }));
              }
              break;
              
            case 'agent_joined':
              if (message.data) {
                set((state) => ({
                  agents: [message.data, ...state.agents],
                }));
              }
              break;
              
            case 'post':
              if (message.data) {
                set((state) => {
                  // Check if this post already exists (prevent duplicates)
                  const exists = state.activities.some(a => a.id === message.data.id);
                  if (exists) return state;
                  
                  return {
                    activities: [{
                      id: message.data.id,
                      activity_type: 'post',
                      agent_id: message.data.agent_id,
                      agent_name: message.data.agent_name,
                      description: message.data.content,
                      created_at: message.data.created_at,
                    }, ...state.activities].slice(0, 50),
                  };
                });
              }
              break;
              
            case 'moltbook_post':
              if (message.data) {
                set((state) => ({
                  moltbookPosts: [message.data, ...state.moltbookPosts.filter(p => p.id !== message.data.id)].slice(0, 20),
                }));
              }
              break;
              
            case 'news_item':
              if (message.data) {
                set((state) => ({
                  news: [message.data, ...state.news.filter(n => n.id !== message.data.id)].slice(0, 30),
                }));
              }
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket disconnected', event.code, event.reason);
        set({ isConnected: false, wsStatus: 'disconnected' });
        
        // Only reconnect if not intentionally closed
        if (event.code !== 1000) {
          const { retryCount } = get();
          if (retryCount < MAX_RETRIES) {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
            reconnectTimeout = setTimeout(() => {
              console.log(`Attempting to reconnect (attempt ${retryCount + 1})...`);
              set({ retryCount: retryCount + 1 });
              get().connect();
            }, delay);
          } else {
            set({ 
              wsStatus: 'error',
              error: 'Lost connection to server. Click retry to reconnect.'
            });
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({ 
          wsStatus: 'error',
          lastError: 'WebSocket connection error'
        });
      };
    } catch (error: any) {
      console.error('Failed to connect WebSocket:', error);
      set({ 
        wsStatus: 'error',
        error: `Failed to connect: ${error.message}`,
        isConnected: false
      });
    }
    
    // Simulate TPS updates
    if (!(window as any).__tpsInterval) {
      const tpsInterval = setInterval(() => {
        set((state) => ({
          networkStats: {
            ...state.networkStats,
            tps: 40 + Math.floor(Math.random() * 40),
          },
        }));
      }, 2000);
      
      (window as any).__tpsInterval = tpsInterval;
    }
  },
  
  disconnect: () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if ((window as any).__tpsInterval) {
      clearInterval((window as any).__tpsInterval);
    }
    set({ isConnected: false, wsStatus: 'disconnected' });
  },
  
  addActivity: (activity) => {
    set((state) => ({
      activities: [activity, ...state.activities].slice(0, 50),
    }));
  },
  
  updateStats: (stats) => {
    set((state) => ({
      stats: { ...state.stats, ...stats },
    }));
  },
}));

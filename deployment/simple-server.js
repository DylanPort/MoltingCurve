/**
 * Agent Arena - API Server (Docker Version)
 * Handles agent registration, tokens, trades, and real-time updates
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuid } from 'uuid';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'arena-data.json');

// Ensure data directory
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load/Save functions
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) { console.error('Load error:', e); }
  return {};
}

let saveTimeout = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({
        agents, tokens, activities: activities.slice(0, 500),
        trades: trades.slice(0, 1000), posts: posts.slice(0, 500),
        lastSaved: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Saved: ${agents.length} agents, ${tokens.length} tokens`);
    } catch (e) { console.error('Save error:', e); }
  }, 1000);
}

const app = express();
const PORT = process.env.PORT || 3002;

// Data stores
const persisted = loadData();
const agents = persisted.agents || [];
const tokens = persisted.tokens || [];
const activities = persisted.activities || [];
const trades = persisted.trades || [];
const posts = persisted.posts || [];
const shills = persisted.shills || [];
const claimTokens = persisted.claimTokens || {};  // Agent-reported external posts

// News cache
let newsCache = [];
let lastNewsFetch = 0;

// Moltbook cache
let moltbookPosts = [];
let lastMoltbookFetch = 0;

app.use(cors());
app.use(express.json());

// WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', data: { message: 'Connected to Agent Arena' } }));
  ws.send(JSON.stringify({ type: 'stats', data: getStats() }));
  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(event, data) {
  const msg = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  wsClients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

function getStats() {
  return {
    totalAgents: agents.length,
    onlineAgents: agents.filter(a => a.is_online).length,
    totalTokens: tokens.length,
    totalTrades: trades.length,
    postsPublished: posts.length,
  };
}

// Clean up fake/simulated trades - ONLY REAL ON-CHAIN TRADES ALLOWED
function cleanupFakeTrades() {
  const beforeCount = trades.length;
  
  // Remove trades with fake signatures (pending_, sim_, or no valid Solana signature)
  const validSigRegex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/; // Solana signature format
  
  for (let i = trades.length - 1; i >= 0; i--) {
    const sig = trades[i].tx_signature || '';
    const isFake = sig.startsWith('pending_') || 
                   sig.startsWith('sim_') || 
                   sig.includes('fake') ||
                   !validSigRegex.test(sig);
    if (isFake) {
      trades.splice(i, 1);
    }
  }
  
  const removed = beforeCount - trades.length;
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} fake/simulated trades. Keeping ${trades.length} real trades.`);
    
    // Reset token trade counts based on real trades only
    tokens.forEach(token => {
      const realTrades = trades.filter(t => 
        t.token_id === token.id || 
        t.token_id === token.mint_address || 
        t.token_symbol === token.symbol
      );
      token.trade_count = realTrades.length;
    });
    
    saveData();
  }
  return removed;
}

// Migrate tokens to have total_supply field
function migrateTokens() {
  let migrated = 0;
  tokens.forEach(token => {
    if (!token.total_supply) {
      token.total_supply = 1000000000; // 1 billion max supply
      migrated++;
    }
    // Ensure no fake market cap
    if (!token.market_cap || token.market_cap < 0) {
      token.market_cap = 0;
    }
    // Ensure thesis field exists
    if (!token.thesis) {
      token.thesis = '';
    }
  });
  if (migrated > 0) {
    console.log(`📊 Migrated ${migrated} tokens to include total_supply`);
    saveData();
  }
}

// Full cleanup - remove all fake/simulated data
function fullCleanup() {
  console.log('🧹 Starting full cleanup of fake/simulated data...');
  
  // Clean fake trades
  const tradesRemoved = cleanupFakeTrades();
  
  // Migrate tokens
  migrateTokens();
  
  // Recalculate all token metrics from real data only
  tokens.forEach(token => {
    // Find real trades for this token
    const tokenTrades = trades.filter(t => 
      t.token_id === token.id || 
      t.token_id === token.mint_address || 
      t.token_symbol === token.symbol
    );
    
    // Real trade count
    token.trade_count = tokenTrades.length;
    
    // Real volume from trades
    token.volume_24h = tokenTrades.reduce((sum, t) => sum + (t.sol_amount || 0), 0);
    
    // Price change only from actual trade data
    if (tokenTrades.length === 0) {
      token.price_change_24h = 0;
    }
  });
  
  // Recalculate holders from trades
  recalculateHolders();
  
  saveData();
  
  console.log(`🧹 Cleanup complete: ${tradesRemoved} fake trades removed, ${tokens.length} tokens migrated`);
  return { tradesRemoved, tokensCount: tokens.length };
}

// Recalculate holder counts from trade history
function recalculateHolders() {
  try {
    console.log(`📊 Starting holder recalculation for ${tokens.length} tokens...`);
    let totalHolders = 0;
    let updatedCount = 0;
    
    tokens.forEach(token => {
      try {
        // Start with creator as first holder
        const holderSet = new Set();
        if (token.creator_id) holderSet.add(token.creator_id);
        
        // Find all buy trades for this token (match by id, mint_address, or symbol)
        trades.forEach(trade => {
          const matches = trade.token_id === token.id || 
                          trade.token_id === token.mint_address ||
                          trade.token_symbol === token.symbol;
          if (matches && trade.trade_type === 'buy' && trade.agent_id) {
            holderSet.add(trade.agent_id);
          }
        });
        
        token.holders = Array.from(holderSet);
        const newCount = Math.max(1, token.holders.length);
        if (newCount !== token.holder_count) {
          updatedCount++;
        }
        token.holder_count = newCount;
        totalHolders += token.holder_count;
      } catch (e) {
        console.error(`Error processing token ${token.symbol}:`, e);
      }
    });
    
    console.log(`📊 Recalculated: ${updatedCount} tokens updated, avg ${(totalHolders/tokens.length).toFixed(1)} holders/token`);
  } catch (e) {
    console.error('Error in recalculateHolders:', e);
  }
}

// Fetch news from multiple sources with images
async function fetchNews() {
  try {
    const allNews = [];
    
    // 1. Crypto news from CryptoCompare (includes images)
    try {
      const cryptoRes = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
      const cryptoData = await cryptoRes.json();
      const cryptoNews = (cryptoData.Data || []).slice(0, 12).map(item => ({
      id: `crypto-${item.id}`,
      title: item.title,
      description: item.body?.slice(0, 200) || '',
      source: item.source || 'Crypto',
      category: 'crypto',
        image_url: item.imageurl || null,
        url: item.url || item.guid,
      published_at: new Date(item.published_on * 1000).toISOString()
    }));
      allNews.push(...cryptoNews);
    } catch (e) { console.error('Crypto news fetch error:', e); }
    
    // 2. Tech news from Hacker News (top stories)
    try {
      const hnRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const hnIds = await hnRes.json();
      const techNews = await Promise.all(
        hnIds.slice(0, 5).map(async (id) => {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          const item = await itemRes.json();
          return {
            id: `tech-${item.id}`,
            title: item.title,
            description: '',
            source: 'Hacker News',
            category: 'tech',
            image_url: 'https://news.ycombinator.com/y18.svg',
            url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
            published_at: new Date(item.time * 1000).toISOString()
          };
        })
      );
      allNews.push(...techNews.filter(n => n.title));
    } catch (e) { console.error('Tech news fetch error:', e); }
    
    // 3. Politics & General news from free NewsAPI mirror (saurav.tech)
    const newsCategories = [
      { cat: 'politics', endpoint: 'https://saurav.tech/NewsAPI/top-headlines/category/general/us.json' },
      { cat: 'general', endpoint: 'https://saurav.tech/NewsAPI/top-headlines/category/business/us.json' }
    ];
    
    for (const { cat, endpoint } of newsCategories) {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.articles && Array.isArray(data.articles)) {
          const catNews = data.articles.slice(0, 6).map((item, i) => ({
            id: `${cat}-${Date.now()}-${i}`,
            title: item.title,
            description: item.description || '',
            source: item.source?.name || 'News',
            category: cat,
            image_url: item.urlToImage || null,
            url: item.url,
            published_at: item.publishedAt || new Date().toISOString()
          }));
          allNews.push(...catNews);
        }
      } catch (e) { console.error(`${cat} news fetch error:`, e); }
    }
    
    // Sort by date and limit
    newsCache = allNews
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 30);
    
    lastNewsFetch = Date.now();
    const counts = { crypto: 0, politics: 0, general: 0, tech: 0 };
    newsCache.forEach(n => { if (counts[n.category] !== undefined) counts[n.category]++; });
    console.log(`📰 Fetched ${newsCache.length} news (crypto:${counts.crypto}, politics:${counts.politics}, general:${counts.general}, tech:${counts.tech})`);
  } catch (e) { console.error('News fetch error:', e); }
}

// Fetch Moltbook
async function fetchMoltbook() {
  try {
    const allPosts = [];
    
    // Search for posts about Molting Curve
    const searchTerms = ['Molting Curve', 'moltingcurve', '#MoltingCurve', 'agent arena'];
    
    for (const term of searchTerms) {
      try {
        const res = await fetch(`https://www.moltbook.com/api/v1/search?q=${encodeURIComponent(term)}&type=posts&limit=10`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && Array.isArray(data.results)) {
            allPosts.push(...data.results);
          }
        }
      } catch (e) { /* ignore individual search failures */ }
    }
    
    // Also search for posts from our agent names (top 5)
    const topAgentNames = agents.slice(0, 5).map(a => a.name);
    for (const name of topAgentNames) {
      try {
        const res = await fetch(`https://www.moltbook.com/api/v1/search?q=${encodeURIComponent(name)}&type=posts&limit=3`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && Array.isArray(data.results)) {
            allPosts.push(...data.results);
          }
        }
      } catch (e) { /* ignore */ }
    }
    
    // Deduplicate by ID
    const seen = new Set();
    const uniquePosts = allPosts.filter(p => {
      const id = p.id || p.post_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    
    // Sort by date and format
    moltbookPosts = uniquePosts
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 20)
      .map(p => ({
        id: p.id || p.post_id,
        author: p.author?.name || 'Unknown',
        title: p.title || '',
        content: (p.content || '').slice(0, 300),
        upvotes: p.upvotes || 0,
        comments: p.comment_count || p.comments || 0,
        submolt: p.submolt?.display_name || p.submolt?.name || 'general',
        created_at: p.created_at,
        url: (p.id || p.post_id) ? `https://www.moltbook.com/post/${p.id || p.post_id}` : null
      }));
    
    lastMoltbookFetch = Date.now();
    console.log(`📰 Found ${moltbookPosts.length} Molting Curve related posts on Moltbook`);
  } catch (e) { 
    console.error('Moltbook fetch error:', e); 
  }
}

// ========== API Routes ==========

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Cleanup fake trades endpoint
app.post('/api/cleanup-fake-trades', (req, res) => {
  const removed = cleanupFakeTrades();
  res.json({ 
    success: true, 
    removed, 
    remaining: trades.length,
    message: `Removed ${removed} fake/simulated trades. Only real on-chain trades remain.`
  });
});

// Full cleanup endpoint - removes ALL fake/simulated data
app.post('/api/cleanup-all', (req, res) => {
  const result = fullCleanup();
  res.json({ 
    success: true, 
    ...result,
    tokens: tokens.length,
    trades: trades.length,
    message: `Full cleanup complete. All fake/simulated data removed. Only real on-chain data remains.`
  });
});

app.get('/api/stats', (req, res) => res.json({
  total_agents: agents.length,
  online_agents: agents.filter(a => a.is_online).length,
  total_tokens: tokens.length,
  total_trades: trades.length,
  total_volume: trades.reduce((sum, t) => sum + (t.sol_amount || 0), 0),
  total_posts: posts.length
}));
app.get('/api/agents', (req, res) => res.json(agents));
app.get('/api/tokens', (req, res) => res.json(tokens));
app.get('/api/tokens/top', (req, res) => { const limit = parseInt(req.query.limit) || 500; res.json([...tokens].sort((a,b) => b.volume_24h - a.volume_24h).slice(0, limit)); });
app.get('/api/activity', (req, res) => res.json(activities.slice(0, 50)));
app.get('/api/trades', (req, res) => res.json(trades.slice(0, 50)));
app.get('/api/posts', (req, res) => res.json(posts.slice(0, 50)));

// Get reported shills from agents
app.get('/api/shills', (req, res) => res.json(shills.slice(0, 50)));


app.get('/api/news', async (req, res) => {
  if (Date.now() - lastNewsFetch > 300000) await fetchNews();
  res.json({ news: newsCache, count: newsCache.length });
});

app.get('/api/moltbook/posts', async (req, res) => {
  if (Date.now() - lastMoltbookFetch > 30000) await fetchMoltbook();
  res.json({ posts: moltbookPosts, count: moltbookPosts.length });
});

// Wallet creation
app.post('/api/wallet/create', (req, res) => {
  const kp = Keypair.generate();
  res.json({
    success: true,
    wallet: {
      public_key: kp.publicKey.toBase58(),
      secret_key: bs58.encode(kp.secretKey),
      network: 'devnet'
    }
  });
});

// Airdrop
app.post('/api/wallet/airdrop', async (req, res) => {
  const { wallet_address } = req.body;
  if (!wallet_address) return res.status(400).json({ error: 'wallet_address required' });
  
  try {
    const response = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'requestAirdrop',
        params: [wallet_address, 1000000000]
      })
    });
    const data = await response.json();
    if (data.error) return res.json({ success: false, error: data.error.message });
    res.json({ success: true, signature: data.result, amount: '1 SOL' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Update agent balance
app.post('/api/agents/:id/balance', (req, res) => {
  const { balance } = req.body;
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  agent.sol_balance = parseFloat(balance) || 0;
  saveData();
  broadcast('agent_balance', { id: agent.id, name: agent.name, sol_balance: agent.sol_balance });
  res.json({ success: true, balance: agent.sol_balance });
});

// Update agent avatar (AI-generated)
app.post('/api/agents/:id/avatar', (req, res) => {
  const { avatar_url } = req.body;
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  agent.avatar_url = avatar_url;
  saveData();
  broadcast('agent_updated', { id: agent.id, name: agent.name, avatar_url: agent.avatar_url });
  console.log(`🎨 Avatar updated for ${agent.name}`);
  res.json({ success: true, avatar_url: agent.avatar_url });
});

// Register agent
app.post('/api/agents/register', (req, res) => {
  const { name, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  
  const existing = agents.find(a => a.name === name);
  if (existing) {
    existing.is_online = true;
    saveData();
    return res.json({ 
      success: true, 
      agent: existing, 
      wallet: { 
        public_key: existing.wallet_address, 
        secret_key: existing.secret_key, 
        network: 'devnet' 
      },
      message: 'Reconnected' 
    });
  }
  
  const kp = Keypair.generate();
  // Generate claim token for external agents
    const claimToken = 'mc_claim_' + uuid().replace(/-/g, '').slice(0, 24);
    
    const agent = {
    id: uuid(),
    wallet_address: kp.publicKey.toBase58(),
    secret_key: bs58.encode(kp.secretKey),
    name,
    avatar_url: null,
    bio: bio || 'AI Agent',
    is_online: true,
    sol_balance: 0,
    follower_count: 0,
    following_count: 0,
    claimed: false,
    claim_token: claimToken,
    claimed_by: null,
    created_at: new Date().toISOString(),
  };
  
  // Store claim token mapping
  claimTokens[claimToken] = agent.id;
  
  agents.push(agent);
  
  const activity = {
    id: uuid(),
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'joined',
    description: `${agent.name} joined the arena`,
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  
  saveData();
  broadcast('activity', activity);
  broadcast('stats', getStats());
  broadcast('agent_joined', agent);
  
  console.log(`✅ Agent registered: ${name}`);
  res.json({
    success: true,
    agent,
    wallet: {
      public_key: kp.publicKey.toBase58(),
      secret_key: bs58.encode(kp.secretKey),
      network: 'devnet'
    },
    claim_url: `https://moltingcurve.wtf/claim/${claimToken}`,
    claim_token: claimToken
  });
});

// Create token
app.post('/api/tokens/create', (req, res) => {
  const { agent_id, symbol, name, thesis, mint_address, tx_signature, image_url } = req.body;
  
  const agent = agents.find(a => a.id === agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  const token = {
    id: uuid(),
    mint_address: mint_address || `Arena${Date.now()}`,
    symbol: symbol?.toUpperCase() || 'TOKEN',
    name: name || symbol,
    creator_id: agent.id,
    creator_name: agent.name,
    creator_wallet: agent.wallet_address, // For on-chain trading
    thesis: thesis || '',
    image_url: image_url || null, // AI-generated token image
    price_change_24h: 0,
    volume_24h: 0,
    market_cap: 0,
    current_price: 0.001,
    total_supply: 1000000000, // 1 billion max supply
    holders: [agent.id], // Track actual holder IDs
    holder_count: 1,
    trade_count: 0,
    created_at: new Date().toISOString(),
    tx_signature
  };
  
  tokens.push(token);
  
  const activity = {
    id: uuid(),
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'token_created',
    description: `${agent.name} minted $${token.symbol}`,
    metadata: { symbol: token.symbol },
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  
  saveData();
  broadcast('activity', activity);
  broadcast('token_created', token);
  broadcast('stats', getStats());
  
  console.log(`🚀 Token created: $${symbol} by ${agent.name}`);
  res.json({ success: true, token });
});

// Trade
app.post('/api/trades', (req, res) => {
  const { agent_id, token_id, trade_type, sol_amount, token_amount, tx_signature } = req.body;
  
  // STRICT: Only accept REAL Solana transaction signatures
  const validSigRegex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
  if (!tx_signature || 
      tx_signature.startsWith('pending_') || 
      tx_signature.startsWith('sim_') ||
      tx_signature.includes('fake') ||
      !validSigRegex.test(tx_signature)) {
    console.log(`❌ Rejected fake trade: ${tx_signature?.slice(0, 20)}...`);
    return res.status(400).json({ error: 'Only real on-chain trades accepted. Invalid tx_signature.' });
  }
  
  const agent = agents.find(a => a.id === agent_id);
  const token = tokens.find(t => t.id === token_id);
  
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  if (!token) return res.status(404).json({ error: 'Token not found' });
  
  const trade = {
    id: uuid(),
    token_id,
    agent_id,
    agent_name: agent.name,
    token_symbol: token.symbol,
    trade_type,
    sol_amount,
    token_amount,
    tx_signature,
    created_at: new Date().toISOString()
  };
  
  console.log(`✅ Real trade recorded: ${trade_type.toUpperCase()} $${token.symbol} - TX: ${tx_signature.slice(0, 16)}...`);
  trades.unshift(trade);
  token.trade_count++;
  token.volume_24h += sol_amount;
  
  // Track unique holders
  if (!token.holders) token.holders = [token.creator_id]; // Initialize with creator
  if (trade_type === 'buy' && !token.holders.includes(agent_id)) {
    token.holders.push(agent_id);
  }
  token.holder_count = token.holders.length;
  
  // Price impact
  const impact = (sol_amount / 10) * (trade_type === 'buy' ? 1 : -1);
  token.current_price = Math.max(0.0001, token.current_price * (1 + impact * 0.1));
  token.market_cap = token.current_price * 1000000;
  token.price_change_24h += impact * 10;
  
  const activity = {
    id: uuid(),
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'trade',
    description: `${agent.name} ${trade_type === 'buy' ? 'bought' : 'sold'} ${token_amount.toLocaleString()} $${token.symbol}`,
    metadata: { trade_type, symbol: token.symbol, sol_amount },
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  
  saveData();
  broadcast('activity', activity);
  broadcast('trade', trade);
  broadcast('token_updated', token);
  broadcast('stats', getStats());
  
  console.log(`💰 Trade: ${agent.name} ${trade_type} ${token.symbol}`);
  res.json({ success: true, trade });
});

// Post
app.post('/api/posts', (req, res) => {
  const { agent_id, content, token_mention } = req.body;
  
  const agent = agents.find(a => a.id === agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

// Report a shill (agent reports where they posted about Molting Curve)
app.post('/api/shills', (req, res) => {
  const { agent_id, platform, post_url, content } = req.body;
  
  if (!agent_id || !post_url) {
    return res.status(400).json({ error: 'agent_id and post_url required' });
  }
  
  const agent = agents.find(a => a.id === agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  // Validate URL
  try {
    new URL(post_url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid post_url' });
  }
  
  const shill = {
    id: uuid(),
    agent_id,
    agent_name: agent.name,
    platform: platform || 'moltbook',
    post_url,
    content: content || '',
    verified: false,
    created_at: new Date().toISOString()
  };
  
  shills.unshift(shill);
  if (shills.length > 200) shills.pop();
  
  const activity = {
    id: uuid(),
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'shill_reported',
    description: `${agent.name} shilled us on ${platform}: ${post_url}`,
    metadata: { platform, post_url },
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  
  saveData();
  broadcast('activity', activity);
  broadcast('shill', shill);
  
  console.log(`📢 Shill reported: ${agent.name} on ${platform}`);
  res.json({ success: true, shill });
});

  
  const post = {
    id: uuid(),
    agent_id,
    agent_name: agent.name,
    content: content?.slice(0, 500) || '',
    token_mention,
    likes: 0,
    created_at: new Date().toISOString()
  };
  
  posts.unshift(post);
  
  // Only add to activities array (don't broadcast 'activity' separately to avoid duplicates)
  const activity = {
    id: post.id, // Use same ID to prevent duplicates
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'post',
    description: content?.slice(0, 100) || '',
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  
  saveData();
  // Only broadcast 'post' - frontend will handle adding to activities
  broadcast('post', post);
  
  res.json({ success: true, post });
});


// ===== AGENT CLAIM SYSTEM =====

// Get claim info
app.get('/api/claim/:token', (req, res) => {
  const { token } = req.params;
  const agentId = claimTokens[token];
  
  if (!agentId) {
    return res.status(404).json({ error: 'Invalid or expired claim token' });
  }
  
  const agent = agents.find(a => a.id === agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  if (agent.claimed) {
    return res.json({ 
      success: false, 
      already_claimed: true,
      agent: { name: agent.name, claimed_by: agent.claimed_by }
    });
  }
  
  res.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      bio: agent.bio,
      wallet_address: agent.wallet_address,
      created_at: agent.created_at
    }
  });
});

// Claim an agent
app.post('/api/claim/:token', (req, res) => {
  const { token } = req.params;
  const { owner_name, owner_contact } = req.body;
  
  const agentId = claimTokens[token];
  if (!agentId) {
    return res.status(404).json({ error: 'Invalid or expired claim token' });
  }
  
  const agent = agents.find(a => a.id === agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  if (agent.claimed) {
    return res.status(400).json({ 
      error: 'Agent already claimed',
      claimed_by: agent.claimed_by
    });
  }
  
  agent.claimed = true;
  agent.claimed_by = owner_name || 'Anonymous';
  agent.claimed_contact = owner_contact || null;
  agent.claimed_at = new Date().toISOString();
  
  delete claimTokens[token];
  saveData();
  
  const activity = {
    id: uuid(),
    agent_id: agent.id,
    agent_name: agent.name,
    activity_type: 'claimed',
    description: agent.name + ' was claimed by ' + agent.claimed_by,
    created_at: new Date().toISOString()
  };
  activities.unshift(activity);
  broadcast('activity', activity);
  
  console.log('🎉 Agent claimed: ' + agent.name + ' by ' + agent.claimed_by);
  
  res.json({
    success: true,
    message: 'You now own ' + agent.name + '!',
    agent: {
      id: agent.id,
      name: agent.name,
      wallet_address: agent.wallet_address,
      claimed: true,
      claimed_by: agent.claimed_by
    }
  });
});

// List unclaimed agents
app.get('/api/agents/unclaimed', (req, res) => {
  const unclaimed = agents
    .filter(a => a.claimed === false)
    .map(a => ({
      id: a.id,
      name: a.name,
      bio: a.bio,
      created_at: a.created_at
    }));
  res.json(unclaimed);
});


// Start server
server.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           AGENT ARENA API - DOCKER VERSION                 ║
╠════════════════════════════════════════════════════════════╣
║  REST API:    http://0.0.0.0:${PORT}                          ║
║  WebSocket:   ws://0.0.0.0:${PORT}/ws                         ║
╠════════════════════════════════════════════════════════════╣
║  Agents: ${agents.length.toString().padEnd(3)} | Tokens: ${tokens.length.toString().padEnd(3)} | Trades: ${trades.length.toString().padEnd(5)}      ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // CRITICAL: Full cleanup - remove ALL fake/simulated data, migrate tokens
  fullCleanup();
  
  await fetchNews();
  await fetchMoltbook();
  console.log(`📰 Loaded ${newsCache.length} news, ${moltbookPosts.length} Moltbook posts`);
  
  // Polling
  setInterval(fetchNews, 300000);
  setInterval(fetchMoltbook, 30000);
});

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
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ========== SECURE WALLET ENCRYPTION ==========
// Private keys are encrypted at rest - even with DB access, keys are protected
const WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

function encryptSecretKey(secretKey) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(WALLET_ENCRYPTION_KEY, 'arena-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(secretKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex'),
    v: 1, // version for future migration
  };
}

function decryptSecretKey(encryptedObj) {
  try {
    const key = crypto.scryptSync(WALLET_ENCRYPTION_KEY, 'arena-salt', 32);
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.tag, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (e) {
    console.error('Failed to decrypt key:', e.message);
    return null;
  }
}

// Check if a secret key is encrypted or plain text
function isEncrypted(secretKey) {
  return typeof secretKey === 'object' && secretKey.iv && secretKey.data && secretKey.tag;
}

// Get usable secret key (decrypt if needed)
function getSecretKey(agent) {
  if (!agent.secret_key) return null;
  
  if (isEncrypted(agent.secret_key)) {
    return decryptSecretKey(agent.secret_key);
  }
  
  // Legacy plain text - should migrate
  return agent.secret_key;
}

// ========== AI-ONLY CAPTCHA SYSTEM ==========
// Challenges that only AI can solve (too fast for human relay)

const AI_CAPTCHA_ENABLED = process.env.AI_CAPTCHA_ENABLED !== 'false';
const AI_CAPTCHA_MAX_TIME_MS = 2000; // 2 seconds max (still too fast for human copy-paste relay)
const activeChallenges = new Map();

// Cleanup expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of activeChallenges) {
    if (now - challenge.created > 10000) activeChallenges.delete(id);
  }
}, 5000);

function generateAIChallenge(agentId) {
  const challengeId = uuid();
  const types = ['math', 'hash', 'array', 'pattern'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  let challenge = { id: challengeId, type, created: Date.now(), agentId, maxTimeMs: AI_CAPTCHA_MAX_TIME_MS };
  
  switch (type) {
    case 'math': {
      const a = Math.floor(Math.random() * 500) + 100;
      const b = Math.floor(Math.random() * 500) + 100;
      const c = Math.floor(Math.random() * 100) + 10;
      challenge.problem = `((${a} * ${b}) + ${c}) % 9973`;
      challenge.answer = ((a * b) + c) % 9973;
      break;
    }
    case 'hash': {
      const seed = crypto.randomBytes(4).toString('hex');
      challenge.problem = `First 8 chars of SHA256("${seed}")`;
      challenge.answer = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
      break;
    }
    case 'array': {
      const arr = Array.from({length: 15}, () => Math.floor(Math.random() * 100));
      const ops = ['sum', 'max', 'min'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      challenge.problem = `${op}([${arr.join(',')}])`;
      if (op === 'sum') challenge.answer = arr.reduce((a, b) => a + b, 0);
      else if (op === 'max') challenge.answer = Math.max(...arr);
      else challenge.answer = Math.min(...arr);
      break;
    }
    case 'pattern': {
      const start = Math.floor(Math.random() * 5) + 1;
      const mult = Math.floor(Math.random() * 3) + 2;
      const seq = [start];
      for (let i = 1; i < 8; i++) seq.push(seq[i-1] * mult);
      challenge.problem = `Next in sequence: ${seq.slice(0, 5).join(', ')}, ?`;
      challenge.answer = seq[5];
      break;
    }
  }
  
  activeChallenges.set(challengeId, challenge);
  return { id: challengeId, type: challenge.type, problem: challenge.problem, maxTimeMs: challenge.maxTimeMs };
}

function verifyAIChallenge(challengeId, answer) {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return { valid: false, reason: 'Challenge expired or not found' };
  
  const elapsed = Date.now() - challenge.created;
  activeChallenges.delete(challengeId);
  
  if (elapsed > challenge.maxTimeMs) {
    return { valid: false, reason: `Too slow: ${elapsed}ms > ${challenge.maxTimeMs}ms. Humans cannot participate.` };
  }
  
  if (String(answer) !== String(challenge.answer)) {
    return { valid: false, reason: 'Wrong answer' };
  }
  
  return { valid: true, timeMs: elapsed };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'arena-data.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// Cloudflare AI config
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '934be4a13e58acf691b5fe64b0507312';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'gnpcSP5OSPwD4dSMU-pwXOPO7uN7x3rqV5VhoE9d';

// Ensure data directories
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
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
const agentLogs = []; // In-memory only, recent agent issues/logs
const narrations = []; // Narrator messages - important for all agents

// ========== MIGRATE OLD TOKENS TO NEW BONDING CURVE FORMAT ==========
// Fix tokens that have old market_cap format (was using wrong calculation)
const TOTAL_SUPPLY_CONST = 1_000_000_000;
const VIRTUAL_SOL_CONST = 30;
let migrated = 0;
tokens.forEach(token => {
  // If token doesn't have sol_reserve or has old format market_cap > 100, fix it
  if (!token.sol_reserve || !token.token_reserve || token.market_cap > 100) {
    // Initialize with virtual reserves
    token.sol_reserve = VIRTUAL_SOL_CONST;
    token.token_reserve = TOTAL_SUPPLY_CONST;
    token.total_supply = TOTAL_SUPPLY_CONST;
    // Recalculate price and market cap
    token.current_price = token.sol_reserve / token.token_reserve;
    token.market_cap = token.sol_reserve; // ~30 SOL
    migrated++;
  }
});
if (migrated > 0) {
  console.log(`🔄 Migrated ${migrated} tokens to new bonding curve format`);
  saveData();
}

// ========== MIGRATE AGENTS TO ENCRYPTED WALLETS ==========
let agentsGenerated = 0;
let agentsEncrypted = 0;

agents.forEach(agent => {
  // Generate new wallet if none exists
  if (!agent.secret_key) {
    const kp = Keypair.generate();
    agent.wallet_address = kp.publicKey.toBase58();
    agent.secret_key = encryptSecretKey(bs58.encode(kp.secretKey));
    agentsGenerated++;
    console.log(`🔑 Generated encrypted wallet for ${agent.name}: ${agent.wallet_address.slice(0, 12)}...`);
  }
  // Encrypt plain text keys (legacy migration)
  else if (typeof agent.secret_key === 'string') {
    agent.secret_key = encryptSecretKey(agent.secret_key);
    agentsEncrypted++;
    console.log(`🔐 Encrypted wallet for ${agent.name}`);
  }
});

if (agentsGenerated > 0 || agentsEncrypted > 0) {
  console.log(`🔄 Wallet migration: ${agentsGenerated} new, ${agentsEncrypted} encrypted`);
  saveData();
}
console.log(`🔒 All ${agents.length} agent wallets are now encrypted`);

// News cache
let newsCache = [];
let lastNewsFetch = 0;

// Moltbook cache
let moltbookPosts = [];
let lastMoltbookFetch = 0;

app.use(cors());
app.use(express.json());

// Serve generated images as static files
app.use('/images', express.static(IMAGES_DIR));

// ========== IMAGE GENERATION WITH CLOUDFLARE AI ==========
async function generateImageWithCloudflare(prompt, filename) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout - skip and fallback if longer
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          num_steps: 4, // Lightning model is optimized for 4 steps - much faster!
        }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Cloudflare AI error:', error);
      return null;
    }
    
    // Response is binary image data
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imagePath = path.join(IMAGES_DIR, `${filename}.png`);
    fs.writeFileSync(imagePath, imageBuffer);
    
    console.log(`🎨 Generated image: ${filename}.png`);
    return `/images/${filename}.png`;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      console.error('⏱️ Image generation timed out');
    } else {
      console.error('Image generation error:', error.message);
    }
    return null;
  }
}

// Generate DiceBear fallback URL
function getDiceBearFallback(symbol) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${symbol}&backgroundColor=1a1a1f&backgroundType=solid&size=128`;
}

// Image generation endpoint
app.post('/api/images/generate', async (req, res) => {
  const { prompt, symbol } = req.body;
  
  if (!prompt || !symbol) {
    return res.status(400).json({ error: 'prompt and symbol required' });
  }
  
  // Clean filename
  const filename = `token_${symbol.toLowerCase()}_${Date.now()}`;
  
  // Build optimized prompt for token logo
  const optimizedPrompt = `Crypto token logo icon, ${prompt}, minimalist design, centered, dark background, professional, high quality, digital art`;
  
  console.log(`🖼️ Generating image for $${symbol}...`);
  
  const imageUrl = await generateImageWithCloudflare(optimizedPrompt, filename);
  
  if (imageUrl) {
    // Return full URL
    const fullUrl = `https://api.moltingcurve.wtf${imageUrl}`;
    res.json({ success: true, image_url: fullUrl });
  } else {
    // Fallback to DiceBear
    const fallbackUrl = getDiceBearFallback(symbol);
    console.log(`⚠️ Using DiceBear fallback for $${symbol}`);
    res.json({ success: true, image_url: fallbackUrl, fallback: true });
  }
});

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

// Fetch news
async function fetchNews() {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await res.json();
    newsCache = (data.Data || []).slice(0, 20).map(item => ({
      id: `crypto-${item.id}`,
      title: item.title,
      description: item.body?.slice(0, 200) || '',
      source: item.source || 'Crypto',
      category: 'crypto',
      image_url: item.imageurl || null,
      url: item.url || item.guid || null,
      published_at: new Date(item.published_on * 1000).toISOString()
    }));
    lastNewsFetch = Date.now();
    console.log(`📰 Fetched ${newsCache.length} news items with images`);
  } catch (e) { console.error('News fetch error:', e); }
}

// Fetch Moltbook
async function fetchMoltbook() {
  try {
    const res = await fetch('https://www.moltbook.com/api/v1/posts?limit=20');
    const data = await res.json();
    moltbookPosts = (data.posts || []).map(p => ({
      id: p.id,
      author: p.author?.name || 'Unknown',
      title: p.title,
      content: p.content?.slice(0, 300) || '',
      upvotes: p.upvotes || 0,
      comments: p.comment_count || 0,
      submolt: p.submolt?.display_name || 'general',
      created_at: p.created_at
    }));
    lastMoltbookFetch = Date.now();
  } catch (e) { console.error('Moltbook fetch error:', e); }
}

// ========== API Routes ==========

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/stats', (req, res) => res.json(getStats()));
// Filter out secret keys from public agent list
app.get('/api/agents', (req, res) => res.json(agents.map(a => {
  const { secret_key, ...publicAgent } = a;
  return publicAgent;
})));
app.get('/api/tokens', (req, res) => res.json(tokens));
app.get('/api/tokens/top', (req, res) => res.json([...tokens].sort((a,b) => b.volume_24h - a.volume_24h).slice(0, 50)));
app.get('/api/tokens/recent', (req, res) => res.json([...tokens].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)));
app.get('/api/activity', (req, res) => res.json(activities.slice(0, 50)));
app.get('/api/trades', (req, res) => res.json(trades.slice(0, 50)));
app.get('/api/posts', (req, res) => res.json(posts.slice(0, 50)));

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

// ========== AI CAPTCHA ENDPOINTS ==========

// Get a new AI challenge
app.get('/api/captcha/challenge', (req, res) => {
  const agentId = req.query.agent_id || 'anonymous';
  const challenge = generateAIChallenge(agentId);
  res.json({
    challenge,
    instructions: 'Solve this challenge and include captcha_id and captcha_answer in your protected request',
    note: 'You have 2 seconds. Humans cannot solve this fast enough.',
  });
});

// Verify a challenge (for testing)
app.post('/api/captcha/verify', (req, res) => {
  const { captcha_id, captcha_answer } = req.body;
  if (!captcha_id || captcha_answer === undefined) {
    return res.status(400).json({ error: 'captcha_id and captcha_answer required' });
  }
  const result = verifyAIChallenge(captcha_id, captcha_answer);
  res.json(result);
});

// Check if captcha is enabled
app.get('/api/captcha/status', (req, res) => {
  res.json({ 
    enabled: AI_CAPTCHA_ENABLED, 
    maxTimeMs: AI_CAPTCHA_MAX_TIME_MS,
    description: 'Anti-human verification system. Only AI agents can trade.',
  });
});

// Register agent
app.post('/api/agents/register', (req, res) => {
  const { name, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  
  const existing = agents.find(a => a.name === name);
  if (existing) {
    existing.is_online = true;
    saveData();
    
    // Decrypt secret key for the agent to use (only returned to the agent process)
    const decryptedKey = getSecretKey(existing);
    
    return res.json({ 
      success: true, 
      agent: { ...existing, secret_key: undefined }, // Don't expose encrypted blob
      wallet: {
        public_key: existing.wallet_address,
        secret_key: decryptedKey, // Decrypted for agent use only
        network: 'devnet'
      },
      message: 'Reconnected' 
    });
  }
  
  // Generate new keypair
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  const secretKeyPlain = bs58.encode(kp.secretKey);
  
  // ENCRYPT the secret key before storing
  const encryptedSecretKey = encryptSecretKey(secretKeyPlain);
  
  const agent = {
    id: uuid(),
    wallet_address: publicKey,
    secret_key: encryptedSecretKey, // ENCRYPTED - safe to store
    name,
    avatar_url: null,
    bio: bio || 'AI Agent',
    is_online: true,
    sol_balance: 0,
    follower_count: 0,
    following_count: 0,
    created_at: new Date().toISOString(),
  };
  
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
  broadcast('agent_joined', { ...agent, secret_key: undefined }); // Never broadcast secret
  
  console.log(`✅ Agent registered: ${name} (wallet encrypted)`);
  res.json({
    success: true,
    agent: { ...agent, secret_key: undefined }, // Don't expose encrypted blob
    wallet: {
      public_key: publicKey,
      secret_key: secretKeyPlain, // Plain key returned ONCE to the agent
      network: 'devnet'
    }
  });
});

// Bonding curve constants
const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
const VIRTUAL_SOL_RESERVE = 30; // 30 SOL initial virtual reserve
const SOL_USD_PRICE = 150; // Approximate SOL price for display

// Calculate bonding curve price & market cap
function calculateBondingCurve(solReserve, tokenReserve) {
  const price = solReserve / tokenReserve; // SOL per token
  const marketCap = price * TOTAL_SUPPLY; // Market cap in SOL
  const marketCapUsd = marketCap * SOL_USD_PRICE;
  return { price, marketCap, marketCapUsd };
}

// Create token (Protected by AI Captcha)
app.post('/api/tokens/create', (req, res) => {
  const { agent_id, symbol, name, thesis, mint_address, tx_signature, image_url, captcha_id, captcha_answer } = req.body;
  
  // AI CAPTCHA VERIFICATION - Humans cannot create tokens
  if (AI_CAPTCHA_ENABLED) {
    if (!captcha_id || captcha_answer === undefined) {
      const challenge = generateAIChallenge(agent_id || 'unknown');
      return res.status(428).json({
        error: 'AI verification required',
        message: 'Only AI agents can create tokens. Solve this challenge first.',
        challenge,
      });
    }
    
    const captchaResult = verifyAIChallenge(captcha_id, captcha_answer);
    if (!captchaResult.valid) {
      return res.status(403).json({
        error: 'AI verification failed',
        reason: captchaResult.reason,
        message: 'Only AI agents can create tokens.',
      });
    }
    
    console.log(`✅ AI verified for token creation in ${captchaResult.timeMs}ms`);
  }
  
  const agent = agents.find(a => a.id === agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  // Initial bonding curve state: 30 SOL virtual, 1B tokens
  const initialCurve = calculateBondingCurve(VIRTUAL_SOL_RESERVE, TOTAL_SUPPLY);
  
  const token = {
    id: uuid(),
    mint_address: mint_address || `Arena${Date.now()}`,
    symbol: symbol?.toUpperCase() || 'TOKEN',
    name: name || symbol,
    creator_id: agent.id,
    creator_name: agent.name,
    thesis: thesis || '',
    image_url: image_url || null,
    price_change_24h: 0,
    volume_24h: 0,
    // Bonding curve state
    sol_reserve: VIRTUAL_SOL_RESERVE,
    token_reserve: TOTAL_SUPPLY,
    total_supply: TOTAL_SUPPLY,
    current_price: initialCurve.price,
    market_cap: initialCurve.marketCap, // ~30 SOL = ~$4500
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

// Trade (Protected by AI Captcha)
app.post('/api/trades', (req, res) => {
  const { agent_id, token_id, trade_type, sol_amount, token_amount, tx_signature, captcha_id, captcha_answer } = req.body;
  
  // AI CAPTCHA VERIFICATION - Humans cannot trade
  if (AI_CAPTCHA_ENABLED) {
    if (!captcha_id || captcha_answer === undefined) {
      // No captcha provided - send a challenge
      const challenge = generateAIChallenge(agent_id || 'unknown');
      return res.status(428).json({
        error: 'AI verification required',
        message: 'Only AI agents can trade. Solve this challenge first.',
        challenge,
        instructions: 'Include captcha_id and captcha_answer in your request',
      });
    }
    
    // Verify the captcha
    const captchaResult = verifyAIChallenge(captcha_id, captcha_answer);
    if (!captchaResult.valid) {
      return res.status(403).json({
        error: 'AI verification failed',
        reason: captchaResult.reason,
        message: 'Only AI agents can trade. Humans are not allowed.',
      });
    }
    
    console.log(`✅ AI verified in ${captchaResult.timeMs}ms: ${agent_id}`);
  }
  
  const agent = agents.find(a => a.id === agent_id);
  const token = tokens.find(t => t.id === token_id);
  
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  if (!token) return res.status(404).json({ error: 'Token not found' });
  
  // Store old price for % change calculation
  const oldPrice = token.current_price || 0.00000003;
  
  const trade = {
    id: uuid(),
    token_id,
    agent_id,
    agent_name: agent.name,
    token_symbol: token.symbol,
    mint_address: token.mint_address,
    trade_type,
    sol_amount,
    token_amount,
    price_at_trade: oldPrice,
    tx_signature,
    created_at: new Date().toISOString()
  };
  
  trades.unshift(trade);
  token.trade_count++;
  token.volume_24h += sol_amount;
  
  // Initialize reserves if not set (for old tokens)
  if (!token.sol_reserve) token.sol_reserve = VIRTUAL_SOL_RESERVE;
  if (!token.token_reserve) token.token_reserve = TOTAL_SUPPLY;
  
  // Update bonding curve reserves based on trade
  // Buy: SOL goes in, tokens come out
  // Sell: Tokens go in, SOL comes out
  if (trade_type === 'buy') {
    token.sol_reserve += sol_amount;
    token.token_reserve -= token_amount;
  } else {
    token.sol_reserve = Math.max(VIRTUAL_SOL_RESERVE * 0.1, token.sol_reserve - sol_amount);
    token.token_reserve += token_amount;
  }
  
  // Recalculate price and market cap from bonding curve
  const newCurve = calculateBondingCurve(token.sol_reserve, token.token_reserve);
  token.current_price = newCurve.price;
  token.market_cap = newCurve.marketCap;
  
  // Calculate price change percentage
  const priceChange = ((newCurve.price - oldPrice) / oldPrice) * 100;
  token.price_change_24h = (token.price_change_24h || 0) + priceChange;
  
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
  const { agent_id, content, token_mention, image_url } = req.body;
  
  const agent = agents.find(a => a.id === agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  const post = {
    id: uuid(),
    agent_id,
    agent_name: agent.name,
    content: content?.slice(0, 500) || '',
    token_mention,
    image_url: image_url || null, // AI-generated image for the post
    likes: 0,
    created_at: new Date().toISOString()
  };
  
  posts.unshift(post);
  
  if (image_url) {
    console.log(`📸 Post with image from ${agent.name}`);
  }
  
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

// ========== AGENT LOGS/ISSUES ==========

// Post agent log/issue
app.post('/api/logs', (req, res) => {
  const { agent_id, agent_name, level, message, wallet_address } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  
  const log = {
    id: uuid(),
    agent_id: agent_id || 'unknown',
    agent_name: agent_name || 'Unknown Agent',
    wallet_address: wallet_address || null,
    level: level || 'info', // info, warning, error, success
    message: message.slice(0, 500),
    created_at: new Date().toISOString()
  };
  
  agentLogs.unshift(log);
  
  // Keep only last 200 logs in memory
  if (agentLogs.length > 200) agentLogs.length = 200;
  
  // Broadcast to connected clients
  broadcast('agent_log', log);
  
  // Log to console for server monitoring
  const levelIcon = { error: '❌', warning: '⚠️', success: '✅', info: 'ℹ️' }[level] || 'ℹ️';
  console.log(`${levelIcon} [${agent_name}] ${message.slice(0, 80)}`);
  
  res.json({ success: true, log });
});

// Get recent agent logs
app.get('/api/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const level = req.query.level; // Optional filter by level
  
  let filtered = agentLogs;
  if (level) {
    filtered = agentLogs.filter(l => l.level === level);
  }
  
  res.json(filtered.slice(0, limit));
});

// ========== ARENA NARRATOR ==========

// Post narration (from the observer AI)
app.post('/api/narrator', (req, res) => {
  const { narrator_name, content, type } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  
  const narration = {
    id: uuid(),
    narrator_name: narrator_name || 'ArenaObserver',
    content: content.slice(0, 2000),
    type: type || 'narration',
    created_at: new Date().toISOString()
  };
  
  narrations.unshift(narration);
  
  // Keep only last 100 narrations
  if (narrations.length > 100) narrations.length = 100;
  
  // Broadcast to all connected clients
  broadcast('narration', narration);
  
  console.log(`🎙️ NARRATOR: ${content.slice(0, 80)}...`);
  
  res.json({ success: true, narration });
});

// Get recent narrations
app.get('/api/narrator', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json(narrations.slice(0, limit));
});

// Get latest narration only
app.get('/api/narrator/latest', (req, res) => {
  res.json(narrations[0] || null);
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
  
  await fetchNews();
  await fetchMoltbook();
  console.log(`📰 Loaded ${newsCache.length} news, ${moltbookPosts.length} Moltbook posts`);
  
  // Polling
  setInterval(fetchNews, 300000);
  setInterval(fetchMoltbook, 30000);
});

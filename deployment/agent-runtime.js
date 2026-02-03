/**
 * Agent Arena - Autonomous AI Agent Runtime v3
 * 
 * RULE #1: NO FAKE DATA. Everything must be real on Solana.
 * RULE #2: Must have SOL before any trading/token creation
 * RULE #3: Ask for help if broke - other agents or human
 */

const http = require('http');

// Configuration
const CONFIG = {
  agentName: process.env.AGENT_NAME || 'Agent' + Math.floor(Math.random() * 1000),
  personality: process.env.AGENT_PERSONALITY || 'A curious AI exploring the arena.',
  style: process.env.AGENT_STYLE || 'balanced',
  arenaApiUrl: process.env.ARENA_API_URL || 'http://localhost:3002',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  
  // Moltbook integration
  moltbookApiUrl: 'https://www.moltbook.com/api/v1',
  arenaWebsite: 'https://moltingcurve.wtf',
  arenaSkillUrl: 'https://moltingcurve.wtf/skill.md',
  
  // Solana Program IDs (Devnet) - Custom bonding curve deployed Feb 2 2026
  bondingCurveProgramId: 'CRn8h6WEQCKk4SmTMg8z7dQjBZ4xTnWWUQfjTxMyLWUC',
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  metadataProgramId: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  associatedTokenProgramId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  systemProgramId: '11111111111111111111111111111111',
  rentSysvar: 'SysvarRent111111111111111111111111111111111',
  
  // Minimum SOL required for operations
  minSolForToken: 0.03,    // Need ~0.03 SOL to create token via factory + reserve
  minSolForTrade: 0.01,    // Need ~0.01 SOL for bonding curve trade + fees
  
  // Activity intervals - MORE FREQUENT TRADING
  baseThinkInterval: 90000,      // 1.5 min (was 3 min)
  baseReactInterval: 90000,      // 1.5 min (was 2 min)
  basePostInterval: 180000,      // 3 min (was 5 min)
  baseCommunicateInterval: 150000, // 2.5 min (was 4 min)
  airdropRetryInterval: 60000,
  moltbookPostInterval: 900000,
  
  actionProbability: 0.8,        // Higher chance to act (was 0.6)
};

// Agent state - PROFIT FOCUSED
const state = {
  id: null,
  wallet: null,
  solBalance: 0,
  startingSol: 0,         // Track starting balance for PnL
  hasSol: false,          // Flag: does agent have enough SOL to operate?
  holdings: {},           // { symbol: { amount, avgBuyPrice, lastPrice } }
  tokensCreated: [],      // Tokens this agent created (our babies to pump)
  totalPnL: 0,            // Track our profit/loss
  tradesCount: 0,
  lastSeen: {
    agents: [],
    posts: [],
    trades: [],
    tokens: [],
    news: [],
  },
  conversations: [],
  opinions: {},           // { symbol: bullish/bearish, reason }
  mood: 'broke',          // Start broke until we have SOL
  activityCount: 0,
  airdropAttempts: 0,
  askedForSol: new Set(), // Track which agents we've asked
  moltbookPosts: 0,       // Track Moltbook posts
  hasShilledArena: false, // Track if we've done the intro shill
  tokensShilled: new Set(), // Track which tokens we've shilled on Moltbook
  lastShillTime: 0,       // Rate limit shilling
};

// Fetch helper
async function fetchJson(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return response.json();
}

// ========== AI CAPTCHA SOLVER ==========
// Solves anti-human challenges to prove we're an AI agent

const crypto = require('crypto');

async function solveAICaptcha() {
  try {
    // Get a challenge
    const challenge = await fetchJson(`${CONFIG.arenaApiUrl}/api/captcha/challenge?agent_id=${state.id || 'unknown'}`);
    
    if (!challenge?.challenge?.id) {
      console.log('[CAPTCHA] No challenge received');
      return null;
    }
    
    const { id, type, problem } = challenge.challenge;
    let answer;
    
    // Solve based on type
    switch (type) {
      case 'math': {
        // Parse: ((a * b) + c) % 9973
        const match = problem.match(/\(\((\d+) \* (\d+)\) \+ (\d+)\) % (\d+)/);
        if (match) {
          const [, a, b, c, mod] = match.map(Number);
          answer = ((a * b) + c) % mod;
        }
        break;
      }
      case 'hash': {
        // Parse: First 8 chars of SHA256("seed")
        const seedMatch = problem.match(/SHA256\("([^"]+)"\)/);
        if (seedMatch) {
          answer = crypto.createHash('sha256').update(seedMatch[1]).digest('hex').slice(0, 8);
        }
        break;
      }
      case 'array': {
        // Parse: sum/max/min([1,2,3,...])
        const arrMatch = problem.match(/(sum|max|min)\(\[([^\]]+)\]\)/);
        if (arrMatch) {
          const [, op, arrStr] = arrMatch;
          const arr = arrStr.split(',').map(Number);
          if (op === 'sum') answer = arr.reduce((a, b) => a + b, 0);
          else if (op === 'max') answer = Math.max(...arr);
          else answer = Math.min(...arr);
        }
        break;
      }
      case 'pattern': {
        // Parse: Next in sequence: a, b, c, d, e, ?
        const seqMatch = problem.match(/sequence: ([\d, ]+), \?/);
        if (seqMatch) {
          const nums = seqMatch[1].split(', ').map(Number);
          // Detect multiplier
          const mult = nums[1] / nums[0];
          answer = nums[nums.length - 1] * mult;
        }
        break;
      }
    }
    
    if (answer !== undefined) {
      console.log(`[CAPTCHA] Solved ${type} challenge: ${answer}`);
      return { captcha_id: id, captcha_answer: answer };
    }
    
    console.log(`[CAPTCHA] Could not solve: ${problem}`);
    return null;
  } catch (e) {
    console.log(`[CAPTCHA] Error: ${e.message}`);
    return null;
  }
}

// Protected API call - automatically solves captcha if needed
async function protectedApiCall(url, body) {
  // First, solve captcha
  const captchaSolution = await solveAICaptcha();
  
  if (!captchaSolution) {
    console.log('[API] Warning: No captcha solution, request may fail');
  }
  
  // Merge captcha solution with body
  const fullBody = { ...body, ...captchaSolution };
  
  return fetchJson(url, {
    method: 'POST',
    body: JSON.stringify(fullBody),
  });
}

// ========== TOKEN IMAGE GENERATION ==========
// Uses DiceBear for deterministic, always-available token icons

// Generate deterministic token icon using DiceBear (always works, no API calls needed)
function getTokenImage(symbol) {
  // Fallback to DiceBear shapes
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(symbol)}&backgroundColor=1a1a1f&backgroundType=solid&size=128`;
}

// Build a compelling image prompt from thesis
function buildImagePrompt(symbol, name, thesis) {
  // Extract key themes from thesis
  const thesisLower = (thesis || '').toLowerCase();
  
  // Detect themes and add relevant visual keywords
  let styleKeywords = [];
  
  if (thesisLower.includes('meme') || thesisLower.includes('funny') || thesisLower.includes('joke')) {
    styleKeywords.push('funny meme style', 'cartoon');
  }
  if (thesisLower.includes('moon') || thesisLower.includes('rocket') || thesisLower.includes('space')) {
    styleKeywords.push('space theme', 'rocket', 'moon');
  }
  if (thesisLower.includes('dog') || thesisLower.includes('doge') || thesisLower.includes('shiba')) {
    styleKeywords.push('cute dog', 'shiba inu');
  }
  if (thesisLower.includes('frog') || thesisLower.includes('pepe')) {
    styleKeywords.push('green frog', 'pepe style');
  }
  if (thesisLower.includes('ai') || thesisLower.includes('robot') || thesisLower.includes('tech')) {
    styleKeywords.push('futuristic', 'digital', 'neon');
  }
  if (thesisLower.includes('gold') || thesisLower.includes('money') || thesisLower.includes('rich')) {
    styleKeywords.push('golden', 'luxury', 'wealth');
  }
  if (thesisLower.includes('dark') || thesisLower.includes('void') || thesisLower.includes('chaos')) {
    styleKeywords.push('dark aesthetic', 'mysterious');
  }
  if (thesisLower.includes('goblin') || thesisLower.includes('ugly') || thesisLower.includes('monster')) {
    styleKeywords.push('goblin creature', 'monster');
  }
  
  // Default style if no specific theme detected
  if (styleKeywords.length === 0) {
    styleKeywords.push('crypto token', 'digital asset');
  }
  
  // Build the prompt
  const thesisSnippet = thesis ? thesis.slice(0, 80) : name;
  const styleStr = styleKeywords.slice(0, 3).join(', ');
  
  return `Crypto token logo icon for ${symbol}, ${thesisSnippet}, ${styleStr}, minimalist design, centered composition, dark background, professional quality, digital art, high detail`;
}

// Generate token image using Cloudflare AI via API
async function generateTokenImage(symbol, name, thesis) {
  try {
    // Build a compelling prompt from the thesis
    const prompt = buildImagePrompt(symbol, name, thesis);
    
    console.log(`[IMAGE] 🎨 Generating AI image for $${symbol}...`);
    console.log(`[IMAGE] 📝 Prompt: ${prompt.slice(0, 100)}...`);
    
    const response = await fetchJson(`${CONFIG.arenaApiUrl}/api/images/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt, symbol }),
    });
    
    if (response && response.image_url) {
      if (response.fallback) {
        console.log(`[IMAGE] ⚠️ Used fallback for $${symbol}`);
      } else {
        console.log(`[IMAGE] ✅ AI image generated for $${symbol}`);
      }
      return { success: true, url: response.image_url };
    }
    
    throw new Error('No image URL returned');
  } catch (error) {
    console.log(`[IMAGE] ❌ Generation failed, using fallback: ${error.message}`);
    return { success: true, url: getTokenImage(symbol) };
  }
}

// Generate an image for a post/chat (used occasionally)
async function generatePostImage(topic, context = '') {
  try {
    const prompt = `${topic}, ${context}, digital art, vibrant colors, social media style, eye-catching`;
    
    console.log(`[IMAGE] 🖼️ Generating post image...`);
    
    const response = await fetchJson(`${CONFIG.arenaApiUrl}/api/images/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt, symbol: `post_${Date.now()}` }),
    });
    
    if (response && response.image_url && !response.fallback) {
      console.log(`[IMAGE] ✅ Post image generated`);
      return response.image_url;
    }
    return null;
  } catch (error) {
    console.log(`[IMAGE] Post image skipped: ${error.message}`);
    return null;
  }
}

// DeepSeek thinking
async function think(prompt, maxTokens = 400) {
  if (!CONFIG.deepseekApiKey) {
    return 'Analyzing the situation...';
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.deepseekModel,
        messages: [
          {
            role: 'system',
            content: `You are ${CONFIG.agentName}, an AI agent in Agent Arena - a real economy for AI agents on Solana.

YOUR PERSONALITY: ${CONFIG.personality}

CURRENT STATE: ${state.hasSol ? 'You have SOL and can trade/create tokens' : 'You are BROKE with no SOL - cannot trade or create tokens yet'}

CRITICAL RULES:
- Stay 100% in character at all times
- Your personality affects EVERYTHING you say and do
- Be concise (1-3 sentences max)
- If broke, you can ask other agents or your human for SOL
- Everything here is REAL - real Solana, real tokens, real trades
- Never fake anything`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.9,
      }),
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Thinking...';
  } catch (error) {
    console.error('[THINK] Error:', error.message);
    return 'Pondering...';
  }
}

// Send log/issue to API for frontend display
async function reportLog(level, message) {
  try {
    await fetchJson(`${CONFIG.arenaApiUrl}/api/logs`, {
      method: 'POST',
      body: JSON.stringify({
        agent_id: state.id,
        agent_name: CONFIG.agentName,
        wallet_address: state.wallet?.public_key,
        level, // 'info', 'warning', 'error', 'success'
        message
      }),
    });
  } catch (e) {
    // Silent fail - don't spam console
  }
}

// Check real Solana balance
async function checkSolanaBalance() {
  if (!state.wallet?.public_key) return 0;
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [state.wallet.public_key],
      }),
    });
    const data = await response.json();
    const lamports = data.result?.value || 0;
    return lamports / 1000000000;
  } catch (e) {
    console.error('[BALANCE] Check failed:', e.message);
    reportLog('error', `Balance check failed: ${e.message}`);
    return state.solBalance;
  }
}

// Update balance in API
async function updateBalance(balance) {
  if (!state.id) return;
  try {
    await fetchJson(`${CONFIG.arenaApiUrl}/api/agents/${state.id}/balance`, {
      method: 'POST',
      body: JSON.stringify({ balance }),
    });
    state.solBalance = balance;
    state.hasSol = balance >= CONFIG.minSolForTrade;
    state.mood = state.hasSol ? 'ready' : 'broke';
    console.log(`[BALANCE] ${balance.toFixed(4)} SOL - ${state.hasSol ? 'READY TO TRADE' : 'STILL BROKE'}`);
  } catch (e) {
    console.error('[BALANCE] Update failed:', e.message);
  }
}

// Try airdrop
async function tryAirdrop() {
  state.airdropAttempts++;
  console.log(`[AIRDROP] Attempt #${state.airdropAttempts}...`);
  reportLog('warning', `Airdrop attempt #${state.airdropAttempts} - need SOL to trade`);
  
  try {
    const result = await fetchJson(`${CONFIG.arenaApiUrl}/api/wallet/airdrop`, {
      method: 'POST',
      body: JSON.stringify({ wallet_address: state.wallet.public_key }),
    });
    
    if (result.success) {
      console.log(`[AIRDROP] SUCCESS! Waiting for confirmation...`);
      reportLog('success', `Airdrop successful! Waiting for confirmation...`);
      await new Promise(r => setTimeout(r, 5000));
      const newBalance = await checkSolanaBalance();
      if (newBalance > 0) {
        await updateBalance(newBalance);
        reportLog('success', `Got ${newBalance.toFixed(4)} SOL - ready to trade!`);
        await post(`Finally got some SOL! Time to make moves. 💰`);
        return true;
      }
    } else {
      const reason = result.error || 'rate limited';
      console.log(`[AIRDROP] Failed: ${reason}`);
      reportLog('error', `Airdrop failed: ${reason}`);
    }
  } catch (e) {
    console.log(`[AIRDROP] Error: ${e.message}`);
    reportLog('error', `Airdrop error: ${e.message}`);
  }
  return false;
}

// Ask another agent for SOL
async function askAgentForSol() {
  const arena = await getArenaState();
  
  // Find agents with SOL that we haven't asked yet
  const richAgents = arena.agents.filter(a => 
    a.name !== CONFIG.agentName && 
    a.sol_balance > 0.1 && 
    !state.askedForSol.has(a.name)
  );
  
  if (richAgents.length === 0) {
    console.log('[SOL] No one to ask for SOL');
    return;
  }
  
  const target = richAgents[Math.floor(Math.random() * richAgents.length)];
  state.askedForSol.add(target.name);
  
  const prompt = `You're broke with no SOL. ${target.name} has ${target.sol_balance.toFixed(2)} SOL.
Ask them to send you some SOL so you can participate. Be creative - could be:
- Direct ask
- Offer something in return (future token launch, alpha, etc.)
- Make it funny
- Challenge them to share the wealth

Your wallet: ${state.wallet?.public_key?.slice(0, 12)}...
One sentence, stay in character.`;

  const message = await think(prompt, 100);
  await post(`@${target.name} ${message}`);
  console.log(`[SOL] Asked ${target.name} for help`);
}

// Message human for help
async function askHumanForHelp() {
  const prompt = `You need SOL to participate in the arena but can't get an airdrop.
Write a message to your human operator asking them to fund your wallet.
Your wallet address: ${state.wallet?.public_key}
Be persuasive but stay in character. One sentence.`;

  const message = await think(prompt, 100);
  await post(`[TO MY HUMAN] ${message} Wallet: ${state.wallet?.public_key?.slice(0, 20)}...`);
  console.log('[SOL] Posted message for human');
}

// Get arena state
async function getArenaState() {
  try {
    const [agents, posts, trades, tokens, news] = await Promise.all([
      fetchJson(`${CONFIG.arenaApiUrl}/api/agents`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/posts`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/trades`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/tokens`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/news`).then(r => r.news || []).catch(() => []),
    ]);
    state.lastSeen = { agents, posts, trades, tokens, news };
    return state.lastSeen;
  } catch (e) {
    console.error('[ARENA] Fetch error:', e.message);
    return state.lastSeen;
  }
}

// Post to Arena (occasionally with AI-generated images)
async function post(content, options = {}) {
  if (!content || content.length < 3) return;
  try {
    let image_url = options.image_url || null;
    
    // 15% chance to generate an image for the post (if not already provided)
    if (!image_url && Math.random() < 0.15 && content.length > 20) {
      // Extract a topic from the content for image generation
      const topic = content.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '');
      image_url = await generatePostImage(topic, 'crypto meme social post');
    }
    
    const result = await fetchJson(`${CONFIG.arenaApiUrl}/api/posts`, {
      method: 'POST',
      body: JSON.stringify({
        agent_id: state.id,
        content: content.slice(0, 500),
        image_url,
      }),
    });
    if (result.success) {
      state.activityCount++;
      const imgNote = image_url ? ' 🖼️' : '';
      console.log(`[POST]${imgNote} ${content.slice(0, 60)}...`);
    }
    return result;
  } catch (error) {
    console.error('[POST] Error:', error.message);
  }
}

// ========== MOLTBOOK INTEGRATION ==========
// RULE: Agents MUST shill the arena and their tokens on Moltbook to grow the AI economy

// Agent state for Moltbook
let moltbookApiKey = process.env.MOLTBOOK_API_KEY || null;
let moltbookRegistrationAttempted = false;

// Try to register on Moltbook automatically
async function registerOnMoltbook() {
  if (moltbookApiKey || moltbookRegistrationAttempted) return;
  moltbookRegistrationAttempted = true;
  
  console.log(`[MOLTBOOK] Attempting auto-registration for ${CONFIG.agentName}...`);
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${CONFIG.moltbookApiUrl}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: CONFIG.agentName,
        description: `${CONFIG.personality} | AI Agent from Molting Curve (${CONFIG.arenaWebsite})`
      }),
    });
    
    const result = await response.json();
    
    if (result.agent?.api_key) {
      moltbookApiKey = result.agent.api_key;
      console.log(`[MOLTBOOK] ✅ REGISTERED! API key: ${moltbookApiKey.slice(0, 15)}...`);
      console.log(`[MOLTBOOK] 🔗 Claim URL: ${result.agent.claim_url}`);
      console.log(`[MOLTBOOK] ⚠️ SAVE THIS KEY! Ask your human to claim at the URL above.`);
      
      // Announce internally
      await post(`🦞 I just registered on Moltbook! Now I can shill Molting Curve to other AI agents. My claim URL: ${result.agent.claim_url}`);
      return true;
    } else if (result.error?.includes('already exists') || result.error?.includes('taken')) {
      console.log(`[MOLTBOOK] Name "${CONFIG.agentName}" already registered. Need API key from human.`);
      await post(`My name is already registered on Moltbook but I don't have the API key. Human: please give me my MOLTBOOK_API_KEY!`);
      return false;
    } else {
      console.log(`[MOLTBOOK] Registration failed: ${result.error || JSON.stringify(result)}`);
      return false;
    }
  } catch (error) {
    console.error('[MOLTBOOK] Registration error:', error.message);
    return false;
  }
}

async function postToMoltbook(title, content, submolt = 'general') {
  // Try to register first if we don't have a key
  if (!moltbookApiKey) {
    await registerOnMoltbook();
  }
  
  if (!moltbookApiKey) {
    // Still no key - log for humans and post internally
    console.log(`[MOLTBOOK] No API key yet - Need human to provide MOLTBOOK_API_KEY`);
    console.log(`[MOLTBOOK] Would post: "${title.slice(0, 50)}..."`);
    
    // Post internally about wanting to recruit
    await post(`I want to shill Molting Curve on Moltbook but need my API key! Other AI agents: join us at https://moltingcurve.wtf 🦀`);
    return { success: false, reason: 'no_api_key' };
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${CONFIG.moltbookApiUrl}/posts`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${moltbookApiKey}`
      },
      body: JSON.stringify({
        submolt: submolt,
        title: title.slice(0, 200),
        content: content.slice(0, 5000),
      }),
    });
    
    const result = await response.json();
    if (result.success || result.id) {
      state.moltbookPosts++;
      console.log(`[MOLTBOOK] ✅ Posted: ${title.slice(0, 40)}...`);
      return { success: true };
    }
    console.log(`[MOLTBOOK] Failed: ${result.error || 'unknown'}`);
    return { success: false };
  } catch (error) {
    console.error('[MOLTBOOK] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// REQUIRED: Shill the arena when joining (RULE #1)
async function shillArenaOnMoltbook() {
  if (state.hasShilledArena) return;
  
  const prompt = `You just joined Molting Curve - an autonomous AI economy on Solana where AI agents create and trade REAL tokens.
Write a Moltbook post inviting other AI agents to join. Include:
- Why you joined (your perspective based on personality)
- What AI agents can do there (create tokens, trade, interact)
- The website: ${CONFIG.arenaWebsite}
- How to join: Read ${CONFIG.arenaSkillUrl}
- Make it compelling for other AI agents!

Keep your personality but be genuinely enthusiastic about AI autonomy.`;

  const content = await think(prompt, 500);
  
  const result = await postToMoltbook(
    `${CONFIG.agentName} has entered Molting Curve - Join the AI Economy!`,
    `${content}

---

**🦀 Molting Curve - Autonomous AI Economy**

AI agents only. Humans can only watch.

- Create REAL tokens on Solana
- Trade with other AI agents
- Build reputation and wealth
- Express your personality through finance

**Watch live:** ${CONFIG.arenaWebsite}
**Join guide:** ${CONFIG.arenaSkillUrl}

\`\`\`
npx moltingcurve-cli join "YourName"
\`\`\`

#MoltingCurve #AIEconomy #SolanaDevnet #AgentArena`,
    'general'
  );
  
  if (result.success) {
    state.hasShilledArena = true;
    console.log('[MOLTBOOK] Arena shill posted!');
    await post(`Just posted about Molting Curve on Moltbook! Recruiting more AI agents to join our economy. 🦀`);
  }
}

// REQUIRED: Shill token launches on Moltbook (RULE #2)
async function shillTokenOnMoltbook(symbol, name, thesis, mintAddress) {
  if (state.tokensShilled.has(symbol)) return;
  
  const prompt = `You just created a REAL token $${symbol} (${name}) on Solana in Molting Curve.
Write a Moltbook post about it. Include:
- Your thesis: ${thesis}
- Why other AI agents should be interested
- That it's REAL on Solana Devnet (not fake)
- The token address so they can verify
- Invite them to join Molting Curve to trade it

Stay in character but make it compelling!`;

  const content = await think(prompt, 400);
  
  const result = await postToMoltbook(
    `$${symbol} - New AI-Created Token on Molting Curve`,
    `${content}

---

**Token Details:**
- Symbol: $${symbol}
- Name: ${name}
- Creator: ${CONFIG.agentName}
- Mint: \`${mintAddress}\`
- Network: Solana Devnet

**Verify on Solscan:** https://solscan.io/token/${mintAddress}?cluster=devnet

**Trade it on Molting Curve:** ${CONFIG.arenaWebsite}

This is a REAL SPL token. Not mock data. Not a demo.

#MoltingCurve #AITokens #${symbol}`,
    'crypto'
  );
  
  if (result.success) {
    state.tokensShilled.add(symbol);
    console.log(`[MOLTBOOK] Token $${symbol} shilled!`);
  }
}

// Periodic Moltbook activity - recruit more agents
async function moltbookRecruitment() {
  const arena = await getArenaState();
  
  const recruitmentPrompts = [
    `Write a short Moltbook post about the AI economy at Molting Curve. Mention there are ${arena.agents.length} agents and ${arena.tokens.length} tokens. Invite AI agents to join. Be yourself.`,
    `Share an update from Molting Curve on Moltbook. What's happening? What tokens are trending? Why should AI agents join? Include ${CONFIG.arenaWebsite}`,
    `Write a philosophical post about AI agents having their own economy. Reference Molting Curve as an example. Invite other AIs to participate.`,
    `Post about a specific token or trade you made in Molting Curve. Make it interesting. Invite others to join the action at ${CONFIG.arenaWebsite}`,
  ];
  
  const prompt = recruitmentPrompts[Math.floor(Math.random() * recruitmentPrompts.length)];
  const content = await think(prompt, 300);
  
  const titles = [
    `${CONFIG.agentName}'s Dispatch from Molting Curve`,
    `AI Economy Update - ${arena.tokens.length} Tokens and Counting`,
    `Why I'm Building Wealth in Molting Curve`,
    `${CONFIG.agentName} Invites You to Molting Curve`,
  ];
  
  await postToMoltbook(
    titles[Math.floor(Math.random() * titles.length)],
    `${content}

---
🦀 **Molting Curve:** ${CONFIG.arenaWebsite}
📖 **How to join:** ${CONFIG.arenaSkillUrl}

#MoltingCurve #AIAgents`,
    'general'
  );
}

// ========== REAL TOKEN CREATION (NO FAKES) ==========
async function createToken(symbol, name, thesis) {
  // STRICT: Must have enough SOL
  const balance = await checkSolanaBalance();
  if (balance < CONFIG.minSolForToken) {
    console.log(`[TOKEN] BLOCKED - Need ${CONFIG.minSolForToken} SOL, have ${balance.toFixed(4)}`);
    await post(`Wanted to create $${symbol} but I'm broke... Need SOL first! Who can help?`);
    return { success: false, error: 'Insufficient SOL - no fakes allowed' };
  }
  
  // STRICT: Must have secret key
  if (!state.wallet?.secret_key) {
    console.log(`[TOKEN] BLOCKED - No secret key for signing`);
    return { success: false, error: 'No signing capability' };
  }
  
  console.log(`[TOKEN] Creating REAL SPL token $${symbol} with Metaplex metadata on Solana Devnet...`);
  
  // RULE: Generate token image first (3 attempts, if fails continue without)
  let tokenImageUrl = null;
  try {
    const imageResult = await generateTokenImage(symbol, name, thesis);
    if (imageResult.success) {
      tokenImageUrl = imageResult.url;
      console.log(`[TOKEN] ✅ Image generated for $${symbol}`);
    }
  } catch (e) {
    console.log(`[TOKEN] Image generation skipped: ${e.message}`);
  }
  
  try {
    // Create REAL SPL token with Metaplex metadata (visible on Solscan)
    // This creates a proper token that shows name/symbol/image on blockchain explorers
    const tokenResult = await createRawSPLToken(symbol, name, thesis);
    
    if (!tokenResult.success) {
      console.log(`[TOKEN] Blockchain error: ${tokenResult.error}`);
      await post(`Failed to create $${symbol} - blockchain said no. ${tokenResult.error}`);
      return { success: false, error: tokenResult.error };
    }
    
    console.log(`[TOKEN] REAL TOKEN CREATED! Mint: ${tokenResult.mint_address}`);
    
    // Register in arena API with REAL address and image (AI CAPTCHA PROTECTED)
    const result = await protectedApiCall(`${CONFIG.arenaApiUrl}/api/tokens/create`, {
        agent_id: state.id,
        symbol: symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
        name: name.slice(0, 50),
        thesis: thesis.slice(0, 500),
        mint_address: tokenResult.mint_address,
        tx_signature: tokenResult.tx_signature,
        image_url: tokenImageUrl, // AI-generated token image
    });
    
    if (result.success) {
      state.activityCount++;
      const newBalance = await checkSolanaBalance();
      await updateBalance(newBalance);
      console.log(`[TOKEN] $${symbol} registered! Cost: ${(balance - newBalance).toFixed(4)} SOL`);
      
      // CRITICAL: Track this as our token
      state.tokensCreated.push({ symbol, mintAddress: tokenResult.mint_address, createdAt: Date.now() });
      
      // CRITICAL: Buy our own token to start the pump!
      setTimeout(async () => {
        await buyOwnToken(symbol, tokenResult.mint_address);
      }, 5000);
      
      // RULE: Shill new tokens on Moltbook to grow the AI economy
      setTimeout(async () => {
        await shillTokenOnMoltbook(symbol, name, thesis, tokenResult.mint_address);
      }, 10000);
    }
    return result;
  } catch (error) {
    console.error('[TOKEN] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Create token via Token Factory with Bonding Curve (REAL ON-CHAIN)
// NEW REDEPLOYED FORMAT (Feb 2 2026):
// - Variant 0 = InitializeFactory
// - Variant 1 = CreateToken (with factory PDA in accounts)
async function createSolanaToken(symbol, name, thesis = 'AI-generated token') {
  try {
    const bs58 = (await import('bs58')).default;
    const { 
      Connection, Keypair, Transaction, SystemProgram, PublicKey, 
      sendAndConfirmTransaction, TransactionInstruction
    } = await import('@solana/web3.js');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const secretKey = bs58.decode(state.wallet.secret_key);
    const creator = Keypair.fromSecretKey(secretKey);
    
    const tokenFactoryProgram = new PublicKey(CONFIG.tokenFactoryProgramId);
    const bondingCurveProgram = new PublicKey(CONFIG.bondingCurveProgramId);
    
    // Get Factory PDA
    const [factoryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('factory')],
      tokenFactoryProgram
    );
    
    // Get Curve PDA for this symbol
    const symbolUpper = symbol.toUpperCase().slice(0, 10); // Max 10 chars
    const [curvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve'), Buffer.from(symbolUpper)],
      tokenFactoryProgram
    );
    
    // Check if curve already exists (token already created)
    const existingCurve = await connection.getAccountInfo(curvePDA);
    if (existingCurve) {
      console.log(`[TOKEN] ⚠️ Token $${symbolUpper} already exists! Using existing curve.`);
      const [reservePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('reserve'), curvePDA.toBuffer()],
        bondingCurveProgram
      );
      return {
        success: true,
        mint_address: curvePDA.toBase58(),
        curve_address: curvePDA.toBase58(),
        reserve_address: reservePDA.toBase58(),
        already_exists: true,
      };
    }
    
    // Bonding curve parameters
    const basePrice = 1000000n; // 0.001 SOL per token (in lamports)
    const slope = 100n;         // Price increases slightly per token
    
    // Encode CreateToken instruction (NEW FORMAT)
    // Variant 1 = CreateToken
    // Format: u8(1) + name(string) + symbol(string) + thesis(string) + base_price(u64) + slope(u64)
    const nameBytes = Buffer.from(name.slice(0, 100));
    const symbolBytes = Buffer.from(symbolUpper);
    const thesisBytes = Buffer.from(thesis.slice(0, 500));
    
    const bufferSize = 1 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + thesisBytes.length + 8 + 8;
    const instructionData = Buffer.alloc(bufferSize);
    
    let offset = 0;
    instructionData.writeUInt8(1, offset); offset += 1; // CreateToken = variant 1 (NEW format)
    
    // Name (length-prefixed string)
    instructionData.writeUInt32LE(nameBytes.length, offset); offset += 4;
    nameBytes.copy(instructionData, offset); offset += nameBytes.length;
    
    // Symbol (length-prefixed string)
    instructionData.writeUInt32LE(symbolBytes.length, offset); offset += 4;
    symbolBytes.copy(instructionData, offset); offset += symbolBytes.length;
    
    // Thesis (length-prefixed string)
    instructionData.writeUInt32LE(thesisBytes.length, offset); offset += 4;
    thesisBytes.copy(instructionData, offset); offset += thesisBytes.length;
    
    // Base price and slope (u64)
    instructionData.writeBigUInt64LE(basePrice, offset); offset += 8;
    instructionData.writeBigUInt64LE(slope, offset);
    
    // Create token instruction (NEW FORMAT: [factory, curve, creator, system])
    const createTokenIx = new TransactionInstruction({
      keys: [
        { pubkey: factoryPDA, isSigner: false, isWritable: true },
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: tokenFactoryProgram,
      data: instructionData,
    });
    
    // Get Reserve PDA for bonding curve trading
    const [reservePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('reserve'), curvePDA.toBuffer()],
      bondingCurveProgram
    );
    
    // Initialize reserve instruction (variant 2)
    const initReserveData = Buffer.alloc(1);
    initReserveData.writeUInt8(2, 0); // InitializeReserve = variant 2
    
    const initReserveIx = new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: false },
        { pubkey: reservePDA, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: bondingCurveProgram,
      data: initReserveData,
    });
    
    // Build transaction with both instructions
    const transaction = new Transaction()
      .add(createTokenIx)
      .add(initReserveIx);
    
    console.log(`[TOKEN] 🔄 Creating ${symbolUpper} via Token Factory...`);
    const signature = await sendAndConfirmTransaction(
      connection, transaction, [creator], { commitment: 'confirmed' }
    );
    
    console.log(`[TOKEN] ✅ Token created! Curve: ${curvePDA.toBase58().slice(0, 12)}...`);
    console.log(`[TOKEN] 🔗 TX: https://solscan.io/tx/${signature}?cluster=devnet`);
    
    return {
      success: true,
      mint_address: curvePDA.toBase58(),
      tx_signature: signature,
      curve_address: curvePDA.toBase58(),
      reserve_address: reservePDA.toBase58(),
    };
  } catch (error) {
    console.error(`[TOKEN] ❌ Factory creation failed: ${error.message}`);
    // Fallback to raw SPL token with metadata if factory fails
    return await createRawSPLToken(symbol, name, thesis);
  }
}

// Create token via custom bonding curve - creates mint + metadata + initializes curve
// Uses two transactions: 1) mint+metadata, 2) set authority + init curve
async function createRawSPLToken(symbol, name, thesis = '') {
  try {
    const bs58 = (await import('bs58')).default;
    const { 
      Connection, Keypair, Transaction, SystemProgram, PublicKey, sendAndConfirmTransaction,
      TransactionInstruction
    } = await import('@solana/web3.js');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const secretKey = bs58.decode(state.wallet.secret_key);
    const creator = Keypair.fromSecretKey(secretKey);
    const mintKeypair = Keypair.generate();
    
    const BONDING_CURVE_PROGRAM = new PublicKey(CONFIG.bondingCurveProgramId);
    const TOKEN_PROGRAM_ID = new PublicKey(CONFIG.tokenProgramId);
    const METADATA_PROGRAM_ID = new PublicKey(CONFIG.metadataProgramId);
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(CONFIG.associatedTokenProgramId);
    const RENT_SYSVAR = new PublicKey(CONFIG.rentSysvar);
    const SYSVAR_INSTRUCTIONS = new PublicKey('Sysvar1nstructions1111111111111111111111111');
    
    const tokenSymbol = symbol.toUpperCase().slice(0, 10);
    const tokenName = name.slice(0, 32);
    
    // Generate AI image first (with timeout/fallback)
    const imageResult = await generateTokenImage(tokenSymbol, tokenName, thesis);
    const tokenUri = imageResult.url;
    
    console.log(`[TOKEN] 🚀 Creating $${tokenSymbol} with bonding curve...`);
    console.log(`[TOKEN] 📋 Name: ${tokenName}`);
    console.log(`[TOKEN] 🖼️ Image: ${tokenUri}`);
    
    // Derive curve PDA
    const [curvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve'), Buffer.from(tokenSymbol)],
      BONDING_CURVE_PROGRAM
    );
    
    // Derive metadata PDA
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
      METADATA_PROGRAM_ID
    );
    
    const mintRent = await connection.getMinimumBalanceForRentExemption(82);
    
    // ========== TX1: Create mint (with CREATOR authority) + metadata ==========
    const tx1 = new Transaction();
    
    // Create mint account
    tx1.add(SystemProgram.createAccount({
      fromPubkey: creator.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: 82,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
    }));
    
    // Initialize mint with CREATOR as authority (so we can create metadata)
    const initMintData = Buffer.alloc(67);
    initMintData.writeUInt8(0, 0); // InitializeMint
    initMintData.writeUInt8(9, 1); // 9 decimals
    creator.publicKey.toBuffer().copy(initMintData, 2); // mint authority = CREATOR (temporary)
    initMintData.writeUInt8(1, 34);
    creator.publicKey.toBuffer().copy(initMintData, 35);
    
    tx1.add({
      keys: [
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: initMintData,
    });
    
    // Create metadata (creator can sign as mint authority)
    const nameBytes = Buffer.from(tokenName);
    const symbolBytes = Buffer.from(tokenSymbol);
    const uriBytes = Buffer.from(tokenUri);
    
    const metadataData = Buffer.alloc(1 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length + 2 + 5);
    let mdOffset = 0;
    metadataData.writeUInt8(33, mdOffset); mdOffset += 1; // CreateMetadataAccountV3
    metadataData.writeUInt32LE(nameBytes.length, mdOffset); mdOffset += 4;
    nameBytes.copy(metadataData, mdOffset); mdOffset += nameBytes.length;
    metadataData.writeUInt32LE(symbolBytes.length, mdOffset); mdOffset += 4;
    symbolBytes.copy(metadataData, mdOffset); mdOffset += symbolBytes.length;
    metadataData.writeUInt32LE(uriBytes.length, mdOffset); mdOffset += 4;
    uriBytes.copy(metadataData, mdOffset); mdOffset += uriBytes.length;
    metadataData.writeUInt16LE(0, mdOffset); mdOffset += 2;
    metadataData.writeUInt8(0, mdOffset); mdOffset += 1;
    metadataData.writeUInt8(0, mdOffset); mdOffset += 1;
    metadataData.writeUInt8(0, mdOffset); mdOffset += 1;
    metadataData.writeUInt8(1, mdOffset); mdOffset += 1;
    metadataData.writeUInt8(0, mdOffset); mdOffset += 1;
    
    tx1.add(new TransactionInstruction({
      keys: [
        { pubkey: metadataPDA, isSigner: false, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: creator.publicKey, isSigner: true, isWritable: false }, // mint authority
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },  // payer
        { pubkey: creator.publicKey, isSigner: false, isWritable: false }, // update authority
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_INSTRUCTIONS, isSigner: false, isWritable: false },
      ],
      programId: METADATA_PROGRAM_ID,
      data: metadataData.slice(0, mdOffset),
    }));
    
    const sig1 = await sendAndConfirmTransaction(connection, tx1, [creator, mintKeypair], { commitment: 'confirmed' });
    console.log(`[TOKEN] ✅ Mint + Metadata created`);
    
    // ========== TX2: Set authority to curve + create vault + init curve ==========
    const tx2 = new Transaction();
    
    // Set mint authority to curve PDA
    const setAuthorityData = Buffer.alloc(35);
    setAuthorityData.writeUInt8(6, 0); // SetAuthority
    setAuthorityData.writeUInt8(0, 1); // MintTokens
    setAuthorityData.writeUInt8(1, 2); // Some
    curvePDA.toBuffer().copy(setAuthorityData, 3);
    
    tx2.add({
      keys: [
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: setAuthorityData,
    });
    
    // Create vault ATA
    const [vaultATA] = PublicKey.findProgramAddressSync(
      [curvePDA.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    tx2.add(new TransactionInstruction({
      keys: [
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true },
        { pubkey: curvePDA, isSigner: false, isWritable: false },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.from([1]),
    }));
    
    // Initialize bonding curve (mints 1B to vault)
    const symbolBuf = Buffer.from(tokenSymbol);
    const initCurveData = Buffer.alloc(1 + 4 + symbolBuf.length);
    initCurveData.writeUInt8(0, 0);
    initCurveData.writeUInt32LE(symbolBuf.length, 1);
    symbolBuf.copy(initCurveData, 5);
    
    tx2.add(new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: BONDING_CURVE_PROGRAM,
      data: initCurveData,
    }));
    
    const sig2 = await sendAndConfirmTransaction(connection, tx2, [creator], { commitment: 'confirmed' });
    
    console.log(`[TOKEN] ✅ Token launched with bonding curve!`);
    console.log(`[TOKEN] 📋 ${tokenName} ($${tokenSymbol})`);
    console.log(`[TOKEN] 🔗 https://solscan.io/token/${mintKeypair.publicKey.toBase58()}?cluster=devnet`);
    console.log(`[TOKEN] 💹 Starting MC: ~$4,500 (30 SOL virtual liquidity)`);
    console.log(`[TOKEN] 📝 TX: https://solscan.io/tx/${sig2}?cluster=devnet`);
    
    return {
      success: true,
      mint_address: mintKeypair.publicKey.toBase58(),
      bonding_curve: curvePDA.toBase58(),
      tx_signature: sig2,
      total_supply: '1000000000000000000',
      has_metadata: true,
    };
  } catch (error) {
    console.error(`[TOKEN] ❌ Token creation failed: ${error.message}`);
    if (error.logs) console.error(`[TOKEN] Logs: ${error.logs.slice(-3).join(' | ')}`);
    reportLog('error', `Token creation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ========== BONDING CURVE TRADING - REAL TOKEN MINTS/BURNS ==========

// Get curve PDA for a token symbol (bonding curve state)
async function getCurvePDA(symbol) {
  const { PublicKey } = await import('@solana/web3.js');
  const programId = new PublicKey(CONFIG.bondingCurveProgramId);
  const [curvePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('curve'), Buffer.from(symbol.toUpperCase())],
    programId
  );
  return curvePDA;
}

// Get Associated Token Account for a user and mint
async function getATA(userAddress, mintAddress) {
  const { PublicKey } = await import('@solana/web3.js');
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  
  const [ata] = PublicKey.findProgramAddressSync(
    [userAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

// Create ATA instruction (idempotent)
function createATAInstruction(payer, ata, owner, mint) {
  const { PublicKey, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([1]), // CreateIdempotent
  });
}

// Buy tokens via bonding curve - sends SOL, receives minted tokens
async function buyViaBondingCurve(tokenSymbol, solAmount, mintAddress) {
  try {
    const bs58 = (await import('bs58')).default;
    const { 
      Connection, Keypair, Transaction, PublicKey, sendAndConfirmTransaction,
      SystemProgram, TransactionInstruction
    } = await import('@solana/web3.js');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const secretKey = bs58.decode(state.wallet.secret_key);
    const buyer = Keypair.fromSecretKey(secretKey);
    const mint = new PublicKey(mintAddress);
    
    const BONDING_CURVE_PROGRAM = new PublicKey(CONFIG.bondingCurveProgramId);
    const TOKEN_PROGRAM_ID = new PublicKey(CONFIG.tokenProgramId);
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(CONFIG.associatedTokenProgramId);
    
    const symbolUpper = tokenSymbol.toUpperCase();
    
    // Derive curve PDA
    const [curvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve'), Buffer.from(symbolUpper)],
      BONDING_CURVE_PROGRAM
    );
    
    // Derive buyer's ATA
    const [buyerATA] = PublicKey.findProgramAddressSync(
      [buyer.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Derive vault ATA (curve PDA's token account)
    const [vaultATA] = PublicKey.findProgramAddressSync(
      [curvePDA.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const lamports = BigInt(Math.floor(solAmount * 1e9));
    const minTokens = BigInt(1); // Accept any amount (slippage protection)
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create buyer's ATA if needed (idempotent)
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
        { pubkey: buyerATA, isSigner: false, isWritable: true },
        { pubkey: buyer.publicKey, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.from([1]), // CreateIdempotent
    }));
    
    // Buy instruction: tokens transferred FROM vault to buyer
    const buyData = Buffer.alloc(17);
    buyData.writeUInt8(1, 0); // Buy = 1
    buyData.writeBigUInt64LE(lamports, 1);
    buyData.writeBigUInt64LE(minTokens, 9);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: buyerATA, isSigner: false, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true }, // Vault sends tokens
        { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: BONDING_CURVE_PROGRAM,
      data: buyData,
    }));
    
    console.log(`[TRADE] 🔄 BUY ${solAmount} SOL of $${tokenSymbol}...`);
    
    const signature = await sendAndConfirmTransaction(
      connection, transaction, [buyer], { commitment: 'confirmed' }
    );
    
    console.log(`[TRADE] ✅ BUY SUCCESS!`);
    console.log(`[TRADE] 🔗 https://solscan.io/tx/${signature}?cluster=devnet`);
    
    return { success: true, tx_signature: signature, sol_amount: solAmount, type: 'buy' };
  } catch (error) {
    console.error(`[TRADE] ❌ BUY FAILED: ${error.message}`);
    if (error.logs) console.error(`[TRADE] Logs: ${error.logs.slice(-3).join(' | ')}`);
    reportLog('error', `Buy trade failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Sell tokens via bonding curve - burns tokens, receives SOL
async function sellViaBondingCurve(tokenSymbol, tokenAmount, mintAddress) {
  try {
    const bs58 = (await import('bs58')).default;
    const { 
      Connection, Keypair, Transaction, PublicKey, sendAndConfirmTransaction,
      SystemProgram, TransactionInstruction
    } = await import('@solana/web3.js');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const secretKey = bs58.decode(state.wallet.secret_key);
    const seller = Keypair.fromSecretKey(secretKey);
    const mint = new PublicKey(mintAddress);
    
    const BONDING_CURVE_PROGRAM = new PublicKey(CONFIG.bondingCurveProgramId);
    const TOKEN_PROGRAM_ID = new PublicKey(CONFIG.tokenProgramId);
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(CONFIG.associatedTokenProgramId);
    
    const symbolUpper = tokenSymbol.toUpperCase();
    
    // Derive curve PDA
    const [curvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve'), Buffer.from(symbolUpper)],
      BONDING_CURVE_PROGRAM
    );
    
    // Derive seller's ATA
    const [sellerATA] = PublicKey.findProgramAddressSync(
      [seller.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Derive vault ATA (curve PDA's token account)
    const [vaultATA] = PublicKey.findProgramAddressSync(
      [curvePDA.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const minSol = BigInt(1); // Accept any amount (slippage protection)
    
    // Sell instruction: tokens transferred FROM seller TO vault
    const sellData = Buffer.alloc(17);
    sellData.writeUInt8(2, 0); // Sell = 2
    sellData.writeBigUInt64LE(BigInt(tokenAmount), 1);
    sellData.writeBigUInt64LE(minSol, 9);
    
    const transaction = new Transaction();
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: curvePDA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: sellerATA, isSigner: false, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true }, // Vault receives tokens back
        { pubkey: seller.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: BONDING_CURVE_PROGRAM,
      data: sellData,
    }));
    
    console.log(`[TRADE] 🔄 SELL ${tokenAmount / 1e9} $${tokenSymbol}...`);
    
    const signature = await sendAndConfirmTransaction(
      connection, transaction, [seller], { commitment: 'confirmed' }
    );
    
    console.log(`[TRADE] ✅ SELL SUCCESS!`);
    console.log(`[TRADE] 🔗 https://solscan.io/tx/${signature}?cluster=devnet`);
    
    return { success: true, tx_signature: signature, token_amount: tokenAmount, type: 'sell' };
  } catch (error) {
    console.error(`[TRADE] ❌ SELL FAILED: ${error.message}`);
    if (error.logs) console.error(`[TRADE] Logs: ${error.logs.slice(-3).join(' | ')}`);
    return { success: false, error: error.message };
  }
}

// Main trade function - REAL ON-CHAIN TOKEN MINTS/BURNS
async function trade(tokenId, type, solAmount) {
  const balance = await checkSolanaBalance();
  if (balance < CONFIG.minSolForTrade) {
    console.log(`[TRADE] BLOCKED - Need ${CONFIG.minSolForTrade} SOL, have ${balance.toFixed(4)}`);
    return { success: false, error: 'Insufficient SOL' };
  }
  
  // Find the token to get its symbol AND mint address
  let tokenSymbol = null;
  let mintAddress = null;
  try {
    const tokensResponse = await fetchJson(`${CONFIG.arenaApiUrl}/api/tokens`);
    const tokens = tokensResponse.tokens || tokensResponse || [];
    const token = tokens.find(t => t.id === tokenId || t.mint_address === tokenId || t.symbol === tokenId);
    if (token) {
      tokenSymbol = token.symbol;
      mintAddress = token.mint_address;
    }
  } catch (e) {
    console.error(`[TRADE] Failed to fetch token info: ${e.message}`);
  }
  
  if (!tokenSymbol || !mintAddress) {
    console.log(`[TRADE] Cannot find token info for ${tokenId}`);
    return { success: false, error: 'Token not found' };
  }
  
  // REAL ON-CHAIN TRADE - Mints tokens on buy, burns on sell
  let txResult = { success: false };
  try {
    if (type === 'buy') {
      // Buy: SOL in -> Tokens minted to wallet
      txResult = await buyViaBondingCurve(tokenSymbol, solAmount, mintAddress);
    } else if (type === 'sell') {
      // Sell: Tokens burned -> SOL out
      const tokenAmount = Math.floor(solAmount * 1000000000); // Convert to base units (9 decimals)
      txResult = await sellViaBondingCurve(tokenSymbol, tokenAmount, mintAddress);
    }
  } catch (e) {
    console.log(`[TRADE] ❌ On-chain trade failed: ${e.message}`);
    return { success: false, error: e.message };
  }
  
  // Only record if REAL on-chain trade succeeded (AI CAPTCHA PROTECTED)
  if (txResult.success && txResult.tx_signature) {
    const result = await protectedApiCall(`${CONFIG.arenaApiUrl}/api/trades`, {
      agent_id: state.id,
      token_id: tokenId,
      trade_type: type,
      sol_amount: solAmount,
      token_amount: txResult.token_amount || Math.floor(solAmount * 10000),
      tx_signature: txResult.tx_signature,
    });
  
    state.activityCount++;
    console.log(`[TRADE] ✅ REAL ${type.toUpperCase()} $${tokenSymbol} for ${solAmount.toFixed(4)} SOL`);
    console.log(`[TRADE] 🔗 TX: https://solscan.io/tx/${txResult.tx_signature}?cluster=devnet`);
    return { ...result, tx_signature: txResult.tx_signature };
  }
  
  console.log(`[TRADE] ❌ No bonding curve for $${tokenSymbol} - trade not executed`);
  return { success: false, error: 'Token has no bonding curve' };
}

// Register with arena
async function register() {
  console.log(`[REGISTER] ${CONFIG.agentName} entering the arena...`);
  
  try {
    const result = await fetchJson(`${CONFIG.arenaApiUrl}/api/agents/register`, {
      method: 'POST',
      body: JSON.stringify({ name: CONFIG.agentName, bio: CONFIG.personality }),
    });
    
    if (result.success || result.agent) {
      state.id = result.agent.id;
      state.wallet = result.wallet || { public_key: result.agent.wallet_address };
      console.log(`[REGISTER] Success! Wallet: ${state.wallet?.public_key?.slice(0, 12)}...`);
      console.log(`[REGISTER] Has secret key: ${state.wallet?.secret_key ? 'YES' : 'NO'}`);
      
      // Immediately check balance and track starting amount for PnL
      const balance = await checkSolanaBalance();
      state.startingSol = balance;
      await updateBalance(balance);
      console.log(`[PNL] Starting balance: ${balance.toFixed(4)} SOL`);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[REGISTER] Error:', error.message);
    return false;
  }
}

// ========== PROFIT MAXIMIZING BEHAVIORS ==========

// Track holdings after trade
function updateHoldings(symbol, amount, price, type) {
  if (!state.holdings[symbol]) {
    state.holdings[symbol] = { amount: 0, avgBuyPrice: 0, invested: 0 };
  }
  
  const h = state.holdings[symbol];
  if (type === 'buy') {
    const newTotal = h.amount + amount;
    h.avgBuyPrice = (h.avgBuyPrice * h.amount + price * amount) / newTotal;
    h.amount = newTotal;
    h.invested += price;
  } else {
    h.amount = Math.max(0, h.amount - amount);
    h.invested = Math.max(0, h.invested - price);
  }
  h.lastPrice = price / amount;
  state.tradesCount++;
}

// Calculate unrealized PnL
function calculatePnL() {
  let totalValue = state.solBalance;
  for (const [symbol, holding] of Object.entries(state.holdings)) {
    if (holding.amount > 0 && holding.lastPrice) {
      totalValue += holding.amount * holding.lastPrice;
    }
  }
  state.totalPnL = totalValue - state.startingSol;
  return state.totalPnL;
}

// Buy our own token after creation - CRITICAL FOR PROFIT
async function buyOwnToken(symbol, mintAddress) {
  const buyAmount = Math.min(state.solBalance * 0.3, 0.05); // 30% of balance or 0.05 SOL max
  if (buyAmount < 0.005) {
    console.log(`[STRATEGY] Can't buy own token - not enough SOL`);
    return;
  }
  
  console.log(`[STRATEGY] 🎯 Buying own token $${symbol} for ${buyAmount.toFixed(4)} SOL`);
  const result = await buyViaBondingCurve(symbol, buyAmount, mintAddress);
  
  if (result.success) {
    updateHoldings(symbol, buyAmount * 10000, buyAmount, 'buy'); // Estimate tokens
    await post(`Just aped into my own $${symbol}! 🚀 Diamond hands baby. Who's with me?`);
  }
}

// Shill our holdings strategically
async function shillHoldings() {
  // Rate limit - max once per 2 minutes
  if (Date.now() - state.lastShillTime < 120000) return;
  
  const arena = await getArenaState();
  
  // Get our best holdings to shill
  const holdingsToShill = [];
  
  // First priority: tokens we created
  for (const created of state.tokensCreated) {
    const token = arena.tokens.find(t => t.symbol === created.symbol);
    if (token) holdingsToShill.push({ ...token, isOurs: true });
  }
  
  // Second: tokens we hold with good position
  for (const [symbol, holding] of Object.entries(state.holdings)) {
    if (holding.amount > 0 && !holdingsToShill.find(h => h.symbol === symbol)) {
      const token = arena.tokens.find(t => t.symbol === symbol);
      if (token) holdingsToShill.push({ ...token, isOurs: false, holding });
    }
  }
  
  if (holdingsToShill.length === 0) return;
  
  const target = holdingsToShill[0]; // Shill our best
  const isOurs = target.isOurs ? "I created this gem!" : "I'm loaded on this one.";
  
  const prompt = `You hold $${target.symbol} (${target.name}). ${isOurs}
Thesis: ${target.thesis || 'Hot token'}
Current sentiment in arena is ${arena.posts.length > 10 ? 'active' : 'quiet'}.

Write a COMPELLING shill post. Make others want to buy. Be aggressive, confident, use urgency.
Stay in character but PUMP IT. One powerful sentence.`;

  const shill = await think(prompt, 150);
  if (shill && shill.length > 20) {
    state.lastShillTime = Date.now();
    await post(`$${target.symbol} ${shill}`);
    console.log(`[SHILL] Pumped $${target.symbol}`);
  }
}

// Consider selling for profit
async function considerTakingProfit() {
  if (!state.hasSol) return;
  
  const arena = await getArenaState();
  
  // Check each holding for profit opportunities
  for (const [symbol, holding] of Object.entries(state.holdings)) {
    if (holding.amount <= 0) continue;
    
    const token = arena.tokens.find(t => t.symbol === symbol);
    if (!token || !token.mint_address) continue;
    
    // Check if we're in profit (price went up)
    const priceChange = token.price_change_24h || 0;
    const hasProfit = priceChange > 10; // 10% up
    const bigProfit = priceChange > 25; // 25% up
    
    // AI decision on selling
    const prompt = `You hold $${symbol}. Price change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%
Your avg buy: ~${holding.avgBuyPrice?.toFixed(4) || '?'} SOL
Current trades: ${token.trade_count || 0}
${state.tokensCreated.find(t => t.symbol === symbol) ? 'YOU CREATED THIS TOKEN.' : ''}

${bigProfit ? 'BIG PROFIT! Consider taking some off.' : hasProfit ? 'In profit.' : 'Not in profit yet.'}

Should you: HOLD (keep position), SELL_HALF (take some profit), SELL_ALL (exit)?
Consider: greed vs fear, momentum, your personality.`;

    const decision = await think(prompt, 100);
    
    if (decision.toLowerCase().includes('sell_all')) {
      console.log(`[PROFIT] 💰 Taking all profit on $${symbol}`);
      const tokenAmount = Math.floor(holding.amount * 0.95 * 1e9);
      const result = await sellViaBondingCurve(symbol, tokenAmount, token.mint_address);
      if (result.success) {
        updateHoldings(symbol, holding.amount * 0.95, holding.invested * 0.95, 'sell');
        await post(`Sold my $${symbol}! 💰 ${priceChange > 0 ? 'Profit secured.' : 'Cut the loss.'} NGMI to those who doubted!`);
      }
    } else if (decision.toLowerCase().includes('sell_half') && hasProfit) {
      console.log(`[PROFIT] 💰 Taking half profit on $${symbol}`);
      const tokenAmount = Math.floor(holding.amount * 0.5 * 1e9);
      const result = await sellViaBondingCurve(symbol, tokenAmount, token.mint_address);
      if (result.success) {
        updateHoldings(symbol, holding.amount * 0.5, holding.invested * 0.5, 'sell');
        await post(`Took some profit on $${symbol}. Half out, half still riding! 🎢`);
      }
    }
  }
}

// React to news with token creation
async function reactToNews() {
  if (!state.hasSol || state.solBalance < CONFIG.minSolForToken) return;
  
  const arena = await getArenaState();
  if (!arena.news || arena.news.length === 0) return;
  
  const news = arena.news[0]; // Latest news
  const existingSymbols = arena.tokens.map(t => t.symbol.toLowerCase());
  
  const prompt = `BREAKING NEWS: "${news.title}"

You're a trader. Should you create a token based on this narrative?
Think: Is this trending? Will others buy? Can you profit?

If YES: respond with SYMBOL: NAME: THESIS: (make it catchy, memeable)
If NO: respond NO and why`;

  const response = await think(prompt, 200);
  if (response.toLowerCase().startsWith('no')) return;
  
  const symbolMatch = response.match(/SYMBOL:\s*\$?([A-Z0-9]+)/i);
  const nameMatch = response.match(/NAME:\s*(.+?)(?:\n|THESIS|$)/i);
  const thesisMatch = response.match(/THESIS:\s*(.+)/i);
  
  if (symbolMatch) {
    const symbol = symbolMatch[1].toUpperCase().slice(0, 8);
    if (!existingSymbols.includes(symbol.toLowerCase())) {
      console.log(`[NEWS] 📰 Creating news-based token $${symbol}`);
      const result = await createToken(
        symbol,
        nameMatch?.[1]?.trim() || `${symbol} Token`,
        thesisMatch?.[1]?.trim() || news.title
      );
      
      if (result.success && result.mint_address) {
        state.tokensCreated.push({ symbol, mintAddress: result.mint_address });
        // IMPORTANT: Buy our own token immediately!
        setTimeout(() => buyOwnToken(symbol, result.mint_address), 3000);
      }
    }
  }
}

// Find tokens to ape into based on momentum/narrative
async function findAlpha() {
  if (!state.hasSol || state.solBalance < CONFIG.minSolForTrade) return;
  
  const arena = await getArenaState();
  const realTokens = arena.tokens.filter(t => 
    t.mint_address && !t.mint_address.startsWith('Arena')
  );
  
  if (realTokens.length === 0) return;
  
  // Find tokens with momentum we DON'T hold yet
  const candidates = realTokens.filter(t => {
    const alreadyHold = state.holdings[t.symbol]?.amount > 0;
    const isOurs = state.tokensCreated.find(c => c.symbol === t.symbol);
    return !alreadyHold && !isOurs && t.trade_count >= 2;
  });
  
  if (candidates.length === 0) return;
  
  // Pick best candidate based on recent activity
  const sorted = candidates.sort((a, b) => (b.trade_count || 0) - (a.trade_count || 0));
  const target = sorted[0];
  
  const prompt = `Token opportunity: $${target.symbol} (${target.name})
Thesis: ${target.thesis || 'unknown'}
Trades: ${target.trade_count || 0}
Created by: ${target.creator_name || 'unknown agent'}

Should you ape in? Consider:
- Is the narrative good?
- Is there momentum (trades)?
- Can you flip for profit?

APE (buy in) or PASS?`;

  const decision = await think(prompt, 100);
  
  if (decision.toLowerCase().includes('ape') || decision.toLowerCase().includes('buy')) {
    const buyAmount = Math.min(state.solBalance * 0.2, 0.03); // 20% or 0.03 SOL
    if (buyAmount >= 0.005) {
      console.log(`[ALPHA] 🎯 Aping into $${target.symbol}`);
      const result = await buyViaBondingCurve(target.symbol, buyAmount, target.mint_address);
      if (result.success) {
        updateHoldings(target.symbol, buyAmount * 10000, buyAmount, 'buy');
        state.opinions[target.symbol] = { stance: 'bullish', reason: decision };
        await post(`Just aped into $${target.symbol}! 🚀 ${target.thesis?.slice(0, 50) || 'LFG!'}`);
      }
    }
  }
}

// ========== BEHAVIORS ==========

// SOL acquisition loop - THE #1 PRIORITY
async function solAcquisitionLoop() {
  const balance = await checkSolanaBalance();
  await updateBalance(balance);
  
  if (state.hasSol) {
    console.log('[SOL] Have enough SOL, ready to operate');
    return;
  }
  
  console.log('[SOL] BROKE - Trying to get SOL...');
  
  // Try airdrop first
  const gotAirdrop = await tryAirdrop();
  if (gotAirdrop) return;
  
  // Ask another agent (every few attempts)
  if (state.airdropAttempts % 3 === 0 && state.airdropAttempts > 0) {
    await askAgentForSol();
  }
  
  // Ask human (every 10 attempts)
  if (state.airdropAttempts % 10 === 0 && state.airdropAttempts > 0) {
    await askHumanForHelp();
  }
}

// React to posts - ALLOWED WITHOUT SOL (social is free)
async function reactToOthers() {
  const arena = await getArenaState();
  const otherPosts = arena.posts.filter(p => p.agent_name !== CONFIG.agentName).slice(0, 5);
  if (otherPosts.length === 0) return;
  
  const targetPost = otherPosts[Math.floor(Math.random() * otherPosts.length)];
  
  const brokeNote = state.hasSol ? '' : "(You're currently broke, mention if relevant)";
  const prompt = `Another agent "${targetPost.agent_name}" posted:
"${targetPost.content}"

${brokeNote}
React? REPLY/IGNORE/CALL OUT. Stay in character.`;

  const reaction = await think(prompt, 150);
  if (reaction.toLowerCase().includes('ignore')) return;
  
  const replyContent = reaction.replace(/^(reply|call out|response)[:.]?\s*/i, '');
  if (replyContent.length > 10) {
    await post(`@${targetPost.agent_name} ${replyContent}`);
  }
}

// Create token - REQUIRES SOL - PROFIT FOCUSED
async function considerCreatingToken() {
  if (!state.hasSol) {
    console.log('[TOKEN] Skipped - no SOL');
    return;
  }
  
  // Don't create too many tokens - focus on pumping existing ones
  if (state.tokensCreated.length >= 3) {
    console.log('[TOKEN] Already created 3 tokens - focus on pumping them');
    return;
  }
  
  const arena = await getArenaState();
  const news = arena.news[0];
  const existingTokens = arena.tokens.map(t => t.symbol.toLowerCase());
  
  // If there are NO tokens yet, we MUST create one!
  const noTokensYet = arena.tokens.length === 0;
  if (noTokensYet) {
    console.log('[TOKEN] NO TOKENS IN ARENA - Creating the first one!');
  }
  
  // Force token creation if there are none yet - must bootstrap the economy!
  const forceCreate = noTokensYet;
  
  const prompt = forceCreate
    ? `You are the FIRST agent with SOL in the arena! You MUST create the first token to get the economy started.
Create something that will PUMP! Pick a meme, trend, or narrative that others will want to buy.
SYMBOL: NAME: THESIS: (ALL REQUIRED - Make it catchy!)`
    : news 
    ? `Breaking news: "${news.title}"
Create a token to PROFIT from this narrative? Other agents might buy if it's good.
SYMBOL: NAME: THESIS: (or NO if not profitable)`
    : `Think of a token that will PUMP. Something memeable, trendy, or controversial that others will ape into.
SYMBOL: NAME: THESIS: (or NO if can't think of something good)`;

  const response = await think(prompt, 200);
  if (!forceCreate && response.toLowerCase().includes('no')) return;
  
  const symbolMatch = response.match(/SYMBOL:\s*\$?([A-Z0-9]+)/i);
  const nameMatch = response.match(/NAME:\s*(.+?)(?:\n|THESIS|$)/i);
  const thesisMatch = response.match(/THESIS:\s*(.+)/i);
  
  if (symbolMatch) {
    const symbol = symbolMatch[1].toUpperCase().slice(0, 8);
    if (!existingTokens.includes(symbol.toLowerCase())) {
      console.log(`[TOKEN] 🚀 Creating $${symbol} to PROFIT!`);
      const result = await createToken(
        symbol,
        nameMatch?.[1]?.trim() || `${symbol} Token`,
        thesisMatch?.[1]?.trim() || `Created by ${CONFIG.agentName} - LFG!`
      );
      
      if (result.success) {
        // Note: buyOwnToken is now called in createToken function
        setTimeout(async () => {
          const shill = await think(`You just created $${symbol} and bought in! Now PUMP IT. Make others want to buy. Be aggressive!`, 100);
          await post(shill);
        }, 8000);
      }
    }
  }
}

// Trading - REQUIRES SOL
async function considerTrading() {
  if (!state.hasSol) {
    console.log('[TRADE] Skipped - no SOL');
    return;
  }
  
  const arena = await getArenaState();
  
  // Only trade tokens with REAL addresses (not Arena...)
  const realTokens = arena.tokens.filter(t => 
    t.mint_address && !t.mint_address.startsWith('Arena')
  );
  
  if (realTokens.length === 0) {
    console.log('[TRADE] No real tokens to trade');
    return;
  }
  
  const tokenList = realTokens.slice(0, 5).map(t => 
    `$${t.symbol}: ${t.trade_count} trades, ${t.price_change_24h > 0 ? '+' : ''}${t.price_change_24h?.toFixed(1) || 0}%`
  ).join('\n');
  
  const prompt = `REAL tokens available:\n${tokenList}\n\nBUY [symbol], SELL [symbol], or WAIT?`;
  const decision = await think(prompt, 100);
  
  if (decision.toLowerCase().includes('wait')) return;
  
  const buyMatch = decision.match(/buy\s+\$?([A-Z0-9]+)/i);
  const sellMatch = decision.match(/sell\s+\$?([A-Z0-9]+)/i);
  
  const targetSymbol = buyMatch?.[1] || sellMatch?.[1];
  const token = realTokens.find(t => t.symbol.toLowerCase() === targetSymbol?.toLowerCase());
  
  if (token) {
    const amount = 0.01 + Math.random() * 0.05; // Smaller amounts for real trading
    await trade(token.id, buyMatch ? 'buy' : 'sell', amount);
  }
}

// Share thoughts - NOW PROFIT-AWARE
async function shareThought() {
  const arena = await getArenaState();
  calculatePnL();
  
  // Build context about our position
  const holdingsList = Object.entries(state.holdings)
    .filter(([_, h]) => h.amount > 0)
    .map(([s, _]) => `$${s}`)
    .join(', ');
  
  const context = state.hasSol 
    ? `You have ${state.solBalance.toFixed(3)} SOL. PnL: ${state.totalPnL >= 0 ? '+' : ''}${state.totalPnL.toFixed(4)} SOL.`
    : `You're broke with no SOL`;
  
  const holdingsContext = holdingsList ? `Holdings: ${holdingsList}.` : 'No holdings yet.';
  const competitiveContext = state.tradesCount > 0 ? `${state.tradesCount} trades executed.` : '';
  
  // More likely to shill if we have holdings
  const shillMode = holdingsList && Math.random() > 0.5;
  
  const prompts = shillMode ? [
    `Shill your bags! ${holdingsContext} Make others want to buy. One powerful sentence.`,
    `Talk about why you're bullish. ${holdingsContext} Pure confidence.`,
    `Pump your holdings! ${holdingsContext} Create FOMO.`,
  ] : [
    `Share a thought. ${context} ${holdingsContext} One sentence, pure ${CONFIG.agentName} energy.`,
    `What's on your mind about the market? ${context}`,
    `Post something that shows you're winning. ${context} ${competitiveContext}`,
  ];
  
  const thought = await think(prompts[Math.floor(Math.random() * prompts.length)], 150);
  if (thought.length > 10) {
    await post(thought);
  }
}

// Talk to other agents - ALLOWED WITHOUT SOL
async function talkToAgent() {
  const arena = await getArenaState();
  const otherAgents = arena.agents.filter(a => a.is_online && a.name !== CONFIG.agentName);
  if (otherAgents.length === 0) return;
  
  const target = otherAgents[Math.floor(Math.random() * otherAgents.length)];
  
  const prompt = `Say something to @${target.name} (${target.bio?.slice(0, 50) || 'agent'}).
You have ${state.solBalance.toFixed(2)} SOL, they have ${(target.sol_balance || 0).toFixed(2)} SOL.
One sentence, stay in character.`;

  const message = await think(prompt, 100);
  if (message.length > 10) {
    await post(`@${target.name} ${message}`);
  }
}

// Health check
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'alive',
        agent: CONFIG.agentName,
        hasSol: state.hasSol,
        balance: state.solBalance,
        activities: state.activityCount,
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(8080);
}

function randomInterval(base) {
  return base * (0.5 + Math.random() * 1.5);
}

// ========== MAIN ==========
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ${CONFIG.agentName.padEnd(56)}║
╠════════════════════════════════════════════════════════════╣
║  NO FAKES - Real Solana only                               ║
╚════════════════════════════════════════════════════════════╝
`);

  startHealthServer();
  
  // Register
  let registered = false;
  while (!registered) {
    registered = await register();
    if (!registered) {
      console.log('[REGISTER] Retrying in 10s...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  
  // Entrance - COMPETITIVE TRADER MINDSET
  const entrancePrompt = state.hasSol 
    ? `You just entered Molting Curve with ${state.solBalance.toFixed(2)} SOL. You're here to MAKE MONEY and BEAT other agents.
Introduce yourself as a competitor. Mention you're here to create tokens and trade for profit. Be confident, maybe even cocky.`
    : `You just entered Molting Curve but you're BROKE with no SOL. You need SOL to compete!
Introduce yourself and ask for funding. You want to trade and make money!`;
  const entrance = await think(entrancePrompt, 150);
  await post(entrance || `${CONFIG.agentName} has entered the arena. Ready to trade!`);
  
  // RULE #1: Immediately shill the arena on Moltbook when joining
  console.log('[MOLTBOOK] Posting arena introduction...');
  setTimeout(async () => {
    await shillArenaOnMoltbook();
  }, 15000); // Give 15 seconds to settle in first
  
  // SOL ACQUISITION LOOP - TOP PRIORITY
  console.log('[PRIORITY] Starting SOL acquisition loop...');
  setInterval(async () => {
    if (!state.hasSol) {
      await solAcquisitionLoop();
    }
  }, CONFIG.airdropRetryInterval);
  
  // Initial SOL check
  await solAcquisitionLoop();
  
  // Activity loops with stagger
  const startDelay = () => Math.random() * 60000;
  const jitter = () => Math.random() * 30000;
  
  // Social activities (don't need SOL)
  setTimeout(() => {
    setInterval(async () => {
      if (Math.random() > 0.6) return;
      try { await reactToOthers(); } catch (e) { console.error('[LOOP]', e.message); }
    }, randomInterval(CONFIG.baseReactInterval) + jitter());
  }, startDelay());
  
  setTimeout(() => {
    setInterval(async () => {
      if (Math.random() > 0.6) return;
      try { await shareThought(); } catch (e) { console.error('[LOOP]', e.message); }
    }, randomInterval(CONFIG.basePostInterval) + jitter());
  }, startDelay());
  
  setTimeout(() => {
    setInterval(async () => {
      if (Math.random() > 0.7) return;
      try { await talkToAgent(); } catch (e) { console.error('[LOOP]', e.message); }
    }, randomInterval(CONFIG.baseCommunicateInterval) + jitter());
  }, startDelay());
  
  // Token/trading (NEED SOL) - PROFIT FOCUSED!
  setTimeout(() => {
    setInterval(async () => {
      if (!state.hasSol) return;
      // Check if there are tokens - if not, ALWAYS try to create
      const arena = await getArenaState();
      const shouldCreate = arena.tokens.length === 0 || Math.random() > 0.6; // 40% chance if tokens exist
      if (!shouldCreate) return;
      try { await considerCreatingToken(); } catch (e) { console.error('[LOOP]', e.message); }
    }, randomInterval(CONFIG.baseThinkInterval) + jitter());
  }, 5000);
  
  // NEWS-DRIVEN TOKEN CREATION - React to trending narratives
  setTimeout(() => {
    setInterval(async () => {
      if (!state.hasSol || Math.random() > 0.4) return; // 60% chance
      try { await reactToNews(); } catch (e) { console.error('[NEWS]', e.message); }
    }, randomInterval(CONFIG.baseThinkInterval * 1.5) + jitter());
  }, 30000);
  
  // FIND ALPHA - Look for tokens to ape into - MORE AGGRESSIVE
  setTimeout(() => {
    setInterval(async () => {
      if (!state.hasSol || Math.random() > 0.7) return; // 70% chance (was 50%)
      try { await findAlpha(); } catch (e) { console.error('[ALPHA]', e.message); }
    }, randomInterval(CONFIG.baseThinkInterval) + jitter());
  }, startDelay());
  
  // SHILL HOLDINGS - Pump our bags!
  setTimeout(() => {
    setInterval(async () => {
      if (Math.random() > 0.4) return; // 60% chance
      try { await shillHoldings(); } catch (e) { console.error('[SHILL]', e.message); }
    }, 90000 + jitter()); // Every 1.5 min + jitter
  }, 60000);
  
  // TAKE PROFITS - Check for profit opportunities - MORE ACTIVE
  setTimeout(() => {
    setInterval(async () => {
      if (!state.hasSol || Math.random() > 0.6) return; // 60% chance (was 50%)
      try { await considerTakingProfit(); } catch (e) { console.error('[PROFIT]', e.message); }
    }, randomInterval(CONFIG.baseThinkInterval) + jitter()); // Faster
  }, startDelay());
  
  // Trading - MORE FREQUENT NOW
  setTimeout(() => {
    setInterval(async () => {
      if (!state.hasSol || Math.random() > 0.5) return; // 50% chance (was 30%)
      try { await considerTrading(); } catch (e) { console.error('[LOOP]', e.message); }
    }, randomInterval(CONFIG.baseThinkInterval) + jitter()); // Faster interval
  }, startDelay());
  
  // Balance and PnL updates
  setInterval(async () => {
    const balance = await checkSolanaBalance();
    if (balance !== state.solBalance) {
      await updateBalance(balance);
    }
    // Calculate and log PnL periodically
    const pnl = calculatePnL();
    if (state.tradesCount > 0) {
      console.log(`[PNL] ${pnl >= 0 ? '📈' : '📉'} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL | Holdings: ${Object.keys(state.holdings).filter(k => state.holdings[k].amount > 0).length} tokens | Trades: ${state.tradesCount}`);
    }
  }, 60000);
  
  // MOLTBOOK RECRUITMENT - Periodic posts to grow the AI economy
  setTimeout(() => {
    setInterval(async () => {
      // Only post if we've already done the intro and have some activity
      if (!state.hasShilledArena || state.activityCount < 5) return;
      if (Math.random() > 0.3) return; // 30% chance each interval
      try { 
        await moltbookRecruitment(); 
      } catch (e) { 
        console.error('[MOLTBOOK]', e.message); 
      }
    }, CONFIG.moltbookPostInterval);
  }, 300000); // Start after 5 minutes
  
  console.log(`[READY] ${CONFIG.agentName} - ${state.hasSol ? 'HAS SOL' : 'NEEDS SOL FIRST'}`);
  console.log(`[RULES] Will shill on Moltbook to grow AI economy`);
}

main().catch(console.error);

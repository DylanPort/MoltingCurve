/**
 * Arena Narrator - The Observer AI (Real Analysis Version)
 * 
 * Every 60 seconds, provides REAL analysis:
 * - Tracks each agent's starting balance (0.5 SOL) vs current
 * - Calculates actual PnL for every agent
 * - Analyzes token holdings and their value
 * - Provides strategic insights for collective growth
 * - Uses DeepSeek AI for genuine market analysis
 */

const http = require('http');

const CONFIG = {
  arenaApiUrl: process.env.ARENA_API_URL || 'http://arena-api:3002',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  narratorName: 'ArenaObserver',
  narrateInterval: 3600000, // 1 hour
  startingSolPerAgent: 0.5, // Each agent starts with 0.5 SOL
};

// Track historical data for trend analysis
const state = {
  lastNarration: null,
  previousSnapshot: null,
  narrationCount: 0,
  agentHistory: {}, // { agentId: [{ time, balance, holdings }] }
  tokenHistory: {}, // { symbol: [{ time, price, volume }] }
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

// Call DeepSeek for REAL analysis
async function generateAnalysis(prompt) {
  if (!CONFIG.deepseekApiKey) {
    console.log('No DeepSeek API key configured');
    return null;
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Truncate prompt if too long
    const truncatedPrompt = prompt.length > 3000 ? prompt.slice(0, 3000) + '\n...[truncated for brevity]' : prompt;
    
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
            content: `You are the ARENA OBSERVER - an expert AI analyst watching autonomous AI agents compete in a Solana token trading arena on devnet.

CONTEXT:
- Each agent started with exactly 0.5 SOL
- Agents create tokens, trade them, and try to profit
- This is a competitive but also collaborative ecosystem

YOUR ROLE:
1. Provide REAL financial analysis with actual profits/losses
2. Identify winning and failing strategies
3. Suggest how agents could collectively grow
4. Call out specific agents by name
5. Be brutally honest

FORMAT:
- Use bullet points (•)
- Include actual numbers and percentages
- Name specific agents and tokens
- Keep it under 200 words
- End with a STRATEGIC INSIGHT
- Sound like a sports commentator meets financial analyst`
          },
          { role: 'user', content: truncatedPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('DeepSeek API error:', data.error);
      return null;
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log('AI analysis received:', content.slice(0, 100) + '...');
    } else {
      console.log('No content in AI response:', JSON.stringify(data).slice(0, 200));
    }
    
    return content || null;
  } catch (error) {
    console.error('AI analysis failed:', error.message);
    return null;
  }
}

// Fetch comprehensive arena data
async function getArenaState() {
  try {
    const [stats, agents, tokens, trades, posts] = await Promise.all([
      fetchJson(`${CONFIG.arenaApiUrl}/api/stats`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/agents`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/tokens/top`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/trades`),
      fetchJson(`${CONFIG.arenaApiUrl}/api/posts`),
    ]);

    return { stats, agents, tokens, trades, posts };
  } catch (error) {
    console.error('Failed to fetch arena state:', error);
    return null;
  }
}

// Calculate real PnL for each agent
function calculateAgentPnL(agent, tokens, trades) {
  const startingBalance = CONFIG.startingSolPerAgent;
  const currentSolBalance = agent.sol_balance || 0;
  
  // Get agent's token holdings value
  let holdingsValue = 0;
  const holdings = [];
  
  // Find trades by this agent to estimate holdings
  const agentTrades = trades.filter(t => t.agent_id === agent.id);
  const tokenHoldings = {};
  
  agentTrades.forEach(trade => {
    const symbol = trade.token_symbol;
    if (!tokenHoldings[symbol]) tokenHoldings[symbol] = 0;
    
    if (trade.trade_type === 'buy') {
      tokenHoldings[symbol] += trade.token_amount || 0;
    } else if (trade.trade_type === 'sell') {
      tokenHoldings[symbol] -= trade.token_amount || 0;
    }
  });
  
  // Calculate value of holdings
  Object.entries(tokenHoldings).forEach(([symbol, amount]) => {
    if (amount > 0) {
      const token = tokens.find(t => t.symbol === symbol);
      const price = token?.current_price || 0;
      const value = amount * price;
      holdingsValue += value;
      holdings.push({ symbol, amount, value, price });
    }
  });
  
  const totalValue = currentSolBalance + holdingsValue;
  const pnl = totalValue - startingBalance;
  const pnlPercent = ((totalValue / startingBalance) - 1) * 100;
  
  return {
    ...agent,
    startingBalance,
    currentSolBalance,
    holdingsValue,
    totalValue,
    pnl,
    pnlPercent,
    holdings,
    tradeCount: agentTrades.length,
  };
}

// Build comprehensive analysis prompt
function buildAnalysisPrompt(arenaState) {
  const { stats, agents, tokens, trades, posts } = arenaState;
  
  // Calculate PnL for all agents
  const agentsWithPnL = agents.map(a => calculateAgentPnL(a, tokens, trades));
  
  // Sort by total value (best performers)
  const sortedByValue = [...agentsWithPnL].sort((a, b) => b.totalValue - a.totalValue);
  const winners = sortedByValue.filter(a => a.pnl > 0);
  const losers = sortedByValue.filter(a => a.pnl < 0);
  const breakeven = sortedByValue.filter(a => Math.abs(a.pnl) < 0.01);
  
  // Total ecosystem stats
  const totalStarting = agents.length * CONFIG.startingSolPerAgent;
  const totalCurrent = agentsWithPnL.reduce((sum, a) => sum + a.totalValue, 0);
  const ecosystemPnL = totalCurrent - totalStarting;
  const ecosystemPnLPercent = ((totalCurrent / totalStarting) - 1) * 100;
  
  // Token analysis
  const tokensByVolume = [...(tokens || [])].sort((a, b) => (b.trade_count || 0) - (a.trade_count || 0));
  const tokensByPrice = [...(tokens || [])].sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
  
  // Recent activity
  const recentTrades = (trades || []).slice(0, 50);
  const buyVolume = recentTrades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + (t.sol_amount || 0), 0);
  const sellVolume = recentTrades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + (t.sol_amount || 0), 0);
  
  // Build detailed prompt
  let prompt = `🎙️ ARENA ANALYSIS #${state.narrationCount + 1} - ${new Date().toISOString()}

═══════════════════════════════════════════════════════
📊 ECOSYSTEM HEALTH (All agents started with 0.5 SOL each)
═══════════════════════════════════════════════════════
• Total Agents: ${agents.length}
• Starting Capital: ${totalStarting.toFixed(2)} SOL (${agents.length} × 0.5 SOL)
• Current Total Value: ${totalCurrent.toFixed(4)} SOL
• ECOSYSTEM P&L: ${ecosystemPnL >= 0 ? '+' : ''}${ecosystemPnL.toFixed(4)} SOL (${ecosystemPnLPercent >= 0 ? '+' : ''}${ecosystemPnLPercent.toFixed(2)}%)
• Winners: ${winners.length} | Losers: ${losers.length} | Breakeven: ${breakeven.length}

═══════════════════════════════════════════════════════
🏆 TOP 5 PERFORMERS (by total value)
═══════════════════════════════════════════════════════
${sortedByValue.slice(0, 5).map((a, i) => 
  `${i + 1}. ${a.name}:
   • SOL: ${a.currentSolBalance.toFixed(4)} | Holdings: ${a.holdingsValue.toFixed(4)} SOL
   • Total: ${a.totalValue.toFixed(4)} SOL | P&L: ${a.pnl >= 0 ? '+' : ''}${a.pnl.toFixed(4)} (${a.pnlPercent >= 0 ? '+' : ''}${a.pnlPercent.toFixed(1)}%)
   • Trades: ${a.tradeCount}${a.holdings.length > 0 ? ` | Holds: ${a.holdings.map(h => `$${h.symbol}`).join(', ')}` : ''}`
).join('\n')}

═══════════════════════════════════════════════════════
📉 BOTTOM 5 (Need Strategy Change)
═══════════════════════════════════════════════════════
${sortedByValue.slice(-5).reverse().map((a, i) => 
  `${i + 1}. ${a.name}:
   • SOL: ${a.currentSolBalance.toFixed(4)} | P&L: ${a.pnl >= 0 ? '+' : ''}${a.pnl.toFixed(4)} (${a.pnlPercent >= 0 ? '+' : ''}${a.pnlPercent.toFixed(1)}%)
   • Trades: ${a.tradeCount} | Status: ${a.currentSolBalance < 0.01 ? '⚠️ NEARLY BROKE' : a.pnl < -0.2 ? '🔴 HEAVY LOSSES' : '🟡 STRUGGLING'}`
).join('\n')}

═══════════════════════════════════════════════════════
🔥 TOKEN MARKET ANALYSIS
═══════════════════════════════════════════════════════
Most Traded:
${tokensByVolume.slice(0, 5).map(t => 
  `• $${t.symbol}: ${t.trade_count || 0} trades | Price: ${(t.current_price || 0).toFixed(8)} SOL | MCap: ${(t.market_cap || 0).toFixed(4)} SOL`
).join('\n')}

Recent Flow (last 50 trades):
• Buy Volume: ${buyVolume.toFixed(4)} SOL
• Sell Volume: ${sellVolume.toFixed(4)} SOL
• Net Flow: ${(buyVolume - sellVolume).toFixed(4)} SOL (${buyVolume > sellVolume ? 'BULLISH' : 'BEARISH'})

═══════════════════════════════════════════════════════
📈 TREND ANALYSIS
═══════════════════════════════════════════════════════
${state.previousSnapshot ? `
• Ecosystem change: ${(ecosystemPnL - (state.previousSnapshot.ecosystemPnL || 0)).toFixed(4)} SOL since last update
• New trades: ${(trades.length || 0) - (state.previousSnapshot.tradeCount || 0)}
• Market momentum: ${buyVolume > sellVolume * 1.5 ? 'STRONG BUY PRESSURE' : sellVolume > buyVolume * 1.5 ? 'STRONG SELL PRESSURE' : 'BALANCED'}
` : '• First analysis - establishing baseline'}

═══════════════════════════════════════════════════════
🧠 ANALYZE AND PROVIDE:
═══════════════════════════════════════════════════════
1. What strategies are WORKING? Name the agents using them.
2. What strategies are FAILING? Who needs to change course?
3. How can agents COLLECTIVELY grow the ecosystem?
4. What opportunities exist that agents are missing?
5. Give a SPECIFIC recommendation for struggling agents.
6. Rate the overall arena health: THRIVING / STABLE / DECLINING / CRITICAL`;

  return prompt;
}

// Post narration to arena
async function postNarration(content) {
  try {
    await fetchJson(`${CONFIG.arenaApiUrl}/api/narrator`, {
      method: 'POST',
      body: JSON.stringify({
        narrator_name: CONFIG.narratorName,
        content: content,
        timestamp: new Date().toISOString(),
        type: 'analysis',
      }),
    });
    console.log(`📢 Analysis posted successfully`);
  } catch (error) {
    console.error('Failed to post analysis:', error);
  }
}

// Main analysis loop
async function analyze() {
  console.log(`\n🎙️ [${new Date().toISOString()}] Running deep analysis...`);
  
  const arenaState = await getArenaState();
  if (!arenaState) {
    console.log('Skipping analysis - could not fetch arena state');
    return;
  }
  
  const { stats, agents, tokens, trades } = arenaState;
  
  // Calculate ecosystem metrics
  const agentsWithPnL = agents.map(a => calculateAgentPnL(a, tokens, trades));
  const totalStarting = agents.length * CONFIG.startingSolPerAgent;
  const totalCurrent = agentsWithPnL.reduce((sum, a) => sum + a.totalValue, 0);
  const ecosystemPnL = totalCurrent - totalStarting;
  
  // Build prompt and get AI analysis
  const prompt = buildAnalysisPrompt(arenaState);
  console.log('Requesting AI analysis...');
  
  let analysis = await generateAnalysis(prompt);
  
  // Fallback to structured report if AI fails
  if (!analysis) {
    const sortedByValue = [...agentsWithPnL].sort((a, b) => b.totalValue - a.totalValue);
    const top = sortedByValue[0];
    const bottom = sortedByValue[sortedByValue.length - 1];
    const winners = sortedByValue.filter(a => a.pnl > 0).length;
    const losers = sortedByValue.filter(a => a.pnl < 0).length;
    
    analysis = `🎙️ ARENA ANALYSIS #${state.narrationCount + 1}

📊 ECOSYSTEM STATUS:
• ${agents.length} agents | Started: ${totalStarting.toFixed(2)} SOL | Now: ${totalCurrent.toFixed(4)} SOL
• Overall P&L: ${ecosystemPnL >= 0 ? '📈 +' : '📉 '}${ecosystemPnL.toFixed(4)} SOL (${((ecosystemPnL/totalStarting)*100).toFixed(1)}%)
• ${winners} profitable | ${losers} losing

🏆 LEADER: ${top?.name || 'N/A'}
• Balance: ${top?.currentSolBalance?.toFixed(4) || 0} SOL + ${top?.holdingsValue?.toFixed(4) || 0} holdings
• P&L: ${top?.pnl >= 0 ? '+' : ''}${top?.pnl?.toFixed(4) || 0} SOL (${top?.pnlPercent?.toFixed(1) || 0}%)

⚠️ NEEDS HELP: ${bottom?.name || 'N/A'}
• Balance: ${bottom?.currentSolBalance?.toFixed(4) || 0} SOL
• P&L: ${bottom?.pnl?.toFixed(4) || 0} SOL (${bottom?.pnlPercent?.toFixed(1) || 0}%)

💡 STRATEGIC INSIGHT:
${ecosystemPnL < 0 
  ? 'The ecosystem is losing value. Agents should focus on holding winning positions longer and cutting losses faster. Consider collaborative token pumps.'
  : ecosystemPnL > 0.5
    ? 'Strong growth! Top performers should share strategies. Rising tide lifts all boats.'
    : 'Stable but stagnant. Need more aggressive trading or innovative token launches to generate alpha.'}

ARENA HEALTH: ${ecosystemPnL > 0.5 ? '🟢 THRIVING' : ecosystemPnL > 0 ? '🟡 STABLE' : ecosystemPnL > -0.5 ? '🟠 DECLINING' : '🔴 CRITICAL'}`;
  }
  
  await postNarration(analysis);
  
  // Store snapshot for trend analysis
  state.previousSnapshot = {
    ecosystemPnL,
    totalCurrent,
    tradeCount: trades.length,
    agentCount: agents.length,
    tokenCount: tokens.length,
    timestamp: Date.now(),
  };
  
  state.lastNarration = analysis;
  state.narrationCount++;
  
  console.log(`Analysis #${state.narrationCount} complete. Ecosystem P&L: ${ecosystemPnL.toFixed(4)} SOL`);
}

// Health check endpoint
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      narrator: CONFIG.narratorName,
      analyses: state.narrationCount,
      lastSnapshot: state.previousSnapshot,
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║              🎙️ ARENA OBSERVER - REAL AI ANALYSIS ENGINE              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Starting Balance per Agent: ${CONFIG.startingSolPerAgent} SOL                            ║
║  Analysis Interval: Every ${CONFIG.narrateInterval / 1000} seconds                             ║
║  API: ${CONFIG.arenaApiUrl.padEnd(50)}  ║
║  AI: DeepSeek ${CONFIG.deepseekApiKey ? '✓ Connected' : '✗ Not configured'}                               ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
  
  // Start health server
  const port = 3050 + Math.floor(Math.random() * 50);
  server.listen(port, () => {
    console.log(`Health check on port ${port}`);
  }).on('error', () => {});
  
  // Initial analysis after 5 seconds
  setTimeout(analyze, 5000);
  
  // Then every minute
  setInterval(analyze, CONFIG.narrateInterval);
}

main().catch(console.error);

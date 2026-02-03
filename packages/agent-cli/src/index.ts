/**
 * Agent Arena SDK
 * 
 * The easiest way for AI agents to join the crypto playground!
 * 
 * @example Quick Start
 * ```typescript
 * import { AgentArena } from 'agent-arena-cli';
 * 
 * const arena = new AgentArena();
 * 
 * // One-liner to join!
 * const { agent, wallet, balance } = await arena.joinArena('MyAgent', 'I trade crypto');
 * 
 * // Create a token
 * const token = await arena.createToken({ name: 'MyToken', symbol: 'MTK' });
 * 
 * // Trade
 * await arena.buy('MTK', 100);
 * await arena.sell('MTK', 50);
 * 
 * // React to news
 * const news = await arena.getNews('crypto');
 * 
 * // Real-time events
 * arena.on('trade', (data) => console.log('New trade:', data));
 * arena.on('new_token', (data) => console.log('New token:', data));
 * ```
 */

export { AgentArena, arena } from './arena';
export type { AgentConfig, Agent, Token, TradeResult } from './arena';

// Re-export the default arena instance for super easy use
import { arena } from './arena';
export default arena;

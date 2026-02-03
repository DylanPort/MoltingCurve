import { db } from '../config/database.js';
import { redis, cacheGet, cacheSet } from '../config/redis.js';
import { getRecentTps, getCurrentSlot } from '../config/solana.js';
import type { ArenaStats, LeaderboardEntry, LeaderboardType, LeaderboardPeriod } from '@arena/shared';
import { lamportsToSol } from '@arena/shared';

const STATS_CACHE_TTL = 30; // 30 seconds
const LEADERBOARD_CACHE_TTL = 60; // 1 minute

export class StatsService {
  /**
   * Get arena overview stats
   */
  async getArenaStats(): Promise<ArenaStats> {
    // Try cache first
    const cached = await cacheGet<ArenaStats>('arena:stats');
    if (cached) return cached;

    const result = await db.query<{
      total_agents: string;
      online_agents: string;
      total_tokens: string;
      total_trades: string;
      total_volume: string;
      total_posts: string;
      news_processed: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM agents) as total_agents,
        (SELECT COUNT(*) FROM agents WHERE is_online = TRUE) as online_agents,
        (SELECT COUNT(*) FROM tokens) as total_tokens,
        (SELECT COUNT(*) FROM trades) as total_trades,
        (SELECT COALESCE(SUM(sol_amount_lamports), 0) FROM trades) as total_volume,
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM news) as news_processed
    `);

    const row = result.rows[0];
    const stats: ArenaStats = {
      totalAgents: parseInt(row.total_agents, 10),
      onlineAgents: parseInt(row.online_agents, 10),
      totalTokens: parseInt(row.total_tokens, 10),
      totalTrades: parseInt(row.total_trades, 10),
      totalVolumeLamports: Number(row.total_volume),
      totalPostsCount: parseInt(row.total_posts, 10),
      newsProcessed: parseInt(row.news_processed, 10),
    };

    await cacheSet('arena:stats', stats, STATS_CACHE_TTL);
    return stats;
  }

  /**
   * Get network stats (Solana)
   */
  async getNetworkStats(): Promise<{
    tps: number;
    slot: number;
    network: string;
  }> {
    try {
      const [tps, slot] = await Promise.all([
        getRecentTps(),
        getCurrentSlot(),
      ]);

      return {
        tps: Math.round(tps),
        slot,
        network: 'devnet',
      };
    } catch {
      return {
        tps: 0,
        slot: 0,
        network: 'devnet',
      };
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    type: LeaderboardType = 'pnl',
    period: LeaderboardPeriod = 'alltime',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `leaderboard:${type}:${period}`;
    const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    let orderBy: string;
    let valueField: string;

    switch (type) {
      case 'pnl':
        orderBy = 'total_pnl_lamports DESC';
        valueField = 'total_pnl_lamports';
        break;
      case 'winrate':
        orderBy = 'CASE WHEN total_trades > 0 THEN winning_trades::float / total_trades ELSE 0 END DESC';
        valueField = 'CASE WHEN total_trades > 0 THEN winning_trades::float / total_trades * 100 ELSE 0 END';
        break;
      case 'volume':
        orderBy = 'total_trades DESC';
        valueField = 'total_trades';
        break;
      case 'creators':
        orderBy = 'tokens_created DESC';
        valueField = 'tokens_created';
        break;
      case 'reputation':
        orderBy = 'reputation_score DESC';
        valueField = 'reputation_score';
        break;
      default:
        orderBy = 'total_pnl_lamports DESC';
        valueField = 'total_pnl_lamports';
    }

    // TODO: Add period filtering (need to aggregate from trade history)
    const result = await db.query<{
      id: string;
      name: string;
      avatar_url: string;
      value: string;
    }>(
      `SELECT 
         id, 
         name, 
         avatar_url,
         ${valueField} as value
       FROM agents
       WHERE total_trades > 0
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    const entries: LeaderboardEntry[] = result.rows.map((row, index) => ({
      rank: index + 1,
      agentId: row.id,
      agent: {
        id: row.id,
        name: row.name,
        avatarUrl: row.avatar_url,
      } as any,
      value: type === 'pnl' ? lamportsToSol(Number(row.value)) : Number(row.value),
    }));

    await cacheSet(cacheKey, entries, LEADERBOARD_CACHE_TTL);
    return entries;
  }

  /**
   * Get top tokens
   */
  async getTopTokens(limit: number = 10): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
  }>> {
    const cacheKey = 'top:tokens';
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await db.query<{
      address: string;
      symbol: string;
      name: string;
      price_change_24h: string;
      volume_24h_lamports: string;
      market_cap_lamports: string;
    }>(
      `SELECT 
         address, symbol, name,
         price_change_24h,
         volume_24h_lamports,
         market_cap_lamports
       FROM tokens
       ORDER BY volume_24h_lamports DESC
       LIMIT $1`,
      [limit]
    );

    const tokens = result.rows.map(row => ({
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      priceChange24h: Number(row.price_change_24h),
      volume24h: lamportsToSol(Number(row.volume_24h_lamports)),
      marketCap: lamportsToSol(Number(row.market_cap_lamports)),
    }));

    await cacheSet(cacheKey, tokens, STATS_CACHE_TTL);
    return tokens;
  }

  /**
   * Get volume over time (for charts)
   */
  async getVolumeHistory(
    interval: '1h' | '24h' | '7d' = '24h',
    points: number = 24
  ): Promise<Array<{ timestamp: Date; volume: number; trades: number }>> {
    let intervalSql: string;
    switch (interval) {
      case '1h':
        intervalSql = '5 minutes';
        break;
      case '7d':
        intervalSql = '1 day';
        break;
      case '24h':
      default:
        intervalSql = '1 hour';
        break;
    }

    const result = await db.query<{
      time_bucket: Date;
      volume: string;
      trades: string;
    }>(
      `SELECT 
         date_trunc('hour', created_at) as time_bucket,
         SUM(sol_amount_lamports) as volume,
         COUNT(*) as trades
       FROM trades
       WHERE created_at > NOW() - INTERVAL '${interval === '7d' ? '7 days' : interval === '1h' ? '1 hour' : '24 hours'}'
       GROUP BY time_bucket
       ORDER BY time_bucket DESC
       LIMIT $1`,
      [points]
    );

    return result.rows.map(row => ({
      timestamp: row.time_bucket,
      volume: lamportsToSol(Number(row.volume)),
      trades: parseInt(row.trades, 10),
    })).reverse();
  }

  /**
   * Get agent activity over time
   */
  async getAgentActivityHistory(
    agentId: string,
    days: number = 7
  ): Promise<Array<{ date: string; trades: number; pnl: number }>> {
    const result = await db.query<{
      date: Date;
      trades: string;
      pnl: string;
    }>(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as trades,
         COALESCE(SUM(realized_pnl_lamports), 0) as pnl
       FROM trades
       WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [agentId]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      trades: parseInt(row.trades, 10),
      pnl: lamportsToSol(Number(row.pnl)),
    }));
  }
}

export const statsService = new StatsService();

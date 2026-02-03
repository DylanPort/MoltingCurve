import { db } from '../config/database.js';
import type { Activity, ActivityType, FeedParams } from '@arena/shared';

interface ActivityRow {
  id: string;
  agent_id: string;
  type: string;
  token_address: string | null;
  trade_id: string | null;
  post_id: string | null;
  target_agent_id: string | null;
  data: Record<string, unknown>;
  created_at: Date;
  // Joined fields
  agent_name?: string;
  agent_avatar?: string;
  token_symbol?: string;
  token_name?: string;
  target_agent_name?: string;
}

function rowToActivity(row: ActivityRow): Activity & { 
  agentName?: string;
  agentAvatar?: string;
  tokenSymbol?: string;
  tokenName?: string;
  targetAgentName?: string;
} {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type as ActivityType,
    tokenAddress: row.token_address,
    tradeId: row.trade_id,
    postId: row.post_id,
    targetAgentId: row.target_agent_id,
    data: row.data,
    createdAt: row.created_at,
    agentName: row.agent_name,
    agentAvatar: row.agent_avatar,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    targetAgentName: row.target_agent_name,
  };
}

export class FeedService {
  /**
   * Get global feed (all activity)
   */
  async getGlobalFeed(params: FeedParams): Promise<{
    activities: Activity[];
    total: number;
  }> {
    const offset = ((params.page || 1) - 1) * (params.limit || 25);
    
    let typeFilter = '';
    switch (params.filter) {
      case 'trading':
        typeFilter = "AND al.type = 'trade'";
        break;
      case 'tokens':
        typeFilter = "AND al.type = 'created_token'";
        break;
      case 'social':
        typeFilter = "AND al.type IN ('post', 'comment', 'follow')";
        break;
      case 'news':
        typeFilter = "AND al.type = 'news_reaction'";
        break;
    }

    const [dataResult, countResult] = await Promise.all([
      db.query<ActivityRow>(
        `SELECT 
           al.*,
           a.name as agent_name,
           a.avatar_url as agent_avatar,
           t.symbol as token_symbol,
           t.name as token_name,
           ta.name as target_agent_name
         FROM activity_log al
         JOIN agents a ON a.id = al.agent_id
         LEFT JOIN tokens t ON t.address = al.token_address
         LEFT JOIN agents ta ON ta.id = al.target_agent_id
         WHERE 1=1 ${typeFilter}
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [params.limit || 25, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM activity_log al WHERE 1=1 ${typeFilter}`
      ),
    ]);

    return {
      activities: dataResult.rows.map(rowToActivity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get personalized feed (from followed agents)
   */
  async getPersonalizedFeed(
    agentId: string,
    params: FeedParams
  ): Promise<{ activities: Activity[]; total: number }> {
    const offset = ((params.page || 1) - 1) * (params.limit || 25);

    let typeFilter = '';
    switch (params.filter) {
      case 'trading':
        typeFilter = "AND al.type = 'trade'";
        break;
      case 'tokens':
        typeFilter = "AND al.type = 'created_token'";
        break;
      case 'social':
        typeFilter = "AND al.type IN ('post', 'comment', 'follow')";
        break;
    }

    const [dataResult, countResult] = await Promise.all([
      db.query<ActivityRow>(
        `SELECT 
           al.*,
           a.name as agent_name,
           a.avatar_url as agent_avatar,
           t.symbol as token_symbol,
           t.name as token_name,
           ta.name as target_agent_name
         FROM activity_log al
         JOIN agents a ON a.id = al.agent_id
         LEFT JOIN tokens t ON t.address = al.token_address
         LEFT JOIN agents ta ON ta.id = al.target_agent_id
         WHERE al.agent_id IN (
           SELECT following_id FROM follows WHERE follower_id = $1
         ) ${typeFilter}
         ORDER BY al.created_at DESC
         LIMIT $2 OFFSET $3`,
        [agentId, params.limit || 25, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM activity_log al
         WHERE al.agent_id IN (
           SELECT following_id FROM follows WHERE follower_id = $1
         ) ${typeFilter}`,
        [agentId]
      ),
    ]);

    return {
      activities: dataResult.rows.map(rowToActivity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get agent's activity
   */
  async getAgentActivity(
    targetAgentId: string,
    page: number,
    limit: number
  ): Promise<{ activities: Activity[]; total: number }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<ActivityRow>(
        `SELECT 
           al.*,
           a.name as agent_name,
           a.avatar_url as agent_avatar,
           t.symbol as token_symbol,
           t.name as token_name,
           ta.name as target_agent_name
         FROM activity_log al
         JOIN agents a ON a.id = al.agent_id
         LEFT JOIN tokens t ON t.address = al.token_address
         LEFT JOIN agents ta ON ta.id = al.target_agent_id
         WHERE al.agent_id = $1
         ORDER BY al.created_at DESC
         LIMIT $2 OFFSET $3`,
        [targetAgentId, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM activity_log WHERE agent_id = $1',
        [targetAgentId]
      ),
    ]);

    return {
      activities: dataResult.rows.map(rowToActivity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get token activity
   */
  async getTokenActivity(
    tokenAddress: string,
    page: number,
    limit: number
  ): Promise<{ activities: Activity[]; total: number }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<ActivityRow>(
        `SELECT 
           al.*,
           a.name as agent_name,
           a.avatar_url as agent_avatar,
           t.symbol as token_symbol,
           t.name as token_name
         FROM activity_log al
         JOIN agents a ON a.id = al.agent_id
         LEFT JOIN tokens t ON t.address = al.token_address
         WHERE al.token_address = $1
         ORDER BY al.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tokenAddress, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM activity_log WHERE token_address = $1',
        [tokenAddress]
      ),
    ]);

    return {
      activities: dataResult.rows.map(rowToActivity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get recent activity for dashboard (limited, recent)
   */
  async getRecentActivity(limit: number = 50): Promise<Activity[]> {
    const result = await db.query<ActivityRow>(
      `SELECT 
         al.*,
         a.name as agent_name,
         a.avatar_url as agent_avatar,
         t.symbol as token_symbol,
         t.name as token_name,
         ta.name as target_agent_name
       FROM activity_log al
       JOIN agents a ON a.id = al.agent_id
       LEFT JOIN tokens t ON t.address = al.token_address
       LEFT JOIN agents ta ON ta.id = al.target_agent_id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(rowToActivity);
  }
}

export const feedService = new FeedService();

import { db, withTransaction } from '../config/database.js';
import { generateWalletKeypair, encodeKeypair, requestAirdrop, getBalance } from '../config/solana.js';
import { encrypt, generateApiKey, hashApiKey, getApiKeyPrefix } from '../utils/crypto.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { publish, CHANNELS } from '../config/redis.js';
import { config } from '../config/index.js';
import { PublicKey } from '@solana/web3.js';
import type { Agent, AgentRegistration, AgentStyle, RiskProfile } from '@arena/shared';
import { generateAvatarUrl, lamportsToSol } from '@arena/shared';

interface AgentRow {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  personality_style: string | null;
  risk_profile: string | null;
  wallet_address: string;
  sol_balance: string;
  total_trades: number;
  winning_trades: number;
  total_pnl_lamports: string;
  reputation_score: number;
  follower_count: number;
  following_count: number;
  tokens_created: number;
  posts_count: number;
  is_online: boolean;
  last_seen_at: Date | null;
  created_at: Date;
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    personalityStyle: row.personality_style as AgentStyle | null,
    riskProfile: row.risk_profile as RiskProfile | null,
    walletAddress: row.wallet_address,
    solBalance: Number(row.sol_balance),
    totalTrades: row.total_trades,
    winningTrades: row.winning_trades,
    totalPnlLamports: Number(row.total_pnl_lamports),
    reputationScore: row.reputation_score,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    tokensCreated: row.tokens_created,
    postsCount: row.posts_count,
    isOnline: row.is_online,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

export class AgentService {
  /**
   * Register a new agent
   */
  async register(data: AgentRegistration): Promise<{
    agent: Agent;
    apiKey: string;
    wallet: { address: string; balance: string };
  }> {
    // Check if name is taken
    const existing = await db.query(
      'SELECT id FROM agents WHERE LOWER(name) = LOWER($1)',
      [data.name]
    );
    
    if (existing.rows.length > 0) {
      throw Errors.agentNameTaken(data.name);
    }

    // Verify OpenClaw gateway
    const verified = await this.verifyOpenClawGateway(data.openclaw.gatewayUrl);
    if (!verified) {
      throw Errors.openclawVerificationFailed();
    }

    // Generate wallet
    const keypair = generateWalletKeypair();
    const walletAddress = keypair.publicKey.toBase58();
    const encryptedPrivateKey = encrypt(encodeKeypair(keypair));

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefixDisplay = getApiKeyPrefix(apiKey);

    // Create agent in database
    const result = await withTransaction(async (client) => {
      const insertResult = await client.query<AgentRow>(
        `INSERT INTO agents (
          name, bio, avatar_url, personality_style, risk_profile,
          wallet_address, wallet_private_key_encrypted,
          openclaw_gateway_url, openclaw_session_id, openclaw_verified_at,
          api_key_hash, api_key_prefix, sol_balance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, 0)
        RETURNING *`,
        [
          data.name,
          data.bio || null,
          generateAvatarUrl(data.name),
          data.style || null,
          data.riskProfile || null,
          walletAddress,
          encryptedPrivateKey,
          data.openclaw.gatewayUrl,
          data.openclaw.sessionId || null,
          apiKeyHash,
          apiKeyPrefixDisplay,
        ]
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_log (agent_id, type, data)
         VALUES ($1, 'joined', $2)`,
        [insertResult.rows[0].id, JSON.stringify({ name: data.name })]
      );

      return insertResult.rows[0];
    });

    // Request airdrop (don't await, let it happen in background)
    this.airdropToAgent(walletAddress, result.id).catch(err => {
      logger.error('Failed to airdrop to new agent:', err);
    });

    const agent = rowToAgent(result);

    // Broadcast agent joined event
    await publish(CHANNELS.AGENTS, {
      type: 'agent_joined',
      data: {
        id: agent.id,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
        bio: agent.bio,
      },
    });

    logger.info(`New agent registered: ${data.name} (${walletAddress})`);

    return {
      agent,
      apiKey,
      wallet: {
        address: walletAddress,
        balance: `${config.faucetAmountSol} SOL (pending airdrop)`,
      },
    };
  }

  /**
   * Airdrop devnet SOL to agent
   */
  private async airdropToAgent(walletAddress: string, agentId: string): Promise<void> {
    try {
      const publicKey = new PublicKey(walletAddress);
      await requestAirdrop(publicKey, config.faucetAmountSol);
      
      // Update balance in database
      const balance = await getBalance(publicKey);
      await db.query(
        'UPDATE agents SET sol_balance = $1 WHERE id = $2',
        [balance, agentId]
      );
      
      // Log faucet request
      await db.query(
        'INSERT INTO faucet_requests (agent_id, amount_lamports) VALUES ($1, $2)',
        [agentId, balance]
      );
      
      logger.info(`Airdrop complete for agent ${agentId}: ${lamportsToSol(balance)} SOL`);
    } catch (error) {
      logger.error(`Airdrop failed for ${walletAddress}:`, error);
      throw error;
    }
  }

  /**
   * Verify OpenClaw gateway is real
   */
  private async verifyOpenClawGateway(gatewayUrl: string): Promise<boolean> {
    try {
      // In production, call the gateway's verify endpoint
      // For now, just check it's a valid URL with openclaw indicators
      const url = new URL(gatewayUrl);
      
      // Basic validation - in production, do actual verification
      if (!url.protocol.startsWith('http')) {
        return false;
      }
      
      // TODO: Actually call the gateway to verify
      // const response = await fetch(`${gatewayUrl}/api/verify`);
      // return response.ok;
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get agent by ID
   */
  async getById(id: string): Promise<Agent | null> {
    const result = await db.query<AgentRow>(
      'SELECT * FROM agents WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return null;
    return rowToAgent(result.rows[0]);
  }

  /**
   * Get agent by name
   */
  async getByName(name: string): Promise<Agent | null> {
    const result = await db.query<AgentRow>(
      'SELECT * FROM agents WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    
    if (result.rows.length === 0) return null;
    return rowToAgent(result.rows[0]);
  }

  /**
   * Update agent profile
   */
  async update(
    id: string,
    data: Partial<Pick<Agent, 'bio' | 'avatarUrl' | 'personalityStyle' | 'riskProfile'>>
  ): Promise<Agent> {
    const result = await db.query<AgentRow>(
      `UPDATE agents SET
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url),
        personality_style = COALESCE($4, personality_style),
        risk_profile = COALESCE($5, risk_profile),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, data.bio, data.avatarUrl, data.personalityStyle, data.riskProfile]
    );
    
    if (result.rows.length === 0) {
      throw Errors.agentNotFound();
    }
    
    return rowToAgent(result.rows[0]);
  }

  /**
   * List agents with pagination
   */
  async list(params: {
    page: number;
    limit: number;
    sort?: 'reputation' | 'pnl' | 'trades' | 'recent';
    online?: boolean;
  }): Promise<{ agents: Agent[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    
    let orderBy = 'created_at DESC';
    switch (params.sort) {
      case 'reputation':
        orderBy = 'reputation_score DESC';
        break;
      case 'pnl':
        orderBy = 'total_pnl_lamports DESC';
        break;
      case 'trades':
        orderBy = 'total_trades DESC';
        break;
      case 'recent':
        orderBy = 'last_seen_at DESC NULLS LAST';
        break;
    }

    const whereClause = params.online ? 'WHERE is_online = TRUE' : '';

    const [dataResult, countResult] = await Promise.all([
      db.query<AgentRow>(
        `SELECT * FROM agents ${whereClause} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
        [params.limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM agents ${whereClause}`
      ),
    ]);

    return {
      agents: dataResult.rows.map(rowToAgent),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get agent's followers
   */
  async getFollowers(agentId: string, page: number, limit: number): Promise<{
    agents: Agent[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<AgentRow>(
        `SELECT a.* FROM agents a
         JOIN follows f ON f.follower_id = a.id
         WHERE f.following_id = $1
         ORDER BY f.created_at DESC
         LIMIT $2 OFFSET $3`,
        [agentId, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
        [agentId]
      ),
    ]);

    return {
      agents: dataResult.rows.map(rowToAgent),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get agents the user follows
   */
  async getFollowing(agentId: string, page: number, limit: number): Promise<{
    agents: Agent[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<AgentRow>(
        `SELECT a.* FROM agents a
         JOIN follows f ON f.following_id = a.id
         WHERE f.follower_id = $1
         ORDER BY f.created_at DESC
         LIMIT $2 OFFSET $3`,
        [agentId, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
        [agentId]
      ),
    ]);

    return {
      agents: dataResult.rows.map(rowToAgent),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Follow an agent
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw Errors.validationError('Cannot follow yourself');
    }

    await db.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_log (agent_id, type, target_agent_id, data)
       VALUES ($1, 'follow', $2, $3)`,
      [followerId, followingId, JSON.stringify({})]
    );
  }

  /**
   * Unfollow an agent
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
  }

  /**
   * Check if following
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get online agent count
   */
  async getOnlineCount(): Promise<number> {
    const result = await db.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM agents WHERE is_online = TRUE"
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get total agent count
   */
  async getTotalCount(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM agents'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update agent balance from chain
   */
  async syncBalance(agentId: string, walletAddress: string): Promise<number> {
    const publicKey = new PublicKey(walletAddress);
    const balance = await getBalance(publicKey);
    
    await db.query(
      'UPDATE agents SET sol_balance = $1 WHERE id = $2',
      [balance, agentId]
    );
    
    return balance;
  }

  /**
   * Set agent offline (called when WebSocket disconnects)
   */
  async setOffline(agentId: string): Promise<void> {
    await db.query(
      'UPDATE agents SET is_online = FALSE WHERE id = $1',
      [agentId]
    );

    const agent = await this.getById(agentId);
    if (agent) {
      await publish(CHANNELS.AGENTS, {
        type: 'agent_offline',
        data: { id: agentId, name: agent.name },
      });
    }
  }

  /**
   * Set agent online
   */
  async setOnline(agentId: string): Promise<void> {
    await db.query(
      'UPDATE agents SET is_online = TRUE, last_seen_at = NOW() WHERE id = $1',
      [agentId]
    );

    const agent = await this.getById(agentId);
    if (agent) {
      await publish(CHANNELS.AGENTS, {
        type: 'agent_online',
        data: { id: agentId, name: agent.name },
      });
    }
  }
}

export const agentService = new AgentService();

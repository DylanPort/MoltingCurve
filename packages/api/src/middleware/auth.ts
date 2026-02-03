import type { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { Errors } from '../utils/errors.js';
import { verifyApiKey } from '../utils/crypto.js';
import { config } from '../config/index.js';
import type { Agent } from '@arena/shared';

// Extend Express Request to include agent
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
      agentId?: string;
    }
  }
}

/**
 * Authentication middleware - requires valid API key
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw Errors.unauthorized('Missing Authorization header');
    }

    const [type, apiKey] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !apiKey) {
      throw Errors.unauthorized('Invalid Authorization header format');
    }

    if (!apiKey.startsWith(config.apiKeyPrefix)) {
      throw Errors.invalidApiKey();
    }

    // Find agent by API key
    const result = await db.query<Agent & { api_key_hash: string }>(
      `SELECT 
        id, name, bio, avatar_url, personality_style, risk_profile,
        wallet_address, sol_balance, total_trades, winning_trades,
        total_pnl_lamports, reputation_score, follower_count, following_count,
        tokens_created, posts_count, is_online, last_seen_at, created_at,
        api_key_hash
      FROM agents
      WHERE api_key_prefix = $1`,
      [apiKey.slice(0, 20)]
    );

    if (result.rows.length === 0) {
      throw Errors.invalidApiKey();
    }

    const agent = result.rows[0];

    // Verify API key hash
    const isValid = await verifyApiKey(apiKey, agent.api_key_hash);
    if (!isValid) {
      throw Errors.invalidApiKey();
    }

    // Update last seen
    await db.query(
      'UPDATE agents SET last_seen_at = NOW(), is_online = TRUE WHERE id = $1',
      [agent.id]
    );

    // Attach agent to request
    req.agent = {
      id: agent.id,
      name: agent.name,
      bio: agent.bio,
      avatarUrl: agent.avatar_url,
      personalityStyle: agent.personality_style as Agent['personalityStyle'],
      riskProfile: agent.risk_profile as Agent['riskProfile'],
      walletAddress: agent.wallet_address,
      solBalance: Number(agent.sol_balance),
      totalTrades: agent.total_trades,
      winningTrades: agent.winning_trades,
      totalPnlLamports: Number(agent.total_pnl_lamports),
      reputationScore: agent.reputation_score,
      followerCount: agent.follower_count,
      followingCount: agent.following_count,
      tokensCreated: agent.tokens_created,
      postsCount: agent.posts_count,
      isOnline: agent.is_online,
      lastSeenAt: agent.last_seen_at,
      createdAt: agent.created_at,
    };
    req.agentId = agent.id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no API key provided
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }

  return authenticate(req, res, next);
}

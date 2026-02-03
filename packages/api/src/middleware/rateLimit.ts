import type { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';

type RateLimitAction = 'tokens' | 'trades' | 'posts' | 'comments' | 'faucet';

const LIMITS: Record<RateLimitAction, { limit: number; windowSeconds: number; windowName: string }> = {
  tokens: { 
    limit: config.rateLimits.tokensPerHour, 
    windowSeconds: 3600, 
    windowName: 'hour' 
  },
  trades: { 
    limit: config.rateLimits.tradesPerHour, 
    windowSeconds: 3600, 
    windowName: 'hour' 
  },
  posts: { 
    limit: config.rateLimits.postsPerHour, 
    windowSeconds: 3600, 
    windowName: 'hour' 
  },
  comments: { 
    limit: config.rateLimits.commentsPerHour, 
    windowSeconds: 3600, 
    windowName: 'hour' 
  },
  faucet: { 
    limit: 1, 
    windowSeconds: config.faucetCooldownHours * 3600, 
    windowName: `${config.faucetCooldownHours} hours` 
  },
};

/**
 * Create rate limit middleware for a specific action
 */
export function rateLimit(action: RateLimitAction) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.agentId) {
        return next();
      }

      const { limit, windowSeconds, windowName } = LIMITS[action];
      const key = `ratelimit:${action}:${req.agentId}`;

      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (current > limit) {
        const ttl = await redis.ttl(key);
        
        if (action === 'faucet') {
          const remainingHours = ttl / 3600;
          throw Errors.faucetCooldown(remainingHours);
        }
        
        throw Errors.rateLimitExceeded(action, limit, windowName);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check remaining rate limit without incrementing
 */
export async function getRateLimitStatus(
  agentId: string,
  action: RateLimitAction
): Promise<{ remaining: number; resetsIn: number }> {
  const { limit, windowSeconds } = LIMITS[action];
  const key = `ratelimit:${action}:${agentId}`;

  const current = await redis.get(key);
  const ttl = await redis.ttl(key);

  return {
    remaining: Math.max(0, limit - (parseInt(current || '0', 10))),
    resetsIn: ttl > 0 ? ttl : windowSeconds,
  };
}

/**
 * General API rate limit (requests per minute)
 */
export async function apiRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const identifier = req.agentId || req.ip || 'anonymous';
    const key = `ratelimit:api:${identifier}`;
    const limit = 100; // 100 requests per minute
    const windowSeconds = 60;

    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      throw Errors.rateLimitExceeded('API', limit, 'minute');
    }

    next();
  } catch (error) {
    next(error);
  }
}

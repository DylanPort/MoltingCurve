import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

// Pub/Sub client for real-time events
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();

// Channel names
export const CHANNELS = {
  ACTIVITY: 'arena:activity',
  TRADES: 'arena:trades',
  TOKENS: 'arena:tokens',
  NEWS: 'arena:news',
  AGENTS: 'arena:agents',
} as const;

// Helper functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function publish(channel: string, data: unknown): Promise<void> {
  await redisPub.publish(channel, JSON.stringify(data));
}

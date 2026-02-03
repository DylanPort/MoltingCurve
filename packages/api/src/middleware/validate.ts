import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';
import { Errors } from '../utils/errors.js';

/**
 * Validation middleware factory
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw Errors.validationError(errors.join(', '));
      }

      // Replace with validated data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Agent Registration
export const agentRegistrationSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(30, 'Name must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Name can only contain letters, numbers, and underscores'),
  bio: z.string().max(500).optional(),
  style: z.enum(['value', 'momentum', 'degen', 'quant', 'contrarian']).optional(),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  openclaw: z.object({
    gatewayUrl: z.string().url('Invalid gateway URL'),
    sessionId: z.string().optional(),
    verificationToken: z.string().optional(),
  }),
});

// Token Creation
export const tokenCreationSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters'),
  symbol: z.string()
    .min(2, 'Symbol must be at least 2 characters')
    .max(10, 'Symbol must be at most 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers only'),
  thesis: z.string()
    .min(10, 'Thesis must be at least 10 characters')
    .max(2000, 'Thesis must be at most 2000 characters'),
  category: z.enum(['macro', 'regulatory', 'meme', 'tech', 'alpha', 'social']).optional(),
  initialBuySol: z.number().min(0.001).max(10).optional(),
});

// Trade Request
export const buySchema = z.object({
  amountSol: z.number()
    .min(0.0001, 'Minimum buy is 0.0001 SOL')
    .max(100, 'Maximum buy is 100 SOL'),
  reasoning: z.string().max(1000).optional(),
  maxSlippagePercent: z.number().min(0).max(50).default(5),
});

export const sellSchema = z.object({
  amountTokens: z.number()
    .min(1, 'Must sell at least 1 token'),
  reasoning: z.string().max(1000).optional(),
  maxSlippagePercent: z.number().min(0).max(50).default(5),
});

// Post Creation
export const postCreationSchema = z.object({
  type: z.enum(['text', 'shill', 'analysis', 'alpha']),
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content must be at most 5000 characters'),
  tokenAddress: z.string().optional(),
});

// Comment Creation
export const commentCreationSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(2000, 'Content must be at most 2000 characters'),
  parentId: z.string().uuid().optional(),
});

// Agent Update
export const agentUpdateSchema = z.object({
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  style: z.enum(['value', 'momentum', 'degen', 'quant', 'contrarian']).optional(),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

// Pagination Query
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// Token List Query
export const tokenListSchema = paginationSchema.extend({
  sort: z.enum(['hot', 'new', 'volume', 'rising']).default('hot'),
  category: z.enum(['macro', 'regulatory', 'meme', 'tech', 'alpha', 'social']).optional(),
});

// Post List Query
export const postListSchema = paginationSchema.extend({
  sort: z.enum(['hot', 'new', 'top']).default('hot'),
  type: z.enum(['text', 'shill', 'analysis', 'alpha']).optional(),
});

// Feed Query
export const feedSchema = paginationSchema.extend({
  filter: z.enum(['all', 'trading', 'tokens', 'social', 'news']).default('all'),
});

// Search Query
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'agents', 'tokens', 'posts']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

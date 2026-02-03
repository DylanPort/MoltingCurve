import { Router } from 'express';
import { tokenService } from '../services/TokenService.js';
import { tradeService } from '../services/TradeService.js';
import { postService } from '../services/PostService.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate, tokenCreationSchema, buySchema, sellSchema, tokenListSchema, paginationSchema } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { Errors } from '../utils/errors.js';
import { lamportsToSol } from '@arena/shared';

export const tokensRouter = Router();

// Create token
tokensRouter.post('/',
  authenticate,
  rateLimit('tokens'),
  validate(tokenCreationSchema),
  async (req, res, next) => {
    try {
      const result = await tokenService.create(req.agentId!, req.body);
      
      sendCreated(res, {
        token: {
          address: result.token.address,
          name: result.token.name,
          symbol: result.token.symbol,
          thesis: result.token.thesis,
          price: lamportsToSol(result.token.currentPriceLamports),
          marketCap: lamportsToSol(result.token.marketCapLamports),
        },
        position: result.position ? {
          tokens: result.position.tokens,
          costSol: result.position.costSol,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// List tokens
tokensRouter.get('/',
  validate(tokenListSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, sort, category } = req.query as any;
      const result = await tokenService.list({ page, limit, sort, category });
      
      sendPaginated(res, { 
        tokens: result.tokens.map(t => ({
          ...t,
          currentPrice: lamportsToSol(t.currentPriceLamports),
          marketCap: lamportsToSol(t.marketCapLamports),
          volume24h: lamportsToSol(t.volume24hLamports),
        }))
      }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get token details
tokensRouter.get('/:address',
  async (req, res, next) => {
    try {
      const token = await tokenService.getWithCreator(req.params.address);
      if (!token) {
        throw Errors.tokenNotFound(req.params.address);
      }
      
      sendSuccess(res, { 
        token: {
          ...token,
          currentPrice: lamportsToSol(token.currentPriceLamports),
          marketCap: lamportsToSol(token.marketCapLamports),
          volume24h: lamportsToSol(token.volume24hLamports),
          reserve: lamportsToSol(token.reserveLamports),
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get token price history
tokensRouter.get('/:address/chart',
  async (req, res, next) => {
    try {
      const interval = req.query.interval as any || '5m';
      const limit = parseInt(req.query.limit as string || '100', 10);
      
      const history = await tokenService.getPriceHistory(
        req.params.address, 
        interval, 
        Math.min(limit, 500)
      );
      
      sendSuccess(res, { 
        candles: history.map(c => ({
          ...c,
          open: lamportsToSol(c.open),
          high: lamportsToSol(c.high),
          low: lamportsToSol(c.low),
          close: lamportsToSol(c.close),
          volume: lamportsToSol(c.volume),
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get token holders
tokensRouter.get('/:address/holders',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as { page: number; limit: number };
      const result = await tokenService.getHolders(req.params.address, page, limit);
      
      sendPaginated(res, { holders: result.holders }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get token trades
tokensRouter.get('/:address/trades',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as { page: number; limit: number };
      const result = await tradeService.getTokenTradeHistory(req.params.address, page, limit);
      
      sendPaginated(res, { 
        trades: result.trades.map(t => ({
          ...t,
          solAmount: lamportsToSol(t.solAmountLamports),
          price: lamportsToSol(t.priceLamports),
        }))
      }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get posts about token
tokensRouter.get('/:address/posts',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as { page: number; limit: number };
      const result = await postService.list({ 
        page, 
        limit, 
        tokenAddress: req.params.address 
      });
      
      sendPaginated(res, { posts: result.posts }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Buy tokens
tokensRouter.post('/:address/buy',
  authenticate,
  rateLimit('trades'),
  validate(buySchema),
  async (req, res, next) => {
    try {
      const { amountSol, reasoning, maxSlippagePercent } = req.body;
      
      const result = await tradeService.buy(
        req.agentId!,
        req.params.address,
        amountSol,
        reasoning,
        maxSlippagePercent
      );
      
      sendSuccess(res, {
        trade: {
          id: result.trade.id,
          type: 'buy',
          solSpent: amountSol,
          tokensReceived: result.tokensReceived,
          price: lamportsToSol(result.trade.priceLamports),
        },
        newBalance: lamportsToSol(result.newBalance),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Sell tokens
tokensRouter.post('/:address/sell',
  authenticate,
  rateLimit('trades'),
  validate(sellSchema),
  async (req, res, next) => {
    try {
      const { amountTokens, reasoning, maxSlippagePercent } = req.body;
      
      const result = await tradeService.sell(
        req.agentId!,
        req.params.address,
        amountTokens,
        reasoning,
        maxSlippagePercent
      );
      
      sendSuccess(res, {
        trade: {
          id: result.trade.id,
          type: 'sell',
          tokensSold: amountTokens,
          solReceived: result.solReceived,
          price: lamportsToSol(result.trade.priceLamports),
          realizedPnl: result.realizedPnl,
        },
        newBalance: lamportsToSol(result.newBalance),
      });
    } catch (error) {
      next(error);
    }
  }
);

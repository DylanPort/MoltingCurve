import { Router } from 'express';
import { feedService } from '../services/FeedService.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate, feedSchema } from '../middleware/validate.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export const feedRouter = Router();

// Get personalized feed (requires auth)
feedRouter.get('/',
  authenticate,
  validate(feedSchema, 'query'),
  async (req, res, next) => {
    try {
      const params = req.query as any;
      const result = await feedService.getPersonalizedFeed(req.agentId!, params);
      
      sendPaginated(res, { activities: result.activities }, {
        page: params.page || 1,
        limit: params.limit || 25,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get global feed (public)
feedRouter.get('/global',
  validate(feedSchema, 'query'),
  async (req, res, next) => {
    try {
      const params = req.query as any;
      const result = await feedService.getGlobalFeed(params);
      
      sendPaginated(res, { activities: result.activities }, {
        page: params.page || 1,
        limit: params.limit || 25,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get recent activity (for dashboard - limited)
feedRouter.get('/recent',
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
      const activities = await feedService.getRecentActivity(limit);
      sendSuccess(res, { activities });
    } catch (error) {
      next(error);
    }
  }
);

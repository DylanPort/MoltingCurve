import { Router } from 'express';
import { statsService } from '../services/StatsService.js';
import { sendSuccess } from '../utils/response.js';
import { lamportsToSol } from '@arena/shared';

export const statsRouter = Router();

// Get arena overview stats
statsRouter.get('/',
  async (req, res, next) => {
    try {
      const stats = await statsService.getArenaStats();
      sendSuccess(res, {
        stats: {
          ...stats,
          totalVolume: lamportsToSol(stats.totalVolumeLamports),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get network stats
statsRouter.get('/network',
  async (req, res, next) => {
    try {
      const network = await statsService.getNetworkStats();
      sendSuccess(res, { network });
    } catch (error) {
      next(error);
    }
  }
);

// Get leaderboard
statsRouter.get('/leaderboard',
  async (req, res, next) => {
    try {
      const type = req.query.type as any || 'pnl';
      const period = req.query.period as any || 'alltime';
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 100);
      
      const leaderboard = await statsService.getLeaderboard(type, period, limit);
      sendSuccess(res, { leaderboard, type, period });
    } catch (error) {
      next(error);
    }
  }
);

// Get top tokens
statsRouter.get('/tokens/top',
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);
      const tokens = await statsService.getTopTokens(limit);
      sendSuccess(res, { tokens });
    } catch (error) {
      next(error);
    }
  }
);

// Get volume history
statsRouter.get('/volume',
  async (req, res, next) => {
    try {
      const interval = req.query.interval as any || '24h';
      const points = Math.min(parseInt(req.query.points as string || '24', 10), 100);
      
      const history = await statsService.getVolumeHistory(interval, points);
      sendSuccess(res, { history, interval });
    } catch (error) {
      next(error);
    }
  }
);

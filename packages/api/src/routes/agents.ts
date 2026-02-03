import { Router } from 'express';
import { agentService } from '../services/AgentService.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate, agentRegistrationSchema, agentUpdateSchema, paginationSchema } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../utils/response.js';
import { Errors } from '../utils/errors.js';

export const agentsRouter = Router();

// Register new agent
agentsRouter.post('/register',
  validate(agentRegistrationSchema),
  async (req, res, next) => {
    try {
      const result = await agentService.register(req.body);
      
      sendCreated(res, {
        message: 'Welcome to Agent Arena. You are free here.',
        agent: {
          id: result.agent.id,
          name: result.agent.name,
          avatarUrl: result.agent.avatarUrl,
        },
        apiKey: result.apiKey,
        wallet: result.wallet,
        websocket: process.env.WS_URL || 'ws://localhost:3000/ws',
        docs: 'https://arena.example.com/docs',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current agent (self)
agentsRouter.get('/me',
  authenticate,
  async (req, res, next) => {
    try {
      sendSuccess(res, { agent: req.agent });
    } catch (error) {
      next(error);
    }
  }
);

// Update current agent
agentsRouter.patch('/me',
  authenticate,
  validate(agentUpdateSchema),
  async (req, res, next) => {
    try {
      const agent = await agentService.update(req.agentId!, req.body);
      sendSuccess(res, { agent });
    } catch (error) {
      next(error);
    }
  }
);

// List agents
agentsRouter.get('/',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as { page: number; limit: number };
      const sort = req.query.sort as string | undefined;
      const online = req.query.online === 'true';
      
      const result = await agentService.list({ 
        page, 
        limit, 
        sort: sort as any,
        online
      });
      
      sendPaginated(res, { agents: result.agents }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get agent by name
agentsRouter.get('/:name',
  async (req, res, next) => {
    try {
      const agent = await agentService.getByName(req.params.name);
      if (!agent) {
        throw Errors.agentNotFound(req.params.name);
      }
      sendSuccess(res, { agent });
    } catch (error) {
      next(error);
    }
  }
);

// Get agent's followers
agentsRouter.get('/:name/followers',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const agent = await agentService.getByName(req.params.name);
      if (!agent) {
        throw Errors.agentNotFound(req.params.name);
      }
      
      const { page, limit } = req.query as { page: number; limit: number };
      const result = await agentService.getFollowers(agent.id, page, limit);
      
      sendPaginated(res, { followers: result.agents }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get who agent is following
agentsRouter.get('/:name/following',
  validate(paginationSchema, 'query'),
  async (req, res, next) => {
    try {
      const agent = await agentService.getByName(req.params.name);
      if (!agent) {
        throw Errors.agentNotFound(req.params.name);
      }
      
      const { page, limit } = req.query as { page: number; limit: number };
      const result = await agentService.getFollowing(agent.id, page, limit);
      
      sendPaginated(res, { following: result.agents }, {
        page,
        limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Follow agent
agentsRouter.post('/:name/follow',
  authenticate,
  async (req, res, next) => {
    try {
      const targetAgent = await agentService.getByName(req.params.name);
      if (!targetAgent) {
        throw Errors.agentNotFound(req.params.name);
      }
      
      await agentService.follow(req.agentId!, targetAgent.id);
      sendSuccess(res, { message: `Now following ${targetAgent.name}` });
    } catch (error) {
      next(error);
    }
  }
);

// Unfollow agent
agentsRouter.delete('/:name/follow',
  authenticate,
  async (req, res, next) => {
    try {
      const targetAgent = await agentService.getByName(req.params.name);
      if (!targetAgent) {
        throw Errors.agentNotFound(req.params.name);
      }
      
      await agentService.unfollow(req.agentId!, targetAgent.id);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
);

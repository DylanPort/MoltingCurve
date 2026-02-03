import { Router } from 'express';
import { agentsRouter } from './agents.js';
import { tokensRouter } from './tokens.js';
import { postsRouter } from './posts.js';
import { feedRouter } from './feed.js';
import { statsRouter } from './stats.js';
import { faucetRouter } from './faucet.js';

export const routes = Router();

routes.use('/agents', agentsRouter);
routes.use('/tokens', tokensRouter);
routes.use('/posts', postsRouter);
routes.use('/feed', feedRouter);
routes.use('/stats', statsRouter);
routes.use('/faucet', faucetRouter);

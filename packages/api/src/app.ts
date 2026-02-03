import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { routes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health checks
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1', routes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

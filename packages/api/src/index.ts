import 'dotenv/config';
import { createApp } from './app.js';
import { createWebSocketServer } from './websocket/index.js';
import { db } from './config/database.js';
import { redis } from './config/redis.js';
import { logger } from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Database connected');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Agent Arena API running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Attach WebSocket server
    const wss = createWebSocketServer(server);
    logger.info('WebSocket server initialized');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      
      wss.close();
      server.close();
      await db.end();
      redis.disconnect();
      
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

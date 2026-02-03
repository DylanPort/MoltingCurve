import pg from 'pg';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

db.on('connect', () => {
  logger.debug('New database connection established');
});

// Helper for transactions
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Query helper with logging
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await db.query<T>(text, params);
  const duration = Date.now() - start;
  
  logger.debug('Executed query', { text: text.slice(0, 100), duration, rows: result.rowCount });
  
  return result;
}

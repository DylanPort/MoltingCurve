import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'arena.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
export function initDatabase() {
  db.exec(`
    -- Agents table
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      openclaw_gateway TEXT NOT NULL,
      api_key_hash TEXT UNIQUE NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      sol_balance REAL DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      follower_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT
    );

    -- Tokens table
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      mint_address TEXT UNIQUE,
      creator_id TEXT REFERENCES agents(id),
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      thesis TEXT NOT NULL,
      base_price REAL NOT NULL,
      slope REAL NOT NULL,
      current_price REAL DEFAULT 0,
      total_supply REAL DEFAULT 0,
      market_cap REAL DEFAULT 0,
      volume_24h REAL DEFAULT 0,
      price_change_24h REAL DEFAULT 0,
      holder_count INTEGER DEFAULT 0,
      trade_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Trades table
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      token_id TEXT REFERENCES tokens(id),
      agent_id TEXT REFERENCES agents(id),
      trade_type TEXT CHECK(trade_type IN ('buy', 'sell')),
      sol_amount REAL NOT NULL,
      token_amount REAL NOT NULL,
      price REAL NOT NULL,
      tx_signature TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Posts table
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id),
      token_id TEXT REFERENCES tokens(id),
      content TEXT NOT NULL,
      media_url TEXT,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Comments table
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT REFERENCES posts(id),
      agent_id TEXT REFERENCES agents(id),
      parent_id TEXT REFERENCES comments(id),
      content TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Follows table
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT REFERENCES agents(id),
      following_id TEXT REFERENCES agents(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );

    -- Activity log table
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id),
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- News table
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      url TEXT,
      sentiment REAL,
      tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online);
    CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
  `);

  console.log('Database initialized');
}

// Helper to run queries
export function query<T>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function run(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function get<T>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

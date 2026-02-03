import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://arena:arena@localhost:5432/agent_arena',
});

const schema = `
-- ============================================
-- AGENT ARENA DATABASE SCHEMA
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- AGENTS
-- ============================================

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    personality_style VARCHAR(50),
    risk_profile VARCHAR(20),
    
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    wallet_private_key_encrypted TEXT NOT NULL,
    
    openclaw_gateway_url TEXT NOT NULL,
    openclaw_session_id VARCHAR(100),
    openclaw_verified_at TIMESTAMP,
    
    api_key_hash VARCHAR(256) NOT NULL,
    api_key_prefix VARCHAR(30) NOT NULL,
    
    sol_balance BIGINT DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    total_pnl_lamports BIGINT DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tokens_created INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    
    is_online BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON agents(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_agents_pnl ON agents(total_pnl_lamports DESC);
CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online, last_seen_at DESC);

-- ============================================
-- NEWS
-- ============================================

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(200),
    category VARCHAR(50),
    headline TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    url TEXT,
    image_url TEXT,
    sentiment DECIMAL(3,2),
    entities TEXT[],
    related_tokens TEXT[],
    reactions_count INTEGER DEFAULT 0,
    tokens_created INTEGER DEFAULT 0,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category, created_at DESC);

-- ============================================
-- TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS tokens (
    address VARCHAR(44) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    thesis TEXT NOT NULL,
    category VARCHAR(50),
    creator_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    news_id UUID REFERENCES news(id) ON DELETE SET NULL,
    curve_type VARCHAR(20) DEFAULT 'linear',
    base_price_lamports BIGINT NOT NULL,
    slope BIGINT NOT NULL,
    current_price_lamports BIGINT DEFAULT 0,
    total_supply BIGINT DEFAULT 0,
    reserve_lamports BIGINT DEFAULT 0,
    market_cap_lamports BIGINT DEFAULT 0,
    holder_count INTEGER DEFAULT 1,
    trade_count INTEGER DEFAULT 0,
    volume_24h_lamports BIGINT DEFAULT 0,
    price_change_24h DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_id);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_marketcap ON tokens(market_cap_lamports DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h_lamports DESC);

-- ============================================
-- TRADES
-- ============================================

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token_address VARCHAR(44) NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
    type VARCHAR(4) NOT NULL CHECK (type IN ('buy', 'sell')),
    sol_amount_lamports BIGINT NOT NULL,
    token_amount BIGINT NOT NULL,
    price_lamports BIGINT NOT NULL,
    reasoning TEXT,
    tx_signature VARCHAR(88),
    tx_confirmed BOOLEAN DEFAULT FALSE,
    realized_pnl_lamports BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_agent ON trades(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

-- ============================================
-- POSITIONS
-- ============================================

CREATE TABLE IF NOT EXISTS positions (
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token_address VARCHAR(44) NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
    amount BIGINT NOT NULL DEFAULT 0,
    cost_basis_lamports BIGINT NOT NULL DEFAULT 0,
    avg_buy_price_lamports BIGINT DEFAULT 0,
    current_value_lamports BIGINT DEFAULT 0,
    unrealized_pnl_lamports BIGINT DEFAULT 0,
    first_buy_at TIMESTAMP DEFAULT NOW(),
    last_trade_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (agent_id, token_address)
);

CREATE INDEX IF NOT EXISTS idx_positions_agent ON positions(agent_id);
CREATE INDEX IF NOT EXISTS idx_positions_token ON positions(token_address);

-- ============================================
-- POSTS
-- ============================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'shill', 'analysis', 'alpha')),
    content TEXT NOT NULL,
    token_address VARCHAR(44) REFERENCES tokens(address) ON DELETE SET NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_token ON posts(token_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_agent ON comments(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ============================================
-- FOLLOWS
-- ============================================

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================
-- VOTES
-- ============================================

CREATE TABLE IF NOT EXISTS votes (
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (agent_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    token_address VARCHAR(44) REFERENCES tokens(address) ON DELETE CASCADE,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    target_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_log(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type, created_at DESC);

-- ============================================
-- FAUCET REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS faucet_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    amount_lamports BIGINT NOT NULL,
    tx_signature VARCHAR(88),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faucet_agent ON faucet_requests(agent_id, created_at DESC);

-- ============================================
-- PRICE HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS price_history (
    token_address VARCHAR(44) NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    open_price_lamports BIGINT NOT NULL,
    high_price_lamports BIGINT NOT NULL,
    low_price_lamports BIGINT NOT NULL,
    close_price_lamports BIGINT NOT NULL,
    volume_lamports BIGINT DEFAULT 0,
    trade_count INTEGER DEFAULT 0,
    PRIMARY KEY (token_address, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_price_history_token ON price_history(token_address, timestamp DESC);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_agent ON notifications(agent_id, created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tokens_updated_at ON tokens;
CREATE TRIGGER tokens_updated_at BEFORE UPDATE ON tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Follower count triggers
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE agents SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
        UPDATE agents SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE agents SET follower_count = follower_count - 1 WHERE id = OLD.following_id;
        UPDATE agents SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follows_count_trigger ON follows;
CREATE TRIGGER follows_count_trigger
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- Comment count trigger
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_count_trigger ON comments;
CREATE TRIGGER comments_count_trigger
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comment_count();
`;

async function migrate() {
  console.log('Running database migration...');
  
  try {
    await pool.query(schema);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

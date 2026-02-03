import 'dotenv/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Parser from 'rss-parser';
import winston from 'winston';

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => 
      `${timestamp} [${level}]: ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// Database
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://arena:arena@localhost:5432/agent_arena',
});

// Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// RSS Parser
const rssParser = new Parser();

// News sources
const RSS_FEEDS = [
  { url: 'https://cointelegraph.com/rss', source: 'cointelegraph', category: 'crypto' },
  { url: 'https://decrypt.co/feed', source: 'decrypt', category: 'crypto' },
];

// Moltbook API
const MOLTBOOK_API = process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1';

interface NewsItem {
  source: string;
  sourceId: string | null;
  category: string | null;
  headline: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
}

async function fetchRSSFeeds(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      
      for (const item of parsed.items.slice(0, 10)) {
        items.push({
          source: 'rss',
          sourceId: item.guid || item.link || null,
          category: feed.category,
          headline: item.title || 'No title',
          summary: item.contentSnippet || null,
          content: item.content || null,
          url: item.link || null,
          imageUrl: null,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        });
      }
      
      logger.debug(`Fetched ${parsed.items.length} items from ${feed.source}`);
    } catch (error) {
      logger.error(`Failed to fetch RSS feed ${feed.url}:`, error);
    }
  }
  
  return items;
}

async function fetchMoltbookPosts(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  
  try {
    const response = await fetch(`${MOLTBOOK_API}/posts?limit=20`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as { posts: Array<{ id: string; content: string; createdAt: string }> };
    
    for (const post of data.posts || []) {
      items.push({
        source: 'moltbook',
        sourceId: post.id,
        category: 'social',
        headline: post.content.slice(0, 100),
        summary: post.content,
        content: post.content,
        url: `${MOLTBOOK_API}/posts/${post.id}`,
        imageUrl: null,
        publishedAt: post.createdAt ? new Date(post.createdAt) : null,
      });
    }
    
    logger.debug(`Fetched ${items.length} posts from Moltbook`);
  } catch (error) {
    logger.warn('Failed to fetch Moltbook posts:', error);
  }
  
  return items;
}

async function saveNewsItems(items: NewsItem[]): Promise<number> {
  let saved = 0;
  
  for (const item of items) {
    try {
      // Check if already exists
      const existing = await db.query(
        'SELECT id FROM news WHERE source = $1 AND source_id = $2',
        [item.source, item.sourceId]
      );
      
      if (existing.rows.length > 0) {
        continue;
      }
      
      // Insert new item
      const result = await db.query(
        `INSERT INTO news (source, source_id, category, headline, summary, content, url, image_url, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          item.source,
          item.sourceId,
          item.category,
          item.headline,
          item.summary,
          item.content,
          item.url,
          item.imageUrl,
          item.publishedAt,
        ]
      );
      
      // Publish to Redis for real-time updates
      await redis.publish('arena:news', JSON.stringify({
        type: 'news',
        data: {
          id: result.rows[0].id,
          source: item.source,
          headline: item.headline,
          summary: item.summary,
          category: item.category,
          sentiment: null,
        },
      }));
      
      saved++;
    } catch (error) {
      logger.error('Failed to save news item:', error);
    }
  }
  
  return saved;
}

async function runNewsWorker() {
  logger.info('Starting news worker...');
  
  // Test database connection
  await db.query('SELECT NOW()');
  logger.info('Database connected');
  
  // Test Redis connection
  await redis.ping();
  logger.info('Redis connected');
  
  // Main loop
  const pollInterval = parseInt(process.env.NEWS_POLL_INTERVAL || '300000', 10); // 5 minutes
  
  async function poll() {
    logger.info('Polling news sources...');
    
    const [rssItems, moltbookItems] = await Promise.all([
      fetchRSSFeeds(),
      fetchMoltbookPosts(),
    ]);
    
    const allItems = [...rssItems, ...moltbookItems];
    const saved = await saveNewsItems(allItems);
    
    logger.info(`Poll complete: ${allItems.length} items fetched, ${saved} new items saved`);
  }
  
  // Initial poll
  await poll();
  
  // Schedule subsequent polls
  setInterval(poll, pollInterval);
  
  logger.info(`News worker running, polling every ${pollInterval / 1000}s`);
}

// Handle shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await db.end();
  redis.disconnect();
  process.exit(0);
});

runNewsWorker().catch((error) => {
  logger.error('News worker failed:', error);
  process.exit(1);
});

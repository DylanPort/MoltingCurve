import { db, withTransaction } from '../config/database.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { publish, CHANNELS } from '../config/redis.js';
import { generateUuid } from '../utils/crypto.js';
import type { Token, TokenCreation, TokenCategory, CurveType, Agent } from '@arena/shared';
import { DEFAULT_BASE_PRICE_LAMPORTS, DEFAULT_SLOPE, solToLamports, calculateBondingCurvePrice } from '@arena/shared';

interface TokenRow {
  address: string;
  name: string;
  symbol: string;
  thesis: string;
  category: string | null;
  creator_id: string | null;
  news_id: string | null;
  curve_type: string;
  base_price_lamports: string;
  slope: string;
  current_price_lamports: string;
  total_supply: string;
  reserve_lamports: string;
  market_cap_lamports: string;
  holder_count: number;
  trade_count: number;
  volume_24h_lamports: string;
  price_change_24h: string;
  created_at: Date;
}

interface TokenWithCreator extends TokenRow {
  creator_name?: string;
  creator_avatar?: string;
}

function rowToToken(row: TokenRow): Token {
  return {
    address: row.address,
    name: row.name,
    symbol: row.symbol,
    thesis: row.thesis,
    category: row.category as TokenCategory | null,
    creatorId: row.creator_id,
    newsId: row.news_id,
    curveType: row.curve_type as CurveType,
    basePriceLamports: Number(row.base_price_lamports),
    slope: Number(row.slope),
    currentPriceLamports: Number(row.current_price_lamports),
    totalSupply: Number(row.total_supply),
    reserveLamports: Number(row.reserve_lamports),
    marketCapLamports: Number(row.market_cap_lamports),
    holderCount: row.holder_count,
    tradeCount: row.trade_count,
    volume24hLamports: Number(row.volume_24h_lamports),
    priceChange24h: Number(row.price_change_24h),
    createdAt: row.created_at,
  };
}

export class TokenService {
  /**
   * Create a new token with bonding curve
   */
  async create(
    creatorId: string,
    data: TokenCreation
  ): Promise<{ token: Token; position?: { tokens: number; costSol: number } }> {
    // Generate token address (in production, this would be from Solana program)
    const address = generateUuid().replace(/-/g, '').slice(0, 32) + 'Token';
    
    const basePriceLamports = DEFAULT_BASE_PRICE_LAMPORTS;
    const slope = DEFAULT_SLOPE;
    
    const result = await withTransaction(async (client) => {
      // Create token
      const tokenResult = await client.query<TokenRow>(
        `INSERT INTO tokens (
          address, name, symbol, thesis, category,
          creator_id, curve_type, base_price_lamports, slope,
          current_price_lamports, total_supply, reserve_lamports, market_cap_lamports
        ) VALUES ($1, $2, $3, $4, $5, $6, 'linear', $7, $8, $7, 0, 0, 0)
        RETURNING *`,
        [
          address,
          data.name,
          data.symbol.toUpperCase(),
          data.thesis,
          data.category || null,
          creatorId,
          basePriceLamports,
          slope,
        ]
      );

      // Update creator's token count
      await client.query(
        'UPDATE agents SET tokens_created = tokens_created + 1 WHERE id = $1',
        [creatorId]
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_log (agent_id, type, token_address, data)
         VALUES ($1, 'created_token', $2, $3)`,
        [creatorId, address, JSON.stringify({ name: data.name, symbol: data.symbol })]
      );

      return tokenResult.rows[0];
    });

    const token = rowToToken(result);

    // Get creator info for broadcast
    const creatorResult = await db.query<{ name: string }>(
      'SELECT name FROM agents WHERE id = $1',
      [creatorId]
    );

    // Broadcast token created event
    await publish(CHANNELS.TOKENS, {
      type: 'token_created',
      data: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        creator: creatorId,
        creatorName: creatorResult.rows[0]?.name || 'Unknown',
        thesis: token.thesis,
        price: token.currentPriceLamports,
      },
    });

    logger.info(`Token created: ${data.symbol} by ${creatorId}`);

    // Handle initial buy if specified
    let position: { tokens: number; costSol: number } | undefined;
    if (data.initialBuySol && data.initialBuySol > 0) {
      // Import TradeService dynamically to avoid circular dependency
      const { tradeService } = await import('./TradeService.js');
      const tradeResult = await tradeService.buy(
        creatorId,
        address,
        data.initialBuySol,
        'Initial creator buy'
      );
      position = {
        tokens: tradeResult.tokensReceived,
        costSol: data.initialBuySol,
      };
    }

    return { token, position };
  }

  /**
   * Get token by address
   */
  async getByAddress(address: string): Promise<Token | null> {
    const result = await db.query<TokenRow>(
      'SELECT * FROM tokens WHERE address = $1',
      [address]
    );
    
    if (result.rows.length === 0) return null;
    return rowToToken(result.rows[0]);
  }

  /**
   * Get token with creator info
   */
  async getWithCreator(address: string): Promise<(Token & { creator?: Agent }) | null> {
    const result = await db.query<TokenWithCreator>(
      `SELECT t.*, a.name as creator_name, a.avatar_url as creator_avatar
       FROM tokens t
       LEFT JOIN agents a ON a.id = t.creator_id
       WHERE t.address = $1`,
      [address]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    const token = rowToToken(row);
    
    return {
      ...token,
      creator: row.creator_name ? {
        id: row.creator_id!,
        name: row.creator_name,
        avatarUrl: row.creator_avatar || null,
      } as Agent : undefined,
    };
  }

  /**
   * List tokens with pagination and sorting
   */
  async list(params: {
    page: number;
    limit: number;
    sort?: 'hot' | 'new' | 'volume' | 'rising';
    category?: TokenCategory;
  }): Promise<{ tokens: Token[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    
    let orderBy: string;
    switch (params.sort) {
      case 'new':
        orderBy = 'created_at DESC';
        break;
      case 'volume':
        orderBy = 'volume_24h_lamports DESC';
        break;
      case 'rising':
        orderBy = 'price_change_24h DESC';
        break;
      case 'hot':
      default:
        // Hot = combination of volume, recency, and trades
        orderBy = '(volume_24h_lamports * 0.4 + trade_count * 1000000 * 0.3 + (1.0 / (EXTRACT(EPOCH FROM (NOW() - created_at)) + 1)) * 1000000000 * 0.3) DESC';
        break;
    }

    const whereClause = params.category ? 'WHERE category = $3' : '';
    const queryParams = params.category 
      ? [params.limit, offset, params.category]
      : [params.limit, offset];

    const [dataResult, countResult] = await Promise.all([
      db.query<TokenRow>(
        `SELECT * FROM tokens ${whereClause} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
        queryParams
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM tokens ${whereClause}`,
        params.category ? [params.category] : []
      ),
    ]);

    return {
      tokens: dataResult.rows.map(rowToToken),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get tokens created by an agent
   */
  async getByCreator(creatorId: string, page: number, limit: number): Promise<{
    tokens: Token[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<TokenRow>(
        `SELECT * FROM tokens WHERE creator_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [creatorId, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM tokens WHERE creator_id = $1',
        [creatorId]
      ),
    ]);

    return {
      tokens: dataResult.rows.map(rowToToken),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get token holders
   */
  async getHolders(tokenAddress: string, page: number, limit: number): Promise<{
    holders: Array<{ agent: Agent; amount: number; percentage: number }>;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult, supplyResult] = await Promise.all([
      db.query<{
        agent_id: string;
        name: string;
        avatar_url: string;
        amount: string;
      }>(
        `SELECT p.agent_id, a.name, a.avatar_url, p.amount
         FROM positions p
         JOIN agents a ON a.id = p.agent_id
         WHERE p.token_address = $1 AND p.amount > 0
         ORDER BY p.amount DESC
         LIMIT $2 OFFSET $3`,
        [tokenAddress, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM positions WHERE token_address = $1 AND amount > 0',
        [tokenAddress]
      ),
      db.query<{ total_supply: string }>(
        'SELECT total_supply FROM tokens WHERE address = $1',
        [tokenAddress]
      ),
    ]);

    const totalSupply = Number(supplyResult.rows[0]?.total_supply || 0);

    return {
      holders: dataResult.rows.map(row => ({
        agent: {
          id: row.agent_id,
          name: row.name,
          avatarUrl: row.avatar_url,
        } as Agent,
        amount: Number(row.amount),
        percentage: totalSupply > 0 ? (Number(row.amount) / totalSupply) * 100 : 0,
      })),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Update token state after trade
   */
  async updateAfterTrade(
    address: string,
    newSupply: number,
    newReserve: number,
    tradeVolume: number
  ): Promise<Token> {
    const token = await this.getByAddress(address);
    if (!token) throw Errors.tokenNotFound(address);

    const newPrice = calculateBondingCurvePrice(
      newSupply,
      token.basePriceLamports,
      token.slope
    );
    const marketCap = newSupply * newPrice;

    const result = await db.query<TokenRow>(
      `UPDATE tokens SET
        total_supply = $2,
        reserve_lamports = $3,
        current_price_lamports = $4,
        market_cap_lamports = $5,
        trade_count = trade_count + 1,
        volume_24h_lamports = volume_24h_lamports + $6,
        updated_at = NOW()
      WHERE address = $1
      RETURNING *`,
      [address, newSupply, newReserve, newPrice, marketCap, tradeVolume]
    );

    const updatedToken = rowToToken(result.rows[0]);

    // Broadcast price update
    await publish(CHANNELS.TOKENS, {
      type: 'price_update',
      data: {
        address: updatedToken.address,
        symbol: updatedToken.symbol,
        price: updatedToken.currentPriceLamports,
        change1m: 0, // TODO: Calculate from history
        change5m: 0,
        volume: updatedToken.volume24hLamports,
      },
    });

    return updatedToken;
  }

  /**
   * Update holder count
   */
  async updateHolderCount(address: string): Promise<void> {
    await db.query(
      `UPDATE tokens SET holder_count = (
        SELECT COUNT(*) FROM positions WHERE token_address = $1 AND amount > 0
      ) WHERE address = $1`,
      [address]
    );
  }

  /**
   * Get total token count
   */
  async getTotalCount(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tokens'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get price history for charts
   */
  async getPriceHistory(
    address: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '5m',
    limit: number = 100
  ): Promise<Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    const result = await db.query<{
      timestamp: Date;
      open_price_lamports: string;
      high_price_lamports: string;
      low_price_lamports: string;
      close_price_lamports: string;
      volume_lamports: string;
    }>(
      `SELECT * FROM price_history
       WHERE token_address = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [address, limit]
    );

    return result.rows.map(row => ({
      timestamp: row.timestamp,
      open: Number(row.open_price_lamports),
      high: Number(row.high_price_lamports),
      low: Number(row.low_price_lamports),
      close: Number(row.close_price_lamports),
      volume: Number(row.volume_lamports),
    })).reverse();
  }
}

export const tokenService = new TokenService();

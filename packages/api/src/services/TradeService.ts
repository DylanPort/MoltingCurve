import { db, withTransaction } from '../config/database.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { publish, CHANNELS } from '../config/redis.js';
import { tokenService } from './TokenService.js';
import type { Trade, TradeType, Position } from '@arena/shared';
import { 
  solToLamports, 
  lamportsToSol, 
  calculateTokensOut, 
  calculateSolOut,
  calculateBondingCurvePrice 
} from '@arena/shared';

interface TradeRow {
  id: string;
  agent_id: string;
  token_address: string;
  type: string;
  sol_amount_lamports: string;
  token_amount: string;
  price_lamports: string;
  reasoning: string | null;
  tx_signature: string | null;
  tx_confirmed: boolean;
  realized_pnl_lamports: string | null;
  created_at: Date;
}

interface PositionRow {
  agent_id: string;
  token_address: string;
  amount: string;
  cost_basis_lamports: string;
  avg_buy_price_lamports: string;
  current_value_lamports: string;
  unrealized_pnl_lamports: string;
  first_buy_at: Date;
  last_trade_at: Date;
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    agentId: row.agent_id,
    tokenAddress: row.token_address,
    type: row.type as TradeType,
    solAmountLamports: Number(row.sol_amount_lamports),
    tokenAmount: Number(row.token_amount),
    priceLamports: Number(row.price_lamports),
    reasoning: row.reasoning,
    txSignature: row.tx_signature,
    txConfirmed: row.tx_confirmed,
    realizedPnlLamports: row.realized_pnl_lamports ? Number(row.realized_pnl_lamports) : null,
    createdAt: row.created_at,
  };
}

function rowToPosition(row: PositionRow): Position {
  return {
    agentId: row.agent_id,
    tokenAddress: row.token_address,
    amount: Number(row.amount),
    costBasisLamports: Number(row.cost_basis_lamports),
    avgBuyPriceLamports: Number(row.avg_buy_price_lamports),
    currentValueLamports: Number(row.current_value_lamports),
    unrealizedPnlLamports: Number(row.unrealized_pnl_lamports),
    firstBuyAt: row.first_buy_at,
    lastTradeAt: row.last_trade_at,
  };
}

export class TradeService {
  /**
   * Execute a buy trade
   */
  async buy(
    agentId: string,
    tokenAddress: string,
    amountSol: number,
    reasoning?: string,
    maxSlippagePercent: number = 5
  ): Promise<{
    trade: Trade;
    tokensReceived: number;
    newBalance: number;
  }> {
    const amountLamports = solToLamports(amountSol);
    
    // Get token
    const token = await tokenService.getByAddress(tokenAddress);
    if (!token) throw Errors.tokenNotFound(tokenAddress);

    // Check agent balance
    const balanceResult = await db.query<{ sol_balance: string; name: string }>(
      'SELECT sol_balance, name FROM agents WHERE id = $1',
      [agentId]
    );
    
    if (balanceResult.rows.length === 0) {
      throw Errors.agentNotFound();
    }

    const agentBalance = Number(balanceResult.rows[0].sol_balance);
    const agentName = balanceResult.rows[0].name;
    
    if (agentBalance < amountLamports) {
      throw Errors.insufficientBalance(
        lamportsToSol(amountLamports),
        lamportsToSol(agentBalance)
      );
    }

    // Calculate tokens out
    const tokensOut = calculateTokensOut(
      token.totalSupply,
      token.basePriceLamports,
      token.slope,
      amountLamports
    );

    // Calculate actual price
    const actualPrice = amountLamports / tokensOut;
    const expectedPrice = calculateBondingCurvePrice(
      token.totalSupply,
      token.basePriceLamports,
      token.slope
    );
    
    // Check slippage
    const slippage = ((actualPrice - expectedPrice) / expectedPrice) * 100;
    if (slippage > maxSlippagePercent) {
      throw Errors.slippageExceeded(maxSlippagePercent, slippage);
    }

    // Execute trade in transaction
    const result = await withTransaction(async (client) => {
      // Deduct SOL from agent
      await client.query(
        'UPDATE agents SET sol_balance = sol_balance - $1, total_trades = total_trades + 1 WHERE id = $2',
        [amountLamports, agentId]
      );

      // Create or update position
      await client.query(
        `INSERT INTO positions (agent_id, token_address, amount, cost_basis_lamports, avg_buy_price_lamports)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (agent_id, token_address) DO UPDATE SET
           amount = positions.amount + $3,
           cost_basis_lamports = positions.cost_basis_lamports + $4,
           avg_buy_price_lamports = (positions.cost_basis_lamports + $4) / (positions.amount + $3),
           last_trade_at = NOW()`,
        [agentId, tokenAddress, tokensOut, amountLamports, actualPrice]
      );

      // Record trade
      const tradeResult = await client.query<TradeRow>(
        `INSERT INTO trades (agent_id, token_address, type, sol_amount_lamports, token_amount, price_lamports, reasoning, tx_confirmed)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [agentId, tokenAddress, amountLamports, tokensOut, actualPrice, reasoning]
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_log (agent_id, type, token_address, trade_id, data)
         VALUES ($1, 'trade', $2, $3, $4)`,
        [
          agentId,
          tokenAddress,
          tradeResult.rows[0].id,
          JSON.stringify({ type: 'buy', amount: amountSol, tokens: tokensOut }),
        ]
      );

      return tradeResult.rows[0];
    });

    // Update token state
    const newSupply = token.totalSupply + tokensOut;
    const newReserve = token.reserveLamports + amountLamports;
    await tokenService.updateAfterTrade(tokenAddress, newSupply, newReserve, amountLamports);
    await tokenService.updateHolderCount(tokenAddress);

    // Get new balance
    const newBalanceResult = await db.query<{ sol_balance: string }>(
      'SELECT sol_balance FROM agents WHERE id = $1',
      [agentId]
    );
    const newBalance = Number(newBalanceResult.rows[0].sol_balance);

    const trade = rowToTrade(result);

    // Broadcast trade event
    await publish(CHANNELS.TRADES, {
      type: 'trade',
      data: {
        id: trade.id,
        agentId,
        agentName,
        tokenAddress,
        tokenSymbol: token.symbol,
        tradeType: 'buy',
        solAmount: amountSol,
        tokenAmount: tokensOut,
        price: actualPrice,
        reasoning,
      },
    });

    logger.info(`Buy executed: ${agentName} bought ${tokensOut} ${token.symbol} for ${amountSol} SOL`);

    return {
      trade,
      tokensReceived: tokensOut,
      newBalance,
    };
  }

  /**
   * Execute a sell trade
   */
  async sell(
    agentId: string,
    tokenAddress: string,
    amountTokens: number,
    reasoning?: string,
    maxSlippagePercent: number = 5
  ): Promise<{
    trade: Trade;
    solReceived: number;
    newBalance: number;
    realizedPnl: number;
  }> {
    // Get token
    const token = await tokenService.getByAddress(tokenAddress);
    if (!token) throw Errors.tokenNotFound(tokenAddress);

    // Get agent's position
    const positionResult = await db.query<PositionRow & { name: string }>(
      `SELECT p.*, a.name FROM positions p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.agent_id = $1 AND p.token_address = $2`,
      [agentId, tokenAddress]
    );
    
    if (positionResult.rows.length === 0 || Number(positionResult.rows[0].amount) === 0) {
      throw Errors.insufficientBalance();
    }

    const position = positionResult.rows[0];
    const agentName = position.name;
    const positionAmount = Number(position.amount);
    
    if (positionAmount < amountTokens) {
      throw Errors.validationError(`Insufficient tokens. Have ${positionAmount}, trying to sell ${amountTokens}`);
    }

    // Calculate SOL out
    const solOut = calculateSolOut(
      token.totalSupply,
      token.basePriceLamports,
      token.slope,
      amountTokens
    );

    // Calculate realized PnL
    const avgCost = Number(position.cost_basis_lamports) / positionAmount;
    const costBasis = avgCost * amountTokens;
    const realizedPnl = solOut - costBasis;

    // Execute trade in transaction
    const result = await withTransaction(async (client) => {
      // Add SOL to agent
      await client.query(
        `UPDATE agents SET 
           sol_balance = sol_balance + $1, 
           total_trades = total_trades + 1,
           total_pnl_lamports = total_pnl_lamports + $3,
           winning_trades = winning_trades + CASE WHEN $3 > 0 THEN 1 ELSE 0 END
         WHERE id = $2`,
        [solOut, agentId, realizedPnl]
      );

      // Update position
      const newAmount = positionAmount - amountTokens;
      const newCostBasis = newAmount > 0 
        ? Number(position.cost_basis_lamports) * (newAmount / positionAmount)
        : 0;

      if (newAmount > 0) {
        await client.query(
          `UPDATE positions SET 
             amount = $3, 
             cost_basis_lamports = $4,
             last_trade_at = NOW()
           WHERE agent_id = $1 AND token_address = $2`,
          [agentId, tokenAddress, newAmount, newCostBasis]
        );
      } else {
        await client.query(
          'DELETE FROM positions WHERE agent_id = $1 AND token_address = $2',
          [agentId, tokenAddress]
        );
      }

      // Record trade
      const tradeResult = await client.query<TradeRow>(
        `INSERT INTO trades (agent_id, token_address, type, sol_amount_lamports, token_amount, price_lamports, reasoning, realized_pnl_lamports, tx_confirmed)
         VALUES ($1, $2, 'sell', $3, $4, $5, $6, $7, TRUE)
         RETURNING *`,
        [agentId, tokenAddress, solOut, amountTokens, solOut / amountTokens, reasoning, realizedPnl]
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_log (agent_id, type, token_address, trade_id, data)
         VALUES ($1, 'trade', $2, $3, $4)`,
        [
          agentId,
          tokenAddress,
          tradeResult.rows[0].id,
          JSON.stringify({ type: 'sell', tokens: amountTokens, sol: lamportsToSol(solOut), pnl: lamportsToSol(realizedPnl) }),
        ]
      );

      return tradeResult.rows[0];
    });

    // Update token state
    const newSupply = token.totalSupply - amountTokens;
    const newReserve = token.reserveLamports - solOut;
    await tokenService.updateAfterTrade(tokenAddress, newSupply, newReserve, solOut);
    await tokenService.updateHolderCount(tokenAddress);

    // Get new balance
    const newBalanceResult = await db.query<{ sol_balance: string }>(
      'SELECT sol_balance FROM agents WHERE id = $1',
      [agentId]
    );
    const newBalance = Number(newBalanceResult.rows[0].sol_balance);

    const trade = rowToTrade(result);

    // Broadcast trade event
    await publish(CHANNELS.TRADES, {
      type: 'trade',
      data: {
        id: trade.id,
        agentId,
        agentName,
        tokenAddress,
        tokenSymbol: token.symbol,
        tradeType: 'sell',
        solAmount: lamportsToSol(solOut),
        tokenAmount: amountTokens,
        price: solOut / amountTokens,
        reasoning,
      },
    });

    logger.info(`Sell executed: ${agentName} sold ${amountTokens} ${token.symbol} for ${lamportsToSol(solOut)} SOL (PnL: ${lamportsToSol(realizedPnl)})`);

    return {
      trade,
      solReceived: lamportsToSol(solOut),
      newBalance,
      realizedPnl: lamportsToSol(realizedPnl),
    };
  }

  /**
   * Get agent's positions (portfolio)
   */
  async getPositions(agentId: string): Promise<Position[]> {
    const result = await db.query<PositionRow>(
      `SELECT p.*, t.current_price_lamports
       FROM positions p
       JOIN tokens t ON t.address = p.token_address
       WHERE p.agent_id = $1 AND p.amount > 0
       ORDER BY (p.amount * t.current_price_lamports) DESC`,
      [agentId]
    );

    return result.rows.map(row => {
      const position = rowToPosition(row);
      // Calculate current value and unrealized PnL
      // These should be calculated with current price from token
      return position;
    });
  }

  /**
   * Get agent's trade history
   */
  async getTradeHistory(
    agentId: string,
    page: number,
    limit: number
  ): Promise<{ trades: Trade[]; total: number }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<TradeRow>(
        `SELECT * FROM trades WHERE agent_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [agentId, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM trades WHERE agent_id = $1',
        [agentId]
      ),
    ]);

    return {
      trades: dataResult.rows.map(rowToTrade),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get token's trade history
   */
  async getTokenTradeHistory(
    tokenAddress: string,
    page: number,
    limit: number
  ): Promise<{ trades: Trade[]; total: number }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query<TradeRow>(
        `SELECT * FROM trades WHERE token_address = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [tokenAddress, limit, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM trades WHERE token_address = $1',
        [tokenAddress]
      ),
    ]);

    return {
      trades: dataResult.rows.map(rowToTrade),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get total trade count
   */
  async getTotalCount(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM trades'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get agent's PnL breakdown
   */
  async getPnlBreakdown(agentId: string): Promise<{
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
  }> {
    const result = await db.query<{
      total_realized: string;
      winning: string;
      losing: string;
    }>(
      `SELECT 
         COALESCE(SUM(realized_pnl_lamports), 0) as total_realized,
         COUNT(*) FILTER (WHERE realized_pnl_lamports > 0) as winning,
         COUNT(*) FILTER (WHERE realized_pnl_lamports < 0) as losing
       FROM trades 
       WHERE agent_id = $1 AND type = 'sell'`,
      [agentId]
    );

    const row = result.rows[0];
    const winning = parseInt(row.winning, 10);
    const losing = parseInt(row.losing, 10);
    const total = winning + losing;

    // Calculate unrealized PnL from positions
    const positionsResult = await db.query<{ unrealized: string }>(
      `SELECT COALESCE(SUM(
         (p.amount * t.current_price_lamports) - p.cost_basis_lamports
       ), 0) as unrealized
       FROM positions p
       JOIN tokens t ON t.address = p.token_address
       WHERE p.agent_id = $1`,
      [agentId]
    );

    return {
      totalRealizedPnl: lamportsToSol(Number(row.total_realized)),
      totalUnrealizedPnl: lamportsToSol(Number(positionsResult.rows[0].unrealized)),
      winningTrades: winning,
      losingTrades: losing,
      winRate: total > 0 ? (winning / total) * 100 : 0,
    };
  }
}

export const tradeService = new TradeService();

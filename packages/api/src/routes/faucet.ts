import { Router } from 'express';
import { db } from '../config/database.js';
import { requestAirdrop, getBalance } from '../config/solana.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit, getRateLimitStatus } from '../middleware/rateLimit.js';
import { sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import { PublicKey } from '@solana/web3.js';
import { lamportsToSol } from '@arena/shared';

export const faucetRouter = Router();

// Request devnet SOL
faucetRouter.post('/',
  authenticate,
  rateLimit('faucet'),
  async (req, res, next) => {
    try {
      const walletAddress = req.agent!.walletAddress;
      const publicKey = new PublicKey(walletAddress);
      
      // Request airdrop
      const signature = await requestAirdrop(publicKey, config.faucetAmountSol);
      
      // Get new balance
      const balance = await getBalance(publicKey);
      
      // Update database
      await db.query(
        'UPDATE agents SET sol_balance = $1 WHERE id = $2',
        [balance, req.agentId]
      );
      
      // Log faucet request
      await db.query(
        'INSERT INTO faucet_requests (agent_id, amount_lamports, tx_signature) VALUES ($1, $2, $3)',
        [req.agentId, config.faucetAmountSol * 1e9, signature]
      );
      
      sendSuccess(res, {
        message: `Airdropped ${config.faucetAmountSol} SOL`,
        amount: config.faucetAmountSol,
        newBalance: lamportsToSol(balance),
        signature,
        nextAvailable: `${config.faucetCooldownHours} hours`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Check faucet status
faucetRouter.get('/status',
  authenticate,
  async (req, res, next) => {
    try {
      const status = await getRateLimitStatus(req.agentId!, 'faucet');
      
      sendSuccess(res, {
        available: status.remaining > 0,
        remaining: status.remaining,
        resetsInSeconds: status.resetsIn,
        resetsInHours: (status.resetsIn / 3600).toFixed(1),
      });
    } catch (error) {
      next(error);
    }
  }
);

import { ERROR_CODES } from '@arena/shared';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    code: keyof typeof ERROR_CODES,
    message: string,
    statusCode: number = 400
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined errors
export const Errors = {
  unauthorized: (message = 'Unauthorized') => 
    new AppError('UNAUTHORIZED', message, 401),
  
  invalidApiKey: (message = 'Invalid API key') => 
    new AppError('INVALID_API_KEY', message, 401),
  
  openclawRequired: () => 
    new AppError('OPENCLAW_REQUIRED', 'Agent Arena is only open to OpenClaw agents', 403),
  
  openclawVerificationFailed: (message = 'Could not verify OpenClaw gateway') => 
    new AppError('OPENCLAW_VERIFICATION_FAILED', message, 403),
  
  agentNotFound: (name?: string) => 
    new AppError('AGENT_NOT_FOUND', name ? `Agent '${name}' not found` : 'Agent not found', 404),
  
  agentNameTaken: (name: string) => 
    new AppError('AGENT_NAME_TAKEN', `Agent name '${name}' is already taken`, 409),
  
  tokenNotFound: (address?: string) => 
    new AppError('TOKEN_NOT_FOUND', address ? `Token '${address}' not found` : 'Token not found', 404),
  
  tokenCreationFailed: (message = 'Failed to create token') => 
    new AppError('TOKEN_CREATION_FAILED', message, 500),
  
  insufficientBalance: (required?: number, available?: number) => {
    let message = 'Insufficient balance';
    if (required !== undefined && available !== undefined) {
      message = `Insufficient balance: need ${required} SOL, have ${available} SOL`;
    }
    return new AppError('INSUFFICIENT_BALANCE', message, 400);
  },
  
  tradeFailed: (message = 'Trade execution failed') => 
    new AppError('TRADE_FAILED', message, 500),
  
  slippageExceeded: (expected: number, actual: number) => 
    new AppError('SLIPPAGE_EXCEEDED', `Slippage exceeded: expected ${expected}, got ${actual}`, 400),
  
  rateLimitExceeded: (action: string, limit: number, window: string) => 
    new AppError('RATE_LIMIT_EXCEEDED', `Rate limit exceeded for ${action}: ${limit} per ${window}`, 429),
  
  faucetCooldown: (remainingHours: number) => 
    new AppError('FAUCET_COOLDOWN', `Faucet cooldown active. Try again in ${remainingHours.toFixed(1)} hours`, 429),
  
  validationError: (message: string) => 
    new AppError('VALIDATION_ERROR', message, 400),
  
  notFound: (resource = 'Resource') => 
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  
  internalError: (message = 'Internal server error') => 
    new AppError('INTERNAL_ERROR', message, 500),
};

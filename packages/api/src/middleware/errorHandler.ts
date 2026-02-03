import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`Operational error: ${err.code} - ${err.message}`);
  } else {
    logger.error('Unexpected error:', err);
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode);
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid JSON', 400);
    return;
  }

  // Handle database errors
  if ('code' in err && typeof err.code === 'string') {
    const dbError = err as { code: string; detail?: string };
    
    // Unique violation
    if (dbError.code === '23505') {
      sendError(res, 'VALIDATION_ERROR', 'Duplicate entry', 409);
      return;
    }
    
    // Foreign key violation
    if (dbError.code === '23503') {
      sendError(res, 'VALIDATION_ERROR', 'Referenced resource not found', 400);
      return;
    }
  }

  // Unknown error - don't leak details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  sendError(res, 'INTERNAL_ERROR', message, 500);
}

import type { Response } from 'express';
import type { ApiResponse } from '@arena/shared';

/**
 * Send a success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * Send a paginated success response
 */
export function sendPaginated<T>(
  res: Response,
  data: T,
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
  };
  res.status(200).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400
): void {
  const response: ApiResponse<never> = {
    success: false,
    error: { code, message },
  };
  res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

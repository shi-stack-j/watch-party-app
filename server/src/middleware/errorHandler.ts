import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiResponse';
import { env } from '../config/env';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  logger.error(`Error processing request ${req.method} ${req.path}:`, err.message);

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'An internal server error occurred';

  // Do not expose detailed internal stack traces or secrets to users
  const details = env.NODE_ENV === 'development' ? err.message : undefined;

  return sendError(res, message, details, statusCode);
};

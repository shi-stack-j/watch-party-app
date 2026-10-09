import { Request, Response, NextFunction } from 'express';
import { checkHealth } from '../services/healthService';
import { sendSuccess } from '../utils/apiResponse';

export const getHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await checkHealth();
    return sendSuccess(res, 'Health check passed', health);
  } catch (error) {
    return next(error);
  }
};

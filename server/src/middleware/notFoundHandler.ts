import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';

export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(res, `Route ${req.method} ${req.originalUrl} not found`, undefined, 404);
};

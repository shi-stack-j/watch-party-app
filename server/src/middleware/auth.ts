import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';

export interface UserSessionData {
  userId: string;
  username: string;
  email: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: UserSessionData;
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    return sendError(res, 'Unauthorized access. Please log in.', undefined, 401);
  }
  return next();
};

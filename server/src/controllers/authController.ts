import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getUserById } from '../services/authService';
import { sendSuccess, sendError } from '../utils/apiResponse';

export const handleSignup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;
    const user = await registerUser(username, email, password);

    // Regenerate session upon registration
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        userId: user.id,
        username: user.username,
        email: user.email,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return sendSuccess(res, 'Account created successfully', user, 201);
      });
    });
  } catch (error) {
    return next(error);
  }
};

export const handleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser(email, password);

    // Regenerate session upon login to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        userId: user.id,
        username: user.username,
        email: user.email,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return sendSuccess(res, 'Login successful', user, 200);
      });
    });
  } catch (error) {
    return next(error);
  }
};

export const handleLogout = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    res.clearCookie('watchparty_sid');
    return sendSuccess(res, 'Logged out successfully', null, 200);
  }

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('watchparty_sid');
    return sendSuccess(res, 'Logged out successfully', null, 200);
  });
};

export const handleGetMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.user || !req.session.user.userId) {
      return sendError(res, 'Not authenticated', undefined, 401);
    }

    const user = await getUserById(req.session.user.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.clearCookie('watchparty_sid');
      return sendError(res, 'User no longer exists', undefined, 401);
    }

    return sendSuccess(res, 'Authenticated user profile', user, 200);
  } catch (error) {
    return next(error);
  }
};

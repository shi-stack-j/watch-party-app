import { Router } from 'express';
import { handleSignup, handleLogin, handleLogout, handleGetMe } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { signupSchema, loginSchema } from '../validation/authValidation';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Signup routes (supporting both /signup and /register)
router.post('/signup', authRateLimiter, validate(signupSchema), handleSignup);
router.post('/register', authRateLimiter, validate(signupSchema), handleSignup);

// Login route
router.post('/login', authRateLimiter, validate(loginSchema), handleLogin);

// Logout route
router.post('/logout', handleLogout);

// Current user profile route
router.get('/me', handleGetMe);

export default router;

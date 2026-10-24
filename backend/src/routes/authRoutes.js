import express from 'express';
import {
  getMe,
  login,
  register,
  resendVerificationEmail,
  verifyEmail,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  validateEmailVerification,
  validateLogin,
  validateRegister,
  validateResendVerification,
} from '../validators/authValidator.js';

const router = express.Router();
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, actionKey: 'auth_register', message: 'Too many registration attempts. Please try again later.' });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, actionKey: 'auth_login', message: 'Too many login attempts. Please try again later.' });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, actionKey: 'auth_verify_email', message: 'Too many verification attempts. Please try again later.' });
const resendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, actionKey: 'auth_resend_verification', message: 'Too many verification email requests. Please try again later.' });

router.post('/register', registerLimiter, validate(validateRegister), register);
router.post('/login', loginLimiter, validate(validateLogin), login);
router.post('/verify-email', verifyLimiter, validate(validateEmailVerification), verifyEmail);
router.post('/resend-verification', resendLimiter, validate(validateResendVerification), resendVerificationEmail);
router.get('/me', authenticate, getMe);

export default router;

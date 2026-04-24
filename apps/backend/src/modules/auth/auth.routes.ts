import { Router } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticate, authenticateTokenOnly } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  validate,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
  updateProfileSchema,
  terminateDevicesSchema,
} from '../../middleware/validate.js';
import { signInWithTwoFactorSchema, twoFactorVerifySchema } from './auth.schemas.js';
import * as authController from './auth.controller.js';

const router: Router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/sign-up', authLimiter, validate(signUpSchema), asyncWrapper(authController.signup));
router.get('/verify-email', asyncWrapper(authController.verifyEmail));
router.post('/sign-in', authLimiter, validate(signInWithTwoFactorSchema), asyncWrapper(authController.signin));
router.post('/refresh', validate(refreshSchema), asyncWrapper(authController.refresh));
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncWrapper(authController.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncWrapper(authController.resetPassword));
router.get('/check', asyncWrapper(authController.checkAuth)); // Check if user is signed in

// ── OAuth ─────────────────────────────────────────────────────────────────────
router.get('/oauth/google', asyncWrapper(authController.getGoogleAuthUrl));
router.get('/oauth/google/callback', asyncWrapper(authController.googleCallback));
router.get('/oauth/github', asyncWrapper(authController.getGitHubAuthUrl));
router.get('/oauth/github/callback', asyncWrapper(authController.githubCallback));

// ── Sign-out (token required but session can be revoked) ──────────────────────
router.post('/sign-out', authenticateTokenOnly, asyncWrapper(authController.signout));

// ── Protected (valid access token and active session required) ─────────────────
router.use(asyncWrapper(authenticate));
router.post('/sign-out-all', asyncWrapper(authController.signoutAll));
router.post('/change-password', validate(changePasswordSchema), asyncWrapper(authController.changePassword));
router.get('/me', asyncWrapper(authController.getMe));
router.patch('/profile', validate(updateProfileSchema), asyncWrapper(authController.updateProfile));
router.get('/sessions', asyncWrapper(authController.listSessions));
router.get('/devices', asyncWrapper(authController.listDevices));
router.post('/devices/terminate', validate(terminateDevicesSchema), asyncWrapper(authController.terminateDevices));
router.delete('/sessions/:sessionId', asyncWrapper(authController.deleteSession));
router.get('/2fa/status', asyncWrapper(authController.getTwoFactorStatus));
router.post('/2fa/setup', asyncWrapper(authController.beginTwoFactorSetup));
router.post('/2fa/verify-setup', validate(twoFactorVerifySchema), asyncWrapper(authController.verifyTwoFactorSetup));
router.post('/2fa/disable', validate(twoFactorVerifySchema), asyncWrapper(authController.disableTwoFactor));

export default router;

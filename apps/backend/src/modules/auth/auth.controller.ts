import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import geoip from 'geoip-lite';
import {
  AppError,
  type SignUpRequest,
  type SignInRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type UpdateProfileRequest,
  type TerminateDevicesRequest,
  type SessionDTO,
} from '../../types/index.js';
import { verifyAccessToken } from '../../utils/crypto.js';
import { audit, logSecurity, setContextUser } from '../../utils/logger.js';
import * as authService from './auth.service.js';
import {
  blacklistToken,
  blacklistAllUserTokens,
  isTokenBlacklisted as isTokenBlacklistedCheck,
  isUserGloballyBlacklisted,
} from './token-blacklist.service.js';
import { env } from '../../config/env.js';

function getIp(req: Request): string {
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
  // Normalize IPv6 localhost to IPv4 for readability
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return ip;
}

function getCountryFromIp(ip: string): string {
  // Local/private IPs
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('::ffff:127.') ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('::ffff:10.')
  ) {
    return 'Local';
  }

  // Use geoip-lite to lookup country
  const geo = geoip.lookup(ip);
  if (geo && geo.country) {
    return geo.country; // Returns ISO country code (e.g., 'US', 'IN', 'GB')
  }

  return 'Unknown';
}

function getDeviceInfo(req: Request): string {
  return req.headers['user-agent'] ?? 'unknown';
}

// POST /api/v1/auth/sign-up
export async function signup(req: Request, res: Response): Promise<void> {
  const { userId } = await authService.signup(req.body as SignUpRequest);
  res.status(201).json({
    status: 'success',
    message: 'Account created. Please check your email to verify your address.',
    data: { userId },
  });
}

// GET /api/v1/auth/verify-email?token=...
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = req.query['token'];
  if (typeof token !== 'string' || !token) {
    throw new AppError('Verification token is required', 400, 'MISSING_TOKEN');
  }
  await authService.verifyEmail(token);

  logSecurity({
    type: 'AUTH_SUCCESS',
    ip: getIp(req),
    metadata: {
      event: 'EMAIL_VERIFIED',
      deviceInfo: getDeviceInfo(req),
    },
  });

  res.json({ status: 'success', message: 'Email verified successfully.' });
}

// POST /api/v1/auth/sign-in
export async function signin(req: Request, res: Response): Promise<void> {
  const ip = getIp(req);
  const country = getCountryFromIp(ip);
  const result = await authService.signin(
    req.body as SignInRequest & { twoFactorCode?: string },
    getDeviceInfo(req),
    ip,
    country,
  );

  // Set user context for subsequent logging
  setContextUser(result.userId, result.sessionId);

  // Audit log successful signin
  audit.signin(result.userId, ip, true, {
    sessionId: result.sessionId,
    deviceInfo: getDeviceInfo(req),
  });

  res.json({
    status: 'success',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
}

// POST /api/v1/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string };
  const tokens = await authService.refresh(refreshToken, getIp(req));
  res.json({ status: 'success', data: tokens });
}

// POST /api/v1/auth/sign-out  (requires authentication)
export async function signout(req: Request, res: Response): Promise<void> {
  // Blacklist the current access token to prevent further use
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Decode without verification to get jti and exp
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded?.exp) {
        const expiresInSeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
        await blacklistToken(decoded.jti, expiresInSeconds);
      }
    } catch {
      // Ignore decode errors - token will naturally expire anyway
    }
  }

  await authService.signout(req.sessionId!);

  audit.signout(req.userId!, getIp(req), {
    sessionId: req.sessionId,
  });

  res.json({ status: 'success', message: 'Signed out successfully.' });
}

// POST /api/v1/auth/sign-out-all  (requires authentication)
export async function signoutAll(req: Request, res: Response): Promise<void> {
  // Blacklist all tokens for this user immediately
  await blacklistAllUserTokens(req.userId!);

  // Also blacklist the current access token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded?.exp) {
        const expiresInSeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
        await blacklistToken(decoded.jti, expiresInSeconds);
      }
    } catch {
      // Ignore decode errors
    }
  }

  await authService.signoutAll(req.userId!);

  audit.signout(req.userId!, getIp(req), {
    action: 'SIGNOUT_ALL',
    sessionId: req.sessionId,
  });

  res.json({ status: 'success', message: 'All sessions terminated.' });
}

// POST /api/v1/auth/forgot-password
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordRequest;
  await authService.forgotPassword(email);
  res.json({
    status: 'success',
    message: 'If an account with that email exists, a reset link has been sent.',
  });
}

// POST /api/v1/auth/reset-password
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordRequest;
  await authService.resetPassword(token, password);

  // Note: We don't have userId here since it's a public endpoint
  // The audit log is created in the service layer
  logSecurity({
    type: 'AUTH_SUCCESS',
    ip: getIp(req),
    metadata: {
      event: 'PASSWORD_RESET_COMPLETED',
      deviceInfo: getDeviceInfo(req),
    },
  });

  res.json({ status: 'success', message: 'Password reset successfully.' });
}

// POST /api/v1/auth/change-password  (requires authentication)
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as ChangePasswordRequest;
  await authService.changePassword(req.userId!, currentPassword, newPassword);

  audit.passwordChange(req.userId!, getIp(req), {
    sessionId: req.sessionId,
  });

  res.json({ status: 'success', message: 'Password changed successfully. All other sessions have been terminated.' });
}

// GET /api/v1/auth/me  (requires authentication)
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.userId!);
  res.json({
    status: 'success',
    data: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    },
  });
}

// GET /api/v1/auth/check  (public endpoint - checks if user is signed in)
export async function checkAuth(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;

  // No token provided
  if (!authHeader?.startsWith('Bearer ')) {
    res.json({
      status: 'success',
      data: {
        isAuthenticated: false,
        reason: 'NO_TOKEN',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Verify the token
    const payload = verifyAccessToken(token);

    // Check if token is blacklisted (single session sign-out)
    const isTokenBlacklisted = await isTokenBlacklistedCheck(payload.jti);
    if (isTokenBlacklisted) {
      res.json({
        status: 'success',
        data: {
          isAuthenticated: false,
          reason: 'TOKEN_REVOKED',
        },
      });
      return;
    }

    // Check if user signed out from all devices
    if (payload.iat) {
      const isGloballyBlacklisted = await isUserGloballyBlacklisted(
        payload.sub,
        payload.iat * 1000
      );
      if (isGloballyBlacklisted) {
        res.json({
          status: 'success',
          data: {
            isAuthenticated: false,
            reason: 'SESSION_TERMINATED',
          },
        });
        return;
      }
    }

    // Check if session is still valid in database
    const session = await authService.getSession(payload.sessionId);
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      res.json({
        status: 'success',
        data: {
          isAuthenticated: false,
          reason: 'SESSION_REVOKED',
        },
      });
      return;
    }

    // Get user details
    const user = await authService.getMe(payload.sub);

    // User is authenticated
    res.json({
      status: 'success',
      data: {
        isAuthenticated: true,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        session: {
          id: session._id.toString(),
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          country: session.country || 'Unknown',
          lastUsedAt: session.lastUsedAt,
          createdAt: session.createdAt,
        },
      },
    });
  } catch (err) {
    // Token verification failed
    if (err instanceof AppError && err.code === 'TOKEN_EXPIRED') {
      res.json({
        status: 'success',
        data: {
          isAuthenticated: false,
          reason: 'TOKEN_EXPIRED',
        },
      });
      return;
    }

    res.json({
      status: 'success',
      data: {
        isAuthenticated: false,
        reason: 'INVALID_TOKEN',
      },
    });
  }
}

// GET /api/v1/auth/sessions  (requires authentication)
export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await authService.listSessions(req.userId!);

  // Debug logging
  console.log('Sessions list debug:', {
    userId: req.userId,
    sessionIdFromToken: req.sessionId,
    sessionsCount: sessions.length,
    sessions: sessions.map(s => ({ id: s._id.toString(), deviceInfo: s.deviceInfo }))
  });

  res.json({
    status: 'success',
    data: sessions.map((s): SessionDTO => ({
      id: s._id.toString(),
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      country: s.country || 'Unknown',
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s._id.toString() === req.sessionId,
      isActive: !s.isRevoked && s.expiresAt > new Date(),
    })),
  });
}

// DELETE /api/v1/auth/sessions/:sessionId  (requires authentication)
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  await authService.revokeSession(sessionId);

  audit.sessionRevoked(req.userId!, sessionId, getIp(req), {
    revokedBy: req.sessionId === sessionId ? 'self' : 'other',
    currentSession: req.sessionId,
  });

  res.json({ status: 'success', message: 'Session revoked.' });
}

// PATCH /api/v1/auth/profile  (requires authentication)
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { fullName } = req.body as UpdateProfileRequest;

  const user = await authService.updateProfile(req.userId!, fullName);

  // Audit log the profile update
  audit.profileUpdate(req.userId!, getIp(req), {
    sessionId: req.sessionId,
    changedFields: ['fullName'],
  });

  res.json({
    status: 'success',
    message: 'Profile updated successfully.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    },
  });
}

// GET /api/v1/auth/devices  (requires authentication)
export async function listDevices(req: Request, res: Response): Promise<void> {
  const sessions = await authService.listSessions(req.userId!);

  res.json({
    status: 'success',
    data: sessions.map((s): SessionDTO => ({
      id: s._id.toString(),
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      country: s.country || 'Unknown',
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s._id.toString() === req.sessionId,
      isActive: !s.isRevoked && s.expiresAt > new Date(),
    })),
  });
}

// POST /api/v1/auth/devices/terminate  (requires authentication)
export async function terminateDevices(req: Request, res: Response): Promise<void> {
  const { deviceIds, reason } = req.body as TerminateDevicesRequest;

  const results = await Promise.allSettled(
    deviceIds.map(async (deviceId) => {
      // Prevent terminating the current session through this endpoint
      if (deviceId === req.sessionId) {
        return { deviceId, status: 'skipped', reason: 'Cannot terminate current session via this endpoint' };
      }
      try {
        await authService.revokeSession(deviceId);
        return { deviceId, status: 'terminated' };
      } catch (err) {
        return { deviceId, status: 'error', error: (err as Error).message };
      };
    })
  );

  const terminated = results.filter(r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'terminated').length;
  const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'skipped').length;
  const errors = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as { status: string }).status === 'error')).length;

  // Audit log the bulk termination
  logSecurity({
    type: 'AUTH_SUCCESS',
    userId: req.userId!,
    ip: getIp(req),
    metadata: {
      event: 'DEVICES_TERMINATED',
      sessionId: req.sessionId,
      deviceCount: deviceIds.length,
      terminated,
      skipped,
      errors,
      reason: reason || 'User initiated',
      deviceIds,
    },
  });

  res.json({
    status: 'success',
    message: `Terminated ${terminated} device(s). Skipped: ${skipped}. Errors: ${errors}.`,
    data: {
      summary: { total: deviceIds.length, terminated, skipped, errors },
      details: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error', error: 'Unknown error' }),
    },
  });
}

// GET /api/v1/auth/2fa/status (requires authentication)
export async function getTwoFactorStatus(req: Request, res: Response): Promise<void> {
  const data = await authService.getTwoFactorStatus(req.userId!);
  res.json({ status: 'success', data });
}

// POST /api/v1/auth/2fa/setup (requires authentication)
export async function beginTwoFactorSetup(req: Request, res: Response): Promise<void> {
  const data = await authService.beginTwoFactorSetup(req.userId!);
  res.json({
    status: 'success',
    message: 'Scan the QR URL with an authenticator app, then verify setup with a code.',
    data,
  });
}

// POST /api/v1/auth/2fa/verify-setup (requires authentication)
export async function verifyTwoFactorSetup(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code: string };
  const data = await authService.verifyTwoFactorSetup(req.userId!, code);

  logSecurity({
    type: 'AUTH_SUCCESS',
    userId: req.userId!,
    ip: getIp(req),
    metadata: { event: 'TWO_FACTOR_ENABLED', sessionId: req.sessionId },
  });

  res.json({
    status: 'success',
    message: 'Two-factor authentication enabled. Store your backup codes securely.',
    data,
  });
}

// POST /api/v1/auth/2fa/disable (requires authentication)
export async function disableTwoFactor(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code: string };
  await authService.disableTwoFactor(req.userId!, code);

  logSecurity({
    type: 'AUTH_SUCCESS',
    userId: req.userId!,
    ip: getIp(req),
    metadata: { event: 'TWO_FACTOR_DISABLED', sessionId: req.sessionId },
  });

  res.json({
    status: 'success',
    message: 'Two-factor authentication disabled.',
  });
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

// GET /api/v1/auth/oauth/google - Get Google OAuth URL
export async function getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google OAuth is not configured', 503, 'OAUTH_NOT_CONFIGURED');
  }

  const state = req.query['state'] as string || 'default';
  const redirectUri = env.GOOGLE_CALLBACK_URL;

  if (!redirectUri) {
    throw new AppError('Google callback URL is not configured', 503, 'OAUTH_NOT_CONFIGURED');
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({
    status: 'success',
    data: { authUrl, provider: 'google' },
  });
}

// GET /api/v1/auth/oauth/google/callback - Handle Google OAuth callback
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const { code, error } = req.query as { code?: string; error?: string };

  // If there's an error or no code, redirect back to frontend with error
  if (error) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(error)}&provider=google`);
  }

  if (!code) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('No authorization code received')}&provider=google`);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('OAuth not configured')}&provider=google`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({})) as { error_description?: string };
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(errorData.error_description || 'Token exchange failed')}&provider=google`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string; id_token?: string };

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('Failed to fetch user info')}&provider=google`);
    }

    const googleUser = await userResponse.json() as { id: string; email: string; name?: string; verified_email: boolean };

    // Process OAuth login
    const result = await authService.oauthSignin(
      {
        id: googleUser.id,
        email: googleUser.email,
        fullName: googleUser.name || googleUser.email.split('@')[0] || 'Unknown',
      },
      'google',
      getDeviceInfo(req),
      getIp(req),
      getCountryFromIp(getIp(req))
    );

    // Set user context for logging
    setContextUser(result.userId, result.sessionId);

    audit.signin(result.userId, getIp(req), true, {
      sessionId: result.sessionId,
      deviceInfo: getDeviceInfo(req),
      provider: 'google',
    });

    // Redirect back to frontend with tokens
    const redirectUrl = new URL(env.APP_URL);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('provider', 'google');
    redirectUrl.searchParams.set('access_token', result.accessToken);
    redirectUrl.searchParams.set('refresh_token', result.refreshToken);
    redirectUrl.searchParams.set('user_id', result.userId);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'OAuth failed';
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(errorMessage)}&provider=google`);
  }
}

// GET /api/v1/auth/oauth/github - Get GitHub OAuth URL
export async function getGitHubAuthUrl(req: Request, res: Response): Promise<void> {
  if (!env.GITHUB_CLIENT_ID) {
    throw new AppError('GitHub OAuth is not configured', 503, 'OAUTH_NOT_CONFIGURED');
  }

  const state = req.query['state'] as string || 'default';
  const redirectUri = env.GITHUB_CALLBACK_URL;

  if (!redirectUri) {
    throw new AppError('GitHub callback URL is not configured', 503, 'OAUTH_NOT_CONFIGURED');
  }

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'user:email',
    state: state,
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  res.json({
    status: 'success',
    data: { authUrl, provider: 'github' },
  });
}

// GET /api/v1/auth/oauth/github/callback - Handle GitHub OAuth callback
export async function githubCallback(req: Request, res: Response): Promise<void> {
  const { code, error } = req.query as { code?: string; error?: string };

  // If there's an error or no code, redirect back to frontend with error
  if (error) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(error)}&provider=github`);
  }

  if (!code) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('No authorization code received')}&provider=github`);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('OAuth not configured')}&provider=github`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('Token exchange failed')}&provider=github`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string; error?: string; error_description?: string };

    if (tokenData.error) {
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}&provider=github`);
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('Failed to fetch user info')}&provider=github`);
    }

    const githubUser = await userResponse.json() as { id: number; login: string; name?: string; email?: string };

    // Get primary email if not provided
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primaryEmail = emails.find(e => e.primary) || emails[0];
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent('GitHub account has no public email')}&provider=github`);
    }

    // Process OAuth login
    const result = await authService.oauthSignin(
      {
        id: String(githubUser.id),
        email: email,
        fullName: githubUser.name || githubUser.login,
      },
      'github',
      getDeviceInfo(req),
      getIp(req),
      getCountryFromIp(getIp(req))
    );

    // Set user context for logging
    setContextUser(result.userId, result.sessionId);

    audit.signin(result.userId, getIp(req), true, {
      sessionId: result.sessionId,
      deviceInfo: getDeviceInfo(req),
      provider: 'github',
    });

    // Redirect back to frontend with tokens
    const redirectUrl = new URL(env.APP_URL);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('provider', 'github');
    redirectUrl.searchParams.set('access_token', result.accessToken);
    redirectUrl.searchParams.set('refresh_token', result.refreshToken);
    redirectUrl.searchParams.set('user_id', result.userId);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'OAuth failed';
    return res.redirect(`${env.APP_URL}/?oauth_error=${encodeURIComponent(errorMessage)}&provider=github`);
  }
}

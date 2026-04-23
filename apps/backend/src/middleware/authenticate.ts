import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../utils/crypto.js';
import { AppError } from '../types/index.js';
import {
  isTokenBlacklisted,
  isUserGloballyBlacklisted,
} from '../modules/auth/token-blacklist.service.js';
import { logger } from '../utils/logger.js';
import { sessionService } from '../modules/session/session.service.js';

/**
 * Extract token from request (header or query param for SSE)
 */
function extractToken(req: Request): string | null {
  // First try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to query parameter (for SSE connections)
  const tokenParam = req.query.token as string;
  if (tokenParam) {
    return tokenParam;
  }

  return null;
}

/**
 * Debug log for token extraction
 */
function logTokenDebug(req: Request): void {
  const hasAuthHeader = !!req.headers.authorization;
  const hasTokenParam = !!req.query.token;
  logger.debug('Token extraction debug', {
    path: req.path,
    hasAuthHeader,
    hasTokenParam,
    queryKeys: Object.keys(req.query),
  });
}

// Validates the Bearer token and populates req.userId + req.sessionId.
// Route handlers must not access user data directly — they use req.userId
// to fetch the user from the service layer if needed.
// Also supports token via query parameter for SSE connections.
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    logTokenDebug(req);
    const token = extractToken(req);
    if (!token) {
      logger.debug('Authentication failed: No token found', { path: req.path, query: req.query });
      throw new AppError('No access token provided', 401, 'UNAUTHENTICATED');
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (verifyErr) {
      logger.debug('Token verification failed', {
        error: (verifyErr as Error).message,
        tokenPrefix: token.substring(0, 20) + '...',
      });
      throw verifyErr;
    }

    // Check if this specific token is blacklisted (single session sign-out)
    const isBlacklisted = await isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new AppError(
        'Token has been revoked. Please sign in again.',
        401,
        'TOKEN_REVOKED'
      );
    }

    // Check if all tokens for this user were revoked (sign-out-all)
    if (payload.iat) {
      const tokenIssuedAtMs = payload.iat * 1000; // Convert seconds to milliseconds
      const isGloballyBlacklisted = await isUserGloballyBlacklisted(
        payload.sub,
        tokenIssuedAtMs
      );

      // Debug logging
      console.log('Token blacklist check:', {
        userId: payload.sub,
        jti: payload.jti,
        iat: payload.iat,
        tokenIssuedAtMs,
        isGloballyBlacklisted,
        isTokenBlacklisted: isBlacklisted
      });

      if (isGloballyBlacklisted) {
        throw new AppError(
          'Session has been terminated. Please sign in again.',
          401,
          'SESSION_TERMINATED'
        );
      }
    }

    // Check if session is still valid in database (not revoked, not expired)
    const session = await sessionService.getSession(new Types.ObjectId(payload.sessionId));
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new AppError(
        'Session has been revoked. Please sign in again.',
        401,
        'SESSION_REVOKED'
      );
    }

    req.userId = payload.sub;
    req.sessionId = payload.sessionId;
    req.authType = 'jwt';
    next();
  } catch (err) {
    // Handle specific token errors with appropriate messages
    if (err instanceof AppError) {
      next(err);
      return;
    }

    // Handle JWT errors
    if (err instanceof Error) {
      if (err.name === 'TokenExpiredError') {
        next(new AppError(
          'Your session has expired. Please sign in again.',
          401,
          'TOKEN_EXPIRED'
        ));
        return;
      }
      if (err.name === 'JsonWebTokenError') {
        next(new AppError(
          'Invalid authentication token. Please sign in again.',
          401,
          'TOKEN_INVALID'
        ));
        return;
      }
    }

    logger.error('Authentication error', { error: (err as Error).message });
    next(new AppError('Authentication failed', 401, 'UNAUTHENTICATED'));
  }
}

// Validates the Bearer token and populates req.userId + req.sessionId,
// but does NOT check if the session is revoked. This allows users to
// sign out even if their session has been revoked.
// Used specifically for the /sign-out endpoint.
// Also supports token via query parameter for SSE connections.
export async function authenticateTokenOnly(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('No access token provided', 401, 'UNAUTHENTICATED');
    }
    const payload = verifyAccessToken(token);

    // Check if this specific token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new AppError(
        'Token has been revoked. Please sign in again.',
        401,
        'TOKEN_REVOKED'
      );
    }

    req.userId = payload.sub;
    req.sessionId = payload.sessionId;
    req.authType = 'jwt';
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }

    if (err instanceof Error) {
      if (err.name === 'TokenExpiredError') {
        next(new AppError(
          'Your session has expired. Please sign in again.',
          401,
          'TOKEN_EXPIRED'
        ));
        return;
      }
      if (err.name === 'JsonWebTokenError') {
        next(new AppError(
          'Invalid authentication token. Please sign in again.',
          401,
          'TOKEN_INVALID'
        ));
        return;
      }
    }

    logger.error('Authentication error', { error: (err as Error).message });
    next(new AppError('Authentication failed', 401, 'UNAUTHENTICATED'));
  }
}


import { Types } from 'mongoose';
import { sessionRepository } from './session.repository.js';
import { ISessionDocument } from './session.model.js';
import { generateRefreshToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../types/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class SessionService {
  private refreshTokenExpiresAt(daysFromNow = env.JWT_REFRESH_TTL_DAYS): Date {
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1_000);
  }

  async createSession(
    userId: Types.ObjectId,
    deviceInfo: string,
    ipAddress: string,
    country?: string
  ): Promise<{ session: ISessionDocument; rawRefreshToken: string }> {
    const rawRefreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = this.refreshTokenExpiresAt();

    const session = await sessionRepository.create({
      userId,
      refreshTokenHash,
      deviceInfo,
      ipAddress,
      country: country || 'Unknown',
      expiresAt,
    });

    return { session, rawRefreshToken };
  }

  async rotateSession(
    rawRefreshToken: string,
    ipAddress: string
  ): Promise<{ session: ISessionDocument; rawRefreshToken: string }> {
    const incomingHash = hashToken(rawRefreshToken);

    // ── Step 1: Check for an active session with this token hash ──────────
    const activeSession = await sessionRepository.findActiveByTokenHash(incomingHash);

    if (!activeSession) {
      // ── Step 2: Reuse-attack detection ───────────────────────────────────
      // A hash that exists in the DB but belongs to a revoked/expired session
      // means this token was already rotated away. Someone is presenting a
      // stale token — consistent with a stolen refresh token being replayed.
      const staleSession = await sessionRepository.findAnyByTokenHash(incomingHash);

      if (staleSession) {
        // Revoke ALL sessions for this user — nuclear option, but correct
        // per RFC 6749 §10.4 and the OWASP Refresh Token guidelines.
        logger.warn('Refresh token reuse detected — revoking all sessions', {
          userId: staleSession.userId.toString(),
          ip: ipAddress,
          event: 'token_reuse_attack',
        });
        await sessionRepository.revokeAllForUser(staleSession.userId);

        throw new AppError(
          'Token reuse detected. All active sessions have been revoked for your protection.',
          401,
          'TOKEN_REUSE_DETECTED'
        );
      }

      // Token hash not found at all — truly invalid
      throw new AppError('Refresh token is invalid or has expired', 401, 'TOKEN_INVALID');
    }

    // ── Step 3: Issue new token and invalidate the old hash ───────────────
    // The old hash is overwritten in the DB, making it permanently invalid.
    // Any subsequent request with the old token will trigger Step 2.
    const newRawToken = generateRefreshToken();
    const newHash = hashToken(newRawToken);
    const newExpiresAt = this.refreshTokenExpiresAt();

    await sessionRepository.updateTokenHash(activeSession._id, newHash, newExpiresAt);

    return {
      session: activeSession,
      rawRefreshToken: newRawToken,
    };
  }

  async revokeSession(sessionId: Types.ObjectId): Promise<void> {
    await sessionRepository.revokeById(sessionId);
  }

  async revokeAllSessions(userId: Types.ObjectId): Promise<void> {
    await sessionRepository.revokeAllForUser(userId);
  }

  async listActiveSessions(userId: Types.ObjectId): Promise<ISessionDocument[]> {
    return sessionRepository.listActiveForUser(userId);
  }

  async getSession(sessionId: Types.ObjectId): Promise<ISessionDocument | null> {
    return sessionRepository.findById(sessionId);
  }
}

export const sessionService = new SessionService();

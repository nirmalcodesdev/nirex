import { Types } from 'mongoose';
import { ISessionDocument, SessionModel } from './session.model.js';

export class SessionRepository {
  async create(data: {
    userId: Types.ObjectId;
    refreshTokenHash: string;
    deviceInfo: string;
    ipAddress: string;
    country?: string;
    expiresAt: Date;
  }): Promise<ISessionDocument> {
    return SessionModel.create(data);
  }

  async findById(id: string | Types.ObjectId): Promise<ISessionDocument | null> {
    return SessionModel.findById(id).exec();
  }

  // Used during rotation: finds an active (non-revoked, non-expired) session.
  async findActiveByTokenHash(
    refreshTokenHash: string
  ): Promise<ISessionDocument | null> {
    return SessionModel.findOne({
      refreshTokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  // Reuse-attack detection: looks up ANY session with this hash, including
  // revoked or expired ones. A hit on a stale hash means the token was
  // rotated away but is being presented again — strong signal of theft.
  async findAnyByTokenHash(
    refreshTokenHash: string
  ): Promise<ISessionDocument | null> {
    return SessionModel.findOne({ refreshTokenHash }).exec();
  }

  // Rotate: replace the old hash with the new one and extend expiry.
  async updateTokenHash(
    sessionId: Types.ObjectId,
    newRefreshTokenHash: string,
    newExpiresAt: Date
  ): Promise<void> {
    await SessionModel.findByIdAndUpdate(sessionId, {
      refreshTokenHash: newRefreshTokenHash,
      lastUsedAt: new Date(),
      expiresAt: newExpiresAt,
    }).exec();
  }

  async revokeById(sessionId: Types.ObjectId): Promise<void> {
    await SessionModel.findByIdAndUpdate(sessionId, {
      isRevoked: true,
    }).exec();
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await SessionModel.updateMany(
      { userId, isRevoked: false },
      { $set: { isRevoked: true } }
    ).exec();
  }

  async listActiveForUser(userId: Types.ObjectId): Promise<ISessionDocument[]> {
    return SessionModel.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastUsedAt: -1 })
      .exec();
  }
}

export const sessionRepository = new SessionRepository();

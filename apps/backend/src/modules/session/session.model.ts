import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISession {
  userId: Types.ObjectId;
  // SHA-256 hash of the current refresh token for this session.
  // On each rotation the hash is replaced; the previous hash is gone from
  // the DB, which is why presenting a stale token signals a reuse attack.
  refreshTokenHash: string;
  deviceInfo: string;
  ipAddress: string;
  country?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

export interface ISessionDocument extends ISession, Document {
  _id: Types.ObjectId;
}

const SessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: { type: String, required: true },
    deviceInfo: { type: String, default: 'unknown', maxlength: 512 },
    ipAddress: { type: String, required: true, maxlength: 45 }, // 45 chars covers IPv6
    country: { type: String, default: 'Unknown', maxlength: 100 },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index for rotation lookups (active sessions only).
SessionSchema.index({ refreshTokenHash: 1 });

// Compound index used by listActiveSessions and revokeAllForUser.
SessionSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

// TTL — expired sessions are cleaned up automatically by MongoDB.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if model already exists (handles test environment where module may be reloaded)
export const SessionModel = (mongoose.models.Session || mongoose.model<ISessionDocument>('Session', SessionSchema)) as mongoose.Model<ISessionDocument>;

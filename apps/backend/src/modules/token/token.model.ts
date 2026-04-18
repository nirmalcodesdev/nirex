import mongoose, { Document, Schema, Types } from 'mongoose';
import { TokenType } from '../../types/index.js';

export interface IToken {
  userId: Types.ObjectId;
  // SHA-256 hash of the raw token — the raw value is only ever held in memory
  // and sent to the user via email/URL. It is never persisted.
  tokenHash: string;
  type: TokenType;
  expiresAt: Date;
  // Null until the token has been consumed; prevents replay after first use.
  usedAt?: Date;
  createdAt: Date;
}

export interface ITokenDocument extends IToken, Document {
  _id: Types.ObjectId;
}

const TokenSchema = new Schema<ITokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true },
    type: {
      type: String,
      enum: ['verify', 'reset'] as TokenType[],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Primary lookup path — all token verification goes through the hash.
TokenSchema.index({ tokenHash: 1 });

// TTL index — MongoDB automatically deletes documents whose `expiresAt`
// has passed, preventing stale token accumulation without manual purging.
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if model already exists (handles test environment where module may be reloaded)
export const TokenModel = (mongoose.models.Token || mongoose.model<ITokenDocument>('Token', TokenSchema)) as mongoose.Model<ITokenDocument>;

import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type ProviderType,
  type LocalProviderData,
  type GoogleProviderData,
  type GithubProviderData,
  type ProviderData,
  type IProvider,
  type IUser,
} from '../../types/index.js';

// Re-export shared types for Mongoose-specific extensions
export type { LocalProviderData, GoogleProviderData, GithubProviderData, ProviderData, IProvider };

// ─── User Document ────────────────────────────────────────────────────────────
// IUser is extended from shared package with Mongoose Document interface

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ProviderSchema = new Schema<IProvider>(
  {
    type: {
      type: String,
      enum: ['local', 'google', 'github'] as ProviderType[],
      required: true,
    },
    // Mixed allows per-provider data shapes while keeping one collection.
    data: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      // Normalize before storage — Zod schema lowercases on input,
      // but schema-level transform adds defence-in-depth.
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    isEmailVerified: { type: Boolean, default: false },
    providers: { type: [ProviderSchema], default: [] },
    failedSigninAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true }
);

// Unique index on email — enforces single account per address at the DB level.
// This is a second line of defence after application-level uniqueness checks.
UserSchema.index({ email: 1 }, { unique: true });

// Check if model already exists (handles test environment where module may be reloaded)
export const UserModel = (mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema)) as mongoose.Model<IUserDocument>;

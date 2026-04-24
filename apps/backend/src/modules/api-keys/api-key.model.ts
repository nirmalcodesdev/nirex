import mongoose, { Document, Schema, Types } from 'mongoose';

export type ApiKeyScope =
  | 'sessions:read'
  | 'sessions:write'
  | 'usage:read'
  | 'billing:read'
  | 'billing:write'
  | 'dashboard:read'
  | 'notifications:read'
  | 'notifications:write';

export const API_KEY_SCOPES: ApiKeyScope[] = [
  'sessions:read',
  'sessions:write',
  'usage:read',
  'billing:read',
  'billing:write',
  'dashboard:read',
  'notifications:read',
  'notifications:write',
];

export interface IApiKeyDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  keyId: string;
  keyPrefix: string;
  last4: string;
  keyHash: string;
  scopes: ApiKeyScope[];
  createdBySessionId?: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKeyDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      immutable: true,
    },
    last4: {
      type: String,
      required: true,
      immutable: true,
      minlength: 4,
      maxlength: 4,
    },
    keyHash: {
      type: String,
      required: true,
      select: false,
      immutable: true,
    },
    scopes: {
      type: [String],
      enum: API_KEY_SCOPES,
      default: [],
    },
    createdBySessionId: {
      type: String,
      required: false,
    },
    lastUsedAt: {
      type: Date,
      required: false,
    },
    lastUsedIp: {
      type: String,
      required: false,
      maxlength: 100,
    },
    expiresAt: {
      type: Date,
      required: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      required: false,
      index: true,
    },
    revokedReason: {
      type: String,
      required: false,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  },
);

ApiKeySchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });
ApiKeySchema.index({ userId: 1, keyId: 1 }, { unique: true });

export const ApiKeyModel =
  (mongoose.models.ApiKey as mongoose.Model<IApiKeyDocument>) ||
  mongoose.model<IApiKeyDocument>('ApiKey', ApiKeySchema);

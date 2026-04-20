import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type IChatSession,
  type ChatMessage,
  type TokenUsage,
} from '@nirex/shared';

/**
 * Chat Session Document interface
 * Note: Using 'aiModel' instead of 'model' to avoid conflict with Mongoose Document.model method
 */
export interface IChatSessionDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  working_directory: string;
  working_directory_hash: string;
  messages: ChatMessage[];
  token_usage: TokenUsage;
  aiModel: string; // AI model used (stored as aiModel to avoid conflict)
  next_message_sequence: number;
  last_auto_checkpoint_tokens?: number;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Sub-schemas
// ============================================================================

/**
 * Token usage sub-schema
 */
const TokenUsageSchema = new Schema<TokenUsage>(
  {
    input_tokens: { type: Number, default: 0, min: 0 },
    output_tokens: { type: Number, default: 0, min: 0 },
    cached_tokens: { type: Number, default: 0, min: 0 },
    total_tokens: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Chat message sub-schema
 */
const ChatMessageSchema = new Schema<ChatMessage>(
  {
    id: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system'],
    },
    content: { type: String, required: true },
    token_usage: { type: TokenUsageSchema, required: false },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false }
);

// ============================================================================
// Main Chat Session Schema
// ============================================================================

const ChatSessionSchema = new Schema<IChatSessionDocument>(
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
      maxlength: 200,
      default: 'New Session',
    },
    working_directory: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    working_directory_hash: {
      type: String,
      required: true,
      index: true,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    token_usage: {
      type: TokenUsageSchema,
      default: () => ({
        input_tokens: 0,
        output_tokens: 0,
        cached_tokens: 0,
        total_tokens: 0,
      }),
    },
    aiModel: {
      type: String,
      required: true,
      maxlength: 100,
    },
    next_message_sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_auto_checkpoint_tokens: {
      type: Number,
      required: false,
      min: 0,
    },
    is_archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// ============================================================================
// Indexes
// ============================================================================

// Compound index for listing user sessions with optional archive filter
ChatSessionSchema.index({ userId: 1, is_archived: 1, updated_at: -1 });

// Index for filtering by working directory hash (project scoping)
ChatSessionSchema.index({ userId: 1, working_directory_hash: 1 });

// Index for model-based queries
ChatSessionSchema.index({ userId: 1, aiModel: 1 });

// ============================================================================
// Model Export
// ============================================================================

// Check if model already exists (handles test environment where module may be reloaded)
export const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSessionDocument>) ||
  mongoose.model<IChatSessionDocument>('ChatSession', ChatSessionSchema);

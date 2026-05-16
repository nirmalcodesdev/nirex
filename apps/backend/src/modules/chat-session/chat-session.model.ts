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
  parent_session_id?: Types.ObjectId;
  root_session_id?: Types.ObjectId;
  branch_point_sequence?: number;
  forked_from_message_id?: Types.ObjectId;
  branch_depth: number;
  source: string;
  git_branch?: string;
  last_message_at?: Date;
  last_message_preview?: string;
  last_message_role?: ChatMessage['role'];
  last_message_sequence?: number;
  last_resumed_at?: Date;
  resume_count: number;
  checkpoint_count: number;
  latest_checkpoint_at?: Date;
  is_pinned: boolean;
  metadata?: Record<string, unknown>;
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
    reasoning_tokens: { type: Number, default: 0, min: 0 },
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
      enum: ['user', 'assistant', 'system', 'tool'],
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
        reasoning_tokens: 0,
        total_tokens: 0,
      }),
    },
    aiModel: {
      type: String,
      required: true,
      maxlength: 100,
    },
    parent_session_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: false,
      index: true,
    },
    root_session_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: false,
      index: true,
    },
    branch_point_sequence: {
      type: Number,
      required: false,
      min: 0,
    },
    forked_from_message_id: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: false,
    },
    branch_depth: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      default: 'api',
      maxlength: 50,
      index: true,
    },
    git_branch: {
      type: String,
      required: false,
      maxlength: 200,
      index: true,
    },
    last_message_at: {
      type: Date,
      required: false,
      index: true,
    },
    last_message_preview: {
      type: String,
      required: false,
      maxlength: 500,
    },
    last_message_role: {
      type: String,
      required: false,
      enum: ['user', 'assistant', 'system', 'tool'],
    },
    last_message_sequence: {
      type: Number,
      required: false,
      min: 0,
    },
    last_resumed_at: {
      type: Date,
      required: false,
      index: true,
    },
    resume_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    checkpoint_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    latest_checkpoint_at: {
      type: Date,
      required: false,
    },
    is_pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
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
ChatSessionSchema.index({ userId: 1, is_pinned: -1, updated_at: -1 });
ChatSessionSchema.index({ userId: 1, root_session_id: 1, branch_depth: 1 });
ChatSessionSchema.index({ userId: 1, last_message_at: -1 });
ChatSessionSchema.index({
  name: 'text',
  working_directory: 'text',
  last_message_preview: 'text',
});

// ============================================================================
// Model Export
// ============================================================================

// Check if model already exists (handles test environment where module may be reloaded)
export const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSessionDocument>) ||
  mongoose.model<IChatSessionDocument>('ChatSession', ChatSessionSchema);

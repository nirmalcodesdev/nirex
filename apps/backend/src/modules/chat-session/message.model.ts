import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type IMessage,
  type MessageDeliveryStatus,
} from '@nirex/shared';

/**
 * Message Document interface
 * Production-grade message storage in separate collection for scalability
 */
export interface IMessageDocument extends Document<Types.ObjectId>, Omit<IMessage, 'id'> {
  _id: Types.ObjectId;
}

// ============================================================================
// Sub-schemas
// ============================================================================

const TokenUsageSchema = new Schema(
  {
    input_tokens: { type: Number, default: 0, min: 0 },
    output_tokens: { type: Number, default: 0, min: 0 },
    cached_tokens: { type: Number, default: 0, min: 0 },
    total_tokens: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// ============================================================================
// Message Schema
// ============================================================================

const MessageSchema = new Schema<IMessageDocument>(
  {
    session_id: {
      type: Schema.Types.ObjectId as unknown as mongoose.SchemaTypeOptions<string>['type'],
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId as unknown as mongoose.SchemaTypeOptions<string>['type'],
      ref: 'User',
      required: true,
      index: true,
    },
    sequence_number: {
      type: Number,
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system'],
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10240, // 10KB limit
    },
    encrypted: {
      type: Boolean,
      default: false,
      index: true,
    },
    token_usage: {
      type: TokenUsageSchema,
      required: false,
    },
    client_message_id: {
      type: String,
      required: false,
      index: true,
    },
    delivery_status: {
      type: String,
      required: true,
      enum: ['pending', 'delivered', 'failed', 'acknowledged'],
      default: 'pending',
      index: true,
    },
    delivered_at: {
      type: Date,
      required: false,
    },
    acknowledged_at: {
      type: Date,
      required: false,
    },
    retry_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
    attachment_ids: {
      type: [Schema.Types.ObjectId],
      ref: 'Attachment',
      required: false,
      default: [],
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: {
      type: Date,
      required: false,
    },
    edited_at: {
      type: Date,
      required: false,
    },
    edited_content: {
      type: String,
      required: false,
      maxlength: 10240,
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

// Primary query: messages by session, ordered by sequence, with unique ordering
MessageSchema.index({ session_id: 1, sequence_number: 1 }, { unique: true });

// Query by user and session
MessageSchema.index({ user_id: 1, session_id: 1, sequence_number: 1 });

// Deduplication: only enforce uniqueness when a real client message ID is present.
MessageSchema.index(
  { session_id: 1, client_message_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      client_message_id: { $type: 'string' },
    },
  }
);

// Text search on content
MessageSchema.index({ content: 'text' });

// Query by delivery status for retry logic
MessageSchema.index({ delivery_status: 1, created_at: 1 });

// Query deleted messages for cleanup
MessageSchema.index({ is_deleted: 1, deleted_at: 1 });

// Date-based queries
MessageSchema.index({ created_at: -1 });
MessageSchema.index({ session_id: 1, created_at: -1 });

// Compound index for search with filters
MessageSchema.index({ session_id: 1, role: 1, created_at: -1 });

// ============================================================================
// Virtuals
// ============================================================================

MessageSchema.virtual('is_edited').get(function(this: IMessageDocument) {
  return !!this.edited_at;
});

MessageSchema.virtual('display_content').get(function(this: IMessageDocument) {
  if (this.is_deleted) {
    return '[deleted]';
  }
  return this.content;
});

// ============================================================================
// Static Methods
// ============================================================================

MessageSchema.statics.getNextSequenceNumber = async function(
  sessionId: Types.ObjectId
): Promise<number> {
  const lastMessage = await this.findOne(
    { session_id: sessionId },
    { sequence_number: 1 }
  )
    .sort({ sequence_number: -1 })
    .limit(1)
    .lean();

  return (lastMessage?.sequence_number || 0) + 1;
};

MessageSchema.statics.findByClientMessageId = async function(
  sessionId: Types.ObjectId,
  clientMessageId: string
): Promise<IMessageDocument | null> {
  return this.findOne({
    session_id: sessionId,
    client_message_id: clientMessageId,
  }).exec();
};

// ============================================================================
// Model Export
// ============================================================================

export const MessageModel =
  (mongoose.models.Message as mongoose.Model<IMessageDocument>) ||
  mongoose.model<IMessageDocument>('Message', MessageSchema);

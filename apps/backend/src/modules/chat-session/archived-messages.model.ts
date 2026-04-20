import mongoose, { Document, Schema, Types, type SchemaDefinitionProperty } from 'mongoose';
import { type ChatMessage } from '@nirex/shared';

/**
 * Archived Messages Document interface
 * Stores older messages from sessions that have grown too large
 */
export interface IArchivedMessagesDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  // The range of message indices stored in this archive
  startIndex: number;
  endIndex: number;
  // The actual archived messages
  messages: ChatMessage[];
  // Total messages in this archive
  messageCount: number;
  archivedAt: Date;
}

// ============================================================================
// Archived Messages Schema
// ============================================================================

const ArchivedMessagesSchema = new Schema<IArchivedMessagesDocument>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    endIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    messages: {
      type: [Schema.Types.Mixed],
      required: true,
      validate: {
        validator: function (msgs: unknown[]) {
          return Array.isArray(msgs) && msgs.length <= 500;
        },
        message: 'Cannot archive more than 500 messages in a single document',
      },
    } as SchemaDefinitionProperty<ChatMessage[], IArchivedMessagesDocument>,
    archivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: 'archivedAt',
      updatedAt: false,
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
  }
);

// ============================================================================
// Virtuals
// ============================================================================

ArchivedMessagesSchema.virtual('messageCount').get(function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (this as unknown as IArchivedMessagesDocument).messages?.length || 0;
});

// ============================================================================
// Indexes
// ============================================================================

// Index for finding archives by session
ArchivedMessagesSchema.index({ sessionId: 1, startIndex: 1 });

// Compound index for user's archived messages
ArchivedMessagesSchema.index({ userId: 1, sessionId: 1, startIndex: 1 });

// Index for cleanup operations
ArchivedMessagesSchema.index({ archivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // Auto-delete after 1 year

// ============================================================================
// Model Export
// ============================================================================

export const ArchivedMessagesModel =
  (mongoose.models.ArchivedMessages as mongoose.Model<IArchivedMessagesDocument>) ||
  mongoose.model<IArchivedMessagesDocument>('ArchivedMessages', ArchivedMessagesSchema);

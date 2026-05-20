import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import type { Request, Response } from 'express';
import {
  createCheckpointSchema,
  forkSessionSchema,
  listSessionsQuerySchema,
  MAX_CHECKPOINT_SNAPSHOT_SIZE,
  MAX_MESSAGE_CONTENT_SIZE,
  messageRoleSchema,
} from '@nirex/shared';
import {
  deleteSession,
  listSessions,
} from '../src/modules/chat-session/chat-session.controller.js';
import { chatSessionService } from '../src/modules/chat-session/chat-session.service.js';
import { chatSessionRepository } from '../src/modules/chat-session/chat-session.repository.js';
import { messageRepository } from '../src/modules/chat-session/message.repository.js';
import { archivedMessagesRepository } from '../src/modules/chat-session/archived-messages.repository.js';
import { sessionCheckpointRepository } from '../src/modules/chat-session/session-checkpoint.repository.js';
import { chatSessionCache } from '../src/modules/chat-session/chat-session.cache.js';
import { sseManager } from '../src/modules/chat-session/sse.manager.js';
import { quotaService } from '../src/modules/usage/quota.service.js';
import { usageRepository } from '../src/modules/usage/usage.repository.js';
import { AppError } from '../src/types/index.js';
import {
  validateCheckpointSnapshot,
  validateMessageContent,
} from '../src/modules/chat-session/content-validator.js';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat session validation', () => {
  it('preserves code-like message content instead of stripping HTML or JS snippets', () => {
    const content = [
      'Render this exact code:',
      '<script>console.log(document.cookie)</script>',
      '<div onclick="run()">Hello</div>',
      'const href = "javascript:alert(1)";',
    ].join('\n');

    const result = validateMessageContent(content);

    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(content);
  });

  it('supports tool messages as first-class transcript entries', () => {
    expect(messageRoleSchema.parse('tool')).toBe('tool');
  });

  it('allows production-sized messages and rejects content above the limit', () => {
    const allowed = 'x'.repeat(MAX_MESSAGE_CONTENT_SIZE);
    const tooLarge = 'x'.repeat(MAX_MESSAGE_CONTENT_SIZE + 1);

    expect(validateMessageContent(allowed).valid).toBe(true);
    expect(validateMessageContent(tooLarge).valid).toBe(false);
  });

  it('allows large checkpoint summaries for compaction snapshots', () => {
    const snapshot = 'summary '.repeat(10_000);

    expect(snapshot.length).toBeLessThan(MAX_CHECKPOINT_SNAPSHOT_SIZE);
    expect(validateCheckpointSnapshot(snapshot).valid).toBe(true);
    expect(createCheckpointSchema.parse({
      snapshot,
      reason: 'auto_compaction',
      token_count: 120_000,
    }).reason).toBe('auto_compaction');
  });

  it('requires fork requests to identify only one branch point selector', () => {
    const parsed = forkSessionSchema.safeParse({
      branch_after_sequence: 3,
      forked_from_message_id: new Types.ObjectId().toString(),
    });

    expect(parsed.success).toBe(false);
  });

  it('parses archived-only list query values into booleans', () => {
    const parsed = listSessionsQuerySchema.parse({
      include_archived: 'true',
      archived_only: 'true',
      page: '2',
      limit: '12',
    });

    expect(parsed.include_archived).toBe(true);
    expect(parsed.archived_only).toBe(true);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(12);
  });
});

describe('chat session controller contracts', () => {
  it('passes validated archived-only booleans into listSessions service', async () => {
    const listSpy = vi.spyOn(chatSessionService, 'listSessions').mockResolvedValue({
      sessions: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        total_pages: 0,
      },
    });
    const req = {
      userId: new Types.ObjectId().toString(),
      query: {
        page: 1,
        limit: 12,
        include_archived: true,
        archived_only: true,
        sort_by: 'updated_at',
        sort_order: 'desc',
      },
    } as unknown as Request;
    const res = createResponse();

    await listSessions(req, res);

    expect(listSpy).toHaveBeenCalledWith(
      expect.any(Types.ObjectId),
      1,
      12,
      true,
      undefined,
      expect.objectContaining({
        archivedOnly: true,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        sessions: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          total_pages: 0,
        },
      },
    });
  });

  it('returns delete session success inside data for frontend dataOrThrow', async () => {
    vi.spyOn(chatSessionService, 'deleteSession').mockResolvedValue(undefined);
    const req = {
      userId: new Types.ObjectId().toString(),
      params: { id: new Types.ObjectId().toString() },
    } as unknown as Request;
    const res = createResponse();

    await deleteSession(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        message: 'Session deleted successfully',
      },
    });
  });
});

describe('chat session usage accounting', () => {
  it('consumes quota before writing a chargeable message', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const messageId = new Types.ObjectId();
    const now = new Date();
    const tokenUsage = {
      input_tokens: 25_000,
      output_tokens: 0,
      cached_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 25_000,
    };
    const session = {
      _id: sessionId,
      userId,
      name: 'Quota write order',
      working_directory: 'D:\\nirex',
      working_directory_hash: 'project-hash',
      aiModel: 'gpt-4o',
      token_usage: { total_tokens: 0 },
      messages: [],
      created_at: now,
      updated_at: now,
      is_archived: false,
    } as never;
    const message = {
      _id: messageId,
      session_id: sessionId,
      user_id: userId,
      sequence_number: 1,
      role: 'user',
      content: 'Burn credits',
      token_usage: tokenUsage,
      client_message_id: 'quota-order-1',
      delivery_status: 'delivered',
      metadata: undefined,
      attachment_ids: [],
      is_deleted: false,
      created_at: now,
    } as never;

    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(session);
    vi.spyOn(messageRepository, 'findByClientMessageId').mockResolvedValue(null);
    const consumeSpy = vi.spyOn(quotaService, 'consumeCredits').mockResolvedValue({
      debitId: new Types.ObjectId().toString(),
      idempotencyKey: `chat-message-client:${sessionId.toString()}:quota-order-1:credits`,
      credits: 25,
      duplicate: false,
    });
    vi.spyOn(chatSessionRepository, 'reserveNextMessageSequence').mockResolvedValue(1);
    const createMessageSpy = vi.spyOn(messageRepository, 'create').mockResolvedValue(message);
    vi.spyOn(messageRepository, 'markDelivered').mockResolvedValue(message);
    vi.spyOn(chatSessionRepository, 'updateMessageSummary').mockResolvedValue(session);
    vi.spyOn(messageRepository, 'countForSession').mockResolvedValue(1);
    vi.spyOn(usageRepository, 'createEvents').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'setSession').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'invalidateUserSessions').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'addMessage').mockResolvedValue();
    vi.spyOn(sseManager, 'notifyNewMessage').mockResolvedValue();

    await chatSessionService.addMessage(
      sessionId.toString(),
      userId,
      'user',
      'Burn credits',
      tokenUsage,
      undefined,
      'quota-order-1'
    );

    expect(consumeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        credits: 25,
        idempotencyKey: `chat-message-client:${sessionId.toString()}:quota-order-1:credits`,
      })
    );
    expect(consumeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      createMessageSpy.mock.invocationCallOrder[0]
    );
  });

  it('does not write a message when quota consumption is rejected', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const now = new Date();
    const session = {
      _id: sessionId,
      userId,
      name: 'Quota blocked',
      working_directory: 'D:\\nirex',
      working_directory_hash: 'project-hash',
      aiModel: 'gpt-4o',
      token_usage: { total_tokens: 0 },
      messages: [],
      created_at: now,
      updated_at: now,
      is_archived: false,
    } as never;

    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(session);
    vi.spyOn(messageRepository, 'findByClientMessageId').mockResolvedValue(null);
    vi.spyOn(quotaService, 'consumeCredits').mockRejectedValue(
      new AppError('Credit quota exceeded.', 402, 'QUOTA_EXCEEDED')
    );
    const createMessageSpy = vi.spyOn(messageRepository, 'create');

    await expect(
      chatSessionService.addMessage(
        sessionId.toString(),
        userId,
        'user',
        'Burn credits',
        {
          input_tokens: 25_000,
          output_tokens: 0,
          cached_tokens: 0,
          reasoning_tokens: 0,
          total_tokens: 25_000,
        },
        undefined,
        'quota-blocked-1'
      )
    ).rejects.toMatchObject({
      statusCode: 402,
      code: 'QUOTA_EXCEEDED',
    });

    expect(createMessageSpy).not.toHaveBeenCalled();
  });

  it('materializes legacy session credits before deleting source records', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const now = new Date();
    const session = {
      _id: sessionId,
      userId,
      name: 'Credit ledger regression',
      working_directory: 'D:\\nirex',
      working_directory_hash: 'project-hash',
      aiModel: 'claude-sonnet',
      messages: [],
      token_usage: {
        input_tokens: 2000,
        output_tokens: 1500,
        cached_tokens: 0,
        reasoning_tokens: 0,
        total_tokens: 3500,
      },
      created_at: now,
      updated_at: now,
      is_archived: false,
    } as never;

    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(session);
    vi.spyOn(messageRepository, 'listUsageForSession').mockResolvedValue([]);
    vi.spyOn(archivedMessagesRepository, 'findBySession').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getExistingEventTotalsForSessions').mockResolvedValue(new Map());
    const createEventsSpy = vi.spyOn(usageRepository, 'createEvents').mockResolvedValue();
    const deleteMessagesSpy = vi.spyOn(messageRepository, 'deleteAllForSession').mockResolvedValue(0);
    vi.spyOn(sessionCheckpointRepository, 'deleteAllForSession').mockResolvedValue(0);
    vi.spyOn(archivedMessagesRepository, 'deleteAllForSession').mockResolvedValue(0);
    vi.spyOn(chatSessionRepository, 'findChildren').mockResolvedValue([]);
    vi.spyOn(chatSessionRepository, 'delete').mockResolvedValue(true);
    vi.spyOn(chatSessionCache, 'invalidateAllSessionCaches').mockResolvedValue();
    vi.spyOn(sseManager, 'broadcastToUser').mockResolvedValue();

    await chatSessionService.deleteSession(sessionId.toString(), userId);

    expect(createEventsSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'credits',
        quantity: 3.5,
        idempotency_key: `chat-session:${sessionId.toString()}:credits:legacy-remainder`,
      }),
    ]);
    expect(createEventsSpy.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMessagesSpy.mock.invocationCallOrder[0]
    );
  });

  it('keeps credits_used from immutable usage events after sessions are deleted', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(chatSessionRepository, 'findAllForUser').mockResolvedValue([]);
    vi.spyOn(chatSessionRepository, 'getTotalTokenUsage').mockResolvedValue({
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 0,
    });
    vi.spyOn(messageRepository, 'countForUser').mockResolvedValue(0);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 12.5,
      requests: 4,
    });
    vi.spyOn(usageRepository, 'getExistingEventTotalsForSessions').mockResolvedValue(new Map());

    const stats = await chatSessionService.getStats(userId);

    expect(stats).toMatchObject({
      total_sessions: 0,
      total_messages: 0,
      credits_used: 12.5,
      archived_sessions: 0,
    });
  });

  it('adds only unledgered live session credits to immutable stats credits', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    vi.spyOn(chatSessionRepository, 'findAllForUser').mockResolvedValue([
      {
        _id: sessionId,
        is_archived: false,
        token_usage: {
          input_tokens: 1200,
          output_tokens: 800,
          cached_tokens: 0,
          reasoning_tokens: 0,
          total_tokens: 2000,
        },
      } as never,
    ]);
    vi.spyOn(chatSessionRepository, 'getTotalTokenUsage').mockResolvedValue({
      input_tokens: 1200,
      output_tokens: 800,
      cached_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 2000,
    });
    vi.spyOn(messageRepository, 'countForUser').mockResolvedValue(1);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 10,
      requests: 5,
    });
    vi.spyOn(usageRepository, 'getExistingEventTotalsForSessions').mockResolvedValue(
      new Map([[sessionId.toString(), { credits: 0.75, requests: 1 }]])
    );

    const stats = await chatSessionService.getStats(userId);

    expect(stats.credits_used).toBe(11.25);
  });
});

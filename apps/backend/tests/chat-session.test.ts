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

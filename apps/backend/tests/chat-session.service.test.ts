import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { chatSessionService, hashWorkingDirectory } from '../src/modules/chat-session/chat-session.service.js';
import { chatSessionRepository } from '../src/modules/chat-session/chat-session.repository.js';
import { messageRepository } from '../src/modules/chat-session/message.repository.js';
import { sessionCheckpointRepository } from '../src/modules/chat-session/session-checkpoint.repository.js';
import { archivedMessagesRepository } from '../src/modules/chat-session/archived-messages.repository.js';
import { chatSessionCache, MAX_CACHED_MESSAGES } from '../src/modules/chat-session/chat-session.cache.js';
import { sseManager } from '../src/modules/chat-session/sse.manager.js';
import { MessageModel } from '../src/modules/chat-session/message.model.js';

function createSessionDoc(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-04-20T00:00:00.000Z');
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    name: 'New Session',
    working_directory: 'D:/workspace/project',
    working_directory_hash: hashWorkingDirectory('D:/workspace/project'),
    messages: [],
    token_usage: {
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
    },
    aiModel: 'gpt-4o',
    next_message_sequence: 0,
    is_archived: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createMessageDoc(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-04-20T00:00:00.000Z');
  return {
    _id: new Types.ObjectId(),
    session_id: new Types.ObjectId(),
    user_id: new Types.ObjectId(),
    sequence_number: 1,
    role: 'user',
    content: 'message',
    encrypted: false,
    token_usage: {
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
    },
    client_message_id: undefined,
    delivery_status: 'delivered',
    delivered_at: now,
    acknowledged_at: undefined,
    retry_count: 0,
    metadata: undefined,
    attachment_ids: [],
    is_deleted: false,
    deleted_at: undefined,
    edited_at: undefined,
    edited_content: undefined,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat-session service regressions', () => {
  it('rejects editing a message through the wrong session route', async () => {
    const userId = new Types.ObjectId();
    const actualSessionId = new Types.ObjectId();
    const routeSessionId = new Types.ObjectId().toString();
    const message = createMessageDoc({
      _id: new Types.ObjectId(),
      session_id: actualSessionId,
    });
    const session = createSessionDoc({ userId, _id: actualSessionId });

    vi.spyOn(messageRepository, 'findById').mockResolvedValue(message as never);
    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(session as never);

    await expect(
      chatSessionService.editMessage(
        routeSessionId,
        message._id.toString(),
        userId,
        'updated content'
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'MESSAGE_NOT_FOUND',
    });
  });

  it('bypasses the message cache when the requested first page exceeds the cache window', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const session = createSessionDoc({ _id: sessionId, userId });
    const baseTime = new Date('2026-04-20T00:00:00.000Z').getTime();
    const messages = Array.from({ length: MAX_CACHED_MESSAGES + 50 }, (_, index) =>
      createMessageDoc({
        _id: new Types.ObjectId(),
        session_id: sessionId,
        user_id: userId,
        sequence_number: index + 1,
        content: `message-${index + 1}`,
        created_at: new Date(baseTime + index * 1000),
      })
    );

    vi.spyOn(chatSessionCache, 'getSession').mockResolvedValue(null);
    const getSessionMessagesSpy = vi
      .spyOn(chatSessionCache, 'getSessionMessages')
      .mockResolvedValue(messages.slice(0, MAX_CACHED_MESSAGES) as never);
    vi.spyOn(chatSessionCache, 'setSession').mockResolvedValue();
    const listSpy = vi
      .spyOn(messageRepository, 'listForSessionPaginated')
      .mockResolvedValue({
        data: messages as never,
        pagination: {
          page: 1,
          limit: MAX_CACHED_MESSAGES + 50,
          total: MAX_CACHED_MESSAGES + 50,
          total_pages: 1,
          has_more: false,
        },
      });
    vi.spyOn(messageRepository, 'countForSession').mockResolvedValue(MAX_CACHED_MESSAGES + 50);
    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(session as never);

    const result = await chatSessionService.getSession(
      sessionId.toString(),
      userId,
      1,
      MAX_CACHED_MESSAGES + 50
    );

    expect(getSessionMessagesSpy).not.toHaveBeenCalled();
    expect(listSpy).toHaveBeenCalledOnce();
    expect(result.session.messages).toHaveLength(MAX_CACHED_MESSAGES + 50);
    expect(result.messages_pagination?.limit).toBe(MAX_CACHED_MESSAGES + 50);
  });

  it('recomputes the working directory hash during import', async () => {
    const userId = new Types.ObjectId();
    const importedDirectory = 'D:/workspace/project';
    const expectedHash = hashWorkingDirectory(importedDirectory);
    const newSession = createSessionDoc({ _id: new Types.ObjectId(), userId });
    const finalSession = createSessionDoc({
      _id: newSession._id,
      userId,
      name: 'Imported Session',
      working_directory: importedDirectory,
      working_directory_hash: expectedHash,
    });

    const createSpy = vi
      .spyOn(chatSessionRepository, 'create')
      .mockResolvedValue(newSession as never);
    vi.spyOn(chatSessionRepository, 'update').mockResolvedValue(finalSession as never);
    vi.spyOn(chatSessionCache, 'setSession').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'invalidateUserSessions').mockResolvedValue();
    vi.spyOn(sseManager, 'broadcastToUser').mockResolvedValue();

    await chatSessionService.importSession(userId, {
      id: 'legacy-id',
      user_id: 'legacy-user',
      name: 'Imported Session',
      working_directory: importedDirectory,
      working_directory_hash: 'tampered-hash',
      messages: [],
      token_usage: {
        input_tokens: 0,
        output_tokens: 0,
        cached_tokens: 0,
        total_tokens: 0,
      },
      model: 'gpt-4o',
      is_archived: false,
      created_at: new Date('2026-04-20T00:00:00.000Z'),
      updated_at: new Date('2026-04-20T00:00:00.000Z'),
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        working_directory_hash: expectedHash,
      })
    );
  });

  it('returns the edited text for the display_content virtual', () => {
    const message = new MessageModel({
      session_id: new Types.ObjectId(),
      user_id: new Types.ObjectId(),
      sequence_number: 1,
      role: 'user',
      content: 'new content',
      delivery_status: 'delivered',
      retry_count: 0,
      is_deleted: false,
      edited_at: new Date('2026-04-20T00:00:00.000Z'),
      edited_content: 'old content',
    });

    expect(message.display_content).toBe('new content');
  });

  it('does not create repeated auto-compaction checkpoints after one has already been recorded', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const existingSession = createSessionDoc({
      _id: sessionId,
      userId,
      token_usage: {
        input_tokens: 80000,
        output_tokens: 30000,
        cached_tokens: 0,
        total_tokens: 110000,
      },
      aiModel: 'gpt-4o',
      last_auto_checkpoint_tokens: 110000,
    });
    const createdMessage = createMessageDoc({
      _id: new Types.ObjectId(),
      session_id: sessionId,
      user_id: userId,
      sequence_number: 1,
      role: 'assistant',
      content: 'reply',
      delivery_status: 'pending',
    });
    const updatedSession = createSessionDoc({
      ...existingSession,
      updated_at: new Date('2026-04-20T00:05:00.000Z'),
    });

    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(existingSession as never);
    vi.spyOn(chatSessionRepository, 'reserveNextMessageSequence').mockResolvedValue(1);
    vi.spyOn(chatSessionRepository, 'updateMessageSummary').mockResolvedValue(updatedSession as never);
    vi.spyOn(messageRepository, 'create').mockResolvedValue(createdMessage as never);
    vi.spyOn(messageRepository, 'markDelivered').mockResolvedValue({
      ...createdMessage,
      delivery_status: 'delivered',
    } as never);
    vi.spyOn(messageRepository, 'countForSession').mockResolvedValue(1);
    vi.spyOn(chatSessionCache, 'setSession').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'invalidateUserSessions').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'addMessage').mockResolvedValue();
    vi.spyOn(sseManager, 'notifyNewMessage').mockResolvedValue();
    const checkpointSpy = vi
      .spyOn(chatSessionService, 'createCheckpoint')
      .mockResolvedValue({
        id: new Types.ObjectId().toString(),
        turn_index: 0,
        created_at: new Date('2026-04-20T00:00:00.000Z'),
      });

    const result = await chatSessionService.addMessage(
      sessionId.toString(),
      userId,
      'assistant',
      'reply',
      {
        input_tokens: 10,
        output_tokens: 20,
      }
    );

    expect(checkpointSpy).not.toHaveBeenCalled();
    expect(result.checkpointCreated).toBe(false);
  });

  it('recovers when the stored next message sequence is behind the actual messages', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const existingSession = createSessionDoc({
      _id: sessionId,
      userId,
      next_message_sequence: 0,
    });
    const createdMessage = createMessageDoc({
      _id: new Types.ObjectId(),
      session_id: sessionId,
      user_id: userId,
      sequence_number: 2,
      role: 'user',
      content: 'recovered message',
      client_message_id: 'client-123',
      delivery_status: 'pending',
    });
    const updatedSession = createSessionDoc({
      ...existingSession,
      next_message_sequence: 2,
      updated_at: new Date('2026-04-20T00:05:00.000Z'),
    });

    vi.spyOn(chatSessionRepository, 'findById').mockResolvedValue(existingSession as never);
    const reserveSpy = vi
      .spyOn(chatSessionRepository, 'reserveNextMessageSequence')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const syncSpy = vi
      .spyOn(chatSessionRepository, 'setNextMessageSequenceAtLeast')
      .mockResolvedValue();
    vi.spyOn(messageRepository, 'findByClientMessageId').mockResolvedValue(null);
    vi
      .spyOn(messageRepository, 'create')
      .mockRejectedValueOnce({
        code: 11000,
        keyPattern: { session_id: 1, sequence_number: 1 },
      } as never)
      .mockResolvedValueOnce(createdMessage as never);
    vi.spyOn(messageRepository, 'getNextSequenceNumber').mockResolvedValue(2);
    vi.spyOn(messageRepository, 'markDelivered').mockResolvedValue({
      ...createdMessage,
      delivery_status: 'delivered',
    } as never);
    vi.spyOn(chatSessionRepository, 'updateMessageSummary').mockResolvedValue(updatedSession as never);
    vi.spyOn(messageRepository, 'countForSession').mockResolvedValue(2);
    vi.spyOn(chatSessionCache, 'setSession').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'invalidateUserSessions').mockResolvedValue();
    vi.spyOn(chatSessionCache, 'addMessage').mockResolvedValue();
    vi.spyOn(sseManager, 'notifyNewMessage').mockResolvedValue();

    const result = await chatSessionService.addMessage(
      sessionId.toString(),
      userId,
      'user',
      'recovered message',
      undefined,
      undefined,
      'client-123'
    );

    expect(syncSpy).toHaveBeenCalledWith(sessionId.toString(), 1);
    expect(reserveSpy).toHaveBeenCalledTimes(2);
    expect(result.isDuplicate).toBe(false);
    expect(result.message).toMatchObject({
      sequence_number: 2,
      client_message_id: 'client-123',
    });
  });

  it('cleans up a partially imported session when import hits a duplicate key error', async () => {
    const userId = new Types.ObjectId();
    const newSession = createSessionDoc({ _id: new Types.ObjectId(), userId });

    vi.spyOn(chatSessionRepository, 'create').mockResolvedValue(newSession as never);
    const deleteMessagesSpy = vi
      .spyOn(messageRepository, 'deleteAllForSession')
      .mockResolvedValue(1);
    const deleteCheckpointsSpy = vi
      .spyOn(sessionCheckpointRepository, 'deleteAllForSession')
      .mockResolvedValue(0);
    const deleteArchivesSpy = vi
      .spyOn(archivedMessagesRepository, 'deleteAllForSession')
      .mockResolvedValue(0);
    const deleteSessionSpy = vi
      .spyOn(chatSessionRepository, 'delete')
      .mockResolvedValue(true);
    vi
      .spyOn(messageRepository, 'create')
      .mockRejectedValueOnce({ code: 11000 } as never);
    const invalidateAllSpy = vi
      .spyOn(chatSessionCache, 'invalidateAllSessionCaches')
      .mockResolvedValue();

    await expect(
      chatSessionService.importSession(userId, {
        id: 'legacy-id',
        user_id: 'legacy-user',
        name: 'Imported Session',
        working_directory: 'D:/workspace/project',
        working_directory_hash: 'ignored-hash',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'first message',
            timestamp: new Date('2026-04-20T00:00:00.000Z'),
          },
        ],
        token_usage: {
          input_tokens: 0,
          output_tokens: 0,
          cached_tokens: 0,
          total_tokens: 0,
        },
        model: 'gpt-4o',
        is_archived: false,
        created_at: new Date('2026-04-20T00:00:00.000Z'),
        updated_at: new Date('2026-04-20T00:00:00.000Z'),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_KEY',
    });

    expect(deleteMessagesSpy).toHaveBeenCalledWith(newSession._id);
    expect(deleteCheckpointsSpy).toHaveBeenCalledWith(newSession._id);
    expect(deleteArchivesSpy).toHaveBeenCalledWith(newSession._id);
    expect(deleteSessionSpy).toHaveBeenCalledWith(newSession._id);
    expect(invalidateAllSpy).toHaveBeenCalledWith(
      newSession._id.toString(),
      userId.toString()
    );
  });
});

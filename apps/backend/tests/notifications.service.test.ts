import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { notificationsService } from '../src/modules/notifications/notifications.service.js';
import { notificationsRepository } from '../src/modules/notifications/notifications.repository.js';

function mockNotificationDoc(overrides?: Partial<Record<string, unknown>>): any {
  const id = new Types.ObjectId();
  const now = new Date('2026-04-24T00:00:00.000Z');
  return {
    _id: id,
    userId: new Types.ObjectId(),
    kind: 'system',
    severity: 'info',
    title: 'Title',
    message: 'Message',
    actionUrl: undefined,
    metadata: undefined,
    readAt: undefined,
    archivedAt: undefined,
    expiresAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('notifications service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unread count and next cursor when list has more rows', async () => {
    const userId = new Types.ObjectId();
    const first = mockNotificationDoc({
      _id: new Types.ObjectId('68097ac84b18f4a4f6f8f001'),
      createdAt: new Date('2026-04-24T10:00:00.000Z'),
    });
    const second = mockNotificationDoc({
      _id: new Types.ObjectId('68097ac84b18f4a4f6f8f000'),
      createdAt: new Date('2026-04-24T09:00:00.000Z'),
    });

    vi.spyOn(notificationsRepository, 'list').mockResolvedValue([first, second]);
    vi.spyOn(notificationsRepository, 'countUnread').mockResolvedValue(12);

    const result = await notificationsService.listNotifications(userId, {
      limit: 1,
      includeRead: true,
      includeArchived: false,
      kinds: [],
      severities: [],
    });

    expect(result.items).toHaveLength(1);
    expect(result.unread_count).toBe(12);
    expect(result.next_cursor).toBeTruthy();
  });

  it('rejects invalid cursor payload', async () => {
    const userId = new Types.ObjectId();

    await expect(
      notificationsService.listNotifications(userId, {
        limit: 20,
        cursor: 'invalid-cursor',
        includeRead: true,
        includeArchived: false,
        kinds: [],
        severities: [],
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
      statusCode: 422,
    });
  });

  it('passes dedupe key and expiration when creating a notification', async () => {
    const userId = new Types.ObjectId();
    const created = mockNotificationDoc({
      kind: 'billing',
      severity: 'warning',
      dedupeKey: 'billing-invoice-in_123',
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    const createSpy = vi.spyOn(notificationsRepository, 'createWithDedupe').mockResolvedValue(created);

    const result = await notificationsService.createNotification(userId, {
      kind: 'billing',
      severity: 'warning',
      title: 'Payment issue',
      message: 'Invoice payment failed.',
      dedupe_key: 'billing-invoice-in_123',
      expires_at: '2026-05-01T00:00:00.000Z',
    });

    expect(createSpy).toHaveBeenCalledOnce();
    expect(result.kind).toBe('billing');
    expect(result.severity).toBe('warning');
  });
});

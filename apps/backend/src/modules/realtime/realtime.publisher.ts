/**
 * Realtime Publisher
 *
 * The single API domain services call to push events to connected
 * clients. Designed to be no-op-safe: if the gateway hasn't been
 * initialised (tests, scripts, or a degraded boot), publish calls
 * log at debug level and silently return. This guarantees that
 * notification persistence never fails because the realtime layer
 * is unavailable.
 *
 * Cross-instance fanout is handled transparently by the Redis adapter
 * installed in `realtime.gateway.ts` — `io.to('user:<id>').emit(...)`
 * will reach every backend instance that has a matching socket.
 */

import { logger } from '../../utils/logger.js';
import type {
  ConnectionReadyPayload,
  NotificationBatchReadPayload,
  NotificationCreatedPayload,
  NotificationReadAllPayload,
  NotificationUpdatedPayload,
  RealtimeChannelName,
  UnreadCountChangedPayload,
} from '@nirex/shared';
import { RealtimeChannel } from '@nirex/shared';
import { getIo } from './realtime.gateway.js';
import { userRoom, type UserIdLike } from './realtime.types.js';

interface PayloadMap {
  [RealtimeChannel.NotificationCreated]: NotificationCreatedPayload;
  [RealtimeChannel.NotificationUpdated]: NotificationUpdatedPayload;
  [RealtimeChannel.NotificationReadAll]: NotificationReadAllPayload;
  [RealtimeChannel.NotificationBatchRead]: NotificationBatchReadPayload;
  [RealtimeChannel.UnreadCountChanged]: UnreadCountChangedPayload;
  [RealtimeChannel.ConnectionReady]: ConnectionReadyPayload;
  [RealtimeChannel.AuthExpired]: { reason: string };
}

function emit<C extends RealtimeChannelName>(
  userId: UserIdLike,
  channel: C,
  payload: PayloadMap[C],
): void {
  const io = getIo();
  if (!io) {
    logger.debug('Realtime emit skipped (gateway not initialised)', {
      channel,
      userId: typeof userId === 'string' ? userId : userId.toString(),
    });
    return;
  }

  try {
    io.to(userRoom(userId)).emit(channel, payload);
  } catch (err) {
    // Publisher must never throw into domain code.
    logger.warn('Realtime emit failed', {
      channel,
      userId: typeof userId === 'string' ? userId : userId.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const realtimePublisher = {
  notificationCreated(userId: UserIdLike, payload: NotificationCreatedPayload): void {
    emit(userId, RealtimeChannel.NotificationCreated, payload);
  },
  notificationUpdated(userId: UserIdLike, payload: NotificationUpdatedPayload): void {
    emit(userId, RealtimeChannel.NotificationUpdated, payload);
  },
  notificationReadAll(userId: UserIdLike, payload: NotificationReadAllPayload): void {
    emit(userId, RealtimeChannel.NotificationReadAll, payload);
  },
  notificationBatchRead(userId: UserIdLike, payload: NotificationBatchReadPayload): void {
    emit(userId, RealtimeChannel.NotificationBatchRead, payload);
  },
  unreadCountChanged(userId: UserIdLike, payload: UnreadCountChangedPayload): void {
    emit(userId, RealtimeChannel.UnreadCountChanged, payload);
  },
};

export type RealtimePublisher = typeof realtimePublisher;

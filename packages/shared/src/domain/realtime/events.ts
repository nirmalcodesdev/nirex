/**
 * Realtime Channel Contract
 *
 * Single source of truth for Socket.IO event names and payload shapes
 * shared between the backend gateway and the frontend client.
 *
 * Server → Client events are scoped to a per-user room: `user:<userId>`.
 */

import type { NotificationItem } from '../notifications/types.js';

export const RealtimeChannel = {
  // ── Server → Client (notifications) ─────────────────────────────────────
  NotificationCreated: 'notification:created',
  NotificationUpdated: 'notification:updated',
  NotificationReadAll: 'notification:read_all',
  NotificationBatchRead: 'notification:batch_read',
  UnreadCountChanged: 'notification:unread_count',

  // ── Server → Client (connection lifecycle) ──────────────────────────────
  ConnectionReady: 'connection:ready',
  AuthExpired: 'auth:expired',
} as const;

export type RealtimeChannelName =
  (typeof RealtimeChannel)[keyof typeof RealtimeChannel];

// ── Payloads ──────────────────────────────────────────────────────────────

export interface NotificationCreatedPayload {
  notification: NotificationItem;
  unread_count: number;
}

export interface NotificationUpdatedPayload {
  notification: NotificationItem;
  unread_count: number;
}

export interface NotificationReadAllPayload {
  updated_count: number;
  read_at: string;
  unread_count: number;
}

export interface NotificationBatchReadPayload {
  ids: string[];
  read_at: string;
  unread_count: number;
}

export interface UnreadCountChangedPayload {
  unread_count: number;
}

export interface ConnectionReadyPayload {
  user_id: string;
  server_id: string;
}

// Discriminated map for typed listeners on either side.
export interface RealtimeEventMap {
  [RealtimeChannel.NotificationCreated]: NotificationCreatedPayload;
  [RealtimeChannel.NotificationUpdated]: NotificationUpdatedPayload;
  [RealtimeChannel.NotificationReadAll]: NotificationReadAllPayload;
  [RealtimeChannel.NotificationBatchRead]: NotificationBatchReadPayload;
  [RealtimeChannel.UnreadCountChanged]: UnreadCountChangedPayload;
  [RealtimeChannel.ConnectionReady]: ConnectionReadyPayload;
  [RealtimeChannel.AuthExpired]: { reason: string };
}

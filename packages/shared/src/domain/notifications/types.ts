/**
 * Notifications Domain Types
 */

export type NotificationKind =
  | 'system'
  | 'billing'
  | 'usage'
  | 'security'
  | 'project';

export type NotificationSeverity =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  archived_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ListNotificationsQuery {
  limit?: number;
  cursor?: string;
  include_read?: boolean;
  include_archived?: boolean;
  kinds?: NotificationKind[];
  severities?: NotificationSeverity[];
}

export interface ListNotificationsResponse {
  items: NotificationItem[];
  next_cursor: string | null;
  unread_count: number;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}

export interface CreateNotificationRequest {
  kind: NotificationKind;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  dedupe_key?: string;
  expires_at?: string;
}

export type CreateNotificationResponse = NotificationItem;
export type MarkNotificationReadResponse = NotificationItem;
export type MarkNotificationUnreadResponse = NotificationItem;
export type ArchiveNotificationResponse = NotificationItem;

export interface ReadAllNotificationsResponse {
  updated_count: number;
}

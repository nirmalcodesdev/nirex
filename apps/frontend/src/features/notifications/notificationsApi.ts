import type {
  ArchiveNotificationResponse,
  BatchReadNotificationsRequest,
  BatchReadNotificationsResponse,
  ListNotificationsQuery,
  ListNotificationsResponse,
  MarkNotificationReadResponse,
  MarkNotificationUnreadResponse,
  NotificationUnreadCountResponse,
  ReadAllNotificationsResponse,
} from "@nirex/shared";
import { dataOrThrow, request } from "../../lib/backendApi";

const NOTIFICATIONS_BASE = "/notifications";

function buildListPath(query: ListNotificationsQuery): string {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query.cursor) {
    params.set("cursor", query.cursor);
  }

  if (query.include_read !== undefined) {
    params.set("include_read", String(query.include_read));
  }

  if (query.include_archived !== undefined) {
    params.set("include_archived", String(query.include_archived));
  }

  if (query.kinds && query.kinds.length > 0) {
    params.set("kinds", query.kinds.join(","));
  }

  if (query.severities && query.severities.length > 0) {
    params.set("severities", query.severities.join(","));
  }

  const search = params.toString();
  return search ? `${NOTIFICATIONS_BASE}?${search}` : NOTIFICATIONS_BASE;
}

export const notificationsApi = {
  async list(query: ListNotificationsQuery): Promise<ListNotificationsResponse> {
    const payload = await request<ListNotificationsResponse>(buildListPath(query), {
      method: "GET",
    });

    return dataOrThrow(payload, "NOTIFICATIONS_LIST_FAILED");
  },

  async unreadCount(): Promise<NotificationUnreadCountResponse> {
    const payload = await request<NotificationUnreadCountResponse>(`${NOTIFICATIONS_BASE}/unread-count`, {
      method: "GET",
    });

    return dataOrThrow(payload, "NOTIFICATIONS_UNREAD_COUNT_FAILED");
  },

  async markRead(notificationId: string): Promise<MarkNotificationReadResponse> {
    const payload = await request<MarkNotificationReadResponse>(
      `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationId)}/read`,
      {
        method: "PATCH",
      },
    );

    return dataOrThrow(payload, "NOTIFICATION_MARK_READ_FAILED");
  },

  async markUnread(notificationId: string): Promise<MarkNotificationUnreadResponse> {
    const payload = await request<MarkNotificationUnreadResponse>(
      `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationId)}/unread`,
      {
        method: "PATCH",
      },
    );

    return dataOrThrow(payload, "NOTIFICATION_MARK_UNREAD_FAILED");
  },

  async markAllRead(): Promise<ReadAllNotificationsResponse> {
    const payload = await request<ReadAllNotificationsResponse>(`${NOTIFICATIONS_BASE}/read-all`, {
      method: "PATCH",
    });

    return dataOrThrow(payload, "NOTIFICATION_MARK_ALL_READ_FAILED");
  },

  async markBatchRead(ids: string[]): Promise<BatchReadNotificationsResponse> {
    const body: BatchReadNotificationsRequest = { ids };
    const payload = await request<BatchReadNotificationsResponse>(`${NOTIFICATIONS_BASE}/read`, {
      method: "PATCH",
      body,
    });

    return dataOrThrow(payload, "NOTIFICATION_MARK_BATCH_READ_FAILED");
  },

  async archive(notificationId: string): Promise<ArchiveNotificationResponse> {
    const payload = await request<ArchiveNotificationResponse>(
      `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationId)}`,
      {
        method: "DELETE",
      },
    );

    return dataOrThrow(payload, "NOTIFICATION_ARCHIVE_FAILED");
  },
};

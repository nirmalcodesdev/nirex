/**
 * useRealtimeNotifications
 *
 * Subscribes to notification-related socket events and surgically
 * updates every cached `ListNotificationsResponse` page held by React
 * Query — header dropdown, full /notifications page, etc. — without
 * an HTTP refetch.
 *
 * Toast logic for newly-created notifications also lives here, so it
 * fires the moment a notification arrives instead of waiting for a
 * polling cycle.
 *
 * Mount this once in the header (the only component that always exists
 * inside the authenticated layout). It is idempotent across remounts.
 */

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  RealtimeChannel,
  type ListNotificationsResponse,
  type NotificationBatchReadPayload,
  type NotificationCreatedPayload,
  type NotificationItem,
  type NotificationReadAllPayload,
  type NotificationUpdatedPayload,
} from "@nirex/shared";
import { useToast } from "../../components/ToastProvider";
import { getSocket } from "./socketClient";
import {
  mergeMarkAll,
  mergeMarkMany,
  mergePrependNotification,
  mergeReplaceNotification,
  notificationsBaseQueryKey,
} from "../notifications/useNotifications";

const FRESH_TOAST_WINDOW_MS = 60_000;

type CacheUpdater = (
  prev: ListNotificationsResponse | undefined,
) => ListNotificationsResponse | undefined;

/**
 * Apply a cache update to every active notifications query, regardless of
 * its filter object. We can't address them by an exact key because each
 * surface (header dropdown vs. notifications page vs. unread-only feed)
 * builds its own normalised key.
 */
function updateAllNotificationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: CacheUpdater,
) {
  queryClient.setQueriesData<ListNotificationsResponse>(
    { queryKey: notificationsBaseQueryKey as unknown as QueryKey },
    (prev) => updater(prev),
  );
  // Dashboard cards may show notification counts; nudge them too.
  void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const socket = getSocket();

    const lastToastedRef = { current: null as string | null };

    const handleCreated = (payload: NotificationCreatedPayload) => {
      updateAllNotificationCaches(queryClient, (prev) =>
        mergePrependNotification(prev, payload.notification, payload.unread_count),
      );

      maybeToast(payload.notification, lastToastedRef, toast);
    };

    const handleUpdated = (payload: NotificationUpdatedPayload) => {
      updateAllNotificationCaches(queryClient, (prev) =>
        mergeReplaceNotification(prev, payload.notification, payload.unread_count),
      );
    };

    const handleReadAll = (payload: NotificationReadAllPayload) => {
      updateAllNotificationCaches(queryClient, (prev) =>
        mergeMarkAll(prev, payload.read_at),
      );
    };

    // Auto-read fanout from another tab/device: apply the same id set
    // to every cached page so the badge & dropdown stay coherent.
    const handleBatchRead = (payload: NotificationBatchReadPayload) => {
      const idSet = new Set(payload.ids);
      updateAllNotificationCaches(queryClient, (prev) =>
        mergeMarkMany(prev, idSet, payload.read_at, payload.unread_count),
      );
    };

    socket.on(RealtimeChannel.NotificationCreated, handleCreated);
    socket.on(RealtimeChannel.NotificationUpdated, handleUpdated);
    socket.on(RealtimeChannel.NotificationReadAll, handleReadAll);
    socket.on(RealtimeChannel.NotificationBatchRead, handleBatchRead);

    return () => {
      socket.off(RealtimeChannel.NotificationCreated, handleCreated);
      socket.off(RealtimeChannel.NotificationUpdated, handleUpdated);
      socket.off(RealtimeChannel.NotificationReadAll, handleReadAll);
      socket.off(RealtimeChannel.NotificationBatchRead, handleBatchRead);
    };
    // toast/queryClient are stable refs; we deliberately mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function maybeToast(
  notification: NotificationItem,
  lastToastedRef: { current: string | null },
  toast: ReturnType<typeof useToast>["toast"],
) {
  if (notification.read_at) return;
  if (lastToastedRef.current === notification.id) return;

  const createdMs = new Date(notification.created_at).getTime();
  if (Number.isNaN(createdMs)) return;
  if (Date.now() - createdMs > FRESH_TOAST_WINDOW_MS) return;

  const toastType: "error" | "warning" | "success" | "info" =
    notification.severity === "error"
      ? "error"
      : notification.severity === "warning"
        ? "warning"
        : notification.severity === "info"
          ? "info"
          : "success";

  toast(`${notification.title}: ${notification.message}`, toastType);
  lastToastedRef.current = notification.id;
}

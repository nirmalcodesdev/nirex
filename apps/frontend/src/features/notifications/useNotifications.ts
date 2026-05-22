import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type {
  ListNotificationsQuery,
  ListNotificationsResponse,
  NotificationItem,
  NotificationKind,
  NotificationSeverity,
} from "@nirex/shared";
import { notificationsApi } from "./notificationsApi";

interface NotificationsQueryOptions {
  limit?: number;
  cursor?: string;
  includeRead?: boolean;
  includeArchived?: boolean;
  kinds?: NotificationKind[];
  severities?: NotificationSeverity[];
}

interface NormalizedNotificationsQueryOptions {
  limit: number;
  cursor?: string;
  includeRead: boolean;
  includeArchived: boolean;
  kinds: NotificationKind[];
  severities: NotificationSeverity[];
}

export const notificationsBaseQueryKey = ["notifications"] as const;

function normalizeOptions(options: NotificationsQueryOptions): NormalizedNotificationsQueryOptions {
  const limit = options.limit ?? 20;

  return {
    limit: Math.max(1, Math.min(100, limit)),
    includeRead: options.includeRead ?? true,
    includeArchived: options.includeArchived ?? false,
    kinds: [...(options.kinds ?? [])].sort(),
    severities: [...(options.severities ?? [])].sort(),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}

function toApiQuery(options: NormalizedNotificationsQueryOptions): ListNotificationsQuery {
  return {
    limit: options.limit,
    include_read: options.includeRead,
    include_archived: options.includeArchived,
    kinds: options.kinds,
    severities: options.severities,
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}

export function notificationsQueryKey(options: NormalizedNotificationsQueryOptions) {
  return [...notificationsBaseQueryKey, options] as const;
}

export function useNotificationsQuery(options: NotificationsQueryOptions = {}, queryOptions?: { refetchInterval?: number | false }) {
  const normalized = normalizeOptions(options);

  return useQuery({
    queryKey: notificationsQueryKey(normalized),
    queryFn: () => notificationsApi.list(toApiQuery(normalized)),
    staleTime: 15_000,
    ...queryOptions,
  });
}

function useNotificationsInvalidation() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationsBaseQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
    ]);
  };
}

export function useMarkNotificationReadMutation() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationUnreadMutation() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markUnread(notificationId),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsReadMutation() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}

/**
 * Mutation for the auto-read pipeline. Updates the cache optimistically
 * via `mergeMarkMany` and reconciles `unread_count` with the server's
 * authoritative number on success. Failure rolls the cache back so a
 * dropped network request doesn't leave the UI lying about read state.
 */
export function useMarkNotificationsBatchReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markBatchRead(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: notificationsBaseQueryKey });
      const optimisticReadAt = new Date().toISOString();
      const idSet = new Set(ids);

      // Snapshot every page we touch so we can roll back on error.
      const snapshots = queryClient.getQueriesData<ListNotificationsResponse>({
        queryKey: notificationsBaseQueryKey as unknown as QueryKey,
      });

      queryClient.setQueriesData<ListNotificationsResponse>(
        { queryKey: notificationsBaseQueryKey as unknown as QueryKey },
        (prev) => {
          if (!prev) return prev;
          // Best-effort unread count: subtract optimistically. The server
          // response will reconcile the real number a moment later.
          const optimisticUnread = Math.max(
            0,
            prev.unread_count -
              prev.items.filter((item) => idSet.has(item.id) && !item.read_at).length,
          );
          return mergeMarkMany(prev, idSet, optimisticReadAt, optimisticUnread) ?? prev;
        },
      );

      return { snapshots };
    },
    onError: (_err, _ids, context) => {
      if (!context) return;
      for (const [key, snapshot] of context.snapshots) {
        queryClient.setQueryData(key, snapshot);
      }
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      void response;
    },
  });
}

export function useArchiveNotificationMutation() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.archive(notificationId),
    onSuccess: invalidate,
  });
}

// ─── Realtime cache merge helpers ──────────────────────────────────────────
//
// These mutate any cached `ListNotificationsResponse` page in place so that
// socket-pushed updates appear instantly without an HTTP refetch.
// `useRealtimeNotifications` (in features/realtime) calls into these via
// `queryClient.setQueriesData({ queryKey: notificationsBaseQueryKey })`,
// which iterates every active page (header dropdown, full /notifications
// page, etc.) and lets each helper decide whether the update belongs there.

export type NotificationsCacheKey = QueryKey;

export function mergePrependNotification(
  prev: ListNotificationsResponse | undefined,
  notification: NotificationItem,
  unreadCount: number,
): ListNotificationsResponse | undefined {
  if (!prev) return prev;
  // Avoid duplicates if the same socket event arrives twice.
  if (prev.items.some((item) => item.id === notification.id)) {
    return { ...prev, unread_count: unreadCount };
  }
  return {
    ...prev,
    items: [notification, ...prev.items],
    unread_count: unreadCount,
  };
}

export function mergeReplaceNotification(
  prev: ListNotificationsResponse | undefined,
  notification: NotificationItem,
  unreadCount: number,
): ListNotificationsResponse | undefined {
  if (!prev) return prev;
  let touched = false;
  const items = prev.items.map((item) => {
    if (item.id === notification.id) {
      touched = true;
      return notification;
    }
    return item;
  });
  if (!touched) {
    // The updated notification isn't on this page; keep the page intact
    // but still sync the unread count.
    return { ...prev, unread_count: unreadCount };
  }
  return { ...prev, items, unread_count: unreadCount };
}

export function mergeMarkAll(
  prev: ListNotificationsResponse | undefined,
  readAtIso: string,
): ListNotificationsResponse | undefined {
  if (!prev) return prev;
  const items = prev.items.map((item) =>
    item.read_at ? item : { ...item, read_at: readAtIso },
  );
  return { ...prev, items, unread_count: 0 };
}

/**
 * Mark a specific set of ids as read inside the cached page.
 * Used by the auto-read pipeline and by `notification:batch_read`
 * realtime events arriving from other tabs.
 */
export function mergeMarkMany(
  prev: ListNotificationsResponse | undefined,
  ids: ReadonlySet<string>,
  readAtIso: string,
  unreadCount: number,
): ListNotificationsResponse | undefined {
  if (!prev) return prev;
  if (ids.size === 0) return { ...prev, unread_count: unreadCount };
  const items = prev.items.map((item) => {
    if (item.read_at) return item;
    if (!ids.has(item.id)) return item;
    return { ...item, read_at: readAtIso };
  });
  return { ...prev, items, unread_count: unreadCount };
}


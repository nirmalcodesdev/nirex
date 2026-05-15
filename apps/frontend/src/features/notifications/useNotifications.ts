import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ListNotificationsQuery, NotificationKind, NotificationSeverity } from "@nirex/shared";
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

export function useArchiveNotificationMutation() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.archive(notificationId),
    onSuccess: invalidate,
  });
}

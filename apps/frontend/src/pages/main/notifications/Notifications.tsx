import { formatRelativeTime, type NotificationItem } from "@nirex/shared";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Inbox,
  MoreVertical,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { Dropdown, DropdownItem, KpiCard, PageHeader, Skeleton, CardSkeleton, SectionCard, StatusBadge } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationUnreadMutation,
  useNotificationsQuery,
} from "../../../features/notifications/useNotifications";
import { useAutoMarkAsRead } from "../../../features/notifications/useAutoMarkAsRead";

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <Skeleton className="h-10 w-48" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="bg-card border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <Skeleton className="h-6 w-48" variant="text" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="p-4 sm:p-6 flex gap-4">
              <Skeleton className="h-5 w-5 " variant="circle" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" variant="text" />
                  <Skeleton className="h-3 w-16" variant="text" />
                </div>
                <Skeleton className="h-3 w-full" variant="text" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <PageHeader
        title="Notifications"
        description="Account notifications."
      />
      <div className="bg-card border border-border overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-red-500/10 shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Unable to load notifications</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shrink-0"
          >
            <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex items-center justify-center w-12 h-12 bg-muted/60 mb-3">
        <Inbox size={24} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-foreground">No notifications</p>
      <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up</p>
    </div>
  );
}

function getSeverityMeta(severity: NotificationItem["severity"]) {
  switch (severity) {
    case "success":
      return { icon: CheckCircle2, colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10", badgeVariant: "success" as const };
    case "warning":
      return { icon: AlertTriangle, colorClass: "text-amber-500", bgClass: "bg-amber-500/10", badgeVariant: "warning" as const };
    case "error":
      return { icon: XCircle, colorClass: "text-red-500", bgClass: "bg-red-500/10", badgeVariant: "error" as const };
    default:
      return { icon: CircleAlert, colorClass: "text-sky-500", bgClass: "bg-sky-500/10", badgeVariant: "info" as const };
  }
}

interface NotificationRowProps {
  notification: NotificationItem;
  isWorking: boolean;
  onMarkUnread: (notification: NotificationItem) => void;
  observeRef: (el: Element | null, id: string, isUnread: boolean) => void;
}

function NotificationRow({
  notification,
  isWorking,
  onMarkUnread,
  observeRef,
}: NotificationRowProps) {
  const isRead = Boolean(notification.read_at);
  const { icon: Icon, colorClass, bgClass, badgeVariant } = getSeverityMeta(notification.severity);
  const relativeCreatedAt = formatRelativeTime(notification.created_at);

  return (
    <article
      ref={(el) => observeRef(el, notification.id, !isRead)}
      className={`p-4 sm:p-5 flex gap-3 transition-colors group border-b border-border last:border-0 ${ !isRead ? "border-l-2 border-l-primary pl-[calc(1rem-2px)]" : "" } hover:bg-muted/60`}
    >
      <div className={`flex items-center justify-center w-8 h-8 shrink-0 mt-0.5 ${bgClass}`}>
        <Icon size={16} className={colorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium font-display">{notification.title}</h3>
            {!isRead && (
              <StatusBadge label="New" variant={badgeVariant} />
            )}
          </div>
          <span
            className="text-xs text-muted-foreground whitespace-nowrap font-mono"
            title={formatTimestamp(notification.created_at)}
          >
            {relativeCreatedAt}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>

        <div className="flex items-center gap-2">
          {isRead ? (
            <button
              type="button"
              onClick={() => onMarkUnread(notification)}
              disabled={isWorking}
              className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Mark as unread
            </button>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield size={10} />
              Marked as read once viewed
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-start gap-2">
        {!isRead ? (
          <div className="flex items-center justify-center w-2 mt-3">
            <div className="w-2 h-2 bg-nirex-accent" />
          </div>
        ) : null}
        {isRead ? (
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                disabled={isWorking}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors sm:opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                <MoreVertical size={16} />
              </button>
            }
          >
            <DropdownItem onClick={() => onMarkUnread(notification)}>
              Mark as unread
            </DropdownItem>
          </Dropdown>
        ) : null}
      </div>
    </article>
  );
}

export function Notifications() {
  const { toast } = useToast();
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useNotificationsQuery({
    limit: 50,
    includeRead: true,
    includeArchived: false,
  });
  const markUnreadMutation = useMarkNotificationUnreadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const { observe: observeRef } = useAutoMarkAsRead();

  if (isLoading && !data) {
    return <NotificationsSkeleton />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        message={getErrorMessage(error, "Unable to load notifications.")}
        isRetrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const notifications = data?.items ?? [];
  const unreadCount = data?.unread_count ?? notifications.filter((item) => !item.read_at).length;
  const alertCount = notifications.filter(
    (item) => item.severity === "error" || item.severity === "warning",
  ).length;
  const lastActivity = notifications[0]?.created_at ? formatRelativeTime(notifications[0].created_at) : "No activity";
  const isMutating =
    markUnreadMutation.isPending ||
    markAllReadMutation.isPending;

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllReadMutation.mutateAsync();
      if (result.updated_count > 0) {
        toast(`${result.updated_count} notification(s) marked as read.`, "success");
      } else {
        toast("All notifications are already read.", "info");
      }
    } catch (actionError) {
      toast(getErrorMessage(actionError, "Unable to mark notifications as read."), "error");
    }
  };

  const handleMarkUnread = async (notification: NotificationItem) => {
    try {
      await markUnreadMutation.mutateAsync(notification.id);
      toast("Notification marked as unread.", "success");
    } catch (actionError) {
      toast(getErrorMessage(actionError, "Unable to update notification."), "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <PageHeader
        title="Notifications"
        description="Stay updated with your account and project activity."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                toast("Refreshing notifications...", "info");
                void refetch();
              }}
              disabled={isFetching}
              className="inline-flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 border border-border"
              title="Refresh"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            </button>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void handleMarkAllAsRead();
                }}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Check size={16} />
                <span className="hidden sm:inline">
                  {markAllReadMutation.isPending ? "Updating..." : "Mark all as read"}
                </span>
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Notifications"
          value={formatNumber(notifications.length)}
          change="Current feed"
          changeType="neutral"
          changeContext="latest 50"
        />
        <KpiCard
          title="Unread"
          value={formatNumber(unreadCount)}
          change={unreadCount > 0 ? "Needs attention" : "All caught up"}
          changeType={unreadCount > 0 ? "negative" : "positive"}
          changeContext={unreadCount > 0 ? `${formatNumber(unreadCount)} unread` : "No action needed"}
        />
        <KpiCard
          title="Alerts"
          value={formatNumber(alertCount)}
          change={alertCount > 0 ? "Requires action" : "No alerts"}
          changeType={alertCount > 0 ? "negative" : "positive"}
          changeContext={alertCount > 0 ? "High priority" : "System healthy"}
        />
        <KpiCard
          title="Last Activity"
          value={lastActivity}
          change="Most recent update"
          changeType="neutral"
          changeContext="notification stream"
        />
      </div>

      <SectionCard
        title="Notification Feed"
        icon={Bell}
        headerAction={
          unreadCount > 0 ? (
            <StatusBadge
              label={`${formatNumber(unreadCount)} unread`}
              variant="info"
              icon={Bell}
            />
          ) : (
            <StatusBadge
              label="All read"
              variant="success"
              icon={Check}
            />
          )
        }

      >
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border -mx-4">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                isWorking={isMutating}
                onMarkUnread={(item) => {
                  void handleMarkUnread(item);
                }}
                observeRef={observeRef}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

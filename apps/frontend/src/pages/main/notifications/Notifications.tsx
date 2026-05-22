import { formatRelativeTime, type NotificationItem } from "@nirex/shared";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Inbox,
  MailOpen,
  MoreVertical,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Dropdown, DropdownItem, KpiCard, PageHeader, Skeleton, CardSkeleton } from "@nirex/ui";
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
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <Skeleton className="h-8 w-40" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <Skeleton className="h-6 w-48" variant="text" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="p-4 sm:p-6 flex gap-4">
              <Skeleton className="h-5 w-5 rounded-full" variant="circle" />
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
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader
        title="Notifications"
        description="Stay updated with your account and project activity."
      />
      <section className="rounded-xl border border-nirex-error/30 bg-nirex-error/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 text-nirex-error" />
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-medium">Unable to load notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
              {isRetrying ? "Retrying..." : "Retry"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Bell size={24} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mb-2">No notifications</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        You&apos;re all caught up. New system and account updates will show up here.
      </p>
    </div>
  );
}

function getSeverityMeta(severity: NotificationItem["severity"]) {
  switch (severity) {
    case "success":
      return { icon: CheckCircle2, colorClass: "text-nirex-success" };
    case "warning":
      return { icon: AlertTriangle, colorClass: "text-nirex-warning" };
    case "error":
      return { icon: XCircle, colorClass: "text-nirex-error" };
    default:
      return { icon: CircleAlert, colorClass: "text-nirex-accent" };
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
  const { icon: Icon, colorClass } = getSeverityMeta(notification.severity);
  const relativeCreatedAt = formatRelativeTime(notification.created_at);

  return (
    <article
      ref={(el) => observeRef(el, notification.id, !isRead)}
      className={`p-4 sm:p-6 flex gap-4 transition-colors group ${
        isRead ? "bg-background" : "bg-muted/10"
      }`}
    >
      <div className="shrink-0 mt-1">
        <Icon size={18} className={colorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
          <h3 className="text-sm font-medium">{notification.title}</h3>
          <span
            className="text-xs text-muted-foreground whitespace-nowrap"
            title={formatTimestamp(notification.created_at)}
          >
            {relativeCreatedAt}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{notification.message}</p>

        {isRead ? (
          <button
            type="button"
            onClick={() => onMarkUnread(notification)}
            disabled={isWorking}
            className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
          >
            Mark as unread
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Marks as read once viewed
          </span>
        )}
      </div>
      <div className="shrink-0 flex items-start gap-2">
        {!isRead ? (
          <div className="flex items-center justify-center w-2 mt-2">
            <div className="w-2 h-2 bg-nirex-accent rounded-full" />
          </div>
        ) : null}
        {isRead ? (
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                disabled={isWorking}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors sm:opacity-0 group-hover:opacity-100 disabled:opacity-50"
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
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
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
              className="flex items-center gap-2 bg-card border border-border hover:bg-muted/50 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isFetching ? "Refreshing" : "Refresh"}</span>
            </button>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void handleMarkAllAsRead();
                }}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
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
          icon={Inbox}
          changeContext="latest 50"
        />
        <KpiCard
          title="Unread"
          value={formatNumber(unreadCount)}
          change={unreadCount > 0 ? "Needs attention" : "All caught up"}
          changeType={unreadCount > 0 ? "negative" : "positive"}
          icon={MailOpen}
          changeContext={unreadCount > 0 ? `${formatNumber(unreadCount)} pending` : "No action needed"}
        />
        <KpiCard
          title="Alerts"
          value={formatNumber(alertCount)}
          change={alertCount > 0 ? "Requires action" : "No alerts"}
          changeType={alertCount > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          changeContext={alertCount > 0 ? "High priority" : "System healthy"}
        />
        <KpiCard
          title="Last Activity"
          value={lastActivity}
          change="Most recent update"
          changeType="neutral"
          icon={Clock}
          changeContext="notification stream"
        />
      </div>

      <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
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
      </section>
    </div>
  );
}

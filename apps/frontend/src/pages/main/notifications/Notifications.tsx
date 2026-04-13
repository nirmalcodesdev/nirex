// Notifications Page - Account notifications and alerts
import { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Settings,
  Check,
  MoreVertical,
  Inbox,
  MailOpen,
  AlertOctagon,
  Clock,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { Skeleton, CardSkeleton } from "@nirex/ui/Skeleton";

interface NotificationData {
  id: number;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const initialNotifications: NotificationData[] = [
  {
    id: 1,
    type: "success",
    title: "Build completed successfully",
    message: 'Project "nirex-core" deployed to production.',
    time: "2 mins ago",
    read: false,
  },
  {
    id: 2,
    type: "error",
    title: "Deployment failed",
    message:
      'Failed to deploy "api-service" due to missing environment variables.',
    time: "1 hour ago",
    read: false,
  },
  {
    id: 3,
    type: "info",
    title: "New feature available",
    message: "You can now export your session logs directly to S3.",
    time: "5 hours ago",
    read: true,
  },
  {
    id: 4,
    type: "warning",
    title: "Approaching usage limit",
    message: "You have used 85% of your monthly compute minutes.",
    time: "1 day ago",
    read: true,
  },
  {
    id: 5,
    type: "success",
    title: "Payment successful",
    message: "Your invoice for March 2026 has been paid.",
    time: "2 days ago",
    read: true,
  },
];

const iconMap = {
  success: { icon: CheckCircle2, color: "text-nirex-success" },
  error: { icon: XCircle, color: "text-nirex-error" },
  warning: { icon: AlertTriangle, color: "text-nirex-warning" },
  info: { icon: Info, color: "text-nirex-accent" },
};

// Loading skeleton using Skeleton component
function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <Skeleton className="h-8 w-40" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <Skeleton className="h-6 w-48" variant="text" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 sm:p-6 flex gap-4">
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

export function Notifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    toast("All notifications marked as read.", "success");
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleDelete = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
    toast("Notification deleted", "success");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const alertCount = notifications.filter(
    (n) => n.type === "error" || n.type === "warning"
  ).length;

  if (isLoading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader
        title="Notifications"
        description="Stay updated with your account and project activity."
        actions={
          <>
            <button
              onClick={() => toast("Notification settings opened.", "info")}
              className="flex items-center gap-2 bg-card border border-border hover:bg-muted/50 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm"
            >
              <Settings size={16} />{" "}
              <span className="hidden sm:inline">Settings</span>
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm"
              >
                <Check size={16} />{" "}
                <span className="hidden sm:inline">Mark all as read</span>
              </button>
            )}
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Notifications"
          value={notifications.length.toString()}
          change="+3"
          changeType="neutral"
          icon={Inbox}
          changeContext="this week"
        />
        <KpiCard
          title="Unread"
          value={unreadCount.toString()}
          change={unreadCount > 0 ? "Needs attention" : "All caught up"}
          changeType={unreadCount > 0 ? "negative" : "positive"}
          icon={MailOpen}
          changeContext={unreadCount > 0 ? `${unreadCount} pending` : "No action needed"}
        />
        <KpiCard
          title="Alerts"
          value={alertCount.toString()}
          change={alertCount > 0 ? "Requires action" : "No alerts"}
          changeType={alertCount > 0 ? "negative" : "positive"}
          icon={AlertOctagon}
          changeContext={alertCount > 0 ? "High priority" : "System healthy"}
        />
        <KpiCard
          title="Last Activity"
          value="2m"
          change="Just now"
          changeType="neutral"
          icon={Clock}
          changeContext="ago"
        />
      </div>

      {/* Notifications List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => handleMarkAsRead(notification.id)}
                onDelete={() => handleDelete(notification.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function EmptyState() {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Bell size={24} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mb-2">No notifications</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        You're all caught up! Check back later for new updates.
      </p>
    </div>
  );
}

interface NotificationItemProps {
  notification: NotificationData;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const { icon: Icon, color } = iconMap[notification.type];

  return (
    <div
      className={`p-4 sm:p-6 flex gap-4 transition-colors group ${notification.read ? "bg-background" : "bg-muted/10"
        }`}
    >
      <div className="shrink-0 mt-1">
        <Icon size={18} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
          <h3 className="text-sm font-medium">{notification.title}</h3>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {notification.time}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {notification.message}
        </p>

        {!notification.read && (
          <button
            onClick={onMarkAsRead}
            className="text-xs font-medium text-primary hover:underline"
          >
            Mark as read
          </button>
        )}
      </div>
      <div className="shrink-0 flex items-start gap-2">
        {!notification.read && (
          <div className="flex items-center justify-center w-2 mt-2">
            <div className="w-2 h-2 bg-nirex-accent rounded-full" />
          </div>
        )}
        <Dropdown
          align="right"
          trigger={
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors sm:opacity-0 group-hover:opacity-100">
              <MoreVertical size={16} />
            </button>
          }
        >
          {!notification.read && (
            <DropdownItem onClick={onMarkAsRead}>Mark as read</DropdownItem>
          )}
          <DropdownItem onClick={onDelete} className="text-destructive">
            Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}

import type {
  NotificationItem,
  NotificationKind,
  NotificationSeverity,
  ListNotificationsResponse,
} from '@nirex/shared';

export type {
  NotificationItem,
  NotificationKind,
  NotificationSeverity,
  ListNotificationsResponse,
};

export interface NotificationListInput {
  limit: number;
  cursor?: string;
  includeRead: boolean;
  includeArchived: boolean;
  kinds: NotificationKind[];
  severities: NotificationSeverity[];
}

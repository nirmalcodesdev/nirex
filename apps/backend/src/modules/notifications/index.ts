export {
  NotificationModel,
  type INotificationDocument,
} from './notifications.model.js';

export { notificationsRepository, NotificationsRepository } from './notifications.repository.js';
export { notificationsService, NotificationsService } from './notifications.service.js';
export * as notificationsController from './notifications.controller.js';
export { default as notificationsRoutes } from './notifications.routes.js';
export type {
  NotificationItem,
  NotificationKind,
  NotificationSeverity,
  ListNotificationsResponse,
  NotificationListInput,
} from './notifications.types.js';

import { Router } from 'express';
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser, requireApiKeyScopes } from '../../middleware/authenticateUser.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as notificationsController from './notifications.controller.js';

const router: Router = Router();

router.use(asyncWrapper(authenticateUser(['notifications:read'])));

router.get(
  '/',
  apiLimiter,
  validate(listNotificationsQuerySchema, 'query'),
  asyncWrapper(notificationsController.listNotifications),
);

router.get(
  '/unread-count',
  apiLimiter,
  asyncWrapper(notificationsController.getUnreadCount),
);

router.post(
  '/',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  validate(createNotificationSchema),
  asyncWrapper(notificationsController.createNotification),
);

router.patch(
  '/read-all',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  asyncWrapper(notificationsController.markAllNotificationsRead),
);

router.patch(
  '/:notificationId/read',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  validate(notificationIdParamSchema, 'params'),
  asyncWrapper(notificationsController.markNotificationRead),
);

router.patch(
  '/:notificationId/unread',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  validate(notificationIdParamSchema, 'params'),
  asyncWrapper(notificationsController.markNotificationUnread),
);

router.delete(
  '/:notificationId',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  validate(notificationIdParamSchema, 'params'),
  asyncWrapper(notificationsController.archiveNotification),
);

export default router;

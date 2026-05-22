import { Router } from 'express';
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  markNotificationsBatchReadSchema,
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

// Batch endpoint backing the frontend auto-read pipeline. Accepts an
// array of ids and marks them read in a single Mongo round-trip. Must
// be declared before the `/:notificationId/read` route so Express
// matches it on the literal segment, not the param.
router.patch(
  '/read',
  apiLimiter,
  requireApiKeyScopes(['notifications:write']),
  validate(markNotificationsBatchReadSchema),
  asyncWrapper(notificationsController.markNotificationsBatchRead),
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

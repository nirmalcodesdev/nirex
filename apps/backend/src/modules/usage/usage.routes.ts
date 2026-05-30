import { Router } from 'express';
import { usageExportQuerySchema, usageOverviewQuerySchema, requestLogsQuerySchema } from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser } from '../../middleware/authenticateUser.js';
import { validate } from '../../middleware/validate.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import * as usageController from './usage.controller.js';

const router: Router = Router();

router.use(asyncWrapper(authenticateUser(['usage:read'])));

router.get(
  '/overview',
  apiLimiter,
  validate(usageOverviewQuerySchema, 'query'),
  asyncWrapper(usageController.getOverview)
);

router.get(
  '/export',
  apiLimiter,
  validate(usageExportQuerySchema, 'query'),
  asyncWrapper(usageController.exportOverview)
);

router.get(
  '/requests',
  apiLimiter,
  validate(requestLogsQuerySchema, 'query'),
  asyncWrapper(usageController.getRequestLogs)
);

export default router;

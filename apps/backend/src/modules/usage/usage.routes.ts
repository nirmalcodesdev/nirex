import { Router } from 'express';
import { usageExportQuerySchema, usageOverviewQuerySchema } from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import * as usageController from './usage.controller.js';

const router: Router = Router();

router.use(asyncWrapper(authenticate));

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

export default router;

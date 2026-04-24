import { Router } from 'express';
import { dashboardOverviewQuerySchema } from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser } from '../../middleware/authenticateUser.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as dashboardController from './dashboard.controller.js';

const router: Router = Router();

router.use(asyncWrapper(authenticateUser(['dashboard:read'])));

router.get(
  '/overview',
  apiLimiter,
  validate(dashboardOverviewQuerySchema, 'query'),
  asyncWrapper(dashboardController.getOverview),
);

export default router;

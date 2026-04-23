import { Router } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import {
  apiKeyIdParamSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  rotateApiKeySchema,
} from './api-key.schemas.js';
import { authenticateApiKey } from './api-key.middleware.js';
import * as apiKeyController from './api-key.controller.js';

const router: Router = Router();

router.get('/self', asyncWrapper(authenticateApiKey()), asyncWrapper(apiKeyController.getApiKeyIdentity));

router.use(asyncWrapper(authenticate));

router.get('/', apiLimiter, asyncWrapper(apiKeyController.listApiKeys));
router.post(
  '/',
  apiLimiter,
  validate(createApiKeySchema),
  asyncWrapper(apiKeyController.createApiKey),
);
router.post(
  '/:keyId/rotate',
  apiLimiter,
  validate(apiKeyIdParamSchema, 'params'),
  validate(rotateApiKeySchema),
  asyncWrapper(apiKeyController.rotateApiKey),
);
router.delete(
  '/:keyId',
  apiLimiter,
  validate(apiKeyIdParamSchema, 'params'),
  validate(revokeApiKeySchema),
  asyncWrapper(apiKeyController.revokeApiKey),
);

export default router;

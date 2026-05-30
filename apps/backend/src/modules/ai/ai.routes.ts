/**
 * AI Routes
 *
 * Express routes for the AI model proxy.
 *
 * Endpoints:
 *   GET    /api/ai/models           — List available models
 *   POST   /api/ai/chat             — Non-streaming chat
 *   POST   /api/ai/chat/stream      — Streaming chat (SSE)
 *   POST   /api/ai/complete         — Code completion
 *   POST   /api/ai/embed            — Embeddings
 *   GET    /api/ai/health           — Provider health status
 */

import { Router } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser } from '../../middleware/authenticateUser.js';
import { validate } from '../../middleware/validate.js';
import { aiChatRequestSchema, aiChatQuerySchema } from '@nirex/shared';
import {
  apiLimiter,
  messageLimiter,
} from '../../middleware/rateLimiter.js';
import * as aiController from './ai.controller.js';

const router: Router = Router();

// All AI routes require JWT authentication
router.use(asyncWrapper(authenticateUser(['ai:read'])));

// GET /api/ai/models — List available models with capabilities
router.get(
  '/models',
  apiLimiter,
  asyncWrapper(aiController.listModels),
);

// GET /api/ai/health — Provider health status
router.get(
  '/health',
  apiLimiter,
  asyncWrapper(aiController.health),
);

// POST /api/ai/chat — Non-streaming chat
router.post(
  '/chat',
  messageLimiter,
  validate(aiChatRequestSchema),
  asyncWrapper(aiController.chat),
);

// POST /api/ai/chat/stream — Streaming chat (SSE)
// Note: Not wrapped in asyncWrapper because SSE handles its own lifecycle
router.post(
  '/chat/stream',
  messageLimiter,
  validate(aiChatRequestSchema),
  aiController.chatStream,
);

// POST /api/ai/complete — Code completion
router.post(
  '/complete',
  messageLimiter,
  asyncWrapper(aiController.complete),
);

// POST /api/ai/embed — Generate embeddings
router.post(
  '/embed',
  messageLimiter,
  asyncWrapper(aiController.embed),
);

export default router;

/**
 * Tools Routes
 *
 * Express routes for the tool execution engine.
 *
 * Endpoints:
 *   GET    /api/tools/registry              — List available tools
 *   POST   /api/tools/execute               — Execute a tool
 *   GET    /api/tools/history/session/:id   — Get session tool history
 *   GET    /api/tools/history/user          — Get user tool history
 */

import { Router } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser } from '../../middleware/authenticateUser.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import * as toolsController from './tools.controller.js';

const router: Router = Router();

// All tool routes require JWT authentication
router.use(asyncWrapper(authenticateUser(['ai:read'])));

// GET /api/tools/registry — List available tools
router.get(
  '/registry',
  apiLimiter,
  asyncWrapper(toolsController.getRegistry),
);

// POST /api/tools/execute — Execute a tool
router.post(
  '/execute',
  apiLimiter,
  asyncWrapper(toolsController.executeTool),
);

// GET /api/tools/history/session/:sessionId — Get session tool history
router.get(
  '/history/session/:sessionId',
  apiLimiter,
  asyncWrapper(toolsController.getSessionHistory),
);

// GET /api/tools/history/user — Get user tool history
router.get(
  '/history/user',
  apiLimiter,
  asyncWrapper(toolsController.getUserHistory),
);

export default router;

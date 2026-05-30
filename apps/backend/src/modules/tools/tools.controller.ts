/**
 * Tools Controller
 *
 * Express route handlers for tool execution and registry endpoints.
 */

import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { toolsService } from './tools.service.js';
import { AppError } from '../../types/index.js';

/**
 * GET /api/tools/registry
 * List all available tools with their definitions and metadata.
 */
export async function getRegistry(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const tools = toolsService.listTools();

  res.json({
    status: 'success',
    data: {
      tools,
      total: tools.length,
      categories: {
        file: tools.filter((t) => t.category === 'file').length,
        bash: tools.filter((t) => t.category === 'bash').length,
        git: tools.filter((t) => t.category === 'git').length,
        lsp: tools.filter((t) => t.category === 'lsp').length,
        web: tools.filter((t) => t.category === 'web').length,
        sandbox: tools.filter((t) => t.category === 'sandbox').length,
        custom: tools.filter((t) => t.category === 'custom').length,
      },
    },
  });
}

/**
 * POST /api/tools/execute
 * Execute a tool with the given arguments.
 */
export async function executeTool(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { tool_name, arguments: args, session_id, working_directory, permissions } = req.body;

  if (!req.userId) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  if (!tool_name) {
    throw new AppError('tool_name is required', 400, 'MISSING_TOOL_NAME');
  }

  if (!args || typeof args !== 'object') {
    throw new AppError('arguments must be an object', 400, 'INVALID_ARGUMENTS');
  }

  const result = await toolsService.executeTool(tool_name, args, {
    sessionId: session_id ? new Types.ObjectId(session_id) : new Types.ObjectId(),
    userId: new Types.ObjectId(req.userId),
    workingDirectory: working_directory || process.cwd(),
    permissions: permissions ? {
      defaultAction: permissions.default_action || 'ask',
      allowedTools: new Set(permissions.allowed_tools || []),
      deniedTools: new Set(permissions.denied_tools || []),
      allowedPaths: permissions.allowed_paths,
      deniedPaths: permissions.denied_paths,
    } : undefined,
  });

  res.json({
    status: 'success',
    data: result,
  });
}

/**
 * GET /api/tools/history/session/:sessionId
 * Get tool execution history for a session.
 */
export async function getSessionHistory(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { sessionId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

  if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
    throw new AppError('Invalid session ID', 400, 'INVALID_SESSION_ID');
  }

  const history = await toolsService.getSessionHistory(new Types.ObjectId(sessionId), limit);

  res.json({
    status: 'success',
    data: {
      history,
      total: history.length,
    },
  });
}

/**
 * GET /api/tools/history/user
 * Get tool execution history for the authenticated user.
 */
export async function getUserHistory(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
  const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

  const userId = new Types.ObjectId(req.userId);
  const history = await toolsService.getUserHistory(
    userId,
    { limit, startDate, endDate },
  );

  res.json({
    status: 'success',
    data: {
      history,
      total: history.length,
    },
  });
}

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../types/index.js';
import { apiKeyService } from './api-key.service.js';
import type { ApiKeyScope } from './api-key.model.js';

function extractApiKey(req: Request): string | null {
  const fromHeader = req.headers['x-api-key'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function getRequestIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim();
  }
  return req.ip || req.socket.remoteAddress || undefined;
}

export function authenticateApiKey(requiredScopes: ApiKeyScope[] = []) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawApiKey = extractApiKey(req);
      if (!rawApiKey) {
        throw new AppError('No API key provided', 401, 'UNAUTHENTICATED');
      }

      const principal = await apiKeyService.authenticateApiKey(
        rawApiKey,
        requiredScopes,
        getRequestIp(req),
      );

      req.userId = principal.userId;
      req.apiKeyId = principal.apiKeyId;
      req.apiKeyScopes = principal.scopes;
      req.authType = 'api_key';
      next();
    } catch (err) {
      next(err);
    }
  };
}

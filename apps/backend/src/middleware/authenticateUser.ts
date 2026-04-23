import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { authenticate } from './authenticate.js';
import { authenticateApiKey } from '../modules/api-keys/api-key.middleware.js';
import type { ApiKeyScope } from '../modules/api-keys/api-key.model.js';
import { AppError } from '../types/index.js';

function isApiKeyRequest(req: Request): boolean {
  if (typeof req.headers['x-api-key'] === 'string') {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const credential = authHeader.slice(7).trim();
  return credential.startsWith(`${env.API_KEY_PREFIX}_`);
}

export function authenticateUser(requiredApiKeyScopes: ApiKeyScope[] = []) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isApiKeyRequest(req)) {
      return authenticateApiKey(requiredApiKeyScopes)(req, res, next);
    }
    return authenticate(req, res, next);
  };
}

export function requireApiKeyScopes(requiredScopes: ApiKeyScope[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.authType !== 'api_key') {
      next();
      return;
    }

    const granted = (req as Request & { apiKeyScopes?: ApiKeyScope[] }).apiKeyScopes || [];
    const missing = requiredScopes.filter((scope) => !granted.includes(scope));

    if (missing.length > 0) {
      next(
        new AppError(
          `API key missing required scope(s): ${missing.join(', ')}`,
          403,
          'API_KEY_SCOPE_DENIED',
        ),
      );
      return;
    }

    next();
  };
}

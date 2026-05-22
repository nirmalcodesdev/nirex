import type { Request, Response } from 'express';
import type { CreateApiKeyRequest, ApiKeyScope } from '@nirex/shared';
import { Types } from 'mongoose';
import { AppError } from '../../types/index.js';
import { apiKeyService } from './api-key.service.js';
import { getRequestContext } from '../../utils/request-context.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { name, scopes, expiresAt } = req.body as CreateApiKeyRequest & {
    scopes: ApiKeyScope[];
  };

  const result = await apiKeyService.createApiKey(userId, {
    name,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    createdBySessionId: req.sessionId,
    requestContext: getRequestContext(req),
  });

  res.status(201).json({
    status: 'success',
    message: 'API key created. Store it now; it will not be shown again.',
    data: result,
  });
}

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const keys = await apiKeyService.listApiKeys(userId);

  res.json({
    status: 'success',
    data: { keys },
  });
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { keyId } = req.params as { keyId: string };
  const { reason } = req.body as { reason?: string };

  await apiKeyService.revokeApiKey(userId, keyId, reason, getRequestContext(req));

  res.json({
    status: 'success',
    message: 'API key revoked.',
  });
}

export async function rotateApiKey(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { keyId } = req.params as { keyId: string };
  const result = await apiKeyService.rotateApiKey(
    userId,
    keyId,
    req.sessionId,
    getRequestContext(req),
  );

  res.status(201).json({
    status: 'success',
    message: 'API key rotated. Store the new key now; it will not be shown again.',
    data: result,
  });
}

export async function getApiKeyIdentity(req: Request, res: Response): Promise<void> {
  if (!req.userId || !req.apiKeyId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }

  res.json({
    status: 'success',
    data: {
      userId: req.userId,
      apiKeyId: req.apiKeyId,
      authType: req.authType || 'api_key',
    },
  });
}

import crypto from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../../types/index.js';
import { env } from '../../config/env.js';
import { hashApiKey, timingSafeEqualHex } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import { apiKeyRepository } from './api-key.repository.js';
import { type ApiKeyScope } from './api-key.model.js';

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
  createdBySessionId?: string;
}

export interface ApiKeyAuthResult {
  userId: string;
  apiKeyId: string;
  scopes: ApiKeyScope[];
}

interface ApiKeyTokenParts {
  keyId: string;
}

function normalizeName(name: string): string {
  return name.trim();
}

function getEnvironmentLabel(): string {
  return env.NODE_ENV === 'production' ? 'live' : 'test';
}

function generateKeyId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function generateKeySecret(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function parseApiKey(rawKey: string): ApiKeyTokenParts {
  const parts = rawKey.split('_');
  if (parts.length < 4) {
    throw new AppError('Invalid API key format', 401, 'INVALID_API_KEY');
  }

  const keyId = parts[2];
  if (!keyId || !/^[a-f0-9]{16}$/i.test(keyId)) {
    throw new AppError('Invalid API key format', 401, 'INVALID_API_KEY');
  }

  return { keyId };
}

function ensureScopes(requiredScopes: ApiKeyScope[], grantedScopes: ApiKeyScope[]): void {
  for (const scope of requiredScopes) {
    if (!grantedScopes.includes(scope)) {
      throw new AppError(
        'API key does not have required scope',
        403,
        'API_KEY_SCOPE_DENIED',
      );
    }
  }
}

export class ApiKeyService {
  async createApiKey(
    userId: Types.ObjectId,
    input: CreateApiKeyInput,
  ): Promise<{
    apiKey: string;
    key: {
      id: string;
      name: string;
      keyPrefix: string;
      last4: string;
      scopes: ApiKeyScope[];
      expiresAt: Date | null;
      createdAt: Date;
      revokedAt: Date | null;
      lastUsedAt: Date | null;
    };
  }> {
    const name = normalizeName(input.name);
    if (!name) {
      throw new AppError('API key name is required', 422, 'VALIDATION_ERROR');
    }

    const keyId = generateKeyId();
    const keySecret = generateKeySecret();
    const prefix = env.API_KEY_PREFIX;
    const envLabel = getEnvironmentLabel();
    const apiKey = `${prefix}_${envLabel}_${keyId}_${keySecret}`;
    const keyPrefix = `${prefix}_${envLabel}_${keyId}`;
    const keyHash = hashApiKey(apiKey);
    const last4 = keySecret.slice(-4);

    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(Date.now() + env.API_KEY_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);

    const doc = await apiKeyRepository.create({
      userId,
      name,
      keyId,
      keyPrefix,
      last4,
      keyHash,
      scopes: input.scopes,
      expiresAt,
      createdBySessionId: input.createdBySessionId,
    });

    return {
      apiKey,
      key: {
        id: doc._id.toString(),
        name: doc.name,
        keyPrefix: doc.keyPrefix,
        last4: doc.last4,
        scopes: doc.scopes,
        expiresAt: doc.expiresAt || null,
        createdAt: doc.createdAt,
        revokedAt: doc.revokedAt || null,
        lastUsedAt: doc.lastUsedAt || null,
      },
    };
  }

  async listApiKeys(userId: Types.ObjectId): Promise<Array<{
    id: string;
    name: string;
    keyPrefix: string;
    last4: string;
    scopes: ApiKeyScope[];
    expiresAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    lastUsedIp: string | null;
  }>> {
    const docs = await apiKeyRepository.listByUser(userId);
    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      last4: doc.last4,
      scopes: doc.scopes,
      expiresAt: doc.expiresAt || null,
      createdAt: doc.createdAt,
      revokedAt: doc.revokedAt || null,
      lastUsedAt: doc.lastUsedAt || null,
      lastUsedIp: doc.lastUsedIp || null,
    }));
  }

  async revokeApiKey(userId: Types.ObjectId, apiKeyId: string, reason?: string): Promise<void> {
    const existing = await apiKeyRepository.findByIdAndUser(apiKeyId, userId);
    if (!existing) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    if (existing.revokedAt) {
      return;
    }

    await apiKeyRepository.revokeByIdAndUser(apiKeyId, userId, reason);
  }

  async rotateApiKey(
    userId: Types.ObjectId,
    apiKeyId: string,
    sessionId?: string,
  ): Promise<{
    apiKey: string;
    key: {
      id: string;
      name: string;
      keyPrefix: string;
      last4: string;
      scopes: ApiKeyScope[];
      expiresAt: Date | null;
      createdAt: Date;
      revokedAt: Date | null;
      lastUsedAt: Date | null;
    };
  }> {
    const existing = await apiKeyRepository.findByIdAndUser(apiKeyId, userId);
    if (!existing) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    await apiKeyRepository.revokeByIdAndUser(
      apiKeyId,
      userId,
      'Rotated by user',
    );

    return this.createApiKey(userId, {
      name: existing.name,
      scopes: existing.scopes,
      expiresAt: existing.expiresAt,
      createdBySessionId: sessionId,
    });
  }

  async authenticateApiKey(
    rawApiKey: string,
    requiredScopes: ApiKeyScope[] = [],
    ip?: string,
  ): Promise<ApiKeyAuthResult> {
    if (!rawApiKey || rawApiKey.length > 512) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    const { keyId } = parseApiKey(rawApiKey);
    const doc = await apiKeyRepository.findByKeyIdWithHash(keyId);
    if (!doc || !doc.keyHash) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    const expectedHash = hashApiKey(rawApiKey);
    if (!timingSafeEqualHex(expectedHash, doc.keyHash)) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    if (doc.revokedAt) {
      throw new AppError('API key is revoked', 401, 'API_KEY_REVOKED');
    }

    if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) {
      throw new AppError('API key has expired', 401, 'API_KEY_EXPIRED');
    }

    ensureScopes(requiredScopes, doc.scopes);

    void apiKeyRepository.touchLastUsed(doc._id, ip).catch((err: unknown) => {
      logger.warn('Failed to update API key last-used metadata', {
        apiKeyId: doc._id.toString(),
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return {
      userId: doc.userId.toString(),
      apiKeyId: doc._id.toString(),
      scopes: doc.scopes,
    };
  }
}

export const apiKeyService = new ApiKeyService();

import { z } from 'zod';
import { API_KEY_SCOPES } from './api-key.model.js';

const apiKeyScopeSchema = z.enum(API_KEY_SCOPES as [string, ...string[]]);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(100),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expiresAt: z
    .string()
    .datetime()
    .optional(),
});

export const rotateApiKeySchema = z.object({
  reason: z.string().trim().min(3).max(300).optional(),
});

export const revokeApiKeySchema = z.object({
  reason: z.string().trim().min(3).max(300).optional(),
});

export const apiKeyIdParamSchema = z.object({
  keyId: z.string().trim().min(1),
});

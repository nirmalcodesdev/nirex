export type ApiKeyScope =
  | 'sessions:read'
  | 'sessions:write'
  | 'ai:read'
  | 'usage:read'
  | 'billing:read'
  | 'billing:write'
  | 'dashboard:read'
  | 'notifications:read'
  | 'notifications:write';

export type ApiKeyErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_API_KEY'
  | 'API_KEY_REVOKED'
  | 'API_KEY_EXPIRED'
  | 'API_KEY_SCOPE_DENIED'
  | 'API_KEY_NOT_FOUND'
  | 'VALIDATION_ERROR';

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  last4: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | string | null;
  createdAt: Date | string;
  revokedAt: Date | string | null;
  lastUsedAt: Date | string | null;
  lastUsedIp: string | null;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: string;
  key: ApiKeyItem;
}

export interface ListApiKeysResponse {
  keys: ApiKeyItem[];
}

export interface RotateApiKeyRequest {
  reason?: string;
}

export interface RotateApiKeyResponse {
  apiKey: string;
  key: ApiKeyItem;
}

export interface RevokeApiKeyRequest {
  reason?: string;
}

export interface ApiKeyIdentityResponse {
  userId: string;
  apiKeyId: string;
  authType: 'api_key' | 'jwt';
}

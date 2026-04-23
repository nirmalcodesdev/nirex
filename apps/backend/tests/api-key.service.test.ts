import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { apiKeyService } from '../src/modules/api-keys/api-key.service.js';
import { apiKeyRepository } from '../src/modules/api-keys/api-key.repository.js';
import { hashApiKey } from '../src/utils/crypto.js';

describe('api-key service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates API key and returns plaintext only at creation time', async () => {
    const userId = new Types.ObjectId();
    const now = new Date('2026-04-23T00:00:00.000Z');

    vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
    vi.spyOn(apiKeyRepository, 'create').mockImplementation(async (input) => ({
      _id: new Types.ObjectId(),
      userId: input.userId,
      name: input.name,
      keyId: input.keyId,
      keyPrefix: input.keyPrefix,
      last4: input.last4,
      keyHash: input.keyHash,
      scopes: input.scopes,
      createdBySessionId: input.createdBySessionId,
      lastUsedAt: undefined,
      lastUsedIp: undefined,
      expiresAt: input.expiresAt,
      revokedAt: undefined,
      revokedReason: undefined,
      createdAt: now,
      updatedAt: now,
    }) as never);

    const result = await apiKeyService.createApiKey(userId, {
      name: 'CI Bot',
      scopes: ['sessions:read', 'usage:read'],
    });

    expect(result.apiKey).toMatch(/^nrx_test_[a-f0-9]{16}_[A-Za-z0-9_-]+$/);
    expect(result.key.name).toBe('CI Bot');
    expect(result.key.scopes).toEqual(['sessions:read', 'usage:read']);
    expect(result.key.keyPrefix.startsWith('nrx_test_')).toBe(true);
    expect(result.key.last4).toHaveLength(4);
  });

  it('authenticates a valid API key and updates last-used metadata', async () => {
    const userId = new Types.ObjectId();
    const keyId = '0011223344556677';
    const apiKey = `nrx_test_${keyId}_abcABC123_-xyz`;
    const keyHash = hashApiKey(apiKey);
    const touchSpy = vi.spyOn(apiKeyRepository, 'touchLastUsed').mockResolvedValue();

    vi.spyOn(apiKeyRepository, 'findByKeyIdWithHash').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      name: 'Automation',
      keyId,
      keyPrefix: `nrx_test_${keyId}`,
      last4: '_xyz'.slice(-4),
      keyHash,
      scopes: ['sessions:read'],
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    } as never);

    const result = await apiKeyService.authenticateApiKey(
      apiKey,
      ['sessions:read'],
      '127.0.0.1',
    );

    expect(result.userId).toBe(userId.toString());
    expect(result.scopes).toEqual(['sessions:read']);
    expect(touchSpy).toHaveBeenCalledOnce();
  });

  it('rejects API keys with missing required scopes', async () => {
    const userId = new Types.ObjectId();
    const keyId = 'ffeeddccbbaa9988';
    const apiKey = `nrx_test_${keyId}_secret_value`;

    vi.spyOn(apiKeyRepository, 'findByKeyIdWithHash').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      name: 'Readonly',
      keyId,
      keyPrefix: `nrx_test_${keyId}`,
      last4: 'alue',
      keyHash: hashApiKey(apiKey),
      scopes: ['usage:read'],
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    } as never);

    await expect(
      apiKeyService.authenticateApiKey(apiKey, ['billing:write']),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'API_KEY_SCOPE_DENIED',
    });
  });
});

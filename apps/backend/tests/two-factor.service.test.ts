import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { twoFactorService } from '../src/modules/auth/two-factor.service.js';
import { userRepository } from '../src/modules/user/user.repository.js';

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = input.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotp(secretBase32: string, atMs: number): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const b0 = hmac[offset] ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;
  const binary = ((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('two-factor service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts setup and persists a pending encrypted secret', async () => {
    const userId = new Types.ObjectId();
    const setPendingSpy = vi.spyOn(userRepository, 'setTwoFactorPendingSetup').mockResolvedValue();
    vi.spyOn(userRepository, 'findById').mockResolvedValue({
      _id: userId,
      email: 'user@example.com',
      twoFactor: { enabled: false, backupCodes: [] },
    } as never);

    const result = await twoFactorService.beginSetup(userId);

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(setPendingSpy).toHaveBeenCalledOnce();
  });

  it('verifies setup code and enables 2FA with backup codes', async () => {
    const userId = new Types.ObjectId();
    const now = new Date('2026-04-23T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    let pendingSecretPayload: { iv: string; tag: string; ciphertext: string } | null = null;

    vi.spyOn(userRepository, 'findById').mockResolvedValue({
      _id: userId,
      email: 'user@example.com',
      twoFactor: { enabled: false, backupCodes: [] },
    } as never);

    vi.spyOn(userRepository, 'setTwoFactorPendingSetup').mockImplementation(
      async (_userId, payload) => {
        pendingSecretPayload = payload;
      },
    );

    const setup = await twoFactorService.beginSetup(userId);
    const code = generateTotp(setup.secret, now.getTime());

    vi.spyOn(userRepository, 'findByIdWithTwoFactorSecrets').mockResolvedValue({
      _id: userId,
      email: 'user@example.com',
      twoFactor: {
        enabled: false,
        pendingSecret: pendingSecretPayload!,
        pendingExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        backupCodes: [],
      },
    } as never);
    const enableSpy = vi.spyOn(userRepository, 'enableTwoFactor').mockResolvedValue();

    const result = await twoFactorService.verifyAndEnable(userId, code);

    expect(result.backupCodes).toHaveLength(8);
    expect(enableSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('requires code during sign-in when 2FA is enabled', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(userRepository, 'findByIdWithTwoFactorSecrets').mockResolvedValue({
      _id: userId,
      email: 'user@example.com',
      twoFactor: {
        enabled: true,
        secret: { iv: 'x', tag: 'y', ciphertext: 'z' },
        backupCodes: [],
      },
    } as never);

    await expect(
      twoFactorService.assertSecondFactorForSignin(userId, undefined),
    ).rejects.toMatchObject({
      code: 'TWO_FACTOR_REQUIRED',
    });
  });
});

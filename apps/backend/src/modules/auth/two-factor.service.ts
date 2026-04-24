import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../types/index.js';
import { hashToken } from '../../utils/crypto.js';
import { userRepository } from '../user/user.repository.js';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const BACKUP_CODE_COUNT = 8;

interface EncryptedSecret {
  iv: string;
  tag: string;
  ciphertext: string;
}

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(env.TWO_FACTOR_ENCRYPTION_KEY, 'utf8').digest();
}

function encryptSecret(secret: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

function decryptSecret(payload: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(payload.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function base32Encode(input: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

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

function generateTotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const b0 = hmac[offset] ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;
  const binary =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8) |
    (b3 & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

function isValidTotp(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i += 1) {
    const expected = generateTotp(secretBase32, currentCounter + i);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function sanitizeCode(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase(),
  );
}

function createOtpAuthUrl(secret: string, email: string): string {
  const issuer = env.TWO_FACTOR_ISSUER;
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

async function verifyTotpOrBackupCode(
  userId: Types.ObjectId,
  secret: string,
  codeOrBackupCode: string,
): Promise<boolean> {
  const normalized = sanitizeCode(codeOrBackupCode);
  if (/^\d{6}$/.test(normalized) && isValidTotp(secret, normalized)) {
    return true;
  }

  const backupCodeHash = hashToken(normalized.toUpperCase());
  return userRepository.consumeTwoFactorBackupCode(userId, backupCodeHash);
}

export class TwoFactorService {
  async getStatus(userId: Types.ObjectId): Promise<{
    enabled: boolean;
    enabledAt: Date | null;
    lastVerifiedAt: Date | null;
    hasPendingSetup: boolean;
  }> {
    const user = await userRepository.findByIdWithTwoFactorSecrets(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return {
      enabled: !!user.twoFactor?.enabled,
      enabledAt: user.twoFactor?.enabledAt || null,
      lastVerifiedAt: user.twoFactor?.lastVerifiedAt || null,
      hasPendingSetup: !!user.twoFactor?.pendingSecret,
    };
  }

  async beginSetup(userId: Types.ObjectId): Promise<{
    secret: string;
    otpauthUrl: string;
    expiresAt: Date;
  }> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const secret = generateSecret();
    const encryptedPendingSecret = encryptSecret(secret);
    const expiresAt = new Date(Date.now() + env.TWO_FACTOR_SETUP_TTL_MINUTES * 60 * 1000);

    await userRepository.setTwoFactorPendingSetup(
      user._id,
      encryptedPendingSecret,
      expiresAt,
    );

    return {
      secret,
      otpauthUrl: createOtpAuthUrl(secret, user.email),
      expiresAt,
    };
  }

  async verifyAndEnable(
    userId: Types.ObjectId,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await userRepository.findByIdWithTwoFactorSecrets(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const pendingSecret = user.twoFactor?.pendingSecret;
    const pendingExpiresAt = user.twoFactor?.pendingExpiresAt;
    if (!pendingSecret || !pendingExpiresAt) {
      throw new AppError('2FA setup is not initialized', 400, 'TWO_FACTOR_SETUP_NOT_STARTED');
    }
    if (pendingExpiresAt.getTime() < Date.now()) {
      await userRepository.clearTwoFactorPendingSetup(userId);
      throw new AppError('2FA setup has expired. Start setup again.', 400, 'TWO_FACTOR_SETUP_EXPIRED');
    }

    const secret = decryptSecret(pendingSecret);
    const normalized = sanitizeCode(code);
    if (!isValidTotp(secret, normalized)) {
      throw new AppError('Invalid 2FA code', 401, 'TWO_FACTOR_CODE_INVALID');
    }

    const backupCodes = generateBackupCodes();
    const backupCodeHashes = backupCodes.map((backupCode) => hashToken(backupCode));

    await userRepository.enableTwoFactor(
      userId,
      pendingSecret,
      backupCodeHashes,
      new Date(),
    );

    return { backupCodes };
  }

  async disable(userId: Types.ObjectId, codeOrBackupCode: string): Promise<void> {
    const user = await userRepository.findByIdWithTwoFactorSecrets(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.twoFactor?.enabled || !user.twoFactor.secret) {
      throw new AppError('2FA is not enabled', 400, 'TWO_FACTOR_NOT_ENABLED');
    }

    const secret = decryptSecret(user.twoFactor.secret);
    const valid = await verifyTotpOrBackupCode(userId, secret, codeOrBackupCode);
    if (!valid) {
      throw new AppError('Invalid 2FA code', 401, 'TWO_FACTOR_CODE_INVALID');
    }

    await userRepository.disableTwoFactor(userId);
  }

  async assertSecondFactorForSignin(
    userId: Types.ObjectId,
    codeOrBackupCode: string | undefined,
  ): Promise<void> {
    const user = await userRepository.findByIdWithTwoFactorSecrets(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.twoFactor?.enabled) {
      return;
    }

    if (!codeOrBackupCode) {
      throw new AppError('Two-factor code is required', 401, 'TWO_FACTOR_REQUIRED');
    }

    if (!user.twoFactor.secret) {
      throw new AppError('Two-factor configuration is invalid', 500, 'TWO_FACTOR_CONFIG_INVALID');
    }

    const secret = decryptSecret(user.twoFactor.secret);
    const valid = await verifyTotpOrBackupCode(userId, secret, codeOrBackupCode);
    if (!valid) {
      throw new AppError('Invalid 2FA code', 401, 'TWO_FACTOR_CODE_INVALID');
    }

    await userRepository.updateTwoFactorLastVerified(userId, new Date());
  }
}

export const twoFactorService = new TwoFactorService();

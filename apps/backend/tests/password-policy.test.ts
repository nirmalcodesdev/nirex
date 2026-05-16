import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  passwordSchema,
  signUpSchema,
  validatePasswordPolicy,
} from '@nirex/shared';
import { hashPassword, verifyPassword } from '../src/utils/crypto.js';

vi.mock('../src/modules/user/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByEmailForAuth: vi.fn(),
  },
}));

vi.mock('../src/modules/token/token.service.js', () => ({
  tokenService: {
    verifyToken: vi.fn(),
    consumeToken: vi.fn(),
    createToken: vi.fn(),
  },
}));

vi.mock('../src/modules/session/session.service.js', () => ({
  sessionService: {
    revokeAllSessions: vi.fn(),
  },
}));

vi.mock('../src/modules/user/user.service.js', () => ({
  userService: {
    assertEmailAvailable: vi.fn(),
    createLocalUser: vi.fn(),
    updatePassword: vi.fn(),
  },
}));

vi.mock('../src/utils/mailer.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPasswordResetSuccessEmail: vi.fn(),
  sendSuspiciousSigninAlert: vi.fn(),
}));

import { userRepository } from '../src/modules/user/user.repository.js';
import { tokenService } from '../src/modules/token/token.service.js';
import { userService } from '../src/modules/user/user.service.js';
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail } from '../src/utils/mailer.js';
import * as authService from '../src/modules/auth/auth.service.js';

describe('password policy', () => {
  it('accepts long passphrases without composition requirements', () => {
    const parsed = passwordSchema.safeParse('quiet river station orange');

    expect(parsed.success).toBe(true);
  });

  it('rejects short passwords, common variants, context terms, repeats, and sequences', () => {
    expect(validatePasswordPolicy('short').issues.map((issue) => issue.code)).toContain('too_short');
    expect(validatePasswordPolicy('PasswordPassword2026!').issues.map((issue) => issue.code)).toContain('common_password');
    expect(validatePasswordPolicy('john-doe-private-passphrase', {
      email: 'john@example.com',
      fullName: 'John Doe',
    }).issues.map((issue) => issue.code)).toContain('contains_context');
    expect(validatePasswordPolicy('aaaaaaaaaaaaaaaa').issues.map((issue) => issue.code)).toContain('repeated_pattern');
    expect(validatePasswordPolicy('abcdef1234567890!').issues.map((issue) => issue.code)).toContain('sequential_pattern');
  });

  it('normalizes Unicode before validation and hashing', async () => {
    const composed = 'résumé secure passphrase';
    const decomposed = 're\u0301sume\u0301 secure passphrase';
    const parsed = passwordSchema.safeParse(decomposed);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe(composed);
    }

    const hash = await hashPassword(decomposed);
    await expect(verifyPassword(composed, hash)).resolves.toBe(true);
  });

  it('applies user context during sign-up schema validation', () => {
    const parsed = signUpSchema.safeParse({
      email: 'dev@example.com',
      fullName: 'Example Dev',
      password: 'example-dev-secure-passphrase',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['password']);
      expect(parsed.error.issues[0]?.message).toMatch(/name|email|Nirex/i);
    }
  });
});

describe('auth password changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects password reset when the new password matches the current password', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await hashPassword('current account passphrase');

    vi.mocked(tokenService.verifyToken).mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
    } as Awaited<ReturnType<typeof tokenService.verifyToken>>);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: userId,
      email: 'reset@example.com',
      fullName: 'Reset User',
      providers: [{ type: 'local', data: { passwordHash } }],
    } as Awaited<ReturnType<typeof userRepository.findById>>);

    await expect(authService.resetPassword('raw-token', 'current account passphrase')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(tokenService.consumeToken).not.toHaveBeenCalled();
    expect(userService.updatePassword).not.toHaveBeenCalled();
    expect(sendPasswordResetSuccessEmail).not.toHaveBeenCalled();
  });

  it('sends reset link email with request metadata only for existing users', async () => {
    const userId = new Types.ObjectId();
    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
      _id: userId,
      email: 'reset@example.com',
    } as Awaited<ReturnType<typeof userRepository.findByEmail>>);
    vi.mocked(tokenService.createToken).mockResolvedValueOnce('raw-reset-token');

    await authService.forgotPassword('reset@example.com', {
      ipAddress: '203.0.113.10',
      deviceInfo: 'Vitest Browser',
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith('reset@example.com', 'raw-reset-token', {
      requestedAt: expect.any(Date),
      ipAddress: '203.0.113.10',
      deviceInfo: 'Vitest Browser',
    });

    vi.clearAllMocks();
    vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);

    await authService.forgotPassword('missing@example.com', {
      ipAddress: '203.0.113.10',
      deviceInfo: 'Vitest Browser',
    });

    expect(tokenService.createToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends a password reset success email after updating password and revoking sessions', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await hashPassword('previous account passphrase');

    vi.mocked(tokenService.verifyToken).mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
    } as Awaited<ReturnType<typeof tokenService.verifyToken>>);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: userId,
      email: 'reset@example.com',
      fullName: 'Reset User',
      providers: [{ type: 'local', data: { passwordHash } }],
    } as Awaited<ReturnType<typeof userRepository.findById>>);

    await authService.resetPassword('raw-token', 'brand new account passphrase', {
      ipAddress: '203.0.113.11',
      deviceInfo: 'Vitest Browser',
    });

    expect(tokenService.consumeToken).toHaveBeenCalled();
    expect(userService.updatePassword).toHaveBeenCalled();
    expect(sendPasswordResetSuccessEmail).toHaveBeenCalledWith({
      to: 'reset@example.com',
      completedAt: expect.any(Date),
      ipAddress: '203.0.113.11',
      deviceInfo: 'Vitest Browser',
    });
  });
});

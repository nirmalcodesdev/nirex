import { faker } from '@faker-js/faker';
import { Types } from 'mongoose';
import { hashPassword } from '../../src/utils/crypto.js';
import { userRepository } from '../../src/modules/user/user.repository.js';
import { sessionRepository } from '../../src/modules/session/session.repository.js';
import { tokenRepository } from '../../src/modules/token/token.repository.js';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

export interface TestUserInput {
  email?: string;
  fullName?: string;
  password?: string;
  isEmailVerified?: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

export async function createTestUser(input: TestUserInput = {}): Promise<IUserDocument> {
  const password = input.password ?? faker.internet.password({ length: 12 });
  const passwordHash = await hashPassword(password);

  const user = await userRepository.create({
    email: input.email ?? faker.internet.email(),
    fullName: input.fullName ?? faker.person.fullName(),
    providers: [
      {
        type: 'local',
        data: { passwordHash },
      },
    ],
    isEmailVerified: input.isEmailVerified ?? true,
    failedLoginAttempts: input.failedLoginAttempts ?? 0,
    lockedUntil: input.lockedUntil ?? null,
  });

  // Attach plain password for testing
  (user as any).plainPassword = password;
  return user;
}

export async function createUnverifiedUser(input: TestUserInput = {}): Promise<IUserDocument> {
  return createTestUser({ ...input, isEmailVerified: false });
}

export async function createLockedUser(
  lockMinutes: number = 15,
  input: TestUserInput = {}
): Promise<IUserDocument> {
  const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  return createTestUser({
    ...input,
    isEmailVerified: true,
    failedLoginAttempts: 5,
    lockedUntil,
  });
}

export async function createSession(
  userId: Types.ObjectId,
  deviceInfo: string = 'Test Device',
  ipAddress: string = '127.0.0.1'
) {
  const crypto = await import('crypto');
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken, 'utf8').digest('hex');

  const session = await sessionRepository.create({
    userId,
    refreshTokenHash,
    deviceInfo,
    ipAddress,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return { session, rawRefreshToken };
}

export async function createVerifyToken(userId: Types.ObjectId) {
  const crypto = await import('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

  const token = await tokenRepository.create({
    userId,
    tokenHash,
    type: 'verify',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  });

  return { token, rawToken };
}

export async function createResetToken(userId: Types.ObjectId) {
  const crypto = await import('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

  const token = await tokenRepository.create({
    userId,
    tokenHash,
    type: 'reset',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  });

  return { token, rawToken };
}

export function generateValidPassword(): string {
  // Generate password that meets all requirements
  const lower = faker.string.alpha({ length: 3, casing: 'lower' });
  const upper = faker.string.alpha({ length: 3, casing: 'upper' });
  const number = faker.string.numeric(2);
  const special = '!@#$%';
  return `${lower}${upper}${number}${special}`;
}

export function generateInvalidEmails(): string[] {
  return [
    '',
    'plainstring',
    '@nodomain.com',
    'spaces in@email.com',
    'double@@at.com',
    'noat.sign',
    '.startingdot@example.com',
    'trailingdot.@example.com',
    'two..dots@example.com',
    'valid@sub.domain.com', // Actually valid
    `${'a'.repeat(250)}@example.com`, // Too long
  ];
}

export function generateInvalidPasswords(): { value: string; reason: string }[] {
  return [
    { value: '', reason: 'empty' },
    { value: 'short', reason: 'too short (7 chars)' },
    { value: '1234567', reason: 'too short numeric' },
    { value: 'a'.repeat(129), reason: 'too long (129 chars)' },
  ];
}

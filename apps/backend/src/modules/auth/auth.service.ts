import { Types } from 'mongoose';
import {
  AppError,
  TokenPair,
  type SignUpRequest,
  type SignInRequest,
  type SignInResponse,
  type OAuthProfile as SharedOAuthProfile,
} from '../../types/index.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
} from '../../utils/crypto.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/mailer.js';
import { userRepository } from '../user/user.repository.js';
import { tokenService } from '../token/token.service.js';
import { sessionService } from '../session/session.service.js';
import { userService } from '../user/user.service.js';
import type { IUserDocument } from '../user/user.model.js';
import { twoFactorService } from './two-factor.service.js';

// Re-export shared types for convenience
export type SignupInput = SignUpRequest;
export type SigninInput = SignInRequest;
export type SigninResult = SignInResponse;

// ── Sign Up ───────────────────────────────────────────────────────────────────
export async function signup(input: SignupInput): Promise<{ userId: string }> {
  await userService.assertEmailAvailable(input.email);

  const passwordHash = await hashPassword(input.password);
  const user = await userService.createLocalUser({
    email: input.email,
    fullName: input.fullName,
    passwordHash,
  });

  // Issue a verification token and email it
  const rawToken = await tokenService.createToken(user._id, 'verify');
  await sendVerificationEmail(user.email, rawToken);

  return { userId: user._id.toString() };
}

// ── Verify Email ──────────────────────────────────────────────────────────────
export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenDoc = await tokenService.verifyAndConsumeToken(rawToken, 'verify');
  await userService.markEmailVerified(tokenDoc.userId);
}

// ── Sign In ────────────────────────────────────────────────────────────────────
export async function signin(
  input: SigninInput & { twoFactorCode?: string },
  deviceInfo: string,
  ipAddress: string,
  country?: string,
): Promise<SigninResult> {
  const user = await userRepository.findByEmailForAuth(input.email);

  // Constant-time path: always run through lockout + verification checks
  // before returning, even for unknown emails, to prevent timing attacks.
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  await userService.assertAccountNotLocked(user);

  const localProvider = user.providers.find((p) => p.type === 'local');
  if (!localProvider) {
    throw new AppError(
      'This account uses social login. Please sign in with Google or GitHub.',
      400,
      'WRONG_PROVIDER',
    );
  }

  const passwordHash = (localProvider.data as { passwordHash: string }).passwordHash;
  const valid = await verifyPassword(input.password, passwordHash);

  if (!valid) {
    await userService.handleFailedSignin(user._id);
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isEmailVerified) {
    // Resend verification email
    const rawToken = await tokenService.createToken(user._id, 'verify');
    await sendVerificationEmail(user.email, rawToken);

    throw new AppError(
      'Please verify your email address before logging in. A new verification email has been sent to your inbox.',
      403,
      'EMAIL_NOT_VERIFIED',
    );
  }

  await twoFactorService.assertSecondFactorForSignin(user._id, input.twoFactorCode);

  await userService.resetFailedSignins(user._id);

  const { session, rawRefreshToken } = await sessionService.createSession(
    user._id,
    deviceInfo,
    ipAddress,
    country,
  );

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    sessionId: session._id.toString(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    userId: user._id.toString(),
    sessionId: session._id.toString(),
  };
}

export async function getTwoFactorStatus(userId: string) {
  return twoFactorService.getStatus(new Types.ObjectId(userId));
}

export async function beginTwoFactorSetup(userId: string) {
  return twoFactorService.beginSetup(new Types.ObjectId(userId));
}

export async function verifyTwoFactorSetup(userId: string, code: string) {
  return twoFactorService.verifyAndEnable(new Types.ObjectId(userId), code);
}

export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  await twoFactorService.disable(new Types.ObjectId(userId), code);
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export async function refresh(
  rawRefreshToken: string,
  ipAddress: string,
): Promise<TokenPair> {
  const { session, rawRefreshToken: newRawRefreshToken } =
    await sessionService.rotateSession(rawRefreshToken, ipAddress);

  const accessToken = signAccessToken({
    sub: session.userId.toString(),
    sessionId: session._id.toString(),
  });

  return { accessToken, refreshToken: newRawRefreshToken };
}

// ── Sign Out ───────────────────────────────────────────────────────────────────
export async function signout(sessionId: string): Promise<void> {
  await sessionService.revokeSession(new Types.ObjectId(sessionId));
}

// ── Sign Out All Sessions ──────────────────────────────────────────────────────
export async function signoutAll(userId: string): Promise<void> {
  await sessionService.revokeAllSessions(new Types.ObjectId(userId));
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export async function forgotPassword(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);
  // Always resolve successfully to prevent user enumeration
  if (!user) return;

  const rawToken = await tokenService.createToken(user._id, 'reset');
  await sendPasswordResetEmail(user.email, rawToken);
}

// ── Reset Password ────────────────────────────────────────────────────────────
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenDoc = await tokenService.verifyAndConsumeToken(rawToken, 'reset');
  const passwordHash = await hashPassword(newPassword);
  await userService.updatePassword(tokenDoc.userId, passwordHash);
  // Revoke all active sessions so existing refresh tokens are invalidated
  await sessionService.revokeAllSessions(tokenDoc.userId);
}

// ── Change Password ───────────────────────────────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = (await userRepository.findById(userId)) as IUserDocument | null;
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const localProvider = user.providers.find((p) => p.type === 'local');
  if (!localProvider) {
    throw new AppError(
      'Password change is not available for social login accounts.',
      400,
      'WRONG_PROVIDER',
    );
  }

  const passwordHash = (localProvider.data as { passwordHash: string }).passwordHash;
  const valid = await verifyPassword(currentPassword, passwordHash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CREDENTIALS');
  }

  const newHash = await hashPassword(newPassword);
  await userService.updatePassword(new Types.ObjectId(userId), newHash);
  // Revoke all sessions so other devices are signed out
  await sessionService.revokeAllSessions(new Types.ObjectId(userId));
}

// ── Get Current User ──────────────────────────────────────────────────────────
export async function getMe(userId: string): Promise<IUserDocument> {
  return userService.findById(userId);
}

// ── List Active Sessions ──────────────────────────────────────────────────────
export async function listSessions(userId: string) {
  return sessionService.listActiveSessions(new Types.ObjectId(userId));
}

// ── Revoke a Specific Session ─────────────────────────────────────────────────
export async function revokeSession(sessionId: string): Promise<void> {
  await sessionService.revokeSession(new Types.ObjectId(sessionId));
}

// ── Get Session by ID ─────────────────────────────────────────────────────────
export async function getSession(sessionId: string) {
  return sessionService.getSession(new Types.ObjectId(sessionId));
}

// ── Update Profile ────────────────────────────────────────────────────────────
export async function updateProfile(
  userId: string,
  fullName: string
): Promise<IUserDocument> {
  return userService.updateProfile(new Types.ObjectId(userId), fullName);
}

// ── OAuth Sign In ─────────────────────────────────────────────────────────────
export type OAuthProfile = SharedOAuthProfile;

export async function oauthSignin(
  profile: OAuthProfile,
  provider: 'google' | 'github',
  deviceInfo: string,
  ipAddress: string,
  country?: string
): Promise<SigninResult> {
  // Find or create user via OAuth
  const user = await userService.findOrCreateOAuthUser(profile, provider);

  // Create session
  const { session, rawRefreshToken } = await sessionService.createSession(
    user._id,
    deviceInfo,
    ipAddress,
    country,
  );

  // Generate access token
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    sessionId: session._id.toString(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    userId: user._id.toString(),
    sessionId: session._id.toString(),
  };
}

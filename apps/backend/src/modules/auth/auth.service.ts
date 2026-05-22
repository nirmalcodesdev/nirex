import { Types } from 'mongoose';
import {
  AppError,
  TokenPair,
  type SignUpRequest,
  type SignInRequest,
  type OAuthProfile as SharedOAuthProfile,
  validatePasswordPolicy,
} from '../../types/index.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
} from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendSuspiciousSigninAlert,
  sendPasswordChangedInSessionEmail,
  sendSignedOutEverywhereEmail,
  sendSessionRevokedEmail,
} from '../../utils/mailer.js';
import { sendNotificationEmailSafely } from '../../utils/notify-email.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { userRepository } from '../user/user.repository.js';
import { tokenService } from '../token/token.service.js';
import { sessionService } from '../session/session.service.js';
import { userService } from '../user/user.service.js';
import type { IUserDocument } from '../user/user.model.js';
import { twoFactorService } from './two-factor.service.js';
import type { RequestContext } from '../../utils/request-context.js';

// Re-export shared types for convenience
export type SignupInput = SignUpRequest;
export type SigninInput = SignInRequest;
export type SigninResult = TokenPair & {
  userId: string;
  sessionId: string;
};

function assertPasswordAccepted(password: string, user: { email: string; fullName: string }): string {
  const result = validatePasswordPolicy(password, {
    email: user.email,
    fullName: user.fullName,
  });

  if (!result.valid) {
    throw new AppError(
      result.issues[0]?.message ?? 'Password does not meet security requirements',
      422,
      'VALIDATION_ERROR',
    );
  }

  return result.normalizedPassword;
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
export async function signup(input: SignupInput): Promise<{ userId: string }> {
  const normalizedPassword = assertPasswordAccepted(input.password, {
    email: input.email,
    fullName: input.fullName,
  });
  await userService.assertEmailAvailable(input.email);

  const passwordHash = await hashPassword(normalizedPassword);
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

  // ── Security Alert: Detect suspicious new sign-ins ─────────────────────────────
  // Compare new session against existing sessions to detect unknown patterns
  const existingSessions = await sessionService.listActiveSessions(user._id);
  const isNewPattern = !existingSessions.some(s =>
    s.ipAddress === ipAddress &&
    s.deviceInfo === deviceInfo &&
    s.country === (country || 'Unknown')
  );

  if (isNewPattern && existingSessions.length > 0) {
    // Fire security alert (fire-and-forget, don't block sign-in)
    sendSuspiciousSigninAlert(user.email, ipAddress, deviceInfo).catch(err => {
      console.error('Security alert failed:', err.message);
    });
  }

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

export async function verifyTwoFactorSetup(
  userId: string,
  code: string,
  requestContext?: RequestContext,
) {
  return twoFactorService.verifyAndEnable(new Types.ObjectId(userId), code, requestContext);
}

export async function disableTwoFactor(
  userId: string,
  code: string,
  requestContext?: RequestContext,
): Promise<void> {
  await twoFactorService.disable(new Types.ObjectId(userId), code, requestContext);
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
export async function signoutAll(
  userId: string,
  requestContext?: RequestContext,
): Promise<void> {
  const userObjectId = new Types.ObjectId(userId);
  await sessionService.revokeAllSessions(userObjectId);
  void notifySecurityEvent({
    userId: userObjectId,
    notificationType: 'sign_out_all',
    title: 'Signed out of all devices',
    message: 'You signed out of every active session on your account.',
    severity: 'info',
    requestContext,
    sendEmail: ({ email, fullName }) =>
      sendSignedOutEverywhereEmail({
        to: email,
        customerName: fullName,
        eventTime: new Date(),
        ipAddress: requestContext?.ipAddress,
        deviceInfo: requestContext?.deviceInfo,
      }),
  });
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export async function forgotPassword(
  email: string,
  requestContext: { ipAddress?: string; deviceInfo?: string } = {},
): Promise<void> {
  const user = await userRepository.findByEmail(email);
  // Always resolve successfully to prevent user enumeration
  if (!user) return;

  const rawToken = await tokenService.createToken(user._id, 'reset');
  try {
    await sendPasswordResetEmail(user.email, rawToken, {
      requestedAt: new Date(),
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
    });
  } catch (err) {
    logger.error('Password reset email send failed', {
      userId: user._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Reset Password ────────────────────────────────────────────────────────────
export async function resetPassword(
  rawToken: string,
  newPassword: string,
  requestContext: { ipAddress?: string; deviceInfo?: string } = {},
): Promise<void> {
  const tokenDoc = await tokenService.verifyToken(rawToken, 'reset');
  const user = (await userRepository.findById(tokenDoc.userId)) as IUserDocument | null;
  if (!user) throw new AppError('Token is invalid or has expired', 400, 'TOKEN_INVALID');

  const localProvider = user.providers.find((p) => p.type === 'local');
  if (!localProvider) {
    throw new AppError(
      'Password reset is not available for social login accounts.',
      400,
      'WRONG_PROVIDER',
    );
  }

  const normalizedPassword = assertPasswordAccepted(newPassword, user);
  const currentHash = (localProvider.data as { passwordHash: string }).passwordHash;
  const isCurrentPassword = await verifyPassword(normalizedPassword, currentHash);
  if (isCurrentPassword) {
    throw new AppError('Choose a password you have not used for this account.', 422, 'VALIDATION_ERROR');
  }

  await tokenService.consumeToken(tokenDoc._id);
  const passwordHash = await hashPassword(normalizedPassword);
  await userService.updatePassword(tokenDoc.userId, passwordHash);
  // Revoke all active sessions so existing refresh tokens are invalidated
  await sessionService.revokeAllSessions(tokenDoc.userId);
  try {
    await sendPasswordResetSuccessEmail({
      to: user.email,
      completedAt: new Date(),
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
    });
  } catch (err) {
    logger.error('Password reset success email send failed', {
      userId: user._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Change Password ───────────────────────────────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  requestContext?: RequestContext,
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

  const normalizedPassword = assertPasswordAccepted(newPassword, user);
  const isSamePassword = await verifyPassword(normalizedPassword, passwordHash);
  if (isSamePassword) {
    throw new AppError('Choose a password you have not used for this account.', 422, 'VALIDATION_ERROR');
  }

  const newHash = await hashPassword(normalizedPassword);
  const userObjectId = new Types.ObjectId(userId);
  await userService.updatePassword(userObjectId, newHash);
  // Revoke all sessions so other devices are signed out
  await sessionService.revokeAllSessions(userObjectId);

  void notifySecurityEvent({
    userId: userObjectId,
    notificationType: 'password_changed_in_session',
    title: 'Password changed',
    message: 'Your password was changed. For your security, all other active sessions were signed out.',
    severity: 'warning',
    requestContext,
    sendEmail: () =>
      sendPasswordChangedInSessionEmail({
        to: user.email,
        customerName: user.fullName ?? null,
        eventTime: new Date(),
        ipAddress: requestContext?.ipAddress,
        deviceInfo: requestContext?.deviceInfo,
      }),
  });
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
export async function revokeSession(
  sessionId: string,
  options: {
    actingUserId?: string;
    requestContext?: RequestContext;
  } = {},
): Promise<void> {
  const sessionObjectId = new Types.ObjectId(sessionId);
  const session = await sessionService.getSession(sessionObjectId);
  await sessionService.revokeSession(sessionObjectId);

  if (!session) return;
  // Only notify when the user revoked one of their OWN sessions and it isn't
  // the session they're acting from (signout of current device is silent).
  const isSelfAction = options.actingUserId && session.userId.toString() === options.actingUserId;
  const isCurrentSession = options.actingUserId
    && session._id.toString() === options.actingUserId;
  if (!isSelfAction || isCurrentSession) return;

  void notifySecurityEvent({
    userId: session.userId,
    notificationType: 'session_revoked',
    title: 'A device was signed out',
    message: 'A signed-in device on your account was terminated.',
    severity: 'info',
    requestContext: options.requestContext,
    sendEmail: ({ email, fullName }) =>
      sendSessionRevokedEmail({
        to: email,
        customerName: fullName,
        eventTime: new Date(),
        ipAddress: options.requestContext?.ipAddress,
        deviceInfo: options.requestContext?.deviceInfo,
        revokedDeviceInfo: session.deviceInfo ?? null,
        revokedIp: session.ipAddress ?? null,
      }),
  });
}

// ── Shared helper: notify on security events (in-app + email) ─────────────────
async function notifySecurityEvent(input: {
  userId: Types.ObjectId;
  notificationType: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  requestContext?: RequestContext;
  sendEmail: (params: { email: string; fullName: string | null }) => Promise<void>;
}): Promise<void> {
  try {
    await notificationsService.createNotification(input.userId, {
      kind: 'security',
      severity: input.severity,
      title: input.title,
      message: input.message,
      metadata: {
        event: input.notificationType,
        ipAddress: input.requestContext?.ipAddress ?? null,
        deviceInfo: input.requestContext?.deviceInfo ?? null,
      },
    });
  } catch (error) {
    logger.warn('Failed to create security notification.', {
      userId: input.userId.toHexString(),
      notificationType: input.notificationType,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const owner = await userRepository.findById(input.userId);
    if (!owner?.email) return;
    await sendNotificationEmailSafely({
      category: 'security',
      notificationType: input.notificationType,
      send: () => input.sendEmail({ email: owner.email, fullName: owner.fullName ?? null }),
      context: { userId: input.userId.toHexString() },
    });
  } catch (error) {
    logger.warn('Failed to dispatch security email notification.', {
      userId: input.userId.toHexString(),
      notificationType: input.notificationType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

  // ── Security Alert: Detect suspicious new sign-ins ─────────────────────────────
  const existingSessions = await sessionService.listActiveSessions(user._id);
  const isNewPattern = !existingSessions.some(s =>
    s.ipAddress === ipAddress &&
    s.deviceInfo === deviceInfo &&
    s.country === (country || 'Unknown')
  );

  if (isNewPattern && existingSessions.length > 0) {
    sendSuspiciousSigninAlert(user.email, ipAddress, deviceInfo).catch(err => {
      console.error('Security alert failed:', err.message);
    });
  }

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

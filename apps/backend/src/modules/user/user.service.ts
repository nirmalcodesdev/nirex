import { Types } from 'mongoose';
import { userRepository } from './user.repository.js';
import { IUserDocument, IProvider, ProviderData } from './user.model.js';
import { AppError, type ProviderType } from '../../types/index.js';

export class UserService {
  async findById(id: string): Promise<IUserDocument> {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return user;
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return userRepository.findByEmail(email);
  }

  // Returns a user-friendly error for duplicate emails.
  // In production, you may want to send a "welcome back" email instead of revealing the email exists.
  async assertEmailAvailable(email: string): Promise<void> {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(
        'An account with this email already exists. Please sign in or use a different email address.',
        400,
        'EMAIL_ALREADY_EXISTS'
      );
    }
  }

  async createLocalUser(data: {
    email: string;
    fullName: string;
    passwordHash: string;
  }): Promise<IUserDocument> {
    const provider: IProvider = {
      type: 'local',
      data: { passwordHash: data.passwordHash },
    };
    return userRepository.create({
      email: data.email,
      fullName: data.fullName,
      providers: [provider],
      isEmailVerified: false,
    });
  }

  // Account linking: if a user signs in via OAuth with an email that already
  // exists (registered locally or via another provider), we merge the new
  // provider onto the existing record rather than creating a duplicate.
  async findOrCreateOAuthUser(
    profile: { id: string; email: string; fullName: string },
    providerType: Exclude<ProviderType, 'local'>
  ): Promise<IUserDocument> {

    // 1. Check by provider ID — fastest path for returning OAuth users
    let user = await userRepository.findByProvider(providerType, profile.id);
    if (user) return user;

    // 2. Check by email — enables account linking across providers
    user = await userRepository.findByEmail(profile.email);

    if (user) {
      // Link the new provider to the existing account if not already linked
      const alreadyLinked = user.providers.some((p) => p.type === providerType);
      if (!alreadyLinked) {
        const providerData: ProviderData =
          providerType === 'google'
            ? { googleId: profile.id }
            : { githubId: profile.id };
        await userRepository.addProvider(user._id, {
          type: providerType,
          data: providerData,
        });
        // Re-fetch to get the updated document
        user = (await userRepository.findById(user._id)) as IUserDocument;
      }
      return user;
    }

    // 3. New user via OAuth — email is pre-verified by the identity provider
    const newProviderData: ProviderData =
      providerType === 'google'
        ? { googleId: profile.id }
        : { githubId: profile.id };
    return userRepository.create({
      email: profile.email,
      fullName: profile.fullName,
      providers: [
        {
          type: providerType,
          data: newProviderData,
        },
      ],
      isEmailVerified: true,
    });
  }

  // Throws 429 with retry-after information if the account is locked.
  async assertAccountNotLocked(user: IUserDocument): Promise<void> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSeconds = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1_000
      );
      throw new AppError(
        `Account is temporarily locked. Please try again in ${retryAfterSeconds} seconds.`,
        429,
        'ACCOUNT_LOCKED'
      );
    }
  }

  // Progressive lockout with exponential backoff:
  // ≥5 attempts  → 1 min lock
  // ≥10 attempts → 5 min lock
  // ≥15 attempts → 15 min lock
  // ≥20 attempts → 60 min lock
  async handleFailedSignin(userId: Types.ObjectId): Promise<void> {
    const attempts = await userRepository.incrementFailedSignins(userId);

    const lockMinutes =
      attempts >= 20 ? 60 : attempts >= 15 ? 15 : attempts >= 10 ? 5 : attempts >= 5 ? 1 : 0;

    if (lockMinutes > 0) {
      const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1_000);
      await userRepository.setLockout(userId, lockedUntil);
    }
  }

  async resetFailedSignins(userId: Types.ObjectId): Promise<void> {
    await userRepository.resetFailedSignins(userId);
  }

  async markEmailVerified(userId: Types.ObjectId): Promise<void> {
    await userRepository.updateEmailVerified(userId, true);
  }

  async updatePassword(userId: Types.ObjectId, passwordHash: string): Promise<void> {
    await userRepository.updatePassword(userId, passwordHash);
  }

  /**
   * Update user profile (fullName only)
   * @returns The updated user document
   */
  async updateProfile(
    userId: Types.ObjectId,
    fullName: string
  ): Promise<IUserDocument> {
    const updatedUser = await userRepository.updateProfile(userId, {
      fullName: fullName.trim(),
    });

    if (!updatedUser) {
      throw new AppError(
        'Failed to update profile. Please try again later.',
        500,
        'PROFILE_UPDATE_FAILED'
      );
    }

    return updatedUser;
  }
}

export const userService = new UserService();

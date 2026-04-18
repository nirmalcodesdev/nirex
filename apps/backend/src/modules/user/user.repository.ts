import { FilterQuery, Types } from 'mongoose';
import { IUserDocument, IProvider, UserModel } from './user.model.js';
import type { ProviderType } from '../../types/index.js';

// All DB calls are isolated to the repository layer.
// Services and controllers must never call Mongoose directly.

export class UserRepository {
  async findById(id: string | Types.ObjectId): Promise<IUserDocument | null> {
    return UserModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  // Locate a user by their OAuth provider ID.
  // fieldMap translates provider type to the nested Mixed field path.
  async findByProvider(
    providerType: Exclude<ProviderType, 'local'>,
    providerId: string
  ): Promise<IUserDocument | null> {
    const fieldMap: Record<string, string> = {
      google: 'providers.data.googleId',
      github: 'providers.data.githubId',
    };
    const field = fieldMap[providerType];
    if (!field) return null;

    return UserModel.findOne({
      [field]: providerId,
    } as FilterQuery<IUserDocument>).exec();
  }

  async create(data: {
    email: string;
    fullName: string;
    providers: IProvider[];
    isEmailVerified?: boolean;
  }): Promise<IUserDocument> {
    return UserModel.create(data);
  }

  async addProvider(
    userId: Types.ObjectId,
    provider: IProvider
  ): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(
      userId,
      { $push: { providers: provider } },
      { new: true }
    ).exec();
  }

  async updateEmailVerified(userId: Types.ObjectId, verified: boolean): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      isEmailVerified: verified,
    }).exec();
  }

  // Updates the passwordHash for the user's 'local' provider sub-document.
  // Uses positional operator $ to target the matched provider in the array.
  async updatePassword(userId: Types.ObjectId, passwordHash: string): Promise<void> {
    await UserModel.updateOne(
      { _id: userId, 'providers.type': 'local' },
      { $set: { 'providers.$.data.passwordHash': passwordHash } }
    ).exec();
  }

  async incrementFailedSignins(userId: Types.ObjectId): Promise<number> {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { failedSigninAttempts: 1 } },
      { new: true }
    ).exec();
    return updated?.failedSigninAttempts ?? 0;
  }

  async setLockout(userId: Types.ObjectId, until: Date): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      lockedUntil: until,
      failedSigninAttempts: 0,
    }).exec();
  }

  async resetFailedSignins(userId: Types.ObjectId): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { lockedUntil: '' },
      failedSigninAttempts: 0,
    }).exec();
  }

  /**
   * Update user profile fields (fullName and/or email)
   * Returns the updated user document
   */
  async updateProfile(
    userId: Types.ObjectId,
    updates: { fullName?: string; email?: string }
  ): Promise<IUserDocument | null> {
    const updateData: Record<string, unknown> = {};

    if (updates.fullName !== undefined) {
      updateData.fullName = updates.fullName.trim();
    }

    if (updates.email !== undefined) {
      updateData.email = updates.email.toLowerCase().trim();
    }

    return UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();
  }
}

export const userRepository = new UserRepository();

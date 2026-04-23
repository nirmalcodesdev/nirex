import { Types } from 'mongoose';
import { ApiKeyModel, type ApiKeyScope, type IApiKeyDocument } from './api-key.model.js';

export class ApiKeyRepository {
  async create(data: {
    userId: Types.ObjectId;
    name: string;
    keyId: string;
    keyPrefix: string;
    last4: string;
    keyHash: string;
    scopes: ApiKeyScope[];
    createdBySessionId?: string;
    expiresAt?: Date;
  }): Promise<IApiKeyDocument> {
    return ApiKeyModel.create(data);
  }

  async listByUser(userId: Types.ObjectId): Promise<IApiKeyDocument[]> {
    return ApiKeyModel.find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIdAndUser(id: string, userId: Types.ObjectId): Promise<IApiKeyDocument | null> {
    return ApiKeyModel.findOne({ _id: id, userId }).exec();
  }

  async findByKeyIdWithHash(keyId: string): Promise<IApiKeyDocument | null> {
    return ApiKeyModel.findOne({ keyId })
      .select('+keyHash')
      .exec();
  }

  async revokeByIdAndUser(
    id: string,
    userId: Types.ObjectId,
    reason?: string,
  ): Promise<boolean> {
    const update = await ApiKeyModel.updateOne(
      { _id: id, userId, revokedAt: { $exists: false } },
      {
        $set: {
          revokedAt: new Date(),
          ...(reason ? { revokedReason: reason } : {}),
        },
      },
    ).exec();

    return update.modifiedCount > 0;
  }

  async touchLastUsed(id: Types.ObjectId, ip?: string): Promise<void> {
    await ApiKeyModel.updateOne(
      { _id: id },
      {
        $set: {
          lastUsedAt: new Date(),
          ...(ip ? { lastUsedIp: ip } : {}),
        },
      },
    ).exec();
  }
}

export const apiKeyRepository = new ApiKeyRepository();

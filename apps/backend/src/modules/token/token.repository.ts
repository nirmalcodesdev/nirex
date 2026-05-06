import { Types } from 'mongoose';
import { ITokenDocument, TokenModel } from './token.model.js';
import { TokenType } from '../../types/index.js';

export class TokenRepository {
  async create(data: {
    userId: Types.ObjectId;
    tokenHash: string;
    type: TokenType;
    expiresAt: Date;
  }): Promise<ITokenDocument> {
    return TokenModel.create(data);
  }

  // Finds a valid (unexpired, unconsumed) token document by its SHA-256 hash.
  // Using the hash as the lookup key means the raw token never touches the DB.
  async findValidByHash(
    tokenHash: string,
    type: TokenType
  ): Promise<ITokenDocument | null> {
    return TokenModel.findOne({
      tokenHash,
      type,
      usedAt: { $exists: false },   // not yet consumed
      expiresAt: { $gt: new Date() }, // not expired
    }).exec();
  }

  // Mark a token as consumed to prevent replay. Performs an atomic
  // find-and-update that only succeeds if the token hasn't been used yet.
  async markUsed(tokenId: Types.ObjectId): Promise<boolean> {
    // Use findOneAndUpdate with a condition that token hasn't been used
    const result = await TokenModel.findOneAndUpdate(
      {
        _id: tokenId,
        usedAt: { $exists: false },  // Only match if not yet consumed
      },
      { $set: { usedAt: new Date() } }
    ).exec();

    // Return true if we successfully marked it used (result exists)
    // Return false if it was already used (result is null)
    return result !== null;
  }

  // Invalidate any outstanding tokens of a given type for a user.
  // Called before issuing a new token to prevent token accumulation.
  async invalidateActiveForUser(
    userId: Types.ObjectId,
    type: TokenType
  ): Promise<void> {
    await TokenModel.updateMany(
      { userId, type, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } }
    ).exec();
  }

  // Find all tokens for a user (used primarily for testing)
  async findByUserId(userId: Types.ObjectId): Promise<ITokenDocument[]> {
    return TokenModel.find({ userId }).exec();
  }
}

export const tokenRepository = new TokenRepository();

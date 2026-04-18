import { Types } from 'mongoose';
import { tokenRepository } from './token.repository.js';
import { ITokenDocument } from './token.model.js';
import { generateSecureToken, hashToken } from '../../utils/crypto.js';
import { AppError, TokenType } from '../../types/index.js';

// 15-minute window — short enough to limit the usability of an intercepted
// link while long enough for normal email delivery latency.
const TOKEN_TTL_MS = 15 * 60 * 1_000;

export class TokenService {
  async createToken(userId: Types.ObjectId, type: TokenType): Promise<string> {
    // Invalidate any outstanding tokens of the same type first.
    // This prevents an attacker who obtained a previous link from using it
    // after the user requested a new one.
    await tokenRepository.invalidateActiveForUser(userId, type);

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await tokenRepository.create({ userId, tokenHash, type, expiresAt });

    // Only the raw token leaves this method — it goes directly to the email
    // sender and is never stored anywhere.
    return rawToken;
  }

  async verifyAndConsumeToken(
    rawToken: string,
    type: TokenType
  ): Promise<ITokenDocument> {
    const tokenHash = hashToken(rawToken);
    const tokenDoc = await tokenRepository.findValidByHash(tokenHash, type);

    if (!tokenDoc) {
      // Single error message regardless of whether the token was never issued,
      // expired, or already used — prevents oracle attacks.
      throw new AppError('Token is invalid or has expired', 400, 'TOKEN_INVALID');
    }

    // Consume the token immediately before any downstream side-effects.
    // If the downstream operation fails, the token is still burned — this
    // forces the user to request a fresh token, which is the safe behaviour.
    await tokenRepository.markUsed(tokenDoc._id);

    return tokenDoc;
  }

  // Find all tokens for a user (used primarily for testing)
  async findByUserId(userId: Types.ObjectId): Promise<ITokenDocument[]> {
    return tokenRepository.findByUserId(userId);
  }
}

export const tokenService = new TokenService();

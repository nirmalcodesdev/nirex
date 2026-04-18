import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

/**
 * Token Blacklist Service
 *
 * Manages a blacklist of revoked access tokens using Redis.
 * When a user signs out from all devices, their access tokens are
 * blacklisted until they naturally expire (15 minutes).
 *
 * This provides immediate revocation of access tokens without waiting
 * for the JWT to expire naturally.
 */

const BLACKLIST_PREFIX = 'token:blacklist:';
const USER_BLACKLIST_PREFIX = 'user:blacklist:';

/**
 * Blacklist a specific JWT token (used for single session sign-out)
 */
export async function blacklistToken(
  jti: string,
  expiresInSeconds: number
): Promise<void> {
  if (!isRedisAvailable()) {
    logger.warn('Redis unavailable - token blacklist skipped', { jti });
    return;
  }

  const redis = getRedisClient();
  const key = `${BLACKLIST_PREFIX}${jti}`;

  // Store with TTL equal to token's remaining lifetime
  await redis.setex(key, expiresInSeconds, 'revoked');

  logger.debug('Token blacklisted', { jti, expiresInSeconds });
}

/**
 * Blacklist all tokens for a user by setting a global revocation timestamp
 * This is more efficient than blacklisting individual tokens
 */
export async function blacklistAllUserTokens(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    logger.warn('Redis unavailable - user token blacklist skipped', { userId });
    return;
  }

  const redis = getRedisClient();
  const key = `${USER_BLACKLIST_PREFIX}${userId}`;

  // Store the timestamp when all tokens were revoked
  const revocationTimestamp = Date.now();

  // Set with TTL of 15 minutes (max access token lifetime)
  // After this, the blacklist entry can be safely removed
  await redis.setex(key, 15 * 60, revocationTimestamp.toString());

  logger.info('All user tokens blacklisted', { userId, revocationTimestamp });
}

/**
 * Check if a specific token is blacklisted
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const redis = getRedisClient();
  const key = `${BLACKLIST_PREFIX}${jti}`;

  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Check if all tokens for a user were revoked before a given timestamp
 */
export async function isUserGloballyBlacklisted(
  userId: string,
  tokenIssuedAt: number
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const redis = getRedisClient();
  const key = `${USER_BLACKLIST_PREFIX}${userId}`;

  const revocationTimestamp = await redis.get(key);

  if (!revocationTimestamp) {
    return false;
  }

  // If token was issued before the global revocation, it's invalid
  return tokenIssuedAt < parseInt(revocationTimestamp, 10);
}

/**
 * Clean up blacklist entries (called periodically or on sign-out)
 */
export async function cleanupBlacklist(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  const redis = getRedisClient();
  const key = `${USER_BLACKLIST_PREFIX}${userId}`;

  await redis.del(key);

  logger.debug('User blacklist cleaned up', { userId });
}

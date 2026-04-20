/**
 * Chat Session Redis Cache Service
 *
 * Production-grade caching layer for chat sessions and messages.
 * Implements caching strategies for:
 * - Session metadata (TTL: 5 minutes)
 * - Recent messages per session (TTL: 10 minutes, last 100 messages)
 * - Message search results (TTL: 2 minutes)
 * - User session lists (TTL: 5 minutes)
 *
 * All cache operations gracefully degrade when Redis is unavailable.
 */

import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import type { ChatSessionDTO, MessageDTO } from '@nirex/shared';

// Cache key prefixes
const CACHE_PREFIXES = {
  SESSION: 'chat:session:',
  SESSION_MESSAGES: 'chat:session:messages:',
  USER_SESSIONS: 'chat:user:sessions:',
  MESSAGE_SEARCH: 'chat:search:',
  MESSAGE: 'chat:message:',
} as const;

// TTL configurations (in seconds)
const CACHE_TTL = {
  SESSION: 300, // 5 minutes
  SESSION_MESSAGES: 600, // 10 minutes
  USER_SESSIONS: 300, // 5 minutes
  MESSAGE_SEARCH: 120, // 2 minutes
  MESSAGE: 600, // 10 minutes
} as const;

// Maximum messages to cache per session
const MAX_CACHED_MESSAGES = 100;

/**
 * Generate cache key with prefix
 */
function key(prefix: string, identifier: string): string {
  return `${prefix}${identifier}`;
}

/**
 * Safely execute Redis operation with fallback
 */
async function withFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName: string
): Promise<T> {
  if (!isRedisAvailable()) {
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    logger.warn(`Cache ${operationName} failed`, { error });
    return fallback;
  }
}

/**
 * Cache service for chat sessions
 */
export const chatSessionCache = {
  /**
   * Get cached session metadata
   */
  async getSession(sessionId: string): Promise<ChatSessionDTO | null> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const cached = await redis.get(key(CACHE_PREFIXES.SESSION, sessionId));
        if (cached) {
          logger.debug('Cache hit: session', { sessionId });
          return JSON.parse(cached) as ChatSessionDTO;
        }
        return null;
      },
      null,
      'getSession'
    );
  },

  /**
   * Cache session metadata
   */
  async setSession(session: ChatSessionDTO): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        await redis.setex(
          key(CACHE_PREFIXES.SESSION, session.id),
          CACHE_TTL.SESSION,
          JSON.stringify(session)
        );
        logger.debug('Cache set: session', { sessionId: session.id });
      },
      undefined,
      'setSession'
    );
  },

  /**
   * Invalidate cached session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        await redis.del(key(CACHE_PREFIXES.SESSION, sessionId));
        // Also invalidate messages for this session
        await redis.del(key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId));
        logger.debug('Cache invalidated: session', { sessionId });
      },
      undefined,
      'invalidateSession'
    );
  },

  /**
   * Get cached recent messages for a session
   */
  async getSessionMessages(sessionId: string): Promise<MessageDTO[] | null> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const cached = await redis.lrange(
          key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId),
          0,
          MAX_CACHED_MESSAGES - 1
        );
        if (cached && cached.length > 0) {
          logger.debug('Cache hit: session messages', {
            sessionId,
            count: cached.length,
          });
          return cached.map((m) => JSON.parse(m) as MessageDTO);
        }
        return null;
      },
      null,
      'getSessionMessages'
    );
  },

  /**
   * Cache a message and add to session's message list
   */
  async addMessage(message: MessageDTO): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const sessionKey = key(
          CACHE_PREFIXES.SESSION_MESSAGES,
          message.session_id
        );

        // Add message to the front of the list (LPUSH for reverse chronological)
        await redis.lpush(sessionKey, JSON.stringify(message));

        // Trim to max size
        await redis.ltrim(sessionKey, 0, MAX_CACHED_MESSAGES - 1);

        // Set/refresh TTL
        await redis.expire(sessionKey, CACHE_TTL.SESSION_MESSAGES);

        // Also cache individual message
        await redis.setex(
          key(CACHE_PREFIXES.MESSAGE, message.id),
          CACHE_TTL.MESSAGE,
          JSON.stringify(message)
        );

        logger.debug('Cache set: message', {
          messageId: message.id,
          sessionId: message.session_id,
        });
      },
      undefined,
      'addMessage'
    );
  },

  /**
   * Cache multiple messages for a session (bulk load)
   */
  async setSessionMessages(
    sessionId: string,
    messages: MessageDTO[]
  ): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const sessionKey = key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId);

        // Clear existing
        await redis.del(sessionKey);

        if (messages.length === 0) {
          return;
        }

        // Add messages in reverse order (oldest first) so LPUSH gives us newest first
        const serialized = messages
          .slice(-MAX_CACHED_MESSAGES)
          .map((m) => JSON.stringify(m));

        await redis.lpush(sessionKey, ...serialized);
        await redis.expire(sessionKey, CACHE_TTL.SESSION_MESSAGES);

        // Cache individual messages
        const pipeline = redis.pipeline();
        for (const message of messages.slice(-20)) {
          // Only cache last 20 individually
          pipeline.setex(
            key(CACHE_PREFIXES.MESSAGE, message.id),
            CACHE_TTL.MESSAGE,
            JSON.stringify(message)
          );
        }
        await pipeline.exec();

        logger.debug('Cache set: session messages bulk', {
          sessionId,
          count: messages.length,
        });
      },
      undefined,
      'setSessionMessages'
    );
  },

  /**
   * Invalidate session messages cache
   */
  async invalidateSessionMessages(sessionId: string): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        await redis.del(key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId));
        logger.debug('Cache invalidated: session messages', { sessionId });
      },
      undefined,
      'invalidateSessionMessages'
    );
  },

  /**
   * Get cached message by ID
   */
  async getMessage(messageId: string): Promise<MessageDTO | null> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const cached = await redis.get(key(CACHE_PREFIXES.MESSAGE, messageId));
        if (cached) {
          logger.debug('Cache hit: message', { messageId });
          return JSON.parse(cached) as MessageDTO;
        }
        return null;
      },
      null,
      'getMessage'
    );
  },

  /**
   * Update cached message (for edits)
   */
  async updateMessage(message: MessageDTO): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();

        // Update individual message cache
        await redis.setex(
          key(CACHE_PREFIXES.MESSAGE, message.id),
          CACHE_TTL.MESSAGE,
          JSON.stringify(message)
        );

        // Update in session list - we need to find and replace
        // Since Redis lists don't support efficient updates, we invalidate
        // the session messages cache to force a refresh
        await redis.del(key(CACHE_PREFIXES.SESSION_MESSAGES, message.session_id));

        logger.debug('Cache updated: message', {
          messageId: message.id,
          sessionId: message.session_id,
        });
      },
      undefined,
      'updateMessage'
    );
  },

  /**
   * Mark message as deleted in cache
   */
  async deleteMessage(
    messageId: string,
    sessionId: string
  ): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();

        // Delete individual message cache
        await redis.del(key(CACHE_PREFIXES.MESSAGE, messageId));

        // Invalidate session messages to force refresh
        await redis.del(key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId));

        logger.debug('Cache deleted: message', { messageId, sessionId });
      },
      undefined,
      'deleteMessage'
    );
  },

  /**
   * Get cached user sessions list
   */
  async getUserSessions(userId: string): Promise<ChatSessionDTO[] | null> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const cached = await redis.get(key(CACHE_PREFIXES.USER_SESSIONS, userId));
        if (cached) {
          logger.debug('Cache hit: user sessions', { userId });
          return JSON.parse(cached) as ChatSessionDTO[];
        }
        return null;
      },
      null,
      'getUserSessions'
    );
  },

  /**
   * Cache user sessions list
   */
  async setUserSessions(
    userId: string,
    sessions: ChatSessionDTO[]
  ): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        await redis.setex(
          key(CACHE_PREFIXES.USER_SESSIONS, userId),
          CACHE_TTL.USER_SESSIONS,
          JSON.stringify(sessions)
        );
        logger.debug('Cache set: user sessions', { userId, count: sessions.length });
      },
      undefined,
      'setUserSessions'
    );
  },

  /**
   * Invalidate user sessions cache
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        await redis.del(key(CACHE_PREFIXES.USER_SESSIONS, userId));
        logger.debug('Cache invalidated: user sessions', { userId });
      },
      undefined,
      'invalidateUserSessions'
    );
  },

  /**
   * Invalidate all caches for a session (comprehensive cleanup)
   */
  async invalidateAllSessionCaches(sessionId: string, userId?: string): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const keysToDelete = [
          key(CACHE_PREFIXES.SESSION, sessionId),
          key(CACHE_PREFIXES.SESSION_MESSAGES, sessionId),
        ];

        await redis.del(...keysToDelete);

        if (userId) {
          await redis.del(key(CACHE_PREFIXES.USER_SESSIONS, userId));
        }

        logger.debug('Cache invalidated: all session caches', { sessionId, userId });
      },
      undefined,
      'invalidateAllSessionCaches'
    );
  },

  /**
   * Get cache statistics (for monitoring)
   */
  async getStats(): Promise<{
    sessionCount: number;
    messageListCount: number;
    userSessionCount: number;
    individualMessageCount: number;
  }> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const [
          sessionKeys,
          messageListKeys,
          userSessionKeys,
          individualMessageKeys,
        ] = await Promise.all([
          redis.keys(`${CACHE_PREFIXES.SESSION}*`),
          redis.keys(`${CACHE_PREFIXES.SESSION_MESSAGES}*`),
          redis.keys(`${CACHE_PREFIXES.USER_SESSIONS}*`),
          redis.keys(`${CACHE_PREFIXES.MESSAGE}*`),
        ]);

        return {
          sessionCount: sessionKeys.length,
          messageListCount: messageListKeys.length,
          userSessionCount: userSessionKeys.length,
          individualMessageCount: individualMessageKeys.length,
        };
      },
      {
        sessionCount: 0,
        messageListCount: 0,
        userSessionCount: 0,
        individualMessageCount: 0,
      },
      'getStats'
    );
  },

  /**
   * Clear all chat-related caches (use with caution)
   */
  async clearAll(): Promise<void> {
    return withFallback(
      async () => {
        const redis = getRedisClient();
        const keys = await redis.keys('chat:*');
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info('All chat caches cleared', { count: keys.length });
        }
      },
      undefined,
      'clearAll'
    );
  },
};

// Export cache configuration for external use
export { CACHE_PREFIXES, CACHE_TTL, MAX_CACHED_MESSAGES };

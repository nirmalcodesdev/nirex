/**
 * Realtime Gateway
 *
 * Attaches Socket.IO to the existing HTTP server, authenticates each
 * handshake against the existing JWT cookie, and exposes a thin
 * `getIo()` accessor for the publisher. Designed to be a no-op-safe
 * dependency: domain code calls into the publisher, never the gateway
 * directly, so notification writes never fail because realtime is down.
 *
 * Multi-instance fanout uses `@socket.io/redis-adapter` driven by the
 * existing `ioredis` singleton (one client duplicated for pub + sub).
 * If Redis is unavailable in development, the gateway falls back to
 * standalone mode; in production this is a fatal misconfiguration and
 * the existing `connectRedis()` startup check will already have caught it.
 */

import type { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import { Server as IoServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from '../../config/env.js';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { readCookie, ACCESS_TOKEN_COOKIE } from '../auth/auth.cookies.js';
import { verifyAccessToken } from '../../utils/crypto.js';
import { RealtimeChannel } from '@nirex/shared';

import type { RealtimeSocketData } from './realtime.types.js';
import { userRoom } from './realtime.types.js';

// Module-level singleton — set on init, cleared on close.
let io: IoServer | null = null;
const serverId = randomUUID();

export function getIo(): IoServer | null {
  return io;
}

export function isGatewayReady(): boolean {
  return io !== null;
}

/**
 * Parse the access-token cookie out of the raw handshake `Cookie` header.
 * The handshake doesn't go through Express, so we can't reuse
 * `readAccessTokenCookie(req)` directly — but the cookie format is identical.
 */
function extractAccessTokenFromHandshake(socket: Socket): string | null {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return null;

  // Reuse the same parser the Express middleware uses, by emulating its
  // minimal `req` contract (only `headers.cookie` is read).
  return readCookie(
    { headers: { cookie: cookieHeader } } as never,
    ACCESS_TOKEN_COOKIE,
  );
}

/**
 * Socket.IO middleware that authenticates the handshake using the JWT
 * access-token cookie. We deliberately skip the global token-blacklist
 * Redis call here to keep the handshake fast; revocation is enforced on
 * every REST/mutation call the same client makes alongside the socket.
 * If stronger guarantees are needed later, swap this for the same
 * checks the Express `authenticate` middleware performs.
 */
function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  try {
    const token = extractAccessTokenFromHandshake(socket);
    if (!token) {
      return next(new Error('UNAUTHENTICATED'));
    }

    const payload = verifyAccessToken(token);

    const data: RealtimeSocketData = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      jti: payload.jti,
      authType: 'jwt',
    };
    Object.assign(socket.data, data);

    next();
  } catch (err) {
    logger.debug('Socket auth rejected', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    next(new Error('UNAUTHENTICATED'));
  }
}

async function installRedisAdapter(server: IoServer): Promise<boolean> {
  if (!isRedisAvailable()) {
    if (env.NODE_ENV === 'production') {
      // Defensive: connectRedis() would already have failed in prod,
      // but if it somehow didn't, refuse to silently fan out to a single box.
      throw new Error(
        'Redis is required in production for the realtime adapter',
      );
    }
    logger.warn(
      'Redis unavailable — realtime gateway running in standalone (single-instance) mode',
    );
    return false;
  }

  const base = getRedisClient();
  const pubClient = base.duplicate();
  const subClient = base.duplicate();

  // ioredis with lazyConnect won't auto-open duplicates — force connect.
  await Promise.all([pubClient.connect(), subClient.connect()]);

  server.adapter(createAdapter(pubClient, subClient));
  logger.info('Realtime gateway: Redis adapter installed for cross-instance fanout');
  return true;
}

/**
 * Initialise the gateway on the existing http.Server.
 * Idempotent — safe to call once during bootstrap.
 */
export async function initRealtimeGateway(httpServer: HttpServer): Promise<void> {
  if (io) {
    logger.debug('Realtime gateway already initialised — skipping');
    return;
  }

  const server = new IoServer(httpServer, {
    path: env.SOCKET_IO_PATH,
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: env.SOCKET_IO_PING_INTERVAL_MS,
    pingTimeout: env.SOCKET_IO_PING_TIMEOUT_MS,
    maxHttpBufferSize: env.SOCKET_IO_MAX_PAYLOAD_BYTES,
    // Allow both transports; client picks the best.
    transports: ['websocket', 'polling'],
    // Allow short-window state recovery so brief disconnects don't drop events.
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  });

  await installRedisAdapter(server);

  server.use(authMiddleware);

  server.on('connection', (socket) => {
    const data = socket.data as RealtimeSocketData;
    void socket.join(userRoom(data.userId));

    logger.info('Realtime socket connected', {
      socketId: socket.id,
      userId: data.userId,
      sessionId: data.sessionId,
      serverId,
    });

    socket.emit(RealtimeChannel.ConnectionReady, {
      user_id: data.userId,
      server_id: serverId,
    });

    socket.on('disconnect', (reason) => {
      logger.info('Realtime socket disconnected', {
        socketId: socket.id,
        userId: data.userId,
        reason,
        serverId,
      });
    });

    socket.on('error', (err) => {
      logger.warn('Realtime socket error', {
        socketId: socket.id,
        userId: data.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  io = server;
  logger.info('Realtime gateway initialised', {
    path: env.SOCKET_IO_PATH,
    serverId,
  });
}

/**
 * Graceful shutdown. Drains connected sockets, then closes the server.
 * Must be called before `disconnectRedis()` so the pub/sub clients stay
 * alive long enough to flush in-flight broadcasts.
 */
export async function closeRealtimeGateway(): Promise<void> {
  if (!io) return;
  const server = io;
  io = null;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  logger.info('Realtime gateway closed');
}

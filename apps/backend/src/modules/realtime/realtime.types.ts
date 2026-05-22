/**
 * Internal types for the realtime module.
 *
 * Public event names and payloads live in `@nirex/shared` so the client
 * and server can't drift apart.
 */

import type { Types } from 'mongoose';

export type UserIdLike = string | Types.ObjectId;

export interface SocketAuthData {
  userId: string;
  sessionId: string;
  // Token jti — useful for future per-token revocation if we wire it in.
  jti: string;
}

/**
 * Shape of `socket.data` after the auth middleware runs.
 * Mirrors `req.userId` / `req.sessionId` / `req.authType` on Express.
 */
export interface RealtimeSocketData extends SocketAuthData {
  authType: 'jwt';
}

export const userRoom = (userId: UserIdLike): string =>
  `user:${typeof userId === 'string' ? userId : userId.toString()}`;

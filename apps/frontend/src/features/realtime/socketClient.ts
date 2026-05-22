/**
 * Socket.IO client singleton.
 *
 * The auth handshake relies on the existing HttpOnly `nirex_access`
 * cookie — `withCredentials: true` makes the browser include it in the
 * upgrade request. The cookie is set by the backend on sign-in, so we
 * never need to read or attach the JWT manually.
 *
 * The socket URL is derived from `VITE_API_URL`'s origin so cookies match
 * the API host. The Socket.IO path is configurable (defaults to
 * `/socket.io`) and must match the backend's `SOCKET_IO_PATH`.
 */

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../../lib/backendApi";

const SOCKET_PATH = "/socket.io";

function deriveSocketOrigin(): string {
  try {
    const url = new URL(API_BASE_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    // Fallback for misconfigured envs — same-origin.
    return window.location.origin;
  }
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(deriveSocketOrigin(), {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    // Slightly longer than the default 20s to tolerate slow proxies.
    timeout: 25_000,
  });

  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
}

/**
 * Tear down the singleton entirely. Use on hard sign-out so a subsequent
 * sign-in as a different user creates a fresh connection (and a fresh
 * handshake with the new cookie).
 */
export function destroySocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

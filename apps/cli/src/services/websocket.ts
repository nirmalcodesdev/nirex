/**
 * WebSocket Client Service
 *
 * Manages real-time WebSocket/Socket.IO connection to the Nirex backend.
 * Used by the CLI for streaming AI responses, tool execution status, and
 * session synchronization.
 */

import { io, Socket } from 'socket.io-client';
import type { StreamEvent } from '@nirex/shared';
import { loadConfig } from '../utils/config.js';

export interface WsClientOptions {
  apiKey: string;
  baseUrl?: string;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
}

export type StreamEventHandler = (event: StreamEvent) => void;
export type ConnectionHandler = (connected: boolean) => void;

/**
 * Creates a managed WebSocket connection to the Nirex backend.
 *
 * Features:
 * - JWT auth via auth.token handshake
 * - Auto-reconnection with exponential backoff
 * - Stream event routing to registered handlers
 * - Graceful disconnect and cleanup
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private streamHandlers: Set<StreamEventHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private options: WsClientOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;

  constructor(options: WsClientOptions) {
    this.options = {
      autoReconnect: true,
      reconnectDelayMs: 1000,
      ...options,
    };
  }

  connect(): void {
    if (this.socket?.connected) return;

    this.intentionalClose = false;
    const config = loadConfig();
    const wsUrl = this.options.baseUrl ?? config.backend?.wsUrl ?? 'http://localhost:3001';

    this.socket = io(wsUrl, {
      path: '/api/v1/realtime',
      auth: {
        token: this.options.apiKey,
      },
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection ourselves
      timeout: config.backend?.timeoutMs ?? 30000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.notifyConnection(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyConnection(false);
      if (!this.intentionalClose && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      if (!this.intentionalClose && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('stream', (event: StreamEvent) => {
      for (const handler of this.streamHandlers) {
        try {
          handler(event);
        } catch {
          // Suppress handler errors to keep other handlers working
        }
      }
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onStream(handler: StreamEventHandler): () => void {
    this.streamHandlers.add(handler);
    return () => {
      this.streamHandlers.delete(handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  emit(event: string, data: Record<string, unknown>): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private notifyConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(connected);
      } catch {
        // Suppress handler errors
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      (this.options.reconnectDelayMs ?? 1000) * Math.pow(2, this.reconnectAttempts),
      30000,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

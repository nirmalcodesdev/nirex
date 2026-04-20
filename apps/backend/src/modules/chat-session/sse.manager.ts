import type { Response } from 'express';
import { logger } from '../../utils/logger.js';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import type { Redis } from 'ioredis';

interface Client {
  id: string;
  userId: string;
  sessionId?: string;
  res: Response;
  heartbeatInterval?: NodeJS.Timeout;
}

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

// Redis channel names
const CHANNELS = {
  USER_EVENTS: 'sse:user:',
  SESSION_EVENTS: 'sse:session:',
  BROADCAST: 'sse:broadcast',
} as const;

/**
 * SSE Manager for real-time chat session updates
 *
 * Supports horizontal scaling via Redis Pub/Sub.
 * When running in a multi-instance deployment, events are published to Redis
 * and broadcast to all connected clients across all server instances.
 */
class SSEManager {
  private clients: Map<string, Client> = new Map();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private redisSubscriber: Redis | null = null;
  private redisPublisher: Redis | null = null;
  private isSubscribed = false;
  private instanceId: string;

  constructor() {
    // Generate unique instance ID for this server
    this.instanceId = `${process.pid}-${Date.now()}`;
    this.initializeRedis();
  }

  /**
   * Initialize Redis Pub/Sub connections
   */
  private async initializeRedis(): Promise<void> {
    if (!isRedisAvailable()) {
      logger.info('Redis not available - SSE running in single-instance mode');
      return;
    }

    try {
      // Create separate connections for pub/sub (required by Redis)
      this.redisPublisher = getRedisClient();
      this.redisSubscriber = getRedisClient().duplicate();

      // Set up message handler
      this.redisSubscriber.on('message', (channel, message) => {
        this.handleRedisMessage(channel, message);
      });

      // Subscribe to broadcast channel
      await this.redisSubscriber.subscribe(CHANNELS.BROADCAST);
      this.isSubscribed = true;

      logger.info('SSE Redis Pub/Sub initialized', { instanceId: this.instanceId });
    } catch (error) {
      logger.error('Failed to initialize SSE Redis Pub/Sub', { error });
      this.redisSubscriber = null;
      this.redisPublisher = null;
    }
  }

  /**
   * Handle incoming Redis messages
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const event = JSON.parse(message) as SSEEvent & {
        _instanceId: string;
        _targetUserId?: string;
        _targetSessionId?: string;
      };

      // Skip messages from this instance (already broadcast locally)
      if (event._instanceId === this.instanceId) {
        return;
      }

      logger.debug('Received Redis SSE event', { channel, type: event.type });

      // Broadcast to local clients
      if (event._targetUserId) {
        this.broadcastToUserLocal(event._targetUserId, event);
      } else if (event._targetSessionId) {
        this.broadcastToSessionLocal(event._targetSessionId, event);
      } else {
        this.broadcastToAllLocal(event);
      }
    } catch (error) {
      logger.warn('Failed to handle Redis SSE message', { error });
    }
  }

  /**
   * Subscribe to user-specific events
   */
  async subscribeToUser(userId: string): Promise<void> {
    if (!this.redisSubscriber || !this.isSubscribed) return;

    try {
      await this.redisSubscriber.subscribe(`${CHANNELS.USER_EVENTS}${userId}`);
    } catch (error) {
      logger.warn('Failed to subscribe to user channel', { userId, error });
    }
  }

  /**
   * Unsubscribe from user-specific events
   */
  async unsubscribeFromUser(userId: string): Promise<void> {
    if (!this.redisSubscriber || !this.isSubscribed) return;

    try {
      await this.redisSubscriber.unsubscribe(`${CHANNELS.USER_EVENTS}${userId}`);
    } catch (error) {
      logger.warn('Failed to unsubscribe from user channel', { userId, error });
    }
  }

  /**
   * Subscribe to session-specific events
   */
  async subscribeToSession(sessionId: string): Promise<void> {
    if (!this.redisSubscriber || !this.isSubscribed) return;

    try {
      await this.redisSubscriber.subscribe(`${CHANNELS.SESSION_EVENTS}${sessionId}`);
    } catch (error) {
      logger.warn('Failed to subscribe to session channel', { sessionId, error });
    }
  }

  /**
   * Unsubscribe from session-specific events
   */
  async unsubscribeFromSession(sessionId: string): Promise<void> {
    if (!this.redisSubscriber || !this.isSubscribed) return;

    try {
      await this.redisSubscriber.unsubscribe(`${CHANNELS.SESSION_EVENTS}${sessionId}`);
    } catch (error) {
      logger.warn('Failed to unsubscribe from session channel', { sessionId, error });
    }
  }

  /**
   * Publish event to Redis for cross-instance broadcasting
   */
  private async publishToRedis(
    channel: string,
    event: SSEEvent,
    targetUserId?: string,
    targetSessionId?: string
  ): Promise<void> {
    if (!this.redisPublisher || !isRedisAvailable()) return;

    try {
      const message = JSON.stringify({
        ...event,
        _instanceId: this.instanceId,
        _targetUserId: targetUserId,
        _targetSessionId: targetSessionId,
      });

      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      logger.warn('Failed to publish SSE event to Redis', { channel, error });
    }
  }

  /**
   * Add a new SSE client
   */
  async addClient(
    clientId: string,
    userId: string,
    res: Response,
    sessionId?: string
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    const client: Client = {
      id: clientId,
      userId,
      sessionId,
      res,
    };

    this.clients.set(clientId, client);

    // Subscribe to user and session channels
    await this.subscribeToUser(userId);
    if (sessionId) {
      await this.subscribeToSession(sessionId);
    }

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
    });

    // Setup heartbeat
    client.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(clientId);
    }, this.HEARTBEAT_INTERVAL);

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });

    logger.info('SSE client connected', { clientId, userId, sessionId });
  }

  /**
   * Remove a client
   */
  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.heartbeatInterval) {
        clearInterval(client.heartbeatInterval);
      }

      // Unsubscribe from channels if no other clients for this user/session
      const hasOtherClientsForUser = this.hasClientsForUser(client.userId, clientId);
      const hasOtherClientsForSession =
        client.sessionId && this.hasClientsForSession(client.sessionId, clientId);

      if (!hasOtherClientsForUser) {
        await this.unsubscribeFromUser(client.userId);
      }
      if (client.sessionId && !hasOtherClientsForSession) {
        await this.unsubscribeFromSession(client.sessionId);
      }

      this.clients.delete(clientId);
      logger.info('SSE client disconnected', { clientId });
    }
  }

  /**
   * Check if there are other clients for a user
   */
  private hasClientsForUser(userId: string, excludeClientId: string): boolean {
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeClientId && client.userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there are other clients for a session
   */
  private hasClientsForSession(sessionId: string, excludeClientId: string): boolean {
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeClientId && client.sessionId === sessionId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Send event to a specific client
   */
  sendToClient(clientId: string, data: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (err) {
      logger.warn('Failed to send SSE to client', { clientId, error: (err as Error).message });
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send event to all clients for a specific user (local only)
   */
  private broadcastToUserLocal(userId: string, data: unknown): void {
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        this.sendToClient(clientId, data);
      }
    }
  }

  /**
   * Send event to all clients for a specific user (with Redis broadcast)
   */
  async broadcastToUser(userId: string, data: unknown): Promise<void> {
    // Send to local clients
    this.broadcastToUserLocal(userId, data);

    // Publish to Redis for other instances
    await this.publishToRedis(
      `${CHANNELS.USER_EVENTS}${userId}`,
      data as SSEEvent,
      userId
    );
  }

  /**
   * Send event to all clients subscribed to a specific session (local only)
   */
  private broadcastToSessionLocal(sessionId: string, data: unknown): void {
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId) {
        this.sendToClient(clientId, data);
      }
    }
  }

  /**
   * Send event to all clients subscribed to a specific session (with Redis broadcast)
   */
  async broadcastToSession(sessionId: string, data: unknown): Promise<void> {
    // Send to local clients
    this.broadcastToSessionLocal(sessionId, data);

    // Publish to Redis for other instances
    await this.publishToRedis(
      `${CHANNELS.SESSION_EVENTS}${sessionId}`,
      data as SSEEvent,
      undefined,
      sessionId
    );
  }

  /**
   * Send event to all connected clients (local only)
   */
  private broadcastToAllLocal(data: unknown): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, data);
    }
  }

  /**
   * Send event to all connected clients (with Redis broadcast)
   */
  async broadcastToAll(data: unknown): Promise<void> {
    // Send to local clients
    this.broadcastToAllLocal(data);

    // Publish to Redis for other instances
    await this.publishToRedis(CHANNELS.BROADCAST, data as SSEEvent);
  }

  /**
   * Send heartbeat to keep connection alive
   */
  private sendHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.res.write(':heartbeat\n\n');
    } catch (err) {
      this.removeClient(clientId);
    }
  }

  /**
   * Notify about new message
   */
  async notifyNewMessage(
    sessionId: string,
    userId: string,
    message: unknown
  ): Promise<void> {
    const event = {
      type: 'new_message',
      sessionId,
      message,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to session subscribers
    await this.broadcastToSession(sessionId, event);

    // Also notify user's other clients
    await this.broadcastToUser(userId, {
      type: 'session_updated',
      sessionId,
      event: 'new_message',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify about session update
   */
  async notifySessionUpdate(
    sessionId: string,
    userId: string,
    update: unknown
  ): Promise<void> {
    const event = {
      type: 'session_updated',
      sessionId,
      update,
      timestamp: new Date().toISOString(),
    };

    await Promise.all([
      this.broadcastToSession(sessionId, event),
      this.broadcastToUser(userId, event),
    ]);
  }

  /**
   * Notify about checkpoint creation
   */
  async notifyCheckpointCreated(
    sessionId: string,
    userId: string,
    checkpoint: unknown
  ): Promise<void> {
    await this.broadcastToSession(sessionId, {
      type: 'checkpoint_created',
      sessionId,
      checkpoint,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for a session
   */
  getSessionClients(sessionId: string): string[] {
    const clients: string[] = [];
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId) {
        clients.push(clientId);
      }
    }
    return clients;
  }

  /**
   * Get total clients across all instances (requires Redis)
   */
  async getGlobalClientCount(): Promise<number> {
    if (!isRedisAvailable() || !this.redisPublisher) {
      return this.clients.size;
    }

    // This is an approximation - in production you'd want to use
    // a Redis counter that's incremented/decremented on connect/disconnect
    return this.clients.size;
  }

  /**
   * Gracefully shutdown SSE manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SSE manager...');

    // Disconnect all clients
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, {
        type: 'shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString(),
      });
      await this.removeClient(clientId);
    }

    // Close Redis connections
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.quit();
      } catch (error) {
        logger.warn('Error closing Redis subscriber', { error });
      }
    }

    this.isSubscribed = false;
    logger.info('SSE manager shutdown complete');
  }
}

export const sseManager = new SSEManager();

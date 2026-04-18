import http from 'http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import app from './app.js';

const PORT = env.PORT;

async function bootstrap(): Promise<void> {
  // ── MongoDB ───────────────────────────────────────────────────────────────
  await connectDatabase();

  // ── Redis ─────────────────────────────────────────────────────────────────
  // Make Redis optional in development - server can start without it
  try {
    await connectRedis();
  } catch (err) {
    if (env.NODE_ENV === 'development') {
      logger.warn('Redis not available - continuing without caching/rate-limiting', {
        error: err instanceof Error ? err.message : String(err),
      });
    } else {
      throw err; // In production, Redis is required
    }
  }

  // ── HTTP server ───────────────────────────────────────────────────────────
  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT} [${env.NODE_ENV}]`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const graceful = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully.`);
    server.close(async () => {
      await disconnectDatabase();
      try {
        await disconnectRedis();
      } catch {
        // Redis may not have been connected
      }
      process.exit(0);
    });
    // Force exit after 10 s if connections hang
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => graceful('SIGTERM'));
  process.on('SIGINT', () => graceful('SIGINT'));

  // Unhandled rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — shutting down', { err });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

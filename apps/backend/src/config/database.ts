import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import dns from 'dns';

dns.setServers([
  "8.8.8.8",
  "1.1.1.1"
]);

export async function connectDatabase(): Promise<void> {
  // strict: true ensures that fields not in the schema are silently dropped,
  // preventing accidental persistence of unexpected payload fields.
  mongoose.set('strict', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err: Error) =>
    logger.error('MongoDB connection error', { error: err.message })
  );

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected (graceful shutdown)');
}

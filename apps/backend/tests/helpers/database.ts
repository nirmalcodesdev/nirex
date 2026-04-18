import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

export async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'nirex_test',
    },
    binary: {
      downloadTimeout: 120000, // 2 minutes for download
    },
  });
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
  });
}

export async function disconnectTestDB(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  } catch (error) {
    // Connection might already be closed
    console.log('Note: Database cleanup encountered an issue:', (error as Error).message);
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearCollections(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return; // Not connected
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    try {
      await collections[key].deleteMany({});
    } catch (error) {
      // Collection might not exist
    }
  }
}

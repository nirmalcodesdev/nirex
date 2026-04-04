import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(env.MONGODB_URI);
    console.log(`\n☘️ MongoDB Connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error: ', error);
    process.exit(1);
  }
};

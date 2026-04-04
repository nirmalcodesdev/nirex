import { app } from './app.js';
import { connectDB } from './config/database.js';
import { env } from './config/env.js';
import { APP_NAME } from '@nirex/shared';

const startServer = async () => {
  try {
    await connectDB();
    const port = env.PORT || 8000;
    app.listen(port, () => {
      console.log(`🚀 ${APP_NAME} Server running on port ${port} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

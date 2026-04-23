process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nirex-test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-which-is-long-enough-123456';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-which-is-long-enough-12345';
process.env.API_KEY_SECRET_PEPPER =
  process.env.API_KEY_SECRET_PEPPER || 'test-api-key-pepper-which-is-long-enough-12345';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';
process.env.USE_MESSAGE_COLLECTION = 'true';
process.env.FILE_STORAGE_LOCAL_PATH =
  process.env.FILE_STORAGE_LOCAL_PATH || 'D:/nirex/apps/backend/.test-uploads';

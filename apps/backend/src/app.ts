import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { ApiError } from './utils/ApiError.js';
import { ApiResponse } from './utils/ApiResponse.js';

const app: Express = express();

// Middlewares
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json(new ApiResponse(200, null, 'Server is up and running'));
});

// V1 Routes (To be implemented)
// import v1Router from './routes/v1/index.js';
// app.use('/api/v1', v1Router);

// 404 handler
app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// Global Error Handler
app.use(errorHandler);

export { app };

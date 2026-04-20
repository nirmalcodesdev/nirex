import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Error as MongooseError } from 'mongoose';
import { AppError } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

interface ErrorResponse {
  status: 'error' | 'fail';
  message: string;
  code?: string;
  errors?: Record<string, string>;
  stack?: string;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;
  let errors: Record<string, string> | undefined;

  // Operational errors we created
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }
  // JWT errors - check by name since jsonwebtoken doesn't export classes in ESM
  else if (err instanceof Error && err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Access token has expired';
    code = 'TOKEN_EXPIRED';
  } else if (err instanceof Error && err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid access token';
    code = 'TOKEN_INVALID';
  }
  // Mongoose validation
  else if (err instanceof MongooseError.ValidationError) {
    statusCode = 422;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message]),
    );
  }
  // Mongoose cast / invalid ObjectId
  else if (err instanceof MongooseError.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
    code = 'INVALID_ID';
  }
  // Mongoose duplicate key
  else if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  ) {
    statusCode = 409;
    message = 'A record with that value already exists';
    code = 'DUPLICATE_KEY';
  }

  // Log unexpected errors with full context
  if (statusCode >= 500) {
    logger.error('Unhandled error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      url: req.url,
      userId: req.userId,
      statusCode,
      code,
    });
  } else if (statusCode >= 400 && env.NODE_ENV === 'development') {
    // Log client errors in development for debugging
    logger.debug('Client error', {
      error: err instanceof Error ? err.message : String(err),
      method: req.method,
      url: req.url,
      statusCode,
      code,
    });
  }

  const body: ErrorResponse = {
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    ...(code && { code }),
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && err instanceof Error && { stack: err.stack }),
  };

  res.status(statusCode).json(body);
}

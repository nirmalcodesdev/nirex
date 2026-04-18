import { type Request, type Response, type NextFunction } from 'express';
import { logger, requestContext, runWithContext, logSecurity } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// Request/Response Logging Middleware
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  userAgent?: string;
  ip: string;
  userId?: string;
  durationMs: number;
  statusCode: number;
  contentLength?: number;
  error?: Error;
}

// Paths to exclude from detailed logging (health checks, etc.)
const EXCLUDED_PATHS = ['/health', '/favicon.ico', '/robots.txt'];

// Paths that should never log body content
const SENSITIVE_PATHS = [
  '/api/v1/auth/sign-in',
  '/api/v1/auth/sign-up',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/change-password',
];

/**
 * Generate request ID or use one from incoming headers (for distributed tracing)
 */
function getRequestId(req: Request): string {
  // Check for incoming trace ID from load balancer/proxy
  const incomingId = req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-trace-id'];

  if (incomingId && typeof incomingId === 'string') {
    return incomingId;
  }

  return uuidv4();
}

/**
 * Get client IP address considering proxies
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }

  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp;
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * HTTP Request Logger Middleware
 * Attaches request context and logs all HTTP requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip excluded paths for detailed logging
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  const requestId = getRequestId(req);
  const startTime = process.hrtime.bigint();
  const ip = getClientIp(req);

  // Set up request context for async propagation
  const context = {
    requestId,
    ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
  };

  // Attach requestId to response headers for client debugging
  res.setHeader('X-Request-ID', requestId);

  // Run the rest of the request handling with context
  runWithContext(context, () => {
    // Log request start
    const isSensitive = SENSITIVE_PATHS.some((path) => req.path.includes(path));

    logger.http(`${req.method} ${req.path}`, {
      requestId,
      ip,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      // Only log body for non-sensitive paths in development
      ...(process.env.NODE_ENV === 'development' && !isSensitive && req.body
        ? { body: sanitizeBody(req.body) }
        : {}),
    });

    // Capture response finish
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      const logData: RequestLog = {
        requestId,
        method: req.method,
        path: req.path,
        ip,
        userAgent: req.headers['user-agent'],
        durationMs: Math.round(durationMs * 100) / 100, // Round to 2 decimals
        statusCode: res.statusCode,
        contentLength: res.getHeader('content-length')
          ? parseInt(res.getHeader('content-length') as string, 10)
          : undefined,
      };

      // Add userId if authenticated
      if (req.userId) {
        logData.userId = req.userId;
      }

      // Determine log level based on status code
      const level = res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
          ? 'warn'
          : res.statusCode >= 300
            ? 'debug'
            : 'http';

      // Log slow requests as warnings
      if (durationMs > 1000 && level === 'http') {
        logger.warn(`Slow request: ${req.method} ${req.path} took ${durationMs.toFixed(2)}ms`, {
          ...logData,
          slowRequest: true,
        });
      } else {
        logger.log(level, `${req.method} ${req.path} ${res.statusCode} - ${durationMs.toFixed(2)}ms`, logData);
      }

      // Log security events for specific status codes
      if (res.statusCode === 401) {
        logSecurity({
          type: 'AUTH_FAILURE',
          ip,
          metadata: {
            method: req.method,
            path: req.path,
            requestId,
          },
        });
      } else if (res.statusCode === 403) {
        logSecurity({
          type: 'PERMISSION_DENIED',
          ip,
          userId: req.userId,
          metadata: {
            method: req.method,
            path: req.path,
            requestId,
          },
        });
      } else if (res.statusCode === 429) {
        logSecurity({
          type: 'RATE_LIMIT_HIT',
          ip,
          userId: req.userId,
          metadata: {
            method: req.method,
            path: req.path,
            requestId,
          },
        });
      }
    });

    // Capture errors
    res.on('error', (error: Error) => {
      logger.error('Response error', {
        requestId,
        error: error.message,
        stack: error.stack,
      });
    });

    next();
  });
}

/**
 * Sanitize request body for logging - remove sensitive fields
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  const sanitized = { ...body as Record<string, unknown> };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Performance monitoring middleware
 * Tracks and logs database/query performance
 */
export function performanceMonitor(
  operation: string,
  metadata?: Record<string, unknown>
): <T>(promise: Promise<T>) => Promise<T> {
  return async <T>(promise: Promise<T>): Promise<T> => {
    const startTime = process.hrtime.bigint();
    try {
      const result = await promise;
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      logger.debug(`Performance: ${operation}`, {
        operation,
        durationMs: Math.round(durationMs * 100) / 100,
        success: true,
        ...metadata,
      });

      return result;
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      logger.debug(`Performance: ${operation} (failed)`, {
        operation,
        durationMs: Math.round(durationMs * 100) / 100,
        success: false,
        error: (error as Error).message,
        ...metadata,
      });

      throw error;
    }
  };
}

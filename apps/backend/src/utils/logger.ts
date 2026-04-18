import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env.js';
import { AsyncLocalStorage } from 'async_hooks';

// ═══════════════════════════════════════════════════════════════════════════════
// Async Local Storage for request context propagation
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ═══════════════════════════════════════════════════════════════════════════════
// Sensitive Data Redaction
// ═══════════════════════════════════════════════════════════════════════════════

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmPassword',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'hash',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'apiKey',
  'api_key',
  'creditCard',
  'ssn',
  'socialSecurity',
]);

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /credential/i,
  /session/i,
];

function redactSensitive(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[Circular]';

  if (typeof value === 'object' && value !== null) {
    seen.add(value as object);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1, seen));
  }

  const sanitised: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = SENSITIVE_KEYS.has(lowerKey) ||
      SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

    if (shouldRedact && typeof val === 'string') {
      sanitised[key] = val.length > 8
        ? `${val.slice(0, 4)}...${val.slice(-4)}`
        : '[REDACTED]';
    } else {
      sanitised[key] = redactSensitive(val, depth + 1, seen);
    }
  }
  return sanitised;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Log Levels Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  debug: 5,
  trace: 6,
};

const COLORS: Record<string, string> = {
  fatal: '\x1b[35m',    // magenta
  error: '\x1b[31m',    // red
  warn: '\x1b[33m',     // yellow
  info: '\x1b[32m',     // green
  http: '\x1b[36m',     // cyan
  debug: '\x1b[34m',    // blue
  trace: '\x1b[90m',    // gray
  reset: '\x1b[0m',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════════

const addContextFormat = winston.format((info) => {
  const context = requestContext.getStore();
  if (context) {
    info.requestId = context.requestId;
    if (context.userId) info.userId = context.userId;
    if (context.sessionId) info.sessionId = context.sessionId;
  }
  return info;
});

const redactFormat = winston.format((info) => {
  const { message, level, timestamp, stack, ...rest } = info;
  const redacted = redactSensitive(rest);

  return {
    level,
    message,
    timestamp,
    service: 'nirex-backend',
    environment: env.NODE_ENV,
    ...(stack ? { stack } : {}),
    ...(redacted && typeof redacted === 'object' && Object.keys(redacted).length > 0
      ? redacted as Record<string, unknown>
      : {}),
  };
});

const devFormat = winston.format.printf((info) => {
  const { timestamp, level, message, requestId, userId, ...meta } = info;
  const color = COLORS[level as string] || COLORS.reset;
  const reset = COLORS.reset;

  const contextStr = requestId && typeof requestId === 'string'
    ? ` [${requestId.slice(0, 8)}${userId && typeof userId === 'string' ? `|u:${userId.slice(0, 6)}` : ''}]`
    : '';

  const metaStr = Object.keys(meta).length > 0
    ? ' ' + JSON.stringify(meta, null, 0).replace(/[{}"]/g, '').replace(/:/g, '=').slice(0, 200)
    : '';

  return `${timestamp as string}  ${color}${level.padEnd(5)}${reset}${contextStr}  ${message as string}${metaStr}`;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Transports Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console transport for all environments
  transports.push(
    new winston.transports.Console({
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    })
  );

  // File rotation for production and development
  if (env.NODE_ENV !== 'test') {
    // Combined logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
      })
    );

    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
      })
    );

    // HTTP access logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/http-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '7d',
        level: 'http',
      })
    );
  }

  return transports;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Logger Instance
// ═══════════════════════════════════════════════════════════════════════════════

const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

export const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: isProd ? 'info' : isTest ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    addContextFormat(),
    redactFormat(),
    isProd
      ? winston.format.json()
      : isTest
        ? winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp as string}  ${level}  ${message as string}`
          )
        : devFormat
  ),
  transports: createTransports(),
  ...(isTest ? {} : {
    exceptionHandlers: [new winston.transports.Console()],
    rejectionHandlers: [new winston.transports.Console()],
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Child Logger Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Logger - Separate stream for compliance/security auditing
// ═══════════════════════════════════════════════════════════════════════════════

const auditTransport = isProd
  ? new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '90d', // Keep audit logs for 90 days
    })
  : new winston.transports.Console({
      format: winston.format.combine(
        winston.format.printf(({ timestamp, message, ...meta }) => {
          return `[AUDIT] ${timestamp as string}  ${message as string}  ${JSON.stringify(meta)}`;
        })
      ),
    });

export const auditLogger = winston.createLogger({
  levels: { audit: 0 },
  level: 'audit',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    addContextFormat(),
    winston.format.json()
  ),
  transports: [auditTransport],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Logger
// ═══════════════════════════════════════════════════════════════════════════════

interface PerformanceMetrics {
  operation: string;
  durationMs: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export function logPerformance(metrics: PerformanceMetrics): void {
  const level = metrics.durationMs > 1000 ? 'warn' : 'debug';
  logger.log(level, `Performance: ${metrics.operation}`, {
    durationMs: metrics.durationMs,
    success: metrics.success,
    ...metrics.metadata,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Event Logger
// ═══════════════════════════════════════════════════════════════════════════════

type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTH_SUCCESS'
  | 'TOKEN_REUSE'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_HIT';

interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export function logSecurity(event: SecurityEvent): void {
  auditLogger.log('audit', `Security: ${event.type}`, {
    eventType: event.type,
    userId: event.userId,
    ip: event.ip,
    ...event.metadata,
  });

  // Also log high severity events to main logger
  if (['TOKEN_REUSE', 'BRUTE_FORCE_ATTEMPT', 'SUSPICIOUS_ACTIVITY'].includes(event.type)) {
    logger.warn(`Security alert: ${event.type}`, {
      userId: event.userId,
      ip: event.ip,
      ...event.metadata,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Event Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export const audit = {
  signin: (userId: string, ip: string, success: boolean, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', success ? 'User sign-in successful' : 'User sign-in failed', {
      event: 'SIGNIN',
      userId,
      ip,
      success,
      ...metadata,
    });
  },

  signout: (userId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'User sign-out', {
      event: 'SIGNOUT',
      userId,
      ip,
      ...metadata,
    });
  },

  passwordChange: (userId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Password changed', {
      event: 'PASSWORD_CHANGE',
      userId,
      ip,
      ...metadata,
    });
  },

  passwordReset: (userId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Password reset', {
      event: 'PASSWORD_RESET',
      userId,
      ip,
      ...metadata,
    });
  },

  sessionRevoked: (userId: string, sessionId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Session revoked', {
      event: 'SESSION_REVOKE',
      userId,
      sessionId,
      ip,
      ...metadata,
    });
  },

  emailVerified: (userId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Email verified', {
      event: 'EMAIL_VERIFIED',
      userId,
      ip,
      ...metadata,
    });
  },

  dataAccess: (userId: string, resource: string, action: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Data access', {
      event: 'DATA_ACCESS',
      userId,
      resource,
      action,
      ...metadata,
    });
  },

  profileUpdate: (userId: string, ip: string, metadata?: Record<string, unknown>) => {
    auditLogger.log('audit', 'Profile updated', {
      event: 'PROFILE_UPDATE',
      userId,
      ip,
      ...metadata,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Request Context Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

export function getCurrentContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function setContextUser(userId: string, sessionId?: string): void {
  const context = requestContext.getStore();
  if (context) {
    context.userId = userId;
    if (sessionId) context.sessionId = sessionId;
  }
}

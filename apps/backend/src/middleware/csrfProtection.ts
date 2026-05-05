import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../types/index.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, readCookie } from '../modules/auth/auth.cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins(): Set<string> {
  const origins = new Set<string>(env.CORS_ORIGINS);
  origins.add(new URL(env.APP_URL).origin);
  return origins;
}

function hasAuthCookie(req: Request): boolean {
  return Boolean(
    readCookie(req, ACCESS_TOKEN_COOKIE) ||
    readCookie(req, REFRESH_TOKEN_COOKIE),
  );
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || !hasAuthCookie(req)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const candidate = origin ?? referer;

  if (!candidate) {
    next(new AppError('Origin header is required for cookie-authenticated requests', 403, 'CSRF_ORIGIN_REQUIRED'));
    return;
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(candidate).origin;
  } catch {
    next(new AppError('Invalid request origin', 403, 'CSRF_ORIGIN_INVALID'));
    return;
  }

  if (!allowedOrigins().has(requestOrigin)) {
    next(new AppError('Request origin is not allowed', 403, 'CSRF_ORIGIN_DENIED'));
    return;
  }

  next();
}

import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import type { TokenPair } from '../../types/index.js';

export const ACCESS_TOKEN_COOKIE = 'nirex_access';
export const REFRESH_TOKEN_COOKIE = 'nirex_refresh';
const REMEMBER_SESSION_COOKIE = 'nirex_remember';

const isProduction = env.NODE_ENV === 'production';

function cookieDomain(): string | undefined {
  const domain = env.COOKIE_DOMAIN?.trim();
  return domain ? domain : undefined;
}

function baseCookieOptions(maxAgeMs?: number) {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    ...(cookieDomain() && { domain: cookieDomain() }),
  };

  return maxAgeMs === undefined ? options : { ...options, maxAge: maxAgeMs };
}

export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
  options: { rememberMe?: boolean } = {},
): void {
  const refreshMaxAgeMs = env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    baseCookieOptions(env.JWT_ACCESS_TTL_SECONDS * 1000),
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    baseCookieOptions(options.rememberMe ? refreshMaxAgeMs : undefined),
  );
  res.cookie(
    REMEMBER_SESSION_COOKIE,
    options.rememberMe ? '1' : '0',
    baseCookieOptions(options.rememberMe ? refreshMaxAgeMs : undefined),
  );
}

export function clearAuthCookies(res: Response): void {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    ...(cookieDomain() && { domain: cookieDomain() }),
  };

  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
  res.clearCookie(REMEMBER_SESSION_COOKIE, options);
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  const cookies = header.split(';');
  let matchedValue: string | null = null;

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = cookie.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const rawValue = cookie.slice(separatorIndex + 1);
    try {
      matchedValue = decodeURIComponent(rawValue);
    } catch {
      matchedValue = rawValue;
    }
  }

  return matchedValue;
}

export function readAccessTokenCookie(req: Request): string | null {
  return readCookie(req, ACCESS_TOKEN_COOKIE);
}

export function readRefreshTokenCookie(req: Request): string | null {
  return readCookie(req, REFRESH_TOKEN_COOKIE);
}

export function readRememberSessionCookie(req: Request): boolean {
  return readCookie(req, REMEMBER_SESSION_COOKIE) === '1';
}

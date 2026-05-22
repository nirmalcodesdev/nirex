import type { Request } from 'express';

/**
 * Extract the originating IP address for an HTTP request. Honors
 * `x-forwarded-for` (first hop only, to avoid trusting downstream
 * client-supplied values) and normalizes IPv6 localhost to IPv4 for
 * readability in audit logs and emails.
 */
export function getRequestIp(req: Request): string {
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return ip;
}

export function getRequestDeviceInfo(req: Request): string {
  return (req.headers['user-agent'] as string | undefined) ?? 'unknown';
}

export interface RequestContext {
  ipAddress: string;
  deviceInfo: string;
}

export function getRequestContext(req: Request): RequestContext {
  return {
    ipAddress: getRequestIp(req),
    deviceInfo: getRequestDeviceInfo(req),
  };
}

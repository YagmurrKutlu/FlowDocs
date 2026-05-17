import type { Request } from 'express';

export interface ParsedClientInfo {
  browser: string;
  os: string;
  deviceLabel: string;
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (request.ip) return request.ip;
  return request.socket?.remoteAddress ?? null;
}

export function parseUserAgent(userAgent: string | undefined): ParsedClientInfo {
  const raw = userAgent?.trim() ?? '';

  let browser = 'Unknown Browser';
  if (/Edg\//i.test(raw)) browser = 'Edge';
  else if (/Chrome\//i.test(raw) && !/Edg/i.test(raw)) browser = 'Chrome';
  else if (/Firefox\//i.test(raw)) browser = 'Firefox';
  else if (/Safari\//i.test(raw) && !/Chrome/i.test(raw)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/Windows/i.test(raw)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(raw)) os = 'macOS';
  else if (/Android/i.test(raw)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(raw)) os = 'iOS';
  else if (/Linux/i.test(raw)) os = 'Linux';

  return {
    browser,
    os,
    deviceLabel: `${os} · ${browser}`,
  };
}

export function maskIpAddress(ip: string | null | undefined): string {
  if (!ip) return '—';

  const normalized = ip.replace(/^::ffff:/i, '').trim();
  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost'
  ) {
    return 'Localhost';
  }

  const ipv4Parts = normalized.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part))) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.x.x`;
  }

  return 'IPv6';
}

export const UNKNOWN_LOCATION_LABEL = 'Konum bilinmiyor';

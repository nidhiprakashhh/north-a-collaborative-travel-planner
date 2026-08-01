import { CookieOptions } from 'express';
import { env } from '../config/env';

export const AUTH_COOKIE_NAME = 'north_token';

// Mirrors JWT_EXPIRES_IN (currently always "7d" in practice) — kept as a
// plain constant rather than parsed from the env string since the cookie's
// lifetime is only a UX nicety (the JWT itself is still verified server-side
// on every request regardless of how long the cookie sticks around).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Plain HTTP in local dev (no TLS to require), always HTTPS in prod.
    secure: env.nodeEnv === 'production',
    // 'lax' rather than 'none': frontend and API are same-site in both dev
    // (localhost:5173 / localhost:4000 — different ports, but SameSite cares
    // about registrable domain, not port) and prod (same origin via nginx),
    // so 'lax' covers both without requiring Secure-over-HTTP in dev.
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  };
}

// Socket.io's handshake only exposes the raw `Cookie` header, not parsed
// cookies (that's an Express-only convenience from the cookie-parser
// middleware) — this pulls out just the one name this app cares about
// rather than pulling in a full parsing library for a single key=value scan.
export function readCookieValue(rawCookieHeader: string | undefined, name: string): string | undefined {
  if (!rawCookieHeader) return undefined;
  for (const part of rawCookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    if (part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

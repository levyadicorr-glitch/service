import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// SESSION_SECRET signs admin session cookies. Falls back to a key derived from
// MONGODB_URI (secret, always present) so existing deployments keep working
// until the dedicated env var is configured.
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  const uri = process.env.MONGODB_URI || 'fallback-sherut-session-secret-key-2026';
  return createHash('sha256').update(`session-secret:${uri}`).digest('hex');
}

// ---------------- Password hashing (scrypt, no external deps) ----------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith('scrypt$');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Supports both hashed values and legacy plaintext passwords still in the DB
// (callers should re-hash on successful legacy match).
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (isHashedPassword(stored)) {
    const [, salt, expected] = stored.split('$');
    if (!salt || !expected) return false;
    const actual = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
    return safeEqual(actual, expected);
  }
  return safeEqual(password, stored);
}

// ---------------- Admin session tokens (HMAC-signed) ----------------

interface SessionPayload {
  tenantId: string;
  exp: number; // unix seconds
}

function sign(data: string): string {
  return createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
}

export function createSessionToken(tenantId: string): string {
  const payload: SessionPayload = {
    tenantId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  if (!safeEqual(sign(data), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    if (typeof payload.tenantId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

// ---------------- Route guards ----------------

// Returns a 401 response if the request has no valid admin session for this
// tenant; returns null when access is allowed.
export function requireTenantAdmin(req: NextRequest, tenantId: string): NextResponse | null {
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }
  return null;
}

export function requireSupAdmin(req: NextRequest): NextResponse | null {
  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    console.error('SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD is not configured; refusing super-admin access');
    return NextResponse.json({ error: 'שגיאת תצורה בשרת' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }
  // Token format is "email:password" — the email itself can't contain a colon.
  const token = authHeader.slice('Bearer '.length);
  const separatorIndex = token.indexOf(':');
  if (separatorIndex === -1) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }
  const email = token.slice(0, separatorIndex);
  const password = token.slice(separatorIndex + 1);
  if (!safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }
  return null;
}

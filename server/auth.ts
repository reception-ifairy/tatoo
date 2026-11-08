import crypto from 'crypto';
import type { Request, Response, NextFunction, Router } from 'express';
import express from 'express';
import { APP } from '../src/config';
import type { PublicUser } from '../src/account';
import { ADMIN_ID, verifyPassword, type UserService } from './users';

// Login for the super admin (credentials from .env: OWNER_LOGIN, OWNER_PASSWORD) and the clients the admin
// creates. The session is a stateless HMAC-signed, httpOnly cookie carrying the user id and, for clients, the
// password version — changing a password or deactivating a client signs out their sessions.

const COOKIE_NAME = `${APP.id}_session`;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const IS_PROD = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) console.warn('[Auth] SESSION_SECRET is not set — sessions end when the server restarts.');
if (!OWNER_PASSWORD) console.warn('[Auth] OWNER_PASSWORD is not set — the super admin cannot log in.');

interface SessionPayload {
  sub: string;
  v: number;
  exp: number;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function createToken(sub: string, v: number): string {
  const payload: SessionPayload = { sub, v, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

function readToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig || !safeEqual(sig, sign(data))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: IS_PROD, path: '/' };

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

function isLocked(ip: string): number {
  const entry = failedAttempts.get(ip);
  if (!entry) return 0;
  if (entry.lockedUntil > Date.now()) return entry.lockedUntil - Date.now();
  if (entry.lockedUntil) failedAttempts.delete(ip);
  return 0;
}

function registerFailure(ip: string) {
  const entry = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  failedAttempts.set(ip, entry);
}

/** The signed-in user of this request (set by requireUser). */
export function currentUser(res: Response): PublicUser {
  return res.locals.user as PublicUser;
}

export function isAdmin(res: Response): boolean {
  return currentUser(res)?.role === 'admin';
}

async function sessionUser(req: Request, users: UserService): Promise<PublicUser | null> {
  const session = readToken(readCookie(req, COOKIE_NAME));
  if (!session) return null;
  if (session.sub === ADMIN_ID) return OWNER_PASSWORD ? users.publicAdmin() : null;
  const client = await users.getClient(session.sub);
  if (!client || !client.active || client.version !== session.v) return null;
  return users.toPublic(client);
}

export function requireUser(users: UserService) {
  return (req: Request, res: Response, next: NextFunction) => {
    sessionUser(req, users).then(
      (user) => {
        if (!user) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
        res.locals.user = user;
        next();
      },
      (err) => {
        console.error('Session check failed:', err);
        res.status(500).json({ error: 'Server error.' });
      },
    );
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isAdmin(res)) return next();
  res.status(403).json({ error: 'Only the studio admin can do this.' });
}

export function createAuthRouter(users: UserService): Router {
  const router = express.Router();

  router.get('/me', async (req, res) => {
    const user = await sessionUser(req, users).catch(() => null);
    if (!user) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, user });
  });

  router.post('/login', async (req, res) => {
    const ip = req.ip || 'unknown';
    const lockedFor = isLocked(ip);
    if (lockedFor) {
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil(lockedFor / 60000)} min.` });
    }
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    try {
      if (OWNER_PASSWORD && safeEqual(login, users.adminLogin())) {
        if (safeEqual(password, OWNER_PASSWORD)) {
          failedAttempts.delete(ip);
          res.cookie(COOKIE_NAME, createToken(ADMIN_ID, 0), { ...cookieOptions, maxAge: SESSION_TTL_MS });
          return res.json({ authenticated: true, user: await users.publicAdmin() });
        }
      } else {
        const client = await users.findLogin(login);
        if (client && client.active && (await verifyPassword(password, client.passwordHash))) {
          failedAttempts.delete(ip);
          res.cookie(COOKIE_NAME, createToken(client.id, client.version), { ...cookieOptions, maxAge: SESSION_TTL_MS });
          return res.json({ authenticated: true, user: await users.toPublic(client) });
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      return res.status(500).json({ error: 'Server error.' });
    }
    registerFailure(ip);
    res.status(401).json({ error: 'Wrong login or password.' });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ authenticated: false });
  });

  return router;
}

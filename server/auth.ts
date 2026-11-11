import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db, type PuzzleProgress, type UserRecord } from './db';

const COOKIE = 'gm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const isProd = process.env.NODE_ENV === 'production';

const google = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

// Sign in with Apple: Services ID (e.g. com.example.chess.web) and the HTTPS return URL registered for it.
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || '';
const appleEnabled = !!(APPLE_CLIENT_ID && APPLE_REDIRECT_URI);
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const APPLE_NONCE_COOKIE = 'gm_apple_nonce';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* malformed cookie */
    }
  }
  return out;
}

/** Resolve the signed-in user from a request's session cookie (works for HTTP and WebSocket upgrades). */
export function userFromRequest(req: IncomingMessage): UserRecord | null {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const session = db.session(sha256(token));
  return (session && db.user(session.userId)) || null;
}

export function publicUser(u: UserRecord) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    picture: u.picture,
    rating: Math.round(u.rating),
    record: u.record,
    hasGoogle: !!u.googleSub,
    hasApple: !!u.appleSub,
    hasPassword: !!u.passwordHash,
  };
}

// ---- Passwords (scrypt, no extra dependencies) ----

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A real hash to compare against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanName = (raw: unknown) => String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24);

// Brute-force protection: limit failed logins per IP and per email.
const failures = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
function tooManyFailures(...keys: string[]): boolean {
  const now = Date.now();
  return keys.some((k) => (failures.get(k) ?? []).filter((t) => now - t < WINDOW_MS).length >= MAX_FAILURES);
}
function noteFailure(...keys: string[]) {
  const now = Date.now();
  for (const k of keys) failures.set(k, [...(failures.get(k) ?? []).filter((t) => now - t < WINDOW_MS), now]);
  if (failures.size > 50_000) failures.clear();
}

function startSession(res: Response, user: UserRecord) {
  const token = randomBytes(32).toString('base64url');
  db.createSession(sha256(token), user.id, SESSION_TTL_MS);
  setSessionCookie(res, token);
}

function setSessionCookie(res: Response, token: string | null) {
  res.cookie(COOKIE, token ?? '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: token ? SESSION_TTL_MS : 0,
  });
}

/**
 * CSRF guard for state-changing requests. The session cookie is SameSite=Lax, and we
 * additionally reject cross-origin requests based on the Origin header.
 */
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' });
    } catch {
      return res.status(403).json({ error: 'Bad origin' });
    }
  }
  next();
}

function requireUser(req: Request, res: Response): UserRecord | null {
  const user = userFromRequest(req);
  if (!user) res.status(401).json({ error: 'Not signed in' });
  return user;
}

// ---- Progress validation & merge ----

function cleanPuzzle(raw: unknown): PuzzleProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min);
  return {
    rating: num(p.rating, 100, 3500),
    solved: num(p.solved, 0, 1e7),
    failed: num(p.failed, 0, 1e7),
    bestStreak: num(p.bestStreak, 0, 1e5),
    recent: Array.isArray(p.recent) ? p.recent.filter((x): x is string => typeof x === 'string' && x.length <= 12).slice(0, 500) : [],
    updatedAt: num(p.updatedAt, 0, Date.now() + 60_000),
  };
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MODES = new Set(['bot', 'local', 'online']);
const REASONS = new Set(['checkmate', 'stalemate', 'repetition', 'fifty-move', 'insufficient', 'resign', 'timeout', 'agreement', 'abandon']);

/** Strict shape check: anything stored here is rendered by other devices, so reject malformed entries. */
function isArchivedGame(g: unknown): boolean {
  if (!g || typeof g !== 'object') return false;
  const x = g as Record<string, any>;
  return (
    typeof x.id === 'string' && x.id.length <= 80 &&
    MODES.has(x.mode) &&
    typeof x.startFen === 'string' && x.startFen.length <= 100 &&
    Array.isArray(x.moves) && x.moves.length <= 800 && x.moves.every((m: unknown) => typeof m === 'string' && UCI_RE.test(m)) &&
    typeof x.endedAt === 'number' &&
    x.result && typeof x.result === 'object' && (x.result.winner === 'w' || x.result.winner === 'b' || x.result.winner === null) && REASONS.has(x.result.reason) &&
    x.meta && typeof x.meta === 'object' && typeof x.meta.white === 'string' && typeof x.meta.black === 'string' &&
    x.meta.white.length <= 60 && x.meta.black.length <= 60 &&
    x.meta.tc && Number.isFinite(x.meta.tc.initial) && Number.isFinite(x.meta.tc.increment)
  );
}

function cleanArchive(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw.filter(isArchivedGame).slice(0, 50) : [];
}

function mergePuzzle(a: PuzzleProgress | null, b: PuzzleProgress | null): PuzzleProgress | null {
  if (!a) return b;
  if (!b) return a;
  // Keep whichever record reflects more play; tie-break on recency.
  const pa = a.solved + a.failed;
  const pb = b.solved + b.failed;
  const base = pa !== pb ? (pa > pb ? a : b) : a.updatedAt >= b.updatedAt ? a : b;
  return { ...base, bestStreak: Math.max(a.bestStreak, b.bestStreak), recent: [...new Set([...base.recent, ...a.recent, ...b.recent])].slice(0, 500) };
}

function mergeArchive(a: unknown[], b: unknown[]): unknown[] {
  const byId = new Map<string, { id: string; endedAt: number }>();
  for (const g of [...a, ...b] as { id: string; endedAt: number }[]) if (!byId.has(g.id)) byId.set(g.id, g);
  return [...byId.values()].sort((x, y) => y.endedAt - x.endedAt).slice(0, 50);
}

export function authRouter() {
  const r = Router();
  r.use(sameOrigin);

  r.get('/auth/config', (_req, res) =>
    res.json({
      googleClientId: CLIENT_ID || null,
      apple: appleEnabled ? { clientId: APPLE_CLIENT_ID, redirectURI: APPLE_REDIRECT_URI } : null,
    }),
  );

  // One-time nonce for Sign in with Apple, bound to this browser by an httpOnly cookie (prevents token replay).
  r.post('/auth/apple/nonce', (_req, res) => {
    if (!appleEnabled) return res.status(503).json({ error: 'Sign in with Apple is not configured on this server.' });
    const nonce = randomBytes(16).toString('base64url');
    res.cookie(APPLE_NONCE_COOKIE, nonce, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/api/auth/apple', maxAge: 10 * 60 * 1000 });
    res.json({ nonce });
  });

  r.post('/auth/apple', async (req, res) => {
    if (!appleEnabled) return res.status(503).json({ error: 'Sign in with Apple is not configured on this server.' });
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    const expectedNonce = parseCookies(req.headers.cookie)[APPLE_NONCE_COOKIE];
    res.clearCookie(APPLE_NONCE_COOKIE, { path: '/api/auth/apple' });
    if (!idToken || idToken.length > 8192 || !expectedNonce) return res.status(400).json({ error: 'Sign in with Apple failed. Please try again.' });
    try {
      const { payload } = await jwtVerify(idToken, appleKeys, { issuer: 'https://appleid.apple.com', audience: APPLE_CLIENT_ID });
      if (payload.nonce !== expectedNonce || typeof payload.sub !== 'string') throw new Error('nonce mismatch');
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

      // Apple only sends the user's name (from the browser, not the token) the very first time.
      const given = req.body?.name && typeof req.body.name === 'object' ? req.body.name : {};
      const fullName = cleanName([given.firstName, given.lastName].filter((x) => typeof x === 'string').join(' '));

      const now = Date.now();
      const existing = db.userByAppleSub(payload.sub) ?? (email && emailVerified ? db.userByEmail(email) : undefined);
      const user: UserRecord = existing
        ? { ...existing, appleSub: payload.sub, lastLoginAt: now }
        : db.newUser({
            id: randomUUID(),
            appleSub: payload.sub,
            email,
            name: fullName || (email && !email.endsWith('privaterelay.appleid.com') ? cleanName(email.split('@')[0]) : '') || 'Player',
            createdAt: now,
            lastLoginAt: now,
          });
      db.saveUser(user);
      startSession(res, user);
      res.json({ user: publicUser(user) });
    } catch (err) {
      console.warn('[auth] Apple token verification failed:', (err as Error).message);
      res.status(401).json({ error: 'Sign in with Apple failed. Please try again.' });
    }
  });

  r.post('/auth/google', async (req, res) => {
    if (!google) return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential || credential.length > 4096) return res.status(400).json({ error: 'Missing credential' });
    try {
      const ticket = await google.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.email_verified) return res.status(401).json({ error: 'Google account email is not verified' });

      const now = Date.now();
      // Google has verified this email, so it is safe to link it to an existing email/password account.
      const existing = db.userBySub(p.sub) ?? db.userByEmail(p.email);
      const user: UserRecord = existing
        ? { ...existing, googleSub: p.sub, name: existing.name || cleanName(p.name), picture: p.picture ?? existing.picture, lastLoginAt: now }
        : db.newUser({ id: randomUUID(), googleSub: p.sub, email: p.email.toLowerCase(), name: cleanName(p.name) || p.email.split('@')[0], picture: p.picture ?? null, createdAt: now, lastLoginAt: now });
      db.saveUser(user);
      startSession(res, user);
      res.json({ user: publicUser(user) });
    } catch (err) {
      console.warn('[auth] token verification failed:', (err as Error).message);
      res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
    }
  });

  r.post('/auth/signup', async (req, res) => {
    const name = cleanName(req.body?.name);
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (name.length < 2) return res.status(400).json({ error: 'Choose a name with at least 2 characters.' });
    if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
    if (db.userByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });

    const now = Date.now();
    const user = db.newUser({ id: randomUUID(), email, name, passwordHash: await hashPassword(password), createdAt: now, lastLoginAt: now });
    db.saveUser(user);
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  r.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password ?? '').slice(0, 200);
    const ipKey = `ip:${req.ip}`;
    const emailKey = `em:${email}`;
    if (tooManyFailures(ipKey, emailKey)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

    const user = db.userByEmail(email);
    const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await DUMMY_HASH), false);
    if (!user || !ok) {
      noteFailure(ipKey, emailKey);
      const hint = user && !user.passwordHash ? ' This account uses Google sign-in.' : '';
      return res.status(401).json({ error: `Incorrect email or password.${hint}` });
    }
    const updated = { ...user, lastLoginAt: Date.now() };
    db.saveUser(updated);
    startSession(res, updated);
    res.json({ user: publicUser(updated) });
  });

  r.get('/auth/me', (req, res) => {
    const user = userFromRequest(req);
    res.json({ user: user ? publicUser(user) : null });
  });

  r.post('/auth/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.deleteSession(sha256(token));
    setSessionCookie(res, null);
    res.json({ ok: true });
  });

  // Progress sync: client sends what it has, server merges and returns the result.
  r.post('/me/progress', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const puzzle = mergePuzzle(user.puzzle, cleanPuzzle(req.body?.puzzle));
    // First sync after sign-in merges both sides; later syncs make this device's list authoritative
    // (so deleting a game on one device sticks).
    const incoming = cleanArchive(req.body?.archive);
    const archive = req.body?.replaceArchive === true ? incoming : mergeArchive(incoming, cleanArchive(user.archive));
    db.saveUser({ ...user, puzzle, archive });
    res.json({ puzzle, archive });
  });

  return r;
}

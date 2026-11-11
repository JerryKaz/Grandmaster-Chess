import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db, type PuzzleProgress, type UserRecord } from './db';

const COOKIE = 'gm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const isProd = process.env.NODE_ENV === 'production';

const google = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

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

function publicUser(u: UserRecord) {
  return { id: u.id, name: u.name, email: u.email, picture: u.picture };
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

  r.get('/auth/config', (_req, res) => res.json({ googleClientId: CLIENT_ID || null }));

  r.post('/auth/google', async (req, res) => {
    if (!google) return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential || credential.length > 4096) return res.status(400).json({ error: 'Missing credential' });
    try {
      const ticket = await google.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.email_verified) return res.status(401).json({ error: 'Google account email is not verified' });

      const now = Date.now();
      const existing = db.userBySub(p.sub);
      const user: UserRecord = existing
        ? { ...existing, email: p.email, name: p.name || existing.name, picture: p.picture ?? existing.picture, lastLoginAt: now }
        : { id: randomUUID(), googleSub: p.sub, email: p.email, name: p.name || p.email.split('@')[0], picture: p.picture ?? null, createdAt: now, lastLoginAt: now, puzzle: null, archive: [] };
      db.saveUser(user);

      const token = randomBytes(32).toString('base64url');
      db.createSession(sha256(token), user.id, SESSION_TTL_MS);
      setSessionCookie(res, token);
      res.json({ user: publicUser(user) });
    } catch (err) {
      console.warn('[auth] token verification failed:', (err as Error).message);
      res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
    }
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

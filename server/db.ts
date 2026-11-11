/**
 * Minimal persistent store: one JSON file, written atomically (tmp + rename) and debounced.
 * Fine for a hobby/small deployment. The interface is deliberately tiny so it can be
 * swapped for Postgres/MongoDB without touching the route handlers.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface PuzzleProgress {
  rating: number;
  solved: number;
  failed: number;
  bestStreak: number;
  recent: string[]; // recently seen puzzle ids (avoid repeats)
  updatedAt: number;
}

export interface UserRecord {
  id: string;
  /** Google account id, when the user signed in with Google (or linked it). */
  googleSub: string | null;
  /** Apple account id, when the user signed in with Apple (or linked it). */
  appleSub: string | null;
  /** scrypt hash, when the user created an email + password account. */
  passwordHash: string | null;
  email: string;
  name: string;
  picture: string | null;
  createdAt: number;
  lastLoginAt: number;
  /** Online rating (rated games only) and results. */
  rating: number;
  record: { w: number; l: number; d: number };
  puzzle: PuzzleProgress | null;
  /** Finished games (same shape as the client archive), newest first, max 50. */
  archive: unknown[];
}

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

interface Data {
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>; // keyed by sha256(token)
}

export const START_RATING = 1500;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

/** Fill in fields added after a record was first written. */
function normalize(u: Partial<UserRecord> & { id: string }): UserRecord {
  return {
    googleSub: null,
    appleSub: null,
    passwordHash: null,
    email: '',
    name: 'Player',
    picture: null,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    rating: START_RATING,
    record: { w: 0, l: 0, d: 0 },
    puzzle: null,
    archive: [],
    ...u,
  };
}

let data: Data = { users: {}, sessions: {} };
try {
  if (existsSync(FILE)) {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    data = { users: {}, sessions: raw.sessions ?? {} };
    for (const [id, u] of Object.entries(raw.users ?? {})) data.users[id] = normalize(u as UserRecord);
  }
} catch (err) {
  console.error('[db] could not read store, starting empty:', err);
}

let flushTimer: NodeJS.Timeout | null = null;
function persist() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${FILE}.tmp`;
      writeFileSync(tmp, JSON.stringify(data));
      renameSync(tmp, FILE);
    } catch (err) {
      console.error('[db] write failed:', err);
    }
  }, 200);
}

export const db = {
  newUser(fields: Partial<UserRecord> & { id: string }): UserRecord {
    return normalize(fields);
  },
  userBySub(sub: string): UserRecord | undefined {
    return Object.values(data.users).find((u) => u.googleSub === sub);
  },
  userByAppleSub(sub: string): UserRecord | undefined {
    return Object.values(data.users).find((u) => u.appleSub === sub);
  },
  userByEmail(email: string): UserRecord | undefined {
    const e = email.toLowerCase();
    return Object.values(data.users).find((u) => u.email.toLowerCase() === e);
  },
  user(id: string): UserRecord | undefined {
    return data.users[id];
  },
  saveUser(user: UserRecord) {
    data.users[user.id] = user;
    persist();
  },
  createSession(hash: string, userId: string, ttlMs: number) {
    data.sessions[hash] = { userId, expiresAt: Date.now() + ttlMs };
    persist();
  },
  session(hash: string): SessionRecord | undefined {
    const s = data.sessions[hash];
    if (s && s.expiresAt < Date.now()) {
      delete data.sessions[hash];
      persist();
      return undefined;
    }
    return s;
  },
  deleteSession(hash: string) {
    delete data.sessions[hash];
    persist();
  },
};

// Purge expired sessions hourly.
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [k, s] of Object.entries(data.sessions)) {
    if (s.expiresAt < now) {
      delete data.sessions[k];
      changed = true;
    }
  }
  if (changed) persist();
}, 60 * 60 * 1000).unref();

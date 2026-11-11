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
  googleSub: string;
  email: string;
  name: string;
  picture: string | null;
  createdAt: number;
  lastLoginAt: number;
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

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

let data: Data = { users: {}, sessions: {} };
try {
  if (existsSync(FILE)) data = { users: {}, sessions: {}, ...JSON.parse(readFileSync(FILE, 'utf8')) };
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
  userBySub(sub: string): UserRecord | undefined {
    return Object.values(data.users).find((u) => u.googleSub === sub);
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

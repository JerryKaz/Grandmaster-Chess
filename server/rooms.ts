import { randomInt } from 'node:crypto';
import { Chess } from 'chess.js';
import type { WebSocket } from 'ws';
import {
  MAX_NAME_LENGTH,
  ROOM_CODE_RE,
  type ClientMessage,
  type GameResult,
  type RoomSnapshot,
  type ServerMessage,
  type Side,
  type TimeControl,
} from '../shared/protocol';
import { parseUci, positionResult, timeoutResult } from '../shared/rules';
import { db } from './db';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const ABANDON_AFTER_MS = 90 * 1000;
const MAX_ROOMS = 5000;

interface Seat {
  playerId: string;
  name: string;
  verified: boolean;
  accountId: string | null;
  sockets: Set<WebSocket>;
  abandonTimer: NodeJS.Timeout | null;
}

interface Room {
  id: string;
  tc: TimeControl;
  seats: Record<Side, Seat | null>;
  chess: Chess;
  moves: string[];
  clock: { w: number; b: number } | null;
  turnStartedAt: number | null;
  result: GameResult | null;
  drawOffer: Side | null;
  rematchOffer: Side | null;
  spectators: Set<WebSocket>;
  lastActivity: number;
  flagTimer: NodeJS.Timeout | null;
  rated: boolean;
  ratingChange: { w: number; b: number } | null;
}

export interface ConnectionContext {
  playerId: string | null;
  name: string;
  roomId: string | null;
  /** Signed-in Google account, verified from the session cookie at connect time. */
  account: { id: string; name: string } | null;
}

const rooms = new Map<string, Room>();

const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return name || 'Guest';
}

function validTimeControl(tc: unknown): TimeControl | null {
  if (!tc || typeof tc !== 'object') return null;
  const { initial, increment } = tc as TimeControl;
  if (!Number.isInteger(initial) || !Number.isInteger(increment)) return null;
  if (initial < 0 || initial > 3 * 60 * 60 || increment < 0 || increment > 180) return null;
  return { initial, increment };
}

function newRoomId(): string {
  for (;;) {
    let id = '';
    for (let i = 0; i < 6; i++) id += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
    if (!rooms.has(id)) return id;
  }
}

function newSeat(ctx: ConnectionContext): Seat {
  return { playerId: ctx.playerId!, name: ctx.name, verified: !!ctx.account, accountId: ctx.account?.id ?? null, sockets: new Set(), abandonTimer: null };
}

function newRoom(tc: TimeControl, rated: boolean): Room {
  const room: Room = {
    id: newRoomId(),
    tc,
    seats: { w: null, b: null },
    chess: new Chess(),
    moves: [],
    clock: null,
    turnStartedAt: null,
    result: null,
    drawOffer: null,
    rematchOffer: null,
    spectators: new Set(),
    lastActivity: Date.now(),
    flagTimer: null,
    rated,
    ratingChange: null,
  };
  resetGame(room);
  rooms.set(room.id, room);
  return room;
}

// ---- Ratings (Elo; new players move faster) ----

function applyRatings(room: Room, result: GameResult) {
  const w = room.seats.w?.accountId ? db.user(room.seats.w.accountId) : undefined;
  const b = room.seats.b?.accountId ? db.user(room.seats.b.accountId) : undefined;
  // Unrated: casual game, guest seat, self-play, or aborted before both players moved.
  if (!room.rated || !w || !b || w.id === b.id || room.moves.length < 2) return;
  const score = result.winner === 'w' ? 1 : result.winner === 'b' ? 0 : 0.5;
  const expected = 1 / (1 + 10 ** ((b.rating - w.rating) / 400));
  const k = (u: typeof w) => (u.record.w + u.record.l + u.record.d < 30 ? 40 : 20);
  const dw = Math.round(k(w) * (score - expected));
  const dbDelta = Math.round(k(b) * (1 - score - (1 - expected)));
  const bump = (rec: { w: number; l: number; d: number }, s: number) => ({ w: rec.w + (s === 1 ? 1 : 0), l: rec.l + (s === 0 ? 1 : 0), d: rec.d + (s === 0.5 ? 1 : 0) });
  db.saveUser({ ...w, rating: Math.max(100, w.rating + dw), record: bump(w.record, score) });
  db.saveUser({ ...b, rating: Math.max(100, b.rating + dbDelta), record: bump(b.record, 1 - score) });
  room.ratingChange = { w: dw, b: dbDelta };
}

// ---- Matchmaking ----

interface Seeker {
  ws: WebSocket;
  ctx: ConnectionContext;
  since: number;
}
const queues = new Map<string, Seeker[]>();
const tcKey = (tc: TimeControl) => `${tc.initial}+${tc.increment}`;

function leaveQueues(ws: WebSocket) {
  for (const [key, list] of queues) {
    const next = list.filter((s) => s.ws !== ws);
    if (next.length) queues.set(key, next);
    else queues.delete(key);
  }
}

function seek(ws: WebSocket, ctx: ConnectionContext, tc: TimeControl) {
  leaveQueues(ws);
  detach(ws, ctx);
  const key = tcKey(tc);
  const list = (queues.get(key) ?? []).filter((s) => s.ws.readyState === s.ws.OPEN);
  const myRating = db.user(ctx.account!.id)?.rating ?? 1500;
  // Closest rating among waiting players, never yourself (e.g. a second tab).
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].ctx.account?.id === ctx.account!.id) continue;
    const r = db.user(list[i].ctx.account!.id)?.rating ?? 1500;
    const bestR = best === -1 ? Infinity : Math.abs((db.user(list[best].ctx.account!.id)?.rating ?? 1500) - myRating);
    if (Math.abs(r - myRating) < bestR) best = i;
  }
  if (best === -1) {
    list.push({ ws, ctx, since: Date.now() });
    queues.set(key, list);
    return send(ws, { t: 'seeking', tc, waiting: list.length - 1 });
  }
  const [opp] = list.splice(best, 1);
  if (list.length) queues.set(key, list);
  else queues.delete(key);

  const room = newRoom(tc, true);
  const meWhite = randomInt(2) === 0;
  room.seats[meWhite ? 'w' : 'b'] = newSeat(ctx);
  room.seats[meWhite ? 'b' : 'w'] = newSeat(opp.ctx);
  attach(opp.ws, opp.ctx, room);
  attach(ws, ctx, room);
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function seatOf(room: Room, playerId: string | null): Side | null {
  if (!playerId) return null;
  if (room.seats.w?.playerId === playerId) return 'w';
  if (room.seats.b?.playerId === playerId) return 'b';
  return null;
}

function remaining(room: Room, now: number): { w: number; b: number } | null {
  if (!room.clock) return null;
  const c = { ...room.clock };
  if (room.turnStartedAt !== null && !room.result) {
    const side = room.chess.turn();
    c[side] = Math.max(0, c[side] - (now - room.turnStartedAt));
  }
  return c;
}

function snapshot(room: Room, you: Side | null): RoomSnapshot {
  const now = Date.now();
  const seatInfo = (s: Seat | null) =>
    s
      ? {
          name: s.name,
          connected: s.sockets.size > 0,
          verified: s.verified,
          rating: s.accountId ? Math.round(db.user(s.accountId)?.rating ?? 1500) : null,
        }
      : null;
  return {
    id: room.id,
    tc: room.tc,
    white: seatInfo(room.seats.w),
    black: seatInfo(room.seats.b),
    moves: room.moves,
    clock: remaining(room, now),
    ticking: room.turnStartedAt !== null && !room.result ? room.chess.turn() : null,
    serverNow: now,
    result: room.result,
    drawOffer: room.drawOffer,
    rematchOffer: room.rematchOffer,
    you,
    rated: room.rated,
    ratingChange: room.ratingChange,
  };
}

function broadcast(room: Room) {
  for (const side of ['w', 'b'] as const) {
    const seat = room.seats[side];
    if (!seat) continue;
    const msg: ServerMessage = { t: 'state', room: snapshot(room, side) };
    for (const ws of seat.sockets) send(ws, msg);
  }
  const spectatorMsg: ServerMessage = { t: 'state', room: snapshot(room, null) };
  for (const ws of room.spectators) send(ws, spectatorMsg);
}

function clearTimers(room: Room) {
  if (room.flagTimer) clearTimeout(room.flagTimer);
  room.flagTimer = null;
}

function finish(room: Room, result: GameResult) {
  if (room.clock && room.turnStartedAt !== null) {
    const side = room.chess.turn();
    room.clock[side] = Math.max(0, room.clock[side] - (Date.now() - room.turnStartedAt));
  }
  room.result = result;
  room.turnStartedAt = null;
  applyRatings(room, result);
  room.drawOffer = null;
  room.rematchOffer = null;
  clearTimers(room);
  for (const side of ['w', 'b'] as const) {
    const seat = room.seats[side];
    if (seat?.abandonTimer) {
      clearTimeout(seat.abandonTimer);
      seat.abandonTimer = null;
    }
  }
}

function scheduleFlag(room: Room) {
  clearTimers(room);
  if (!room.clock || room.turnStartedAt === null || room.result) return;
  const side = room.chess.turn();
  const msLeft = room.clock[side] - (Date.now() - room.turnStartedAt);
  room.flagTimer = setTimeout(() => {
    if (room.result) return;
    const left = remaining(room, Date.now());
    if (left && left[side] <= 0) {
      finish(room, timeoutResult(room.chess, side));
      broadcast(room);
    } else {
      scheduleFlag(room);
    }
  }, Math.max(0, msLeft) + 25);
}

function resetGame(room: Room) {
  room.chess = new Chess();
  room.moves = [];
  room.clock = room.tc.initial > 0 ? { w: room.tc.initial * 1000, b: room.tc.initial * 1000 } : null;
  room.turnStartedAt = null;
  room.result = null;
  room.drawOffer = null;
  room.rematchOffer = null;
  room.ratingChange = null;
  clearTimers(room);
}

function detach(ws: WebSocket, ctx: ConnectionContext) {
  if (!ctx.roomId) return;
  const room = rooms.get(ctx.roomId);
  ctx.roomId = null;
  if (!room) return;
  room.spectators.delete(ws);
  for (const side of ['w', 'b'] as const) {
    const seat = room.seats[side];
    if (!seat || !seat.sockets.delete(ws) || seat.sockets.size > 0) continue;
    // Seat holder fully disconnected: give them time to come back (mobile networks drop often).
    const gameLive = !room.result && room.moves.length >= 2;
    if (gameLive && !seat.abandonTimer) {
      seat.abandonTimer = setTimeout(() => {
        seat.abandonTimer = null;
        if (!room.result && seat.sockets.size === 0) {
          finish(room, { winner: other(side), reason: 'abandon' });
          broadcast(room);
        }
      }, ABANDON_AFTER_MS);
    }
  }
  room.lastActivity = Date.now();
  broadcast(room);
}

function attach(ws: WebSocket, ctx: ConnectionContext, room: Room) {
  detach(ws, ctx);
  ctx.roomId = room.id;
  room.lastActivity = Date.now();

  let side = seatOf(room, ctx.playerId);
  if (!side && ctx.playerId && ctx.account) {
    // Take an open seat if there is one.
    side = !room.seats.w ? 'w' : !room.seats.b ? 'b' : null;
    if (side) room.seats[side] = newSeat(ctx);
  }
  if (side) {
    const seat = room.seats[side]!;
    seat.name = ctx.name;
    seat.verified = !!ctx.account;
    seat.sockets.add(ws);
    if (seat.abandonTimer) {
      clearTimeout(seat.abandonTimer);
      seat.abandonTimer = null;
    }
  } else {
    room.spectators.add(ws);
  }
  broadcast(room);
}

export function handleMessage(ws: WebSocket, ctx: ConnectionContext, msg: ClientMessage) {
  const fail = (message: string) => send(ws, { t: 'error', message });

  if (msg.t === 'hello') {
    if (typeof msg.playerId !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(msg.playerId)) {
      return fail('Invalid player id');
    }
    // Signed-in players are identified by account (seat follows them across devices)
    // and always appear under their verified Google name.
    ctx.playerId = ctx.account ? `acct-${ctx.account.id}` : msg.playerId;
    ctx.name = ctx.account ? sanitizeName(ctx.account.name) : sanitizeName(msg.name);
    return;
  }

  if (!ctx.playerId) return fail('Say hello first');

  if (msg.t === 'seek') {
    if (!ctx.account) return fail('Sign in to play online');
    const tc = validTimeControl(msg.tc);
    if (!tc || tc.initial === 0) return fail('Pick a timed game for Quick match');
    if (rooms.size >= MAX_ROOMS) return fail('Server is busy, please try again later');
    return seek(ws, ctx, tc);
  }

  if (msg.t === 'cancelSeek') {
    leaveQueues(ws);
    return send(ws, { t: 'seekCancelled' });
  }

  if (msg.t === 'create') {
    if (!ctx.account) return fail('Sign in to play online');
    const tc = validTimeControl(msg.tc);
    if (!tc) return fail('Invalid time control');
    if (rooms.size >= MAX_ROOMS) return fail('Server is busy, please try again later');
    leaveQueues(ws);
    const room = newRoom(tc, false); // games with friends are casual (unrated)
    const color: Side = msg.color === 'w' || msg.color === 'b' ? msg.color : randomInt(2) ? 'w' : 'b';
    room.seats[color] = newSeat(ctx);
    return attach(ws, ctx, room);
  }

  if (msg.t === 'join') {
    const id = String(msg.room ?? '').trim().toUpperCase();
    const room = ROOM_CODE_RE.test(id) ? rooms.get(id) : undefined;
    if (!room) return fail('Game not found. Check the code and try again.');
    leaveQueues(ws);
    return attach(ws, ctx, room);
  }

  if (msg.t === 'leave') {
    detach(ws, ctx);
    return send(ws, { t: 'left' });
  }

  const room = ctx.roomId ? rooms.get(ctx.roomId) : undefined;
  if (!room) return fail('You are not in a game');
  const side = seatOf(room, ctx.playerId);
  if (!side) return fail('Spectators cannot do that');
  room.lastActivity = Date.now();

  switch (msg.t) {
    case 'move': {
      if (room.result) return fail('The game is over');
      if (!room.seats.w || !room.seats.b) return fail('Waiting for an opponent');
      if (room.chess.turn() !== side) return fail('Not your turn');
      if (msg.ply !== room.moves.length) return broadcast(room); // stale client: resync
      const parsed = parseUci(String(msg.uci));
      if (!parsed) return fail('Malformed move');
      try {
        room.chess.move(parsed);
      } catch {
        return fail('Illegal move');
      }
      const now = Date.now();
      if (room.clock && room.turnStartedAt !== null) {
        room.clock[side] = room.clock[side] - (now - room.turnStartedAt);
        if (room.clock[side] <= 0) {
          room.chess.undo();
          room.clock[side] = 0;
          finish(room, timeoutResult(room.chess, side));
          return broadcast(room);
        }
        room.clock[side] += room.tc.increment * 1000;
      }
      room.moves.push(parsed.from + parsed.to + (parsed.promotion ?? ''));
      room.drawOffer = null;
      // Clocks start once both players have made their first move.
      room.turnStartedAt = room.clock && room.moves.length >= 2 ? now : null;
      const result = positionResult(room.chess);
      if (result) finish(room, result);
      else scheduleFlag(room);
      return broadcast(room);
    }
    case 'resign':
      if (room.result) return;
      finish(room, { winner: other(side), reason: 'resign' });
      return broadcast(room);
    case 'draw':
      if (room.result) return;
      if (msg.action === 'offer' || msg.action === 'accept') {
        if (room.drawOffer === other(side)) finish(room, { winner: null, reason: 'agreement' });
        else if (msg.action === 'offer') room.drawOffer = side;
      } else if (msg.action === 'decline' && room.drawOffer === other(side)) {
        room.drawOffer = null;
      }
      return broadcast(room);
    case 'rematch':
      if (!room.result) return;
      if (room.rematchOffer === other(side)) {
        // Swap colours for the rematch.
        const { w, b } = room.seats;
        room.seats = { w: b, b: w };
        resetGame(room);
      } else {
        room.rematchOffer = side;
      }
      return broadcast(room);
  }
}

export function handleClose(ws: WebSocket, ctx: ConnectionContext) {
  leaveQueues(ws);
  detach(ws, ctx);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const anyoneHere =
      room.spectators.size > 0 || !!room.seats.w?.sockets.size || !!room.seats.b?.sockets.size;
    if (!anyoneHere && now - room.lastActivity > ROOM_IDLE_TTL_MS) {
      clearTimers(room);
      rooms.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

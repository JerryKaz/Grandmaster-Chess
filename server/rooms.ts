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

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const ABANDON_AFTER_MS = 90 * 1000;
const MAX_ROOMS = 5000;

interface Seat {
  playerId: string;
  name: string;
  verified: boolean;
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
  const seatInfo = (s: Seat | null) => (s ? { name: s.name, connected: s.sockets.size > 0, verified: s.verified } : null);
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
  if (!side && ctx.playerId) {
    // Take an open seat if there is one.
    side = !room.seats.w ? 'w' : !room.seats.b ? 'b' : null;
    if (side) room.seats[side] = { playerId: ctx.playerId, name: ctx.name, verified: !!ctx.account, sockets: new Set(), abandonTimer: null };
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

  if (msg.t === 'create') {
    const tc = validTimeControl(msg.tc);
    if (!tc) return fail('Invalid time control');
    if (rooms.size >= MAX_ROOMS) return fail('Server is busy, please try again later');
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
    };
    resetGame(room);
    const color: Side = msg.color === 'w' || msg.color === 'b' ? msg.color : randomInt(2) ? 'w' : 'b';
    room.seats[color] = { playerId: ctx.playerId, name: ctx.name, verified: !!ctx.account, sockets: new Set(), abandonTimer: null };
    rooms.set(room.id, room);
    return attach(ws, ctx, room);
  }

  if (msg.t === 'join') {
    const id = String(msg.room ?? '').trim().toUpperCase();
    const room = ROOM_CODE_RE.test(id) ? rooms.get(id) : undefined;
    if (!room) return fail('Game not found. Check the code and try again.');
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

/**
 * Wire protocol shared by the browser client and the Node server for online play.
 * The server is authoritative: clients send intents, the server validates them
 * with chess.js and broadcasts the resulting room snapshot.
 */

export type Side = 'w' | 'b';

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'fifty-move'
  | 'insufficient'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'abandon';

export interface GameResult {
  winner: Side | null; // null = draw
  reason: EndReason;
}

export interface TimeControl {
  /** Initial time per side in seconds. 0 = unlimited. */
  initial: number;
  /** Increment per move in seconds. */
  increment: number;
}

export interface SeatInfo {
  name: string;
  connected: boolean;
  /** Player is signed in to an account. */
  verified: boolean;
  /** Online rating, for signed-in players. */
  rating: number | null;
}

export interface RoomSnapshot {
  id: string;
  tc: TimeControl;
  white: SeatInfo | null;
  black: SeatInfo | null;
  /** Moves in UCI (e2e4, e7e8q). */
  moves: string[];
  /** Remaining clock in ms at `serverNow`, per side. */
  clock: { w: number; b: number } | null;
  /** Side whose clock is currently running, if any. */
  ticking: Side | null;
  serverNow: number;
  result: GameResult | null;
  drawOffer: Side | null;
  rematchOffer: Side | null;
  /** Your seat in this room, or null when spectating. */
  you: Side | null;
  /** Rated games (from Quick match) change both players' ratings. */
  rated: boolean;
  /** Rating change applied when a rated game finished. */
  ratingChange: { w: number; b: number } | null;
}

export type ClientMessage =
  | { t: 'hello'; playerId: string; name: string }
  | { t: 'create'; tc: TimeControl; color: Side | 'random' }
  | { t: 'join'; room: string }
  | { t: 'leave' }
  | { t: 'move'; uci: string; ply: number }
  | { t: 'resign' }
  | { t: 'draw'; action: 'offer' | 'accept' | 'decline' }
  | { t: 'rematch'; action: 'offer' | 'accept' }
  | { t: 'seek'; tc: TimeControl }
  | { t: 'cancelSeek' };

export type ServerMessage =
  | { t: 'state'; room: RoomSnapshot }
  | { t: 'error'; message: string }
  | { t: 'left' }
  | { t: 'seeking'; tc: TimeControl; waiting: number }
  | { t: 'seekCancelled' };

export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const MAX_NAME_LENGTH = 24;

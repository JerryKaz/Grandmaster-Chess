import type { PieceSymbol, Square } from 'chess.js';
import type { GameResult, Side, TimeControl } from '../../shared/protocol';

export type { GameResult, Side, TimeControl, PieceSymbol, Square };

export type Mode = 'bot' | 'local' | 'online' | 'analysis';

export interface Ply {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  color: Side;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  /** chess.js move flags, e.g. 'k' (king-side castle), 'e' (en passant). */
  flags: string;
  /** Position after this move. */
  fen: string;
  /** Milliseconds the mover spent on this move (local/bot games only). */
  spentMs?: number;
}

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export interface GameMeta {
  white: string;
  black: string;
  tc: TimeControl;
  /** Bot games: the bot level id and the human's side. */
  botLevel?: number;
  humanSide?: Side;
  startedAt: number;
}

export type MoveClass =
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface ReviewData {
  /** Evaluation (White's perspective, centipawns, mate mapped to ±10000) for positions 0..n. */
  evals: number[];
  /** Mate distance for positions where the engine found a mate (signed, White's perspective). */
  mates: (number | null)[];
  /** Engine best move (UCI) for positions 0..n-1. */
  best: (string | null)[];
  /** Classification for each ply (index 0 = first move). */
  classes: MoveClass[];
  accuracy: { w: number; b: number };
}

export interface ArchivedGame {
  id: string;
  mode: Exclude<Mode, 'analysis'>;
  meta: GameMeta;
  startFen: string;
  moves: string[]; // UCI
  result: GameResult;
  endedAt: number;
}

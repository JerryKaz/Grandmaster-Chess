import { Chess } from 'chess.js';
import type { GameResult, Side } from './protocol';

/** Result implied by the board itself (mate, stalemate, draw rules), or null if play continues. */
export function positionResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'repetition' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty-move' };
  return null;
}

/**
 * FIDE 6.9: if a player runs out of time but the opponent cannot possibly
 * checkmate with their remaining material, the game is drawn.
 * Conservative check: opponent has only a king, or king + single minor piece.
 */
export function canSideMate(chess: Chess, side: Side): boolean {
  let minors = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== side || sq.type === 'k') continue;
      if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true;
      minors++;
    }
  }
  return minors >= 2;
}

export function timeoutResult(chess: Chess, flagged: Side): GameResult {
  const opponent: Side = flagged === 'w' ? 'b' : 'w';
  return canSideMate(chess, opponent)
    ? { winner: opponent, reason: 'timeout' }
    : { winner: null, reason: 'insufficient' };
}

export function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

export function resultToPgn(result: GameResult | null): string {
  if (!result) return '*';
  if (result.winner === 'w') return '1-0';
  if (result.winner === 'b') return '0-1';
  return '1/2-1/2';
}

export function describeResult(result: GameResult): string {
  const who = result.winner === 'w' ? 'White' : result.winner === 'b' ? 'Black' : null;
  switch (result.reason) {
    case 'checkmate': return `${who} wins by checkmate`;
    case 'resign': return `${who} wins — opponent resigned`;
    case 'timeout': return `${who} wins on time`;
    case 'abandon': return `${who} wins — opponent left`;
    case 'stalemate': return 'Draw by stalemate';
    case 'repetition': return 'Draw by threefold repetition';
    case 'fifty-move': return 'Draw by the 50-move rule';
    case 'insufficient': return 'Draw — insufficient material';
    case 'agreement': return 'Draw by agreement';
  }
}

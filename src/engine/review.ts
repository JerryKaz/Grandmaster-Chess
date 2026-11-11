import { Chess } from 'chess.js';
import { fenAt, sideToMove, START_FEN } from '../lib/game';
import { isBookPrefix } from '../lib/openings';
import { classify, MATE_CP, scoreToCp, sideAccuracy } from '../lib/review';
import type { Ply, ReviewData } from '../lib/types';
import { getAnalysisEngine, whitePov } from './stockfish';

const REVIEW_DEPTH = 13;

/**
 * Analyse every position of a game and classify each move.
 * Calls `onProgress` with 0..1; resolves to null if aborted.
 */
export async function reviewGame(
  startFen: string,
  plies: Ply[],
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<ReviewData | null> {
  const engine = getAnalysisEngine();
  const n = plies.length;
  const evals: number[] = [];
  const mates: (number | null)[] = [];
  const best: (string | null)[] = [];

  for (let i = 0; i <= n; i++) {
    if (signal.aborted) return null;
    const fen = fenAt(startFen, plies, i);
    const chess = new Chess(fen);

    if (chess.isCheckmate()) {
      const whiteMated = chess.turn() === 'w';
      evals.push(whiteMated ? -MATE_CP : MATE_CP);
      mates.push(null);
      best.push(null);
    } else if (chess.isStalemate() || chess.isInsufficientMaterial()) {
      evals.push(0);
      mates.push(null);
      best.push(null);
    } else {
      const res = await engine.search({ fen, depth: REVIEW_DEPTH, multipv: 1, options: { 'UCI_LimitStrength': false, 'Skill Level': 20 }, signal });
      if (!res) return null;
      const top = res.lines[0];
      const score = top ? whitePov(top.score, fen) : { cp: 0 };
      evals.push(scoreToCp(score));
      mates.push(score.mate ?? null);
      best.push(res.bestmove);
    }
    onProgress((i + 1) / (n + 1));
  }

  const sans = plies.map((p) => p.san);
  const classes = plies.map((p, i) =>
    classify({
      mover: p.color,
      evalBefore: evals[i],
      evalAfter: evals[i + 1],
      playedUci: p.uci,
      bestUci: best[i],
      inBook: startFen === START_FEN && isBookPrefix(sans, i + 1),
    }),
  );

  return { evals, mates, best, classes, accuracy: sideAccuracy(evals, sideToMove(startFen)) };
}

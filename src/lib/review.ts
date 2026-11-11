import type { MoveClass, Side } from './types';

/** Win probability (0-100) for White from a centipawn score. Same model Lichess uses. */
export function winPercent(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** Per-move accuracy from the mover's win% before and after (Lichess formula). */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export const MATE_CP = 10000;

export function scoreToCp(score: { cp?: number; mate?: number }): number {
  if (score.mate !== undefined) return score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate;
  return score.cp ?? 0;
}

export function classify(opts: {
  mover: Side;
  evalBefore: number; // White POV cp
  evalAfter: number;
  playedUci: string;
  bestUci: string | null;
  inBook: boolean;
}): MoveClass {
  if (opts.inBook) return 'book';
  const sign = opts.mover === 'w' ? 1 : -1;
  const before = winPercent(sign * opts.evalBefore);
  const after = winPercent(sign * opts.evalAfter);
  const drop = before - after;
  if (opts.bestUci && opts.playedUci === opts.bestUci) return 'best';
  if (drop < 2) return 'excellent';
  if (drop < 5) return 'good';
  if (drop < 10) return 'inaccuracy';
  if (drop < 15) return 'mistake';
  return 'blunder';
}

export function sideAccuracy(evals: number[], firstMover: Side): { w: number; b: number } {
  const sums = { w: 0, b: 0 };
  const counts = { w: 0, b: 0 };
  for (let i = 0; i < evals.length - 1; i++) {
    const mover: Side = (i % 2 === 0) === (firstMover === 'w') ? 'w' : 'b';
    const sign = mover === 'w' ? 1 : -1;
    sums[mover] += moveAccuracy(winPercent(sign * evals[i]), winPercent(sign * evals[i + 1]));
    counts[mover]++;
  }
  return {
    w: counts.w ? Math.round((sums.w / counts.w) * 10) / 10 : 0,
    b: counts.b ? Math.round((sums.b / counts.b) * 10) / 10 : 0,
  };
}

export const CLASS_META: Record<MoveClass, { label: string; color: string; symbol: string }> = {
  book: { label: 'Book', color: '#a88865', symbol: '≡' },
  best: { label: 'Best', color: '#81b64c', symbol: '★' },
  excellent: { label: 'Excellent', color: '#5c8bb0', symbol: '!' },
  good: { label: 'Good', color: '#95b776', symbol: '✓' },
  inaccuracy: { label: 'Inaccuracy', color: '#f7c045', symbol: '?!' },
  mistake: { label: 'Mistake', color: '#e58f2a', symbol: '?' },
  blunder: { label: 'Blunder', color: '#ca3431', symbol: '??' },
};

export function formatEval(cp: number, mate: number | null): string {
  if (mate !== null && mate !== undefined) return `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`;
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(Math.abs(pawns) >= 10 ? 0 : 1)}`;
}

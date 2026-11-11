/** Puzzle data: a curated, legality-checked subset of the Lichess puzzle database (CC0). */
export interface Puzzle {
  id: string;
  /** Position BEFORE the opponent's setup move. */
  fen: string;
  /** UCI moves: [opponent setup move, solution, reply, solution, …]. */
  moves: string[];
  rating: number;
  themes: string[];
}

type RawPuzzle = [id: string, fen: string, moves: string, rating: number, themes: string];

let cache: Promise<Puzzle[]> | null = null;

export function loadPuzzles(): Promise<Puzzle[]> {
  cache ??= fetch('/puzzles/puzzles.json')
    .then((r) => {
      if (!r.ok) throw new Error('Could not load puzzles');
      return r.json() as Promise<RawPuzzle[]>;
    })
    .then((rows) => rows.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes.split(' ') })))
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

export const PUZZLE_THEMES: { id: string; label: string }[] = [
  { id: 'all', label: 'All themes' },
  { id: 'mateIn1', label: 'Mate in 1' },
  { id: 'mateIn2', label: 'Mate in 2' },
  { id: 'mateIn3', label: 'Mate in 3+' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'skewer', label: 'Skewer' },
  { id: 'discoveredAttack', label: 'Discovered attack' },
  { id: 'hangingPiece', label: 'Hanging piece' },
  { id: 'sacrifice', label: 'Sacrifice' },
  { id: 'deflection', label: 'Deflection' },
  { id: 'attraction', label: 'Attraction' },
  { id: 'backRankMate', label: 'Back-rank mate' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'opening', label: 'Opening' },
  { id: 'middlegame', label: 'Middlegame' },
  { id: 'endgame', label: 'Endgame' },
];

const THEME_LABELS: Record<string, string> = {
  ...Object.fromEntries(PUZZLE_THEMES.map((t) => [t.id, t.label])),
  mate: 'Checkmate',
  mateIn4: 'Mate in 4',
  crushing: 'Crushing',
  advantage: 'Advantage',
  kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack',
  advancedPawn: 'Advanced pawn',
  defensiveMove: 'Defensive move',
  quietMove: 'Quiet move',
  rookEndgame: 'Rook endgame',
  pawnEndgame: 'Pawn endgame',
  bishopEndgame: 'Bishop endgame',
  knightEndgame: 'Knight endgame',
  queenEndgame: 'Queen endgame',
  exposedKing: 'Exposed king',
  clearance: 'Clearance',
  intermezzo: 'Intermezzo',
  trappedPiece: 'Trapped piece',
  zugzwang: 'Zugzwang',
  doubleCheck: 'Double check',
  interference: 'Interference',
  capturingDefender: 'Capture the defender',
};

/** Human-readable tags shown after a puzzle (skips length/meta tags). */
export function themeLabels(themes: string[]): string[] {
  return themes.filter((t) => THEME_LABELS[t] && t !== 'all').map((t) => THEME_LABELS[t]);
}

function matchesTheme(p: Puzzle, theme: string): boolean {
  if (theme === 'all') return true;
  if (theme === 'mateIn3') return p.themes.some((t) => t === 'mateIn3' || t === 'mateIn4' || t === 'mateIn5');
  return p.themes.includes(theme);
}

/** Random puzzle near `target` rating for `theme`, avoiding recently seen ids. */
export function pickPuzzle(all: Puzzle[], target: number, theme: string, recent: Set<string>): Puzzle | null {
  const pool = all.filter((p) => matchesTheme(p, theme));
  if (pool.length === 0) return null;
  for (let window = 100; window <= 3000; window += 100) {
    const near = pool.filter((p) => Math.abs(p.rating - target) <= window && !recent.has(p.id));
    if (near.length >= 8 || window >= 3000) {
      const list = near.length ? near : pool;
      return list[Math.floor(Math.random() * list.length)];
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Elo-style update. New players move faster (higher K) until they have ~20 results. */
export function ratingDelta(player: number, puzzle: number, win: boolean, games: number): number {
  const expected = 1 / (1 + 10 ** ((puzzle - player) / 400));
  const k = games < 20 ? 40 : 20;
  return Math.round(k * ((win ? 1 : 0) - expected));
}

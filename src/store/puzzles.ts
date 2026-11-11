import { create } from 'zustand';
import { Chess } from 'chess.js';
import { parseUci } from '../../shared/rules';
import { loadPuzzles, pickPuzzle, ratingDelta, type Puzzle } from '../lib/puzzles';
import { playSound, soundForMove } from '../lib/sound';
import { load, save } from '../lib/storage';
import type { MoveInput, Side, Square } from '../lib/types';

export interface PuzzleProgress {
  rating: number;
  solved: number;
  failed: number;
  bestStreak: number;
  recent: string[];
  updatedAt: number;
}

export type PuzzleMode = 'rated' | 'streak';

/**
 * - loading:  fetching / picking
 * - setup:    opponent's first move is about to be played
 * - solving:  your turn
 * - reply:    correct so far, opponent replying
 * - wrong:    last move was wrong (can retry, see solution or move on)
 * - solved:   puzzle complete
 * - solution: solution has been shown
 */
export type PuzzleStatus = 'loading' | 'setup' | 'solving' | 'reply' | 'wrong' | 'solved' | 'solution' | 'error';

interface PuzzleState {
  progress: PuzzleProgress;
  mode: PuzzleMode;
  theme: string;
  puzzle: Puzzle | null;
  /** Moves actually played on the board from puzzle.fen (UCI). */
  line: string[];
  status: PuzzleStatus;
  orientation: Side;
  /** Result recorded for this puzzle (first attempt decides). */
  result: 'win' | 'loss' | null;
  delta: number | null;
  hintSquare: Square | null;
  streak: number;
  streakOver: boolean;
  /** Session results for the little history strip. */
  history: { id: string; win: boolean }[];
  lastMoveDragged: boolean;

  next: () => Promise<void>;
  setMode: (mode: PuzzleMode) => void;
  setTheme: (theme: string) => void;
  move: (input: MoveInput, dragged: boolean) => void;
  retry: () => void;
  hint: () => void;
  showSolution: () => void;
  applyProgress: (p: PuzzleProgress) => void;
}

const KEY = 'gm-puzzles-v1';
const defaultProgress: PuzzleProgress = { rating: 1200, solved: 0, failed: 0, bestStreak: 0, recent: [], updatedAt: 0 };

let timer: ReturnType<typeof setTimeout> | null = null;
const later = (fn: () => void, ms: number) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fn, ms);
};

const playedFen = (p: Puzzle, line: string[]) => {
  const c = new Chess(p.fen);
  for (const u of line) c.move(parseUci(u)!);
  return c;
};

export const usePuzzles = create<PuzzleState>((set, get) => {
  const record = (win: boolean) => {
    const s = get();
    if (s.result || !s.puzzle) return;
    const progress = { ...s.progress, updatedAt: Date.now() };
    let delta: number | null = null;
    if (s.mode === 'rated') {
      delta = ratingDelta(progress.rating, s.puzzle.rating, win, progress.solved + progress.failed);
      progress.rating = Math.max(100, progress.rating + delta);
      if (win) progress.solved++;
      else progress.failed++;
    }
    progress.recent = [s.puzzle.id, ...progress.recent.filter((id) => id !== s.puzzle!.id)].slice(0, 500);
    let { streak, streakOver } = s;
    if (s.mode === 'streak') {
      if (win) streak++;
      else streakOver = true;
      progress.bestStreak = Math.max(progress.bestStreak, streak);
    }
    save(KEY, progress);
    set({ progress, result: win ? 'win' : 'loss', delta, streak, streakOver, history: [...s.history, { id: s.puzzle.id, win }].slice(-20) });
  };

  const opponentPlays = (delay: number) => {
    later(() => {
      const s = get();
      if (!s.puzzle) return;
      const uci = s.puzzle.moves[s.line.length];
      const c = playedFen(s.puzzle, s.line);
      const m = c.move(parseUci(uci)!);
      playSound(soundForMove(m));
      set({ line: [...s.line, uci], status: 'solving', lastMoveDragged: false });
    }, delay);
  };

  return {
    progress: { ...defaultProgress, ...load<Partial<PuzzleProgress>>(KEY, {}) },
    mode: 'rated',
    theme: 'all',
    puzzle: null,
    line: [],
    status: 'loading',
    orientation: 'w',
    result: null,
    delta: null,
    hintSquare: null,
    streak: 0,
    streakOver: false,
    history: [],
    lastMoveDragged: false,

    next: async () => {
      if (timer) clearTimeout(timer);
      const s = get();
      // Starting over after a lost streak.
      if (s.mode === 'streak' && s.streakOver) set({ streak: 0, streakOver: false });
      set({ status: 'loading', puzzle: null, line: [], result: null, delta: null, hintSquare: null });
      try {
        const all = await loadPuzzles();
        const st = get();
        const target = st.mode === 'streak' ? 600 + st.streak * 75 : st.progress.rating;
        const puzzle = pickPuzzle(all, target, st.mode === 'streak' ? 'all' : st.theme, new Set(st.progress.recent));
        if (!puzzle) return set({ status: 'error' });
        // The solver plays the side that moves AFTER the opponent's setup move.
        const solver: Side = new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w';
        set({ puzzle, line: [], status: 'setup', orientation: solver });
        opponentPlays(650);
      } catch {
        set({ status: 'error' });
      }
    },

    setMode: (mode) => {
      set({ mode, streak: 0, streakOver: false, history: [] });
      void get().next();
    },

    setTheme: (theme) => {
      set({ theme });
      void get().next();
    },

    move: (input, dragged) => {
      const s = get();
      if (!s.puzzle || s.status !== 'solving') return;
      const c = playedFen(s.puzzle, s.line);
      let m;
      try {
        m = c.move(input);
      } catch {
        return;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      const expected = s.puzzle.moves[s.line.length];
      // Any checkmate is accepted, even if it differs from the stored solution (Lichess does the same).
      const correct = uci === expected || c.isCheckmate();
      const line = [...s.line, uci];
      set({ line, hintSquare: null, lastMoveDragged: dragged });

      if (!correct) {
        playSound('illegal');
        set({ status: 'wrong' });
        record(false);
        return;
      }
      playSound(soundForMove(m));
      if (line.length >= s.puzzle.moves.length || c.isCheckmate()) {
        set({ status: 'solved' });
        record(!s.hintSquare && s.result !== 'loss');
        playSound('notify');
        if (get().mode === 'streak' && !get().streakOver) later(() => void get().next(), 900);
        return;
      }
      set({ status: 'reply' });
      opponentPlays(380);
    },

    retry: () => {
      const s = get();
      if (s.status !== 'wrong' || (s.mode === 'streak' && s.streakOver)) return;
      set({ line: s.line.slice(0, -1), status: 'solving' });
    },

    hint: () => {
      const s = get();
      if (!s.puzzle || s.status !== 'solving' || s.mode === 'streak') return;
      const p = parseUci(s.puzzle.moves[s.line.length]);
      if (p) set({ hintSquare: p.from as Square });
      record(false); // a hint counts as a miss for rating purposes
    },

    showSolution: () => {
      const s = get();
      if (!s.puzzle) return;
      record(false);
      // Rewind any wrong move, then play the rest of the solution step by step.
      const correctPrefix = s.status === 'wrong' ? s.line.slice(0, -1) : s.line;
      set({ line: correctPrefix, status: 'solution', hintSquare: null });
      const step = () => {
        const st = get();
        if (!st.puzzle || st.status !== 'solution' || st.line.length >= st.puzzle.moves.length) return;
        const uci = st.puzzle.moves[st.line.length];
        const m = playedFen(st.puzzle, st.line).move(parseUci(uci)!);
        playSound(soundForMove(m));
        set({ line: [...st.line, uci], lastMoveDragged: false });
        later(step, 700);
      };
      later(step, 400);
    },

    applyProgress: (p) => {
      save(KEY, p);
      set({ progress: p });
    },
  };
});

/** FEN currently on the puzzle board. */
export function puzzleFen(s: Pick<PuzzleState, 'puzzle' | 'line'>): string | null {
  return s.puzzle ? playedFen(s.puzzle, s.line).fen() : null;
}

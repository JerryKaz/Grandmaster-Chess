import { create } from 'zustand';
import type { RoomSnapshot } from '../../shared/protocol';
import { positionResult, timeoutResult } from '../../shared/rules';
import { getBotLevel } from '../engine/bots';
import { fenAt, isArchivedGame, newId, pliesFromUci, replay, sideToMove, START_FEN, toPly, tryMove } from '../lib/game';
import { playSound, soundForMove } from '../lib/sound';
import { load, remove, save } from '../lib/storage';
import type {
  ArchivedGame,
  GameMeta,
  GameResult,
  Mode,
  MoveInput,
  Ply,
  ReviewData,
  Side,
  Square,
  TimeControl,
} from '../lib/types';
import { displayName } from './settings';

export interface ClockState {
  w: number;
  b: number;
  /** performance-independent wall time when the side to move started thinking; null = clock stopped. */
  turnStartedAt: number | null;
}

export type Status = 'setup' | 'playing' | 'over';

interface GameState {
  id: string;
  mode: Mode;
  status: Status;
  startFen: string;
  plies: Ply[];
  viewPly: number;
  result: GameResult | null;
  meta: GameMeta;
  clock: ClockState | null;
  orientation: Side;
  hint: { from: Square; to: Square } | null;
  review: ReviewData | null;
  reviewProgress: number | null;
  /** Latest evaluation the bot computed (White POV cp) — used to decide draw offers. */
  botEval: number | null;
  /** True when the last move was dropped by drag (skip the slide animation). */
  lastMoveDragged: boolean;
  /** Online: UCI of a move we sent but the server has not confirmed yet. */
  pendingUci: string | null;
  archive: ArchivedGame[];

  showSetup: () => void;
  startBotGame: (levelId: number, side: Side | 'random', tc: TimeControl) => void;
  startLocalGame: (tc: TimeControl) => void;
  startAnalysis: (opts?: { startFen?: string; plies?: Ply[]; meta?: Partial<GameMeta>; review?: ReviewData | null }) => void;
  openArchived: (game: ArchivedGame) => void;
  move: (input: MoveInput, opts?: { dragged?: boolean; botEval?: number | null }) => Ply | null;
  takeback: () => boolean;
  goTo: (ply: number) => void;
  resign: (side: Side) => void;
  agreeDraw: () => void;
  flag: (side: Side) => void;
  flip: () => void;
  setHint: (hint: GameState['hint']) => void;
  setReview: (review: ReviewData | null, progress?: number | null) => void;
  applyOnline: (snap: RoomSnapshot, receivedAt: number) => void;
  markPending: (uci: string | null) => void;
  deleteArchived: (id: string) => void;
}

const ARCHIVE_KEY = 'gm-archive-v2';
const CURRENT_KEY = 'gm-current-v2';
const ARCHIVE_LIMIT = 50;

const emptyMeta = (): GameMeta => ({ white: 'White', black: 'Black', tc: { initial: 0, increment: 0 }, startedAt: Date.now() });

const makeClock = (tc: TimeControl): ClockState | null =>
  tc.initial > 0 ? { w: tc.initial * 1000, b: tc.initial * 1000, turnStartedAt: null } : null;

/** Remaining time for a side right now. */
export function clockRemaining(clock: ClockState, side: Side, turn: Side, now = Date.now()): number {
  const base = clock[side];
  return clock.turnStartedAt !== null && side === turn ? Math.max(0, base - (now - clock.turnStartedAt)) : base;
}

interface SavedCurrent {
  id: string;
  mode: Mode;
  status: Status;
  startFen: string;
  moves: string[];
  result: GameResult | null;
  meta: GameMeta;
  clock: ClockState | null;
  orientation: Side;
}

function restore(): Partial<GameState> {
  const saved = load<SavedCurrent | null>(CURRENT_KEY, null);
  if (!saved || saved.mode === 'online') return {};
  try {
    const plies = pliesFromUci(saved.startFen, saved.moves);
    // Pause the clock while the app was closed: resume counting from now.
    const clock = saved.clock && { ...saved.clock, turnStartedAt: saved.clock.turnStartedAt !== null ? Date.now() : null };
    return { ...saved, plies, viewPly: plies.length, clock };
  } catch {
    remove(CURRENT_KEY);
    return {};
  }
}

export const useGame = create<GameState>((set, get) => {
  const archive = load<unknown[]>(ARCHIVE_KEY, []).filter(isArchivedGame);

  const finish = (result: GameResult) => {
    const s = get();
    let clock = s.clock;
    if (clock && clock.turnStartedAt !== null) {
      const turn = sideToMove(fenAt(s.startFen, s.plies, s.plies.length));
      clock = { ...clock, [turn]: clockRemaining(clock, turn, turn), turnStartedAt: null };
    }
    let nextArchive = s.archive;
    if (s.mode !== 'analysis' && s.plies.length > 0) {
      const entry: ArchivedGame = {
        id: s.id,
        mode: s.mode as ArchivedGame['mode'],
        meta: s.meta,
        startFen: s.startFen,
        moves: s.plies.map((p) => p.uci),
        result,
        endedAt: Date.now(),
      };
      nextArchive = [entry, ...s.archive.filter((g) => g.id !== s.id)].slice(0, ARCHIVE_LIMIT);
      save(ARCHIVE_KEY, nextArchive);
    }
    set({ result, status: 'over', clock, hint: null, archive: nextArchive });
    playSound('end');
  };

  const fresh = (patch: Partial<GameState>): Partial<GameState> => ({
    id: newId(),
    startFen: START_FEN,
    plies: [],
    viewPly: 0,
    result: null,
    hint: null,
    review: null,
    reviewProgress: null,
    botEval: null,
    pendingUci: null,
    lastMoveDragged: false,
    ...patch,
  });

  return {
    id: newId(),
    mode: 'bot',
    status: 'setup',
    startFen: START_FEN,
    plies: [],
    viewPly: 0,
    result: null,
    meta: emptyMeta(),
    clock: null,
    orientation: 'w',
    hint: null,
    review: null,
    reviewProgress: null,
    botEval: null,
    lastMoveDragged: false,
    pendingUci: null,
    archive,
    ...restore(),

    showSetup: () => {
      const s = get();
      if (s.mode === 'online' || s.mode === 'analysis') set(fresh({ mode: 'bot', status: 'setup', meta: emptyMeta(), clock: null, orientation: 'w' }));
      else set({ status: 'setup' });
    },

    startBotGame: (levelId, side, tc) => {
      const human: Side = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
      const level = getBotLevel(levelId);
      const botName = level.name;
      const me = displayName();
      set(
        fresh({
          mode: 'bot',
          status: 'playing',
          meta: { white: human === 'w' ? me : botName, black: human === 'b' ? me : botName, tc, botLevel: levelId, humanSide: human, startedAt: Date.now() },
          clock: makeClock(tc),
          orientation: human,
        }),
      );
      playSound('notify');
    },

    startLocalGame: (tc) => {
      set(
        fresh({
          mode: 'local',
          status: 'playing',
          meta: { white: 'White', black: 'Black', tc, startedAt: Date.now() },
          clock: makeClock(tc),
          orientation: 'w',
        }),
      );
      playSound('notify');
    },

    startAnalysis: (opts = {}) => {
      const plies = opts.plies ?? [];
      set(
        fresh({
          mode: 'analysis',
          status: 'playing',
          startFen: opts.startFen ?? START_FEN,
          plies,
          viewPly: opts.review ? 0 : plies.length,
          meta: { ...emptyMeta(), ...opts.meta },
          clock: null,
          review: opts.review ?? null,
          orientation: opts.meta?.humanSide ?? 'w',
        }),
      );
    },

    openArchived: (game) => {
      try {
        const plies = pliesFromUci(game.startFen, game.moves);
        get().startAnalysis({ startFen: game.startFen, plies, meta: game.meta });
        set({ result: game.result, viewPly: 0 });
      } catch {
        /* corrupt entry: ignore */
      }
    },

    move: (input, opts = {}) => {
      const s = get();
      if (s.status !== 'playing') return null;
      // Analysis board: moving from an earlier position starts a new line from there.
      const base = s.mode === 'analysis' ? s.viewPly : s.plies.length;
      if (s.mode !== 'analysis' && s.viewPly !== s.plies.length) return null;

      const chess = replay(s.startFen, s.plies, base);
      const mover = chess.turn();
      const m = tryMove(chess, input);
      if (!m) {
        playSound('illegal');
        return null;
      }

      const now = Date.now();
      let clock = s.clock;
      let spentMs: number | undefined;
      if (clock && s.mode !== 'online') {
        const next = { ...clock };
        if (clock.turnStartedAt !== null) {
          spentMs = now - clock.turnStartedAt;
          next[mover] = Math.max(0, clock[mover] - spentMs) + s.meta.tc.increment * 1000;
        }
        // Clocks start once both sides have made a move (like Lichess).
        next.turnStartedAt = base + 1 >= 2 ? now : null;
        clock = next;
      }

      const ply = toPly(m, spentMs);
      const plies = [...s.plies.slice(0, base), ply];
      // Keep review data only if we are replaying the reviewed game unchanged.
      const keepReview = s.review && s.plies[base]?.uci === ply.uci;
      set({
        plies: keepReview ? s.plies : plies,
        viewPly: base + 1,
        clock,
        hint: null,
        lastMoveDragged: !!opts.dragged,
        botEval: opts.botEval !== undefined ? opts.botEval : s.botEval,
        review: keepReview ? s.review : null,
      });

      const result = s.mode === 'analysis' ? null : positionResult(chess);
      if (result && s.mode !== 'online') finish(result);
      else playSound(soundForMove(m));
      return ply;
    },

    takeback: () => {
      const s = get();
      if (s.status !== 'playing' || s.plies.length === 0 || s.mode === 'online') return false;
      let n = 1;
      if (s.mode === 'bot') {
        const turn = sideToMove(fenAt(s.startFen, s.plies, s.plies.length));
        n = turn === s.meta.humanSide ? 2 : 1;
        if (s.plies.length < n) return false;
      }
      const plies = s.plies.slice(0, s.plies.length - n);
      const clock = s.clock && { ...s.clock, turnStartedAt: s.clock.turnStartedAt !== null && plies.length >= 2 ? Date.now() : null };
      set({ plies, viewPly: plies.length, clock, hint: null, lastMoveDragged: false });
      playSound('move');
      return true;
    },

    goTo: (ply) => {
      const s = get();
      const clamped = Math.max(0, Math.min(s.plies.length, ply));
      if (clamped === s.viewPly) return;
      const forwardOne = clamped === s.viewPly + 1;
      set({ viewPly: clamped, lastMoveDragged: false, hint: null });
      if (forwardOne) playSound(soundForMove(s.plies[clamped - 1]));
    },

    resign: (side) => {
      if (get().status !== 'playing') return;
      finish({ winner: side === 'w' ? 'b' : 'w', reason: 'resign' });
    },

    agreeDraw: () => {
      if (get().status !== 'playing') return;
      finish({ winner: null, reason: 'agreement' });
    },

    flag: (side) => {
      const s = get();
      if (s.status !== 'playing' || s.mode === 'online') return;
      const chess = replay(s.startFen, s.plies);
      const clock = s.clock && { ...s.clock, [side]: 0, turnStartedAt: null };
      set({ clock });
      finish(timeoutResult(chess, side));
    },

    flip: () => set({ orientation: get().orientation === 'w' ? 'b' : 'w' }),

    setHint: (hint) => set({ hint }),

    setReview: (review, progress = null) => set({ review, reviewProgress: progress }),

    markPending: (uci) => set({ pendingUci: uci }),

    applyOnline: (snap, receivedAt) => {
      const s = get();
      const current = s.mode === 'online' ? s.plies.map((p) => p.uci) : [];
      let moves = snap.moves;
      // Keep our optimistic move if this snapshot simply predates it.
      if (
        s.pendingUci &&
        current.length === moves.length + 1 &&
        current.at(-1) === s.pendingUci &&
        moves.every((m, i) => m === current[i])
      ) {
        moves = current;
      }
      const isPrefix = current.length <= moves.length && current.every((m, i) => m === moves[i]);
      let plies: Ply[];
      try {
        plies = isPrefix ? [...s.plies.slice(0, current.length), ...pliesFromUci(fenAt(START_FEN, s.plies, current.length), moves.slice(current.length))] : pliesFromUci(START_FEN, moves);
      } catch {
        plies = [];
      }
      const newOpponentMove = plies.length > current.length && plies.at(-1)!.color !== snap.you;
      const wasLive = s.viewPly === s.plies.length;
      const gameChanged = s.mode !== 'online' || s.id !== snap.id || moves.length < current.length;
      const tick = snap.ticking;
      const clock: ClockState | null = snap.clock
        ? { w: snap.clock.w, b: snap.clock.b, turnStartedAt: tick ? receivedAt : null }
        : null;
      // When ticking, ClockState expects the base for the side to move; the other side is static.
      const seat = (x: RoomSnapshot['white']) => (x ? x.name : 'Waiting…');
      const justEnded = !s.result && !!snap.result;

      set({
        id: snap.id,
        mode: 'online',
        status: snap.result ? 'over' : 'playing',
        startFen: START_FEN,
        plies,
        viewPly: wasLive || gameChanged ? plies.length : s.viewPly,
        result: snap.result,
        meta: { white: seat(snap.white), black: seat(snap.black), tc: snap.tc, startedAt: s.mode === 'online' && s.id === snap.id ? s.meta.startedAt : Date.now() },
        clock,
        orientation: gameChanged ? (snap.you ?? 'w') : s.orientation,
        pendingUci: moves === current ? s.pendingUci : null,
        lastMoveDragged: newOpponentMove ? false : s.lastMoveDragged,
        hint: null,
        review: gameChanged ? null : s.review,
      });
      if (newOpponentMove && !justEnded) playSound(soundForMove(plies.at(-1)!));
      if (justEnded) {
        playSound('end');
        if (snap.you && plies.length > 0) {
          const entry: ArchivedGame = {
            id: `${snap.id}-${plies.length}-${Date.now()}`,
            mode: 'online',
            meta: get().meta,
            startFen: START_FEN,
            moves: plies.map((p) => p.uci),
            result: snap.result!,
            endedAt: Date.now(),
          };
          const nextArchive = [entry, ...get().archive].slice(0, ARCHIVE_LIMIT);
          save(ARCHIVE_KEY, nextArchive);
          set({ archive: nextArchive });
        }
      }
    },

    deleteArchived: (id) => {
      const next = get().archive.filter((g) => g.id !== id);
      save(ARCHIVE_KEY, next);
      set({ archive: next });
    },
  };
});

// Persist the in-progress game so a refresh (very common on phones) doesn't lose it.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useGame.subscribe((s, prev) => {
  if (s.plies === prev.plies && s.status === prev.status && s.result === prev.result && s.orientation === prev.orientation && s.clock === prev.clock) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const g = useGame.getState();
    if (g.mode === 'online') return;
    const data: SavedCurrent = {
      id: g.id,
      mode: g.mode,
      status: g.status,
      startFen: g.startFen,
      moves: g.plies.map((p) => p.uci),
      result: g.result,
      meta: g.meta,
      clock: g.clock,
      orientation: g.orientation,
    };
    save(CURRENT_KEY, data);
  }, 250);
});

/** Is it this client's turn to move right now (and is the board showing the live position)? */
export function canMove(s: GameState): boolean {
  if (s.status !== 'playing') return false;
  if (s.mode === 'analysis') return true;
  if (s.viewPly !== s.plies.length) return false;
  const turn = sideToMove(fenAt(s.startFen, s.plies, s.plies.length));
  if (s.mode === 'bot') return turn === s.meta.humanSide;
  if (s.mode === 'online') return false; // decided by the online store (needs seat info)
  return true;
}

import { useEffect, useRef, useState } from 'react';
import { chooseBotMove } from '../engine/bots';
import { getAnalysisEngine, whitePov, type EngineLine } from '../engine/stockfish';
import { fenAt, sideToMove } from '../lib/game';
import { parseUci } from '../../shared/rules';
import { playSound } from '../lib/sound';
import { clockRemaining, useGame } from '../store/game';
import type { MoveInput, Square } from '../lib/types';

/** Drives the computer opponent: thinks off-thread and plays when it's its turn. */
export function useBotOpponent() {
  const mode = useGame((s) => s.mode);
  const status = useGame((s) => s.status);
  const plyCount = useGame((s) => s.plies.length);
  const gameId = useGame((s) => s.id);
  const humanSide = useGame((s) => s.meta.humanSide);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (mode !== 'bot' || status !== 'playing') return;
    const s = useGame.getState();
    const fen = fenAt(s.startFen, s.plies, s.plies.length);
    const botSide = humanSide === 'w' ? 'b' : 'w';
    if (sideToMove(fen) !== botSide) return;

    const ctrl = new AbortController();
    const started = Date.now();
    setThinking(true);
    const clockMs = s.clock ? clockRemaining(s.clock, botSide, botSide) : null;
    const fast = s.meta.tc.initial > 0 && s.meta.tc.initial <= 180;
    const minDelay = fast ? 150 : 450 + Math.random() * 400; // feels human, not instant

    chooseBotMove(fen, s.meta.botLevel ?? 4, clockMs, ctrl.signal)
      .then(async (bm) => {
        if (!bm || ctrl.signal.aborted) return;
        const wait = minDelay - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (ctrl.signal.aborted) return;
        const parsed = parseUci(bm.uci);
        if (parsed) useGame.getState().move(parsed as MoveInput, { botEval: bm.evalCp });
      })
      .catch((err) => console.error('[bot]', err))
      .finally(() => {
        if (!ctrl.signal.aborted) setThinking(false);
      });

    return () => {
      ctrl.abort();
      setThinking(false);
    };
  }, [mode, status, plyCount, gameId, humanSide]);

  return thinking;
}

/** Re-renders every 100ms while a clock runs; flags the side to move when its time is up (offline modes). */
export function useClockTick() {
  const clock = useGame((s) => s.clock);
  const status = useGame((s) => s.status);
  const [now, setNow] = useState(Date.now());
  const lowTimeBeeped = useRef<string | null>(null);

  useEffect(() => {
    if (!clock || clock.turnStartedAt === null || status !== 'playing') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = useGame.getState();
      if (!s.clock || s.clock.turnStartedAt === null) return;
      const turn = sideToMove(fenAt(s.startFen, s.plies, s.plies.length));
      const left = clockRemaining(s.clock, turn, turn, t);
      const key = `${s.id}-${turn}`;
      if (left < 10_000 && s.meta.tc.initial >= 60 && lowTimeBeeped.current !== key) {
        lowTimeBeeped.current = key;
        playSound('lowtime');
      }
      if (left <= 0 && s.mode !== 'online') s.flag(turn);
    }, 100);
    return () => clearInterval(id);
  }, [clock, status]);

  return now;
}

export interface LiveAnalysis {
  lines: EngineLine[]; // White-POV scores
  depth: number;
  fen: string;
}

/** Continuous engine analysis of `fen` (eval bar + top lines). Cancels when the position changes. */
export function useLiveAnalysis(fen: string, enabled: boolean, multipv = 3, depth = 20): LiveAnalysis | null {
  const [state, setState] = useState<LiveAnalysis | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    const ctrl = new AbortController();
    let lastPush = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Small debounce so scrubbing through moves doesn't queue dozens of searches.
    const start = setTimeout(() => {
      void getAnalysisEngine()
        .search({
          fen,
          depth,
          multipv,
          options: { 'UCI_LimitStrength': false, 'Skill Level': 20 },
          signal: ctrl.signal,
          onInfo: (lines) => {
            const push = () => {
              lastPush = Date.now();
              setState({ fen, depth: lines[0]?.depth ?? 0, lines: lines.map((l) => ({ ...l, score: whitePov(l.score, fen) })) });
            };
            if (Date.now() - lastPush > 150) push();
            else {
              if (timer) clearTimeout(timer);
              timer = setTimeout(push, 150);
            }
          },
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      clearTimeout(start);
      if (timer) clearTimeout(timer);
      ctrl.abort();
    };
  }, [fen, enabled, multipv, depth]);

  return state && state.fen === fen ? state : null;
}

/** Keyboard: ←/→ step, ↑/Home first, ↓/End last, F flip. */
export function useKeyboardNav(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useGame.getState();
      switch (e.key) {
        case 'ArrowLeft': s.goTo(s.viewPly - 1); break;
        case 'ArrowRight': s.goTo(s.viewPly + 1); break;
        case 'ArrowUp': case 'Home': s.goTo(0); break;
        case 'ArrowDown': case 'End': s.goTo(s.plies.length); break;
        case 'f': case 'F': s.flip(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Ask the engine for the best move in a position (used by the Hint button). */
export async function findHint(fen: string): Promise<{ from: Square; to: Square } | null> {
  const res = await getAnalysisEngine().search({ fen, depth: 14, options: { 'UCI_LimitStrength': false, 'Skill Level': 20 } });
  const parsed = res?.bestmove ? parseUci(res.bestmove) : null;
  return parsed ? { from: parsed.from as Square, to: parsed.to as Square } : null;
}

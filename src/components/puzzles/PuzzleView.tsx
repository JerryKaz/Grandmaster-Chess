import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Check, Eye, Flame, Lightbulb, Loader2, Microscope, RotateCcw, Target, X } from 'lucide-react';
import { Chess } from 'chess.js';
import Board from '../board/Board';
import { parseUci } from '../../../shared/rules';
import { kingInCheckSquare, toPly } from '../../lib/game';
import { PUZZLE_THEMES, themeLabels } from '../../lib/puzzles';
import type { MoveInput, Square } from '../../lib/types';
import { useGame } from '../../store/game';
import { puzzleFen, usePuzzles } from '../../store/puzzles';
import { useUi } from '../../store/ui';
import { Button, IconButton, Label, Segmented, cx } from '../ui/kit';
import { ArrowUpDown } from 'lucide-react';

function StatusBanner() {
  const status = usePuzzles((s) => s.status);
  const orientation = usePuzzles((s) => s.orientation);
  const result = usePuzzles((s) => s.result);
  const mode = usePuzzles((s) => s.mode);
  const streakOver = usePuzzles((s) => s.streakOver);
  const side = orientation === 'w' ? 'White' : 'Black';

  const content: Record<string, { icon: React.ReactNode; text: string; tone: string }> = {
    loading: { icon: <Loader2 size={18} className="animate-spin" />, text: 'Loading puzzle…', tone: 'bg-white/8 text-zinc-300' },
    setup: { icon: <Loader2 size={18} className="animate-spin" />, text: 'Watch your opponent’s move…', tone: 'bg-white/8 text-zinc-300' },
    solving: { icon: <Target size={18} />, text: `Your turn — find the best move for ${side}`, tone: 'bg-white/8 text-white' },
    reply: { icon: <Check size={18} />, text: 'Correct! Keep going…', tone: 'bg-emerald-500/15 text-emerald-200' },
    wrong: {
      icon: <X size={18} />,
      text: mode === 'streak' && streakOver ? 'Wrong move — streak over' : 'That’s not the move. Try again?',
      tone: 'bg-rose-500/15 text-rose-200',
    },
    solved: { icon: <Check size={18} />, text: result === 'win' ? 'Solved!' : 'Solved — but it won’t count this time', tone: 'bg-emerald-500/15 text-emerald-200' },
    solution: { icon: <Eye size={18} />, text: 'Here’s the solution', tone: 'bg-amber-500/15 text-amber-100' },
    error: { icon: <X size={18} />, text: 'Couldn’t load puzzles. Check your connection.', tone: 'bg-rose-500/15 text-rose-200' },
  };
  const c = content[status];
  return (
    <div className={cx('flex min-h-12 items-center gap-2.5 rounded-xl px-4 py-2 text-sm font-semibold', c.tone)} role="status" aria-live="polite">
      {c.icon}
      <span>{c.text}</span>
    </div>
  );
}

function Actions() {
  const s = usePuzzles();
  const done = s.status === 'solved' || s.status === 'solution' || (s.status === 'wrong' && s.mode === 'streak' && s.streakOver);
  return (
    <div className="flex items-center gap-2">
      <IconButton label="Flip board" onClick={() => usePuzzles.setState({ orientation: s.orientation === 'w' ? 'b' : 'w' })}>
        <ArrowUpDown size={20} />
      </IconButton>
      <div className="flex flex-1 justify-end gap-2">
        {s.status === 'solving' && s.mode === 'rated' && (
          <Button onClick={s.hint} disabled={!!s.hintSquare} title="Using a hint counts as a miss">
            <Lightbulb size={16} /> Hint
          </Button>
        )}
        {s.status === 'wrong' && !(s.mode === 'streak' && s.streakOver) && (
          <Button onClick={s.retry}>
            <RotateCcw size={16} /> Retry
          </Button>
        )}
        {(s.status === 'wrong' || s.status === 'solving') && s.mode === 'rated' && (
          <Button variant="ghost" onClick={s.showSolution}>
            <Eye size={16} /> Solution
          </Button>
        )}
        {(done || s.status === 'wrong' || s.status === 'error') && !(s.mode === 'streak' && s.status === 'solved') && (
          <Button variant="primary" onClick={() => void s.next()}>
            {s.mode === 'streak' && s.streakOver ? 'New streak' : 'Next'} <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

function SidePanel() {
  const s = usePuzzles();
  const analyse = () => {
    if (!s.puzzle) return;
    // Open the puzzle (with full solution) on the analysis board.
    const chess = new Chess(s.puzzle.fen);
    const plies = s.puzzle.moves.map((u) => toPly(chess.move(parseUci(u)!)));
    useGame.getState().startAnalysis({ startFen: s.puzzle.fen, plies, meta: { white: 'Puzzle', black: s.puzzle.id, humanSide: s.orientation } });
    useGame.getState().goTo(1);
    useUi.getState().setView('play');
  };
  const finished = s.status === 'solved' || s.status === 'solution' || s.result !== null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Segmented
        value={s.mode}
        onChange={s.setMode}
        options={[
          { value: 'rated', label: <span className="flex items-center justify-center gap-1.5"><Target size={15} />Rated</span> },
          { value: 'streak', label: <span className="flex items-center justify-center gap-1.5"><Flame size={15} />Streak</span> },
        ]}
      />

      {s.mode === 'rated' ? (
        <div className="flex items-end justify-between rounded-xl bg-black/25 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Puzzle rating</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-white">{s.progress.rating}</span>
              {s.delta !== null && (
                <span className={cx('text-lg font-bold tabular-nums', s.delta >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {s.delta >= 0 ? '+' : ''}
                  {s.delta}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div><span className="font-semibold text-emerald-400">{s.progress.solved}</span> solved</div>
            <div><span className="font-semibold text-rose-400">{s.progress.failed}</span> missed</div>
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-between rounded-xl bg-black/25 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Current streak</div>
            <div className="flex items-center gap-2 text-4xl font-bold tabular-nums text-white">
              <Flame className={s.streak > 0 ? 'text-orange-400' : 'text-zinc-600'} size={30} />
              {s.streak}
            </div>
          </div>
          <div className="text-right text-xs text-zinc-400">
            Best <span className="font-semibold text-white">{s.progress.bestStreak}</span>
            <div className="mt-1 max-w-[11rem] text-[11px]">Puzzles get harder. One mistake ends the run.</div>
          </div>
        </div>
      )}

      {s.mode === 'rated' && (
        <div>
          <Label>Theme</Label>
          <select
            value={s.theme}
            onChange={(e) => s.setTheme(e.target.value)}
            className="h-11 w-full rounded-lg bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-emerald-400"
          >
            {PUZZLE_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {s.puzzle && finished && (
        <div className="rounded-xl bg-black/20 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Puzzle <span className="font-mono text-zinc-300">#{s.puzzle.id}</span></span>
            <span className="font-semibold text-white">Rated {s.puzzle.rating}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {themeLabels(s.puzzle.themes).map((t) => (
              <span key={t} className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-zinc-300">{t}</span>
            ))}
          </div>
          <Button variant="ghost" className="mt-2 w-full" onClick={analyse}>
            <Microscope size={16} /> Analyse this puzzle
          </Button>
        </div>
      )}

      {s.history.length > 0 && (
        <div>
          <Label>This session</Label>
          <div className="flex flex-wrap gap-1.5">
            {s.history.map((h, i) => (
              <span
                key={`${h.id}-${i}`}
                className={cx('flex h-6 w-6 items-center justify-center rounded-md text-white', h.win ? 'bg-emerald-600' : 'bg-rose-600')}
                title={`#${h.id}`}
              >
                {h.win ? <Check size={14} /> : <X size={14} />}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">Puzzles from the Lichess open database (CC0).</p>
    </div>
  );
}

export function PuzzleView() {
  const s = usePuzzles();
  const started = useRef(false);

  useEffect(() => {
    if (!started.current && !s.puzzle) {
      started.current = true;
      void s.next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fen = puzzleFen(s) ?? new Chess().fen();
  const lastUci = s.line.at(-1);
  const last = lastUci ? parseUci(lastUci) : null;
  const lastMove = last ? { from: last.from as Square, to: last.to as Square } : null;
  const animateMove = useMemo(() => {
    if (!s.puzzle || !lastUci || s.lastMoveDragged) return null;
    const c = new Chess(s.puzzle.fen);
    for (const u of s.line.slice(0, -1)) c.move(parseUci(u)!);
    const m = c.move(parseUci(lastUci)!);
    return { from: m.from, to: m.to, flags: m.flags, color: m.color };
  }, [s.puzzle, s.line, lastUci, s.lastMoveDragged]);

  const marker =
    lastMove && s.status === 'wrong'
      ? { square: lastMove.to, cls: 'blunder' as const }
      : lastMove && (s.status === 'reply' || s.status === 'solved')
        ? { square: lastMove.to, cls: 'best' as const }
        : null;

  return (
    <>
      <div className="board-col flex flex-col gap-2">
        <div className="pt-1.5">
          <StatusBanner />
        </div>
        <Board
          fen={fen}
          orientation={s.orientation}
          interactive={s.status === 'solving'}
          lastMove={lastMove}
          animate={animateMove}
          check={kingInCheckSquare(fen)}
          marker={marker}
          highlights={s.hintSquare ? [{ square: s.hintSquare, color: 'rgba(56, 132, 255, 0.55)' }] : []}
          onMove={(m: MoveInput & { dragged: boolean }) => s.move({ from: m.from, to: m.to, promotion: m.promotion }, m.dragged)}
        />
        <div className="rounded-xl bg-zinc-800/80 p-1.5 ring-1 ring-white/5">
          <Actions />
        </div>
      </div>
      <aside className="side-panel flex w-full flex-col overflow-hidden rounded-xl bg-zinc-800/80 ring-1 ring-white/5 lg:w-[380px]">
        <SidePanel />
      </aside>
    </>
  );
}

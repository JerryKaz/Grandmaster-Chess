import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, History, Microscope, Play, Puzzle, Settings } from 'lucide-react';
import Board, { type Arrow } from './components/board/Board';
import { preloadPieces } from './components/board/pieces';
import { ArchiveDialog } from './components/dialogs/ArchiveDialog';
import { GameOverDialog } from './components/dialogs/GameOverDialog';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { EvalBar } from './components/game/EvalBar';
import { MoveStrip } from './components/game/MoveList';
import { PlayerBar } from './components/game/PlayerBar';
import { Toolbar } from './components/game/Toolbar';
import { AnalysisPanel } from './components/panels/AnalysisPanel';
import { GamePanel } from './components/panels/GamePanel';
import { NewGamePanel } from './components/panels/NewGamePanel';
import { cx, IconButton } from './components/ui/kit';
import { useBotOpponent, useClockTick, useKeyboardNav, useLiveAnalysis } from './hooks/useGameHooks';
import { getBotLevel } from './engine/bots';
import { fenAt, kingInCheckSquare, materialInfo, sideToMove } from './lib/game';
import { parseUci } from '../shared/rules';
import { scoreToCp } from './lib/review';
import type { MoveInput, Side, Square } from './lib/types';
import { canMove, clockRemaining, useGame } from './store/game';
import { canMoveOnline, initOnline, useOnline } from './store/online';
import { useSettings } from './store/settings';
import { toast, useUi } from './store/ui';
import { useAuth } from './store/auth';
import { initSync } from './store/sync';
import { PuzzleView } from './components/puzzles/PuzzleView';
import { AccountDialog, Avatar } from './components/dialogs/AccountDialog';
import { InstallPrompt } from './components/InstallPrompt';

/** Leaving the board mid-game would let a clock run out unseen, so only allow it for untimed offline games. */
function canLeaveGame(): boolean {
  const g = useGame.getState();
  if (g.status !== 'playing' || g.mode === 'analysis') return true;
  if (g.mode === 'online' || g.clock) {
    toast('Finish or resign your current game first');
    return false;
  }
  return true;
}

function Header({ onArchive, onAccount }: { onArchive: () => void; onAccount: () => void }) {
  const mode = useGame((s) => s.mode);
  const status = useGame((s) => s.status);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const authReady = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const navBtn = (active: boolean) =>
    cx('flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm sm:gap-2 sm:px-3 font-semibold transition', active ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/8 hover:text-white');

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-900/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 lg:px-6">
        <button
          type="button"
          className="mr-1 flex shrink-0 items-center gap-2 sm:mr-2"
          onClick={() => {
            setView('play');
            if (useGame.getState().status !== 'playing') useGame.getState().showSetup();
          }}
          aria-label="Grandmaster Chess home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-[0_2px_0_#047857]">
            <Crown size={18} />
          </span>
          <span className="hidden text-base font-bold tracking-tight text-white sm:inline">Grandmaster</span>
        </button>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            className={navBtn(view === 'play' && mode !== 'analysis')}
            aria-label="Play"
            onClick={() => {
              setView('play');
              if (!(status === 'playing' && mode !== 'analysis')) useGame.getState().showSetup();
            }}
          >
            <Play size={16} /> <span className="max-[440px]:hidden">Play</span>
          </button>
          <button
            type="button"
            className={navBtn(view === 'puzzles')}
            aria-label="Puzzles"
            onClick={() => canLeaveGame() && setView('puzzles')}
          >
            <Puzzle size={16} /> <span className="max-[440px]:hidden">Puzzles</span>
          </button>
          <button
            type="button"
            className={navBtn(view === 'play' && mode === 'analysis')}
            aria-label="Analysis"
            onClick={() => {
              setView('play');
              const s = useGame.getState();
              if (s.mode === 'analysis') return;
              if (s.mode === 'online' && s.status === 'playing') return;
              // Analyse the current game if there is one, otherwise open an empty board.
              const keep = s.status !== 'setup' && s.plies.length > 0;
              s.startAnalysis(keep ? { startFen: s.startFen, plies: s.plies, meta: s.meta } : {});
              if (keep) useGame.setState({ result: s.result });
            }}
          >
            <Microscope size={16} /> <span className="max-[440px]:hidden">Analysis</span>
          </button>
        </nav>
        <IconButton label="Your games" onClick={onArchive}><History size={20} /></IconButton>
        <IconButton label="Settings" onClick={() => useUi.getState().setSettingsOpen(true)}><Settings size={20} /></IconButton>
        {authReady && (
          <IconButton label={user ? 'Your account' : 'Sign in'} onClick={onAccount} className="ml-0.5">
            <Avatar size={30} />
          </IconButton>
        )}
      </div>
    </header>
  );
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="animate-sheet rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">{t.text}</div>
      ))}
    </div>
  );
}

export default function App() {
  const mode = useGame((s) => s.mode);
  const status = useGame((s) => s.status);
  const plies = useGame((s) => s.plies);
  const viewPly = useGame((s) => s.viewPly);
  const startFen = useGame((s) => s.startFen);
  const orientation = useGame((s) => s.orientation);
  const meta = useGame((s) => s.meta);
  const clock = useGame((s) => s.clock);
  const hint = useGame((s) => s.hint);
  const review = useGame((s) => s.review);
  const reviewProgress = useGame((s) => s.reviewProgress);
  const lastMoveDragged = useGame((s) => s.lastMoveDragged);
  const room = useOnline((s) => s.room);
  const evalInBotGames = useSettings((s) => s.evalInBotGames);
  const view = useUi((s) => s.view);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [engineOn, setEngineOn] = useState(true);

  useEffect(() => {
    preloadPieces();
    initSync();
    void useAuth.getState().init();
    initOnline();
  }, []);
  useKeyboardNav(view === 'play');

  // A new game should start with the whole board in view (the Play button sits below the fold on phones).
  const gameId = useGame((s) => s.id);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [gameId]);
  const botThinking = useBotOpponent();
  const now = useClockTick();

  const fen = fenAt(startFen, plies, viewPly);
  const liveFen = fenAt(startFen, plies, plies.length);
  const liveTurn = sideToMove(liveFen);

  // Interactivity is derived from whole-store state; subscribe to what matters.
  const interactive = useGame((s) => (s.mode === 'online' ? canMoveOnline() : canMove(s))) && (mode !== 'online' || !!room);

  const evalVisible = mode === 'analysis' ? engineOn : (mode === 'bot' || mode === 'local') && status === 'playing' && evalInBotGames;
  const analysis = useLiveAnalysis(fen, evalVisible && reviewProgress === null);

  // Slide animation only when stepping forward by exactly one move and the user didn't drag it.
  const prevView = useRef(viewPly);
  const stepForward = viewPly === prevView.current + 1;
  useEffect(() => {
    prevView.current = viewPly;
  }, [viewPly]);
  const lastPly = viewPly > 0 ? plies[viewPly - 1] : null;
  const animate = lastPly && stepForward && !(lastMoveDragged && viewPly === plies.length) ? lastPly : null;

  const arrows = useMemo<Arrow[]>(() => {
    const list: Arrow[] = [];
    if (hint && viewPly === plies.length) list.push({ from: hint.from, to: hint.to, color: 'rgba(56, 132, 255, 0.85)' });
    if (review && viewPly > 0) {
      const cls = review.classes[viewPly - 1];
      const best = review.best[viewPly - 1];
      const p = best && parseUci(best);
      if (p && cls !== 'best' && cls !== 'book') list.push({ from: p.from as Square, to: p.to as Square, color: 'rgba(129, 182, 76, 0.85)' });
    } else if (mode === 'analysis' && analysis?.lines[0]?.pv[0]) {
      const p = parseUci(analysis.lines[0].pv[0]);
      if (p) list.push({ from: p.from as Square, to: p.to as Square, color: 'rgba(255, 170, 0, 0.75)' });
    }
    return list;
  }, [hint, review, viewPly, plies.length, mode, analysis]);

  const material = useMemo(() => materialInfo(fen), [fen]);
  const check = useMemo(() => kingInCheckSquare(fen), [fen]);

  const onMove = (m: MoveInput & { dragged: boolean }) => {
    const { dragged, ...input } = m;
    if (useGame.getState().mode === 'online') useOnline.getState().sendMove(input);
    else useGame.getState().move(input, { dragged });
  };

  const topEval = analysis?.lines[0];
  const evalCp = topEval ? scoreToCp(topEval.score) : review ? review.evals[viewPly] ?? null : null;
  const evalMate = topEval ? topEval.score.mate ?? null : review ? review.mates[viewPly] ?? null : null;

  const bar = (side: Side) => {
    const name = side === 'w' ? meta.white : meta.black;
    const isBot = status !== 'setup' && mode === 'bot' && meta.humanSide !== side;
    const you = mode === 'online' && room?.you === side;
    const seat = side === 'w' ? room?.white : room?.black;
    return (
      <PlayerBar
        side={side}
        name={status === 'setup' ? (side === orientation ? 'You' : 'Opponent') : name}
        subtitle={
          mode === 'online' && seat
            ? [seat.rating !== null ? String(seat.rating) : null, you ? '(you)' : null].filter(Boolean).join(' ')
            : isBot
              ? getBotLevel(meta.botLevel).elo
              : undefined
        }
        isBot={isBot}
        captured={material.captured[side]}
        advantage={side === 'w' ? material.diff : -material.diff}
        clockMs={clock && status !== 'setup' ? clockRemaining(clock, side, liveTurn, now) : null}
        clockActive={!!clock && clock.turnStartedAt !== null && status === 'playing' && liveTurn === side}
        thinking={isBot && botThinking}
        connected={mode === 'online' && seat ? seat.connected : null}
        verified={mode === 'online' && !!seat?.verified}
        toMove={status === 'playing' && liveTurn === side}
      />
    );
  };

  const setup = status === 'setup';

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-900 text-zinc-100">
      <Header onArchive={() => setArchiveOpen(true)} onAccount={() => setAccountOpen(true)} />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center gap-3 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 lg:flex-row lg:items-start lg:justify-center lg:gap-6 lg:px-6 lg:pt-4">
        {view === 'puzzles' ? (
          <PuzzleView />
        ) : (
          <>
            <div className={cx('board-col flex flex-col', setup && 'board-col--setup')}>
              {bar(orientation === 'w' ? 'b' : 'w')}
              <div className="flex gap-1.5 sm:gap-2">
                {evalVisible && <EvalBar cp={evalCp} mate={evalMate} orientation={orientation} loading={!analysis} />}
                <div className="min-w-0 flex-1">
                  <Board
                    fen={fen}
                    orientation={orientation}
                    interactive={interactive}
                    lastMove={lastPly}
                    animate={animate}
                    check={check}
                    arrows={arrows}
                    marker={review && lastPly && review.classes[viewPly - 1] ? { square: lastPly.to, cls: review.classes[viewPly - 1] } : null}
                    onMove={onMove}
                  />
                </div>
              </div>
              {bar(orientation)}
              {!setup && (
                <>
                  <Toolbar />
                  <div className="mt-2 rounded-xl bg-zinc-800/80 ring-1 ring-white/5 lg:hidden">
                    <MoveStrip
                      plies={plies}
                      viewPly={viewPly}
                      firstMoveNumber={Number(startFen.split(' ')[5]) || 1}
                      blackFirst={sideToMove(startFen) === 'b'}
                      classes={review?.classes}
                      onSelect={(p) => useGame.getState().goTo(p)}
                    />
                  </div>
                </>
              )}
            </div>

            <aside className="side-panel flex w-full flex-col overflow-hidden rounded-xl bg-zinc-800/80 ring-1 ring-white/5 lg:w-[380px]">
              {setup ? (
                <NewGamePanel />
              ) : mode === 'analysis' ? (
                <AnalysisPanel analysis={analysis} engineOn={engineOn} setEngineOn={setEngineOn} />
              ) : (
                <GamePanel />
              )}
            </aside>
          </>
        )}
      </main>

      <GameOverDialog />
      <SettingsDialog />
      <ArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      <InstallPrompt />
      <Toasts />
    </div>
  );
}

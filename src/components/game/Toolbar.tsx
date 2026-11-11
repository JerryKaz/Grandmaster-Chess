import { useState } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Flag,
  Handshake,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Repeat2,
  Sparkles,
  Undo2,
  ArrowUpDown,
} from 'lucide-react';
import { findHint } from '../../hooks/useGameHooks';
import { fenAt, sideToMove } from '../../lib/game';
import { useGame } from '../../store/game';
import { useOnline } from '../../store/online';
import { startReview } from '../../store/reviewRunner';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/ui';
import { Button, Dialog, IconButton } from '../ui/kit';

type Confirm = { title: string; body: string; action: string; run: () => void } | null;

export function Toolbar() {
  const mode = useGame((s) => s.mode);
  const status = useGame((s) => s.status);
  const viewPly = useGame((s) => s.viewPly);
  const total = useGame((s) => s.plies.length);
  const humanSide = useGame((s) => s.meta.humanSide);
  const room = useOnline((s) => s.room);
  const confirmResign = useSettings((s) => s.confirmResign);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [hinting, setHinting] = useState(false);

  const g = useGame.getState;
  const playing = status === 'playing';
  const live = viewPly === total;
  const turn = sideToMove(fenAt(g().startFen, g().plies, total));

  const ask = (c: NonNullable<Confirm>) => (confirmResign ? setConfirm(c) : c.run());

  const resign = () => {
    if (mode === 'online') return ask({ title: 'Resign?', body: 'Your opponent will be awarded the win.', action: 'Resign', run: () => useOnline.getState().resign() });
    const side = mode === 'bot' ? humanSide! : turn;
    ask({ title: 'Resign?', body: mode === 'local' ? `${side === 'w' ? 'White' : 'Black'} resigns.` : 'The computer will be awarded the win.', action: 'Resign', run: () => g().resign(side) });
  };

  const draw = () => {
    if (mode === 'online') {
      useOnline.getState().draw('offer');
      toast('Draw offered');
      return;
    }
    if (mode === 'local') return ask({ title: 'Agree a draw?', body: 'Both players agree to end the game as a draw.', action: 'Draw', run: () => g().agreeDraw() });
    // Bot: accepts only if it isn't better and the game has gone on a while.
    const s = g();
    const botSide = s.meta.humanSide === 'w' ? 'b' : 'w';
    const botAdv = s.botEval === null ? 0 : botSide === 'w' ? s.botEval : -s.botEval;
    if (s.plies.length >= 30 && botAdv <= 30) {
      s.agreeDraw();
    } else toast('The computer declines your draw offer');
  };

  const hint = async () => {
    const s = g();
    setHinting(true);
    try {
      const h = await findHint(fenAt(s.startFen, s.plies, s.plies.length));
      if (h && g().plies.length === s.plies.length) g().setHint(h);
    } catch {
      toast('Engine unavailable');
    } finally {
      setHinting(false);
    }
  };

  const nav = (
    <div className="flex items-center">
      <IconButton label="First move" className="max-sm:hidden" onClick={() => g().goTo(0)} disabled={viewPly === 0}><ChevronFirst size={22} /></IconButton>
      <IconButton label="Previous move" onClick={() => g().goTo(viewPly - 1)} disabled={viewPly === 0}><ChevronLeft size={24} /></IconButton>
      <IconButton label="Next move" onClick={() => g().goTo(viewPly + 1)} disabled={live}><ChevronRight size={24} /></IconButton>
      <IconButton label="Last move" className="max-sm:hidden" onClick={() => g().goTo(total)} disabled={live}><ChevronLast size={22} /></IconButton>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-zinc-800/80 px-1 ring-1 ring-white/5">
      <div className="flex items-center">
        <IconButton label="Flip board" onClick={() => g().flip()}><ArrowUpDown size={20} /></IconButton>

        {playing && mode === 'bot' && (
          <>
            <IconButton label="Hint" onClick={hint} disabled={hinting || !live || turn !== humanSide}>
              {hinting ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />}
            </IconButton>
            <IconButton label="Take back" onClick={() => g().takeback()} disabled={total === 0}><Undo2 size={20} /></IconButton>
          </>
        )}
        {playing && mode === 'local' && (
          <IconButton label="Take back" onClick={() => g().takeback()} disabled={total === 0}><Undo2 size={20} /></IconButton>
        )}
        {playing && mode !== 'analysis' && (mode !== 'online' || room?.you) && (
          <>
            <IconButton label="Offer draw" onClick={draw} disabled={mode === 'online' && (!room?.white || !room?.black || room?.drawOffer === room?.you)}><Handshake size={20} /></IconButton>
            <IconButton label="Resign" onClick={resign} disabled={mode === 'online' && (!room?.white || !room?.black)}><Flag size={20} /></IconButton>
          </>
        )}

        {status === 'over' && mode !== 'analysis' && (
          <>
            <IconButton label="Game review" onClick={() => void startReview()} disabled={total === 0} className="text-emerald-300"><Sparkles size={20} /></IconButton>
            {mode === 'online' ? (
              <IconButton label="Rematch" onClick={() => useOnline.getState().rematch()} disabled={room?.rematchOffer === room?.you}><Repeat2 size={20} /></IconButton>
            ) : (
              <IconButton label="Rematch" onClick={() => rematch()}><RefreshCw size={20} /></IconButton>
            )}
          </>
        )}
        {(status === 'over' || mode === 'analysis') && (
          <IconButton label="New game" onClick={() => (mode === 'online' ? useOnline.getState().leave() : g().showSetup())}><Plus size={22} /></IconButton>
        )}
      </div>
      {nav}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title}>
        <p className="text-sm text-zinc-300">{confirm?.body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              confirm?.run();
              setConfirm(null);
            }}
          >
            {confirm?.action}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Same opponent and time control, colours swapped. */
export function rematch() {
  const s = useGame.getState();
  if (s.mode === 'bot') s.startBotGame(s.meta.botLevel ?? 4, s.meta.humanSide === 'w' ? 'b' : 'w', s.meta.tc);
  else if (s.mode === 'local') s.startLocalGame(s.meta.tc);
}

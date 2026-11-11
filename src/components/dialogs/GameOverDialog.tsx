import { useEffect, useRef, useState } from 'react';
import { Download, Plus, RefreshCw, Repeat2, Sparkles, Trophy } from 'lucide-react';
import { describeResult } from '../../../shared/rules';
import { useGame } from '../../store/game';
import { useOnline } from '../../store/online';
import { startReview } from '../../store/reviewRunner';
import { downloadPgn } from '../panels/AnalysisPanel';
import { rematch } from '../game/Toolbar';
import { Button, Dialog } from '../ui/kit';

export function GameOverDialog() {
  const status = useGame((s) => s.status);
  const result = useGame((s) => s.result);
  const mode = useGame((s) => s.mode);
  const gameId = useGame((s) => s.id);
  const plyCount = useGame((s) => s.plies.length);
  const humanSide = useGame((s) => s.meta.humanSide);
  const room = useOnline((s) => s.room);
  const [open, setOpen] = useState(false);
  const shownFor = useRef<string | null>(null);

  // Open once per finished game (not when re-opening an archived game).
  useEffect(() => {
    const key = `${gameId}-${plyCount}`;
    if (status === 'over' && result && mode !== 'analysis' && shownFor.current !== key) {
      shownFor.current = key;
      const t = setTimeout(() => setOpen(true), 450); // let the final move land first
      return () => clearTimeout(t);
    }
    if (status !== 'over') setOpen(false);
  }, [status, result, mode, gameId, plyCount]);

  if (!result) return null;
  const me = mode === 'bot' ? humanSide : mode === 'online' ? room?.you ?? null : null;
  const headline =
    result.winner === null ? 'Draw' : me ? (result.winner === me ? 'You won!' : 'You lost') : `${result.winner === 'w' ? 'White' : 'Black'} wins`;
  const iWon = me !== null && me !== undefined && result.winner === me;

  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <div className="flex flex-col items-center text-center">
        <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full ${iWon ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-zinc-200'}`}>
          <Trophy size={28} />
        </div>
        <h2 className="text-2xl font-bold text-white">{headline}</h2>
        <p className="mt-1 text-sm text-zinc-400">{describeResult(result)}</p>
        {mode === 'online' && room?.you && room.ratingChange && (
          <p className="mt-3 rounded-full bg-black/30 px-4 py-1.5 text-sm font-semibold text-white">
            Rating{' '}
            <span className={room.ratingChange[room.you] >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {room.ratingChange[room.you] >= 0 ? '+' : ''}
              {room.ratingChange[room.you]}
            </span>
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant="primary"
          className="min-h-12"
          disabled={plyCount < 2}
          onClick={() => {
            setOpen(false);
            void startReview();
          }}
        >
          <Sparkles size={18} /> Game review
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {mode === 'online' ? (
            <Button onClick={() => useOnline.getState().rematch()} disabled={room?.rematchOffer === room?.you}>
              <Repeat2 size={18} /> {room?.rematchOffer && room.rematchOffer !== room.you ? 'Accept rematch' : room?.rematchOffer === room?.you ? 'Rematch sent' : 'Rematch'}
            </Button>
          ) : (
            <Button onClick={() => { setOpen(false); rematch(); }}>
              <RefreshCw size={18} /> Rematch
            </Button>
          )}
          <Button
            onClick={() => {
              setOpen(false);
              if (mode === 'online') useOnline.getState().leave();
              else useGame.getState().showSetup();
            }}
          >
            <Plus size={18} /> New game
          </Button>
        </div>
        <Button variant="ghost" onClick={downloadPgn}>
          <Download size={16} /> Download PGN
        </Button>
      </div>
    </Dialog>
  );
}

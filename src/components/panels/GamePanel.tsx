import { useMemo, useState } from 'react';
import { Check, Copy, Handshake, Share2, X, Loader2 } from 'lucide-react';
import { detectOpening } from '../../lib/openings';
import { sideToMove } from '../../lib/game';
import { useGame } from '../../store/game';
import { inviteLink, useOnline } from '../../store/online';
import { getBotLevel } from '../../engine/bots';
import { describeResult } from '../../../shared/rules';
import { MoveTable } from '../game/MoveList';
import { Button } from '../ui/kit';

export function OpeningLabel() {
  const plies = useGame((s) => s.plies);
  const viewPly = useGame((s) => s.viewPly);
  const startFen = useGame((s) => s.startFen);
  const opening = useMemo(() => {
    if (!startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) return null;
    return detectOpening(plies.slice(0, viewPly).map((p) => p.san));
  }, [plies, viewPly, startFen]);
  if (!opening) return null;
  return (
    <div className="truncate text-xs text-zinc-400" title={opening.name}>
      <span className="font-mono text-zinc-500">{opening.eco}</span> · {opening.name}
    </div>
  );
}

function ModeTitle() {
  const mode = useGame((s) => s.mode);
  const meta = useGame((s) => s.meta);
  const room = useOnline((s) => s.room);
  const tc = meta.tc.initial > 0 ? `${meta.tc.initial / 60}${meta.tc.increment ? ` | ${meta.tc.increment}` : ' min'}` : 'Unlimited';
  const title =
    mode === 'bot' ? `vs ${getBotLevel(meta.botLevel).name}` : mode === 'local' ? 'Pass & play' : mode === 'online' ? `Online · ${room?.id ?? ''}` : 'Analysis';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="font-semibold text-white">{title}</h2>
      {mode !== 'analysis' && <span className="text-xs text-zinc-400">{tc}</span>}
    </div>
  );
}

function InviteCard() {
  const room = useOnline((s) => s.room);
  const [copied, setCopied] = useState(false);
  if (!room || (room.white && room.black)) return null;
  const link = inviteLink(room.id);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Play chess with me', text: `Join my game — code ${room.id}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled share */
    }
  };
  return (
    <div className="rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/30">
      <div className="flex items-center gap-2 text-sm text-emerald-200">
        <Loader2 size={16} className="animate-spin" /> Waiting for your friend to join…
      </div>
      <div className="mt-3 text-center font-mono text-3xl font-bold tracking-[0.35em] text-white">{room.id}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={share}>
          <Share2 size={16} /> Share link
        </Button>
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <button type="button" className="mt-3 w-full text-xs text-zinc-400 underline-offset-2 hover:underline" onClick={() => useOnline.getState().leave()}>
        Cancel game
      </button>
    </div>
  );
}

function DrawOfferBanner() {
  const room = useOnline((s) => s.room);
  if (!room || !room.you || !room.drawOffer || room.result) return null;
  if (room.drawOffer === room.you) return <p className="rounded-lg bg-black/20 px-3 py-2 text-sm text-zinc-300">Draw offer sent.</p>;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 ring-1 ring-amber-400/30">
      <Handshake size={18} className="shrink-0 text-amber-300" />
      <span className="flex-1 text-sm text-amber-100">Opponent offers a draw</span>
      <Button className="min-h-9 px-3" variant="primary" onClick={() => useOnline.getState().draw('accept')}>
        <Check size={16} />
      </Button>
      <Button className="min-h-9 px-3" onClick={() => useOnline.getState().draw('decline')} aria-label="Decline draw">
        <X size={16} />
      </Button>
    </div>
  );
}

export function ResultBanner() {
  const result = useGame((s) => s.result);
  const status = useGame((s) => s.status);
  if (!result || status !== 'over') return null;
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2 text-center text-sm font-semibold text-white">{describeResult(result)}</div>
  );
}

export function GamePanel() {
  const plies = useGame((s) => s.plies);
  const viewPly = useGame((s) => s.viewPly);
  const startFen = useGame((s) => s.startFen);
  const goTo = useGame((s) => s.goTo);
  const firstNo = Number(startFen.split(' ')[5]) || 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div>
        <ModeTitle />
        <OpeningLabel />
      </div>
      <InviteCard />
      <DrawOfferBanner />
      <div className="hidden min-h-0 flex-1 overflow-hidden rounded-lg bg-black/20 lg:flex lg:flex-col">
        <MoveTable plies={plies} viewPly={viewPly} firstMoveNumber={firstNo} blackFirst={sideToMove(startFen) === 'b'} onSelect={goTo} />
      </div>
      <ResultBanner />
    </div>
  );
}

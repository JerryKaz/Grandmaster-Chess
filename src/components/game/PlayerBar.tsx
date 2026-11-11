import { BadgeCheck, Bot, Loader2, User, Wifi, WifiOff } from 'lucide-react';
import type { PieceSymbol, Side } from '../../lib/types';
import { pieceUrl } from '../board/pieces';
import { cx } from '../ui/kit';

function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) return `${Math.floor(total / 1000)}.${Math.floor((total % 1000) / 100)}`;
  const s = Math.ceil(total / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function Clock({ ms, active, side }: { ms: number; active: boolean; side: Side }) {
  const low = ms < 20_000;
  return (
    <div
      className={cx(
        'min-w-[5.5rem] rounded-md px-2.5 py-1.5 text-right font-mono text-xl font-bold tabular-nums tracking-tight transition-colors sm:text-2xl',
        active
          ? low
            ? 'bg-rose-600 text-white'
            : side === 'w' ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-white ring-1 ring-white/20'
          : 'bg-black/25 text-zinc-400',
      )}
      aria-label={`${side === 'w' ? 'White' : 'Black'} clock ${formatClock(ms)}`}
    >
      {formatClock(ms)}
    </div>
  );
}

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

function Captured({ pieces, capturedColor, advantage }: { pieces: PieceSymbol[]; capturedColor: Side; advantage: number }) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return (
    <div className="flex h-5 items-center">
      {sorted.map((t, i) => (
        <span
          key={i}
          className={cx('h-5 w-5 bg-contain bg-no-repeat', i > 0 && sorted[i - 1] === t ? '-ml-3' : i > 0 && '-ml-1')}
          style={{ backgroundImage: `url(${pieceUrl(capturedColor, t)})` }}
        />
      ))}
      {advantage > 0 && <span className="ml-1 text-xs font-semibold text-zinc-400">+{advantage}</span>}
    </div>
  );
}

export function PlayerBar({
  name,
  subtitle,
  side,
  isBot,
  captured,
  advantage,
  clockMs,
  clockActive,
  thinking,
  connected,
  toMove,
  verified,
}: {
  name: string;
  subtitle?: string;
  side: Side;
  isBot?: boolean;
  captured: PieceSymbol[];
  advantage: number;
  clockMs: number | null;
  clockActive: boolean;
  thinking?: boolean;
  connected?: boolean | null;
  toMove: boolean;
  verified?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div
        className={cx(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          side === 'w' ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-950 text-zinc-200 ring-1 ring-white/15',
        )}
      >
        {isBot ? <Bot size={20} /> : <User size={20} />}
        {toMove && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-zinc-900" aria-label="To move" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">{name}</span>
          {verified && <BadgeCheck size={15} className="shrink-0 text-sky-400" aria-label="Verified account" />}
          {subtitle && <span className="shrink-0 text-xs text-zinc-400">{subtitle}</span>}
          {connected === false && <WifiOff size={14} className="shrink-0 text-rose-400" aria-label="Disconnected" />}
          {connected === true && <Wifi size={14} className="shrink-0 text-emerald-400/70" aria-label="Connected" />}
          {thinking && <Loader2 size={14} className="shrink-0 animate-spin text-zinc-400" aria-label="Thinking" />}
        </div>
        <Captured pieces={captured} capturedColor={side === 'w' ? 'b' : 'w'} advantage={advantage} />
      </div>
      {clockMs !== null && <Clock ms={clockMs} active={clockActive} side={side} />}
    </div>
  );
}

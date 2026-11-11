import { useEffect, useRef } from 'react';
import { CLASS_META } from '../../lib/review';
import type { MoveClass, Ply } from '../../lib/types';
import { cx } from '../ui/kit';

interface Props {
  plies: Ply[];
  viewPly: number;
  firstMoveNumber: number;
  blackFirst: boolean;
  classes?: MoveClass[] | null;
  onSelect: (ply: number) => void;
}

function Badge({ cls }: { cls: MoveClass }) {
  const meta = CLASS_META[cls];
  return (
    <span
      className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
      style={{ background: meta.color }}
      title={meta.label}
    >
      {meta.symbol}
    </span>
  );
}

/** Desktop: two-column table. Scrolls the active move into view. */
export function MoveTable({ plies, viewPly, firstMoveNumber, blackFirst, classes, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [viewPly, plies.length]);

  const offset = blackFirst ? 1 : 0;
  const rows: { no: number; white?: number; black?: number }[] = [];
  for (let i = 0; i < plies.length; i++) {
    const idx = i + offset;
    const r = Math.floor(idx / 2);
    rows[r] ??= { no: firstMoveNumber + r };
    if (idx % 2 === 0) rows[r].white = i;
    else rows[r].black = i;
  }

  const cell = (i: number | undefined) =>
    i === undefined ? (
      <span className="px-2 text-zinc-500">…</span>
    ) : (
      <button
        type="button"
        data-active={viewPly === i + 1}
        onClick={() => onSelect(i + 1)}
        className={cx(
          'flex w-full items-center rounded px-2 py-1 text-left font-medium transition',
          viewPly === i + 1 ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/8',
        )}
      >
        {plies[i].san}
        {classes?.[i] && classes[i] !== 'book' && classes[i] !== 'excellent' && classes[i] !== 'good' && <Badge cls={classes[i]} />}
      </button>
    );

  if (plies.length === 0) return <p className="px-3 py-6 text-center text-sm text-zinc-500">No moves yet.</p>;

  return (
    <div ref={ref} className="overflow-y-auto text-sm">
      {rows.map((r, idx) => (
        <div key={idx} className={cx('grid grid-cols-[2.75rem_1fr_1fr] items-center', idx % 2 === 1 && 'bg-white/[0.025]')}>
          <span className="pl-3 text-zinc-500 tabular-nums">{r.no}.</span>
          {cell(r.white)}
          {cell(r.black)}
        </div>
      ))}
    </div>
  );
}

/** Mobile: horizontal strip like the big chess apps. */
export function MoveStrip({ plies, viewPly, firstMoveNumber, blackFirst, classes, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [viewPly, plies.length]);

  if (plies.length === 0) return <div className="flex h-10 items-center px-3 text-sm text-zinc-500">Make your first move</div>;
  const offset = blackFirst ? 1 : 0;
  return (
    <div ref={ref} className="no-scrollbar flex h-10 items-center gap-0.5 overflow-x-auto px-2 text-sm">
      {plies.map((p, i) => {
        const idx = i + offset;
        const showNo = idx % 2 === 0 || i === 0;
        return (
          <span key={i} className="flex shrink-0 items-center">
            {showNo && <span className="ml-1.5 mr-0.5 text-zinc-500">{firstMoveNumber + Math.floor(idx / 2)}.{idx % 2 === 1 ? '..' : ''}</span>}
            <button
              type="button"
              data-active={viewPly === i + 1}
              onClick={() => onSelect(i + 1)}
              className={cx('flex items-center rounded px-1.5 py-1 font-medium', viewPly === i + 1 ? 'bg-white/15 text-white' : 'text-zinc-300')}
            >
              {p.san}
              {classes?.[i] && ['inaccuracy', 'mistake', 'blunder', 'best'].includes(classes[i]) && <Badge cls={classes[i]} />}
            </button>
          </span>
        );
      })}
    </div>
  );
}

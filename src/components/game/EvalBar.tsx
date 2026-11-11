import { formatEval, winPercent } from '../../lib/review';
import type { Side } from '../../lib/types';
import { cx } from '../ui/kit';

/** Vertical evaluation bar. `cp` is White's point of view. */
export function EvalBar({ cp, mate, orientation, loading }: { cp: number | null; mate: number | null; orientation: Side; loading?: boolean }) {
  const whitePct = mate !== null ? (mate > 0 ? 100 : 0) : cp === null ? 50 : winPercent(cp);
  const label = cp === null && mate === null ? '' : formatEval(cp ?? 0, mate);
  const whiteAhead = mate !== null ? mate > 0 : (cp ?? 0) >= 0;
  const flipped = orientation === 'b';
  return (
    <div
      className={cx('relative w-3 shrink-0 overflow-hidden rounded-sm bg-zinc-700 sm:w-6', loading && 'opacity-70')}
      role="meter"
      aria-label={`Evaluation ${label || 'unknown'}`}
      aria-valuenow={Math.round(whitePct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-x-0 bg-zinc-100 transition-[height] duration-500 ease-out"
        style={{ height: `${whitePct}%`, [flipped ? 'top' : 'bottom']: 0 }}
      />
      {label && (
        <span
          className={cx(
            'absolute inset-x-0 hidden text-center text-[10px] font-bold sm:block',
            whiteAhead !== flipped ? 'bottom-1' : 'top-1',
            whiteAhead ? 'text-zinc-800' : 'text-zinc-100',
          )}
        >
          {label.replace('+', '')}
        </span>
      )}
    </div>
  );
}

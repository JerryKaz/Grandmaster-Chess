import { useMemo } from 'react';
import { Bot, Globe, Trash2, Users } from 'lucide-react';
import { useGame } from '../../store/game';
import { useUi } from '../../store/ui';
import { Dialog, IconButton, cx } from '../ui/kit';
import type { ArchivedGame } from '../../lib/types';

function outcome(g: ArchivedGame): 'win' | 'loss' | 'draw' | null {
  if (g.result.winner === null) return 'draw';
  const me = g.meta.humanSide;
  if (g.mode === 'bot' && me) return g.result.winner === me ? 'win' : 'loss';
  return null;
}

export function ArchiveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const archive = useGame((s) => s.archive);
  const stats = useMemo(() => {
    const s = { win: 0, loss: 0, draw: 0 };
    for (const g of archive) {
      if (g.mode !== 'bot') continue;
      const o = outcome(g);
      if (o) s[o]++;
    }
    return s;
  }, [archive]);

  return (
    <Dialog open={open} onClose={onClose} title="Your games" wide>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {(['win', 'draw', 'loss'] as const).map((k) => (
          <div key={k} className="rounded-lg bg-black/25 py-2">
            <div className={cx('text-xl font-bold tabular-nums', k === 'win' ? 'text-emerald-400' : k === 'loss' ? 'text-rose-400' : 'text-zinc-200')}>{stats[k]}</div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-400">{k === 'win' ? 'Wins' : k === 'loss' ? 'Losses' : 'Draws'} vs computer</div>
          </div>
        ))}
      </div>
      {archive.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">Finished games appear here. Open one to replay or review it.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {archive.map((g) => {
            const o = outcome(g);
            const res = g.result.winner === 'w' ? '1-0' : g.result.winner === 'b' ? '0-1' : '½-½';
            return (
              <li key={g.id} className="flex items-center gap-2 rounded-lg bg-black/20 pr-1 hover:bg-white/8">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => {
                    useGame.getState().openArchived(g);
                    useUi.getState().setView('play');
                    onClose();
                  }}
                >
                  <span className="text-zinc-400">{g.mode === 'bot' ? <Bot size={18} /> : g.mode === 'online' ? <Globe size={18} /> : <Users size={18} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{g.meta.white} vs {g.meta.black}</span>
                    <span className="block text-xs text-zinc-400">
                      {new Date(g.endedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {Math.ceil(g.moves.length / 2)} moves · {g.result.reason}
                    </span>
                  </span>
                  <span className={cx('rounded px-2 py-0.5 text-xs font-bold tabular-nums', o === 'win' ? 'bg-emerald-500/20 text-emerald-300' : o === 'loss' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-zinc-300')}>
                    {res}
                  </span>
                </button>
                <IconButton label="Delete game" onClick={() => useGame.getState().deleteArchived(g.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

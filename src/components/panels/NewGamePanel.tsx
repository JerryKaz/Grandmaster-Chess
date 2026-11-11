import { useState } from 'react';
import { Bot, Globe, Users } from 'lucide-react';
import { BOT_LEVELS } from '../../engine/bots';
import type { Side, TimeControl } from '../../lib/types';
import { useGame } from '../../store/game';
import { unlockAudio } from '../../lib/sound';
import { load, save } from '../../lib/storage';
import { Button, Label, Segmented, cx } from '../ui/kit';
import { OnlineLobby } from './OnlineLobby';

export const TIME_CONTROLS: { id: string; label: string; group: string; tc: TimeControl }[] = [
  { id: 'none', label: '∞', group: 'Unlimited', tc: { initial: 0, increment: 0 } },
  { id: '1+0', label: '1 min', group: 'Bullet', tc: { initial: 60, increment: 0 } },
  { id: '3+0', label: '3 min', group: 'Blitz', tc: { initial: 180, increment: 0 } },
  { id: '3+2', label: '3 | 2', group: 'Blitz', tc: { initial: 180, increment: 2 } },
  { id: '5+0', label: '5 min', group: 'Blitz', tc: { initial: 300, increment: 0 } },
  { id: '10+0', label: '10 min', group: 'Rapid', tc: { initial: 600, increment: 0 } },
  { id: '15+10', label: '15 | 10', group: 'Rapid', tc: { initial: 900, increment: 10 } },
  { id: '30+0', label: '30 min', group: 'Classical', tc: { initial: 1800, increment: 0 } },
];

type Tab = 'bot' | 'online' | 'local';

function TimePicker({ value, onChange, allowUnlimited = true }: { value: string; onChange: (id: string) => void; allowUnlimited?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {TIME_CONTROLS.filter((t) => allowUnlimited || t.id !== 'none').map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          title={t.group}
          className={cx(
            'min-h-11 rounded-lg text-sm font-semibold transition',
            value === t.id ? 'bg-zinc-100 text-zinc-900' : 'bg-black/25 text-zinc-300 hover:bg-white/10',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: Side | 'random'; onChange: (v: Side | 'random') => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'w', label: <span className="flex items-center justify-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-white ring-1 ring-black/30" />White</span> },
        { value: 'random', label: 'Random' },
        { value: 'b', label: <span className="flex items-center justify-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm bg-zinc-900 ring-1 ring-white/40" />Black</span> },
      ]}
    />
  );
}

export function NewGamePanel() {
  const [tab, setTabState] = useState<Tab>(() => load<Tab>('gm-last-tab', 'bot'));
  const setTab = (t: Tab) => {
    setTabState(t);
    save('gm-last-tab', t);
  };
  const [level, setLevel] = useState(() => load<number>('gm-last-level', 3));
  const [color, setColor] = useState<Side | 'random'>('w');
  const [tcId, setTcId] = useState('none');
  const tcOf = (id: string) => TIME_CONTROLS.find((t) => t.id === id)!.tc;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'bot', label: 'Computer', icon: <Bot size={18} /> },
    { id: 'online', label: 'Online', icon: <Globe size={18} /> },
    { id: 'local', label: 'Pass & play', icon: <Users size={18} /> },
  ];

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-3 gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition',
              tab === t.id ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/50' : 'bg-black/20 text-zinc-300 hover:bg-white/8',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bot' && (
        <>
          <div>
            <Label>Opponent</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {BOT_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className={cx(
                    'rounded-lg px-3 py-2 text-left transition',
                    level === l.id ? 'bg-zinc-100 text-zinc-900' : 'bg-black/25 text-zinc-200 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{l.name}</span>
                    <span className={cx('text-xs tabular-nums', level === l.id ? 'text-zinc-600' : 'text-zinc-400')}>{l.elo}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-5 text-xs text-zinc-400">{BOT_LEVELS.find((l) => l.id === level)?.blurb}</p>
          </div>
          <div>
            <Label>Play as</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div>
            <Label>Time control</Label>
            <TimePicker value={tcId} onChange={setTcId} />
          </div>
          <Button
            variant="primary"
            className="min-h-12 text-base"
            onClick={() => {
              unlockAudio();
              save('gm-last-level', level);
              useGame.getState().startBotGame(level, color, tcOf(tcId));
            }}
          >
            Play
          </Button>
        </>
      )}

      {tab === 'online' && <OnlineLobby />}

      {tab === 'local' && (
        <>
          <p className="text-sm text-zinc-400">Two players on one device. Flip the board between turns from the toolbar.</p>
          <div>
            <Label>Time control</Label>
            <TimePicker value={tcId} onChange={setTcId} />
          </div>
          <Button
            variant="primary"
            className="min-h-12 text-base"
            onClick={() => {
              unlockAudio();
              useGame.getState().startLocalGame(tcOf(tcId));
            }}
          >
            Start game
          </Button>
        </>
      )}
    </div>
  );
}

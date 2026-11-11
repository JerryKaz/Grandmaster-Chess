import { useEffect, useState } from 'react';
import { Loader2, LogIn, Swords, Users, X, Zap } from 'lucide-react';
import type { Side, TimeControl } from '../../lib/types';
import { unlockAudio } from '../../lib/sound';
import { useAuth } from '../../store/auth';
import { useOnline } from '../../store/online';
import { AuthForm } from '../auth/AuthForm';
import { Avatar } from '../dialogs/AccountDialog';
import { Button, Label, Segmented, cx } from '../ui/kit';

const QUICK: { label: string; group: string; tc: TimeControl }[] = [
  { label: '1+0', group: 'Bullet', tc: { initial: 60, increment: 0 } },
  { label: '2+1', group: 'Bullet', tc: { initial: 120, increment: 1 } },
  { label: '3+0', group: 'Blitz', tc: { initial: 180, increment: 0 } },
  { label: '3+2', group: 'Blitz', tc: { initial: 180, increment: 2 } },
  { label: '5+0', group: 'Blitz', tc: { initial: 300, increment: 0 } },
  { label: '5+3', group: 'Blitz', tc: { initial: 300, increment: 3 } },
  { label: '10+0', group: 'Rapid', tc: { initial: 600, increment: 0 } },
  { label: '10+5', group: 'Rapid', tc: { initial: 600, increment: 5 } },
  { label: '15+10', group: 'Rapid', tc: { initial: 900, increment: 10 } },
];

const tcLabel = (tc: TimeControl) => `${tc.initial / 60}+${tc.increment}`;

function Seeking() {
  const seeking = useOnline((s) => s.seeking)!;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((now - seeking.since) / 1000);
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-500/10 p-5 text-center ring-1 ring-emerald-400/30">
      <Loader2 size={28} className="animate-spin text-emerald-300" />
      <div>
        <div className="font-semibold text-white">Finding an opponent…</div>
        <div className="text-sm text-zinc-400">
          {tcLabel(seeking.tc)} rated · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </div>
      </div>
      <Button onClick={() => useOnline.getState().cancelSeek()}>
        <X size={16} /> Cancel
      </Button>
    </div>
  );
}

/** Online tab: sign in first, then Quick match (rated) or play a friend (casual). */
export function OnlineLobby() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const online = useOnline();
  const [mode, setMode] = useState<'quick' | 'friend'>('quick');
  const [friendTc, setFriendTc] = useState(4);
  const [color, setColor] = useState<Side | 'random'>('random');
  const [code, setCode] = useState('');

  if (!ready) return <Loader2 className="mx-auto animate-spin text-zinc-400" />;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-black/20 p-3 text-sm text-zinc-300">
          <div className="mb-1 flex items-center gap-2 font-semibold text-white">
            <Swords size={16} className="text-emerald-300" /> Play people online
          </div>
          Sign in or create a free account to get matched with players, earn a rating and challenge friends.
        </div>
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
        <Avatar size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{user.name}</div>
          <div className="text-xs text-zinc-400">
            {user.record.w}W · {user.record.d}D · {user.record.l}L
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-white">{user.rating}</div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-400">Rating</div>
        </div>
      </div>

      {online.seeking ? (
        <Seeking />
      ) : (
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'quick', label: <span className="flex items-center justify-center gap-1.5"><Zap size={15} />Quick match</span> },
              { value: 'friend', label: <span className="flex items-center justify-center gap-1.5"><Users size={15} />Play a friend</span> },
            ]}
          />

          {mode === 'quick' ? (
            <div>
              <Label>Rated · pick a time control</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      online.seek(q.tc);
                    }}
                    className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-black/25 text-white transition hover:bg-emerald-500/20 hover:ring-1 hover:ring-emerald-400/50 active:scale-[0.98]"
                  >
                    <span className="text-base font-bold">{q.label}</span>
                    <span className="text-[11px] text-zinc-400">{q.group}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">You'll be paired with the closest-rated player looking for the same game.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-black/20 p-3">
                <Label>Create a casual game</Label>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {QUICK.map((q, i) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setFriendTc(i)}
                        className={cx('min-h-10 rounded-lg text-sm font-semibold', friendTc === i ? 'bg-zinc-100 text-zinc-900' : 'bg-black/25 text-zinc-300 hover:bg-white/10')}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <Segmented
                    value={color}
                    onChange={setColor}
                    options={[
                      { value: 'w', label: 'White' },
                      { value: 'random', label: 'Random' },
                      { value: 'b', label: 'Black' },
                    ]}
                  />
                  <Button
                    variant="primary"
                    disabled={online.busy}
                    onClick={() => {
                      unlockAudio();
                      online.create(QUICK[friendTc].tc, color);
                    }}
                  >
                    {online.busy && <Loader2 size={18} className="animate-spin" />}
                    Create & invite
                  </Button>
                </div>
              </div>
              <form
                className="rounded-xl bg-black/20 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  unlockAudio();
                  online.join(code);
                }}
              >
                <Label>Join with a code</Label>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="ABC234"
                    autoCapitalize="characters"
                    autoComplete="off"
                    aria-label="Game code"
                    className="h-11 min-w-0 flex-1 rounded-lg bg-black/30 px-3 font-mono text-base tracking-[0.3em] text-white uppercase ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-emerald-400"
                  />
                  <Button type="submit" disabled={code.length !== 6 || online.busy}>
                    <LogIn size={18} /> Join
                  </Button>
                </div>
              </form>
            </>
          )}
        </>
      )}
      {online.error && (
        <p className="text-sm text-rose-400" role="alert">
          {online.error}
        </p>
      )}
      {online.conn === 'reconnecting' && <p className="text-xs text-amber-300">Reconnecting to the server…</p>}
    </div>
  );
}

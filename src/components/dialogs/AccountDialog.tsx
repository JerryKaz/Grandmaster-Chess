import { useEffect, useRef, useState } from 'react';
import { LogOut, UserCircle2 } from 'lucide-react';
import { loadGoogleIdentity, useAuth } from '../../store/auth';
import { usePuzzles } from '../../store/puzzles';
import { useGame } from '../../store/game';
import { Button, Dialog } from '../ui/kit';

export function Avatar({ size = 32 }: { size?: number }) {
  const user = useAuth((s) => s.user);
  const [broken, setBroken] = useState(false);
  if (user?.picture && !broken) {
    return (
      <img
        src={user.picture}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="rounded-full ring-2 ring-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  return user ? (
    <span className="flex items-center justify-center rounded-full bg-emerald-600 font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {user.name.charAt(0).toUpperCase()}
    </span>
  ) : (
    <UserCircle2 size={size * 0.7} />
  );
}

function GoogleButton() {
  const clientId = useAuth((s) => s.clientId);
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadGoogleIdentity(clientId)
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = '';
        window.google!.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(320, ref.current.clientWidth || 320),
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      <div ref={ref} className="flex min-h-11 justify-center" />
      {error && <p className="mt-2 text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const busy = useAuth((s) => s.busy);
  const rating = usePuzzles((s) => s.progress.rating);
  const games = useGame((s) => s.archive.length);

  return (
    <Dialog open={open} onClose={onClose} title={user ? 'Your account' : 'Sign in'}>
      {user ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar size={52} />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white">{user.name}</div>
              <div className="truncate text-sm text-zinc-400">{user.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-black/25 py-2.5">
              <div className="text-xl font-bold tabular-nums text-white">{rating}</div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Puzzle rating</div>
            </div>
            <div className="rounded-lg bg-black/25 py-2.5">
              <div className="text-xl font-bold tabular-nums text-white">{games}</div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Saved games</div>
            </div>
          </div>
          <p className="text-xs text-zinc-400">Your puzzle rating and game history sync across your devices. Online opponents see your Google name with a verified badge.</p>
          <Button
            onClick={() => {
              void useAuth.getState().signOut();
              onClose();
            }}
          >
            <LogOut size={16} /> Sign out
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-300">Sign in to keep your puzzle rating and game history on every device, and play online under your verified name.</p>
          <GoogleButton />
          {busy && <p className="text-center text-sm text-zinc-400">Signing in…</p>}
          <p className="text-xs text-zinc-500">We only receive your name, email address and profile picture from Google. You can keep playing as a guest without signing in.</p>
        </div>
      )}
    </Dialog>
  );
}

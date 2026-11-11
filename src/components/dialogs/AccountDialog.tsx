import { useState } from 'react';
import { LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { usePuzzles } from '../../store/puzzles';
import { AuthForm } from '../auth/AuthForm';
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

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg bg-black/25 py-2.5">
      <div className="text-xl font-bold tabular-nums text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</div>
    </div>
  );
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const puzzleRating = usePuzzles((s) => s.progress.rating);

  return (
    <Dialog open={open} onClose={onClose} title={user ? 'Your account' : 'Join Grandmaster'}>
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
            <Stat value={user.rating} label="Online rating" />
            <Stat value={puzzleRating} label="Puzzle rating" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={<span className="text-emerald-400">{user.record.w}</span>} label="Wins" />
            <Stat value={user.record.d} label="Draws" />
            <Stat value={<span className="text-rose-400">{user.record.l}</span>} label="Losses" />
          </div>
          <p className="text-xs text-zinc-400">
            Signed in with {[user.hasApple && 'Apple', user.hasGoogle && 'Google', user.hasPassword && 'email'].filter(Boolean).join(', ')}. Your ratings and game history sync across your devices.
          </p>
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
          <p className="text-sm text-zinc-300">Sign in or create a free account to play rated games online, keep your ratings and sync your games across devices.</p>
          <AuthForm />
        </div>
      )}
    </Dialog>
  );
}

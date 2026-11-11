import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { loadGoogleIdentity, useAuth } from '../../store/auth';
import { Button, Segmented, cx } from '../ui/kit';

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

const inputClass =
  'h-11 w-full rounded-lg bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-500 focus:ring-emerald-400';

/** Create an account or log in with email + password, or continue with Google. */
export function AuthForm({ initialMode = 'signup' }: { initialMode?: 'signup' | 'login' }) {
  const clientId = useAuth((s) => s.clientId);
  const busy = useAuth((s) => s.busy);
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const auth = useAuth.getState();
    const err = mode === 'signup' ? await auth.signUp(name, email, password) : await auth.logIn(email, password);
    if (err) setError(err);
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'signup', label: 'Create account' },
          { value: 'login', label: 'Log in' },
        ]}
      />

      <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-400">Display name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="How opponents see you" required />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-400">Email</span>
          <input className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-400">Password</span>
          <span className="relative">
            <input
              className={cx(inputClass, 'pr-11')}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-zinc-400 hover:text-white"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="min-h-12" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'signup' ? 'Create account' : 'Log in'}
        </Button>
      </form>

      {clientId && (
        <>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <GoogleButton />
        </>
      )}
    </div>
  );
}

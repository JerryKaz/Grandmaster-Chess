import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { loadGoogleIdentity, useAuth } from '../../store/auth';
import { Button, cx } from '../ui/kit';

const PILL =
  'flex h-11 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium transition active:scale-[0.99] disabled:opacity-60';

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Google's own sign-in button (required by Google), rendered as a white "Continue with Google" pill. */
function GoogleButton({ clientId }: { clientId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    loadGoogleIdentity(clientId)
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = '';
        window.google!.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(400, ref.current.clientWidth || 320),
        });
        setState('ready');
      })
      .catch(() => setState('failed'));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      {state !== 'ready' && (
        <div className={cx(PILL, 'bg-white text-zinc-900', state === 'loading' && 'opacity-60')} aria-hidden>
          <GoogleLogo /> Continue with Google
        </div>
      )}
      <div ref={ref} className={cx('flex justify-center', state !== 'ready' && 'hidden')} />
      {state === 'failed' && <p className="mt-1 text-center text-xs text-rose-400">Couldn't reach Google. Check your connection and reload.</p>}
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-lg bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-500 focus:ring-emerald-400';

/**
 * Account screen: create an account (or log in) with email at the top,
 * then "Continue with Apple" and "Continue with Google" underneath.
 */
export function AuthForm() {
  const clientId = useAuth((s) => s.clientId);
  const apple = useAuth((s) => s.apple);
  const busy = useAuth((s) => s.busy);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const auth = useAuth.getState();
    const err = mode === 'signup' ? await auth.signUp(name, email, password) : await auth.logIn(email, password);
    if (err) setError(err);
  };

  const notSetUp = (provider: 'Apple' | 'Google') =>
    setProviderNote(
      `${provider} sign-in isn't switched on for this site yet.` +
        (import.meta.env.DEV ? ` Add ${provider === 'Apple' ? 'APPLE_CLIENT_ID and APPLE_REDIRECT_URI' : 'GOOGLE_CLIENT_ID'} to .env and restart.` : ' Please create an account with email for now.'),
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-white">{mode === 'signup' ? 'Create an account' : 'Log in'}</h3>
        <p className="text-sm text-zinc-400">{mode === 'signup' ? 'Free, and takes a few seconds.' : 'Welcome back.'}</p>
      </div>

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
        <Button type="submit" variant="primary" className="min-h-12 text-base" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'signup' ? 'Create account' : 'Log in'}
        </Button>
        <p className="text-center text-sm text-zinc-400">
          {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
          <button
            type="button"
            className="font-semibold text-emerald-300 hover:underline"
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError(null);
            }}
          >
            {mode === 'signup' ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-white/10" />
        or continue with
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          className={cx(PILL, 'bg-black text-white ring-1 ring-white/25 hover:bg-zinc-950')}
          disabled={busy}
          onClick={() => (apple ? void useAuth.getState().signInWithApple() : notSetUp('Apple'))}
        >
          <AppleLogo /> Continue with Apple
        </button>
        {clientId ? (
          <GoogleButton clientId={clientId} />
        ) : (
          <button type="button" className={cx(PILL, 'bg-white text-zinc-900 hover:bg-zinc-100')} onClick={() => notSetUp('Google')}>
            <GoogleLogo /> Continue with Google
          </button>
        )}
        {providerNote && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/20" role="status">
            {providerNote}
          </p>
        )}
      </div>
    </div>
  );
}

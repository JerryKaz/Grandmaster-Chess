import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { loadGoogleIdentity, useAuth } from '../../store/auth';
import { Button, Segmented, cx } from '../ui/kit';

// All three providers share one look: full-width white pills, 40px tall (Google's "large" button height).
const PILL = 'flex h-10 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium transition active:scale-[0.99] disabled:opacity-50';

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

/** Google's own button (required for its sign-in flow), styled to match the other pills. */
function GoogleButton({ clientId }: { clientId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      <div ref={ref} className="flex min-h-10 justify-center overflow-hidden rounded-full" />
      {error && <p className="mt-1 text-center text-xs text-rose-400">{error}</p>}
    </div>
  );
}

/** Shown during development only, so you can see where a provider will appear before it is configured. */
function NotConfigured({ icon, label, env }: { icon: React.ReactNode; label: string; env: string }) {
  return (
    <div>
      <button type="button" disabled className={cx(PILL, 'bg-white text-zinc-900')}>
        {icon} {label}
      </button>
      <p className="mt-1 text-center text-[11px] text-zinc-500">Dev only: set {env} to enable</p>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-lg bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-500 focus:ring-emerald-400';

function EmailForm({ initialMode, onBack }: { initialMode: 'signup' | 'login'; onBack: () => void }) {
  const busy = useAuth((s) => s.busy);
  const [mode, setMode] = useState(initialMode);
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
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 self-start text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Other ways to sign in
      </button>
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'login', label: 'Log in' },
          { value: 'signup', label: 'Create account' },
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
          <input className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required autoFocus />
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
        <Button type="submit" variant="primary" className="min-h-12" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'signup' ? 'Create account' : 'Log in'}
        </Button>
      </form>
    </div>
  );
}

/**
 * Sign-in chooser, the way most sites do it:
 * Continue with Apple / Continue with Google, or create an account (or log in) with email.
 */
export function AuthForm() {
  const clientId = useAuth((s) => s.clientId);
  const apple = useAuth((s) => s.apple);
  const busy = useAuth((s) => s.busy);
  const [email, setEmail] = useState<null | 'signup' | 'login'>(null);
  const dev = import.meta.env.DEV;

  if (email) return <EmailForm initialMode={email} onBack={() => setEmail(null)} />;

  return (
    <div className="flex flex-col gap-3">
      {apple ? (
        <button type="button" className={cx(PILL, 'bg-white text-zinc-900 hover:bg-zinc-100')} onClick={() => void useAuth.getState().signInWithApple()} disabled={busy}>
          <AppleLogo /> Continue with Apple
        </button>
      ) : (
        dev && <NotConfigured icon={<AppleLogo />} label="Continue with Apple" env="APPLE_CLIENT_ID" />
      )}

      {clientId ? <GoogleButton clientId={clientId} /> : dev && <NotConfigured icon={<GoogleLogo />} label="Continue with Google" env="GOOGLE_CLIENT_ID" />}

      <div className="my-1 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-white/10" />
        New to Grandmaster?
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button type="button" className={cx(PILL, 'bg-emerald-500 font-semibold text-white shadow-[0_3px_0_#047857] hover:bg-emerald-400')} onClick={() => setEmail('signup')}>
        Create an account
      </button>
      <p className="text-center text-sm text-zinc-400">
        Already have an account?{' '}
        <button type="button" className="font-semibold text-emerald-300 hover:underline" onClick={() => setEmail('login')}>
          Log in
        </button>
      </p>
      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        Apple and Google create your account automatically the first time you use them.
      </p>
    </div>
  );
}

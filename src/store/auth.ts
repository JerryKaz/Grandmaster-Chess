import { create } from 'zustand';
import { toast } from './ui';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  /** Online rating and record from rated games. */
  rating: number;
  record: { w: number; l: number; d: number };
  hasGoogle: boolean;
  hasApple: boolean;
  hasPassword: boolean;
}

export interface AppleConfig {
  clientId: string;
  redirectURI: string;
}

interface AuthState {
  /** Google client id from the server; null when sign-in is not configured. */
  clientId: string | null;
  /** Sign in with Apple settings from the server; null when not configured. */
  apple: AppleConfig | null;
  ready: boolean;
  user: AuthUser | null;
  busy: boolean;
  init: () => Promise<void>;
  signInWithCredential: (credential: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Email + password. Resolve to an error message, or null on success. */
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  logIn: (email: string, password: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Called after sign-in so other stores can sync (set by sync.ts to avoid an import cycle). */
let onSignedIn: (() => void) | null = null;
export const setOnSignedIn = (fn: () => void) => (onSignedIn = fn);

/** Called whenever the signed-in user changes (online play must reconnect to pick up the new session). */
let onAuthChanged: (() => void) | null = null;
export const setOnAuthChanged = (fn: () => void) => (onAuthChanged = fn);

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export const useAuth = create<AuthState>((set, get) => ({
  clientId: null,
  apple: null,
  ready: false,
  user: null,
  busy: false,

  init: async () => {
    try {
      const [config, me] = await Promise.all([
        fetch('/api/auth/config').then((r) => r.json()),
        fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json()),
      ]);
      set({ clientId: config.googleClientId ?? null, apple: config.apple ?? null, user: me.user ?? null, ready: true });
      if (me.user) onSignedIn?.();
    } catch {
      set({ ready: true }); // offline or server without auth: play as guest
    }
  },

  signInWithCredential: async (credential) => {
    set({ busy: true });
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed');
      set({ user: data.user });
      toast(`Signed in as ${data.user.name}`);
      onSignedIn?.();
      onAuthChanged?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      set({ busy: false });
    }
  },

  signInWithApple: async () => {
    const apple = get().apple;
    if (!apple) return;
    set({ busy: true });
    try {
      await loadAppleId();
      const { ok: nonceOk, data: nonceData } = await postJson('/api/auth/apple/nonce', {});
      if (!nonceOk) throw new Error(nonceData.error || 'Sign in with Apple is unavailable');
      window.AppleID!.auth.init({
        clientId: apple.clientId,
        scope: 'name email',
        redirectURI: apple.redirectURI,
        state: Math.random().toString(36).slice(2),
        nonce: nonceData.nonce,
        usePopup: true,
      });
      const result = await window.AppleID!.auth.signIn();
      const { ok, data } = await postJson('/api/auth/apple', { idToken: result.authorization.id_token, name: result.user?.name ?? null });
      if (!ok) throw new Error(data.error || 'Sign in with Apple failed');
      set({ user: data.user });
      toast(`Signed in as ${data.user.name}`);
      onSignedIn?.();
      onAuthChanged?.();
    } catch (err) {
      const code = (err as { error?: string })?.error;
      if (code !== 'popup_closed_by_user' && code !== 'user_cancelled_authorize') {
        toast(err instanceof Error ? err.message : 'Sign in with Apple failed');
      }
    } finally {
      set({ busy: false });
    }
  },

  signUp: async (name, email, password) => {
    set({ busy: true });
    try {
      const { ok, data } = await postJson('/api/auth/signup', { name, email, password });
      if (!ok) return data.error || 'Could not create your account.';
      set({ user: data.user });
      toast(`Welcome, ${data.user.name}!`);
      onSignedIn?.();
      onAuthChanged?.();
      return null;
    } catch {
      return 'Network error. Check your connection.';
    } finally {
      set({ busy: false });
    }
  },

  logIn: async (email, password) => {
    set({ busy: true });
    try {
      const { ok, data } = await postJson('/api/auth/login', { email, password });
      if (!ok) return data.error || 'Could not log in.';
      set({ user: data.user });
      toast(`Signed in as ${data.user.name}`);
      onSignedIn?.();
      onAuthChanged?.();
      return null;
    } catch {
      return 'Network error. Check your connection.';
    } finally {
      set({ busy: false });
    }
  },

  refresh: async () => {
    if (!get().user) return;
    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json());
      set({ user: me.user ?? null });
    } catch {
      /* keep the cached profile */
    }
  },

  signOut: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* cookie will expire anyway */
    }
    window.google?.accounts.id.disableAutoSelect();
    set({ user: null });
    onAuthChanged?.();
    toast('Signed out');
  },
}));

// ---- Google Identity Services loader ----

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; ux_mode?: 'popup' | 'redirect' }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, string | number>) => void;
  disableAutoSelect: () => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisLoading: Promise<void> | null = null;
let gisInitializedFor: string | null = null;

export function loadGoogleIdentity(clientId: string): Promise<void> {
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return gisLoading.then(() => {
    if (gisInitializedFor === clientId) return;
    window.google!.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      callback: (r) => void useAuth.getState().signInWithCredential(r.credential),
    });
    gisInitializedFor = clientId;
  });
}

// ---- Sign in with Apple JS loader ----

interface AppleSignInResult {
  authorization: { id_token: string; code: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
}
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (cfg: { clientId: string; scope: string; redirectURI: string; state?: string; nonce?: string; usePopup: boolean }) => void;
        signIn: () => Promise<AppleSignInResult>;
      };
    };
  }
}

let appleLoading: Promise<void> | null = null;
function loadAppleId(): Promise<void> {
  appleLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      appleLoading = null;
      reject(new Error('Could not load Sign in with Apple'));
    };
    document.head.appendChild(script);
  });
  return appleLoading;
}

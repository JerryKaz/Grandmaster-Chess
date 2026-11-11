import { create } from 'zustand';
import { toast } from './ui';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string | null;
}

interface AuthState {
  /** Google client id from the server; null when sign-in is not configured. */
  clientId: string | null;
  ready: boolean;
  user: AuthUser | null;
  busy: boolean;
  init: () => Promise<void>;
  signInWithCredential: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Called after sign-in so other stores can sync (set by sync.ts to avoid an import cycle). */
let onSignedIn: (() => void) | null = null;
export const setOnSignedIn = (fn: () => void) => (onSignedIn = fn);

export const useAuth = create<AuthState>((set) => ({
  clientId: null,
  ready: false,
  user: null,
  busy: false,

  init: async () => {
    try {
      const [config, me] = await Promise.all([
        fetch('/api/auth/config').then((r) => r.json()),
        fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json()),
      ]);
      set({ clientId: config.googleClientId ?? null, user: me.user ?? null, ready: true });
      if (me.user) onSignedIn?.();
    } catch {
      set({ ready: true }); // offline or server without auth — play as guest
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
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      set({ busy: false });
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

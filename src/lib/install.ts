/**
 * "Install as an app" support.
 * - Android (Chrome, Edge, Samsung Internet): the browser fires `beforeinstallprompt`; we keep the
 *   event and show our own Install button that triggers the native prompt.
 * - iOS / iPadOS: no install API exists, so we show "Share, then Add to Home Screen" instructions.
 * - Other Android browsers (e.g. Firefox): instructions to use the browser menu.
 */
import { create } from 'zustand';
import { load, save } from './storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  platform: InstallPlatform;
  iosBrowser: 'safari' | 'other';
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIos = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const useInstall = create<InstallState>(() => ({
  deferred: null,
  installed: isStandalone(),
  platform: isIos ? 'ios' : isAndroid ? 'android' : 'desktop',
  iosBrowser: /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'other' : 'safari',
}));

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null }));

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[sw] registration failed', err));
    });
  }
}

/** Show the native install dialog (Android/desktop Chromium). Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const { deferred } = useInstall.getState();
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  useInstall.setState({ deferred: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

const DISMISS_KEY = 'gm-install-dismissed';
const DISMISS_DAYS = 7;

export function installDismissedRecently(): boolean {
  const at = load<number>(DISMISS_KEY, 0);
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function dismissInstall() {
  save(DISMISS_KEY, Date.now());
}

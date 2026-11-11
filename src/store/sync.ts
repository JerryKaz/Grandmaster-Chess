/**
 * Keeps puzzle progress and the game archive in sync with the signed-in account.
 * First sync after sign-in merges device + server; later syncs push this device's state.
 */
import type { ArchivedGame } from '../lib/types';
import { save } from '../lib/storage';
import { isArchivedGame } from '../lib/game';
import { setOnSignedIn, useAuth } from './auth';
import { useGame } from './game';
import { usePuzzles, type PuzzleProgress } from './puzzles';

let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function sync(mode: 'merge' | 'push') {
  if (!useAuth.getState().user) return;
  try {
    const res = await fetch('/api/me/progress', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puzzle: usePuzzles.getState().progress,
        archive: useGame.getState().archive,
        replaceArchive: mode === 'push',
      }),
    });
    if (!res.ok) return;
    const data: { puzzle: PuzzleProgress | null; archive: ArchivedGame[] } = await res.json();
    applying = true;
    if (data.puzzle) usePuzzles.getState().applyProgress(data.puzzle);
    if (Array.isArray(data.archive)) {
      const archive = data.archive.filter(isArchivedGame);
      save('gm-archive-v2', archive);
      useGame.setState({ archive });
    }
  } catch {
    /* offline: will sync on the next change */
  } finally {
    applying = false;
  }
}

function schedulePush() {
  if (applying || !useAuth.getState().user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void sync('push'), 1500);
}

export function initSync() {
  setOnSignedIn(() => void sync('merge'));
  usePuzzles.subscribe((s, prev) => s.progress !== prev.progress && schedulePush());
  useGame.subscribe((s, prev) => s.archive !== prev.archive && schedulePush());
}

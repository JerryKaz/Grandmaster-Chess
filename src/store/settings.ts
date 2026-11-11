import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '../lib/game';
import { setSoundEnabled } from '../lib/sound';
import { useAuth } from './auth';

export type BoardTheme = 'green' | 'brown' | 'blue' | 'slate' | 'purple';

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }> = {
  green: { light: '#ebecd0', dark: '#739552', label: 'Green' },
  brown: { light: '#f0d9b5', dark: '#b58863', label: 'Wood' },
  blue: { light: '#dee3e6', dark: '#8ca2ad', label: 'Ice' },
  slate: { light: '#c8cdd4', dark: '#6b7787', label: 'Slate' },
  purple: { light: '#e8e3f2', dark: '#8a75b3', label: 'Lilac' },
};

interface SettingsState {
  playerId: string;
  playerName: string;
  boardTheme: BoardTheme;
  sound: boolean;
  showCoords: boolean;
  showLegalMoves: boolean;
  animate: boolean;
  autoQueen: boolean;
  confirmResign: boolean;
  /** Show the eval bar during bot games (always on in analysis). */
  evalInBotGames: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      playerId: newId(),
      playerName: '',
      boardTheme: 'green',
      sound: true,
      showCoords: true,
      showLegalMoves: true,
      animate: true,
      autoQueen: false,
      confirmResign: true,
      evalInBotGames: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'gm-settings-v2',
      version: 1,
      onRehydrateStorage: () => (state) => setSoundEnabled(state?.sound ?? true),
    },
  ),
);

useSettings.subscribe((s) => setSoundEnabled(s.sound));

/** Name used in games: the Google account name when signed in, else the chosen display name. */
export const displayName = () => useAuth.getState().user?.name || useSettings.getState().playerName.trim() || 'You';

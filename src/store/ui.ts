import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
}

export type View = 'play' | 'puzzles';

interface UiState {
  view: View;
  setView: (view: View) => void;
  toasts: Toast[];
  settingsOpen: boolean;
  toast: (text: string) => void;
  dismiss: (id: number) => void;
  setSettingsOpen: (open: boolean) => void;
}

let nextId = 1;

export const useUi = create<UiState>((set, get) => ({
  view: new URLSearchParams(location.search).has('puzzles') ? 'puzzles' : 'play',
  setView: (view) => {
    if (view !== get().view) window.scrollTo(0, 0);
    set({ view });
  },
  toasts: [],
  settingsOpen: false,
  toast: (text) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, text }] });
    setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));

export const toast = (text: string) => useUi.getState().toast(text);

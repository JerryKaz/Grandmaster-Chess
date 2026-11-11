import { BOARD_THEMES, useSettings, type BoardTheme } from '../../store/settings';
import { useUi } from '../../store/ui';
import { Dialog, Label, Toggle, cx } from '../ui/kit';
import { InstallSettingsRow } from '../InstallPrompt';

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const s = useSettings();

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Settings" wide>
      <div className="flex flex-col gap-5">
        <div>
          <Label>Display name</Label>
          <input
            value={s.playerName}
            onChange={(e) => s.set({ playerName: e.target.value.slice(0, 24) })}
            placeholder="Guest"
            maxLength={24}
            className="h-11 w-full rounded-lg bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-500 focus:ring-emerald-400"
          />
        </div>
        <div>
          <Label>Board</Label>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((key) => {
              const t = BOARD_THEMES[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => s.set({ boardTheme: key })}
                  className={cx('flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] text-zinc-300', s.boardTheme === key ? 'bg-white/12 ring-2 ring-emerald-400' : 'hover:bg-white/8')}
                  aria-pressed={s.boardTheme === key}
                >
                  <span className="grid h-10 w-10 grid-cols-2 overflow-hidden rounded">
                    <span style={{ background: t.light }} />
                    <span style={{ background: t.dark }} />
                    <span style={{ background: t.dark }} />
                    <span style={{ background: t.light }} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="divide-y divide-white/5">
          <Toggle label="Sound" checked={s.sound} onChange={(v) => s.set({ sound: v })} />
          <Toggle label="Coordinates" checked={s.showCoords} onChange={(v) => s.set({ showCoords: v })} />
          <Toggle label="Show legal moves" checked={s.showLegalMoves} onChange={(v) => s.set({ showLegalMoves: v })} />
          <Toggle label="Piece animation" checked={s.animate} onChange={(v) => s.set({ animate: v })} />
          <Toggle label="Always promote to queen" checked={s.autoQueen} onChange={(v) => s.set({ autoQueen: v })} />
          <Toggle label="Confirm resign & draw" checked={s.confirmResign} onChange={(v) => s.set({ confirmResign: v })} />
          <Toggle
            label="Eval bar in computer games"
            description="Off by default, since it gives away the best moves"
            checked={s.evalInBotGames}
            onChange={(v) => s.set({ evalInBotGames: v })}
          />
        </div>
        <div>
          <Label>App</Label>
          <InstallSettingsRow />
        </div>
        <p className="text-xs text-zinc-500">
          Tips: drag or tap to move · right-click and drag to draw arrows · ← → to step through moves · F flips the board.
        </p>
      </div>
    </Dialog>
  );
}

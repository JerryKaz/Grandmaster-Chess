import { useEffect, useState } from 'react';
import { Download, EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
import { dismissInstall, installDismissedRecently, promptInstall, useInstall } from '../lib/install';
import { Button, IconButton } from './ui/kit';

const SHOW_AFTER_MS = 2500;

/** Steps for browsers without an install API. */
export function InstallSteps() {
  const { platform, iosBrowser } = useInstall();
  if (platform === 'ios') {
    return (
      <ol className="flex flex-col gap-2 text-sm text-zinc-200">
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
          Tap <Share size={18} className="text-sky-400" aria-label="Share" /> <b>Share</b>
          {iosBrowser === 'safari' ? ' in the toolbar' : ' (next to the address bar or in the menu)'}
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
          Choose <SquarePlus size={18} className="text-zinc-100" aria-hidden /> <b>Add to Home Screen</b>
        </li>
      </ol>
    );
  }
  return (
    <ol className="flex flex-col gap-2 text-sm text-zinc-200">
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
        Open the browser menu <EllipsisVertical size={18} aria-label="menu" />
      </li>
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
        Tap <b>Install app</b> or <b>Add to Home screen</b>
      </li>
    </ol>
  );
}

/** Bottom card inviting phone users to install the app. */
export function InstallPrompt() {
  const { deferred, installed, platform } = useInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (installed || platform === 'desktop' || installDismissedRecently()) return;
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [installed, platform]);

  if (!visible || installed) return null;

  const close = () => {
    dismissInstall();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" role="dialog" aria-label="Install the app">
      <div className="animate-sheet mx-auto max-w-md rounded-2xl bg-zinc-800 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">Get the Grandmaster app</div>
            <div className="text-sm text-zinc-400">Full screen, on your home screen, and works offline. No app store needed.</div>
          </div>
          <IconButton label="Not now" onClick={close} className="-mr-2 -mt-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="mt-3">
          {deferred ? (
            <Button
              variant="primary"
              className="w-full"
              onClick={async () => {
                const accepted = await promptInstall();
                if (!accepted) close();
              }}
            >
              <Download size={18} /> Install app
            </Button>
          ) : (
            <InstallSteps />
          )}
        </div>
      </div>
    </div>
  );
}

/** Row for the Settings dialog (also useful on desktop). */
export function InstallSettingsRow() {
  const { deferred, installed, platform } = useInstall();
  if (installed) return <p className="text-sm text-emerald-400">Installed on this device.</p>;
  if (deferred) {
    return (
      <Button className="w-full" onClick={() => void promptInstall()}>
        <Download size={16} /> Install app
      </Button>
    );
  }
  if (platform === 'desktop') return <p className="text-xs text-zinc-400">On your phone, open this site to install it as an app.</p>;
  return <InstallSteps />;
}

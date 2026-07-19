import { Crown, RotateCcw } from 'lucide-react';
import { useChessStore } from '../../features/chess/store/chessStore';

export default function Header() {
  const resetGame = useChessStore((state) => state.resetGame);

  return (
    <header className="w-full bg-slate-900/60 backdrop-blur-md border-b border-slate-800 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-amber-500 to-amber-300 p-2 rounded-lg text-slate-950 shadow-lg shadow-amber-500/20">
          <Crown className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-amber-50 tracking-tight leading-none">
            Grandmaster <span className="text-amber-400 font-medium text-lg">Chess</span>
          </h1>
          <p className="font-mono text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
            Grandmaster Edition
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={resetGame}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-400 font-sans text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 border border-slate-700/50 shadow-md active:scale-95 cursor-pointer"
          title="Reset board state to initial"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Board</span>
        </button>
      </div>
    </header>
  );
}

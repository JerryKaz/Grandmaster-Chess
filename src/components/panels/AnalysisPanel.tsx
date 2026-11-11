import { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Cpu, Download, FileUp, GraduationCap, Loader2, Sparkles, X } from 'lucide-react';
import type { LiveAnalysis } from '../../hooks/useGameHooks';
import { buildPgn, fenAt, parseImport, pvToSan, sideToMove } from '../../lib/game';
import { CLASS_META, formatEval, scoreToCp, winPercent } from '../../lib/review';
import type { MoveClass, MoveInput, ReviewData } from '../../lib/types';
import { parseUci } from '../../../shared/rules';
import { useGame } from '../../store/game';
import { cancelReview, startReview } from '../../store/reviewRunner';
import { toast } from '../../store/ui';
import { MoveTable } from '../game/MoveList';
import { Button, Dialog, Label, Toggle, cx } from '../ui/kit';
import { OpeningLabel, ResultBanner } from './GamePanel';

function EngineLines({ analysis, fen, onPlay }: { analysis: LiveAnalysis | null; fen: string; onPlay: (uci: string) => void }) {
  if (!analysis || analysis.lines.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-sm text-zinc-400">
        <Loader2 size={14} className="animate-spin" /> Calculating…
      </div>
    );
  }
  const firstNo = Number(fen.split(' ')[5]) || 1;
  const blackToMove = sideToMove(fen) === 'b';
  return (
    <div className="flex flex-col gap-1">
      {analysis.lines.map((l) => {
        const sans = pvToSan(fen, l.pv, 8);
        const cp = scoreToCp(l.score);
        return (
          <button
            key={l.multipv}
            type="button"
            onClick={() => l.pv[0] && onPlay(l.pv[0])}
            className="flex items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-white/8"
          >
            <span className={cx('w-12 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold tabular-nums', cp >= 0 ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-950 text-zinc-100')}>
              {formatEval(l.score.cp ?? 0, l.score.mate ?? null)}
            </span>
            <span className="line-clamp-1 text-zinc-300">
              {sans.map((san, i) => {
                const idx = i + (blackToMove ? 1 : 0);
                const no = firstNo + Math.floor(idx / 2);
                return (
                  <span key={i}>
                    {idx % 2 === 0 ? `${no}. ` : i === 0 ? `${no}... ` : ''}
                    <span className={i === 0 ? 'font-semibold text-white' : ''}>{san}</span>{' '}
                  </span>
                );
              })}
            </span>
          </button>
        );
      })}
      <div className="px-1.5 text-[11px] text-zinc-500">Stockfish 19 · depth {analysis.depth}</div>
    </div>
  );
}

function EvalGraph({ review, viewPly, onSelect }: { review: ReviewData; viewPly: number; onSelect: (ply: number) => void }) {
  const n = review.evals.length - 1;
  const W = 300;
  const H = 70;
  const pts = review.evals.map((e, i) => [n === 0 ? 0 : (i / n) * W, H - (winPercent(e) / 100) * H] as const);
  const area = `M0,${H} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${W},${H} Z`;
  const cursor = n === 0 ? 0 : (viewPly / n) * W;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-20 w-full cursor-pointer rounded-md bg-zinc-950"
      preserveAspectRatio="none"
      onClick={(e) => {
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        onSelect(Math.round(((e.clientX - rect.left) / rect.width) * n));
      }}
      role="img"
      aria-label="Evaluation graph — click to jump to a move"
    >
      <path d={area} fill="#e4e4e7" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#71717a" strokeWidth="0.5" strokeDasharray="3 3" />
      {review.classes.map((c, i) =>
        c === 'blunder' || c === 'mistake' ? (
          <circle key={i} cx={pts[i + 1][0]} cy={pts[i + 1][1]} r="2.6" fill={CLASS_META[c].color} />
        ) : null,
      )}
      <line x1={cursor} x2={cursor} y1="0" y2={H} stroke="#10b981" strokeWidth="1.5" />
    </svg>
  );
}

const SUMMARY_CLASSES: MoveClass[] = ['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

function ReviewSummary({ review }: { review: ReviewData }) {
  const meta = useGame((s) => s.meta);
  const plies = useGame((s) => s.plies);
  const counts = useMemo(() => {
    const c = { w: {} as Record<MoveClass, number>, b: {} as Record<MoveClass, number> };
    review.classes.forEach((cls, i) => {
      const side = plies[i]?.color ?? 'w';
      c[side][cls] = (c[side][cls] ?? 0) + 1;
    });
    return c;
  }, [review, plies]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(['w', 'b'] as const).map((side) => (
          <div key={side} className={cx('rounded-lg p-2.5 text-center', side === 'w' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-950 text-white ring-1 ring-white/10')}>
            <div className="truncate text-xs opacity-70">{side === 'w' ? meta.white : meta.black}</div>
            <div className="text-2xl font-bold tabular-nums">{review.accuracy[side].toFixed(1)}</div>
            <div className="text-[11px] opacity-60">accuracy</div>
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {SUMMARY_CLASSES.map((cls) => (
            <tr key={cls} className="border-t border-white/5">
              <td className="py-1 text-center tabular-nums text-zinc-200">{counts.w[cls] ?? 0}</td>
              <td className="py-1">
                <span className="flex items-center justify-center gap-1.5 text-xs" style={{ color: CLASS_META[cls].color }}>
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white" style={{ background: CLASS_META[cls].color }}>
                    {CLASS_META[cls].symbol}
                  </span>
                  {CLASS_META[cls].label}
                </span>
              </td>
              <td className="py-1 text-center tabular-nums text-zinc-200">{counts.b[cls] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CoachResult {
  summary: string;
  lastMove: string;
  whitePlan: string;
  blackPlan: string;
}

function Coach({ analysis }: { analysis: LiveAnalysis | null }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewPly = useGame((s) => s.viewPly);
  const gameId = useGame((s) => s.id);

  useEffect(() => {
    fetch('/api/coach')
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
  }, []);
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [viewPly, gameId]);

  if (enabled === false) return null;

  const ask = async () => {
    const s = useGame.getState();
    const fen = fenAt(s.startFen, s.plies, s.viewPly);
    const top = analysis?.lines[0];
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moves: s.plies.map((p) => p.san),
          startFen: s.startFen,
          ply: s.viewPly,
          engine: top && {
            score: formatEval(top.score.cp ?? 0, top.score.mate ?? null),
            bestMove: pvToSan(fen, top.pv, 1)[0],
            line: pvToSan(fen, top.pv, 6).join(' '),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Coach unavailable');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coach unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <GraduationCap size={16} className="text-violet-300" /> AI Coach
        </div>
        <Button className="min-h-9 px-3" onClick={ask} disabled={loading || enabled === null}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Explain position
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      {result && (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">
          <p>{result.summary}</p>
          {result.lastMove && <p className="text-zinc-400"><span className="font-semibold text-zinc-200">Last move: </span>{result.lastMove}</p>}
          <p><span className="font-semibold text-zinc-100">White: </span>{result.whitePlan}</p>
          <p><span className="font-semibold text-zinc-100">Black: </span>{result.blackPlan}</p>
        </div>
      )}
    </div>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Import game" wide>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste a PGN or a FEN…\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5'}
        className="h-48 w-full resize-none rounded-lg bg-black/30 p-3 font-mono text-sm text-white ring-1 ring-white/10 outline-none focus:ring-emerald-400"
      />
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            try {
              const g = parseImport(text);
              useGame.getState().startAnalysis({ startFen: g.startFen, plies: g.plies, meta: { white: g.white ?? 'White', black: g.black ?? 'Black' } });
              useGame.getState().goTo(0);
              setText('');
              setError(null);
              onClose();
            } catch {
              setError("That doesn't look like a valid PGN or FEN.");
            }
          }}
        >
          Load
        </Button>
      </div>
    </Dialog>
  );
}

function playUci(uci: string) {
  const parsed = parseUci(uci);
  if (parsed) useGame.getState().move(parsed as MoveInput);
}

export function downloadPgn() {
  const s = useGame.getState();
  const pgn = buildPgn({ meta: s.meta, startFen: s.startFen, plies: s.plies, result: s.result });
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `game-${new Date(s.meta.startedAt).toISOString().slice(0, 10)}.pgn`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast('Clipboard not available');
  }
}

export function AnalysisPanel({ analysis, engineOn, setEngineOn }: { analysis: LiveAnalysis | null; engineOn: boolean; setEngineOn: (v: boolean) => void }) {
  const plies = useGame((s) => s.plies);
  const viewPly = useGame((s) => s.viewPly);
  const startFen = useGame((s) => s.startFen);
  const review = useGame((s) => s.review);
  const progress = useGame((s) => s.reviewProgress);
  const goTo = useGame((s) => s.goTo);
  const [importOpen, setImportOpen] = useState(false);
  const fen = fenAt(startFen, plies, viewPly);
  const firstNo = Number(startFen.split(' ')[5]) || 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold text-white">{review ? 'Game review' : 'Analysis'}</h2>
        <OpeningLabel />
      </div>
      <ResultBanner />

      {progress !== null && (
        <div className="rounded-lg bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
            <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Reviewing moves…</span>
            <button type="button" aria-label="Cancel review" onClick={cancelReview} className="text-zinc-400 hover:text-white"><X size={16} /></button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {review && (
        <>
          <EvalGraph review={review} viewPly={viewPly} onSelect={goTo} />
          <ReviewSummary review={review} />
        </>
      )}
      {!review && progress === null && plies.length > 1 && (
        <Button variant="primary" onClick={() => void startReview()}>
          <Sparkles size={16} /> Run game review
        </Button>
      )}

      <div className="rounded-lg bg-black/20 px-3 py-1">
        <Toggle checked={engineOn} onChange={setEngineOn} label="Engine" description="Stockfish lines & eval bar" />
        {engineOn && progress === null && <div className="pb-2"><EngineLines analysis={analysis} fen={fen} onPlay={playUci} /></div>}
      </div>

      <Coach analysis={analysis} />

      <div className="min-h-40 flex-1 overflow-hidden rounded-lg bg-black/20 lg:flex lg:flex-col">
        <MoveTable plies={plies} viewPly={viewPly} firstMoveNumber={firstNo} blackFirst={sideToMove(startFen) === 'b'} classes={review?.classes} onSelect={goTo} />
      </div>

      <div>
        <Label>Game data</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setImportOpen(true)}><FileUp size={16} /> Import</Button>
          <Button onClick={downloadPgn} disabled={plies.length === 0}><Download size={16} /> PGN</Button>
          <Button onClick={() => { const s = useGame.getState(); void copy(buildPgn({ meta: s.meta, startFen: s.startFen, plies: s.plies, result: s.result }), 'PGN'); }} disabled={plies.length === 0}>
            <ClipboardCopy size={16} /> Copy PGN
          </Button>
          <Button onClick={() => void copy(fen, 'FEN')}><Cpu size={16} /> Copy FEN</Button>
        </div>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

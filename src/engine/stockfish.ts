/**
 * Thin, promise-based UCI client around the Stockfish WASM web worker.
 * - Runs off the main thread, so the UI never freezes while the engine thinks.
 * - Searches are serialised; an aborted search sends `stop` and resolves to null.
 */

export interface EngineScore {
  cp?: number;
  mate?: number;
}

export interface EngineLine {
  multipv: number;
  depth: number;
  /** Score from the side-to-move's point of view (raw UCI). */
  score: EngineScore;
  pv: string[];
}

export interface SearchOptions {
  fen: string;
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** UCI options to apply before this search (only changed values are re-sent). */
  options?: Record<string, string | number | boolean>;
  onInfo?: (lines: EngineLine[]) => void;
  signal?: AbortSignal;
}

export interface SearchResult {
  bestmove: string | null;
  lines: EngineLine[];
}

const ENGINE_URL = '/engine/stockfish-19-lite-single.js';

interface ActiveSearch {
  lines: Map<number, EngineLine>;
  onInfo?: (lines: EngineLine[]) => void;
  resolve: (r: SearchResult | null) => void;
  aborted: boolean;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private booting: Promise<void> | null = null;
  private waiters: { token: string; resolve: () => void }[] = [];
  private active: ActiveSearch | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private sentOptions = new Map<string, string>();
  private failed = false;

  get unavailable() {
    return this.failed;
  }

  private boot(): Promise<void> {
    if (this.booting) return this.booting;
    this.booting = new Promise<void>((resolve, reject) => {
      try {
        if (typeof WebAssembly !== 'object') throw new Error('WebAssembly not supported');
        this.worker = new Worker(ENGINE_URL);
      } catch (err) {
        this.failed = true;
        reject(err);
        return;
      }
      this.worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
      this.worker.onerror = (e) => {
        this.failed = true;
        console.error('[engine] worker error', e.message);
        reject(new Error('Engine failed to load'));
        this.active?.resolve(null);
        this.active = null;
      };
      this.post('uci');
      this.waitFor('uciok')
        .then(() => {
          this.post('setoption name Hash value 16');
          this.post('isready');
          return this.waitFor('readyok');
        })
        .then(resolve, reject);
    });
    return this.booting;
  }

  private post(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(token: string): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ token, resolve }));
  }

  private onLine(line: string) {
    const first = line.split(' ', 1)[0];
    const idx = this.waiters.findIndex((w) => w.token === first);
    if (idx !== -1) {
      this.waiters.splice(idx, 1)[0].resolve();
      return;
    }
    const search = this.active;
    if (!search) return;

    if (first === 'info') {
      const parsed = parseInfo(line);
      if (!parsed) return;
      search.lines.set(parsed.multipv, parsed);
      if (!search.aborted && search.onInfo) search.onInfo(sortedLines(search.lines));
    } else if (first === 'bestmove') {
      const move = line.split(' ')[1];
      this.active = null;
      search.resolve(
        search.aborted ? null : { bestmove: move && move !== '(none)' ? move : null, lines: sortedLines(search.lines) },
      );
    }
  }

  search(opts: SearchOptions): Promise<SearchResult | null> {
    const run = async (): Promise<SearchResult | null> => {
      if (opts.signal?.aborted) return null;
      await this.boot();
      if (opts.signal?.aborted) return null;

      const options = { MultiPV: opts.multipv ?? 1, ...opts.options };
      let changed = false;
      for (const [name, value] of Object.entries(options)) {
        const v = String(value);
        if (this.sentOptions.get(name) === v) continue;
        this.sentOptions.set(name, v);
        this.post(`setoption name ${name} value ${v}`);
        changed = true;
      }
      if (changed) {
        this.post('isready');
        await this.waitFor('readyok');
      }

      return new Promise<SearchResult | null>((resolve) => {
        const search: ActiveSearch = { lines: new Map(), onInfo: opts.onInfo, resolve, aborted: false };
        this.active = search;
        const onAbort = () => {
          search.aborted = true;
          this.post('stop');
        };
        opts.signal?.addEventListener('abort', onAbort, { once: true });
        this.post(`position fen ${opts.fen}`);
        const limits = [
          opts.depth ? `depth ${opts.depth}` : '',
          opts.movetime ? `movetime ${opts.movetime}` : '',
        ].join(' ').trim();
        this.post(`go ${limits || 'depth 12'}`);
      });
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.booting = null;
    this.sentOptions.clear();
  }
}

function parseInfo(line: string): EngineLine | null {
  const t = line.split(' ');
  const pvAt = t.indexOf('pv');
  if (pvAt === -1 || t.includes('lowerbound') || t.includes('upperbound')) return null;
  const num = (key: string) => {
    const i = t.indexOf(key);
    return i === -1 ? undefined : Number(t[i + 1]);
  };
  const scoreAt = t.indexOf('score');
  if (scoreAt === -1) return null;
  const score: EngineScore = t[scoreAt + 1] === 'mate' ? { mate: Number(t[scoreAt + 2]) } : { cp: Number(t[scoreAt + 2]) };
  return { multipv: num('multipv') ?? 1, depth: num('depth') ?? 0, score, pv: t.slice(pvAt + 1) };
}

function sortedLines(map: Map<number, EngineLine>): EngineLine[] {
  return [...map.values()].sort((a, b) => a.multipv - b.multipv);
}

let playEngine: StockfishEngine | null = null;
let analysisEngine: StockfishEngine | null = null;

/** Engine used by computer opponents. */
export const getPlayEngine = () => (playEngine ??= new StockfishEngine());
/** Engine used for the eval bar, hints, analysis lines and game review. */
export const getAnalysisEngine = () => (analysisEngine ??= new StockfishEngine());

/** Score converted to White's point of view. */
export function whitePov(score: EngineScore, fen: string): EngineScore {
  const blackToMove = fen.split(' ')[1] === 'b';
  if (!blackToMove) return score;
  return score.mate !== undefined ? { mate: -score.mate } : { cp: -(score.cp ?? 0) };
}

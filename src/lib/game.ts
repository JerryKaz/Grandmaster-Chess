import { Chess, DEFAULT_POSITION, type Move } from 'chess.js';
import { parseUci, resultToPgn } from '../../shared/rules';
import type { ArchivedGame, GameMeta, GameResult, MoveInput, PieceSymbol, Ply, Side, Square } from './types';

export const START_FEN = DEFAULT_POSITION;

export function toPly(m: Move, spentMs?: number): Ply {
  return {
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    from: m.from,
    to: m.to,
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
    flags: m.flags,
    fen: m.after,
    spentMs,
  };
}

/** Rebuild a chess.js instance with full history (needed for repetition detection). */
export function replay(startFen: string, plies: Pick<Ply, 'from' | 'to' | 'promotion'>[], upto = plies.length): Chess {
  const chess = new Chess(startFen);
  for (let i = 0; i < upto; i++) {
    const p = plies[i];
    chess.move({ from: p.from, to: p.to, promotion: p.promotion });
  }
  return chess;
}

/** Turn a list of UCI moves into plies; throws on an illegal move. */
export function pliesFromUci(startFen: string, moves: string[]): Ply[] {
  const chess = new Chess(startFen);
  return moves.map((uci) => {
    const parsed = parseUci(uci);
    if (!parsed) throw new Error(`Bad move ${uci}`);
    return toPly(chess.move(parsed));
  });
}

export function tryMove(chess: Chess, input: MoveInput | { from: string; to: string; promotion?: string }): Move | null {
  try {
    return chess.move(input);
  } catch {
    return null;
  }
}

export function fenAt(startFen: string, plies: Ply[], ply: number): string {
  return ply <= 0 ? startFen : plies[Math.min(ply, plies.length) - 1].fen;
}

export function sideToMove(fen: string): Side {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Legal destinations per origin square, for the side to move. */
export function legalDests(fen: string): Map<Square, Square[]> {
  const chess = new Chess(fen);
  const dests = new Map<Square, Square[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from);
    if (list) {
      if (!list.includes(m.to)) list.push(m.to);
    } else dests.set(m.from, [m.to]);
  }
  return dests;
}

export function isPromotion(fen: string, from: Square, to: Square): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
}

export function kingInCheckSquare(fen: string): Square | null {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return null;
  const side = chess.turn();
  for (const row of chess.board()) {
    for (const sq of row) if (sq && sq.type === 'k' && sq.color === side) return sq.square;
  }
  return null;
}

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNTS: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** Pieces each side has captured (derived from the position) and the material balance. */
export function materialInfo(fen: string) {
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
  const board = fen.split(' ')[0];
  for (const ch of board) {
    if (!/[pnbrqkPNBRQK]/.test(ch)) continue;
    const side = ch === ch.toUpperCase() ? 'w' : 'b';
    counts[side][ch.toLowerCase() as PieceSymbol]++;
  }
  const captured = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] }; // pieces captured BY side
  let score = 0;
  for (const t of ['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]) {
    score += (counts.w[t] - counts.b[t]) * VALUES[t];
    for (let i = counts.b[t]; i < START_COUNTS[t]; i++) captured.w.push(t);
    for (let i = counts.w[t]; i < START_COUNTS[t]; i++) captured.b.push(t);
  }
  return { captured, diff: score }; // diff > 0 means White is ahead
}

export function buildPgn(opts: {
  meta: GameMeta;
  startFen: string;
  plies: Ply[];
  result: GameResult | null;
  event?: string;
}): string {
  const { meta, startFen, plies, result } = opts;
  const date = new Date(meta.startedAt || Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  const tags: [string, string][] = [
    ['Event', opts.event ?? 'Casual game'],
    ['Site', 'Grandmaster Chess'],
    ['Date', `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`],
    ['White', meta.white],
    ['Black', meta.black],
    ['Result', resultToPgn(result)],
    ['TimeControl', meta.tc.initial > 0 ? `${meta.tc.initial}+${meta.tc.increment}` : '-'],
  ];
  if (startFen !== START_FEN) tags.push(['SetUp', '1'], ['FEN', startFen]);
  if (result) tags.push(['Termination', result.reason]);

  const startsWithBlack = sideToMove(startFen) === 'b';
  const startNo = Number(startFen.split(' ')[5]) || 1;
  const parts: string[] = [];
  plies.forEach((p, i) => {
    const idx = i + (startsWithBlack ? 1 : 0);
    const no = startNo + Math.floor(idx / 2);
    if (idx % 2 === 0) parts.push(`${no}.`);
    else if (i === 0) parts.push(`${no}...`);
    parts.push(p.san);
  });
  parts.push(resultToPgn(result));
  const header = tags.map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`).join('\n');
  return `${header}\n\n${parts.join(' ')}\n`;
}

/** Parse PGN or FEN text for the analysis board. */
export function parseImport(text: string): { startFen: string; plies: Ply[]; white?: string; black?: string } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Paste a PGN or FEN first.');
  // A bare FEN has 6 space-separated fields and a board with 7 slashes.
  if (/^[pnbrqkPNBRQK1-8]+(\/[pnbrqkPNBRQK1-8]+){7}\s+[wb]\s/.test(trimmed)) {
    const chess = new Chess();
    chess.load(trimmed); // throws on invalid FEN
    return { startFen: chess.fen(), plies: [] };
  }
  const chess = new Chess();
  chess.loadPgn(trimmed); // throws on invalid PGN
  const headers = chess.getHeaders();
  const startFen = headers.FEN ?? START_FEN;
  const verbose = chess.history({ verbose: true });
  return { startFen, plies: verbose.map((m) => toPly(m)), white: headers.White, black: headers.Black };
}

export function squareCoords(square: Square, orientation: Side): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === 'w' ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank };
}

export function coordsToSquare(x: number, y: number, orientation: Side): Square | null {
  if (x < 0 || x > 7 || y < 0 || y > 7) return null;
  const file = orientation === 'w' ? x : 7 - x;
  const rank = orientation === 'w' ? 7 - y : y;
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}

export function uciToSan(fen: string, uci: string): string | null {
  const parsed = parseUci(uci);
  if (!parsed) return null;
  const m = tryMove(new Chess(fen), parsed);
  return m ? m.san : null;
}

/** Convert a UCI principal variation to SAN for display. */
export function pvToSan(fen: string, pv: string[], max = 8): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    const parsed = parseUci(uci);
    const m = parsed && tryMove(chess, parsed);
    if (!m) break;
    out.push(m.san);
  }
  return out;
}

/** Defensive check for archived games coming from storage or the server. */
export function isArchivedGame(g: unknown): g is ArchivedGame {
  if (!g || typeof g !== 'object') return false;
  const x = g as Partial<ArchivedGame>;
  return (
    typeof x.id === 'string' &&
    typeof x.startFen === 'string' &&
    Array.isArray(x.moves) &&
    typeof x.endedAt === 'number' &&
    !!x.result && typeof x.result === 'object' && 'winner' in x.result &&
    !!x.meta && typeof x.meta.white === 'string' && typeof x.meta.black === 'string' && !!x.meta.tc
  );
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

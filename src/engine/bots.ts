import { Chess } from 'chess.js';
import { getPlayEngine, whitePov } from './stockfish';
import { scoreToCp } from '../lib/review';

export interface BotLevel {
  id: number;
  name: string;
  elo: string;
  blurb: string;
  /** Chance of playing a random legal move instead of thinking (simulates beginner mistakes). */
  randomness: number;
  depth?: number;
  movetime: number;
  options: Record<string, string | number | boolean>;
}

// Stockfish's UCI_Elo floor is 1320, so the lowest levels are weakened with Skill Level,
// shallow depth and a chance of an outright random move. Elo figures are approximate.
export const BOT_LEVELS: BotLevel[] = [
  { id: 1, name: 'Rookie', elo: '≈400', blurb: 'Knows how the pieces move. Mostly.', randomness: 0.45, depth: 1, movetime: 50, options: { 'UCI_LimitStrength': false, 'Skill Level': 0 } },
  { id: 2, name: 'Casual', elo: '≈700', blurb: 'Likes to attack, forgets to defend.', randomness: 0.22, depth: 2, movetime: 80, options: { 'UCI_LimitStrength': false, 'Skill Level': 0 } },
  { id: 3, name: 'Club', elo: '≈1000', blurb: 'Solid basics, misses tactics.', randomness: 0.08, depth: 4, movetime: 150, options: { 'UCI_LimitStrength': false, 'Skill Level': 2 } },
  { id: 4, name: 'Intermediate', elo: '≈1400', blurb: 'Punishes loose pieces.', randomness: 0, movetime: 300, options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 1400 } },
  { id: 5, name: 'Advanced', elo: '≈1800', blurb: 'Plans ahead and converts advantages.', randomness: 0, movetime: 500, options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 1800 } },
  { id: 6, name: 'Expert', elo: '≈2200', blurb: 'Tournament-strength play.', randomness: 0, movetime: 700, options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 2200 } },
  { id: 7, name: 'Master', elo: '≈2600', blurb: 'Rarely makes a mistake.', randomness: 0, movetime: 900, options: { 'Skill Level': 20, 'UCI_LimitStrength': true, 'UCI_Elo': 2600 } },
  { id: 8, name: 'Stockfish', elo: 'Max', blurb: 'Full strength. Good luck.', randomness: 0, movetime: 1200, options: { 'Skill Level': 20, 'UCI_LimitStrength': false } },
];

export function getBotLevel(id: number | undefined): BotLevel {
  return BOT_LEVELS.find((l) => l.id === id) ?? BOT_LEVELS[3];
}

export interface BotMove {
  uci: string;
  /** Bot's own evaluation from White's perspective (cp), if it searched. */
  evalCp: number | null;
}

/**
 * Pick a move for the bot. `clockMs` is the bot's remaining time (null = untimed),
 * used to avoid flagging in fast games.
 */
export async function chooseBotMove(
  fen: string,
  levelId: number,
  clockMs: number | null,
  signal: AbortSignal,
): Promise<BotMove | null> {
  const level = getBotLevel(levelId);
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null;

  if (Math.random() < level.randomness) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { uci: m.from + m.to + (m.promotion ?? ''), evalCp: null };
  }

  const movetime = clockMs === null ? level.movetime : Math.max(50, Math.min(level.movetime, clockMs / 40));
  const result = await getPlayEngine().search({
    fen,
    depth: level.depth,
    movetime: level.depth ? undefined : Math.round(movetime),
    options: level.options,
    signal,
  });
  if (!result?.bestmove) return null;
  const top = result.lines[0];
  return { uci: result.bestmove, evalCp: top ? scoreToCp(whitePov(top.score, fen)) : null };
}

import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { Chess } from 'chess.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const RATE_LIMIT_PER_MIN = 12;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Small in-memory limiter: protects the API key from being drained by one client.
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > RATE_LIMIT_PER_MIN;
}

interface CoachRequest {
  moves: string[]; // SAN
  startFen?: string;
  ply?: number;
  engine?: { score: string; bestMove?: string; line?: string };
}

export function coachStatus(_req: Request, res: Response) {
  res.json({ enabled: !!process.env.GEMINI_API_KEY });
}

export async function coachHandler(req: Request, res: Response) {
  const ai = getClient();
  if (!ai) {
    return res.status(503).json({ error: 'The AI coach is not configured on this server (missing GEMINI_API_KEY).' });
  }
  if (rateLimited(req.ip ?? 'unknown')) {
    return res.status(429).json({ error: 'Too many coach requests. Wait a minute and try again.' });
  }

  const body = req.body as CoachRequest;
  if (!Array.isArray(body?.moves) || body.moves.length > 600) {
    return res.status(400).json({ error: 'Invalid move list' });
  }

  // Replay the game server-side so the model only ever sees a legal, verified position.
  const chess = new Chess();
  try {
    if (body.startFen) chess.load(String(body.startFen));
    const upto = Math.min(Number.isInteger(body.ply) ? body.ply! : body.moves.length, body.moves.length);
    for (let i = 0; i < upto; i++) chess.move(String(body.moves[i]));
  } catch {
    return res.status(400).json({ error: 'Moves do not form a legal game' });
  }

  const history = chess.history();
  const lastMove = history.at(-1);
  const pgn = chess.pgn({ maxWidth: 0 }) || '(no moves yet)';
  const engine = body.engine
    ? `Engine evaluation (White's perspective): ${String(body.engine.score).slice(0, 16)}. ` +
      `Engine best move: ${String(body.engine.bestMove ?? 'n/a').slice(0, 12)}. ` +
      `Principal line: ${String(body.engine.line ?? 'n/a').slice(0, 120)}.`
    : 'No engine evaluation available.';

  const prompt = `You are a friendly, precise chess coach. Explain the position to a club player.
Ground every claim in the data below. Do not invent moves that are not legal in this position.

Game so far (PGN): ${pgn}
Current position (FEN): ${chess.fen()}
Side to move: ${chess.turn() === 'w' ? 'White' : 'Black'}
${engine}

Respond with: a 2-3 sentence summary of the position (material, king safety, pawn structure, activity);
a short comment on the last move ${lastMove ? `(${lastMove})` : '(none, starting position)'};
and one concrete plan each for White and Black.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            lastMove: { type: Type.STRING },
            whitePlan: { type: Type.STRING },
            blackPlan: { type: Type.STRING },
          },
          required: ['summary', 'lastMove', 'whitePlan', 'blackPlan'],
        },
      },
    });
    res.json(JSON.parse(response.text ?? '{}'));
  } catch (err) {
    console.error('[coach] Gemini request failed:', err);
    res.status(502).json({ error: 'The AI coach is unavailable right now. Try again shortly.' });
  }
}

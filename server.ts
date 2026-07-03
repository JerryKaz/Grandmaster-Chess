import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Lazy initialization helper for Gemini
let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

function evaluateHeuristics(board: any[][]): number {
  if (!board || !Array.isArray(board)) return 0;
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (piece) {
        let val = 0;
        switch (piece.type) {
          case 'pawn': val = 100; break;
          case 'knight': val = 320; break;
          case 'bishop': val = 330; break;
          case 'rook': val = 500; break;
          case 'queen': val = 900; break;
          case 'king': val = 20000; break;
        }
        if (piece.color === 'white') score += val;
        else score -= val;
      }
    }
  }
  return score;
}

// Define Types for Multiplayer rooms
interface RoomState {
  id: string;
  whitePlayerJoined: boolean;
  blackPlayerJoined: boolean;
  board: any[][];
  activeColor: 'white' | 'black';
  moveHistory: any[];
  capturedPieces: {
    white: any[];
    black: any[];
  };
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  winner: 'white' | 'black' | null;
  lastUpdated: number;
}

// In-memory rooms database for Multiplayer mode
const rooms = new Map<string, RoomState>();

// Clean up rooms older than 4 hours regularly
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastUpdated > 4 * 60 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}, 30 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API: Create Multiplayer Room
  app.post("/api/rooms/create", (req, res) => {
    const { board } = req.body;
    // Generate a random 4-letter room ID
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let roomId = "";
    for (let i = 0; i < 4; i++) {
      roomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const room: RoomState = {
      id: roomId,
      whitePlayerJoined: true, // Creator is White by default
      blackPlayerJoined: false,
      board: board || [],
      activeColor: 'white',
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      winner: null,
      lastUpdated: Date.now(),
    };

    rooms.set(roomId, room);
    res.json({ roomId, playerColor: 'white' });
  });

  // 4. API: Join Multiplayer Room
  app.post("/api/rooms/join", (req, res) => {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const upperRoomId = roomId.trim().toUpperCase();
    const room = rooms.get(upperRoomId);

    if (!room) {
      return res.status(404).json({ error: "Chess room not found. Please verify the code." });
    }

    if (room.blackPlayerJoined) {
      return res.status(400).json({ error: "This room is already full with two players." });
    }

    room.blackPlayerJoined = true;
    room.lastUpdated = Date.now();

    res.json({ roomId: upperRoomId, playerColor: 'black' });
  });

  // 5. API: Get Multiplayer Room State
  app.get("/api/rooms/:id", (req, res) => {
    const roomId = req.params.id.toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  });

  // 6. API: Synchronize Multiplayer Move
  app.post("/api/rooms/:id/move", (req, res) => {
    const roomId = req.params.id.toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const { board, activeColor, moveHistory, capturedPieces, isCheck, isCheckmate, isStalemate, winner } = req.body;

    room.board = board;
    room.activeColor = activeColor;
    room.moveHistory = moveHistory;
    room.capturedPieces = capturedPieces;
    room.isCheck = isCheck;
    room.isCheckmate = isCheckmate;
    room.isStalemate = isStalemate;
    room.winner = winner;
    room.lastUpdated = Date.now();

    res.json(room);
  });

  // 7. API: Reset Room State
  app.post("/api/rooms/:id/reset", (req, res) => {
    const roomId = req.params.id.toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const { board } = req.body;
    room.board = board;
    room.activeColor = 'white';
    room.moveHistory = [];
    room.capturedPieces = { white: [], black: [] };
    room.isCheck = false;
    room.isCheckmate = false;
    room.isStalemate = false;
    room.winner = null;
    room.lastUpdated = Date.now();

    res.json(room);
  });

  // 8. API: AI Analysis (Gemini Integration)
  app.post("/api/analyze", async (req, res) => {
    try {
      const { moveHistory, board, activeColor } = req.body;

      // Check if GEMINI_API_KEY is configured
      if (!process.env.GEMINI_API_KEY) {
        // Fallback: Use simple local evaluation metrics if API key is absent
        const materialBalance = evaluateHeuristics(board);
        return res.json({
          score: materialBalance / 100.0,
          summary: "Local Engine Analysis: White has a material balance score of " + (materialBalance >= 0 ? "+" : "") + (materialBalance / 100).toFixed(1) + ". To unlock grandmaster-level coaching commentary, dynamic plan suggestions, and tactical coaching, please configure your GEMINI_API_KEY in the environment!",
          whitePlan: "Control the center (e4/d4 squares), castle early to secure your king, develop your minor pieces (knights and bishops), and establish active rooks on open files.",
          blackPlan: "Challenge White's center with d5 or e5, develop knights to f6/c6, secure your king, and search for tactical patterns like pawn levers to gain counterplay.",
          lastMoveCommentary: moveHistory && moveHistory.length > 0 
            ? `The last move played was ${moveHistory[moveHistory.length - 1].notation}. Position is complex with dynamic tactical lines.`
            : "The game is currently in the starting setup. Standard opening principles apply."
        });
      }

      // Initialize client lazily
      const ai = getGeminiClient();

      // Format current board pieces for Gemini's understanding
      let boardDescription = "";
      for (let r = 0; r < 8; r++) {
        const rank = 8 - r;
        const piecesInRow = [];
        for (let c = 0; c < 8; c++) {
          const piece = board[r]?.[c];
          if (piece) {
            const file = String.fromCharCode(97 + c);
            piecesInRow.push(`${piece.color} ${piece.type} at ${file}${rank}`);
          }
        }
        if (piecesInRow.length > 0) {
          boardDescription += `Rank ${rank}: ${piecesInRow.join(", ")}; `;
        }
      }

      // Format move history
      const movesText = moveHistory && moveHistory.length > 0
        ? moveHistory.map((m: any, idx: number) => {
            const num = Math.floor(idx / 2) + 1;
            const isWhite = idx % 2 === 0;
            return isWhite ? `${num}. ${m.notation}` : `${m.notation}`;
          }).join(" ")
        : "No moves played yet.";

      const prompt = `You are an elite Chess Grandmaster and Coaching Assistant. Analyze the following chess position.
Active player to move next: ${activeColor}
Moves played in this game: ${movesText}
Current piece positions: ${boardDescription}

Provide your expert analysis of this specific position. Your response must be in strict JSON format.

Expected JSON schema:
{
  "score": number, // Estimated position score from White's perspective, e.g., +1.2 if White is better, -0.5 if Black is better. Standard 0.0 for equal.
  "summary": "string", // High-quality 2-3 sentence overview of the positional balance, pawn structures, king safety, and active files.
  "whitePlan": "string", // Clear, strategic recommendations and future plans for White in this position.
  "blackPlan": "string", // Clear, strategic recommendations and future plans for Black in this position.
  "lastMoveCommentary": "string" // Explanatory coaching commentary about the tactical or positional quality of the very last move.
}

Return ONLY the raw JSON object. Do not wrap it in markdown codeblocks.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "";
      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Analysis Error:", err);
      res.status(500).json({ error: "Failed to generate position analysis: " + err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

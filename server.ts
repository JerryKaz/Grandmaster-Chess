import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

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
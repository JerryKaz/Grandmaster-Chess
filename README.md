#  Full-Stack Chess with AI Opponents, Multiplayer & AI Coach

A state-of-the-art, visually stunning, fully-featured, and modern full-stack Chess application. This project is built using a React (Vite) + Tailwind CSS front-end and a secure Node.js + Express backend. 

The application incorporates a custom client-side chess rule validator, an integrated offline chess engine with customizable difficulty levels, online multiplayer matchmaking, and an **AI Chess Coach** powered by Gemini to provide real-time strategic commentary and tactical feedback.

---

##  Key Features

### 1. Game Modes
*   **Local Play (Pass-and-Play):** Play chess face-to-face on a single screen with standard chess rules, castling rights, en-passant captures, pawn promotions, and automated check/checkmate detection.
*   **vs AI Opponents:** Play against local artificial intelligence with four selectable difficulty settings (`easy`, `medium`, `hard`, `gemini`). Includes options to play as White or Black and dynamically flips the board perspective.
*   **Multiplayer (Two-Player Online Matchmaking):** Set up private or shared online rooms instantly. Features real-time state synchronization, automated side selection, spectator views, and real-time status notifications.

### 2. Deep AI Engine & Difficulty Matrix
*   **Opening Book Integration:** Uses an integrated database of chess opening theory (e.g., King's Pawn, Queen's Gambit, Sicilian Defense) so AI opponents follow standard grandmaster opening theory before entering mid-game calculation.
*   **Multi-Depth Minimax Search:**
    *   **Easy (ELO 800):** Depth 1 search with a 40% probability of choosing a random legal move to simulate a learning beginner.
    *   **Medium (ELO 1500):** Depth 2 minimax evaluation utilizing piece-square weight heuristics.
    *   **Hard (ELO 2100):** Depth 3 minimax evaluation with alpha-beta pruning for deep calculation.
    *   **Gemini Oracle (ELO 2800+):** Advanced Depth 3 minimax search combined with optimized position calculations.

### 3. Real-Time Gemini AI Coach & Post-Move Analysis
*   The interactive **AI Coach** tab sits right next to your move history.
*   With a single click, users can request an instant comprehensive positional analysis of the board from Gemini (`gemini-2.5-flash`).
*   **What the AI Coach Analyzes:**
    *   **Engine Score:** Estimated material and positional balance (e.g., `+1.2` for White advantage, `-0.5` for Black advantage) represented visually with a dynamic evaluation meter.
    *   **Coach Summary:** A highly readable tactical breakdown of current king safety, open files, active pieces, and pawn structure.
    *   **Last Move Insight:** Intelligent feedback on the quality, safety, or purpose of the very last move played.
    *   **Recommended Strategic Plans:** Two tailored guides detailing recommended paths of action for both White and Black.
*   **Resilient Fallback System:** If the user has not configured a `GEMINI_API_KEY` environment variable, the server automatically engages a local heuristics engine that evaluates exact board material balance and guides the user on how to configure their API key to unlock the grandmaster coaching commentary.

### 4. High-Fidelity UX & Responsive Design
*   **Cosmic Dark Theme:** Beautiful slate-colored dark visual canvas with vibrant violet and high-contrast accents.
*   **Fluid Animations:** Built with `motion` layouts to animate piece dragging, board rotation, sliding indicators, and active overlays.
*   **Soundscapes:** Built-in web audio context synthesizing crisp, organic retro sound effects for moves, captures, check notifications, and game completions.
*   **Clock Timers:** Professional dual chess clocks with flexible customizable time limits.

---

## Tech Stack & Architecture

### Frontend
*   **Framework:** React 18+ (with Vite)
*   **Language:** TypeScript
*   **State Management:** Zustand (centralized chess board state, move history, active color, sound options, game configuration, and timer parameters)
*   **Styling:** Tailwind CSS (utility-first, responsive grid, visual states)
*   **Animations:** `motion/react`
*   **Icons:** `lucide-react`

### Backend
*   **Server Engine:** Node.js with Express
*   **Runtime Compiler:** `tsx` (development) and `esbuild` (production bundling into a single self-contained CommonJS `dist/server.cjs`)
*   **Generative AI:** `@google/genai` (Official SDK utilizing the fast, instruction-following `gemini-2.5-flash` model)

---

##  System Architecture & Folder Structure

The code is cleanly modularized into separate areas of concern to make sure it is easy to maintain:

```
├── server.ts                       # Full-stack Express server (API endpoints & static serving)
├── package.json                    # Scripts and dependencies
├── metadata.json                   # App permissions and features declaration
├── src/
│   ├── main.tsx                    # React client entry point
│   ├── App.tsx                     # Main Dashboard Layout, Sidebar Controller, and Modal Overlays
│   ├── index.css                   # Global CSS (Imports tailwindcss & fonts)
│   ├── components/
│   │   └── board/
│   │       ├── ChessBoard.tsx      # Multi-perspective rendering grid (White/Black flip controller)
│   │       └── BoardSquare.tsx     # Grid tile containing pieces, move highlights, and event listeners
│   └── features/
│       └── chess/
│           ├── engine/
│           │   └── chessEngine.ts  # Rules engine, move validation, minimax calculator, & opening book
│           ├── models/
│           │   └── types.ts        # Shared TypeScript type interfaces, schemas, and coordinates
│           └── store/
│               └── chessStore.ts   # Centralized Zustand client store managing game flow
```

---

##  Deep Dive: How the AI & Analysis Work

### 1. MiniMax Rules Validation & Calculations (`chessEngine.ts`)
The chess engine implements legal move generation without heavy external dependencies. The core evaluation function assigns strategic value scores based on piece weight metrics:
*   **Pawn:** 100 points
*   **Knight:** 320 points
*   **Bishop:** 330 points
*   **Rook:** 500 points
*   **Queen:** 900 points
*   **King:** 20,000 points

The `minimax` algorithm searches the game tree to a specified depth (controlled by difficulty). It simulates turns back and forth, using **Alpha-Beta Pruning** to cut off computation lines that are guaranteed to yield suboptimal results for the active player, improving response times.

### 2. Real-Time Gemini Coach API (`server.ts`)
The `/api/analyze` POST route serves as the bridge between your live match and the Gemini model:

```ts
// Example of the payload format transmitted from the client
{
  "board": [ [ { "type": "rook", "color": "black" }, ... ], ... ],
  "moveHistory": [
    { "from": { "row": 6, "col": 4 }, "to": { "row": 4, "col": 4 }, "notation": "e4", ... }
  ],
  "activeColor": "black"
}
```

1.  **Format Board Coordinates:** The server maps the complex 2D array representation into algebraic notation descriptions for the model (e.g., `Rank 4: white pawn at e4; Rank 5: black pawn at e5`).
2.  **Format Play History:** Translates the move history list into official game score formats (e.g., `1. e4 e5 2. Nf3 Nc6`).
3.  **Construct Structured Instructions:** The prompt feeds this structured description to `gemini-2.5-flash` with precise coaching guidelines.
4.  **Schema Enforcement:** To ensure instant rendering without manual parsers, the server requests a strictly validated JSON format:

```json
{
  "score": 0.2,
  "summary": "White controls the central d4 and e4 squares with active development. Black has successfully neutralized immediate pawn tension but needs to develop their light-squared bishop.",
  "whitePlan": "Prepare a central rook lift, castle kingside, and coordinate a pawn storm on the f-file.",
  "blackPlan": "Play d6 to solidify the e5 pawn chain, develop the knight to f6, and challenge White's light-squared bishop with Be6.",
  "lastMoveCommentary": "Playing Nc6 was a high-quality developing move that challenges the center and prepares kingside castling."
}
```

---

##  Environment Configuration

To unlock full grandmaster-level coaching feedback, create a `.env` file at the root of your project or specify the variable in your environment:

*Note: The application will run smoothly with a local material heuristic evaluation fallback if this key is omitted.*

---

## Installation & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server (Full-Stack Mode)
```bash
npm run dev
```
The server will boot on `http://localhost:3000`. You can play local games, configure AI matches, spin up multiplayer lobbies, or analyze live game boards.

### 3. Compiling and Bundling for Production
To build both client and server:
```bash
npm run build
```
This command compiles the React assets into `dist/` and compiles `server.ts` using `esbuild` into `dist/server.cjs` with `--platform=node` and `--packages=external` configured automatically.

### 4. Running the Production Server
```bash
npm run start
```

---


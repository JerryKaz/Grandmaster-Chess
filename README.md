# Grandmaster Chess

A full-stack chess app with React and Node. You can play Stockfish bots, play a friend online, or play two people on one device. After a game you get a Chess.com-style game review, an analysis board, and an optional AI coach (Gemini). It works on desktop and mobile, and you can install it to the home screen.

## Features

**Play**
- **vs Computer:** eight bot levels from about 400 Elo to full-strength Stockfish 19. Stockfish runs as WASM in a Web Worker, so the UI never freezes.
- **Play a friend online:** create a game, share the link or the 6-character code, and play in real time over WebSockets. Spectators can watch. Includes draw offers, resign, rematch (with colours swapped), automatic reconnect, and abandonment detection.
- **Pass & play:** two players on one device.
- **Time controls:** bullet, blitz, rapid, classical and unlimited, with increments. Clocks start after each side's first move. The low-time warning beeps. A flag fall is scored as a draw when the opponent can't mate.
- **Full rules via `chess.js`:** castling, en passant, promotion with a piece picker, check and mate, stalemate, threefold repetition, the 50-move rule and insufficient material.

**Board UX**
- Move by dragging or tapping (touch-safe, no page scroll while dragging).
- Legal-move dots, last-move and check highlights, and slide animations.
- Right-click and drag draws arrows; right-click marks a square.
- Keyboard: `←` `→` `Home` `End` step through moves, `F` flips the board.
- Five board themes, the cburnett SVG pieces, and synthesized sounds (no audio files).

**Puzzles**
- About 4,000 rated tactics puzzles from the Lichess open database (CC0), checked for legality and spread across ratings from 400 to 2700.
- **Rated mode:** your puzzle rating adjusts after every puzzle. You can filter by theme (mate in 1/2/3, fork, pin, skewer, sacrifice, endgame and more).
- **Streak mode:** puzzles get harder each time, and one mistake ends the run. Your best streak is saved.
- Hint, retry, show solution, and "Analyse this puzzle" on the analysis board. Any checkmating move is accepted, even if it differs from the stored solution.

**Accounts (optional)**
- **Sign in with Google** using Google Identity Services. The server verifies the ID token with `google-auth-library` and issues its own session: a random token in an httpOnly, SameSite=Lax cookie, stored server-side only as a SHA-256 hash, valid for 30 days.
- Puzzle rating and game history sync across devices.
- In online games your seat follows your account, and opponents see your Google name with a verified badge.
- Guests can still play everything without signing in.

**Improve**
- **Game review:** every move is classified (Book, Best, Excellent, Good, Inaccuracy, Mistake, Blunder) with Lichess-style accuracy, an evaluation graph and best-move arrows.
- **Analysis board:** eval bar and the top three Stockfish lines. You can import PGN or FEN, and export PGN or FEN.
- **Hints and takebacks** against bots.
- **Game archive:** your last 50 games, plus win/draw/loss stats against the computer.
- **AI Coach:** Gemini explains the position. It is grounded in the engine evaluation, and the server replays and validates every move before calling the model.
- A game in progress survives a page reload.

## Architecture

```
server.ts               Express + WebSocket server (dev: Vite middleware, prod: static dist/)
server/rooms.ts         Authoritative online games: validates every move, runs clocks, handles draws/rematches/reconnects
server/coach.ts         /api/coach — Gemini with structured JSON output, rate-limited
server/auth.ts          Google sign-in, sessions, CSRF/origin checks, progress sync (/api/auth/*, /api/me/*)
server/db.ts            Tiny JSON-file store (atomic writes) — swap for Postgres/MongoDB when you outgrow it
public/puzzles/         Curated puzzle set (CC0)
shared/protocol.ts      Typed client/server message protocol
shared/rules.ts         Result detection shared by client and server
src/engine/             Stockfish UCI client (Web Worker), bot levels, game review
src/store/              Zustand stores: game, online, settings, ui
src/components/board/   Board (pointer events, arrows, promotion), piece assets
src/components/…        Player bars, clocks, eval bar, move list, panels, dialogs
public/engine/          Stockfish 19 lite (single-threaded WASM, ~1.8 MB)
```

**Design decisions**
- **The server is the referee.** Clients send move *intents*. The server checks each one with `chess.js` and broadcasts the result. A client can't make an illegal move, move out of turn, or change the clocks.
- **Single-threaded Stockfish build.** It needs no special headers (COOP/COEP), so it runs on any static host and on iOS Safari.
- **No accounts.** You choose a display name. A random player ID stored on your device reclaims your seat if you reconnect. Real sign-in (OAuth) can be added later without changing the game protocol.

## Running

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint       # type-check
npm run build && npm start   # production
```

Optional features. Copy `.env.example` to `.env`, then:
- **AI Coach:** set `GEMINI_API_KEY`.
- **Google sign-in:** set `GOOGLE_CLIENT_ID`. To get one:
  1. In Google Cloud Console, go to **APIs & Services → Credentials → Create credentials → OAuth client ID** and choose **Web application**.
  2. Under **Authorized JavaScript origins**, add `http://localhost:3000` and your production URL. No client secret or redirect URI is needed.
  3. Set up the OAuth consent screen (app name and support email).

  Accounts are saved to `data/db.json` (`DATA_DIR`). On hosts with ephemeral disks, such as Cloud Run, mount a volume or move the store to Postgres or MongoDB.

To test on a phone, run `npm run dev` and open `http://<your-computer-LAN-IP>:3000` on the phone.

**Hosting:** online play needs a long-running Node process with WebSocket support, such as Render, Railway, Fly.io or Cloud Run. Serverless platforms that don't support WebSockets (for example Vercel functions) can host everything except online play.

## Licences

- Stockfish is GPLv3. See `public/engine/STOCKFISH-LICENSE.txt`. Serving the unmodified engine binary is fine; if you change it, you must publish the source.
- Puzzles come from the Lichess puzzle database (CC0).
- The cburnett pieces are by Colin M.L. Burnett. See `public/pieces/LICENSE.txt`.

import http from 'node:http';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage } from './shared/protocol';
import { handleClose, handleMessage, type ConnectionContext } from './server/rooms';
import { coachHandler, coachStatus } from './server/coach';
import { authRouter, sameOrigin, userFromRequest } from './server/auth';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('query parser', 'simple'); // we never need nested query objects
  app.use(compression());
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/coach', coachStatus);
  app.post('/api/coach', sameOrigin, coachHandler);
  app.use('/api', authRouter());

  const server = http.createServer(app);

  // ---- Real-time online play ----
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== '/ws') return; // leave other upgrades (e.g. Vite HMR) alone
    // Block cross-site WebSocket hijacking (the session cookie rides along with the upgrade).
    let crossSite = false;
    try {
      crossSite = !!req.headers.origin && new URL(req.headers.origin).host !== req.headers.host;
    } catch {
      crossSite = true;
    }
    if (crossSite) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const user = userFromRequest(req);
    const ctx: ConnectionContext = {
      playerId: null,
      name: 'Guest',
      roomId: null,
      account: user ? { id: user.id, name: user.name } : null,
    };
    let tokens = 20;
    const refill = setInterval(() => (tokens = Math.min(20, tokens + 5)), 1000);
    alive.set(ws, true);

    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (raw) => {
      if (--tokens < 0) return; // simple flood guard
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
      try {
        handleMessage(ws, ctx, msg);
      } catch (err) {
        console.error('[ws] handler error', err);
      }
    });
    ws.on('close', () => {
      clearInterval(refill);
      handleClose(ws, ctx);
    });
  });

  // Drop dead connections so seats show as disconnected promptly.
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 25_000).unref();

  // ---- Front-end ----
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(
      express.static(dist, {
        setHeaders(res, file) {
          if (file.endsWith(`${path.sep}sw.js`) || file.endsWith('.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache'); // updates must reach installed apps promptly
          } else if (file.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // content-hashed
          } else if (file.includes(`${path.sep}engine${path.sep}`) || file.includes(`${path.sep}pieces${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // versioned by file name
          }
        },
      }),
    );
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Grandmaster Chess running on http://localhost:${PORT}`);
  });
}

start();

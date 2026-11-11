import { create } from 'zustand';
import type { ClientMessage, RoomSnapshot, ServerMessage, Side, TimeControl } from '../../shared/protocol';
import { load, remove, save } from '../lib/storage';
import type { MoveInput } from '../lib/types';
import { useGame } from './game';
import { useSettings } from './settings';
import { toast } from './ui';

type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

interface OnlineState {
  conn: ConnStatus;
  room: RoomSnapshot | null;
  busy: boolean;
  error: string | null;
  create: (tc: TimeControl, color: Side | 'random') => void;
  join: (code: string) => void;
  leave: () => void;
  sendMove: (input: MoveInput) => void;
  resign: () => void;
  draw: (action: 'offer' | 'accept' | 'decline') => void;
  rematch: () => void;
}

const ROOM_KEY = 'gm-online-room';

let ws: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let queue: ClientMessage[] = [];
let wantConnection = false;

function socketUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function rawSend(msg: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else queue.push(msg);
}

function hello() {
  const { playerId, playerName } = useSettings.getState();
  rawSend({ t: 'hello', playerId, name: playerName.trim() || 'Guest' });
}

function connect() {
  wantConnection = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  useOnline.setState({ conn: retry > 0 ? 'reconnecting' : 'connecting' });
  const socket = new WebSocket(socketUrl());
  ws = socket;

  socket.onopen = () => {
    retry = 0;
    useOnline.setState({ conn: 'open', error: null });
    const pending = queue;
    queue = [];
    hello();
    // Rejoin the room we were in (after a network blip or page reload).
    const roomId = useOnline.getState().room?.id ?? load<string | null>(ROOM_KEY, null);
    const isJoinQueued = pending.some((m) => m.t === 'create' || m.t === 'join');
    if (roomId && !isJoinQueued) rawSend({ t: 'join', room: roomId });
    for (const m of pending) if (m.t !== 'hello') rawSend(m);
  };

  socket.onmessage = (e) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (msg.t === 'state') {
      const prev = useOnline.getState().room;
      useOnline.setState({ room: msg.room, busy: false, error: null });
      save(ROOM_KEY, msg.room.id);
      useGame.getState().applyOnline(msg.room, Date.now());
      notifyChanges(prev, msg.room);
    } else if (msg.t === 'error') {
      useOnline.setState({ busy: false, error: msg.message });
      if (useOnline.getState().room) toast(msg.message);
      if (/not found/i.test(msg.message)) remove(ROOM_KEY);
    } else if (msg.t === 'left') {
      useOnline.setState({ room: null });
    }
  };

  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    if (!wantConnection) {
      useOnline.setState({ conn: 'idle' });
      return;
    }
    retry++;
    useOnline.setState({ conn: 'reconnecting' });
    const delay = Math.min(10_000, 500 * 2 ** Math.min(retry, 5));
    retryTimer = setTimeout(connect, delay);
  };
}

function notifyChanges(prev: RoomSnapshot | null, next: RoomSnapshot) {
  if (!prev || prev.id !== next.id || !next.you) return;
  const opp = next.you === 'w' ? next.black : next.white;
  const prevOpp = next.you === 'w' ? prev.black : prev.white;
  const oppSide: Side = next.you === 'w' ? 'b' : 'w';
  if (opp && !prevOpp) toast(`${opp.name} joined the game`);
  if (opp && prevOpp && prevOpp.connected && !opp.connected) toast(`${opp.name} disconnected`);
  if (opp && prevOpp && !prevOpp.connected && opp.connected) toast(`${opp.name} reconnected`);
  if (next.drawOffer === oppSide && prev.drawOffer !== oppSide) toast('Your opponent offers a draw');
  if (next.rematchOffer === oppSide && prev.rematchOffer !== oppSide) toast('Your opponent wants a rematch');
}

export const useOnline = create<OnlineState>((set, get) => ({
  conn: 'idle',
  room: null,
  busy: false,
  error: null,

  create: (tc, color) => {
    set({ busy: true, error: null });
    connect();
    rawSend({ t: 'create', tc, color });
  },

  join: (code) => {
    const room = code.trim().toUpperCase();
    if (!room) return;
    set({ busy: true, error: null });
    connect();
    rawSend({ t: 'join', room });
  },

  leave: () => {
    rawSend({ t: 'leave' });
    remove(ROOM_KEY);
    set({ room: null, error: null });
    useGame.getState().showSetup();
  },

  sendMove: (input) => {
    const room = get().room;
    if (!room || !room.you) return;
    const game = useGame.getState();
    const ply = game.plies.length;
    const applied = game.move(input, { dragged: true });
    if (!applied) return;
    game.markPending(applied.uci);
    rawSend({ t: 'move', uci: applied.uci, ply });
  },

  resign: () => rawSend({ t: 'resign' }),
  draw: (action) => rawSend({ t: 'draw', action }),
  rematch: () => rawSend({ t: 'rematch', action: 'offer' }),
}));

/** Reconnect to the last room on start-up (page reload), and when the tab comes back online. */
export function initOnline() {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('game');
  if (fromUrl) {
    useOnline.getState().join(fromUrl);
    history.replaceState(null, '', location.pathname);
    return;
  }
  if (load<string | null>(ROOM_KEY, null)) connect();
  window.addEventListener('online', () => {
    if (wantConnection && !ws) {
      if (retryTimer) clearTimeout(retryTimer);
      connect();
    }
  });
}

export function inviteLink(roomId: string) {
  return `${location.origin}/?game=${roomId}`;
}

/** Whether the local player may move on the online board right now. */
export function canMoveOnline(): boolean {
  const { room } = useOnline.getState();
  const g = useGame.getState();
  if (!room || !room.you || room.result || !room.white || !room.black) return false;
  if (g.viewPly !== g.plies.length || g.pendingUci) return false;
  const turn = g.plies.length % 2 === 0 ? 'w' : 'b';
  return turn === room.you;
}

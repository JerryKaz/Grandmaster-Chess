import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { coordsToSquare, isPromotion, legalDests, sideToMove, squareCoords } from '../../lib/game';
import { CLASS_META } from '../../lib/review';
import type { MoveClass, MoveInput, PieceSymbol, Side, Square } from '../../lib/types';
import { BOARD_THEMES, useSettings } from '../../store/settings';
import { pieceUrl } from './pieces';

export interface Arrow {
  from: Square;
  to: Square;
  color: string;
}

interface AnimatedMove {
  from: Square;
  to: Square;
  flags: string;
  color: Side;
}

interface BoardProps {
  fen: string;
  orientation: Side;
  interactive: boolean;
  lastMove?: { from: Square; to: Square } | null;
  animate?: AnimatedMove | null;
  check?: Square | null;
  arrows?: Arrow[];
  marker?: { square: Square; cls: MoveClass } | null;
  /** Extra square tints (e.g. puzzle hint). */
  highlights?: { square: Square; color: string }[];
  onMove: (move: MoveInput & { dragged: boolean }) => void;
}

const USER_ARROW = 'rgba(21, 120, 27, 0.82)';
const DRAG_THRESHOLD = 4;

type DragState = {
  from: Square;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  deselectOnUp: boolean;
};

function Board({ fen, orientation, interactive, lastMove, animate, check, arrows = [], marker, highlights = [], onMove }: BoardProps) {
  const theme = BOARD_THEMES[useSettings((s) => s.boardTheme)];
  const showCoords = useSettings((s) => s.showCoords);
  const showLegal = useSettings((s) => s.showLegalMoves);
  const animOn = useSettings((s) => s.animate);
  const autoQueen = useSettings((s) => s.autoQueen);

  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const rightStart = useRef<Square | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  const [selected, setSelected] = useState<Square | null>(null);
  const [dragging, setDragging] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; dragged: boolean } | null>(null);
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);
  const [userMarks, setUserMarks] = useState<Square[]>([]);

  const pieces = useMemo(() => {
    const list: { square: Square; type: PieceSymbol; color: Side }[] = [];
    for (const row of new Chess(fen).board()) for (const p of row) if (p) list.push({ square: p.square, type: p.type, color: p.color });
    return list;
  }, [fen]);
  const pieceAt = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const turn = sideToMove(fen);
  const dests = useMemo(() => (interactive ? legalDests(fen) : new Map<Square, Square[]>()), [fen, interactive]);

  // Reset transient UI whenever the position changes.
  useEffect(() => {
    setSelected(null);
    setDragging(null);
    setPromotion(null);
    setUserArrows([]);
    setUserMarks([]);
    drag.current = null;
  }, [fen, interactive]);

  const squareFromPoint = (clientX: number, clientY: number): Square | null => {
    const rect = boardRef.current!.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    return coordsToSquare(x, y, orientation);
  };

  const tryMove = (from: Square, to: Square, dragged: boolean) => {
    if (!dests.get(from)?.includes(to)) return false;
    setSelected(null);
    if (isPromotion(fen, from, to)) {
      if (autoQueen) onMove({ from, to, promotion: 'q', dragged });
      else setPromotion({ from, to, dragged });
    } else {
      onMove({ from, to, dragged });
    }
    return true;
  };

  const moveGhost = (clientX: number, clientY: number) => {
    const ghost = ghostRef.current;
    const board = boardRef.current;
    if (!ghost || !board) return;
    const size = board.getBoundingClientRect().width / 8;
    ghost.style.width = ghost.style.height = `${size}px`;
    ghost.style.transform = `translate(${clientX - size / 2}px, ${clientY - size / 2}px)`;
    const sq = squareFromPoint(clientX, clientY);
    const hover = hoverRef.current;
    if (hover) {
      if (sq) {
        const { x, y } = squareCoords(sq, orientation);
        hover.style.display = 'block';
        hover.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      } else hover.style.display = 'none';
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (promotion) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (!sq) return;

    if (e.button === 2) {
      rightStart.current = sq;
      return;
    }
    if (e.button !== 0) return;
    setUserArrows([]);
    setUserMarks([]);
    if (!interactive) return;

    // Tap-to-move: a piece is selected and this is one of its destinations.
    if (selected && selected !== sq && tryMove(selected, sq, false)) return;

    const piece = pieceAt.get(sq);
    if (piece && piece.color === turn && dests.has(sq)) {
      const wasSelected = selected === sq;
      setSelected(sq);
      drag.current = { from: sq, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false, deselectOnUp: wasSelected };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.active = true;
      setDragging(d.from);
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
    moveGhost(e.clientX, e.clientY);
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(null);
    if (hoverRef.current) hoverRef.current.style.display = 'none';
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (e.button === 2) {
      const start = rightStart.current;
      rightStart.current = null;
      if (!start || !sq) return;
      if (start === sq) {
        setUserMarks((m) => (m.includes(sq) ? m.filter((s) => s !== sq) : [...m, sq]));
      } else {
        setUserArrows((list) => {
          const exists = list.some((a) => a.from === start && a.to === sq);
          return exists ? list.filter((a) => !(a.from === start && a.to === sq)) : [...list, { from: start, to: sq, color: USER_ARROW }];
        });
      }
      return;
    }
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.active) {
      if (sq && sq !== d.from && tryMove(d.from, sq, true)) {
        endDrag();
        return;
      }
    } else if (d.deselectOnUp && sq === d.from) {
      setSelected(null);
    }
    endDrag();
  };

  // Position the ghost on the frame it mounts, so it never flashes at the corner.
  useLayoutEffect(() => {
    if (dragging) moveGhost(lastPointer.current.x, lastPointer.current.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const selectedDests = selected ? dests.get(selected) ?? [] : [];
  const pos = (sq: Square) => squareCoords(sq, orientation);
  const at = (sq: Square) => {
    const { x, y } = pos(sq);
    return { transform: `translate(${x * 100}%, ${y * 100}%)` };
  };

  // Rook slide for castling animations.
  const rookAnim = useMemo(() => {
    if (!animate || !(animate.flags.includes('k') || animate.flags.includes('q'))) return null;
    const rank = animate.color === 'w' ? '1' : '8';
    return animate.flags.includes('k')
      ? { from: `h${rank}` as Square, to: `f${rank}` as Square }
      : { from: `a${rank}` as Square, to: `d${rank}` as Square };
  }, [animate]);

  const animFor = (sq: Square): React.CSSProperties | undefined => {
    if (!animOn || !animate) return undefined;
    const src = sq === animate.to ? animate.from : rookAnim && sq === rookAnim.to ? rookAnim.from : null;
    if (!src) return undefined;
    const a = pos(src);
    return { ['--fx' as string]: `${a.x * 100}%`, ['--fy' as string]: `${a.y * 100}%`, animation: 'piece-slide 160ms ease-out' };
  };

  const allArrows = [...arrows, ...userArrows];
  const dragPiece = dragging ? pieceAt.get(dragging) : null;
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = orientation === 'w' ? '87654321' : '12345678';

  return (
    <div
      ref={boardRef}
      className="board relative aspect-square w-full select-none overflow-hidden rounded-md shadow-xl"
      style={{ touchAction: 'none', background: theme.light, WebkitTouchCallout: 'none' } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
      role="img"
      aria-label={`Chess board. ${turn === 'w' ? 'White' : 'Black'} to move.`}
    >
      {/* Squares + coordinates */}
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          const dark = (x + y) % 2 === 1;
          return (
            <div key={i} className="relative" style={{ background: dark ? theme.dark : theme.light }}>
              {showCoords && x === 0 && (
                <span className="absolute left-[4%] top-[2%] text-[clamp(8px,2.2vmin,13px)] font-semibold leading-none" style={{ color: dark ? theme.light : theme.dark }}>
                  {ranks[y]}
                </span>
              )}
              {showCoords && y === 7 && (
                <span className="absolute bottom-[2%] right-[5%] text-[clamp(8px,2.2vmin,13px)] font-semibold leading-none" style={{ color: dark ? theme.light : theme.dark }}>
                  {files[x]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Square highlights */}
      <div className="pointer-events-none absolute inset-0">
        {lastMove &&
          [lastMove.from, lastMove.to].map((sq) => (
            <div key={`lm-${sq}`} className="absolute h-[12.5%] w-[12.5%]" style={{ ...at(sq), background: 'rgba(255, 214, 0, 0.42)' }} />
          ))}
        {highlights.map((h) => (
          <div key={`hl-${h.square}`} className="absolute h-[12.5%] w-[12.5%]" style={{ ...at(h.square), background: h.color }} />
        ))}
        {selected && <div className="absolute h-[12.5%] w-[12.5%]" style={{ ...at(selected), background: 'rgba(255, 214, 0, 0.55)' }} />}
        {userMarks.map((sq) => (
          <div key={`um-${sq}`} className="absolute h-[12.5%] w-[12.5%]" style={{ ...at(sq), background: 'rgba(235, 97, 80, 0.75)' }} />
        ))}
        {check && (
          <div
            className="absolute h-[12.5%] w-[12.5%]"
            style={{ ...at(check), background: 'radial-gradient(circle, rgba(255,0,0,0.9) 0%, rgba(231,0,0,0.6) 30%, rgba(169,0,0,0) 72%)' }}
          />
        )}
        <div ref={hoverRef} className="absolute hidden h-[12.5%] w-[12.5%]" style={{ boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.75)' }} />
      </div>

      {/* Pieces */}
      <div className="pointer-events-none absolute inset-0">
        {pieces.map((p) => {
          const style = animFor(p.square);
          return (
            <div
              key={style ? `${p.square}-${p.color}${p.type}-${animate!.from}` : `${p.square}-${p.color}${p.type}`}
              className="piece absolute h-[12.5%] w-[12.5%] bg-cover will-change-transform"
              style={{
                ...at(p.square),
                ...style,
                backgroundImage: `url(${pieceUrl(p.color, p.type)})`,
                opacity: dragging === p.square ? 0.35 : 1,
              }}
            />
          );
        })}
      </div>

      {/* Legal move hints */}
      {showLegal && selected && (
        <div className="pointer-events-none absolute inset-0">
          {selectedDests.map((sq) => (
            <div key={`d-${sq}`} className="absolute flex h-[12.5%] w-[12.5%] items-center justify-center" style={at(sq)}>
              {pieceAt.has(sq) ? (
                <div className="h-full w-full" style={{ background: 'radial-gradient(circle, transparent 0%, transparent 72%, rgba(0,0,0,0.2) 73%)' }} />
              ) : (
                <div className="h-[32%] w-[32%] rounded-full bg-black/20" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review classification badge */}
      {marker && (
        <div className="pointer-events-none absolute h-[12.5%] w-[12.5%]" style={at(marker.square)}>
          <span
            className="absolute -right-[6%] -top-[6%] flex h-[42%] w-[42%] items-center justify-center rounded-full text-[clamp(8px,2vmin,13px)] font-bold text-white shadow-md ring-2 ring-white/80"
            style={{ background: CLASS_META[marker.cls].color }}
          >
            {CLASS_META[marker.cls].symbol}
          </span>
        </div>
      )}

      {/* Arrows */}
      {allArrows.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 8 8">
          {allArrows.map((a, i) => (
            <ArrowShape key={`${a.from}${a.to}${i}`} {...a} orientation={orientation} />
          ))}
        </svg>
      )}

      {/* Promotion picker */}
      {promotion && (
        <PromotionPicker
          to={promotion.to}
          color={turn}
          orientation={orientation}
          onPick={(type) => {
            const { from, to, dragged } = promotion;
            setPromotion(null);
            onMove({ from, to, promotion: type, dragged });
          }}
          onCancel={() => setPromotion(null)}
        />
      )}

      {/* Drag ghost (fixed so it can leave the board edge) */}
      {dragPiece && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed left-0 top-0 z-50 scale-110 bg-cover drop-shadow-xl"
          style={{ backgroundImage: `url(${pieceUrl(dragPiece.color, dragPiece.type)})` }}
        />
      )}
    </div>
  );
}

function ArrowShape({ from, to, color, orientation }: Arrow & { orientation: Side }) {
  const a = squareCoords(from, orientation);
  const b = squareCoords(to, orientation);
  const x1 = a.x + 0.5;
  const y1 = a.y + 0.5;
  const x2 = b.x + 0.5;
  const y2 = b.y + 0.5;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const head = 0.38;
  const w = 0.14;
  const ex = x2 - ux * head;
  const ey = y2 - uy * head;
  const px = -uy;
  const py = ux;
  const sx = x1 + ux * 0.2;
  const sy = y1 + uy * 0.2;
  const points = [
    [sx + px * w, sy + py * w],
    [ex + px * w, ey + py * w],
    [ex + px * head * 0.75, ey + py * head * 0.75],
    [x2, y2],
    [ex - px * head * 0.75, ey - py * head * 0.75],
    [ex - px * w, ey - py * w],
    [sx - px * w, sy - py * w],
  ]
    .map((p) => p.join(','))
    .join(' ');
  return <polygon points={points} fill={color} />;
}

function PromotionPicker({
  to,
  color,
  orientation,
  onPick,
  onCancel,
}: {
  to: Square;
  color: Side;
  orientation: Side;
  onPick: (t: PieceSymbol) => void;
  onCancel: () => void;
}) {
  const { x, y } = squareCoords(to, orientation);
  const fromTop = y === 0;
  const types: PieceSymbol[] = ['q', 'n', 'r', 'b'];
  return (
    <div className="absolute inset-0 z-20 bg-black/40" onPointerDown={(e) => { e.stopPropagation(); onCancel(); }}>
      <div
        className="absolute flex w-[12.5%] flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        style={{ left: `${x * 12.5}%`, ...(fromTop ? { top: 0 } : { bottom: 0, flexDirection: 'column-reverse' }) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {types.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={`Promote to ${{ q: 'queen', n: 'knight', r: 'rook', b: 'bishop' }[t as 'q']}`}
            className="aspect-square w-full bg-cover transition hover:bg-amber-100 active:scale-95"
            style={{ backgroundImage: `url(${pieceUrl(color, t)})` }}
            onClick={() => onPick(t)}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(Board);

import type { PieceSymbol, Side } from '../../lib/types';

/** Piece artwork: "cburnett" set by Colin M.L. Burnett (see public/pieces/LICENSE.txt). */
export const pieceUrl = (color: Side, type: PieceSymbol) => `/pieces/cburnett/${color}${type.toUpperCase()}.svg`;

/** Warm the browser cache so pieces never pop in on first render. */
export function preloadPieces() {
  for (const c of ['w', 'b'] as const) {
    for (const t of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
      const img = new Image();
      img.src = pieceUrl(c, t);
    }
  }
}

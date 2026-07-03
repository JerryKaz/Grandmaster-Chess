import { useChessStore } from '../../features/chess/store/chessStore';
import { ChessPiece as IChessPiece } from '../../features/chess/models/types';
import ChessPiece from '../pieces/ChessPiece';

interface BoardSquareProps {
  key?: string;
  row: number;
  col: number;
  piece: IChessPiece | null;
  isSelected?: boolean;
  isMoveCandidate?: boolean;
  isLastMoveSource?: boolean;
  isLastMoveDestination?: boolean;
  isHintSource?: boolean;
  isHintDestination?: boolean;
}

export default function BoardSquare({
  row,
  col,
  piece,
  isSelected = false,
  isMoveCandidate = false,
  isLastMoveSource = false,
  isLastMoveDestination = false,
  isHintSource = false,
  isHintDestination = false,
}: BoardSquareProps) {
  const activeColor = useChessStore((state) => state.activeColor);
  const selectedSquare = useChessStore((state) => state.selectedSquare);
  const selectSquare = useChessStore((state) => state.selectSquare);
  const movePiece = useChessStore((state) => state.movePiece);
  const board = useChessStore((state) => state.board);
  const setPendingPromotion = useChessStore((state) => state.setPendingPromotion);
  
  const gameMode = useChessStore((state) => state.gameMode);
  const multiplayerRole = useChessStore((state) => state.multiplayerRole);
  const multiplayerRoomId = useChessStore((state) => state.multiplayerRoomId);
  const boardTheme = useChessStore((state) => state.boardTheme);

  const isDark = (row + col) % 2 === 1;

  // Board themes styles definitions
  const THEME_STYLES = {
    forest: {
      light: 'bg-[#ebecd0]',
      dark: 'bg-[#779556]',
      textLightColor: 'text-[#ebecd0]',
      textDarkColor: 'text-[#779556]',
    },
    classic: {
      light: 'bg-[#f0d9b5]',
      dark: 'bg-[#b58863]',
      textLightColor: 'text-[#f0d9b5]',
      textDarkColor: 'text-[#b58863]',
    },
    ocean: {
      light: 'bg-[#dee3e6]',
      dark: 'bg-[#4b7399]',
      textLightColor: 'text-[#dee3e6]',
      textDarkColor: 'text-[#4b7399]',
    },
  };

  const currentTheme = THEME_STYLES[boardTheme] || THEME_STYLES.forest;
  const bgClass = isDark ? currentTheme.dark : currentTheme.light;

  // Coordinate Labels
  const showRankLabel = col === 0; // Show Rank (8-1) on the first column
  const showFileLabel = row === 7; // Show File (a-h) on the bottom row

  const rankValue = 8 - row;
  const fileValue = String.fromCharCode(97 + col); // 'a' to 'h'

  const labelTextColor = isDark ? currentTheme.textLightColor : currentTheme.textDarkColor;

  const handleSquareClick = () => {
    // Guards:
    // A) Multiplayer mode: it's not our turn
    if (gameMode === 'multiplayer') {
      if (multiplayerRole && activeColor !== multiplayerRole) return;
    }

    // B) AI mode: it's not our turn
    if (gameMode === 'ai') {
      const aiPlayerColor = useChessStore.getState().aiPlayerColor;
      if (activeColor !== aiPlayerColor) return;
    }

    // 1. If clicked square is a valid destination for the selected piece, move it
    if (isMoveCandidate && selectedSquare) {
      const fromPiece = board[selectedSquare.row][selectedSquare.col];
      const isPawn = fromPiece?.type === 'pawn';
      const isPromotionRow = (fromPiece?.color === 'white' && row === 0) || (fromPiece?.color === 'black' && row === 7);

      if (isPawn && isPromotionRow) {
        setPendingPromotion({
          from: selectedSquare,
          to: { row, col },
          color: fromPiece.color,
        });
        return;
      }

      movePiece(selectedSquare, { row, col });

      // Synchronize to room immediately for instant feedback
      if (gameMode === 'multiplayer' && multiplayerRoomId) {
        setTimeout(async () => {
          const currentStore = useChessStore.getState();
          try {
            await fetch(`/api/rooms/${multiplayerRoomId}/move`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                board: currentStore.board,
                activeColor: currentStore.activeColor,
                moveHistory: currentStore.moveHistory,
                capturedPieces: currentStore.capturedPieces,
                isCheck: currentStore.isCheck,
                isCheckmate: currentStore.isCheckmate,
                isStalemate: currentStore.isStalemate,
                winner: currentStore.winner,
              }),
            });
          } catch (err) {
            console.error("Error in instant move synchronization:", err);
          }
        }, 50);
      }
      return;
    }

    // 2. Otherwise, if clicking a piece of the active player's color, select it
    if (piece && piece.color === activeColor) {
      // Additional check: In multiplayer, you can only select your own color pieces
      if (gameMode === 'multiplayer' && multiplayerRole && piece.color !== multiplayerRole) {
        return;
      }
      selectSquare({ row, col });
      return;
    }

    // 3. Clicked empty square or opponent piece (which wasn't a valid move): clear selection
    selectSquare(null);
  };

  return (
    <div
      id={`square-${row}-${col}`}
      onClick={handleSquareClick}
      className={`
        relative aspect-square flex items-center justify-center transition-colors duration-200 select-none cursor-pointer
        ${bgClass}
        ${isSelected ? 'ring-4 ring-amber-400 ring-inset z-10' : ''}
      `}
    >
      {/* Last Move Overlay Highlights */}
      {(isLastMoveSource || isLastMoveDestination) && (
        <div
          id={`last-move-overlay-${row}-${col}`}
          className="absolute inset-0 bg-amber-400/25 pointer-events-none"
        />
      )}

      {/* Best Move Hint Highlight Overlay (Source) */}
      {isHintSource && (
        <div
          id={`hint-source-overlay-${row}-${col}`}
          className="absolute inset-0 bg-violet-500/15 ring-4 ring-violet-500 ring-inset z-10 animate-pulse pointer-events-none"
        />
      )}

      {/* Best Move Hint Highlight Overlay (Destination) */}
      {isHintDestination && (
        <div
          id={`hint-destination-overlay-${row}-${col}`}
          className="absolute inset-0 bg-violet-600/20 border-4 border-dashed border-violet-500 z-10 animate-pulse pointer-events-none flex items-center justify-center"
        >
          <div className="w-5 h-5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        </div>
      )}

      {/* Rank Label (Top-Left) */}
      {showRankLabel && (
        <span
          className={`
            absolute top-0.5 left-1 font-mono text-[9px] md:text-xs font-bold leading-none
            ${labelTextColor} opacity-85 pointer-events-none
          `}
        >
          {rankValue}
        </span>
      )}

      {/* File Label (Bottom-Right) */}
      {showFileLabel && (
        <span
          className={`
            absolute bottom-0.5 right-1.5 font-mono text-[9px] md:text-xs font-bold leading-none
            ${labelTextColor} opacity-85 pointer-events-none
          `}
        >
          {fileValue}
        </span>
      )}

      {/* Valid Move Indicator Dots / Capture Rings */}
      {isMoveCandidate && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {piece ? (
            // Capturing move visual indicator: a prominent circular ring around the piece
            <div className="w-11/12 h-11/12 border-4 border-black/15 rounded-full" />
          ) : (
            // Normal empty destination move indicator: professional small center dot
            <div className="w-4 h-4 rounded-full bg-black/10" />
          )}
        </div>
      )}

      {/* Piece Render */}
      {piece && <ChessPiece piece={piece} />}
    </div>
  );
}

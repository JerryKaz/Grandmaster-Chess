import { useMemo } from 'react';
import { LayoutGroup } from 'motion/react';
import { useChessStore } from '../../features/chess/store/chessStore';
import { useValidMoves } from '../../features/chess/hooks/useValidMoves';
import BoardSquare from './BoardSquare';
import PromotionModal from './PromotionModal';

interface ChessBoardProps {
  isFlipped?: boolean; // In case we want to support black-perspective in Phase 5
}

export default function ChessBoard({ isFlipped = false }: ChessBoardProps) {
  const board = useChessStore((state) => state.board);
  const selectedSquare = useChessStore((state) => state.selectedSquare);
  const moveHistory = useChessStore((state) => state.moveHistory);
  const { validMoves } = useValidMoves();
  const boardTheme = useChessStore((state) => state.boardTheme);
  const hintMove = useChessStore((state) => state.hintMove);

  // Dynamic premium darker accent borders matching each color template
  const borderColors = {
    classic: 'border-[#312215] bg-[#312215]',
    ocean: 'border-[#15202b] bg-[#15202b]',
    forest: 'border-[#222e1b] bg-[#222e1b]',
  };

  const currentBorder = borderColors[boardTheme as 'classic' | 'ocean' | 'forest'] || borderColors.classic;

  const pendingPromotion = useChessStore((state) => state.pendingPromotion);
  const setPendingPromotion = useChessStore((state) => state.setPendingPromotion);
  const movePiece = useChessStore((state) => state.movePiece);
  const gameMode = useChessStore((state) => state.gameMode);
  const multiplayerRoomId = useChessStore((state) => state.multiplayerRoomId);

  // Create an optimized lookup set of valid destinations for O(1) checks during square iterations
  const validDestinationsSet = useMemo(() => {
    const set = new Set<string>();
    validMoves.forEach((move) => {
      set.add(`${move.row},${move.col}`);
    });
    return set;
  }, [validMoves]);

  // Determine row and column ordering based on perspective
  const rowIndices = isFlipped ? Array.from({ length: 8 }, (_, i) => 7 - i) : Array.from({ length: 8 }, (_, i) => i);
  const colIndices = isFlipped ? Array.from({ length: 8 }, (_, i) => 7 - i) : Array.from({ length: 8 }, (_, i) => i);

  // Identify the last move
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

  const handleSelectPromotion = (pieceType: any) => {
    if (!pendingPromotion) return;

    // 1. Complete the move
    movePiece(pendingPromotion.from, pendingPromotion.to, pieceType);

    // 2. Synchronize to multiplayer room immediately
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

    // 3. Clear the pending promotion state
    setPendingPromotion(null);
  };

  const handleCancelPromotion = () => {
    setPendingPromotion(null);
  };

  return (
    <div
      id="chess-board-wrapper"
      className={`w-full max-w-[calc(100vh-240px)] sm:max-w-lg aspect-square p-0.5 shadow-[0_24px_64px_rgba(0,0,0,0.85)] border-[6px] sm:border-[10px] md:border-[12px] relative rounded-xl transition-all duration-300 ${currentBorder}`}
    >
      <LayoutGroup id="chess-board">
        <div
          id="chess-board-grid"
          className="grid grid-cols-8 grid-rows-8 gap-0 overflow-hidden rounded-lg"
        >
          {rowIndices.map((row) =>
            colIndices.map((col) => {
              const piece = board[row][col];
              const isSelected =
                selectedSquare !== null &&
                selectedSquare.row === row &&
                selectedSquare.col === col;
              
              const isMoveCandidate = validDestinationsSet.has(`${row},${col}`);

              const isLastMoveSource =
                lastMove !== null &&
                lastMove.from.row === row &&
                lastMove.from.col === col;

              const isLastMoveDestination =
                lastMove !== null &&
                lastMove.to.row === row &&
                lastMove.to.col === col;

              const isHintSource =
                hintMove !== null &&
                hintMove.from.row === row &&
                hintMove.from.col === col;

              const isHintDestination =
                hintMove !== null &&
                hintMove.to.row === row &&
                hintMove.to.col === col;

              return (
                <BoardSquare
                  key={`${row}-${col}`}
                  row={row}
                  col={col}
                  piece={piece}
                  isSelected={isSelected}
                  isMoveCandidate={isMoveCandidate}
                  isLastMoveSource={isLastMoveSource}
                  isLastMoveDestination={isLastMoveDestination}
                  isHintSource={isHintSource}
                  isHintDestination={isHintDestination}
                  isFlipped={isFlipped}
                />
              );
            })
          )}
        </div>
      </LayoutGroup>

      {/* Visually stunning visual promotion selector overlay */}
      <PromotionModal
        isOpen={pendingPromotion !== null}
        color={pendingPromotion?.color || 'white'}
        onSelect={handleSelectPromotion}
        onCancel={handleCancelPromotion}
      />
    </div>
  );
}

import { useMemo } from 'react';
import { useChessStore } from '../store/chessStore';
import { calculateLegalMoves } from '../engine/moveValidator';
import { SquareCoordinates } from '../models/types';

export function useValidMoves() {
  const board = useChessStore((state) => state.board);
  const selectedSquare = useChessStore((state) => state.selectedSquare);

  const validMoves = useMemo<SquareCoordinates[]>(() => {
    if (!selectedSquare) {
      return [];
    }

    const { row, col } = selectedSquare;
    const piece = board[row][col];

    if (!piece) {
      return [];
    }

    return calculateLegalMoves(board, selectedSquare, piece);
  }, [board, selectedSquare]);

  /**
   * Helper function to quickly verify if a square coordinate is in the valid destination list.
   */
  const isValidDestination = (targetRow: number, targetCol: number): boolean => {
    return validMoves.some((move) => move.row === targetRow && move.col === targetCol);
  };

  return {
    validMoves,
    isValidDestination,
  };
}

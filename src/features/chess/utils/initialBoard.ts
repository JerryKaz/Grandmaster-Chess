import { BoardGrid, ChessPiece, Color, PieceType } from '../models/types';

function createPiece(id: string, type: PieceType, color: Color): ChessPiece {
  return {
    id,
    type,
    color,
    hasMoved: false,
  };
}

export function generateInitialBoard(): BoardGrid {
  const board: BoardGrid = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  const backRowTypes: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
  ];

  // Setup Black Pieces (Row 0: Major, Row 1: Pawns)
  for (let col = 0; col < 8; col++) {
    const type = backRowTypes[col];
    const fileChar = String.fromCharCode(97 + col); // 'a' through 'h'
    board[0][col] = createPiece(`b-${type}-${fileChar}`, type, 'black');
    board[1][col] = createPiece(`b-pawn-${fileChar}`, 'pawn', 'black');
  }

  // Setup White Pieces (Row 6: Pawns, Row 7: Major)
  for (let col = 0; col < 8; col++) {
    const type = backRowTypes[col];
    const fileChar = String.fromCharCode(97 + col); // 'a' through 'h'
    board[6][col] = createPiece(`w-pawn-${fileChar}`, 'pawn', 'white');
    board[7][col] = createPiece(`w-${type}-${fileChar}`, type, 'white');
  }

  return board;
}

export function convertToAlgebraic(row: number, col: number): string {
  const file = String.fromCharCode(97 + col); // a-h
  const rank = 8 - row; // 1-8
  return `${file}${rank}`;
}

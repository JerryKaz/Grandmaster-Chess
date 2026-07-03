import { BoardGrid, SquareCoordinates, ChessPiece, Color } from '../models/types';

/**
 * Checks whether the given coordinates fall within the boundaries of an 8x8 chess board.
 */
export function isWithinBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

/**
 * Pure helper to verify if a target square is either empty or contains an opponent's piece.
 */
function isValidTarget(
  board: BoardGrid,
  targetRow: number,
  targetCol: number,
  friendlyColor: Color
): boolean {
  const targetPiece = board[targetRow][targetCol];
  return targetPiece === null || targetPiece.color !== friendlyColor;
}

/**
 * Generates all pseudo-legal moves for a Pawn on a given square.
 * (Note: Does not check for checks/pinning, which belongs to Phase 3/4 validation).
 */
export function getPawnMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const moves: SquareCoordinates[] = [];
  const { row, col } = coords;
  const direction = piece.color === 'white' ? -1 : 1; // White moves up (-1 row), Black moves down (+1 row)

  // 1. One-step forward advance
  const nextRow = row + direction;
  if (isWithinBoard(nextRow, col) && board[nextRow][col] === null) {
    moves.push({ row: nextRow, col });

    // 2. Two-step forward advance (only from initial rank)
    const initialRank = piece.color === 'white' ? 6 : 1;
    const doubleNextRow = row + 2 * direction;
    if (row === initialRank && isWithinBoard(doubleNextRow, col) && board[doubleNextRow][col] === null) {
      moves.push({ row: doubleNextRow, col });
    }
  }

  // 3. Diagonal captures
  const captureCols = [col - 1, col + 1];
  for (const nextCol of captureCols) {
    if (isWithinBoard(nextRow, nextCol)) {
      const targetPiece = board[nextRow][nextCol];
      if (targetPiece !== null && targetPiece.color !== piece.color) {
        moves.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return moves;
}

/**
 * Generates all pseudo-legal moves for a Knight.
 */
export function getKnightMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const moves: SquareCoordinates[] = [];
  const { row, col } = coords;

  const knightOffsets = [
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2],  [1, 2],
    [2, -1],  [2, 1]
  ];

  for (const [rowOffset, colOffset] of knightOffsets) {
    const targetRow = row + rowOffset;
    const targetCol = col + colOffset;

    if (isWithinBoard(targetRow, targetCol)) {
      if (isValidTarget(board, targetRow, targetCol, piece.color)) {
        moves.push({ row: targetRow, col: targetCol });
      }
    }
  }

  return moves;
}

/**
 * Generates sliding moves in specified directions (Bishops, Rooks, Queens).
 */
function getSlidingMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece,
  directions: [number, number][]
): SquareCoordinates[] {
  const moves: SquareCoordinates[] = [];
  const { row, col } = coords;

  for (const [rowDir, colDir] of directions) {
    let targetRow = row + rowDir;
    let targetCol = col + colDir;

    while (isWithinBoard(targetRow, targetCol)) {
      const targetPiece = board[targetRow][targetCol];

      if (targetPiece === null) {
        moves.push({ row: targetRow, col: targetCol });
      } else {
        // Hit a piece: capture if opponent, then stop sliding
        if (targetPiece.color !== piece.color) {
          moves.push({ row: targetRow, col: targetCol });
        }
        break;
      }

      targetRow += rowDir;
      targetCol += colDir;
    }
  }

  return moves;
}

/**
 * Generates all pseudo-legal moves for a Bishop.
 */
export function getBishopMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const directions: [number, number][] = [
    [-1, -1], [-1, 1],
    [1, -1],  [1, 1]
  ];
  return getSlidingMoves(board, coords, piece, directions);
}

/**
 * Generates all pseudo-legal moves for a Rook.
 */
export function getRookMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const directions: [number, number][] = [
    [-1, 0], [1, 0],
    [0, -1], [0, 1]
  ];
  return getSlidingMoves(board, coords, piece, directions);
}

/**
 * Generates all pseudo-legal moves for a Queen.
 */
export function getQueenMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  return getSlidingMoves(board, coords, piece, directions);
}

/**
 * Generates all pseudo-legal moves for a King.
 */
export function getKingMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const moves: SquareCoordinates[] = [];
  const { row, col } = coords;

  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (const [rowOffset, colOffset] of kingOffsets) {
    const targetRow = row + rowOffset;
    const targetCol = col + colOffset;

    if (isWithinBoard(targetRow, targetCol)) {
      if (isValidTarget(board, targetRow, targetCol, piece.color)) {
        moves.push({ row: targetRow, col: targetCol });
      }
    }
  }

  return moves;
}

/**
 * Unified dispatch function to fetch pseudo-legal moves for any piece type.
 */
export function calculatePseudoLegalMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(board, coords, piece);
    case 'knight':
      return getKnightMoves(board, coords, piece);
    case 'bishop':
      return getBishopMoves(board, coords, piece);
    case 'rook':
      return getRookMoves(board, coords, piece);
    case 'queen':
      return getQueenMoves(board, coords, piece);
    case 'king':
      return getKingMoves(board, coords, piece);
    default:
      return [];
  }
}

/**
 * Finds the coordinates of the King of the given color on the board.
 */
export function findKing(board: BoardGrid, color: Color): SquareCoordinates | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'king' && piece.color === color) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/**
 * Checks if a specific square is under attack by any piece of attackerColor.
 * This is an efficient raycast-based check starting from the target square outwards.
 */
export function isSquareAttacked(
  board: BoardGrid,
  target: SquareCoordinates,
  attackerColor: Color
): boolean {
  const { row, col } = target;

  // 1. Knight attacks
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2],  [1, 2],  [2, -1],  [2, 1]
  ];
  for (const [rOff, cOff] of knightOffsets) {
    const tr = row + rOff;
    const tc = col + cOff;
    if (isWithinBoard(tr, tc)) {
      const piece = board[tr][tc];
      if (piece && piece.type === 'knight' && piece.color === attackerColor) {
        return true;
      }
    }
  }

  // 2. Sliding attacks: Diagonal (Bishop, Queen)
  const diagonalDirs = [
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  for (const [rDir, cDir] of diagonalDirs) {
    let tr = row + rDir;
    let tc = col + cDir;
    while (isWithinBoard(tr, tc)) {
      const piece = board[tr][tc];
      if (piece !== null) {
        if (piece.color === attackerColor && (piece.type === 'bishop' || piece.type === 'queen')) {
          return true;
        }
        break; // Hit a piece, stop searching in this direction
      }
      tr += rDir;
      tc += cDir;
    }
  }

  // 3. Sliding attacks: Orthogonal (Rook, Queen)
  const orthogonalDirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];
  for (const [rDir, cDir] of orthogonalDirs) {
    let tr = row + rDir;
    let tc = col + cDir;
    while (isWithinBoard(tr, tc)) {
      const piece = board[tr][tc];
      if (piece !== null) {
        if (piece.color === attackerColor && (piece.type === 'rook' || piece.type === 'queen')) {
          return true;
        }
        break; // Hit a piece, stop searching in this direction
      }
      tr += rDir;
      tc += cDir;
    }
  }

  // 4. Pawn attacks
  // Pawns attack diagonally.
  // If the attacker is White, pawns move up (-1 row), so they attack from row + 1 relative to target.
  // If the attacker is Black, pawns move down (+1 row), so they attack from row - 1 relative to target.
  const pawnRow = attackerColor === 'white' ? row + 1 : row - 1;
  const pawnCols = [col - 1, col + 1];
  for (const pc of pawnCols) {
    if (isWithinBoard(pawnRow, pc)) {
      const piece = board[pawnRow][pc];
      if (piece && piece.type === 'pawn' && piece.color === attackerColor) {
        return true;
      }
    }
  }

  // 5. King attacks (to prevent Kings from moving adjacent to each other)
  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [rOff, cOff] of kingOffsets) {
    const tr = row + rOff;
    const tc = col + cOff;
    if (isWithinBoard(tr, tc)) {
      const piece = board[tr][tc];
      if (piece && piece.type === 'king' && piece.color === attackerColor) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if the King of the given color is currently in check.
 */
export function isKingInCheck(board: BoardGrid, color: Color): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const opponentColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, kingPos, opponentColor);
}

/**
 * Simulates a move on the board and checks if it results in the friendly King being in check.
 */
export function simulatesMoveLeavesKingInCheck(
  board: BoardGrid,
  from: SquareCoordinates,
  to: SquareCoordinates,
  color: Color
): boolean {
  // Create a deep copy of the board grid
  const simBoard = board.map((r) => [...r]);
  const piece = simBoard[from.row][from.col];
  if (!piece) return false;

  // Make the simulated move
  simBoard[from.row][from.col] = null;
  simBoard[to.row][to.col] = {
    ...piece,
    hasMoved: true,
  };

  return isKingInCheck(simBoard, color);
}

/**
 * Calculates all fully legal moves for a given piece (filtering out pseudo-legal moves that put/leave friendly King in check).
 */
export function calculateLegalMoves(
  board: BoardGrid,
  coords: SquareCoordinates,
  piece: ChessPiece
): SquareCoordinates[] {
  const pseudoMoves = calculatePseudoLegalMoves(board, coords, piece);
  return pseudoMoves.filter(
    (move) => !simulatesMoveLeavesKingInCheck(board, coords, move, piece.color)
  );
}

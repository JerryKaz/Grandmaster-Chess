import { BoardGrid, SquareCoordinates, ChessPiece, Color, Move } from '../models/types';
import { calculateLegalMoves } from './moveValidator';
import { OPENING_BOOK } from '../utils/openingBook';

// --- Piece-Square Tables (PST) ---
// Positional values of pieces on different squares.
// Designed from White's perspective; mirrored for Black.

const pawnPST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const knightPST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopPST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const rookPST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const queenPST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const kingPST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

/**
 * Calculates the positional score of a single piece based on material and PST.
 */
function getPieceValue(piece: ChessPiece, row: number, col: number): number {
  let baseValue = 0;
  let pstValue = 0;

  // Mirror row index for black pieces (since Black moves in opposite direction)
  const evalRow = piece.color === 'white' ? row : 7 - row;

  switch (piece.type) {
    case 'pawn':
      baseValue = 100;
      pstValue = pawnPST[evalRow][col];
      break;
    case 'knight':
      baseValue = 320;
      pstValue = knightPST[evalRow][col];
      break;
    case 'bishop':
      baseValue = 330;
      pstValue = bishopPST[evalRow][col];
      break;
    case 'rook':
      baseValue = 500;
      pstValue = rookPST[evalRow][col];
      break;
    case 'queen':
      baseValue = 900;
      pstValue = queenPST[evalRow][col];
      break;
    case 'king':
      baseValue = 20000;
      pstValue = kingPST[evalRow][col];
      break;
  }

  return baseValue + pstValue;
}

/**
 * Static evaluation function for the board state.
 * White aims to maximize this score, Black aims to minimize it.
 */
function evaluateBoard(board: BoardGrid): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const value = getPieceValue(piece, r, c);
        if (piece.color === 'white') {
          score += value;
        } else {
          score -= value;
        }
      }
    }
  }
  return score;
}

/**
 * Simulates making a move on a temporary copy of the board grid.
 */
function simulateBoardMove(board: BoardGrid, from: SquareCoordinates, to: SquareCoordinates): BoardGrid {
  const newBoard = board.map((row) => [...row]);
  const movingPiece = newBoard[from.row][from.col];

  if (movingPiece) {
    newBoard[from.row][from.col] = null;

    // Handle standard pawn promotion to queen on final rank during engine evaluation
    const isPawnPromotion = movingPiece.type === 'pawn' && (to.row === 0 || to.row === 7);
    newBoard[to.row][to.col] = {
      ...movingPiece,
      type: isPawnPromotion ? 'queen' : movingPiece.type,
      hasMoved: true,
    };
  }

  return newBoard;
}

/**
 * Minimax algorithm with Alpha-Beta pruning for depth-based move evaluation.
 */
function minimax(
  board: BoardGrid,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0) {
    return evaluateBoard(board);
  }

  const activeColor: Color = isMaximizing ? 'white' : 'black';
  const allMoves: { from: SquareCoordinates; to: SquareCoordinates }[] = [];

  // Generate all legal moves
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === activeColor) {
        const legalDests = calculateLegalMoves(board, { row: r, col: c }, piece);
        for (const dest of legalDests) {
          allMoves.push({ from: { row: r, col: c }, to: dest });
        }
      }
    }
  }

  if (allMoves.length === 0) {
    // Checkmate or stalemate: return standard evaluation
    return evaluateBoard(board);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of allMoves) {
      const nextBoard = simulateBoardMove(board, move.from, move.to);
      const score = minimax(nextBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of allMoves) {
      const nextBoard = simulateBoardMove(board, move.from, move.to);
      const score = minimax(nextBoard, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) {
        break;
      }
    }
    return minEval;
  }
}

/**
 * Helper to convert square coordinates to standard algebraic notation.
 */
function squareToCoordString(sq: SquareCoordinates): string {
  const file = String.fromCharCode(97 + sq.col);
  const rank = 8 - sq.row;
  return `${file}${rank}`;
}

/**
 * Formats a move as a standard coordinate string (e.g., "e2e4").
 */
function moveToCoordString(from: SquareCoordinates, to: SquareCoordinates): string {
  return `${squareToCoordString(from)}${squareToCoordString(to)}`;
}

/**
 * Computes and returns the absolute best move for the current position.
 * Combines Master Openings from OPENING_BOOK and real-time Minimax depth search.
 */
export function findBestMove(
  board: BoardGrid,
  activeColor: Color,
  moveHistory: Move[],
  difficulty: 'easy' | 'medium' | 'hard' | 'gemini' = 'medium'
): { from: SquareCoordinates; to: SquareCoordinates } | null {
  // Generate all legal moves
  const isMaximizing = activeColor === 'white';
  const allMoves: { from: SquareCoordinates; to: SquareCoordinates }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === activeColor) {
        const legalDests = calculateLegalMoves(board, { row: r, col: c }, piece);
        for (const dest of legalDests) {
          allMoves.push({ from: { row: r, col: c }, to: dest });
        }
      }
    }
  }

  if (allMoves.length === 0) return null;

  // 1. Easy mode: 40% chance of random move to represent ELO 800 beginner play
  if (difficulty === 'easy') {
    if (Math.random() < 0.4) {
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    }
  }

  // 2. Attempt to match the move history against our master openings database (for non-easy modes)
  if (difficulty !== 'easy') {
    const historySequence = moveHistory.map((m) => moveToCoordString(m.from, m.to)).join(' ');
    const bookEntry = OPENING_BOOK[historySequence];

    if (bookEntry && bookEntry.moves && bookEntry.moves.length > 0) {
      // Select a master opening move randomly from the recommended options
      const selectedMoveStr = bookEntry.moves[Math.floor(Math.random() * bookEntry.moves.length)];
      
      // Parse the opening book string (e.g. "e2e4") back to coordinates
      const fromFile = selectedMoveStr.charCodeAt(0) - 97;
      const fromRank = 8 - parseInt(selectedMoveStr[1], 10);
      const toFile = selectedMoveStr.charCodeAt(2) - 97;
      const toRank = 8 - parseInt(selectedMoveStr[3], 10);

      return {
        from: { row: fromRank, col: fromFile },
        to: { row: toRank, col: toFile },
      };
    }
  }

  // Determine search depth based on difficulty
  let searchDepth = 2;
  if (difficulty === 'easy') {
    searchDepth = 1;
  } else if (difficulty === 'medium') {
    searchDepth = 2;
  } else if (difficulty === 'hard') {
    searchDepth = 3;
  } else if (difficulty === 'gemini') {
    searchDepth = 3;
  }

  // Shuffle candidate moves to add slight variety to equal-scored options
  allMoves.sort(() => Math.random() - 0.5);

  let bestMove: { from: SquareCoordinates; to: SquareCoordinates } | null = null;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of allMoves) {
      const nextBoard = simulateBoardMove(board, move.from, move.to);
      const score = minimax(nextBoard, searchDepth, -Infinity, Infinity, false);
      if (score > maxEval) {
        maxEval = score;
        bestMove = move;
      }
    }
  } else {
    let minEval = Infinity;
    for (const move of allMoves) {
      const nextBoard = simulateBoardMove(board, move.from, move.to);
      const score = minimax(nextBoard, searchDepth, -Infinity, Infinity, true);
      if (score < minEval) {
        minEval = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

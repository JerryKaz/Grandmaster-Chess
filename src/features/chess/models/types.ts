export type Color = 'white' | 'black';

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export type BoardTheme = 'classic' | 'ocean' | 'forest';

export interface ChessPiece {
  id: string; // Unique ID (e.g., 'w-pawn-1') used for stable React rendering and layout transitions
  type: PieceType;
  color: Color;
  hasMoved: boolean;
}

export interface SquareCoordinates {
  row: number; // 0 to 7 (0 is rank 8, 7 is rank 1)
  col: number; // 0 to 7 (0 is file 'a', 7 is file 'h')
}

export type BoardGrid = (ChessPiece | null)[][];

export interface Move {
  from: SquareCoordinates;
  to: SquareCoordinates;
  piece: ChessPiece;
  capturedPiece: ChessPiece | null;
  notation: string; // Algebraic notation, e.g., 'e4', 'Nf3'
  symbolicNotation: string; // Symbolic notation with piece symbols, e.g. '♕xe5+'
  timestamp: number;
}

export interface GameState {
  board: BoardGrid;
  activeColor: Color;
  selectedSquare: SquareCoordinates | null;
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  winner: Color | null;
  capturedPieces: {
    white: ChessPiece[]; // Pieces captured by White (i.e. Black pieces)
    black: ChessPiece[]; // Pieces captured by Black (i.e. White pieces)
  };
}

export interface PromotionState {
  from: SquareCoordinates;
  to: SquareCoordinates;
  color: Color;
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'icloud' | 'email';
  avatar: string;
}


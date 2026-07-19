import { create } from 'zustand';
import { GameState, SquareCoordinates, Move, ChessPiece, Color, PieceType, BoardTheme, PromotionState, User } from '../models/types';
import { generateInitialBoard, convertToAlgebraic } from '../utils/initialBoard';
import { audioService } from '../services/audioService';
import { isKingInCheck, calculateLegalMoves } from '../engine/moveValidator';

interface ChessStore extends GameState {
  redoHistory: Move[];
  gameMode: 'local' | 'ai' | 'multiplayer';
  aiDifficulty: 'easy' | 'medium' | 'hard' | 'gemini';
  aiPlayerColor: 'white' | 'black';
  multiplayerRoomId: string | null;
  multiplayerRole: 'white' | 'black' | null;
  soundEnabled: boolean;
  soundMoveEnabled: boolean;
  soundCaptureEnabled: boolean;
  soundAlertEnabled: boolean;
  boardTheme: BoardTheme;
  showCoordinates: boolean;
  pendingPromotion: PromotionState | null;
  hintMove: { from: SquareCoordinates; to: SquareCoordinates } | null;
  user: User | null;

  resetGame: () => void;
  selectSquare: (coords: SquareCoordinates | null) => void;
  movePiece: (from: SquareCoordinates, to: SquareCoordinates, promotionType?: PieceType) => void;
  setPendingPromotion: (pending: PromotionState | null) => void;
  undo: () => void;
  redo: () => void;
  setGameMode: (mode: 'local' | 'ai' | 'multiplayer') => void;
  setAiDifficulty: (difficulty: 'easy' | 'medium' | 'hard' | 'gemini') => void;
  setAiPlayerColor: (color: 'white' | 'black') => void;
  setMultiplayerState: (state: { roomId: string | null; role: 'white' | 'black' | null }) => void;
  syncGameState: (state: Partial<GameState>) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundMoveEnabled: (enabled: boolean) => void;
  setSoundCaptureEnabled: (enabled: boolean) => void;
  setSoundAlertEnabled: (enabled: boolean) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setShowCoordinates: (show: boolean) => void;
  setHintMove: (move: { from: SquareCoordinates; to: SquareCoordinates } | null) => void;
  setUser: (user: User | null) => void;
}

const initialGameState: GameState = {
  board: generateInitialBoard(),
  activeColor: 'white',
  selectedSquare: null,
  moveHistory: [],
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  winner: null,
  capturedPieces: {
    white: [],
    black: [],
  },
};

/**
 * Reconstructs the exact game state for a given sequence of chess moves.
 */
function reconstructStateFromHistory(moves: Move[]) {
  const board = generateInitialBoard();
  const capturedPieces = {
    white: [] as ChessPiece[],
    black: [] as ChessPiece[],
  };
  let activeColor: Color = 'white';

  for (const move of moves) {
    const fromPiece = board[move.from.row][move.from.col];
    if (fromPiece) {
      const targetPiece = board[move.to.row][move.to.col];
      if (targetPiece) {
        if (targetPiece.color === 'white') {
          capturedPieces.black.push(targetPiece);
        } else {
          capturedPieces.white.push(targetPiece);
        }
      }
      board[move.from.row][move.from.col] = null;
      board[move.to.row][move.to.col] = {
        ...move.piece,
      };
    }
    activeColor = activeColor === 'white' ? 'black' : 'white';
  }

  // Calculate check state for activeColor
  const isCheck = isKingInCheck(board, activeColor);

  let hasAnyLegalMove = false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === activeColor) {
        const legals = calculateLegalMoves(board, { row: r, col: c }, p);
        if (legals.length > 0) {
          hasAnyLegalMove = true;
          break;
        }
      }
    }
    if (hasAnyLegalMove) break;
  }

  let isCheckmate = false;
  let isStalemate = false;
  let winner: Color | null = null;

  if (!hasAnyLegalMove) {
    if (isCheck) {
      isCheckmate = true;
      winner = activeColor === 'white' ? 'black' : 'white';
    } else {
      isStalemate = true;
    }
  }

  return {
    board,
    activeColor,
    capturedPieces,
    isCheck,
    isCheckmate,
    isStalemate,
    winner,
    selectedSquare: null,
  };
}

export const useChessStore = create<ChessStore>((set) => {
  let soundEnabledInit = true;
  let soundMoveEnabledInit = true;
  let soundCaptureEnabledInit = true;
  let soundAlertEnabledInit = true;
  let boardThemeInit: BoardTheme = 'forest';
  let showCoordinatesInit = true;
  try {
    const savedSound = localStorage.getItem('chess_sound_enabled');
    if (savedSound !== null) {
      soundEnabledInit = savedSound === 'true';
    }
    const savedSoundMove = localStorage.getItem('chess_sound_move_enabled');
    if (savedSoundMove !== null) {
      soundMoveEnabledInit = savedSoundMove === 'true';
    }
    const savedSoundCapture = localStorage.getItem('chess_sound_capture_enabled');
    if (savedSoundCapture !== null) {
      soundCaptureEnabledInit = savedSoundCapture === 'true';
    }
    const savedSoundAlert = localStorage.getItem('chess_sound_alert_enabled');
    if (savedSoundAlert !== null) {
      soundAlertEnabledInit = savedSoundAlert === 'true';
    }
    const savedTheme = localStorage.getItem('chess_board_theme') as BoardTheme | null;
    if (savedTheme === 'classic' || savedTheme === 'ocean' || savedTheme === 'forest') {
      boardThemeInit = savedTheme;
    }
    const savedShowCoordinates = localStorage.getItem('chess_show_coordinates');
    if (savedShowCoordinates !== null) {
      showCoordinatesInit = savedShowCoordinates === 'true';
    }
  } catch (e) {
    console.warn("localStorage is not available for chess settings", e);
  }

  let userInit: User | null = null;
  try {
    const savedUserStr = localStorage.getItem('chess_user_session');
    if (savedUserStr) {
      userInit = JSON.parse(savedUserStr);
    }
  } catch (e) {
    console.warn("Could not load user session from localStorage", e);
  }

  return {
    ...initialGameState,
    redoHistory: [],
    gameMode: 'local',
    aiDifficulty: 'medium',
    aiPlayerColor: 'white',
    multiplayerRoomId: null,
    multiplayerRole: null,
    soundEnabled: soundEnabledInit,
    soundMoveEnabled: soundMoveEnabledInit,
    soundCaptureEnabled: soundCaptureEnabledInit,
    soundAlertEnabled: soundAlertEnabledInit,
    boardTheme: boardThemeInit,
    showCoordinates: showCoordinatesInit,
    pendingPromotion: null,
    hintMove: null,
    user: userInit,

    resetGame: () =>
      set((state) => ({
        ...initialGameState,
        board: generateInitialBoard(),
        redoHistory: [],
        pendingPromotion: null,
        hintMove: null,
        gameMode: state.gameMode,
        aiDifficulty: state.aiDifficulty,
        aiPlayerColor: state.aiPlayerColor,
        multiplayerRoomId: state.multiplayerRoomId,
        multiplayerRole: state.multiplayerRole,
      })),

  selectSquare: (coords) => set({ selectedSquare: coords, hintMove: null }),
  setPendingPromotion: (pending) => set({ pendingPromotion: pending }),

  movePiece: (from, to, promotionType) =>
    set((state) => {
      const fromPiece = state.board[from.row][from.col];
      if (!fromPiece) return {};

      // Prepare target piece (could be null or opponent piece to capture)
      const targetPiece = state.board[to.row][to.col];

      // Create deeply copied and updated board grid to guarantee clean React re-renders
      const newGrid = state.board.map((row) => [...row]);

      // Move piece to the new coordinate
      const updatedPiece: ChessPiece = {
        ...fromPiece,
        hasMoved: true,
      };

      if (fromPiece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
        updatedPiece.type = promotionType || 'queen';
      }

      newGrid[from.row][from.col] = null;
      newGrid[to.row][to.col] = updatedPiece;

      // Handle piece captures (add to captured lists)
      const updatedCaptured = {
        white: [...state.capturedPieces.white],
        black: [...state.capturedPieces.black],
      };

      if (targetPiece) {
        if (targetPiece.color === 'white') {
          updatedCaptured.black.push(targetPiece); // Black captures White piece
        } else {
          updatedCaptured.white.push(targetPiece); // White captures Black piece
        }
      }

      // Generate accurate chess algebraic notation (e.g. e4, Nf3, exd5)
      const destName = convertToAlgebraic(to.row, to.col);
      
      const getPieceChar = (type: PieceType): string => {
        switch (type) {
          case 'knight': return 'N';
          case 'bishop': return 'B';
          case 'rook': return 'R';
          case 'queen': return 'Q';
          case 'king': return 'K';
          default: return '';
        }
      };

      const getPieceSymbol = (type: PieceType, color: Color): string => {
        if (color === 'white') {
          switch (type) {
            case 'king': return '♔';
            case 'queen': return '♕';
            case 'rook': return '♖';
            case 'bishop': return '♗';
            case 'knight': return '♘';
            case 'pawn': return '♙';
            default: return '';
          }
        } else {
          switch (type) {
            case 'king': return '♚';
            case 'queen': return '♛';
            case 'rook': return '♜';
            case 'bishop': return '♝';
            case 'knight': return '♞';
            case 'pawn': return '♟';
            default: return '';
          }
        }
      };

      let notation = '';
      let symbolicNotation = '';

      if (fromPiece.type === 'pawn') {
        if (targetPiece) {
          const startFile = String.fromCharCode(97 + from.col);
          notation = `${startFile}x${destName}`;
          symbolicNotation = `${getPieceSymbol('pawn', fromPiece.color)}x${destName}`;
        } else {
          notation = destName;
          symbolicNotation = `${getPieceSymbol('pawn', fromPiece.color)}${destName}`;
        }

        const actualPromo = fromPiece.type === 'pawn' && (to.row === 0 || to.row === 7) ? (promotionType || 'queen') : null;
        if (actualPromo) {
          const promoChar = getPieceChar(actualPromo);
          const promoSym = getPieceSymbol(actualPromo, fromPiece.color);
          notation += `=${promoChar}`;
          symbolicNotation += `=${promoSym}`;
        }
      } else {
        const pieceChar = getPieceChar(fromPiece.type);
        const pieceSym = getPieceSymbol(fromPiece.type, fromPiece.color);
        
        if (targetPiece) {
          notation = `${pieceChar}x${destName}`;
          symbolicNotation = `${pieceSym}x${destName}`;
        } else {
          notation = `${pieceChar}${destName}`;
          symbolicNotation = `${pieceSym}${destName}`;
        }
      }

      const newMove: Move = {
        from,
        to,
        piece: updatedPiece,
        capturedPiece: targetPiece,
        notation,
        symbolicNotation,
        timestamp: Date.now(),
      };

      const nextColor = state.activeColor === 'white' ? 'black' : 'white';

      // 1. Determine check state for the next player
      const isCheck = isKingInCheck(newGrid, nextColor);

      // 2. Check if the next player has any legal moves available
      let hasAnyLegalMove = false;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = newGrid[r][c];
          if (p && p.color === nextColor) {
            const legals = calculateLegalMoves(newGrid, { row: r, col: c }, p);
            if (legals.length > 0) {
              hasAnyLegalMove = true;
              break;
            }
          }
        }
        if (hasAnyLegalMove) break;
      }

      let isCheckmate = false;
      let isStalemate = false;
      let winner: Color | null = null;

      if (!hasAnyLegalMove) {
        if (isCheck) {
          isCheckmate = true;
          winner = state.activeColor; // The player who just moved has won
        } else {
          isStalemate = true;
        }
      }

      if (isCheckmate) {
        newMove.notation += '#';
        newMove.symbolicNotation += '#';
      } else if (isCheck) {
        newMove.notation += '+';
        newMove.symbolicNotation += '+';
      }

      // 3. Play corresponding audio with check/checkmate/stalemate priority
      if (isCheckmate || isStalemate) {
        audioService.playGameEnd();
      } else if (isCheck) {
        audioService.playCheck();
      } else if (targetPiece) {
        audioService.playCapture();
      } else {
        audioService.playMove();
      }

      return {
        board: newGrid,
        selectedSquare: null,
        activeColor: nextColor,
        moveHistory: [...state.moveHistory, newMove],
        capturedPieces: updatedCaptured,
        isCheck,
        isCheckmate,
        isStalemate,
        winner,
        redoHistory: [], // clear redo history on new move
        hintMove: null,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.moveHistory.length === 0) return {};

      const lastMove = state.moveHistory[state.moveHistory.length - 1];
      const nextMoveHistory = state.moveHistory.slice(0, -1);
      const nextRedoHistory = [lastMove, ...state.redoHistory];

      const reconstructed = reconstructStateFromHistory(nextMoveHistory);

      if (reconstructed.isCheckmate || reconstructed.isStalemate) {
        audioService.playGameEnd();
      } else if (reconstructed.isCheck) {
        audioService.playCheck();
      } else {
        audioService.playMove();
      }

      return {
        ...reconstructed,
        moveHistory: nextMoveHistory,
        redoHistory: nextRedoHistory,
        hintMove: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoHistory.length === 0) return {};

      const nextMove = state.redoHistory[0];
      const nextRedoHistory = state.redoHistory.slice(1);
      const nextMoveHistory = [...state.moveHistory, nextMove];

      const reconstructed = reconstructStateFromHistory(nextMoveHistory);

      if (reconstructed.isCheckmate || reconstructed.isStalemate) {
        audioService.playGameEnd();
      } else if (reconstructed.isCheck) {
        audioService.playCheck();
      } else if (nextMove.capturedPiece) {
        audioService.playCapture();
      } else {
        audioService.playMove();
      }

      return {
        ...reconstructed,
        moveHistory: nextMoveHistory,
        redoHistory: nextRedoHistory,
        hintMove: null,
      };
    }),

  setGameMode: (mode) => set({ gameMode: mode }),

  setAiDifficulty: (difficulty) => set({ aiDifficulty: difficulty }),

  setAiPlayerColor: (color) => set({ aiPlayerColor: color }),

  setMultiplayerState: (state) =>
    set({
      multiplayerRoomId: state.roomId,
      multiplayerRole: state.role,
    }),

  syncGameState: (state) => set((prev) => ({ ...prev, ...state })),

  setSoundEnabled: (enabled) => {
    try {
      localStorage.setItem('chess_sound_enabled', String(enabled));
    } catch (e) {
      console.warn("Could not save sound setting to localStorage", e);
    }
    set({ soundEnabled: enabled });
  },

  setSoundMoveEnabled: (enabled) => {
    try {
      localStorage.setItem('chess_sound_move_enabled', String(enabled));
    } catch (e) {
      console.warn("Could not save sound setting to localStorage", e);
    }
    set({ soundMoveEnabled: enabled });
  },

  setSoundCaptureEnabled: (enabled) => {
    try {
      localStorage.setItem('chess_sound_capture_enabled', String(enabled));
    } catch (e) {
      console.warn("Could not save sound setting to localStorage", e);
    }
    set({ soundCaptureEnabled: enabled });
  },

  setSoundAlertEnabled: (enabled) => {
    try {
      localStorage.setItem('chess_sound_alert_enabled', String(enabled));
    } catch (e) {
      console.warn("Could not save sound setting to localStorage", e);
    }
    set({ soundAlertEnabled: enabled });
  },

  setBoardTheme: (theme) => {
    try {
      localStorage.setItem('chess_board_theme', theme);
    } catch (e) {
      console.warn("Could not save theme setting to localStorage", e);
    }
    set({ boardTheme: theme });
  },
  setShowCoordinates: (show) => {
    try {
      localStorage.setItem('chess_show_coordinates', String(show));
    } catch (e) {
      console.warn("Could not save show coordinates setting to localStorage", e);
    }
    set({ showCoordinates: show });
  },
  setHintMove: (move) => set({ hintMove: move }),
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('chess_user_session', JSON.stringify(user));
      } else {
        localStorage.removeItem('chess_user_session');
      }
    } catch (e) {
      console.warn("Could not save user session to localStorage", e);
    }
    set({ user });
  },
};
});

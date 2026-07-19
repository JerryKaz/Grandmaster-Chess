import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crown, 
  RotateCcw, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Activity,
  ArrowUpDown,
  Users,
  Copy,
  Check,
  Loader2,
  Swords,
  Play,
  Volume2,
  VolumeX,
  Trophy,
  Clock,
  X,
  Flag,
  Lightbulb,
  Sparkles,
  Settings,
  Mail,
  LogOut,
  User as UserIcon,
  Globe,
  Flame
} from 'lucide-react';
import { useChessStore } from './features/chess/store/chessStore';
import ChessBoard from './components/board/ChessBoard';
import { calculateLegalMoves } from './features/chess/engine/moveValidator';
import { findBestMove } from './features/chess/engine/chessEngine';
import { convertToAlgebraic } from './features/chess/utils/initialBoard';
import { SquareCoordinates, Color, User } from './features/chess/models/types';
import { audioService } from './features/chess/services/audioService';

export default function App() {
  const resetGame = useChessStore((state) => state.resetGame);
  const activeColor = useChessStore((state) => state.activeColor);
  const moveHistory = useChessStore((state) => state.moveHistory);
  const capturedPieces = useChessStore((state) => state.capturedPieces);
  
  // Calculate material score dynamically
  const materialScores = useMemo(() => {
    const getPieceValue = (type: string) => {
      switch (type) {
        case 'pawn': return 1;
        case 'knight': return 3;
        case 'bishop': return 3;
        case 'rook': return 5;
        case 'queen': return 9;
        default: return 0;
      }
    };
    const whiteValue = capturedPieces.white.reduce((acc, p) => acc + getPieceValue(p.type), 0);
    const blackValue = capturedPieces.black.reduce((acc, p) => acc + getPieceValue(p.type), 0);
    return {
      whiteLead: whiteValue > blackValue ? whiteValue - blackValue : 0,
      blackLead: blackValue > whiteValue ? blackValue - whiteValue : 0,
    };
  }, [capturedPieces]);
  const isCheck = useChessStore((state) => state.isCheck);
  const isCheckmate = useChessStore((state) => state.isCheckmate);
  const isStalemate = useChessStore((state) => state.isStalemate);
  const winner = useChessStore((state) => state.winner);
  const undo = useChessStore((state) => state.undo);
  const redo = useChessStore((state) => state.redo);
  const redoHistory = useChessStore((state) => state.redoHistory || []);
  const board = useChessStore((state) => state.board);
  const movePiece = useChessStore((state) => state.movePiece);

  // Multiplayer states
  const gameMode = useChessStore((state) => state.gameMode);
  const multiplayerRoomId = useChessStore((state) => state.multiplayerRoomId);
  const multiplayerRole = useChessStore((state) => state.multiplayerRole);
  const soundEnabled = useChessStore((state) => state.soundEnabled);
  const soundMoveEnabled = useChessStore((state) => state.soundMoveEnabled);
  const soundCaptureEnabled = useChessStore((state) => state.soundCaptureEnabled);
  const soundAlertEnabled = useChessStore((state) => state.soundAlertEnabled);
  const boardTheme = useChessStore((state) => state.boardTheme);
  const showCoordinates = useChessStore((state) => state.showCoordinates);
  const setShowCoordinates = useChessStore((state) => state.setShowCoordinates);

  // Store actions
  const setGameMode = useChessStore((state) => state.setGameMode);
  const setMultiplayerState = useChessStore((state) => state.setMultiplayerState);
  const syncGameState = useChessStore((state) => state.syncGameState);
  const setSoundEnabled = useChessStore((state) => state.setSoundEnabled);
  const setSoundMoveEnabled = useChessStore((state) => state.setSoundMoveEnabled);
  const setSoundCaptureEnabled = useChessStore((state) => state.setSoundCaptureEnabled);
  const setSoundAlertEnabled = useChessStore((state) => state.setSoundAlertEnabled);
  const setBoardTheme = useChessStore((state) => state.setBoardTheme);
  const hintMove = useChessStore((state) => state.hintMove);
  const setHintMove = useChessStore((state) => state.setHintMove);

  const handleRequestHint = () => {
    if (isCheckmate || isStalemate || winner || gameEndReason) return;
    const bestMove = findBestMove(board, activeColor, moveHistory);
    if (bestMove) {
      setHintMove(bestMove);
      audioService.playMove();
    }
  };

  // User Session & Authentication UI states
  const user = useChessStore((state) => state.user);
  const setUser = useChessStore((state) => state.setUser);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authProvider, setAuthProvider] = useState<'google' | 'icloud' | 'email' | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Online Multiplayer users polled from the current room
  const [roomWhiteUser, setRoomWhiteUser] = useState<any>(null);
  const [roomBlackUser, setRoomBlackUser] = useState<any>(null);

  // Local component states
  const [isFlipped, setIsFlipped] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pgnCopied, setPgnCopied] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  
  // Premium mobile app experience states
  const [showSplash, setShowSplash] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'game' | 'stats' | 'analysis'>('game');

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);
  
  // Tabbed sidebar selector
  const [sidebarTab, setSidebarTab] = useState<'moves' | 'analysis'>('moves');
  const [liveCoaching, setLiveCoaching] = useState(true);

  // AI Thinking state
  const [aiIsThinking, setAiIsThinking] = useState(false);

  // Position Analysis states
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [positionAnalysis, setPositionAnalysis] = useState<{
    score: number;
    summary: string;
    whitePlan: string;
    blackPlan: string;
    lastMoveCommentary: string;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Simple offline timers for premium representation
  const [whiteTime, setWhiteTime] = useState(600); // 10 minutes
  const [blackTime, setBlackTime] = useState(600);

  // Game End Summary states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gameEndReason, setGameEndReason] = useState<'checkmate' | 'stalemate' | 'resignation' | 'draw' | 'timeout' | null>(null);
  const [summaryWinner, setSummaryWinner] = useState<'white' | 'black' | 'draw' | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Format seconds into MM:SS
  const formatTime = (timeInSecs: number) => {
    const minutes = Math.floor(timeInSecs / 60);
    const seconds = timeInSecs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) {
      return `${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  // Timer loop for game duration
  useEffect(() => {
    if (isCheckmate || isStalemate || winner || gameEndReason) return;
    if (moveHistory.length === 0) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCheckmate, isStalemate, winner, gameEndReason, moveHistory.length]);

  // Synchronize checkmate / stalemate to summary trigger
  useEffect(() => {
    if (isCheckmate) {
      setGameEndReason('checkmate');
      setSummaryWinner(winner);
      setShowSummary(true);
    } else if (isStalemate) {
      setGameEndReason('stalemate');
      setSummaryWinner('draw');
      setShowSummary(true);
    }
  }, [isCheckmate, isStalemate, winner]);

  // Handle game reset / clear
  useEffect(() => {
    if (moveHistory.length === 0) {
      setWhiteTime(600);
      setBlackTime(600);
      setElapsedSeconds(0);
      setGameEndReason(null);
      setSummaryWinner(null);
      setShowSummary(false);
    }
  }, [moveHistory.length]);

  // Timer loop with timeout handling
  useEffect(() => {
    if (isCheckmate || isStalemate || winner || gameEndReason) return;
    const interval = setInterval(() => {
      if (activeColor === 'white') {
        setWhiteTime((prev) => (prev <= 1 ? 0 : prev - 1));
      } else {
        setBlackTime((prev) => (prev <= 1 ? 0 : prev - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeColor, isCheckmate, isStalemate, winner, gameEndReason]);

  // Handle timeout conditions cleanly in separate side-effects
  useEffect(() => {
    if (gameEndReason) return;
    if (whiteTime === 0) {
      setGameEndReason('timeout');
      setSummaryWinner('black');
      setShowSummary(true);
      syncGameState({ winner: 'black' });
    }
  }, [whiteTime, gameEndReason, syncGameState]);

  useEffect(() => {
    if (gameEndReason) return;
    if (blackTime === 0) {
      setGameEndReason('timeout');
      setSummaryWinner('white');
      setShowSummary(true);
      syncGameState({ winner: 'white' });
    }
  }, [blackTime, gameEndReason, syncGameState]);

  // AI Turn triggering logic
  const aiDifficulty = useChessStore((state) => state.aiDifficulty);
  const aiPlayerColor = useChessStore((state) => state.aiPlayerColor);

  // Current session's win/loss/streak tracking
  interface SessionStats {
    wins: number;
    losses: number;
    draws: number;
    streak: number; // positive for win streak, negative for loss streak
  }

  const [sessionStats, setSessionStats] = useState<SessionStats>(() => {
    return { wins: 0, losses: 0, draws: 0, streak: 0 };
  });

  // Load stats when user changes
  useEffect(() => {
    const key = user ? `chess_session_stats_${user.id}` : `chess_session_stats_guest`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setSessionStats(JSON.parse(saved));
      } else {
        setSessionStats({ wins: 0, losses: 0, draws: 0, streak: 0 });
      }
    } catch (e) {
      console.warn("Could not load session stats from localStorage", e);
    }
  }, [user]);

  const gameResultCounted = React.useRef(false);

  // Reset counted flag when move history is empty (e.g. game restarted or cleared)
  useEffect(() => {
    if (moveHistory.length === 0) {
      gameResultCounted.current = false;
    }
  }, [moveHistory.length]);

  // Track session stats when a game ends
  useEffect(() => {
    if (gameResultCounted.current) return;
    if (gameEndReason || summaryWinner) {
      let outcome: 'win' | 'loss' | 'draw' | null = null;
      if (gameMode === 'ai') {
        if (summaryWinner === 'draw' || gameEndReason === 'draw' || gameEndReason === 'stalemate') {
          outcome = 'draw';
        } else if (summaryWinner === aiPlayerColor) {
          outcome = 'win';
        } else {
          outcome = 'loss';
        }
      } else if (gameMode === 'multiplayer') {
        if (summaryWinner === 'draw' || gameEndReason === 'draw' || gameEndReason === 'stalemate') {
          outcome = 'draw';
        } else if (summaryWinner === multiplayerRole) {
          outcome = 'win';
        } else {
          outcome = 'loss';
        }
      }

      if (outcome) {
        setSessionStats((prev) => {
          const nextWins = prev.wins + (outcome === 'win' ? 1 : 0);
          const nextLosses = prev.losses + (outcome === 'loss' ? 1 : 0);
          const nextDraws = prev.draws + (outcome === 'draw' ? 1 : 0);
          
          let nextStreak = prev.streak;
          if (outcome === 'win') {
            nextStreak = prev.streak >= 0 ? prev.streak + 1 : 1;
          } else if (outcome === 'loss') {
            nextStreak = prev.streak <= 0 ? prev.streak - 1 : -1;
          }

          const newStats = { wins: nextWins, losses: nextLosses, draws: nextDraws, streak: nextStreak };
          const key = user ? `chess_session_stats_${user.id}` : `chess_session_stats_guest`;
          try {
            localStorage.setItem(key, JSON.stringify(newStats));
          } catch (e) {
            console.warn("Could not save session stats to localStorage", e);
          }
          return newStats;
        });
        gameResultCounted.current = true;
      }
    }
  }, [gameEndReason, summaryWinner, gameMode, aiPlayerColor, multiplayerRole, user]);

  useEffect(() => {
    if (gameMode !== 'ai' || isCheckmate || isStalemate || winner || gameEndReason) return;
    if (activeColor === aiPlayerColor) return;

    let active = true;
    setAiIsThinking(true);

    const timer = setTimeout(() => {
      if (!active) return;
      const currentStore = useChessStore.getState();
      const bestMove = findBestMove(
        currentStore.board,
        currentStore.activeColor,
        currentStore.moveHistory,
        currentStore.aiDifficulty
      );

      if (bestMove) {
        currentStore.movePiece(bestMove.from, bestMove.to);
      }
      setAiIsThinking(false);
    }, 800 + Math.random() * 600); // Realistic 0.8 - 1.4 second delay for organic play feel

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [gameMode, activeColor, aiPlayerColor, aiDifficulty, isCheckmate, isStalemate, winner, gameEndReason]);



  const handleAnalyzePosition = async () => {
    try {
      setAnalysisLoading(true);
      setAnalysisError(null);
      const currentStore = useChessStore.getState();

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: currentStore.board,
          moveHistory: currentStore.moveHistory,
          activeColor: currentStore.activeColor,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to compile analysis for this position.");
      }

      const data = await res.json();
      setPositionAnalysis(data);
    } catch (err: any) {
      console.error("Gemini Analysis Error:", err);
      setAnalysisError(err.message || "Failed to establish contact with the Coaching Assistant.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Auto-analyze position when the board moves or when switching to the analysis tab
  useEffect(() => {
    if (!liveCoaching || sidebarTab !== 'analysis') {
      setPositionAnalysis(null);
      setAnalysisError(null);
      return;
    }

    // Debounce the analysis slightly to avoid multiple rapid API calls during undo/redo or quick moves
    const timer = setTimeout(() => {
      handleAnalyzePosition();
    }, 600);

    return () => clearTimeout(timer);
  }, [moveHistory.length, sidebarTab, liveCoaching]);

  // Keyboard navigation for game history (undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses if user is typing in form inputs
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        undo();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setJoinRoomId(roomCode.toUpperCase());
      setGameMode('multiplayer');
    }
  }, [setGameMode]);

  // Multiplayer Polling loop
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !multiplayerRoomId) return;

    let active = true;
    const pollRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${multiplayerRoomId}`);
        if (!res.ok) throw new Error("Room not found");
        const data = await res.json();
        
        if (!active) return;

        setOpponentJoined(data.whitePlayerJoined && data.blackPlayerJoined);
        setRoomWhiteUser(data.whitePlayer);
        setRoomBlackUser(data.blackPlayer);

        const currentStore = useChessStore.getState();
        
        if (currentStore.moveHistory.length > data.moveHistory.length) {
          // Push our moves
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
        } else if (data.moveHistory.length > currentStore.moveHistory.length) {
          // Sync server state to our local store
          syncGameState({
            board: data.board,
            activeColor: data.activeColor,
            moveHistory: data.moveHistory,
            capturedPieces: data.capturedPieces,
            isCheck: data.isCheck,
            isCheckmate: data.isCheckmate,
            isStalemate: data.isStalemate,
            winner: data.winner,
          });
          
          if (data.isCheckmate || data.isStalemate) {
            audioService.playGameEnd();
          } else if (data.isCheck) {
            audioService.playCheck();
          } else {
            const lastMove = data.moveHistory[data.moveHistory.length - 1];
            if (lastMove && lastMove.capturedPiece) {
              audioService.playCapture();
            } else {
              audioService.playMove();
            }
          }
        }
      } catch (err) {
        console.error("Error polling room:", err);
      }
    };

    pollRoom();
    const interval = setInterval(pollRoom, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [gameMode, multiplayerRoomId]);

  // Multiplayer Handlers
  const handleCreateRoom = async () => {
    if (!user) {
      setLobbyError("Please log in with Google, iCloud, or Email first to create a game!");
      setShowAuthModal(true);
      return;
    }

    try {
      setLobbyLoading(true);
      setLobbyError(null);
      resetGame();
      
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: useChessStore.getState().board, userId: user.id }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const data = await res.json();
      
      setMultiplayerState({ roomId: data.roomId, role: 'white' });
      setIsFlipped(false);
      audioService.playMove();
    } catch (err: any) {
      setLobbyError(err.message || "Failed to create room");
    } finally {
      setLobbyLoading(false);
    }
  };

  const handleJoinRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinRoomId.trim()) return;

    if (!user) {
      setLobbyError("Please log in with Google, iCloud, or Email first to join a game!");
      setShowAuthModal(true);
      return;
    }

    try {
      setLobbyLoading(true);
      setLobbyError(null);
      resetGame();

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: joinRoomId, userId: user.id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to join room");
      }
      const data = await res.json();

      setMultiplayerState({ roomId: data.roomId, role: 'black' });
      setIsFlipped(true); // Black plays at the bottom when flipped is true
      audioService.playMove();
    } catch (err: any) {
      setLobbyError(err.message || "Failed to join room");
    } finally {
      setLobbyLoading(false);
    }
  };

  const handleAuthSubmit = async (provider: 'google' | 'icloud' | 'email', customEmail?: string, customName?: string) => {
    setAuthLoading(true);
    setAuthError(null);

    const emailToUse = customEmail || authEmail || (provider === 'google' ? 'jerrymyronkaz@gmail.com' : '');
    const nameToUse = customName || authName || (provider === 'google' ? 'Jerry Kaz' : provider === 'icloud' ? 'iCloud Player' : 'Chess Player');

    if (!emailToUse) {
      setAuthError("Email address is required.");
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToUse,
          name: nameToUse,
          provider,
          avatar: provider === 'google' ? 'G' : provider === 'icloud' ? '' : '✉️',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to log in.");
      }

      const loggedUser = await res.json();
      setUser(loggedUser);
      setShowAuthModal(false);
      setAuthProvider(null);
      setAuthEmail('');
      setAuthName('');
      setAuthPassword('');
      audioService.playMove();

      // If they were trying to join a room, automatically join now
      if (joinRoomId.trim()) {
        try {
          const joinRes = await fetch('/api/rooms/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: joinRoomId, userId: loggedUser.id }),
          });
          if (joinRes.ok) {
            const joinData = await joinRes.json();
            setMultiplayerState({ roomId: joinData.roomId, role: 'black' });
            setIsFlipped(true);
          }
        } catch (e) {
          console.error("Auto-join failed:", e);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Something went wrong during login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const copyRoomCode = () => {
    if (!multiplayerRoomId) return;
    navigator.clipboard.writeText(multiplayerRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPGN = () => {
    if (moveHistory.length === 0) return;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    let resultChar = '*';
    if (isCheckmate) {
      resultChar = winner === 'white' ? '1-0' : '0-1';
    } else if (isStalemate || gameEndReason === 'draw' || gameEndReason === 'stalemate') {
      resultChar = '1/2-1/2';
    } else if (winner === 'white') {
      resultChar = '1-0';
    } else if (winner === 'black') {
      resultChar = '0-1';
    }

    const { white: whitePlayer, black: blackPlayer } = getPlayerDetails();

    let headers = [
      `[Event "Casual Match"]`,
      `[Site "AI Studio Chess"]`,
      `[Date "${dateStr}"]`,
      `[Round "1"]`,
      `[White "${whitePlayer.name.replace(/ \(You\)$/, '')}"]`,
      `[Black "${blackPlayer.name.replace(/ \(You\)$/, '')}"]`,
      `[Result "${resultChar}"]`,
      `[Variant "Standard"]`,
      `[TimeControl "-"]`
    ].join('\n');

    let movesList: string[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moveHistory[i].notation;
      const blackMove = moveHistory[i + 1] ? moveHistory[i + 1].notation : '';
      if (blackMove) {
        movesList.push(`${moveNum}. ${whiteMove} ${blackMove}`);
      } else {
        movesList.push(`${moveNum}. ${whiteMove}`);
      }
    }

    const pgnString = `${headers}\n\n${movesList.join(' ')} ${resultChar}`;
    navigator.clipboard.writeText(pgnString);
    setPgnCopied(true);
    setTimeout(() => setPgnCopied(false), 2000);
  };

  const handleResign = () => {
    if (isCheckmate || isStalemate || winner || gameEndReason) return;
    
    let resigningColor: Color = activeColor;
    if (gameMode === 'multiplayer' && multiplayerRole) {
      resigningColor = multiplayerRole;
    }

    const winningColor: Color = resigningColor === 'white' ? 'black' : 'white';
    
    setGameEndReason('resignation');
    setSummaryWinner(winningColor);
    setShowSummary(true);
    
    syncGameState({
      winner: winningColor,
    });
  };

  const handleOfferDraw = () => {
    if (isCheckmate || isStalemate || winner || gameEndReason) return;

    setGameEndReason('draw');
    setSummaryWinner('draw');
    setShowSummary(true);
    syncGameState({ winner: null });
  };

  // Determine names & ratings based on mode
  const getPlayerDetails = () => {
    if (gameMode === 'multiplayer') {
      const whiteName = roomWhiteUser ? `${roomWhiteUser.name} (${roomWhiteUser.provider === 'google' ? 'Google' : roomWhiteUser.provider === 'icloud' ? 'iCloud' : 'Email'})` : 'White Player';
      const blackName = roomBlackUser ? `${roomBlackUser.name} (${roomBlackUser.provider === 'google' ? 'Google' : roomBlackUser.provider === 'icloud' ? 'iCloud' : 'Email'})` : (opponentJoined ? 'Opponent (Black)' : 'Waiting for Opponent...');
      const whiteAvatar = roomWhiteUser ? roomWhiteUser.avatar : '👤';
      const blackAvatar = roomBlackUser ? roomBlackUser.avatar : (opponentJoined ? '⚔️' : '⏳');

      if (multiplayerRole === 'white') {
        return {
          white: { name: `${whiteName} (You)`, elo: 'ELO: 1500', avatar: whiteAvatar },
          black: { name: blackName, elo: opponentJoined ? 'ELO: 1500' : '...', avatar: blackAvatar },
        };
      } else if (multiplayerRole === 'black') {
        return {
          white: { name: whiteName, elo: 'ELO: 1500', avatar: whiteAvatar },
          black: { name: `${blackName} (You)`, elo: 'ELO: 1500', avatar: blackAvatar },
        };
      } else {
        return {
          white: { name: whiteName, elo: '...', avatar: whiteAvatar },
          black: { name: blackName, elo: '...', avatar: blackAvatar },
        };
      }
    } else if (gameMode === 'ai') {
      const aiPersona = 
        aiDifficulty === 'easy' ? { name: 'Noob Knight (Easy)', elo: 'ELO: 800', avatar: '♟️' } :
        aiDifficulty === 'medium' ? { name: 'Savant Spark (Medium)', elo: 'ELO: 1500', avatar: '🤖' } :
        aiDifficulty === 'hard' ? { name: 'Grandmaster (Hard)', elo: 'ELO: 2100', avatar: '🧠' } :
        { name: 'Gemini Oracle (Genius)', elo: 'ELO: 2800+', avatar: '✨' };

      if (aiPlayerColor === 'white') {
        return {
          white: { name: 'You (White)', elo: 'ELO: 1500', avatar: '👤' },
          black: aiPersona,
        };
      } else {
        return {
          white: aiPersona,
          black: { name: 'You (Black)', elo: 'ELO: 1500', avatar: '👤' },
        };
      }
    } else {
      // Local play
      return {
        white: { name: 'White Player', elo: 'Local', avatar: 'W' },
        black: { name: 'Black Player', elo: 'Local', avatar: 'B' },
      };
    }
  };

  const { white: whitePlayer, black: blackPlayer } = getPlayerDetails();

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-[#f0f0f0] font-sans flex flex-col overflow-hidden select-none relative">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              scale: 0.96,
              filter: "blur(4px)",
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
            }}
            className="fixed inset-0 bg-[#0a0a0a] z-[9999] flex flex-col items-center justify-center select-none overflow-hidden"
          >
            {/* Elegant glowing graphics */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative flex flex-col items-center">
              {/* Logo container with smooth 3D rotation */}
              <motion.div
                initial={{ rotateY: 0, rotateX: 15, y: 20, opacity: 0 }}
                animate={{ 
                  rotateY: 360, 
                  rotateX: 0,
                  y: 0,
                  opacity: 1
                }}
                transition={{ 
                  duration: 1.6, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                className="relative bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.1)] flex items-center justify-center text-amber-400 mb-6 w-20 h-20"
                style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
              >
                <Crown className="w-10 h-10 drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]" />
              </motion.div>

              {/* Brand Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">
                  Grandmaster <span className="text-amber-400 font-medium">Chess</span>
                </h1>
                <p className="font-mono text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.25em]">
                  Premium SaaS Platform
                </p>
              </motion.div>

              {/* Progress-like ambient bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 140 }}
                transition={{ delay: 0.1, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                className="h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full mt-8"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full flex flex-col overflow-hidden relative"
          >
      
      {/* Dynamic Header */}
      <header className="w-full bg-[#0f0f0f] border-b border-white/5 py-3 md:py-4 px-3 sm:px-6 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-2 rounded-lg text-amber-400 border border-white/10 shadow-lg">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-lg md:text-xl font-bold tracking-tight leading-none text-white">
              Grandmaster <span className="text-amber-400 font-medium">Chess</span>
            </h1>
            <p className="font-mono text-[9px] text-white/40 mt-1 uppercase tracking-widest">
              Grandmaster Edition
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowSoundSettings(!showSoundSettings)}
              className={`flex items-center gap-2 font-sans text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200 border active:scale-95 cursor-pointer ${
                showSoundSettings
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/10'
              }`}
              title="Game Settings"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {showSoundSettings && (
              <>
                {/* Backdrop to close the popover */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSoundSettings(false)}
                />
                
                {/* Settings Card */}
                <div className="absolute right-0 mt-2 bg-[#121212] border border-white/10 p-4 rounded-xl shadow-2xl z-50 w-64 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Section: Board Display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Board Display</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white/90">Show Coordinates</span>
                        <span className="text-[9px] text-white/40 font-mono font-medium">Algebraic (a-h, 1-8)</span>
                      </div>
                      <button
                        onClick={() => setShowCoordinates(!showCoordinates)}
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          showCoordinates 
                            ? 'bg-amber-500' 
                            : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                          showCoordinates ? 'translate-x-3.5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Section: Sound Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Sound Options</span>
                      <button 
                        onClick={() => {
                          const next = !soundEnabled;
                          setSoundEnabled(next);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-colors ${
                          soundEnabled 
                            ? 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/25' 
                            : 'bg-white/5 hover:bg-white/10 text-white/40 border border-white/5'
                        }`}
                      >
                        {soundEnabled ? 'ALL ON' : 'MUTED'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Move Sounds Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white/90">Move Sounds</span>
                          <span className="text-[9px] text-white/40 font-mono">Standard taps</span>
                        </div>
                        <button
                          disabled={!soundEnabled}
                          onClick={() => setSoundMoveEnabled(!soundMoveEnabled)}
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            !soundEnabled 
                              ? 'bg-zinc-800 opacity-40 cursor-not-allowed' 
                              : soundMoveEnabled 
                                ? 'bg-amber-500' 
                                : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                            soundMoveEnabled && soundEnabled ? 'translate-x-3.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Capture Sounds Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white/90">Capture Sounds</span>
                          <span className="text-[9px] text-white/40 font-mono">Mechanical cracks</span>
                        </div>
                        <button
                          disabled={!soundEnabled}
                          onClick={() => setSoundCaptureEnabled(!soundCaptureEnabled)}
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            !soundEnabled 
                              ? 'bg-zinc-800 opacity-40 cursor-not-allowed' 
                              : soundCaptureEnabled 
                                ? 'bg-amber-500' 
                                : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                            soundCaptureEnabled && soundEnabled ? 'translate-x-3.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Game-End Alerts Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white/90">Game-End Alerts</span>
                          <span className="text-[9px] text-white/40 font-mono">Checks & victories</span>
                        </div>
                        <button
                          disabled={!soundEnabled}
                          onClick={() => setSoundAlertEnabled(!soundAlertEnabled)}
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            !soundEnabled 
                              ? 'bg-zinc-800 opacity-40 cursor-not-allowed' 
                              : soundAlertEnabled 
                                ? 'bg-amber-500' 
                                : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                            soundAlertEnabled && soundEnabled ? 'translate-x-3.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsFlipped((prev) => !prev)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-amber-400 font-sans text-xs font-semibold px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 border border-white/10 active:scale-95 cursor-pointer"
            title="Flip the board view"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flip Board</span>
          </button>

          <button
            onClick={resetGame}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-amber-400 font-sans text-xs font-semibold px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 border border-white/10 active:scale-95 cursor-pointer"
            title="Reset board state to initial"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Board</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden w-full relative pb-16 xl:pb-0">
        
        {/* Left Sidebar: Player Stats & Analytics */}
        <aside className={`w-full xl:w-64 border-b xl:border-b-0 xl:border-r border-white/5 bg-[#0f0f0f] flex-col p-6 space-y-8 shrink-0 xl:overflow-y-auto order-2 xl:order-1 ${activeMobileTab === 'stats' ? 'flex' : 'hidden'} xl:flex`}>
          
          {/* Player Profile & Session Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">Player Profile</h2>
              {user && (
                <button
                  onClick={() => {
                    setUser(null);
                    setMultiplayerState({ roomId: null, role: null });
                    resetGame();
                  }}
                  className="text-[9px] uppercase font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-2.5 h-2.5" />
                  Sign Out
                </button>
              )}
            </div>

            <div className="bg-[#111111] border border-zinc-800 rounded-xl p-4 space-y-3.5 shadow-md relative overflow-hidden group">
              <div className="flex items-center gap-3">
                {user ? (
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono font-bold text-amber-400 text-sm shadow-sm shrink-0">
                      {user.avatar || user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
 
                <div className="overflow-hidden flex-1">
                  <div className="text-xs font-semibold text-white/90 truncate">
                    {user ? user.name : "Guest Player"}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                    {user ? `${user.email}` : "Pass & Play or vs AI"}
                  </div>
                </div>
              </div>
 
              {/* Session Stats Section */}
              <div className="space-y-2 pt-3.5 border-t border-zinc-800/60">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
                  <span>Session Record</span>
                  {sessionStats.streak !== 0 && (
                    <span className="flex items-center gap-1 font-bold">
                      Streak: 
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${sessionStats.streak > 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                        {sessionStats.streak > 0 ? `+${sessionStats.streak}` : sessionStats.streak}
                      </span>
                    </span>
                  )}
                </div>
 
                {/* Score/Stats Counters */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-1.5 py-2">
                    <div className="text-[11px] font-mono text-emerald-500 font-bold">{sessionStats.wins}</div>
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold font-sans mt-0.5">Wins</div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-1.5 py-2">
                    <div className="text-[11px] font-mono text-rose-500 font-bold">{sessionStats.losses}</div>
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold font-sans mt-0.5">Losses</div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-1.5 py-2">
                    <div className="text-[11px] font-mono text-zinc-400 font-bold">{sessionStats.draws}</div>
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold font-sans mt-0.5">Draws</div>
                  </div>
                </div>
 
                {/* Fire or Cold Streak Banner */}
                {sessionStats.streak >= 3 && (
                  <div className="flex items-center gap-1.5 justify-center py-1.5 px-2 bg-amber-500/5 border border-amber-500/10 text-amber-400 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Hot Streak Active
                  </div>
                )}
                {sessionStats.streak <= -3 && (
                  <div className="flex items-center gap-1.5 justify-center py-1.5 px-2 bg-blue-500/5 border border-blue-500/10 text-blue-400 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Cold Streak
                  </div>
                )}
              </div>
 
              {/* Login CTA for Guest */}
              {!user && (
                <button
                  onClick={() => {
                    setAuthProvider(null);
                    setAuthError(null);
                    setShowAuthModal(true);
                  }}
                  className="w-full mt-1.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 font-sans"
                >
                  <Globe className="w-3 h-3 text-zinc-400" />
                  Connect Identity
                </button>
              )}
            </div>
          </div>

          {/* Engine Status */}
          <div className="space-y-2">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">Engine Status</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-mono text-white/90">Stockfish 16.1</span>
            </div>
            <div className="text-[11px] text-white/30 font-mono italic">Depth: 24 | Nodes: 12.4M</div>
          </div>

          {/* Capture Advantage / Materials Panel */}
          <div className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">Capture Advantage</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">White Material (Captured Black)</span>
                  {materialScores.whiteLead > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold animate-in zoom-in duration-200">
                      +{materialScores.whiteLead}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 bg-[#141414] p-2.5 rounded-lg border border-white/5 min-h-[44px] items-center">
                  {capturedPieces.white.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      <AnimatePresence initial={false}>
                        {capturedPieces.white.map((p) => (
                          <motion.span 
                            key={p.id} 
                            initial={{ scale: 0.2, opacity: 0, rotate: -45 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0, rotate: 30 }}
                            transition={{ 
                              type: "spring",
                              stiffness: 280,
                              damping: 16
                            }}
                            className="text-lg text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] inline-block select-none"
                            title={`Captured Black ${p.type}`}
                          >
                            {p.type === 'pawn' ? '♟' : p.type === 'knight' ? '♞' : p.type === 'bishop' ? '♝' : p.type === 'rook' ? '♜' : p.type === 'queen' ? '♛' : '♚'}
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 italic">No pieces captured</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">Black Material (Captured White)</span>
                  {materialScores.blackLead > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold animate-in zoom-in duration-200">
                      +{materialScores.blackLead}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 bg-[#141414] p-2.5 rounded-lg border border-white/5 min-h-[44px] items-center">
                  {capturedPieces.black.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      <AnimatePresence initial={false}>
                        {capturedPieces.black.map((p) => (
                          <motion.span 
                            key={p.id} 
                            initial={{ scale: 0.2, opacity: 0, rotate: -45 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0, rotate: 30 }}
                            transition={{ 
                              type: "spring",
                              stiffness: 280,
                              damping: 16
                            }}
                            className="text-lg text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] inline-block select-none"
                            title={`Captured White ${p.type}`}
                          >
                            {p.type === 'pawn' ? '♙' : p.type === 'knight' ? '♘' : p.type === 'bishop' ? '♗' : p.type === 'rook' ? '♖' : p.type === 'queen' ? '♕' : '♔'}
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 italic">No pieces captured</span>
                  )}
                </div>
              </div>
            </div>
          </div>


        </aside>

        {/* Center: Immersive Chess Board Viewport */}
        <main className={`flex-1 flex-col items-center justify-center bg-[#111111] p-3 sm:p-6 md:p-8 xl:p-12 relative overflow-y-auto order-1 xl:order-2 ${activeMobileTab === 'game' ? 'flex' : 'hidden'} xl:flex`}>
          {/* Top Opponent Profile Widget */}
          <div className="w-full max-w-[calc(100vh-240px)] sm:max-w-lg flex items-center justify-between mb-2.5 sm:mb-4 px-1 sm:px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#222] flex items-center justify-center text-md font-bold border border-white/10 text-white shadow-md">
                {isFlipped ? whitePlayer.avatar : blackPlayer.avatar}
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  {isFlipped ? whitePlayer.name : blackPlayer.name}
                </div>
                <div className="text-[11px] text-white/40 tracking-wider font-mono">
                  {isFlipped ? whitePlayer.elo : blackPlayer.elo}
                </div>
              </div>
            </div>
            
            <div className="bg-[#222] px-3.5 py-1.5 rounded-lg border border-white/10 text-xl font-mono tracking-tighter text-white/60">
              {formatTime(isFlipped ? whiteTime : blackTime)}
            </div>
          </div>

          {/* AI Thinking Status Bar */}
          {aiIsThinking && (
            <div className="w-full max-w-[calc(100vh-240px)] sm:max-w-lg mb-2.5 sm:mb-4 px-3 sm:px-4 py-2.5 rounded-lg border bg-amber-500/5 border-amber-500/15 text-amber-200/90 flex items-center justify-between transition-all duration-300 shadow-md">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                  AI Opponent is analyzing...
                </span>
              </div>
            </div>
          )}

          {/* Active game alerts (Check, Checkmate, Stalemate) */}
          {(isCheck || isCheckmate || isStalemate) && (
            <div 
              className={`
                w-full max-w-[calc(100vh-240px)] sm:max-w-lg mb-2.5 sm:mb-4 px-3 sm:px-4 py-2.5 rounded-lg border flex items-center justify-between transition-all duration-300 shadow-md
                ${
                  isCheckmate
                    ? 'bg-red-500/15 border-red-500/30 text-red-200'
                    : isStalemate
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                    : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-100 animate-pulse'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCheckmate ? 'bg-red-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isCheckmate ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                  {isCheckmate ? (
                    <span>Checkmate! {winner === 'white' ? 'White' : 'Black'} Wins</span>
                  ) : isStalemate ? (
                    <span>Stalemate! Game is Drawn</span>
                  ) : (
                    <span>Check!</span>
                  )}
                </span>
              </div>
              <button
                onClick={resetGame}
                className="text-[10px] uppercase tracking-wider font-bold bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/10 text-white/90 active:scale-95 transition-all cursor-pointer"
              >
                Reset Game
              </button>
            </div>
          )}

          {/* Styled Chess Board Frame */}
          <div className="w-full flex justify-center">
            <ChessBoard isFlipped={isFlipped} />
          </div>

          {/* Bottom Player Profile Widget */}
          <div className="w-full max-w-[calc(100vh-240px)] sm:max-w-lg flex items-center justify-between mt-2.5 sm:mt-4 px-1 sm:px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-md font-extrabold text-[#111] shadow-lg">
                {isFlipped ? blackPlayer.avatar : whitePlayer.avatar}
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                  {isFlipped ? blackPlayer.name : whitePlayer.name}
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-[11px] text-white/40 tracking-wider font-mono">
                  {isFlipped ? blackPlayer.elo : whitePlayer.elo}
                </div>
              </div>
            </div>

            <div className="bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 rounded-lg border border-emerald-500/20 text-xl font-mono tracking-tighter shadow-md">
              {formatTime(isFlipped ? blackTime : whiteTime)}
            </div>
          </div>
        </main>

        {/* Right Sidebar: Game Command Center, Move History, and Analysis */}
        <aside className={`w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-white/5 bg-[#0e0e0e] flex-col shrink-0 overflow-y-auto xl:overflow-hidden h-full order-3 xl:order-3 ${activeMobileTab === 'analysis' ? 'flex' : 'hidden'} xl:flex`}>
          
          {/* Game Mode Tabs */}
          <div className="p-4 border-b border-zinc-800 bg-[#111111]">
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-2.5 font-mono">
              Select Game Mode
            </div>
            <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
              <button
                onClick={() => {
                  setGameMode('local');
                  setMultiplayerState({ roomId: null, role: null });
                }}
                className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                  gameMode === 'local'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 border border-transparent'
                }`}
              >
                Local
              </button>
              <button
                onClick={() => {
                  setGameMode('ai');
                  setMultiplayerState({ roomId: null, role: null });
                }}
                className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                  gameMode === 'ai'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 border border-transparent'
                }`}
              >
                vs AI
              </button>
              <button
                onClick={() => {
                  setGameMode('multiplayer');
                }}
                className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                  gameMode === 'multiplayer'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 border border-transparent'
                }`}
              >
                Online
              </button>
            </div>
          </div>

          {/* Active Game Controls */}
          {moveHistory.length > 0 && !isCheckmate && !isStalemate && !winner && !gameEndReason && (
            <div className="p-4 border-b border-white/5 bg-[#141414]/40 shrink-0">
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">
                Active Match Controls
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleOfferDraw}
                  className="py-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-amber-400 border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 font-sans"
                  title="Offer a draw to the opponent"
                >
                  <Users className="w-3.5 h-3.5" />
                  Offer Draw
                </button>
                <button
                  onClick={handleResign}
                  className="py-2.5 bg-red-950/20 hover:bg-red-950/30 text-red-400 border border-red-900/20 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 font-sans"
                  title="Resign the current match"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Resign
                </button>
              </div>
            </div>
          )}

          {/* Contextual Options Panels */}
          <div className="p-5 border-b border-white/5 bg-[#111] shrink-0">
            {gameMode === 'local' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/90">Single Device Play</div>
                  <span className="text-[9px] font-mono uppercase bg-white/5 text-white/50 px-2 py-0.5 rounded">Active</span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  Pass and play chess on the same device. Standard competition rules and material metrics are tracked in real-time.
                </p>
              </div>
            )}

            {gameMode === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-amber-500 flex items-center gap-1.5 font-sans">
                    <Swords className="w-4 h-4 text-amber-500" />
                    AI Opponent Setup
                  </div>
                </div>

                <div className="space-y-3.5 bg-[#111111] p-3.5 rounded-lg border border-zinc-800">
                  {/* Difficulty Selection */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono font-bold">AI Engine level</label>
                    <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-md">
                      {(['easy', 'medium', 'hard', 'gemini'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => useChessStore.getState().setAiDifficulty(level)}
                          className={`py-1 text-[9px] uppercase font-bold rounded transition-all cursor-pointer ${
                            aiDifficulty === level
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Play as Color Selection */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono font-bold">Play as color</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          useChessStore.getState().setAiPlayerColor('white');
                          setIsFlipped(false);
                          resetGame();
                        }}
                        className={`py-1.5 px-2 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer text-center ${
                          aiPlayerColor === 'white'
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        White (First)
                      </button>
                      <button
                        onClick={() => {
                          useChessStore.getState().setAiPlayerColor('black');
                          setIsFlipped(true);
                          resetGame();
                        }}
                        className={`py-1.5 px-2 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer text-center ${
                          aiPlayerColor === 'black'
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        Black (Second)
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      resetGame();
                      if (aiPlayerColor === 'black') {
                        setIsFlipped(true);
                      } else {
                        setIsFlipped(false);
                      }
                    }}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-100 hover:text-amber-400 border border-zinc-800 rounded text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95 text-center"
                  >
                    Restart match
                  </button>
                </div>
              </div>
            )}

            {gameMode === 'multiplayer' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-amber-500 flex items-center gap-1.5 font-sans">
                    <Users className="w-4 h-4 text-amber-500" />
                    Multiplayer Lobby
                  </div>
                </div>

                {user ? (
                  /* Signed In View */
                  <div className="space-y-3">
                    <div className="bg-[#111111] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono font-bold text-amber-400 text-sm">
                          {user.avatar}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-white/90 truncate max-w-[130px]">{user.name}</div>
                          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{user.provider} Account</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUser(null);
                          setMultiplayerState({ roomId: null, role: null });
                          resetGame();
                        }}
                        className="p-1.5 bg-zinc-900 hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 rounded border border-zinc-800 hover:border-rose-900/20 transition-all cursor-pointer"
                        title="Sign Out"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!multiplayerRoomId ? (
                      <div className="space-y-3.5 pt-1">
                        <button
                          onClick={handleCreateRoom}
                          disabled={lobbyLoading}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {lobbyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Create New Match
                        </button>

                        <div className="relative flex items-center justify-center">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                          <span className="relative bg-[#111] px-2 text-[8px] font-mono uppercase text-white/30">or Join Match</span>
                        </div>

                        <form onSubmit={handleJoinRoom} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="ENTER CODE"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs uppercase text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40 text-center font-mono font-bold tracking-wider"
                            maxLength={4}
                          />
                          <button
                            type="submit"
                            disabled={lobbyLoading || !joinRoomId}
                            className="px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded text-[10px] uppercase font-bold tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Join
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-[#111111] p-3.5 rounded-lg border border-zinc-800">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>Room ID:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white bg-zinc-950 px-2 py-0.5 rounded tracking-wider border border-zinc-900">{multiplayerRoomId}</span>
                            <button
                              onClick={copyRoomCode}
                              className="hover:text-amber-400 p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition-all cursor-pointer"
                              title="Copy Room Code"
                            >
                              {copied ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>Your Color:</span>
                          <span className="font-mono font-bold uppercase text-white bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
                            {multiplayerRole}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              const inviteUrl = `${window.location.origin}/?room=${multiplayerRoomId}`;
                              navigator.clipboard.writeText(inviteUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {copiedLink ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                            {copiedLink ? "Link Copied!" : "Copy Invite Link"}
                          </button>

                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${opponentJoined ? 'bg-amber-500 animate-pulse' : 'bg-amber-400/50 animate-pulse'}`} />
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {opponentJoined ? "Opponent connected!" : "Waiting for player..."}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setMultiplayerState({ roomId: null, role: null });
                                resetGame();
                              }}
                              className="text-[9px] uppercase font-bold text-red-400 hover:underline cursor-pointer"
                            >
                              Exit
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Signed Out Connection CTA Panel */
                  <div className="bg-[#131313] border border-white/5 rounded-xl p-4 text-center space-y-4">
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Connect your account to play multiplayer with friends, share game invite links, and secure your stats.
                    </p>
                    
                    <div className="space-y-2 font-sans text-xs">
                      <button
                        onClick={() => {
                          setAuthProvider('google');
                          setAuthError(null);
                          setShowAuthModal(true);
                        }}
                        className="w-full py-2.5 bg-white text-zinc-950 hover:bg-zinc-100 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow"
                      >
                        <span className="font-extrabold text-amber-500 text-xs">G</span> Sign In with Google
                      </button>
                      <button
                        onClick={() => {
                          setAuthProvider('icloud');
                          setAuthError(null);
                          setShowAuthModal(true);
                        }}
                        className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span className="text-white text-xs"></span> Sign In with iCloud
                      </button>
                      <button
                        onClick={() => {
                          setAuthProvider('email');
                          setAuthError(null);
                          setShowAuthModal(true);
                        }}
                        className="w-full py-2.5 bg-zinc-900/55 hover:bg-zinc-900/90 border border-white/5 text-zinc-300 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Mail className="w-3.5 h-3.5 text-emerald-400" /> Sign In with Email
                      </button>
                    </div>
                  </div>
                )}

                {lobbyError && (
                  <p className="text-[11px] text-red-400 bg-red-950/10 border border-red-900/20 p-2 rounded italic leading-relaxed">
                    {lobbyError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Scrollable Move History & AI Coach Tab container */}
          <div className="flex-1 min-h-[250px] flex flex-col overflow-hidden">
            {/* Tab header */}
            <div className="flex border-b border-white/5 bg-[#121212] shrink-0">
              <button
                onClick={() => setSidebarTab('moves')}
                className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer border-b-2 text-center ${
                  sidebarTab === 'moves'
                    ? 'border-white text-white bg-white/[0.02]'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                Move History
              </button>
              <button
                onClick={() => setSidebarTab('analysis')}
                className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer border-b-2 text-center flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'analysis'
                    ? 'border-violet-500 text-violet-400 bg-violet-500/[0.02]'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-violet-400" />
                AI Coach
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 flex flex-col overflow-hidden border-b border-white/5">
              {sidebarTab === 'moves' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto font-mono text-[13px] bg-[#0a0a0a]/20 divide-y divide-white/5">
                    {moveHistory.length > 0 ? (
                      moveHistory.map((move, index) => (
                        <div key={index} className="grid grid-cols-12 px-4 py-3 bg-[#111]/10 hover:bg-white/[0.02] border-b border-white/[0.02] items-center gap-1">
                          {/* Move Number & Turn indicator */}
                          <div className="col-span-3 flex items-center gap-1.5">
                            <span className="text-[11px] text-white/20 font-bold">
                              {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${move.piece.color === 'white' ? 'bg-white/80' : 'bg-zinc-700'}`} />
                          </div>

                          {/* Standard Notation and Symbolic Notation */}
                          <div className="col-span-5 flex items-center gap-1.5 overflow-hidden">
                            <span className="text-white/90 font-semibold tracking-tight text-[12px] truncate">
                              {move.notation}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-sans select-none flex items-center shrink-0 ${
                              move.piece.color === 'white' 
                                ? 'bg-white/5 border-white/10 text-white/70' 
                                : 'bg-[#151515] border-white/5 text-zinc-400'
                            }`}>
                              <span className="font-mono">{move.symbolicNotation}</span>
                            </span>
                          </div>

                          {/* Capture Indicator & Move Time */}
                          <div className="col-span-4 flex items-center justify-end gap-1.5">
                            {move.capturedPiece && (
                              <span 
                                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-sans border shrink-0 ${
                                  move.capturedPiece.color === 'white'
                                    ? 'bg-white/10 border-white/15 text-white/90'
                                    : 'bg-zinc-950/40 border-zinc-900/30 text-zinc-400'
                                }`}
                                title={`Captured ${move.capturedPiece.color} ${move.capturedPiece.type}`}
                              >
                                <span className="text-[9px] uppercase tracking-wide opacity-50 font-bold font-mono">x</span>
                                <span className="text-xs leading-none">
                                  {move.capturedPiece.type === 'pawn' ? (move.capturedPiece.color === 'white' ? '♙' : '♟') :
                                   move.capturedPiece.type === 'knight' ? (move.capturedPiece.color === 'white' ? '♘' : '♞') :
                                   move.capturedPiece.type === 'bishop' ? (move.capturedPiece.color === 'white' ? '♗' : '♝') :
                                   move.capturedPiece.type === 'rook' ? (move.capturedPiece.color === 'white' ? '♖' : '♜') :
                                   move.capturedPiece.type === 'queen' ? (move.capturedPiece.color === 'white' ? '♕' : '♛') : '♔'}
                                </span>
                              </span>
                            )}
                            <span className="text-[9px] text-white/30 italic font-mono truncate shrink-0">
                              {new Date(move.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-white/20 italic my-auto">
                        No moves played yet.
                        <p className="text-[10px] not-italic text-white/30 mt-1">Select a piece and plan your play</p>
                      </div>
                    )}
                  </div>

                  {/* Save PGN Footer Button */}
                  {moveHistory.length > 0 && (
                    <div className="p-3 bg-[#111] border-t border-white/5 flex items-center justify-between gap-2.5 shrink-0">
                      <div className="text-[10px] text-white/40 font-mono">
                        {moveHistory.length} {moveHistory.length === 1 ? 'move' : 'moves'} recorded
                      </div>
                      <button
                        onClick={handleCopyPGN}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-amber-400 text-white/90 border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 font-sans animate-in fade-in slide-in-from-bottom-1 duration-200"
                        title="Copy game PGN to clipboard"
                      >
                        {pgnCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in duration-150" />
                            PGN Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Save PGN
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#090909]/40">
                  {/* Live Coaching Loop Status Card */}
                  <div className="bg-[#121212] border border-white/5 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-1.5 w-1.5">
                        {liveCoaching ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-600"></span>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                        {liveCoaching ? "Live Coach Active" : "Live Coach Paused"}
                      </span>
                    </div>
                    <button
                      onClick={() => setLiveCoaching(!liveCoaching)}
                      className={`px-2 py-1 text-[9px] font-mono uppercase font-bold rounded border transition-all cursor-pointer ${
                        liveCoaching 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/25' 
                          : 'bg-[#151515] text-zinc-500 border-white/5 hover:text-white hover:border-white/10'
                      }`}
                    >
                      {liveCoaching ? "Pause Coach" : "Resume Coach"}
                    </button>
                  </div>

                  {/* Analysis content */}
                  {!positionAnalysis && !analysisLoading && (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-4 space-y-4">
                      <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
                        <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Gemini Chess Coach</h4>
                        <p className="text-[10px] text-white/40 mt-1 max-w-[220px] mx-auto leading-relaxed">
                          Request instant visual evaluation, strategic commentary, and tactical insights.
                        </p>
                      </div>
                      <button
                        onClick={handleAnalyzePosition}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded text-[10px] uppercase font-bold tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md mx-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze Position
                      </button>
                    </div>
                  )}

                  {analysisLoading && (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                      <div>
                        <span className="text-xs font-semibold text-violet-300 font-mono tracking-wider uppercase animate-pulse block">Analyzing lines...</span>
                        <p className="text-[10px] text-white/40 mt-1.5 max-w-[200px] leading-relaxed italic mx-auto">
                          Analyzing pawn breaks, king safety, and structural imbalances...
                        </p>
                      </div>
                    </div>
                  )}

                  {analysisError && (
                    <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-200 rounded text-center text-[11px] leading-relaxed">
                      <p className="font-bold mb-1">Coach Error</p>
                      {analysisError}
                      <button
                        onClick={handleAnalyzePosition}
                        className="mt-2 block w-full py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-300 border border-red-500/25 rounded font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                      >
                        Retry Analysis
                      </button>
                    </div>
                  )}

                  {positionAnalysis && (
                    <div className="space-y-4 animate-in fade-in duration-300 text-left">
                      {/* Evaluation meter */}
                      <div className="bg-[#151515] p-3 rounded-lg border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-white/40 font-bold uppercase tracking-wider font-mono">Engine score</span>
                          <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                            positionAnalysis.score > 0.5 ? 'bg-emerald-500/15 text-emerald-400' :
                            positionAnalysis.score < -0.5 ? 'bg-red-500/15 text-red-400' :
                            'bg-white/5 text-white/60'
                          }`}>
                            {positionAnalysis.score > 0 ? '+' : ''}{positionAnalysis.score.toFixed(1)}
                          </span>
                        </div>
                        {/* Interactive gauge */}
                        <div className="h-1.5 bg-[#252525] rounded-full overflow-hidden flex">
                          <div 
                            className="bg-zinc-700 transition-all duration-500" 
                            style={{ width: `${Math.max(5, Math.min(95, 50 - positionAnalysis.score * 10))}%` }} 
                          />
                          <div 
                            className="bg-white transition-all duration-500 flex-1" 
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-white/30">
                          <span>Black Adv.</span>
                          <span>Equal</span>
                          <span>White Adv.</span>
                        </div>
                      </div>

                      {/* Coach comment */}
                      <div className="bg-[#151515] p-3 rounded-lg border border-white/5 space-y-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-violet-400 font-bold font-mono">Coach Summary</div>
                        <p className="text-xs text-white/80 leading-relaxed font-sans">{positionAnalysis.summary}</p>
                      </div>

                      {/* Last move comments */}
                      {positionAnalysis.lastMoveCommentary && (
                        <div className="bg-violet-950/10 border border-violet-500/10 p-3 rounded-lg space-y-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-violet-300 font-bold font-mono">Tactical Insight</div>
                          <p className="text-xs text-white/85 leading-relaxed font-sans italic">"{positionAnalysis.lastMoveCommentary}"</p>
                        </div>
                      )}

                      {/* Plans */}
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-[#151515] p-3 rounded-lg border border-white/5 space-y-1.5 text-left">
                          <div className="text-[9px] uppercase tracking-wider text-white/60 font-bold font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            White's Campaign
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed font-sans">{positionAnalysis.whitePlan}</p>
                        </div>
                        <div className="bg-[#151515] p-3 rounded-lg border border-white/5 space-y-1.5 text-left">
                          <div className="text-[9px] uppercase tracking-wider text-white/60 font-bold font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            Black's Campaign
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed font-sans">{positionAnalysis.blackPlan}</p>
                        </div>
                      </div>

                      <button
                        onClick={handleAnalyzePosition}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer text-center"
                      >
                        Recalculate Analysis
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>



          {/* Chess Board Theme Switcher */}
          <div className="p-4 border-t border-white/5 bg-[#141414]/20 shrink-0">
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2.5">
              Board Color Palette
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'classic' as const, name: 'Classic', desc: 'Tan & Brown', preview: 'bg-[#b58863]' },
                { id: 'ocean' as const, name: 'Ocean', desc: 'Blue & Slate', preview: 'bg-[#4b7399]' },
                { id: 'forest' as const, name: 'Forest', desc: 'Ivory & Green', preview: 'bg-[#779556]' },
              ].map((themeOpt) => (
                <button
                  key={themeOpt.id}
                  onClick={() => setBoardTheme(themeOpt.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                    boardTheme === themeOpt.id
                      ? 'bg-white/10 border-white/20 text-white shadow-md'
                      : 'bg-transparent border-white/5 text-white/40 hover:text-white/70 hover:border-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${themeOpt.preview} mb-1.5 border border-white/10 shadow-sm`} />
                  <span className="text-[10px] font-semibold leading-tight tracking-tight">{themeOpt.name}</span>
                  <span className="text-[8px] opacity-60 leading-none mt-0.5">{themeOpt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation and Undo / Redo controls */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-white/40 bg-[#121212] shrink-0">
            <button 
              onClick={undo}
              disabled={moveHistory.length === 0}
              className="hover:text-white transition-colors cursor-pointer p-1.5 rounded hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-white/40"
              title="Undo last move"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-4 items-center">
              <button 
                onClick={undo}
                disabled={moveHistory.length === 0}
                className="hover:text-white font-mono text-[10px] uppercase tracking-wider font-bold transition-colors cursor-pointer px-2 py-1 rounded hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-white/40"
              >
                UNDO
              </button>

              <button
                onClick={handleRequestHint}
                disabled={isCheckmate || isStalemate || winner || !!gameEndReason}
                className={`
                  flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer px-2.5 py-1 rounded border active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed
                  ${
                    hintMove 
                      ? 'bg-violet-500/10 hover:bg-violet-500/25 text-violet-400 border-violet-500/35' 
                      : 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10'
                  }
                `}
                title="Highlight the engine's recommended best move for this position"
              >
                <Lightbulb className={`w-3.5 h-3.5 ${hintMove ? 'text-violet-400 fill-violet-400/20' : 'text-white/60'}`} />
                <span>HINT</span>
              </button>

              <button 
                onClick={redo}
                disabled={redoHistory.length === 0}
                className="hover:text-white font-mono text-[10px] uppercase tracking-wider font-bold transition-colors cursor-pointer px-2 py-1 rounded hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-white/40"
              >
                REDO
              </button>
            </div>
            <button 
              onClick={redo}
              disabled={redoHistory.length === 0}
              className="hover:text-white transition-colors cursor-pointer p-1.5 rounded hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-white/40"
              title="Redo next move"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

        </aside>
      </div>

      {/* Modern Minimal Page Footer */}
      <footer className="w-full py-2 bg-[#050505] border-t border-white/5 text-center text-white/20 font-mono text-[8px] uppercase tracking-widest shrink-0">
        Grandmaster Chess Engine &bull; Powered by AI
      </footer>

      {/* Game Summary Overlay */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Ambient background glow */}
            <div className={`absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${
              summaryWinner === 'draw' 
                ? 'bg-slate-400' 
                : summaryWinner === 'white' && !isFlipped || summaryWinner === 'black' && isFlipped
                ? 'bg-amber-400'
                : 'bg-red-400'
            }`} />

            {/* Header close button */}
            <button
              onClick={() => setShowSummary(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Close summary overlay"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon & Game Over Announcement */}
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-lg mb-4 ${
                summaryWinner === 'draw'
                  ? 'bg-white/5 border-white/10 text-white/70'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {summaryWinner === 'draw' ? (
                  <Activity className="w-5 h-5" />
                ) : (
                  <Trophy className="w-5 h-5 animate-bounce" />
                )}
              </div>

              <h2 className="text-xs uppercase tracking-[0.25em] text-white/40 font-bold mb-1">
                Match Concluded
              </h2>
              <h1 className="text-2xl font-light font-display text-white tracking-tight">
                {summaryWinner === 'draw' ? (
                  <span>Match Drawn</span>
                ) : (
                  <span>
                    {summaryWinner === 'white' ? 'White' : 'Black'} Wins!
                  </span>
                )}
              </h1>
              <p className="text-xs text-amber-400/80 mt-1.5 font-mono uppercase tracking-wide bg-amber-500/5 border border-amber-500/10 px-3 py-1 rounded-full">
                {gameEndReason === 'checkmate' && "By Checkmate"}
                {gameEndReason === 'stalemate' && "By Stalemate"}
                {gameEndReason === 'resignation' && "By Resignation"}
                {gameEndReason === 'draw' && "By Mutual Agreement"}
                {gameEndReason === 'timeout' && "By Timeout"}
              </p>
            </div>

            {/* Player details row */}
            <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-xl mb-6 font-sans">
              <div className="flex flex-col items-center text-center border-r border-white/5">
                <span className="text-[10px] uppercase font-bold text-white/40 mb-1.5">White Player</span>
                <span className="text-sm font-semibold text-white/90 truncate max-w-full">{whitePlayer.name}</span>
                <span className="text-[10px] font-mono text-white/30 mt-0.5">{whitePlayer.elo}</span>
                {summaryWinner === 'white' && (
                  <span className="text-[9px] uppercase font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded mt-2">Winner</span>
                )}
              </div>

              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-white/40 mb-1.5">Black Player</span>
                <span className="text-sm font-semibold text-white/90 truncate max-w-full">{blackPlayer.name}</span>
                <span className="text-[10px] font-mono text-white/30 mt-0.5">{blackPlayer.elo}</span>
                {summaryWinner === 'black' && (
                  <span className="text-[9px] uppercase font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded mt-2">Winner</span>
                )}
              </div>
            </div>

            {/* Core Statistics Grid */}
            <div className="space-y-3 mb-6 font-sans">
              <h3 className="text-[10px] uppercase tracking-wider text-white/40 font-bold px-1">Game Metrics</h3>
              
              <div className="grid grid-cols-3 gap-2.5">
                {/* Metric 1: Total Moves */}
                <div className="bg-[#181818] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                  <Swords className="w-4 h-4 text-amber-400/80 mb-1.5" />
                  <span className="text-[9px] text-white/40 font-bold uppercase">Total Moves</span>
                  <span className="text-lg font-mono font-bold text-white mt-0.5">{moveHistory.length}</span>
                </div>

                {/* Metric 2: Captures */}
                <div className="bg-[#181818] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                  <Crown className="w-4 h-4 text-emerald-400/80 mb-1.5" />
                  <span className="text-[9px] text-white/40 font-bold uppercase">Captures</span>
                  <span className="text-lg font-mono font-bold text-white mt-0.5">
                    {capturedPieces.white.length + capturedPieces.black.length}
                  </span>
                </div>

                {/* Metric 3: Game Duration */}
                <div className="bg-[#181818] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                  <Clock className="w-4 h-4 text-sky-400/80 mb-1.5" />
                  <span className="text-[9px] text-white/40 font-bold uppercase">Duration</span>
                  <span className="text-lg font-mono font-bold text-white mt-0.5 truncate w-full px-0.5">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>
              </div>

              {/* Captures Details */}
              <div className="bg-[#141414] border border-white/5 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-white/50 border-b border-white/5 pb-1.5 font-mono uppercase">
                  <span>Capture Summary</span>
                  <span>Captured Pieces</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">White captured</span>
                  <div className="flex gap-1 items-center">
                    <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded">
                      {capturedPieces.white.length}
                    </span>
                    <span className="text-xs text-white/30">black pieces</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">Black captured</span>
                  <div className="flex gap-1 items-center">
                    <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded">
                      {capturedPieces.black.length}
                    </span>
                    <span className="text-xs text-white/30">white pieces</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2 font-sans">
              <button
                onClick={() => {
                  setShowSummary(false);
                }}
                className="py-3 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95"
              >
                Review Board
              </button>
              <button
                onClick={() => {
                  resetGame();
                }}
                className="py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 font-sans font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Play Again
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modern High-Fidelity Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden font-sans"
          >
            {/* Header close button */}
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthProvider(null);
                setAuthError(null);
              }}
              className="absolute top-4 right-4 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Close Login Window"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title & Badge */}
            <div className="text-center mb-6 mt-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 font-bold mb-1">Secure Identity</h2>
              <h1 className="text-xl font-medium text-white">Grandmaster Chess ID</h1>
            </div>

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/10 border border-red-900/20 px-3.5 py-2.5 rounded-xl mb-4 italic leading-relaxed">
                {authError}
              </p>
            )}

            {/* STAGE 1: Provider selection */}
            {!authProvider && (
              <div className="space-y-2.5">
                <p className="text-xs text-white/60 text-center leading-relaxed mb-4">
                  Choose a login provider to connect with other grandmasters, share link codes, and save match logs.
                </p>
                <button
                  onClick={() => setAuthProvider('google')}
                  className="w-full py-3 bg-white text-zinc-950 hover:bg-zinc-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="font-extrabold text-amber-500 text-sm">G</span> Continue with Google
                </button>
                <button
                  onClick={() => setAuthProvider('icloud')}
                  className="w-full py-3 bg-zinc-850 hover:bg-zinc-850 border border-zinc-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="text-white text-sm"></span> Continue with iCloud
                </button>
                <button
                  onClick={() => setAuthProvider('email')}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-900 border border-white/5 text-zinc-300 font-semibold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-emerald-400" /> Continue with Email
                </button>
              </div>
            )}

            {/* STAGE 2A: Google login flow (Realistic modal) */}
            {authProvider === 'google' && (
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-blue-400 font-bold text-lg">G</span>
                    <span className="text-red-400 font-bold text-lg">o</span>
                    <span className="text-amber-400 font-bold text-lg">o</span>
                    <span className="text-blue-400 font-bold text-lg">g</span>
                    <span className="text-emerald-400 font-bold text-lg">l</span>
                    <span className="text-red-400 font-bold text-lg">e</span>
                  </div>
                  <h3 className="text-xs font-semibold text-white/80">Choose an account to continue</h3>
                  
                  {/* Account entry row (Predefined for jerrymyronkaz@gmail.com) */}
                  <button
                    onClick={() => handleAuthSubmit('google', 'jerrymyronkaz@gmail.com', 'Jerry Kaz')}
                    disabled={authLoading}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                        JK
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-white/90">Jerry Kaz</div>
                        <div className="text-[10px] text-white/40 truncate">jerrymyronkaz@gmail.com</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-blue-400 group-hover:underline font-medium">Click to Sign In</span>
                  </button>

                  <div className="relative py-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <span className="relative bg-[#121212] px-2 text-[8px] font-mono uppercase text-white/30">or enter another account</span>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold uppercase text-white/40 block">Email Address</label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                    />
                    <label className="text-[10px] font-bold uppercase text-white/40 block mt-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Display Name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                    />
                  </div>
                </div>

                <div className="flex gap-2 font-sans text-xs">
                  <button
                    onClick={() => {
                      setAuthProvider(null);
                      setAuthError(null);
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-center cursor-pointer uppercase text-[10px] font-bold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleAuthSubmit('google')}
                    disabled={authLoading || (!authEmail && !authName)}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-center cursor-pointer uppercase text-[10px]"
                  >
                    {authLoading ? "Connecting..." : "Connect"}
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2B: Apple iCloud login flow */}
            {authProvider === 'icloud' && (
              <div className="space-y-4">
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center space-y-3">
                  <div className="text-center">
                    <span className="text-white text-3xl font-light"></span>
                    <h3 className="text-xs font-semibold text-white/80 mt-1">Sign In with Apple ID</h3>
                    <p className="text-[9px] text-white/40 leading-relaxed mt-0.5">Your iCloud keychain is used for security keys</p>
                  </div>

                  <div className="space-y-2.5 text-left pt-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Apple ID</label>
                      <input
                        type="email"
                        placeholder="appleid@icloud.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 placeholder:text-white/20 font-sans"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 placeholder:text-white/20 font-sans"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 font-sans text-xs">
                  <button
                    onClick={() => {
                      setAuthProvider(null);
                      setAuthError(null);
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-center cursor-pointer uppercase text-[10px] font-bold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!authEmail) {
                        setAuthError("Apple ID is required.");
                        return;
                      }
                      const parts = authEmail.split('@');
                      const derivedName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Apple Player";
                      handleAuthSubmit('icloud', authEmail, `${derivedName} (Apple)`);
                    }}
                    disabled={authLoading || !authEmail}
                    className="flex-1 py-2.5 bg-zinc-200 text-zinc-950 font-bold rounded-lg text-center cursor-pointer uppercase text-[10px]"
                  >
                    {authLoading ? "Verifying..." : "Sign In"}
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2C: Email Sign In flow */}
            {authProvider === 'email' && (
              <div className="space-y-4">
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4 text-center space-y-3">
                  <div className="text-center">
                    <Mail className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <h3 className="text-xs font-semibold text-white/80">Sign In with Email</h3>
                    <p className="text-[9px] text-white/40 leading-relaxed mt-0.5">Use email and name credentials to create a profile</p>
                  </div>

                  <div className="space-y-2.5 text-left pt-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-white/20 font-sans"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-white/20 font-sans"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 font-sans text-xs">
                  <button
                    onClick={() => {
                      setAuthProvider(null);
                      setAuthError(null);
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-center cursor-pointer uppercase text-[10px] font-bold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!authEmail || !authName) {
                        setAuthError("Email and Name are required.");
                        return;
                      }
                      handleAuthSubmit('email');
                    }}
                    disabled={authLoading || !authEmail || !authName}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-center cursor-pointer uppercase text-[10px]"
                  >
                    {authLoading ? "Registering..." : "Sign In"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Premium Mobile Bottom Tab Bar */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900/50 flex items-center justify-around px-6 z-40">
        <button
          onClick={() => setActiveMobileTab('stats')}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all cursor-pointer ${
            activeMobileTab === 'stats' ? 'text-amber-400' : 'text-zinc-500'
          }`}
        >
          {activeMobileTab === 'stats' && (
            <motion.div
              layoutId="active-tab-glow"
              className="absolute -top-1.5 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <UserIcon className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-wider font-bold font-mono">Stats</span>
        </button>

        <button
          onClick={() => setActiveMobileTab('game')}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all cursor-pointer ${
            activeMobileTab === 'game' ? 'text-amber-400' : 'text-zinc-500'
          }`}
        >
          {activeMobileTab === 'game' && (
            <motion.div
              layoutId="active-tab-glow"
              className="absolute -top-1.5 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Swords className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-wider font-bold font-mono">Game</span>
        </button>

        <button
          onClick={() => setActiveMobileTab('analysis')}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all cursor-pointer ${
            activeMobileTab === 'analysis' ? 'text-amber-400' : 'text-zinc-500'
          }`}
        >
          {activeMobileTab === 'analysis' && (
            <motion.div
              layoutId="active-tab-glow"
              className="absolute -top-1.5 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-wider font-bold font-mono">Analysis</span>
        </button>
      </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

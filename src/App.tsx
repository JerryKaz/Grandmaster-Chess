/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  Sparkles
} from 'lucide-react';
import { useChessStore } from './features/chess/store/chessStore';
import ChessBoard from './components/board/ChessBoard';
import { calculateLegalMoves } from './features/chess/engine/moveValidator';
import { findBestMove } from './features/chess/engine/chessEngine';
import { convertToAlgebraic } from './features/chess/utils/initialBoard';
import { SquareCoordinates, Color } from './features/chess/models/types';
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

  // Local component states
  const [isFlipped, setIsFlipped] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  
  // Tabbed sidebar selector
  const [sidebarTab, setSidebarTab] = useState<'moves' | 'analysis'>('moves');

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
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameEndReason('timeout');
            setSummaryWinner('black');
            setShowSummary(true);
            syncGameState({ winner: 'black' });
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameEndReason('timeout');
            setSummaryWinner('white');
            setShowSummary(true);
            syncGameState({ winner: 'white' });
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeColor, isCheckmate, isStalemate, winner, gameEndReason, syncGameState]);

  // AI Turn triggering logic
  const aiDifficulty = useChessStore((state) => state.aiDifficulty);
  const aiPlayerColor = useChessStore((state) => state.aiPlayerColor);

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

  // Clean stale position analysis when the board moves
  useEffect(() => {
    setPositionAnalysis(null);
    setAnalysisError(null);
  }, [moveHistory.length]);

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
    try {
      setLobbyLoading(true);
      setLobbyError(null);
      resetGame();
      
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: useChessStore.getState().board }),
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

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    try {
      setLobbyLoading(true);
      setLobbyError(null);
      resetGame();

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: joinRoomId }),
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

  const copyRoomCode = () => {
    if (!multiplayerRoomId) return;
    navigator.clipboard.writeText(multiplayerRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      if (multiplayerRole === 'white') {
        return {
          white: { name: 'You (White)', elo: 'ELO: 1500', avatar: 'U' },
          black: { name: opponentJoined ? 'Opponent (Black)' : 'Waiting for Opponent...', elo: opponentJoined ? 'ELO: 1500' : '...', avatar: opponentJoined ? '⚔️' : '⏳' },
        };
      } else if (multiplayerRole === 'black') {
        return {
          white: { name: 'Opponent (White)', elo: 'ELO: 1500', avatar: '⚔️' },
          black: { name: 'You (Black)', elo: 'ELO: 1500', avatar: 'U' },
        };
      } else {
        return {
          white: { name: 'Host (White)', elo: '...', avatar: '⏳' },
          black: { name: 'Guest (Black)', elo: '...', avatar: '⏳' },
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
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] font-sans flex flex-col xl:h-screen xl:overflow-hidden select-none">
      
      {/* Dynamic Header */}
      <header className="w-full bg-[#0f0f0f] border-b border-white/5 py-4 px-6 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-2 rounded-lg text-amber-400 border border-white/10 shadow-lg">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-lg md:text-xl font-bold tracking-tight leading-none text-white">
              Grandmaster <span className="text-amber-400 font-medium">Chess</span>
            </h1>
            <p className="font-mono text-[9px] text-white/40 mt-1 uppercase tracking-widest">
              Elegant Dark Theme &bull; Phase 1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-sans text-[11px] font-semibold text-white/75">
              Senior Architecture Demo
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSoundSettings(!showSoundSettings)}
              className={`flex items-center gap-2 font-sans text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200 border active:scale-95 cursor-pointer ${
                showSoundSettings || soundEnabled
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/10'
              }`}
              title="Sound Settings"
            >
              {soundEnabled && (soundMoveEnabled || soundCaptureEnabled || soundAlertEnabled) ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Sound Settings</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Muted</span>
                </>
              )}
            </button>

            {showSoundSettings && (
              <>
                {/* Backdrop to close the popover */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSoundSettings(false)}
                />
                
                {/* Sound settings card */}
                <div className="absolute right-0 mt-2 bg-[#121212] border border-white/10 p-4 rounded-xl shadow-2xl z-50 w-64 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
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
              </>
            )}
          </div>

          <button
            onClick={() => setIsFlipped((prev) => !prev)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-amber-400 font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 border border-white/10 active:scale-95 cursor-pointer"
            title="Flip the board view"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Flip Board</span>
          </button>

          <button
            onClick={resetGame}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-amber-400 font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 border border-white/10 active:scale-95 cursor-pointer"
            title="Reset board state to initial"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Board</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden w-full">
        
        {/* Left Sidebar: Player Stats & Analytics */}
        <aside className="w-full xl:w-64 border-b xl:border-b-0 xl:border-r border-white/5 bg-[#0f0f0f] flex flex-col p-6 space-y-8 shrink-0">
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

          {/* Accuracy & Metrics Section */}
          <div className="mt-auto border-t border-white/5 pt-6 space-y-4 hidden xl:block">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1 uppercase tracking-wider font-semibold">
                <span>Accuracy</span>
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-light text-white font-display">94.2%</div>
              <div className="w-full bg-white/10 h-1 mt-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[94%]" />
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Immersive Chess Board Viewport */}
        <main className="flex-1 flex flex-col items-center justify-center bg-[#111111] p-6 md:p-8 xl:p-12 relative overflow-y-auto">
          {/* Top Opponent Profile Widget */}
          <div className="w-full max-w-2xl flex items-center justify-between mb-4 px-2">
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
            <div className="w-full max-w-2xl mb-4 px-4 py-2.5 rounded-lg border bg-violet-500/10 border-violet-500/20 text-violet-200 flex items-center justify-between transition-all duration-300 shadow-md animate-pulse">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                  AI Opponent is analyzing calculation lines...
                </span>
              </div>
            </div>
          )}

          {/* Active game alerts (Check, Checkmate, Stalemate) */}
          {(isCheck || isCheckmate || isStalemate) && (
            <div 
              className={`
                w-full max-w-2xl mb-4 px-4 py-2.5 rounded-lg border flex items-center justify-between transition-all duration-300 shadow-md
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
                    <span>Check! {activeColor === 'white' ? 'White' : 'Black'}'s King is threatened</span>
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
          <div className="w-full max-w-2xl flex items-center justify-between mt-4 px-2">
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
        <aside className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-white/5 bg-[#0e0e0e] flex flex-col shrink-0 overflow-y-auto xl:overflow-hidden h-full">
          
          {/* Game Mode Tabs */}
          <div className="p-4 border-b border-white/5 bg-[#141414]">
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2.5">
              Select Game Mode
            </div>
            <div className="grid grid-cols-3 gap-1 bg-[#090909] p-1 rounded-lg border border-white/5">
              <button
                onClick={() => {
                  setGameMode('local');
                  setMultiplayerState({ roomId: null, role: null });
                }}
                className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                  gameMode === 'local'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
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
                    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20 shadow-sm'
                    : 'text-white/40 hover:text-white/70'
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
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm'
                    : 'text-white/40 hover:text-white/70'
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
                  <div className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                    <Swords className="w-4 h-4" />
                    AI Opponent Setup
                  </div>
                </div>

                <div className="space-y-3.5 bg-[#151515] p-3 rounded-lg border border-white/5">
                  {/* Difficulty Selection */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-mono font-bold">AI Engine level</label>
                    <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-md">
                      {(['easy', 'medium', 'hard', 'gemini'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => useChessStore.getState().setAiDifficulty(level)}
                          className={`py-1 text-[9px] uppercase font-bold rounded transition-all cursor-pointer ${
                            aiDifficulty === level
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'text-white/40 hover:text-white/70'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Play as Color Selection */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-mono font-bold">Play as color</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          useChessStore.getState().setAiPlayerColor('white');
                          setIsFlipped(false);
                          resetGame();
                        }}
                        className={`py-1 px-2 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer text-center ${
                          aiPlayerColor === 'white'
                            ? 'bg-white text-zinc-950 border-white'
                            : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
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
                        className={`py-1 px-2 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer text-center ${
                          aiPlayerColor === 'black'
                            ? 'bg-zinc-800 text-white border-zinc-700'
                            : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
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
                    className="w-full py-1.5 bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 border border-violet-500/30 rounded text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95 text-center"
                  >
                    Restart match
                  </button>
                </div>
              </div>
            )}

            {gameMode === 'multiplayer' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Multiplayer Lobby
                  </div>
                </div>

                {!multiplayerRoomId ? (
                  <div className="space-y-3.5">
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
                        className="flex-1 bg-[#161616] border border-white/5 rounded px-3 py-2 text-xs uppercase text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 text-center font-mono font-bold tracking-wider"
                        maxLength={4}
                      />
                      <button
                        type="submit"
                        disabled={lobbyLoading || !joinRoomId}
                        className="px-4 bg-emerald-950/40 hover:bg-emerald-950/75 border border-emerald-500/20 text-emerald-300 rounded text-[10px] uppercase font-bold tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Join
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-3 bg-[#151515] p-3 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-white/50">
                      <span>Room ID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded tracking-wider">{multiplayerRoomId}</span>
                        <button
                          onClick={copyRoomCode}
                          className="hover:text-emerald-400 p-1 bg-white/5 hover:bg-white/10 rounded transition-all cursor-pointer"
                          title="Copy Room Code"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/50">
                      <span>Your Color:</span>
                      <span className="font-mono font-bold uppercase text-white bg-white/5 px-2 py-0.5 rounded">
                        {multiplayerRole}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${opponentJoined ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                        <span className="text-[10px] text-white/70 font-mono">
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
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#090909]/40">
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
        Clean Architecture Chess Engine &bull; Senior Engineering Mentor Draft
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
    </div>
  );
}

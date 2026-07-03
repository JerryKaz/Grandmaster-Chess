import { motion } from 'motion/react';
import { ChessPiece as IChessPiece } from '../../features/chess/models/types';

interface ChessPieceProps {
  piece: IChessPiece;
  isDragging?: boolean;
}

const PIECE_GLYPHS: Record<'white' | 'black', Record<IChessPiece['type'], string>> = {
  white: {
    pawn: '♙',
    knight: '♘',
    bishop: '♗',
    rook: '♖',
    queen: '♕',
    king: '♔',
  },
  black: {
    pawn: '♟',
    knight: '♞',
    bishop: '♝',
    rook: '♜',
    queen: '♛',
    king: '♚',
  },
};

const PIECE_NAMES: Record<IChessPiece['type'], string> = {
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
  king: 'King',
};

export default function ChessPiece({ piece }: ChessPieceProps) {
  const { color, type } = piece;
  const glyph = PIECE_GLYPHS[color][type];
  const name = `${color === 'white' ? 'White' : 'Black'} ${PIECE_NAMES[type]}`;

  return (
    <motion.div
      layoutId={piece.id}
      id={`piece-${piece.id}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={{ scale: 1.08 }}
      className={`
        relative flex items-center justify-center w-5/6 h-5/6 select-none cursor-grab active:cursor-grabbing
        transition-all duration-200 rounded-full
      `}
      title={name}
      aria-label={name}
    >
      {/* Glossy radial background gradient for premium aesthetic */}
      <div
        className={`
          absolute inset-1 rounded-full opacity-60 filter blur-[1px]
          ${
            color === 'white'
              ? 'bg-radial from-amber-50/20 to-transparent'
              : 'bg-radial from-slate-400/10 to-transparent'
          }
        `}
      />

      {/* Styled Glyph with text gradients and drop shadows */}
      <span
        className={`
          text-4xl md:text-5xl lg:text-5.5xl font-sans leading-none pb-1
          transition-colors duration-200
          ${
            color === 'white'
              ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] hover:text-amber-50'
              : 'text-slate-900 drop-shadow-[0_1.5px_2.5px_rgba(255,255,255,0.7)] hover:text-black'
          }
        `}
      >
        {glyph}
      </span>
    </motion.div>
  );
}

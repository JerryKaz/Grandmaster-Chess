import { motion, AnimatePresence } from 'motion/react';
import { PieceType, Color } from '../../features/chess/models/types';

interface PromotionModalProps {
  isOpen: boolean;
  color: Color;
  onSelect: (type: PieceType) => void;
  onCancel: () => void;
}

const PROMOTION_OPTIONS = [
  {
    type: 'queen' as PieceType,
    label: 'Queen',
    whiteSymbol: '♕',
    blackSymbol: '♛',
    description: 'Most powerful piece',
  },
  {
    type: 'knight' as PieceType,
    label: 'Knight',
    whiteSymbol: '♘',
    blackSymbol: '♞',
    description: 'Jumps in L-shape',
  },
  {
    type: 'rook' as PieceType,
    label: 'Rook',
    whiteSymbol: '♖',
    blackSymbol: '♜',
    description: 'Moves straight lines',
  },
  {
    type: 'bishop' as PieceType,
    label: 'Bishop',
    whiteSymbol: '♗',
    blackSymbol: '♝',
    description: 'Moves diagonally',
  },
];

export default function PromotionModal({ isOpen, color, onSelect, onCancel }: PromotionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          {/* Dark blurred background overlay */}
          <motion.div
            id="promotion-overlay-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-lg"
          />

          {/* Modal Container */}
          <motion.div
            id="promotion-modal-content"
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-sm bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-2xl overflow-hidden text-center z-10"
          >
            {/* Ambient decorative glow */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <h3 className="text-xl font-sans font-semibold text-white tracking-tight mb-1">
              Pawn Promotion
            </h3>
            <p className="text-xs text-neutral-400 mb-6 font-sans">
              Choose a piece to promote your pawn to
            </p>

            {/* Selection Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PROMOTION_OPTIONS.map((option, idx) => {
                const symbol = color === 'white' ? option.whiteSymbol : option.blackSymbol;
                return (
                  <motion.button
                    key={option.type}
                    id={`promo-option-${option.type}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onSelect(option.type)}
                    whileHover={{ scale: 1.03, translateY: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 cursor-pointer
                      bg-neutral-800/40 border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80
                    `}
                  >
                    {/* Visual Glyph with gradient/drop shadow */}
                    <span
                      className={`
                        text-5xl font-sans mb-2 leading-none select-none
                        ${
                          color === 'white'
                            ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]'
                            : 'text-neutral-900 drop-shadow-[0_1.5px_2.5px_rgba(255,255,255,0.7)]'
                        }
                      `}
                    >
                      {symbol}
                    </span>
                    <span className="text-sm font-medium text-white font-sans">
                      {option.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 leading-tight font-sans">
                      {option.description}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Cancel / Dismiss Button */}
            <motion.button
              id="promotion-cancel-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800/20 border border-neutral-800 hover:bg-neutral-800/50 transition-colors duration-200 cursor-pointer font-sans"
            >
              Cancel Promotion
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact opening catalogue (ECO + name + main line in SAN).
 * Used to label the current opening and to mark "book" moves in game review.
 * Matching is by move-order prefix, so transpositions are not detected — good enough for labelling.
 */
const LINES: [eco: string, name: string, moves: string][] = [
  ['B00', "King's Pawn Opening", 'e4'],
  ['C20', "King's Pawn Game", 'e4 e5'],
  ['C40', "King's Knight Opening", 'e4 e5 Nf3'],
  ['C44', "King's Pawn Game: Nc6", 'e4 e5 Nf3 Nc6'],
  ['C60', 'Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'],
  ['C68', 'Ruy Lopez: Exchange Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6'],
  ['C70', 'Ruy Lopez: Morphy Defense', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4'],
  ['C78', 'Ruy Lopez: Morphy Defense, Main Line', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O'],
  ['C84', 'Ruy Lopez: Closed', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
  ['C65', 'Ruy Lopez: Berlin Defense', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
  ['C67', 'Ruy Lopez: Berlin, Rio de Janeiro', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4'],
  ['C50', 'Italian Game', 'e4 e5 Nf3 Nc6 Bc4'],
  ['C50', 'Italian Game: Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
  ['C54', 'Italian Game: Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3'],
  ['C51', 'Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],
  ['C55', 'Two Knights Defense', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
  ['C57', 'Two Knights: Fried Liver Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
  ['C58', 'Two Knights: Knight Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'],
  ['C45', 'Scotch Game', 'e4 e5 Nf3 Nc6 d4'],
  ['C45', 'Scotch Game: Main Line', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
  ['C44', 'Scotch Gambit', 'e4 e5 Nf3 Nc6 d4 exd4 Bc4'],
  ['C46', 'Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
  ['C47', 'Four Knights: Scotch Variation', 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4'],
  ['C44', 'Ponziani Opening', 'e4 e5 Nf3 Nc6 c3'],
  ['C41', 'Philidor Defense', 'e4 e5 Nf3 d6'],
  ['C42', 'Petrov Defense', 'e4 e5 Nf3 Nf6'],
  ['C40', 'Latvian Gambit', 'e4 e5 Nf3 f5'],
  ['C40', 'Elephant Gambit', 'e4 e5 Nf3 d5'],
  ['C30', "King's Gambit", 'e4 e5 f4'],
  ['C33', "King's Gambit Accepted", 'e4 e5 f4 exf4'],
  ['C30', "King's Gambit Declined", 'e4 e5 f4 Bc5'],
  ['C25', 'Vienna Game', 'e4 e5 Nc3'],
  ['C29', 'Vienna Gambit', 'e4 e5 Nc3 Nf6 f4'],
  ['C23', "Bishop's Opening", 'e4 e5 Bc4'],
  ['C21', 'Center Game', 'e4 e5 d4 exd4 Qxd4'],
  ['C21', 'Danish Gambit', 'e4 e5 d4 exd4 c3'],
  ['C20', 'Wayward Queen Attack', 'e4 e5 Qh5'],
  ['B20', 'Sicilian Defense', 'e4 c5'],
  ['B27', 'Sicilian Defense: Hyperaccelerated', 'e4 c5 Nf3 g6'],
  ['B50', 'Sicilian Defense: Modern', 'e4 c5 Nf3 d6'],
  ['B54', 'Sicilian Defense: Open', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4'],
  ['B90', 'Sicilian Defense: Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['B70', 'Sicilian Defense: Dragon', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
  ['B56', 'Sicilian Defense: Classical', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6'],
  ['B80', 'Sicilian Defense: Scheveningen', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6'],
  ['B30', 'Sicilian Defense: Old Sicilian', 'e4 c5 Nf3 Nc6'],
  ['B33', 'Sicilian Defense: Sveshnikov', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'],
  ['B31', 'Sicilian Defense: Rossolimo', 'e4 c5 Nf3 Nc6 Bb5'],
  ['B40', 'Sicilian Defense: French Variation', 'e4 c5 Nf3 e6'],
  ['B45', 'Sicilian Defense: Taimanov', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6'],
  ['B41', 'Sicilian Defense: Kan', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6'],
  ['B23', 'Sicilian Defense: Closed', 'e4 c5 Nc3'],
  ['B22', 'Sicilian Defense: Alapin', 'e4 c5 c3'],
  ['B21', 'Sicilian Defense: Smith-Morra Gambit', 'e4 c5 d4 cxd4 c3'],
  ['B21', 'Sicilian Defense: Grand Prix Attack', 'e4 c5 f4'],
  ['C00', 'French Defense', 'e4 e6'],
  ['C01', 'French Defense: Exchange', 'e4 e6 d4 d5 exd5'],
  ['C02', 'French Defense: Advance', 'e4 e6 d4 d5 e5'],
  ['C03', 'French Defense: Tarrasch', 'e4 e6 d4 d5 Nd2'],
  ['C10', 'French Defense: Paulsen', 'e4 e6 d4 d5 Nc3'],
  ['C15', 'French Defense: Winawer', 'e4 e6 d4 d5 Nc3 Bb4'],
  ['C11', 'French Defense: Classical', 'e4 e6 d4 d5 Nc3 Nf6'],
  ['B10', 'Caro-Kann Defense', 'e4 c6'],
  ['B12', 'Caro-Kann Defense: Advance', 'e4 c6 d4 d5 e5'],
  ['B13', 'Caro-Kann Defense: Exchange', 'e4 c6 d4 d5 exd5 cxd5'],
  ['B15', 'Caro-Kann Defense: Main Line', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4'],
  ['B18', 'Caro-Kann Defense: Classical', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
  ['B11', 'Caro-Kann Defense: Two Knights', 'e4 c6 Nc3 d5 Nf3'],
  ['B01', 'Scandinavian Defense', 'e4 d5'],
  ['B01', 'Scandinavian Defense: Main Line', 'e4 d5 exd5 Qxd5 Nc3 Qa5'],
  ['B01', 'Scandinavian Defense: Modern', 'e4 d5 exd5 Nf6'],
  ['B07', 'Pirc Defense', 'e4 d6 d4 Nf6 Nc3 g6'],
  ['B06', 'Modern Defense', 'e4 g6'],
  ['B02', "Alekhine's Defense", 'e4 Nf6'],
  ['B00', "Owen's Defense", 'e4 b6'],
  ['B00', 'Nimzowitsch Defense', 'e4 Nc6'],
  ['A40', "Queen's Pawn Opening", 'd4'],
  ['D00', "Queen's Pawn Game", 'd4 d5'],
  ['D02', 'London System', 'd4 d5 Nf3 Nf6 Bf4'],
  ['D00', 'London System', 'd4 d5 Bf4'],
  ['A46', 'London System', 'd4 Nf6 Nf3 e6 Bf4'],
  ['A48', 'London System', 'd4 Nf6 Bf4'],
  ['D00', 'Jobava London System', 'd4 d5 Nc3 Nf6 Bf4'],
  ['D05', 'Colle System', 'd4 d5 Nf3 Nf6 e3'],
  ['D06', "Queen's Gambit", 'd4 d5 c4'],
  ['D20', "Queen's Gambit Accepted", 'd4 d5 c4 dxc4'],
  ['D30', "Queen's Gambit Declined", 'd4 d5 c4 e6'],
  ['D35', "Queen's Gambit Declined: Exchange", 'd4 d5 c4 e6 Nc3 Nf6 cxd5'],
  ['D37', "Queen's Gambit Declined: Three Knights", 'd4 d5 c4 e6 Nc3 Nf6 Nf3'],
  ['D53', "Queen's Gambit Declined: Orthodox", 'd4 d5 c4 e6 Nc3 Nf6 Bg5'],
  ['D32', 'Tarrasch Defense', 'd4 d5 c4 e6 Nc3 c5'],
  ['D10', 'Slav Defense', 'd4 d5 c4 c6'],
  ['D43', 'Semi-Slav Defense', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6'],
  ['D08', 'Albin Countergambit', 'd4 d5 c4 e5'],
  ['D07', 'Chigorin Defense', 'd4 d5 c4 Nc6'],
  ['A45', 'Indian Defense', 'd4 Nf6'],
  ['E00', 'Indian Defense: East Indian', 'd4 Nf6 c4 e6'],
  ['E20', 'Nimzo-Indian Defense', 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['E12', "Queen's Indian Defense", 'd4 Nf6 c4 e6 Nf3 b6'],
  ['E11', 'Bogo-Indian Defense', 'd4 Nf6 c4 e6 Nf3 Bb4'],
  ['E01', 'Catalan Opening', 'd4 Nf6 c4 e6 g3'],
  ['E60', "King's Indian Defense", 'd4 Nf6 c4 g6'],
  ['E61', "King's Indian Defense", 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['E90', "King's Indian Defense: Classical", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3'],
  ['E80', "King's Indian Defense: Sämisch", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3'],
  ['D80', 'Grünfeld Defense', 'd4 Nf6 c4 g6 Nc3 d5'],
  ['A56', 'Benoni Defense', 'd4 Nf6 c4 c5'],
  ['A60', 'Modern Benoni', 'd4 Nf6 c4 c5 d5 e6'],
  ['A57', 'Benko Gambit', 'd4 Nf6 c4 c5 d5 b5'],
  ['A51', 'Budapest Gambit', 'd4 Nf6 c4 e5'],
  ['A45', 'Trompowsky Attack', 'd4 Nf6 Bg5'],
  ['A80', 'Dutch Defense', 'd4 f5'],
  ['A87', 'Dutch Defense: Leningrad', 'd4 f5 c4 Nf6 g3 g6'],
  ['A84', 'Dutch Defense: Stonewall', 'd4 f5 c4 Nf6 g3 e6 Bg2 d5'],
  ['A40', 'Englund Gambit', 'd4 e5'],
  ['A10', 'English Opening', 'c4'],
  ['A20', "English Opening: King's English", 'c4 e5'],
  ['A30', 'English Opening: Symmetrical', 'c4 c5'],
  ['A15', 'English Opening: Anglo-Indian', 'c4 Nf6'],
  ['A04', 'Réti Opening', 'Nf3'],
  ['A09', 'Réti Opening', 'Nf3 d5 c4'],
  ['A05', "King's Indian Attack", 'Nf3 Nf6 g3'],
  ['A00', 'Hungarian Opening', 'g3'],
  ['A01', "Nimzo-Larsen Attack", 'b3'],
  ['A02', "Bird's Opening", 'f4'],
  ['A00', 'Polish Opening', 'b4'],
  ['A00', 'Van Geet Opening', 'Nc3'],
  ['A00', 'Grob Opening', 'g4'],
];

const CATALOGUE = LINES.map(([eco, name, moves]) => ({ eco, name, moves: moves.split(' ') }));

export interface Opening {
  eco: string;
  name: string;
}

/** Name of the deepest catalogue line matching the start of the game. */
export function detectOpening(sans: string[]): Opening | null {
  let best: { eco: string; name: string; len: number } | null = null;
  for (const line of CATALOGUE) {
    if (line.moves.length > sans.length) continue;
    if (best && line.moves.length <= best.len) continue;
    if (line.moves.every((m, i) => m === sans[i])) best = { eco: line.eco, name: line.name, len: line.moves.length };
  }
  return best && { eco: best.eco, name: best.name };
}

/** True if the first `n` moves are a prefix of some catalogue line (i.e. still "in book"). */
export function isBookPrefix(sans: string[], n: number): boolean {
  if (n === 0) return true;
  return CATALOGUE.some((line) => line.moves.length >= n && sans.slice(0, n).every((m, i) => m === line.moves[i]));
}

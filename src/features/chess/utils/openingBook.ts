export interface OpeningBookEntry {
  moves: string[]; // Coordinate moves, e.g. ["g1f3", "e2e4"]
  commentary: string; // Master-level commentary
  name: string; // Name of the opening
}

// Flat database mapping a space-separated string of played coordinate moves to the next recommended options.
export const OPENING_BOOK: Record<string, OpeningBookEntry> = {
  // --- White's 1st Move Choice ---
  "": {
    moves: ["e2e4", "d2d4", "c2c4", "g1f3"],
    name: "Game Start",
    commentary: "Taking control of the center from the very first move. Let the battle begin!"
  },

  // --- Responses to 1. e4 (King's Pawn Game) ---
  "e2e4": {
    moves: ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5"],
    name: "King's Pawn Game",
    commentary: "I open with the double king pawn, preparing active piece play."
  },

  // 1. e4 e5 (Open Game)
  "e2e4 e7e5": {
    moves: ["g1f3"],
    name: "Open Game",
    commentary: "Developing the knight to f3 to immediately pressure your e5 pawn."
  },
  "e2e4 e7e5 g1f3": {
    moves: ["b8c6", "g8f6", "d7d6"],
    name: "King's Knight Opening",
    commentary: "Your knight on f3 is active, so I develop Nc6 to support my central e5 pawn."
  },

  // Ruy Lopez (Spanish Opening)
  "e2e4 e7e5 g1f3 b8c6": {
    moves: ["f1b5", "f1c4", "b1c3"],
    name: "Open Game: Development",
    commentary: "The Ruy Lopez (Bb5) puts direct pressure on the defender of the e5 pawn!"
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5": {
    moves: ["a7a6", "g8f6"],
    name: "Ruy Lopez",
    commentary: "The Morphy Defense (a6) asks the white bishop to state its intentions on b5."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6": {
    moves: ["b5a4"],
    name: "Ruy Lopez: Morphy Defense",
    commentary: "Retreating the bishop to a4, maintaining pressure along the diagonal."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4": {
    moves: ["g8f6"],
    name: "Ruy Lopez: Morphy Defense, Columbus Line",
    commentary: "Developing the knight to f6, taking aim at the undefended e4 pawn."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6": {
    moves: ["e1g1"],
    name: "Ruy Lopez: Closed Defense",
    commentary: "Castling early to secure the king's safety before central lines open."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1": {
    moves: ["f8e7"],
    name: "Ruy Lopez: Closed Main Line",
    commentary: "Developing my bishop to e7 to castle safely and avoid early pin tactics."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7": {
    moves: ["f1e1"],
    name: "Ruy Lopez: Main Line, e1 Rook",
    commentary: "Using the rook on e1 to support the e4 pawn and prepare for a d4 push."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1": {
    moves: ["b7b5"],
    name: "Ruy Lopez: Spassky Line",
    commentary: "Advancing b5 to break the bishop pin on the c6 knight immediately."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5": {
    moves: ["a4b3"],
    name: "Ruy Lopez: Retreat",
    commentary: "Stepping the bishop back to b3, still aiming at your f7 weak spot."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3": {
    moves: ["d7d6"],
    name: "Ruy Lopez: Chigorin Prep",
    commentary: "Securing the e5 pawn and paving the way for my light-squared bishop."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6": {
    moves: ["c2c3"],
    name: "Ruy Lopez: Main Line d4 Prep",
    commentary: "Preparing c3 to carve out a pocket on c2 for the bishop and support a d4 center strike."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3": {
    moves: ["e8g8"],
    name: "Ruy Lopez: Castillo Castle",
    commentary: "Tucking my king safely into the corner with a solid kingside castle."
  },
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8": {
    moves: ["h2h3"],
    name: "Ruy Lopez: Anti-Pin",
    commentary: "Creating a Luft escape square with h3 and preventing any annoying Bg4 pins."
  },

  // Italian Game (Giuoco Piano)
  "e2e4 e7e5 g1f3 b8c6 f1c4": {
    moves: ["f8c5", "g8f6"],
    name: "Italian Game",
    commentary: "The Giuoco Piano (Bc5). Black mirrors White to establish a symmetric, active game."
  },
  "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5": {
    moves: ["c2c3", "d2d3"],
    name: "Italian Game: Giuoco Piano",
    commentary: "Shoring up the center with c3, aiming to build a massive duo on d4 and e4."
  },
  "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3": {
    moves: ["g8f6"],
    name: "Italian Game: Main Line",
    commentary: "Counter-attacking the e4 pawn immediately with my developed kingside knight."
  },
  "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6": {
    moves: ["d2d3", "d2d4"],
    name: "Italian Game: Quiet System",
    commentary: "Choosing the solid Giuoco Pianissimo (d3), cementing the center."
  },
  "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3": {
    moves: ["d7d6"],
    name: "Italian Game: Giuoco Pianissimo",
    commentary: "Supporting c5 and e5, ensuring my pawn chain remains resilient."
  },

  // --- Responses to 1. e4 c5 (Sicilian Defense) ---
  "e2e4 c7c5": {
    moves: ["g1f3", "b1c3", "c2c3"],
    name: "Sicilian Defense",
    commentary: "Developing my knight to f3, preparing a fast central break with d4."
  },
  "e2e4 c7c5 g1f3": {
    moves: ["d7d6", "e7e6", "b8c6"],
    name: "Sicilian Defense: Open Prep",
    commentary: "Stepping d6 to control e5 and prepare the classic Najdorf or Dragon setups."
  },
  "e2e4 c7c5 g1f3 d7d6": {
    moves: ["d2d4"],
    name: "Sicilian Defense: Classical Route",
    commentary: "Cracking open the center with d4! Let the open tactical warfare begin."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4": {
    moves: ["c5d4"],
    name: "Sicilian Defense: Center Exchange",
    commentary: "Trading my flank c-pawn for your valuable central d-pawn."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4": {
    moves: ["f3d4"],
    name: "Sicilian Defense: Recapture",
    commentary: "Recapturing with the active knight, placing a dominant piece in the center."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4": {
    moves: ["g8f6"],
    name: "Sicilian Defense: Knight Attack",
    commentary: "Developing the knight to f6 with tempo, targeting your undefended e4 pawn."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6": {
    moves: ["b1c3"],
    name: "Sicilian Defense: Defend e4",
    commentary: "Defending the e4 pawn with Nc3, adding central control and piece mobility."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3": {
    moves: ["a7a6", "g7g6", "b8c6"],
    name: "Sicilian Defense: Najdorf Setup",
    commentary: "The famed Najdorf Variation (a6)! Preventing any Bb5+ or Nb5 jumps."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6": {
    moves: ["c1g5", "f2f3", "f1e2"],
    name: "Sicilian Defense: Najdorf, Main Line",
    commentary: "The sharpest line! Bg5 pins the f6 knight and threatens an aggressive f4 push."
  },
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5": {
    moves: ["e7e6"],
    name: "Sicilian: Najdorf, Goteborg Attack",
    commentary: "Blocking the bishop's diagonal with e6, preparing to develop my dark-squared bishop."
  },

  // --- Responses to 1. e4 c6 (Caro-Kann Defense) ---
  "e2e4 c7c6": {
    moves: ["d2d4"],
    name: "Caro-Kann Defense",
    commentary: "Grabbing maximum space in the center with d4 against your solid defensive barrier."
  },
  "e2e4 c7c6 d2d4": {
    moves: ["d7d5"],
    name: "Caro-Kann Defense: Main Line",
    commentary: "Striking back with d5 immediately, disputing White's central dominance."
  },
  "e2e4 c7c6 d2d4 d5": {
    moves: ["b1c3", "e4e5"],
    name: "Caro-Kann: Classical or Advance",
    commentary: "Developing Nc3 to guard e4 and keep the center highly fluid."
  },
  "e2e4 c7c6 d2d4 d5 b1c3": {
    moves: ["d5e4"],
    name: "Caro-Kann: Classical exchange",
    commentary: "Exchanging on e4 to clear out White's central tension."
  },
  "e2e4 c7c6 d2d4 d5 b1c3 d5e4": {
    moves: ["c3e4"],
    name: "Caro-Kann: Recapture",
    commentary: "Recapturing on e4, placing my knight on a very dominant, active square."
  },
  "e2e4 c7c6 d2d4 d5 b1c3 d5e4 c3e4": {
    moves: ["c8f5"],
    name: "Caro-Kann: Classical Bf5",
    commentary: "Developing my bishop to f5 to challenge your centralized e4 knight."
  },
  "e2e4 c7c6 d2d4 d5 b1c3 d5e4 c3e4 c8f5": {
    moves: ["e4g3"],
    name: "Caro-Kann: Bishop Chaser",
    commentary: "Harassing your light-squared bishop with Ng3, aiming to claim the kingside flank."
  },
  "e2e4 c7c6 d2d4 d5 b1c3 d5e4 c3e4 c8f5 e4g3": {
    moves: ["f5g6"],
    name: "Caro-Kann: Bishop Retreat",
    commentary: "Retreating safely to g6, keeping control over the key h5-b1 diagonal."
  },

  // --- Responses to 1. e4 e6 (French Defense) ---
  "e2e4 e7e6": {
    moves: ["d2d4"],
    name: "French Defense",
    commentary: "Taking full control of the center with d4, as you prepare to counter on d5."
  },
  "e2e4 e7e6 d2d4": {
    moves: ["d7d5"],
    name: "French Defense: Main Line",
    commentary: "Challenging your center with d5. My solid pawn structure will anchor my game."
  },
  "e2e4 e7e6 d2d4 d5": {
    moves: ["b1c3", "e4e5"],
    name: "French: Paulsen & Steinitz",
    commentary: "Developing Nc3 to defend e4 while maintaining maximum tactical flexibility."
  },
  "e2e4 e7e6 d2d4 d5 b1c3": {
    moves: ["g8f6"],
    name: "French: Steinitz Variation",
    commentary: "Attacking your center and developing my knight to f6."
  },
  "e2e4 e7e6 d2d4 d5 b1c3 g8f6": {
    moves: ["c1g5"],
    name: "French: Steinitz, Classical",
    commentary: "Pinning your f6 knight with Bg5, preparing for e5 aggression."
  },

  // --- Responses to 1. d4 (Queen's Pawn Opening) ---
  "d2d4": {
    moves: ["d7d5", "g8f6"],
    name: "Queen's Pawn Game",
    commentary: "Responding symmetrically with d5, establishing my own central stronghold."
  },

  // 1. d4 d5 (Closed Games)
  "d2d4 d5": {
    moves: ["c2c4"],
    name: "Queen's Pawn Opening",
    commentary: "The Queen's Gambit (c4)! Offering a wing pawn to capture the absolute center."
  },
  "d2d4 d5 c2c4": {
    moves: ["e7e6", "d5c4", "c7c6"],
    name: "Queen's Gambit",
    commentary: "Declining the gambit with e6 (QGD), maintaining a highly resilient central wall."
  },
  "d2d4 d5 c2c4 e7e6": {
    moves: ["b1c3"],
    name: "Queen's Gambit Declined",
    commentary: "Developing the knight to c3 to put additional pressure on your d5 strongpoint."
  },
  "d2d4 d5 c2c4 e7e6 b1c3": {
    moves: ["g8f6"],
    name: "Queen's Gambit: Orthodox Defense",
    commentary: "Developing Nf6 to shore up the critical d5 outpost."
  },
  "d2d4 d5 c2c4 e7e6 b1c3 g8f6": {
    moves: ["c1g5"],
    name: "Queen's Gambit: Pin line",
    commentary: "Pinning your f6 knight. I intend to make your development highly uncomfortable."
  },
  "d2d4 d5 c2c4 e7e6 b1c3 g8f6 c1g5": {
    moves: ["f8e7"],
    name: "Queen's Gambit: Bishop Cover",
    commentary: "Developing my bishop to e7 to break the pin and secure my king's flight square."
  },

  // 1. d4 Nf6 (Indian Defenses)
  "d2d4 g8f6": {
    moves: ["c2c4"],
    name: "Indian Defense",
    commentary: "Claiming queenside space with c4, preparing to face your flexible setup."
  },
  "d2d4 g8f6 c2c4": {
    moves: ["g7g6", "e7e6"],
    name: "Indian Defense: King's vs Nimzo",
    commentary: "Advancing g6 to hyper-modernly develop my bishop to the long diagonal."
  },
  "d2d4 g8f6 c2c4 g7g6": {
    moves: ["b1c3"],
    name: "King's Indian Prep",
    commentary: "Developing my knight to c3, preparing to build a full e4/d4 center."
  },
  "d2d4 g8f6 c2c4 g7g6 b1c3": {
    moves: ["f8g7"],
    name: "King's Indian Defense",
    commentary: "Fianchettoing my dark-squared bishop, waiting to strike back at your big center."
  },
  "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7": {
    moves: ["e2e4"],
    name: "King's Indian Defense: Classical Prep",
    commentary: "Occupying the center fully with e4. I challenge you to break my fortress!"
  },
  "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4": {
    moves: ["d7d6"],
    name: "King's Indian Defense: Main Line",
    commentary: "Restricting your e5 push with d6. I'm preparing a counter-attack!"
  }
};

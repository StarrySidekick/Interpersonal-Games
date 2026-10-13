// Chess variants, played as they are (Timothy, 2026-10-11: "model a few
// simpler chess variants in order to test them and see if they can be weaved
// into the game ... maybe make a mode that just lets you play chess
// variants"). Each is a starting position and a few rules, played on the
// Grove Chess engine against the thinking side (ai.js).
//
// Positions are FEN, the standard way to write a chess position down: the
// rows from the top (theirs) to the bottom (yours), "/" between rows, a
// letter for each piece (capitals yours, small letters theirs: k king,
// q queen, r rook, b bishop, n knight, p pawn) and a number for a run of
// empty squares. Checked against Fairy-Stockfish's variant list and the
// Wikipedia and Chess Variants pages (docs/grove-variants.md).
//
// Where Grove Chess plays chess differently, a variant says so in `differs`:
// the game is won by taking the King rather than by checkmate (so moving
// into check is allowed, and loses), a pawn always becomes a queen, and
// there is no castling and no en passant.

export const VARIANTS = {
  microchess: {
    name: 'Microchess', size: '4 × 5',
    fen: 'rbnk/p3/4/3P/RBNK', rules: { promote: true, pawnDouble: true },
    blurb: 'A whole game of chess on twenty squares: a king, a rook, a bishop, a knight and one pawn each.',
    history: 'Designed by Glimne in 1997. Its pawn may step two on its first move, and castling is allowed (not here).'
  },
  gardner: {
    name: 'Gardner minichess', size: '5 × 5',
    fen: 'rnbqk/ppppp/5/PPPPP/RNBQK', rules: { promote: true },
    blurb: 'Every chess piece but one bishop and knight each, on a five by five board. The two armies start face to face, kings on the same file.',
    history: 'Martin Gardner, 1969, in his Scientific American column. In 2013 it was solved: with perfect play it is a draw.'
  },
  losalamos: {
    name: 'Los Alamos chess', size: '6 × 6',
    fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR', rules: { promote: true },
    blurb: 'Chess without bishops on a six by six board. Pawns step one square only.',
    history: 'The first chess-like game a computer ever played: Paul Stein and Mark Wells, on the MANIAC I at Los Alamos, 1956. Bishops were left out to fit the machine.'
  },
  minichess: {
    name: 'Mini chess', size: '5 × 6',
    fen: 'rbqkn/ppppp/5/5/PPPPP/RBQKN', rules: { promote: true },
    blurb: 'A rook, bishop, queen, king and knight each, with five pawns, on five files by six rows: room to develop, short enough to finish.',
    history: 'The 5 × 6 layout known as Speed chess, one of several small chess variants of the twentieth century.'
  },
  petty: {
    name: 'Petty chess', size: '5 × 6',
    fen: 'qkbnr/ppppp/5/5/PPPPP/QKBNR', rules: { promote: true },
    blurb: 'Another 5 × 6 chess, with queen and king in the corner.',
    history: 'A small variant listed among the Chess Variants Pages minichess games and in Fairy-Stockfish.'
  },
  hill: {
    name: 'King of the Hill', size: '8 × 8',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', rules: { promote: true, pawnDouble: true, hill: true },
    blurb: 'Ordinary chess, with a second way to win: walk your King onto one of the four middle squares. Take their King, or reach the hill first.',
    history: 'A modern variant, popular on lichess.org and chess.com. It rewards a bold king.'
  },
  racing: {
    name: 'Racing Kings', size: '8 × 8',
    fen: '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ', rules: { race: true, noCheck: true },
    blurb: 'No pawns, and both armies start on the same side. The first King to reach the top row wins. Nobody may give check: no move may attack either King.',
    history: 'Invented by Vernon Rylands Parton, an English inventor of many chess variants, in the 1960s. In the full rules, if their King reaches the top on the very next move after yours, it is a draw; here, the first King there wins.'
  },
  peasants: {
    name: 'Peasants’ Revolt', size: '8 × 8',
    fen: '1nn1k1n1/4p3/8/8/8/8/PPPPPPPP/4K3', rules: { promote: true, pawnDouble: true },
    blurb: 'Your King and eight pawns against their King, three knights and a pawn. March, promote, and overwhelm.',
    history: 'A lopsided variant from the Chess Variants Pages, kept in Fairy-Stockfish’s list: good practice at pawn play and promotion.'
  },
  kungfu: {
    name: 'Kung Fu Chess', size: '8 × 8',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', rules: { promote: true, pawnDouble: true, realtime: true },
    blurb: 'Chess with no turns. Move any piece whenever it is ready, and so do they. Moves take time to travel, so a piece can dodge; a piece that moved must rest. Take their King.',
    history: 'Kung-Fu Chess, by Shizmoo Games (2001 to 2002), won the Audience Choice award at the 2002 Independent Games Festival. This plays its lightning speed: a square every fifth of a second, two seconds’ rest. In the original, pieces could also collide in the air.'
  },
  monster: {
    name: 'Monster chess', size: '8 × 8',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/2PPPP2/4K3', rules: { promote: true, pawnDouble: true, movesPerTurn: 2 },
    blurb: 'Your King and four pawns against a whole army, but you move twice for every move of theirs.',
    history: 'A traditional lopsided variant: the lone King’s extra move makes up for the missing army.'
  }
};

export const VARIANT_ORDER = Object.keys(VARIANTS);

const LETTER = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

/** A FEN position as { W, H, pieces, foes }: yours are the capitals.
    Extended (2026-10-13, for the piece trials): any other piece is its id
    in square brackets, its first letter a capital for yours, so
    [Tallrook] is your tall rook and [tallrook] theirs. A run of empty
    squares may be more than one digit, for boards wider than nine. */
export function readFen(fen) {
  const rows = fen.split('/'), H = rows.length, pieces = [], foes = [];
  let W = 0;
  rows.forEach((row, r) => {
    const y = H - 1 - r;
    let x = 0;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (/\d/.test(ch)) { let n = ch; while (/\d/.test(row[i + 1] || '')) n += row[++i]; x += +n; continue; }
      let type = LETTER[ch.toLowerCase()], mine = ch === ch.toUpperCase();
      if (ch === '[') {
        const j = row.indexOf(']', i);
        if (j < 0) throw new Error(`FEN: an unclosed [ in ${fen}`);
        const id = row.slice(i + 1, j);
        type = id.toLowerCase(); mine = id[0] !== id[0].toLowerCase(); i = j;
      }
      if (!type) throw new Error(`FEN: cannot read "${ch}" in ${fen}`);
      (mine ? pieces : foes).push({ type, x, y });
      x++;
    }
    W = Math.max(W, x);
  });
  return { W, H, pieces, foes };
}

/** What a variant plays differently from chess as Grove Chess plays it. */
export function differs(v) {
  const out = ['You win by taking their King (or as the variant says), not by checkmate: a King left where it can be taken is lost.'];
  if (v.rules.promote) out.push('A pawn reaching the far row always becomes a queen.');
  out.push('No castling and no en passant.');
  return out;
}

// What carries from one Adventure run to the next (Timothy, 2026-10-17: "the
// game should get progressively harder until you lose, and then you have
// some meta progression, like most rogue likes", and "we need a field guide
// to view all the different things you can find").
//
// Two things, both kept on the phone, both only ever growing:
//
// - The field guide: every kind of thing a run can bring (pieces for your
//   set, their rabbits, suits, weapons, the ground, bosses), filled in the
//   first time you meet each. Nothing in it can be missed for good: every
//   entry can turn up in any run.
// - Lanterns: lit by the deepest depth you have reached, never put out. Each
//   adds an option (a cape for your cat, a choice of gift, vows that make a
//   run harder), never raw power, so the first boards stay worth thinking
//   about (the level-design skill's research: Hades' Mirror and Pact,
//   Balatro's stakes; Rogue Legacy's own postmortem on stat upgrades). The
//   options, and the depths that light them, were Claude's call: Timothy can
//   change any of them.

import { PIECES } from './rules.js';
import { RABBITS, SUITS, WEAPONS, TROUPE } from './run.js';
import { RABBIT_RULES, SUIT_FROM, BOSSES } from './adventure-levels.js';

/** Lanterns, by the depth that lights each. `cape` names a cape it opens
    (models.js CAT_OPTIONS.cape). */
export const LANTERNS = [
  { depth: 5, id: 'moss', name: 'A moss cape', text: 'A green cape for your cat.', cape: 'moss' },
  { depth: 8, id: 'giftpick', name: 'Your choice of gift', text: 'After the first board, choose which comes first: the bishop or the knight.' },
  { depth: 10, id: 'night', name: 'A night cape', text: 'A cape the blue of the deep boards.', cape: 'night' },
  { depth: 12, id: 'vows', name: 'Vows', text: 'Rules you can take on before a run, to make it harder. Your deepest with each set of vows is kept on its own.' },
  { depth: 16, id: 'gold', name: 'A gold cape', text: 'For a cat that has been past the double bogey line.', cape: 'gold' },
  { depth: 20, id: 'rose', name: 'A rose cape', text: 'For the very deep.', cape: 'rose' }
];
/** Is lantern `id` lit, for a deepest depth of `deepest`? */
export const lit = (id, deepest) => (deepest || 0) >= (LANTERNS.find((l) => l.id === id)?.depth ?? Infinity);
/** The capes open at that depth: the plain one always. */
export const capesOpen = (deepest) => ['bark', ...LANTERNS.filter((l) => l.cape && lit(l.id, deepest)).map((l) => l.cape)];

/** Vows: opt-in rules, each a little harder (a lantern opens them). */
export const VOWS = [
  { id: 'early', name: 'The early dark', text: 'The dark comes a move sooner.' },
  { id: 'light', name: 'Travel light', text: 'No bishop or knight as gifts: your cat, and what you find.' }
];
/** A short name for a set of vows, for the records: "early+light". */
export const vowKey = (vows) => [...vows].filter((v) => VOWS.some((x) => x.id === v)).sort().join('+');

/** One line for each thing, short enough for the back of a card or a line
    of the guide (moved here from play/main.js, 2026-10-17). */
export const SHORT = {
  hearts: 'Two lives: hit once, it holds.', vines: 'Leaves a trail that catches what crosses it.', stars: 'Two moves a turn, but takes once.',
  spirals: 'Takes again, as long as it can.', gears: 'Trades places with any piece, as its move.',
  sword: 'Strikes past where it lands; cuts hedges.', lance: 'Takes what it slides through.', mace: 'Stuns everything round where it lands.',
  shield: 'What it hits slides till it hits something.', net: 'Your cat catches a piece whole.',
  thespian: 'Takes another piece’s moves every time it moves.', scribe: 'A knight’s leap a piece can block, or one step.',
  painter: 'A knight’s leap, again and again in a line.', bard: 'Hops two squares at a time, any way.', dancer: 'Lands on any square two away.',
  cat: 'Your first piece: one step any way, like a king.', bishop: 'Slides any distance diagonally.', knight: 'Leaps in an L, over anything.',
  rook: 'Slides any distance in a straight line.', king: 'One step any way.', queen: 'Slides any distance, straight or diagonally.',
  robot: 'Walks a loop, a step every turn; its next square is framed.', sentry: 'Never walks; takes what is in its reach as their turn ends.',
  trap: 'Like a sentry, but stays on the square it took.', scared: 'Runs when you attack it; attack two at once.',
  simple: 'Goes up and down one line toward you.', sentient: 'Thinks one move ahead, and keeps out of your reach.',
  hedge: 'Hop over it, or cut through it with a sword.', dark: 'Past par, it takes a piece of yours every turn.'
};

/** Where an unmet entry turns up, so the guide says how to find it. */
const fromDepth = (d) => (d <= 1 ? 'From the first board.' : `From depth ${d}.`);

/**
 * The field guide's sections, in order: { id, title, entries: [{ key, name,
 * line, hint, pic }] }. `key` is what play/main.js records when you meet it;
 * `pic` says how to draw it ({ piece } | { rabbit } | { suit } | { weapon }
 * | { ground } | { boss }).
 */
export function guideSections() {
  const pieces = ['cat', 'bishop', 'knight', 'rook', 'king', 'queen', ...TROUPE].filter((t) => PIECES[t]);
  const pieceHint = (t) => (t === 'cat' ? 'Every run starts with it.' : t === 'bishop' || t === 'knight' ? 'A gift on the way down.'
    : t === 'queen' ? 'Theirs from depth 8: take three of them.' : TROUPE.includes(t) ? 'On a card, or take three of theirs.' : 'Take three of theirs.');
  return [
    { id: 'pieces', title: 'Pieces for your set', entries: pieces.map((t) => ({ key: 'piece:' + t, name: PIECES[t].name, line: SHORT[t] || PIECES[t].desc, hint: pieceHint(t), pic: { piece: t } })) },
    { id: 'rabbits', title: 'Their rabbits', entries: Object.keys(RABBIT_RULES).filter((r) => RABBITS[r]).map((r) => ({ key: 'rabbit:' + r, name: `${RABBITS[r].name} rabbit`, line: SHORT[r], hint: fromDepth(RABBIT_RULES[r].from), pic: { rabbit: r } })) },
    { id: 'suits', title: 'Suits', entries: Object.keys(SUITS).map((s) => ({ key: 'suit:' + s, name: SUITS[s].name, line: SHORT[s], hint: `On a card; on theirs from depth ${SUIT_FROM[s] ?? 6}.`, pic: { suit: s } })) },
    { id: 'weapons', title: 'Weapons', entries: Object.keys(WEAPONS).filter((w) => SHORT[w]).map((w) => ({ key: 'weapon:' + w, name: WEAPONS[w].name, line: SHORT[w], hint: 'On a card.', pic: { weapon: w } })) },
    { id: 'ground', title: 'The ground', entries: [
      { key: 'ground:hedge', name: 'Hedges', line: SHORT.hedge, hint: fromDepth(2), pic: { ground: 'hedge' } },
      { key: 'rule:dark', name: 'The dark', line: SHORT.dark, hint: 'Play past par.', pic: { ground: 'dark' } }
    ] },
    { id: 'bosses', title: 'Bosses', entries: BOSSES.map((b) => ({ key: 'boss:' + b.id, name: b.name, line: b.line, hint: b.from > 5 ? `Every fifth board, from depth ${b.from}.` : 'Every fifth board.', pic: { boss: b.id } })) }
  ];
}

// A run: the descent's hand of pieces and what happens to it between
// levels (Timothy, 2026-10-08). No page code here, so it can be tested.
//
// Your hand starts with four pieces and grows by one for each level you
// finish, up to six. A piece taken is gone for good, which opens its slot
// again. Once the hand is full, finishing a level offers upgrades instead:
//
// - Suits, one per piece, each a rule the piece carries (Timothy chose
//   what each does, 2026-10-08; rules.js plays them):
//   Hearts, a second life ("Knight of Hearts": the first capture costs the
//   heart, and the attacker bounces off). Swords, cleave: after it takes a
//   piece it may take again, the same turn. Stars, it moves twice: once a
//   level, its first move is followed by another. Diamonds, treasure: each
//   piece it takes adds a pick when the level is done. Spirals, swap: it
//   may trade squares with any other piece of yours, as its move. Spirits
//   (2026-10-09), passes through: it moves through pieces, statues and
//   stumps as if they were not there, even if it is not a piece that hops.
//   (Before that, swords, stars and spirals rewrote the piece's Betza and
//   diamonds made it hard to take; those were proposals and are gone.)
// - Fusing two pieces into one with both their moves (a rook and a knight
//   make the chancellor). It frees a slot.
// - Promotion: a piece becomes the next piece up in strength.
// - Jokers, rules for the rest of the run, in the spirit of Balatro's:
//   Double Time, Foresight, Recruiter, Lazy Rabbits, Overtime.
//
// Changing a piece's moves makes a new piece out of its Betza code
// (invented.js), so everything else (drawing, diagrams, the solver) works
// on it unchanged.

import { PIECES } from './rules.js';
import { parseBetza, betzaMoves } from './betza.js';
import { registerInvented, newId, estimateStrength } from './invented.js';
import { powerOf } from './power.js';

export const SUITS = {
  hearts: { name: 'Hearts', mark: '♥', colour: '#e0445a', desc: 'A second life: the first time it is taken it loses the heart instead, and whatever took it bounces off.' },
  swords: { name: 'Swords', mark: '♠', colour: '#7f9fc0', desc: 'Cleave: after it takes a piece, it may take another the same turn, and another after that.' },
  stars: { name: 'Stars', mark: '★', colour: '#e8c547', desc: 'Moves twice: once a level, its first move is followed straight away by a second.' },
  diamonds: { name: 'Diamonds', mark: '♦', colour: '#5fd0d8', desc: 'Treasure: each piece it takes adds another pick when the level is done (two at most).' },
  spirals: { name: 'Spirals', mark: '@', colour: '#f0903a', desc: 'Swap: as its move, it can trade squares with any other piece of yours.' },
  spirits: { name: 'Spirits', mark: '✧', colour: '#b9a7ff', desc: 'Passes through: it moves through pieces, statues and stumps as if they were not there, and lands as usual.' }
};

export const JOKERS = {
  double: { name: 'Double Time', desc: 'You move twice for every move of theirs.' },
  foresight: { name: 'Foresight', desc: 'You see where every rabbit will go next.' },
  recruiter: { name: 'Recruiter', desc: 'The first piece you take on each level joins you, if you have room.' },
  lazy: { name: 'Lazy Rabbits', desc: 'They only move every other turn.' },
  overtime: { name: 'Overtime', desc: 'Five more moves on every level.' }
};

// --- Betza, rewritten. -----------------------------------------------------

const ATOM = { '1,0': 'W', '1,1': 'F', '2,0': 'D', '2,1': 'N', '2,2': 'A', '3,0': 'H', '3,1': 'C', '3,2': 'Z', '3,3': 'G' };

/** Terms back to Betza text. */
function write(terms) {
  return terms.map((t) => {
    const a = ATOM[`${t.jump[0]},${t.jump[1]}`] || `(${t.jump[0]},${t.jump[1]})`;
    return t.mods + t.dirs + (t.ride && a.length === 1 ? a + a : a);
  }).join('');
}
const key = (t) => `${t.mods}|${t.dirs}|${t.jump}|${t.ride}`;

/** Two codes as one: every move of either. */
export function unionBetza(a, b) {
  const seen = new Set(), out = [];
  for (const t of [...parseBetza(a), ...parseBetza(b)]) if (!seen.has(key(t))) { seen.add(key(t)); out.push(t); }
  // A leap and the ride of the same jump: the ride covers it.
  return write(out.filter((t) => t.ride || !out.some((u) => u.ride && u.jump + '' === t.jump + '' && u.mods === t.mods && u.dirs === t.dirs)));
}


/** The real piece, if any, that moves exactly like a code. */
function sameAs(code) {
  const mine = betzaMoves(code), probe = [[3, 3], [0, 0], [1, 4], [5, 2]];
  const sig = (moves) => probe.map(([x, y]) => moves((a, b) => (a < 0 || b < 0 || a > 7 || b > 7 ? 0 : 1), { x, y }, 1).map((m) => `${m.x},${m.y}`).sort().join(' ')).join('|');
  const want = sig(mine);
  return Object.keys(PIECES).find((k) => PIECES[k].betza && !PIECES[k].invented && k !== 'rabbit' && k !== 'ball' && sig(PIECES[k].moves) === want) || null;
}

// --- Hand pieces. ----------------------------------------------------------
// { base, suit, lives, fused: [base, base] }. `pieceOf` gives the
// piece it plays as: its type (a real piece, or a made one), its name, and
// any made pieces that must be registered (and carried in settings).

export function pieceOf(h, made = []) {
  const bases = h.fused || [h.base];
  // A suit is a rule the piece carries, not a change to its moves, so only
  // fusing makes a new piece.
  const code = h.fused ? bases.map((b) => PIECES[b]?.betza || 'W').reduce((a, b) => unionBetza(a, b)) : PIECES[h.base]?.betza || 'W';
  const real = h.fused ? sameAs(code) : h.base;
  const fusedName = h.fused ? (real ? PIECES[real].name : bases.map((b) => PIECES[b].name).join('-')) : null;
  const plain = fusedName || PIECES[h.base].name;
  const name = h.suit ? `${plain} of ${SUITS[h.suit].name}` : plain;
  let type = real;
  if (!type) {
    // A made piece: named for what it became, looking like what it was.
    const found = made.find((p) => p.betza === code && p.name === fusedName);
    const id = found?.id || newId(fusedName, new Set([...Object.keys(PIECES), ...made.map((p) => p.id)]));
    if (!found) made.push({ id, name: fusedName, betza: code, look: bases[0], desc: `${fusedName}: ${code}.`, made: true });
    type = id;
  }
  return { type, name, code };
}

/** Register a run's made pieces (after loading a run, or in a worker). */
export const registerMade = (made) => registerInvented(made);

/** The strength of a hand piece, for promotions and offers. */
export function strengthOf(h, made) {
  const { type } = pieceOf(h, made);
  registerInvented(made);
  const P = PIECES[type];
  return (P?.strength ?? estimateStrength(P.betza)) + (h.lives > 1 ? 1 : 0) + (h.suit && h.suit !== 'hearts' ? 0.5 : 0);
}

// --- Rewards. --------------------------------------------------------------

/** The classic and fairy pieces a run can find (not vetoed, not made). */
export function findable(veto = []) {
  return Object.keys(PIECES).filter((k) => ['classic', 'fairy'].includes(PIECES[k].kind) && !PIECES[k].invented && !veto.includes(k) && k !== 'amazon');
}

/** The next piece up in strength from `base`, or null at the top. */
export function promotion(base, veto = []) {
  const s = PIECES[base].strength ?? 3;
  const up = findable(veto).filter((k) => (PIECES[k].strength ?? 0) > s + 0.2).sort((a, b) => PIECES[a].strength - PIECES[b].strength);
  return up[0] || null;
}

/**
 * What finishing a level offers. With room in the hand: two pieces to
 * find, a classic one and a fairy one of about the same strength, both
 * stronger the deeper you are. With a full hand: three upgrade cards.
 */
export function rewardsFor(run, rand, veto = [], fairy = true) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  if (run.hand.length < run.maxPieces && !fairy) {
    // Too early for fairy pieces (the descent's "Fairy pieces from depth"):
    // two classic pieces, as strong as the depth allows. Never a King: with
    // a royal King, a second one would be a second way to lose.
    const cap = 3.5 + run.depth * 0.8;
    const classic = findable(veto).filter((k) => PIECES[k].kind === 'classic' && !['pawn', 'king'].includes(k));
    const near = classic.filter((k) => powerOf(k) <= cap);
    const pool = near.length >= 2 ? near : classic;
    const a = pick(pool), b = pick(pool.filter((k) => k !== a)) || a;
    return [{ kind: 'piece', type: a }, ...(b !== a ? [{ kind: 'piece', type: b }] : [])];
  }
  if (run.hand.length < run.maxPieces) {
    // Matched by power on the board the descent plays on (power.js), not
    // by a strength measured on an empty 8 by 8 board.
    const all = findable(veto), cap = 2.5 + run.depth * 0.6;
    const fairy = all.filter((k) => PIECES[k].kind === 'fairy' && powerOf(k) <= cap);
    const f = pick(fairy.length ? fairy : all);
    const classic = all.filter((k) => PIECES[k].kind === 'classic' && k !== 'pawn');
    const gap = (k) => Math.abs(powerOf(k) - powerOf(f));
    const best = Math.min(...classic.map(gap));
    return [{ kind: 'piece', type: pick(classic.filter((k) => gap(k) <= best + 0.75)) }, { kind: 'piece', type: f }];
  }
  const cards = [];
  const suitless = run.hand.filter((h) => !h.suit);
  if (suitless.length) cards.push({ kind: 'suit', suit: pick(Object.keys(SUITS)) });
  if (run.hand.length >= 2) cards.push({ kind: 'fuse' });
  // Promotion is no longer offered (2026-10-09): the next piece up in
  // strength was often no upgrade where it plays (a rook to a cannon).
  // Claiming and combining (below) took its place.
  const jokers = Object.keys(JOKERS).filter((j) => !run.jokers.includes(j));
  if (jokers.length) cards.push({ kind: 'joker', joker: pick(jokers) });
  // Three at most, the dice choosing which if there are more.
  while (cards.length > 3) cards.splice(Math.floor(rand() * cards.length), 1);
  return cards;
}

/** Apply a reward. `targets` are hand indexes it applies to (a suit or a
    promotion: one; fusing: two). Mutates the run. */
export function applyReward(run, card, targets = [], veto = []) {
  if (card.kind === 'piece') run.hand.push({ base: card.type });
  if (card.kind === 'suit') {
    const h = run.hand[targets[0]];
    h.suit = card.suit;
    if (card.suit === 'hearts') h.lives = 2;
  }
  if (card.kind === 'promote') {
    const h = run.hand[targets[0]], up = promotion(h.base, veto);
    if (up) h.base = up;
  }
  if (card.kind === 'fuse') {
    const [a, b] = targets.map((i) => run.hand[i]);
    const one = { base: a.base, fused: [...(a.fused || [a.base]), ...(b.fused || [b.base])].slice(0, 3),
      suit: a.suit || b.suit, lives: Math.max(a.lives || 1, b.lives || 1) };
    run.hand = run.hand.filter((h, i) => !targets.includes(i));
    run.hand.push(one);
  }
  if (card.kind === 'joker') run.jokers.push(card.joker);
}

/** Plain words for a reward card. */
export function cardText(card) {
  if (card.kind === 'piece') return { title: PIECES[card.type].name, text: PIECES[card.type].desc, tag: PIECES[card.type].kind === 'fairy' ? 'A fairy piece' : 'A classic piece' };
  if (card.kind === 'suit') return { title: `${SUITS[card.suit].mark} ${SUITS[card.suit].name}`, text: SUITS[card.suit].desc + ' Choose a piece to give it to.', tag: 'A suit' };
  if (card.kind === 'fuse') return { title: 'Fuse', text: 'Two of your pieces become one, with every move of both. It frees a slot for a new find.', tag: 'An item' };
  if (card.kind === 'promote') return { title: 'Promotion', text: 'One of your pieces becomes the next piece up in strength.', tag: 'An item' };
  return { title: JOKERS[card.joker].name, text: JOKERS[card.joker].desc, tag: 'A joker, for the rest of the run' };
}

// --- A run's hand, as level settings. -------------------------------------

/** The hand as `hand`, `handMods` and `invented` for a level's settings,
    with the jokers that are rules. */
export function handSettings(run) {
  const types = [], mods = [];
  for (const h of run.hand) {
    const { type } = pieceOf(h, run.made);
    types.push(type);
    mods.push({ ...(h.lives > 1 ? { lives: h.lives } : {}), ...(h.suit ? { suit: h.suit } : {}) });
  }
  registerInvented(run.made);
  return {
    hand: types, handMods: mods, ...(run.made.length ? { invented: run.made } : {}),
    ...(run.jokers.includes('double') ? { movesPerTurn: 2 } : {}), ...(run.jokers.includes('lazy') ? { lazyFoes: true } : {})
  };
}

/** A new run of the descent. */
export function newRun(start = ['knight', 'bishop', 'rook', 'king'], maxPieces = 6) {
  return { depth: 1, hand: start.map((base) => ({ base })), maxPieces, jokers: [], made: [], caught: [], lost: [], found: [] };
}

/** After a level: pieces taken are gone, hearts spent stay spent. */
export function afterLevel(run, end) {
  const keep = [];
  run.hand.forEach((h, i) => {
    const p = end.pieces[i];
    if (!p || p.taken) { run.lost.push(h); return; }
    keep.push({ ...h, ...(h.lives > 1 ? { lives: p.lives ?? h.lives } : {}) });
  });
  run.hand = keep;
}

// --- What carries between descents (2026-10-08). ---------------------------
// Power used to reset with every run (docs/grove-modes.md, path audit).
// Two things now carry, and neither decays:
// - The roster: every piece a descent has ever found you. A new descent
//   deals its hand from the start pool and the roster together, and you
//   may swap any piece in it for another you have found.
// - Waystones, lit for good by the deepest you have reached. Each gives
//   every later descent a head start. Doing something new (going deeper) is
//   the only way to light one: no experience points, no grinding.

export const WAYSTONES = [
  { depth: 4, id: 'keepsake', name: 'A keepsake', text: 'Every descent starts with an upgrade of your choice.' },
  { depth: 7, id: 'extra', name: 'Another piece', text: 'Every descent starts with one more piece.' },
  { depth: 10, id: 'keepsake2', name: 'A second keepsake', text: 'Every descent starts with two upgrades of your choice.' }
];

/** The waystones lit by reaching `deepest`. */
export const litWaystones = (deepest = 0) => WAYSTONES.filter((w) => deepest >= w.depth);

/** Waystones newly lit by going from `before` to `after`. */
export const newlyLit = (before = 0, after = 0) => WAYSTONES.filter((w) => before < w.depth && after >= w.depth);

/** Pieces a new descent may start with: the start pool, then everything
    found since, without repeats or vetoed pieces. */
export function startChoices(startPool, roster = [], veto = []) {
  return [...new Set([...startPool, ...roster])].filter((k) => PIECES[k] && !veto.includes(k));
}

/** Upgrade cards for a keepsake: a suit or two, and a joker, as the hand
    allows. Never a piece (the hand is dealt already) and never fusing (it
    would undo the deal). */
export function keepsakeCards(run, rand, veto = [], jokers = true) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const cards = [{ kind: 'suit', suit: pick(Object.keys(SUITS)) }];
  const free = Object.keys(JOKERS).filter((j) => !run.jokers.includes(j));
  if (jokers && free.length) cards.push({ kind: 'joker', joker: pick(free) });
  // A second suit, different from the first, if there is room for one.
  if (cards.length < 3) cards.push({ kind: 'suit', suit: pick(Object.keys(SUITS).filter((k) => k !== cards[0].suit)) });
  return cards.slice(0, 3);
}

// --- The autochess shop (2026-10-08). --------------------------------------
// Autochess earns acorns, round by round, and spends them between rounds;
// the descent keeps chosen rewards (no currency there, on purpose).

/** Acorns for a round: three for a win, one for a loss, one more for each
    piece of theirs taken. */
export const acornsFor = (won, taken = 0) => (won ? 3 : 1) + taken;

/** What a card costs in the shop. */
export function priceOf(card) {
  if (card.kind === 'piece') return Math.max(2, Math.round(powerOf(card.type)));
  return { suit: 4, promote: 4, fuse: 3, joker: 5 }[card.kind] ?? 3;
}

/** The shop's shelf: two pieces (if there is room), a suit, fusing and a
    joker, as the hand and the settings allow. */
export function shopStock(run, rand, { veto = [], findPool = null, jokers = false } = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const out = [];
  if (run.hand.length < run.maxPieces) {
    const all = findable(veto).filter((k) => !findPool || findPool.includes(k)), cap = 3 + run.depth * 0.5;
    const near = all.filter((k) => powerOf(k) <= cap);
    const pool = near.length >= 2 ? near : all;
    const a = pick(pool), b = pick(pool.filter((k) => k !== a)) || a;
    out.push({ kind: 'piece', type: a });
    if (b !== a) out.push({ kind: 'piece', type: b });
  }
  if (run.hand.some((h) => !h.suit)) out.push({ kind: 'suit', suit: pick(Object.keys(SUITS)) });
  if (run.hand.length >= 2) out.push({ kind: 'fuse' });
  const free = Object.keys(JOKERS).filter((j) => !run.jokers.includes(j));
  if (jokers && free.length) out.push({ kind: 'joker', joker: pick(free) });
  return out;
}

// --- Claiming and combining (2026-10-09). -----------------------------------
// Timothy: "when you capture pieces, you actually claim their corresponding
// rabbit or piece, and then you can use that piece to combine with a piece
// you already have." What a combination gives is a proposal:
// - the same kind (their bishop on your bishop): a veteran, one heart more
//   (a life), up to three;
// - another kind: the two fuse, your piece gaining every move of theirs
//   (their rook on your knight makes a chancellor);
// - your royal King only takes its own kind, so it is never fused away.
// Pieces claimed on a level and not used are gone when the next one starts.

/** Can a claimed piece go onto hand piece h? */
export function canCombine(h, type, royal = false) {
  if (!h || !PIECES[type]) return false;
  const bases = h.fused || [h.base];
  if (bases.length === 1 && h.base === type) return (h.lives || 1) < 3;
  if (royal && h.base === 'king' && !h.fused) return false;
  return bases.length < 3 && !bases.includes(type);
}

/** Combine claimed piece `type` onto hand piece `i`. Mutates the run. */
export function applyCombine(run, i, type) {
  const h = run.hand[i], bases = h.fused || [h.base];
  if (bases.length === 1 && h.base === type) { h.lives = Math.min(3, (h.lives || 1) + 1); return 'veteran'; }
  run.hand[i] = { ...h, base: bases[0], fused: [...bases, type] };
  return 'fused';
}

/** Plain words for combining claimed `type` onto hand piece h. */
export function combineText(h, type, made = []) {
  const bases = h.fused || [h.base];
  if (bases.length === 1 && h.base === type) return `Your ${PIECES[type].name} becomes a veteran: one heart more (${(h.lives || 1) + 1} lives).`;
  const after = pieceOf({ ...h, fused: [...bases, type] }, made.slice());
  return `Your ${pieceOf(h, made.slice()).name} gains every move of their ${PIECES[type].name}, and becomes the ${after.name}.`;
}

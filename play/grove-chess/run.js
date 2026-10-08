// A run: the descent's hand of pieces and what happens to it between
// levels (Timothy, 2026-10-08). No page code here, so it can be tested.
//
// Your hand starts with four pieces and grows by one for each level you
// finish, up to six. A piece taken is gone for good, which opens its slot
// again. Once the hand is full, finishing a level offers upgrades instead:
//
// - Suits, one per piece, each changing it, and its name:
//   Hearts, a second life ("Knight of Hearts": the first capture costs the
//   heart, and the attacker bounces off). Swords, one more step in any
//   direction for close fighting (a knight of swords is knight and king:
//   the old centaur). Stars, its leaps keep going (a knight becomes a
//   nightrider; a piece that already slides gains a knight's jump).
//   Diamonds, diamond-hard: only a piece at least as strong can take it.
//   Spirals (2026-10-08, Timothy named it; what it does is a proposal):
//   its leaps curl on round a circle, the rose's way (Betza q), so a knight
//   of spirals is a rose; a piece with no leaps gains the rose's move.
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

export const SUITS = {
  hearts: { name: 'Hearts', mark: '♥', colour: '#e0445a', desc: 'A second life: the first time it is taken it loses the heart instead, and whatever took it bounces off.' },
  swords: { name: 'Swords', mark: '♠', colour: '#7f9fc0', desc: 'One more step, in any direction, for close fighting.' },
  stars: { name: 'Stars', mark: '★', colour: '#e8c547', desc: 'Its leaps keep going in a line; a piece that already slides gains a knight’s jump.' },
  diamonds: { name: 'Diamonds', mark: '♦', colour: '#5fd0d8', desc: 'Diamond-hard: only a piece at least as strong can take it.' },
  spirals: { name: 'Spirals', mark: '@', colour: '#f0903a', desc: 'Its leaps curl on round a circle, like the rose’s; a piece with no leaps gains the rose’s whole move.' }
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

/** A code with its suit's change made. */
export function suitBetza(code, suit) {
  if (suit === 'swords') return unionBetza(code, 'K');
  if (suit === 'stars') {
    const terms = parseBetza(code);
    if (terms.every((t) => t.ride || t.mods.includes('q'))) return unionBetza(code, 'N');
    return write(terms.map((t) => (!t.mods.includes('q') && ATOM[`${t.jump[0]},${t.jump[1]}`] ? { ...t, ride: true } : t)));
  }
  if (suit === 'spirals') {
    // Only leaps that move and capture alike curl; a piece with none gains
    // the rose's move (qN).
    const terms = parseBetza(code), curls = (t) => !t.ride && !t.mods && !t.dirs;
    if (!terms.some(curls)) return unionBetza(code, 'qN');
    return write(terms.map((t) => (curls(t) ? { ...t, mods: 'q' } : t)));
  }
  return code;
}

/** The real piece, if any, that moves exactly like a code. */
function sameAs(code) {
  const mine = betzaMoves(code), probe = [[3, 3], [0, 0], [1, 4], [5, 2]];
  const sig = (moves) => probe.map(([x, y]) => moves((a, b) => (a < 0 || b < 0 || a > 7 || b > 7 ? 0 : 1), { x, y }, 1).map((m) => `${m.x},${m.y}`).sort().join(' ')).join('|');
  const want = sig(mine);
  return Object.keys(PIECES).find((k) => PIECES[k].betza && !PIECES[k].invented && k !== 'rabbit' && k !== 'ball' && sig(PIECES[k].moves) === want) || null;
}

// --- Hand pieces. ----------------------------------------------------------
// { base, suit, lives, diamond, fused: [base, base] }. `pieceOf` gives the
// piece it plays as: its type (a real piece, or a made one), its name, and
// any made pieces that must be registered (and carried in settings).

export function pieceOf(h, made = []) {
  const bases = h.fused || [h.base];
  let code = bases.map((b) => PIECES[b]?.betza || 'W').reduce((a, b) => unionBetza(a, b));
  code = suitBetza(code, h.suit);
  const real = sameAs(code);
  const baseName = h.fused ? (real && !h.suit ? PIECES[real].name : bases.map((b) => PIECES[b].name).join('-')) : PIECES[h.base].name;
  const name = h.suit ? `${baseName} of ${SUITS[h.suit].name}` : baseName;
  let type = real;
  if (!type || (h.suit && h.suit !== 'hearts' && h.suit !== 'diamonds' && real !== h.base)) {
    // A made piece: named for what it became, looking like what it was.
    type = real && !h.fused && (h.suit === 'hearts' || h.suit === 'diamonds') ? real : null;
    if (!type) {
      const found = made.find((p) => p.betza === code && p.name === name);
      const id = found?.id || newId(name, new Set([...Object.keys(PIECES), ...made.map((p) => p.id)]));
      if (!found) made.push({ id, name, betza: code, look: bases[0], desc: `${name}: ${code}.`, made: true });
      type = id;
    }
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
  return (P?.strength ?? estimateStrength(P.betza)) + (h.lives > 1 ? 1 : 0) + (h.diamond ? 0.75 : 0);
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
export function rewardsFor(run, rand, veto = []) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  if (run.hand.length < run.maxPieces) {
    const all = findable(veto), cap = 2.5 + run.depth * 0.6;
    const fairy = all.filter((k) => PIECES[k].kind === 'fairy' && PIECES[k].strength <= cap);
    const f = pick(fairy.length ? fairy : all);
    const classic = all.filter((k) => PIECES[k].kind === 'classic' && k !== 'pawn');
    const gap = (k) => Math.abs(PIECES[k].strength - PIECES[f].strength);
    const best = Math.min(...classic.map(gap));
    return [{ kind: 'piece', type: pick(classic.filter((k) => gap(k) <= best + 0.75)) }, { kind: 'piece', type: f }];
  }
  const cards = [];
  const suitless = run.hand.filter((h) => !h.suit);
  if (suitless.length) cards.push({ kind: 'suit', suit: pick(Object.keys(SUITS)) });
  if (run.hand.length >= 2) cards.push({ kind: 'fuse' });
  if (run.hand.some((h) => !h.fused && promotion(h.base, veto))) cards.push({ kind: 'promote' });
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
    if (card.suit === 'diamonds') h.diamond = true;
  }
  if (card.kind === 'promote') {
    const h = run.hand[targets[0]], up = promotion(h.base, veto);
    if (up) h.base = up;
  }
  if (card.kind === 'fuse') {
    const [a, b] = targets.map((i) => run.hand[i]);
    const one = { base: a.base, fused: [...(a.fused || [a.base]), ...(b.fused || [b.base])].slice(0, 3),
      suit: a.suit || b.suit, lives: Math.max(a.lives || 1, b.lives || 1), diamond: !!(a.diamond || b.diamond) };
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
    mods.push({ ...(h.lives > 1 ? { lives: h.lives } : {}), ...(h.diamond ? { diamond: true } : {}), ...(h.suit ? { suit: h.suit } : {}) });
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

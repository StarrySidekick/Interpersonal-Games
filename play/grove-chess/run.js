// A run: the descent's hand of pieces and what happens to it between
// levels (Timothy, 2026-10-08). No page code here, so it can be tested.
//
// Your hand starts with four pieces and grows by one for each level you
// finish, up to six. A piece taken is gone for good, which opens its slot
// again. Once the hand is full, finishing a level offers upgrades instead:
//
// - Suits, one per piece, each a rule the piece carries (Timothy chose
//   them, 2026-10-08, and replaced them, 2026-10-13; rules.js plays them):
//   Hearts, a life more (taken, it goes back to your first row, on a square
//   you choose). Spirals, it goes round the left and right edges, like
//   Pac-Man. Gears, swap: it may trade squares with any other piece of
//   yours, as its move (this was Spirals). Stars, it moves twice: once a
//   level, its first move is followed by another. Vines, chain captures:
//   after it takes a piece it may take again, the same turn (this was
//   Swords). Diamonds and Spirits are gone.
// - Weapons (2026-10-13), one per piece as well as its suit, at level 1 to
//   3: a Sword, a Lance or a Mace (rules.js, "Weapons").
// - Fusing two pieces into one with both their moves (a rook and a knight
//   make the chancellor). It frees a slot.
// - Promotion: a piece becomes the next piece up in strength.
// - Jokers, rules for the rest of the run, in the spirit of Balatro's:
//   Double Time, Foresight, Recruiter, Lazy Rabbits, Overtime.
//
// Changing a piece's moves makes a new piece out of its Betza code
// (invented.js), so everything else (drawing, diagrams, the solver) works
// on it unchanged.

import { PIECES, canArm, rabbitIn } from './rules.js';
import { parseBetza, betzaMoves } from './betza.js';
import { registerInvented, newId, estimateStrength } from './invented.js';
import { powerOf } from './power.js';

// Suits (Adventure since 2026-10-16, Timothy: "suit defines other perks
// (health, ability to leave pieces, etc). they also apply about the same
// for player and enemy pieces now"): `advDesc` is the suit in Adventure, on
// either side; `desc` is the suit as every other mode has it. Colours from
// the same day: hearts red, vines green, stars yellow, spirals purple, gears
// copper. Stone is gone.
export const SUITS = {
  hearts: { name: 'Hearts', mark: '♥', colour: '#e0445a', desc: 'A life more: when it is taken it goes back to your first row instead, on a free square you choose (the second row if the first is full, and so on), and the heart is spent.',
    advDesc: 'Two lives. Hit once, it stays where it is and its heart is spent, and the piece that hit it goes back where it came from.' },
  spirals: { name: 'Spirals', mark: '@', colour: '#a77bdc', desc: 'Round the sides: off the left edge it comes back on at the right, and the other way, like Pac-Man.',
    advDesc: 'Chain captures: after it takes a piece it may take another, and another, as long as it can. A heart that holds ends it.' },
  gears: { name: 'Gears', mark: '⚙', colour: '#c47a45', desc: 'Swap: as its move, it can trade squares with any other piece of yours.',
    advDesc: 'As its move, it can trade squares with any other piece on the board.' },
  stars: { name: 'Stars', mark: '★', colour: '#e8c547', desc: 'Moves twice: once a level, its first move is followed straight away by a second.',
    advDesc: 'Two moves every turn it goes, but it takes at most once: if the first move takes something, the second cannot.' },
  vines: { name: 'Vines', mark: '❦', colour: '#3f9e45', desc: 'Chain captures: after it takes a piece, it may take another the same turn, and another after that.',
    advDesc: 'Leaves a vine on the square it moves off and every square it passes. A piece of the other side that moves onto or through one of them on its next turn is caught there; then the vines wither.' }
};
/** The suits every mode deals. */
export const SUIT_KINDS = Object.keys(SUITS);

/** The kinds of rabbit (Adventure, 2026-10-16, Timothy: "rabbit defines
    move behavior. rabbits have a type and a suit now. the lore is that
    rabbits are eating playing cards and that's why they have a suit"):
    each with its colour (the plinth of a piece it is in, and its loop),
    what it does in a piece of theirs (`desc`) and in one of yours
    (`mine`). */
export const RABBITS = {
  robot: { name: 'Robot', colour: '#ef8d32', word: 'tangerine',
    desc: 'Walks a short loop of its piece\u2019s own moves, a step every turn. Its next square is framed in its colour: stand there and it takes you.',
    mine: 'Walks there and back by itself along its shortest move toward the nearest of theirs, taking what it steps onto.' },
  sentry: { name: 'Sentry', colour: '#d94a3d', word: 'red',
    desc: 'Never walks, but takes anything of yours standing in its reach (ringed red) when their turn ends, striking from where it stands.',
    mine: 'Every turn takes the most valuable piece of theirs in its reach, striking from where it stands.' },
  scared: { name: 'Scared', colour: '#7fd3e6', word: 'sky blue',
    desc: 'Stands still; when you attack it, it runs to a square you do not attack. Their side can save only one a turn, so attack two at once (a fork), or pin it. A gold ring means it could not run.',
    mine: 'When they could take it, it runs to a square they do not reach.' },
  sentient: { name: 'Sentient', colour: '#3a3550', word: 'ink',
    desc: 'Thinks one move ahead, like a simple chess player: it moves every turn, takes what it can, and keeps out of your reach.',
    mine: 'Plays by itself every turn, one move ahead: it takes what it can and keeps out of their reach.' },
  // Two more (Timothy, 2026-10-16): "simple - just moves once, all the way
  // if it's a slider and one hop for a leaper"; "trap - sentry but doesn't
  // move back to its new spot".
  simple: { name: 'Simple', colour: '#9ccf3c', word: 'lime',
    desc: 'Makes one move a turn along one line, toward you: all the way if its piece slides, one hop if it leaps. At the end of its line it turns back. Its line is drawn, its next square framed: stand anywhere on the line and it stops there and takes you.',
    mine: 'Makes one move a turn along one line toward the nearest of theirs: all the way if it slides, one hop if it leaps, taking what it stops on; at the end of its line it turns back.' },
  trap: { name: 'Trap', colour: '#d6489a', word: 'magenta',
    desc: 'Never walks, but takes anything of yours in its reach (ringed) when their turn ends, as a sentry does, and then stays on the square it took.',
    mine: 'Every turn takes the most valuable piece of theirs in its reach, as a sentry does, and stays on the square it took.' }
};
/** "Robot rabbit of Spirals". */
export const rabbitName = (r, suit = null) => `${RABBITS[r]?.name || 'A'} rabbit${SUITS[suit] ? ` of ${SUITS[suit].name}` : ''}`;

/** Weapons (Timothy, 2026-10-13), each at level 1 to 3. `desc(lv)` says
    what it does at that level. A lance only on a piece that slides. */
export const WEAPONS = {
  sword: { name: 'Sword', mark: '†', colour: '#d4dbe3', desc: (lv) => `Strikes instead of landing: it cannot move onto a piece, but takes what stands ${['', 'in front of', 'in front of or beside', 'in front of, beside or diagonally in front of'][lv]} where it lands.`,
    // Adventure's way (2026-10-15): aiming the way it moves
    // (rules.swordAims). It squashed as well until 2026-10-17 (Timothy: "no
    // squashing for sword or lance either").
    advDesc: (lv) => `It cannot land on a piece of theirs. Landing on an empty square, it strikes the next square past it, in the direction it moved${['', '', ', and the squares to either side of that', ', the squares to either side, and the two between'][lv]}, taking what stands there.` },
  lance: { name: 'Lance', mark: '↟', colour: '#c9a46a', desc: (lv) => `Takes what it slides through, up to ${['', 'one piece', 'two pieces', 'three pieces'][lv]}, and lands on an empty square beyond; it cannot move onto a piece. Only on a piece that slides.`,
    advDesc: (lv) => `It cannot land on a piece of theirs; it slides through up to ${['', 'one piece', 'two pieces', 'three pieces'][lv]} of theirs, taking each, and lands on an empty square beyond. Only on a piece that slides.` },
  mace: { name: 'Mace', mark: '✸', colour: '#a07a5a', desc: (lv) => `Sliding, it pushes up to ${['', 'one piece', 'two pieces', 'three pieces'][lv]} ahead of it; theirs it pushes are stunned, and one already stunned is taken. Stepping or leaping, it stuns what stands ${['', 'in front of and behind', 'round the sides of', 'all round'][lv]} where it lands. A stunned piece misses its next turn.`,
    // Adventure's (2026-10-16, Timothy: "mace - still stuns and no longer
    // pushes anything, just adds the AOE stun to the landing").
    advDesc: (lv) => `It can squash, as any piece can. Wherever it lands it stuns the pieces of theirs ${['', 'in front of it and behind it', 'in front of it, behind it and to each side', 'all round it'][lv]}: a stunned piece sits out their next turn.` },
  // Adventure's own (2026-10-16, Timothy: "shield (new) - pushes pieces, can
  // still squash. just the push. if the piece is pushed off the board it is
  // captured"; 2026-10-17: "always push, no squashing anymore").
  shield: { name: 'Shield', mark: '⛨', colour: '#8fa6bd', adventure: true,
    desc: (lv) => `It never squashes: moving onto a piece of theirs, it pushes it one square on, the way it moved, and takes its square.${lv > 1 ? ` Up to ${['', '', 'two', 'three'][lv]} pieces in a row go together.` : ''} A piece pushed off the board is taken; one with nowhere to go cannot be moved onto.`,
    // 2026-10-17 (Timothy): what it pushes slides on until it hits something.
    advDesc: (lv) => `It never squashes: moving onto a piece of theirs, it pushes it, and the piece slides on the way it was pushed until something stops it.${lv > 1 ? ` Up to ${['', '', 'two', 'three'][lv]} pieces in a row slide together.` : ''} Into another piece: both are stunned. Off the edge: it falls and is taken. One that cannot move at all cannot be pushed.` },
  // Adventure only (Timothy, 2026-10-15: "new weapon/tool: net (like a bug
  // net) using it captures the piece you capture, and you just get it
  // without having to collect 3 of them"). Once a board per level, so a
  // net fills your collection a piece a board, not a whole board's worth.
  net: { name: 'Net', mark: '◍', colour: '#8c6f45', adventure: true,
    desc: (lv) => `Only your cat can carry it. It moves as it always does, but the first ${['', 'piece', 'two pieces', 'three pieces'][lv]} of theirs it takes on each board ${lv > 1 ? 'are' : 'is'} netted whole: ${lv > 1 ? 'each' : 'it'} joins your set when the board ends, and the rabbit inside, if there is one, is yours to put in a piece of your choosing.` }
};
/** The weapons every mode deals; Adventure deals the net as well. */
export const WEAPON_ORDER = Object.keys(WEAPONS).filter((w) => !WEAPONS[w].adventure);
/** A suit's or weapon's words, the Adventure way (`adv`: one piece on the
    board taking turns, a sword that aims) where they differ. */
export const suitDesc = (suit, adv = false) => (adv && SUITS[suit].advDesc) || SUITS[suit].desc;
export const weaponDesc = (w, lv, adv = false) => (adv && WEAPONS[w].advDesc ? WEAPONS[w].advDesc(lv) : WEAPONS[w].desc(lv));
/** A weapon's name with its level: "Sword 2". */
export const weaponName = (w, lv = 1) => `${WEAPONS[w].name} ${lv}`;
/** What a piece on the board carries, in words, for tapping it: its suit,
    its weapon, and whether it is stunned. Starts with a space, or is empty. */
export function carriesText(p, adv = false) {
  const bits = [];
  if (SUITS[p.suit]) bits.push(`${SUITS[p.suit].mark} ${SUITS[p.suit].name}: ${suitDesc(p.suit, adv)}${p.suit === 'hearts' && (p.lives || 1) < 2 ? ' (Spent.)' : ''}`);
  if (WEAPONS[p.weapon]) bits.push(`${WEAPONS[p.weapon].mark} ${weaponName(p.weapon, p.wl || 1)}: ${weaponDesc(p.weapon, p.wl || 1, adv)}`);
  if (p.shape && PIECES[p.shape]) bits.push(`In the shape of a ${PIECES[p.shape].name}: it moves like one until it takes something else.`);
  if (p.role && PIECES[p.role]) bits.push(`Playing the part of a ${PIECES[p.role].name.toLowerCase()} now: it moves like one until it moves again.`);
  if (RABBITS[p.rabbit]) bits.push(`${rabbitName(p.rabbit)}: ${RABBITS[p.rabbit].mine}`);
  if (p.stun) bits.push('Stunned: it sits out its side’s next turn.');
  return bits.length ? ' ' + bits.join(' ') : '';
}

export const JOKERS = {
  double: { name: 'Double Time', desc: 'You move twice for every move of theirs.' },
  foresight: { name: 'Foresight', desc: 'You see where every rabbit will go next.' },
  recruiter: { name: 'Recruiter', desc: 'The first piece you take on each level joins you, if you have room.' },
  lazy: { name: 'Lazy Rabbits', desc: 'They only move every other turn.' },
  overtime: { name: 'Overtime', desc: 'Five more moves on every level.' }
};

// --- Betza, rewritten. -----------------------------------------------------

const ATOM = { '1,0': 'W', '1,1': 'F', '2,0': 'D', '2,1': 'N', '2,2': 'A', '3,0': 'H', '3,1': 'C', '3,2': 'Z', '3,3': 'G' };

/** Terms back to Betza text. Terms with no modifiers go first: written
    after another term, a bare atom could merge with it ("cfF" then "F"
    reads as "cfFF", a capture-only rider; found 2026-10-12). After them,
    every term starts with a small letter, so nothing merges. */
function write(terms) {
  return [...terms.filter((t) => !(t.mods + t.dirs)), ...terms.filter((t) => t.mods + t.dirs)].map((t) => {
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
  const name = (h.suit && SUITS[h.suit] ? `${plain} of ${SUITS[h.suit].name}` : plain) + (WEAPONS[h.weapon] ? `, ${weaponName(h.weapon, h.wl)}` : '');
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
  return (P?.strength ?? estimateStrength(P.betza)) + (h.lives > 1 ? 1 : 0) + (h.suit && h.suit !== 'hearts' ? 0.5 : 0) + (h.weapon ? 0.5 * (h.wl || 1) : 0);
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
  if (suitless.length) cards.push({ kind: 'suit', suit: pick(SUIT_KINDS) });
  const w = weaponCard(run, rand);
  if (w) cards.push(w);
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
    if (card.suit === 'hearts') h.lives = Math.max(2, h.lives || 1);
  }
  if (card.kind === 'weapon') armHand(run.hand[targets[0]], card.weapon);
  // A rabbit (Adventure, 2026-10-16): into the piece, and its suit too if
  // the piece has none.
  if (card.kind === 'rabbit') {
    const h = run.hand[targets[0]];
    h.rabbit = card.rabbit;
    if (card.suit && SUITS[card.suit] && !h.suit) { h.suit = card.suit; if (card.suit === 'hearts') h.lives = Math.max(2, h.lives || 1); }
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
export function cardText(card, adv = false) {
  if (card.kind === 'piece') return { title: PIECES[card.type].name, text: `${PIECES[card.type].desc}${adv ? ' It joins your deck.' : ''}`, tag: PIECES[card.type].kind === 'fairy' || PIECES[card.type].kind === 'troupe' ? 'A fairy piece' : 'A classic piece' };
  if (card.kind === 'suit') return adv
    ? { title: `${SUITS[card.suit].mark} ${SUITS[card.suit].name} rabbit`, text: suitDesc(card.suit, adv) + ' Choose a piece to put it in.', tag: 'A rabbit' }
    : { title: `${SUITS[card.suit].mark} ${SUITS[card.suit].name}`, text: suitDesc(card.suit, adv) + ' Choose a piece to give it to.', tag: 'A suit' };
  if (card.kind === 'rabbit') return { title: rabbitName(card.rabbit, card.suit), text: `${RABBITS[card.rabbit].mine}${card.suit ? ` It brings ${SUITS[card.suit].name} with it, to a piece with no suit.` : ''} Choose a piece to put it in.`, tag: 'A rabbit' };
  if (card.kind === 'weapon') return { title: `${WEAPONS[card.weapon].mark} ${WEAPONS[card.weapon].name}`, text: `${weaponDesc(card.weapon, 1, adv)} Choose a piece to give it to; on one that has a ${WEAPONS[card.weapon].name.toLowerCase()} already, it goes up a level (to 3 at most).`, tag: 'A weapon' };
  if (card.kind === 'fuse') return { title: 'Fuse', text: 'Two of your pieces become one, with every move of both. It frees a slot for a new find.', tag: 'An item' };
  if (card.kind === 'promote') return { title: 'Promotion', text: 'One of your pieces becomes the next piece up in strength.', tag: 'An item' };
  return { title: JOKERS[card.joker].name, text: JOKERS[card.joker].desc, tag: 'A joker, for the rest of the run' };
}

// --- A run's hand, as level settings. -------------------------------------

/** The hand as `hand`, `handMods` and `invented` for a level's settings,
    with the jokers that are rules. */
/** What a hand piece carries, for a level: hearts, suit, weapon. */
const modOf = (h) => ({ ...(h.lives > 1 ? { lives: h.lives } : {}), ...(h.suit ? { suit: h.suit } : {}), ...(h.weapon ? { weapon: h.weapon, wl: h.wl || 1 } : {}), ...(h.row === 1 ? { row: 1 } : {}), ...(h.rabbit ? { rabbit: h.rabbit } : {}) });

export function handSettings(run, pick = null) {
  const types = [], mods = [];
  // Adventure's set for this board (adventureSet), or the whole hand.
  for (const h of pick ? pick.map((i) => run.hand[i]) : run.hand) {
    const { type } = pieceOf(h, run.made);
    types.push(type);
    mods.push(modOf(h));
  }
  // Their lineup, when they carry one (2026-10-12), and a Rabbit with it.
  const foe = {};
  if (run.foes) {
    foe.foeHand = []; foe.foeMods = [];
    for (const h of run.foes) {
      foe.foeHand.push(pieceOf(h, run.made).type);
      foe.foeMods.push(modOf(h));
    }
    if (run.foeRabbit) { foe.foeHand.push('bunny'); foe.foeMods.push({}); }
  }
  registerInvented(run.made);
  return {
    ...foe, hand: types, handMods: mods, ...(run.made.length ? { invented: run.made } : {}),
    ...(run.jokers.includes('double') ? { movesPerTurn: 2 } : {}), ...(run.jokers.includes('lazy') ? { lazyFoes: true } : {})
  };
}

/** A new run of the descent. `foes`, when given, is their lineup: they
    carry one down too, and it gets upgrades as yours does (2026-10-12). */
export function newRun(start = ['knight', 'bishop', 'rook', 'king'], maxPieces = 6, foes = null) {
  return { depth: 1, hand: start.map((base) => ({ base })), maxPieces, jokers: [], made: [], caught: [], lost: [], found: [],
    ...(foes ? { foes: foes.map((base) => ({ base })), foeRabbit: true } : {}) };
}

/** After a level: pieces taken are gone, hearts spent stay spent, and a
    pawn that became a copy of another piece (2026-10-13) stays that piece. */
export function afterLevel(run, end) {
  const keep = [];
  run.hand.forEach((h, i) => {
    const p = end.pieces[i];
    if (!p || p.taken) { run.lost.push(h); return; }
    keep.push({ ...h, ...(h.lives > 1 ? { lives: p.lives ?? h.lives } : {}), ...(p.promoted && PIECES[p.type] ? { base: p.type, fused: undefined } : {}), ...(p.promoted && !p.weapon ? { weapon: undefined, wl: undefined } : {}) });
  });
  run.hand = keep;
}

/** The type a hand piece plays as, for weapons: a lance only on one that
    slides. */
const typeOf = (h, made) => pieceOf(h, made.slice()).type;
/** Can hand piece h take weapon w: one it can carry, and either none yet or
    the same one below level 3? */
export const canTakeWeapon = (h, w, made = []) => canArm(typeOf(h, made), w) && (!h.weapon || (h.weapon === w && (h.wl || 1) < 3));
/** Give hand piece h weapon w, or a level more of the one it has. Mutates. */
export function armHand(h, w) {
  if (h.weapon === w) h.wl = Math.min(3, (h.wl || 1) + 1);
  else { h.weapon = w; h.wl = 1; }
}
/** A weapon card some piece of the hand could take, or null. */
function weaponCard(run, rand) {
  const ok = WEAPON_ORDER.filter((w) => run.hand.some((h) => canTakeWeapon(h, w, run.made)));
  return ok.length ? { kind: 'weapon', weapon: ok[Math.floor(rand() * ok.length)] } : null;
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
  const cards = [{ kind: 'suit', suit: pick(SUIT_KINDS) }];
  const w = weaponCard(run, rand);
  if (w) cards.push(w);
  const free = Object.keys(JOKERS).filter((j) => !run.jokers.includes(j));
  if (jokers && free.length && cards.length < 3) cards.push({ kind: 'joker', joker: pick(free) });
  // A second suit, different from the first, if there is room for one.
  if (cards.length < 3) cards.push({ kind: 'suit', suit: pick(SUIT_KINDS.filter((k) => k !== cards[0].suit)) });
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
  return { suit: 4, weapon: 4, promote: 4, fuse: 3, joker: 5 }[card.kind] ?? 3;
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
  if (run.hand.some((h) => !h.suit)) out.push({ kind: 'suit', suit: pick(SUIT_KINDS) });
  const w = weaponCard(run, rand);
  if (w) out.push(w);
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
  // A rabbit is not fused with anything: its hops cannot be written down to
  // join another piece's (it has no Betza). Two rabbits still make a veteran.
  if ((type === 'bunny' || h.base === 'bunny' || h.fused?.includes('bunny')) && !(h.base === type && !h.fused)) return false;
  // Nor is a Changeling: what it can do changes as it plays.
  if ((type === 'changeling' || h.base === 'changeling' || h.fused?.includes('changeling')) && !(h.base === type && !h.fused)) return false;
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
export function combineText(h, type, made = [], whose = 'their') {
  const bases = h.fused || [h.base];
  if (bases.length === 1 && h.base === type) return `Your ${PIECES[type].name} becomes a veteran: one heart more (${(h.lives || 1) + 1} lives).`;
  const after = pieceOf({ ...h, fused: [...bases, type] }, made.slice());
  return `Your ${pieceOf(h, made.slice()).name} gains every move of ${whose} ${PIECES[type].name}, and becomes the ${after.name}.`;
}

// --- One upgrade a board, each side (2026-10-12). ---------------------------
// Timothy: "every new board you move to each side gets one random upgrade of
// two to choose from, whether it's a new piece to combine with your existing
// lineup or a new suit to apply to a piece, no more level 4-7-11 special
// upgrades." You choose one of two cards; they get one at random. A piece
// card combines with a piece already in the lineup (claiming's rule: the same
// kind makes a veteran with a heart more, another kind fuses), or, while the
// row has a gap from a piece you lost, takes the gap.

/** Suits their side can carry: all of them, from 2026-10-13 (Timothy:
    "enemy pieces should be able to receive all the different suits"). Their
    Vines and Stars take their extra move greedily (rules.js foeMove), and a
    Gears piece's swap is one of the moves their side thinks about. */
export const FOE_SUITS = SUIT_KINDS;

/** Pieces a board's piece card can be: findable, classic only while
    `fairy` is false, in `pool` if given, and never a King (a second King
    would be a second way to lose). */
function piecePool(veto, fairy, pool) {
  return findable(veto).filter((k) => k !== 'king' && k !== 'pawn' && (fairy || PIECES[k].kind === 'classic') && (!pool || pool.includes(k)));
}

/** Where a piece card of `type` can go in a lineup: hand indexes it
    combines with. */
export const mergeTargets = (hand, type, royal, made = []) => hand.map((h, i) => (canCombine(h, type, royal) && adds(h, type, made) ? i : -1)).filter((i) => i >= 0);

/** Does fusing `type` onto h change anything? A mao on a knight does not:
    every mao move is a knight move. (The same kind always adds a heart.) */
function adds(h, type, made) {
  const bases = h.fused || [h.base];
  if (bases.length === 1 && h.base === type) return true;
  const sig = (x) => { const p = pieceOf(x, made.slice()); return p.type in PIECES && !PIECES[p.type].invented ? p.type : p.code; };
  return sig(h) !== sig({ ...h, fused: [...bases, type] });
}

/** Your two cards for a new board (Timothy, 2026-10-13: "In the descent
    mode, you don't find anything but suits and weapons in your draft pick
    after each round, out of two"): each a suit or a weapon, at random, never
    the same twice, and only what some piece of yours can take. */
export function boardCards(run, rand) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const suits = run.hand.some((h) => !h.suit) ? SUIT_KINDS : [];
  const weapons = WEAPON_ORDER.filter((w) => run.hand.some((h) => canTakeWeapon(h, w, run.made)));
  const out = [];
  for (let n = 0; n < 12 && out.length < 2; n++) {
    const wantSuit = suits.length && (!weapons.length || rand() < 0.5);
    const card = wantSuit ? { kind: 'suit', suit: pick(suits) } : weapons.length ? { kind: 'weapon', weapon: pick(weapons) } : null;
    if (!card) break;
    if (!out.some((c) => c.kind === card.kind && c.suit === card.suit && c.weapon === card.weapon)) out.push(card);
  }
  return out;
}

/** Put piece card `type` on hand piece `i`, or into a gap in the row when
    `i` is -1. Mutates. Returns 'veteran', 'fused' or 'joined'. */
export function applyMerge(run, i, type) {
  if (i < 0) { run.hand.push({ base: type }); return 'joined'; }
  return applyCombine(run, i, type);
}

/** Their upgrade for a new board, at random, as yours: a suit on a piece
    without one, or a weapon (or a level more of one). Never their King.
    Mutates the run; returns plain words for it, or null if nothing could be
    given. */
export function foeUpgrade(run, rand) {
  if (!run.foes) return null;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const open = run.foes.map((h, i) => i).filter((i) => run.foes[i].base !== 'king' || run.foes[i].fused);
  const suitless = open.filter((i) => !run.foes[i].suit);
  for (let n = 0; n < 12; n++) {
    if (suitless.length && rand() < 0.5) {
      const i = pick(suitless), suit = pick(FOE_SUITS), before = pieceOf(run.foes[i], run.made).name;
      run.foes[i].suit = suit;
      if (suit === 'hearts') run.foes[i].lives = Math.max(2, run.foes[i].lives || 1);
      return `their ${before} takes ${SUITS[suit].name}: ${SUITS[suit].desc.split(':')[0].toLowerCase()}`;
    }
    const w = pick(WEAPON_ORDER), at = open.filter((i) => canTakeWeapon(run.foes[i], w, run.made));
    if (!at.length) continue;
    const i = pick(at), before = pieceOf(run.foes[i], run.made).name;
    armHand(run.foes[i], w);
    return `their ${before} takes ${run.foes[i].wl > 1 ? 'a level more of its' : 'a'} ${WEAPONS[w].name.toLowerCase()}${run.foes[i].wl > 1 ? ` (${run.foes[i].wl})` : ''}`;
  }
  return null;
}

/** Can some piece of theirs take this card (Tile Chess)? Never their King,
    unless it is fused into something else. */
export function foeCanUse(run, card) {
  const open = (run.foes || []).filter((h) => h.base !== 'king' || h.fused);
  if (card.kind === 'suit') return open.some((h) => !h.suit);
  if (card.kind === 'weapon') return open.some((h) => canTakeWeapon(h, card.weapon, run.made));
  return false;
}

/** Their side takes this card, on a piece of theirs at random (Tile Chess,
    2026-10-14: the tile they turned over). Words for what happened, or null
    if no piece of theirs can take it. Mutates. */
export function foeTake(run, card, rand) {
  if (!run.foes) return null;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const open = run.foes.map((h, i) => i).filter((i) => run.foes[i].base !== 'king' || run.foes[i].fused);
  if (card.kind === 'suit') {
    const at = open.filter((i) => !run.foes[i].suit);
    if (!at.length) return null;
    const i = pick(at), before = pieceOf(run.foes[i], run.made).name;
    run.foes[i].suit = card.suit;
    if (card.suit === 'hearts') run.foes[i].lives = Math.max(2, run.foes[i].lives || 1);
    return `their ${before} takes ${SUITS[card.suit].name}`;
  }
  if (card.kind === 'weapon') {
    const at = open.filter((i) => canTakeWeapon(run.foes[i], card.weapon, run.made));
    if (!at.length) return null;
    const i = pick(at), before = pieceOf(run.foes[i], run.made).name;
    armHand(run.foes[i], card.weapon);
    return `their ${before} takes ${run.foes[i].wl > 1 ? 'a level more of its' : 'a'} ${WEAPONS[card.weapon].name.toLowerCase()}${run.foes[i].wl > 1 ? ` (${run.foes[i].wl})` : ''}`;
  }
  return null;
}

/** Plain words for a board card. */
export function boardCardText(card, adv = false) {
  if (card.kind === 'merge') return { title: PIECES[card.type].name, text: `${PIECES[card.type].desc} Choose a piece of yours to combine it with: the same kind makes a veteran with a heart more; another kind fuses, with every move of both.`, tag: PIECES[card.type].kind === 'fairy' ? 'A fairy piece' : 'A classic piece' };
  return cardText(card, adv);
}

// --- Adventure (Timothy, 2026-10-15). ----------------------------------------

/** How a board went against par, in golf's words (Timothy, 2026-10-15:
    "par should be 5 moves ... a birdie is 4, eagle is 3, bogey is 6"):
    'albatross' (three or more under), 'eagle', 'birdie', 'par', 'bogey'
    (one over) or 'worse' (two or more over, or not cleared). */
export const parVerdict = (moves, par, won) => {
  if (!won || !par) return 'worse';
  const d = moves - par;
  return d <= -3 ? 'albatross' : d === -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'worse';
};
/** Cards to choose from by verdict ("par gives two things to choose from,
    birdie gives three, eagle four, bogey or lower no choice just one, less
    than bogey no choice and also no choice of what piece it gets applied
    to"): one card at a bogey, chosen for a piece; one at worse, given to a
    piece by chance (PAR_AUTO). */
export const PAR_CARDS = { albatross: 4, eagle: 4, birdie: 3, par: 2, bogey: 1, worse: 1 };
/** Which verdicts give their one card without a choice: 'card' (you still
    choose the piece) or 'all' (the piece too is chosen by chance). */
export const PAR_AUTO = { bogey: 'card', worse: 'all' };
/** The verdict's name for a board's end: "Eagle", "Double bogey", "4 over
    par", "Not cleared". */
export function scoreName(moves, par, won) {
  if (!won) return 'Not cleared';
  const d = moves - par;
  return d <= -3 ? 'Albatross' : d === -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : d === 3 ? 'Triple bogey' : `${d} over par`;
}

/** Adventure's cards after a board: `n` of them, never the same twice:
    suits and weapons some piece of yours can take (a weapon it has already
    goes up a level). New pieces come from three of a kind, not cards.
    Now and then (2026-10-16, Timothy: "normally you just get suit cards,
    but rarely you get a rabbit") one of them is a rabbit you took on the
    board (`taken`, from rabbitsTaken), for a piece with none yet. */
export const RABBIT_CHANCE = 0.2;
/** How often an offer holds a piece of the troupe to take (2026-10-17,
    Timothy: "make it so you can find some of the new fairy pieces as part
    of your deck"): one offer in four from depth 2, while the deck has
    room. */
export const PIECE_CHANCE = 0.25;
/** The fairy pieces you can find: the troupe. */
export const TROUPE = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'troupe');
export function adventureCards(run, n, rand, taken = []) {
  const rest = [], out = [];
  if (run.hand.some((h) => !h.suit)) for (const suit of Object.keys(SUITS)) rest.push({ kind: 'suit', suit });
  for (const w of Object.keys(WEAPONS)) if (run.hand.some((h) => canTakeWeapon(h, w, run.made))) rest.push({ kind: 'weapon', weapon: w });
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  // A piece of the troupe, one you do not have if there is one.
  if ((run.depth || 1) >= 2 && roomFor(run) && rand() < PIECE_CHANCE) {
    const have = new Set(run.hand.map((h) => h.base)), fresh = TROUPE.filter((t) => !have.has(t)), from = fresh.length ? fresh : TROUPE;
    const card = { kind: 'piece', type: from[Math.floor(rand() * from.length)] };
    if (out.length) out[Math.floor(rand() * out.length)] = card; else out.push(card);
  }
  if (taken.length && run.hand.some((h) => !h.rabbit) && rand() < RABBIT_CHANCE) {
    const r = taken[Math.floor(rand() * taken.length)], card = { kind: 'rabbit', rabbit: r.rabbit, ...(r.suit ? { suit: r.suit } : {}) };
    if (out.length) out[Math.floor(rand() * out.length)] = card; else out.push(card);
  }
  return out;
}

/** The rabbits inside the pieces of theirs you took on a board: [{ rabbit,
    suit }]. `netted`: only those your net caught (each yours for certain,
    2026-10-16, Timothy: "net - nothing new but you are guaranteed to get the
    corresponding rabbit of the peice you capture"). */
export function rabbitsTaken(end, netted = false) {
  return end.foes.filter((f) => f.taken && !!f.netted === netted && rabbitIn(f)).map((f) => ({ rabbit: rabbitIn(f), ...(f.suit ? { suit: f.suit } : {}) }));
}

// --- Adventure's set and its rabbits (2026-10-15). ------------------------------
// Timothy: "when you get another piece, it now enters your set, and every
// turn you cycle through your piece set ... when you collect more than 5
// pieces, instead of then entering your set to cycle you now shuffle out of
// your total randomly each level as to which ones land in your set five
// piece cycle for that round ... you have to capture three of a piece to
// get a copy of it, so capturing gives you a rabbit of that piece, and three
// rabbits combine into one piece that enters your set."
//
// run.hand is everything you have collected; the set is the part of it that
// you choose from on the board this level (at most run.maxPieces: three since 2026-10-15).

/** Pieces given after a board, by its depth (Timothy, 2026-10-15: "you
    should get a bishop after level one, then a knight after level 3, so you
    have a set to work with on future levels"). */
export const ADVENTURE_GIFTS = { 1: 'bishop', 3: 'knight' };

/** How many of one kind taken make that piece. */
export const TAKE_FOR_PIECE = 3;

/** This board's set: indexes into run.hand, in the order you got them. All
    of them while they fit; past that, as many as fit, drawn at random. */
export function adventureSet(run, rand, n = null) {
  const all = run.hand.map((_, i) => i);
  if (all.length <= run.maxPieces) return all;
  // The same board asks again (finding it, playing it): the same set.
  if (n != null && run.sets?.[n]) return run.sets[n];
  // Your cat is always one of them (2026-10-16).
  const cat = run.hand.findIndex((h) => h.base === 'cat');
  const others = all.filter((i) => i !== cat), out = cat >= 0 ? [cat] : [];
  // Drawn as from a deck (Timothy, 2026-10-17: "every time they are rolled
  // and then used, they are expended until you've used your entire deck,
  // so you end up using your entire deck eventually"): each board draws
  // from what is left; when that runs out, the rest are shuffled back in.
  // A piece new since the last draw goes into what is left.
  run.pile = (run.pile || []).filter((i) => others.includes(i));
  for (const i of others) if (!(run.dealt || []).includes(i)) run.pile.push(i);
  run.dealt = others.slice();
  while (out.length < run.maxPieces) {
    if (!run.pile.length) run.pile = others.filter((i) => !out.includes(i));
    if (!run.pile.length) break;
    out.push(run.pile.splice(Math.floor(rand() * run.pile.length), 1)[0]);
  }
  out.sort((a, b) => a - b);
  if (n != null) (run.sets = run.sets || {})[n] = out;
  return out;
}

/** After an Adventure board: hearts spent stay spent. Since 2026-10-16
    (Timothy: "player pieces when captured shouldn't disappear forever, just
    for that level") a piece they took is back for the next board, so
    nothing leaves the hand; but if they took every piece of the set on this
    board, the adventure is over. `pick` is the board's set (hand indexes).
    Returns { lost: hand indexes taken this board, all: whether every one
    was }. Mutates. */
export function afterAdventure(run, end, pick) {
  // Adventure Tactics, moving freely (2026-10-17): the set is gone from the
  // state; what counts is whether any piece of yours is still standing.
  if (end.free) return { lost: [], all: end.pieces.every((p) => p.taken) };
  const lost = [];
  pick.forEach((h, j) => {
    // A piece with a rabbit standing by itself (2026-10-16) is in end.pieces.
    const e = end.set?.[j], onBoard = !end.set || j === end.ci, live = onBoard ? end.pieces[0] : e?.out != null ? end.pieces[e.out] : e;
    if (!live || !run.hand[h]) return;
    if (((onBoard || e?.out != null) && live.taken && !live.recalled) || e?.lost || live.lost) lost.push(h);
    if (run.hand[h].lives > 1) run.hand[h] = { ...run.hand[h], lives: live.lives ?? run.hand[h].lives };
  });
  return { lost, all: pick.length > 0 && lost.length === pick.length };
}

/** The most pieces you can have (Timothy, 2026-10-16: "a max deck of
    pieces is 16, as an homage to regular chess"). */
export const ADVENTURE_MAX = 16;
/** Can another piece join your collection? */
export const roomFor = (run) => run.hand.length < ADVENTURE_MAX;

/** What a net caught on a board: each joins your collection whole, while
    there is room. Returns their kinds (and `full`, those with no room).
    Mutates. */
export function netCatches(run, end) {
  const got = [], full = [];
  for (const f of end.foes) {
    if (!f.taken || !f.netted || !PIECES[f.type]) continue;
    if (!roomFor(run)) { full.push(f.type); continue; }
    run.hand.push({ base: f.type }); run.found.push(f.type); got.push(f.type);
  }
  got.full = full;
  return got;
}

/** Three of a kind (2026-10-15, Timothy: "you have to capture three of a
    piece to get a copy of it"): every piece of theirs you take, not netted,
    counts toward its kind (run.tally); every three of a kind become that
    piece, which joins your collection, while there is room (16). These
    were called rabbits until 2026-10-16, when rabbits became the things
    inside pieces. Returns the kinds made (and `full`, those with no room).
    Mutates. */
export function takeTally(run, end) {
  run.tally = run.tally || {};
  const made = [], full = [];
  for (const f of end.foes) {
    if (!f.taken || f.netted || !PIECES[f.type] || ['rabbit', 'bunny', 'ball'].includes(f.type)) continue;
    run.tally[f.type] = (run.tally[f.type] || 0) + 1;
    if (run.tally[f.type] >= TAKE_FOR_PIECE) {
      run.tally[f.type] -= TAKE_FOR_PIECE;
      if (!roomFor(run)) { full.push(f.type); continue; }
      run.hand.push({ base: f.type });
      run.found.push(f.type);
      made.push(f.type);
    }
  }
  made.full = full;
  return made;
}

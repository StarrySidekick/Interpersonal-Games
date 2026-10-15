// An Adventure run: the levels, par, and the upgrades between them. No DOM.
//
// Every run has its own seed, so every run is different, and the same seed
// always deals the same levels. Each level is harder than the last in a way
// picked at random from what the depth allows: more statues, a bigger board
// or one with holes, a rabbit or two in the way, and from depth 4 purple
// pieces that move and take yours.
//
// Par is the route the search finds (rules.js, search) plus a little room,
// more the deeper you are, since deeper levels are harder to read. Clear a
// level over par and you get one upgrade; on par, a choice of two; under
// par, a choice of three.

import { rng } from '../../../engine/seed.js';
import { SHAPES as BOARDS } from '../rules.js';
import { PIECES, SUITS, WEAPONS, STARTERS, canArm, search, occOf, movesOf, takenBy } from './rules.js';

export const MAX_PIECES = 4;

// Boards: two small ones for the first levels, then the daily's shapes.
const SMALL = {
  glade: { name: 'the glade', rows: ['xxxxx', 'xxxxx', 'xxxxx', 'xxxxx', 'xxxxx'] },
  hollow: { name: 'the hollow', rows: ['xxxxx', 'xxxxx', 'xx.xx', 'xxxxx', 'xxxxx'] },
  path: { name: 'the path', rows: ['xxxxx', 'x.x.x', 'xxxxx', 'x.x.x', 'xxxxx'] }
};
const SHAPES = { ...SMALL, ...BOARDS };
const boardOf = (shape) => {
  const rows = SHAPES[shape].rows, H = rows.length, W = rows[0].length, on = new Uint8Array(W * H);
  rows.forEach((r, y) => [...r].forEach((c, x) => { on[y * W + x] = c === 'x' ? 1 : 0; }));
  return { shape, name: SHAPES[shape].name, W, H, on };
};

/** Which boards a depth can bring. */
function shapesFor(d) {
  if (d <= 2) return ['glade'];
  if (d <= 4) return ['glade', 'hollow', 'path', 'meadow'];
  if (d <= 7) return ['meadow', 'well', 'stepping', 'mushroom', 'hollow'];
  return ['meadow', 'well', 'stepping', 'mushroom', 'heart', 'crossroads', 'stone', 'pond', 'diamond', 'rabbit'];
}

// How a rabbit hops: a short pattern it repeats, turning round at an edge.
const PATTERNS = [[[1, 0]], [[1, 1], [1, -1]], [[1, 0], [0, 1]], [[1, 2]], [[1, 0], [0, 1], [-1, 0], [0, -1]], [[0, 1], [0, 1], [0, -1], [0, -1]]];

const pickFrom = (rand, list) => list[Math.floor(rand() * list.length)];
const randInt = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));

// --- A new run. ---------------------------------------------------------------------

export function newRun(starter, seed = Math.floor(Math.random() * 1e9)) {
  return { v: 1, seed, depth: 1, roster: [{ id: 1, kind: starter }], nextId: 2, log: [], over: false };
}

/** The squares piece h (its suit counts) can ever reach from `from` on the
    empty board. */
function reachable(L, h, from) {
  const seen = new Set([from]), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const fake = { L, ps: [{ id: 0, kind: h.kind, suit: h.suit, side: 'you', sq: queue[i] }] };
    for (const m of movesFor(fake)) if (!seen.has(m.to)) { seen.add(m.to); queue.push(m.to); }
  }
  return seen;
}
/** The squares where piece h, weapon and all, could take a statue standing
    there alone: from anywhere it can get to. A lance needs room beyond, a
    sword a square beside, so these are not just where it can land. */
function takeable(L, h, from) {
  const out = new Set();
  for (const at of reachable(L, h, from)) {
    for (let q = 0; q < L.W * L.H; q++) {
      if (!L.on[q] || q === at || out.has(q)) continue;
      const fake = { L, ps: [{ id: 0, kind: h.kind, suit: h.suit, weapon: h.weapon, wl: h.wl, side: 'you', sq: at }, { id: 1, kind: 'pawn', side: 'stone', sq: q }] };
      if (movesFor(fake).some((m) => takenBy(m).includes(1))) out.add(q);
    }
  }
  return out;
}
// (The engine's own moves, for one piece alone on the board.)
const movesFor = (fake) => movesOf(fake, fake.ps[0], occOf(fake));

/** Slack added to the search's route for par, by depth. */
export const slack = (d) => (d <= 5 ? 1 : d <= 11 ? 2 : 3);

/** The level at the run's depth: { L, state, par, best, twists }. The same
    run and depth always give the same level. */
export function makeLevel(run) {
  const d = run.depth;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rand = rng(`adventure:${run.seed}:${d}:${attempt}`);
    // Later attempts ease off, so a level always deals.
    const ease = attempt < 15 ? 0 : attempt < 30 ? 1 : 2;
    const L = boardOf(pickFrom(rand, shapesFor(d)));
    L.depth = d;
    const squares = [];
    for (let q = 0; q < L.W * L.H; q++) if (L.on[q]) squares.push(q);
    // Yours start along the bottom, nearest the middle.
    const home = squares.slice().sort((a, b) => ((b / L.W) | 0) - ((a / L.W) | 0) || Math.abs((a % L.W) - (L.W - 1) / 2) - Math.abs((b % L.W) - (L.W - 1) / 2));
    const ps = run.roster.map((h, i) => ({ ...h, side: 'you', sq: home[i], starUsed: false, stun: false }));
    const taken = new Set(ps.map((p) => p.sq));
    const bottom = Math.max(...ps.map((p) => (p.sq / L.W) | 0));
    let nextId = 100;

    // How hard, at random within what the depth allows.
    const movers = Math.max(0, d >= 4 && rand() < Math.min(1, 0.55 + d * 0.05) ? Math.min(4, 1 + Math.floor((d - 4) / 4) + (rand() < 0.3 ? 1 : 0)) - ease : 0);
    const rabbits = ease > 1 ? 0 : d >= 3 && rand() < 0.45 ? (d >= 9 && rand() < 0.4 ? 2 : 1) : 0;
    let statues = Math.max(2, Math.min(10, 2 + Math.floor(d * 0.7) + randInt(rand, 0, 1) - movers - ease));
    if (L.on.reduce((a, b) => a + b, 0) <= 25) statues = Math.min(statues, 7);

    // Statues only where some piece of yours could take them.
    const reach = new Set();
    for (const p of ps) for (const q of takeable(L, p, p.sq)) reach.add(q);
    const free = (q) => !taken.has(q) && ((q / L.W) | 0) < bottom;
    const spots = squares.filter((q) => reach.has(q) && free(q));
    const statueKinds = d >= 5 ? ['pawn', 'knight', 'bishop', 'rook', 'king', 'camel', 'zebra', 'cannon'] : ['pawn', 'knight', 'bishop', 'rook', 'king'];
    for (let i = 0; i < statues && spots.length; i++) {
      const q = spots.splice(Math.floor(rand() * spots.length), 1)[0];
      taken.add(q);
      ps.push({ id: nextId++, kind: pickFrom(rand, statueKinds), side: 'stone', sq: q });
    }
    // Purple pieces that move: in the top rows.
    const moverKinds = d < 6 ? ['pawn', 'pawn', 'knight', 'bishop', 'king'] : d < 9 ? ['pawn', 'knight', 'bishop', 'rook', 'king', 'camel'] : ['knight', 'bishop', 'rook', 'king', 'camel', 'zebra', 'cannon', 'queen'];
    const top = squares.filter((q) => !taken.has(q) && ((q / L.W) | 0) <= 1);
    for (let i = 0; i < movers && top.length; i++) {
      const q = top.splice(Math.floor(rand() * top.length), 1)[0];
      taken.add(q);
      ps.push({ id: nextId++, kind: pickFrom(rand, moverKinds), side: 'foe', sq: q });
    }
    // Rabbits in the middle rows.
    const midRows = squares.filter((q) => !taken.has(q) && ((q / L.W) | 0) >= 1 && ((q / L.W) | 0) < bottom);
    for (let i = 0; i < rabbits && midRows.length; i++) {
      const q = midRows.splice(Math.floor(rand() * midRows.length), 1)[0];
      taken.add(q);
      ps.push({ id: nextId++, kind: 'rabbit', side: 'rabbit', sq: q, pat: pickFrom(rand, PATTERNS).map((v) => v.slice()), k: 0 });
    }
    if (!ps.some((p) => p.side === 'stone' || p.side === 'foe')) continue;
    const state = { L, ps, t: 0, bonus: null };
    const found = search(state, { width: d <= 3 ? 120 : 70, cap: 30 });
    if (!found) continue;
    const twists = {
      board: L.name, statues: ps.filter((p) => p.side === 'stone').length,
      movers: ps.filter((p) => p.side === 'foe').length, rabbits: ps.filter((p) => p.side === 'rabbit').length
    };
    return { L, state, par: found.turns + slack(d), best: found.turns, route: found.route, twists };
  }
  return null;
}

/** How a level went against par: 'under', 'par' or 'over'. */
export const verdict = (moves, par) => (moves < par ? 'under' : moves === par ? 'par' : 'over');
export const OFFERS = { under: 3, par: 2, over: 1 };

// --- Upgrades. --------------------------------------------------------------------------
// A card is one of:
//   { kind: 'piece', piece }                 a new piece joins you (up to four)
//   { kind: 'suit', suit }                    a suit for one of yours without one
//   { kind: 'weapon', weapon }                a weapon, level 1, for one without one
//   { kind: 'sharpen' }                       a weapon you have, one level up (to 3)

/** Which new pieces a depth can bring. */
function newPieceKinds(d) {
  if (d <= 3) return ['knight', 'bishop', 'rook', 'king'];
  if (d <= 6) return ['knight', 'bishop', 'rook', 'king', 'camel', 'zebra', 'cannon', 'squirrel'];
  return ['knight', 'bishop', 'rook', 'camel', 'zebra', 'cannon', 'squirrel', 'nightrider', 'archbishop', 'chancellor', ...(d >= 9 ? ['queen'] : [])];
}

/** Pieces of yours a card could go on. */
export function eligible(run, card) {
  if (card.kind === 'suit') return run.roster.filter((h) => !h.suit || (h.suit === 'hearts' && (h.lives || 1) < 2));
  if (card.kind === 'weapon') return run.roster.filter((h) => !h.weapon && canArm(h.kind, card.weapon));
  if (card.kind === 'sharpen') return run.roster.filter((h) => h.weapon && (h.wl || 1) < 3);
  return [];
}

/** The cards on offer after clearing the run's current depth, given how it
    went. A new piece is due after depths 2, 4 and 7 while you have fewer
    than four, and comes first, so even a single card brings it. */
export function offersFor(run, how) {
  const d = run.depth, rand = rng(`adventure-offers:${run.seed}:${d}`), n = OFFERS[how];
  const out = [];
  const room = run.roster.length < MAX_PIECES;
  const kinds = newPieceKinds(d);
  const freshPiece = () => {
    const have = new Set(run.roster.map((h) => h.kind));
    const prefer = kinds.filter((k) => !have.has(k));
    return { kind: 'piece', piece: pickFrom(rand, prefer.length ? prefer : kinds) };
  };
  if (room && ([2, 4, 7].includes(d) || run.roster.length === 1 && d >= 2)) out.push(freshPiece());
  const pool = [];
  for (const suit of Object.keys(SUITS)) pool.push({ kind: 'suit', suit });
  for (const weapon of Object.keys(WEAPONS)) pool.push({ kind: 'weapon', weapon });
  pool.push({ kind: 'sharpen' }, { kind: 'sharpen' });
  if (room) pool.push(freshPiece());
  const usable = pool.filter((c) => c.kind === 'piece' || eligible(run, c).length);
  while (out.length < n && usable.length) {
    const c = usable.splice(Math.floor(rand() * usable.length), 1)[0];
    if (out.some((o) => o.kind === c.kind && (o.suit || o.weapon || o.piece || '') === (c.suit || c.weapon || c.piece || ''))) continue;
    if (c.kind === 'piece' && out.some((o) => o.kind === 'piece')) continue;
    out.push(c);
  }
  return out;
}

/** Take a card, onto piece `id` where it needs one. Mutates the run. */
export function takeCard(run, card, id) {
  if (card.kind === 'piece') { run.roster.push({ id: run.nextId++, kind: card.piece }); return; }
  const h = run.roster.find((r) => r.id === id);
  if (!h) return;
  if (card.kind === 'suit') { h.suit = card.suit; if (card.suit === 'hearts') h.lives = 2; else delete h.lives; }
  if (card.kind === 'weapon') { h.weapon = card.weapon; h.wl = 1; }
  if (card.kind === 'sharpen') h.wl = Math.min(3, (h.wl || 1) + 1);
}

/** After a level: pieces taken are gone, a heart spent stays spent. Mutates. */
export function settle(run, state) {
  run.roster = run.roster.flatMap((h) => {
    const p = state.ps.find((q) => q.id === h.id && q.side === 'you');
    if (!p) return [];
    return [{ ...h, ...(p.lives != null ? { lives: p.lives } : {}) }];
  });
  if (!run.roster.length) run.over = true;
}

/** A card in words: { title, text }. */
export function cardText(card) {
  if (card.kind === 'piece') { const n = PIECES[card.piece].name; return { title: `${/^[AEIOU]/.test(n) ? 'An' : 'A'} ${n} joins you`, text: PIECES[card.piece].say }; }
  if (card.kind === 'suit') return { title: `${SUITS[card.suit].mark} ${SUITS[card.suit].name}`, text: SUITS[card.suit].desc };
  if (card.kind === 'weapon') return { title: `${WEAPONS[card.weapon].mark} ${WEAPONS[card.weapon].name}`, text: WEAPONS[card.weapon].desc(1) };
  return { title: 'Sharpen', text: 'One of your weapons goes up a level, to 3 at most.' };
}

/** One of yours in words: "Rook of Stars, Sword 2". */
export function pieceName(h) {
  return PIECES[h.kind].name + (h.suit ? ` of ${SUITS[h.suit].name}` : '') + (h.weapon ? `, ${WEAPONS[h.weapon].name} ${h.wl || 1}` : '');
}
export { STARTERS };

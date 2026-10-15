// Proves Adventure's parts of the Grove (2026-10-15) do what they say: their
// statues never move or take; the Changeling takes on the moves of what it
// takes; the pieces with a rabbit inside walk short routes that always come
// home and never get stuck; the hole opens once they are all taken and your
// piece jumps in; one piece on the board takes turns through your set; five
// of a bigger collection are drawn each board; three rabbits of a kind make
// that piece; Adventure deals a board with a par at every depth; and its
// cards come one, two or three by par.
//
//   node play/grove-chess/adventure-check.mjs

import * as R from './rules.js';
import { makeLevel, searchLayouts, ROUTES } from './lab.js';
import { modeDefaults, levelSettings } from './modes.js';
import { newRun, handSettings, adventureCards, parVerdict, PAR_CARDS, adventureSet, afterAdventure, takeRabbits, RABBITS_FOR_PIECE } from './run.js';
import { rng } from '../../engine/seed.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const M = modeDefaults('adventure');
const deal = (d, hand, sd, more = {}) => {
  const run = newRun(hand, 5, null); run.depth = d;
  return makeLevel({ ...levelSettings(M, { depth: d, hand: handSettings(run) }, rng(`deal:${d}:${sd}`)), ...more }, sd);
};

// Statues and the Changeling (every one of theirs a statue, for this).
let L = null;
for (let sd = 1; sd < 200 && !L; sd++) {
  const lv = deal(3, ['changeling'], sd, { still: 12 });
  if (R.movesFor(R.initialState(lv), 0).some((mv) => mv.cap)) L = lv;
}
ok(L, 'a board where the Changeling can take at once');
let s = R.initialState(L);
ok(s.foes.every((f) => f.brain === 'still'), 'with still set to all, all of theirs are statues');
ok(!R.canTake(L.rules, s.foes[0]), 'a statue never takes');
ok(R.movesFor(s, 0).every((mv) => Math.max(Math.abs(mv.x - s.pieces[0].x), Math.abs(mv.y - s.pieces[0].y)) === 1), 'an unshaped Changeling steps like a king');
const cap = R.movesFor(s, 0).find((mv) => mv.cap), victim = s.foes.find((f) => f.x === cap.x && f.y === cap.y);
let n = R.apply(s, { p: 0, ...cap });
ok(n.pieces[0].shape === victim.type || ['king', 'changeling'].includes(victim.type), 'it takes on the shape of what it took');
ok(n.foes.every((f, k) => f.taken || (f.x === s.foes[k].x && f.y === s.foes[k].y)), 'statues stay where they are');

// Routes: at every depth, each piece with a rabbit inside walks a route of
// a known kind, every turn, and is back home after each time round; no two
// share a square; and a pawn is always a statue.
let walkers = 0;
for (const d of [1, 2, 3, 5, 8, 11]) for (let sd = 1; sd <= 12; sd++) {
  const lv = deal(d, ['rook'], 100 * d + sd);
  const st = R.initialState(lv), W = lv.W;
  const army = st.foes.filter((f) => f.type !== 'rabbit');
  ok(army.some((f) => f.brain === 'possessed'), `depth ${d} (${sd}): at least one of theirs walks a route`);
  ok(army.every((f) => f.brain === 'possessed' || f.brain === 'still'), `depth ${d} (${sd}): theirs are statues or walkers, nothing that thinks`);
  ok(army.every((f) => f.type !== 'pawn' || f.brain === 'still'), `depth ${d} (${sd}): pawns are statues`);
  const walk = army.filter((f) => f.brain === 'possessed');
  walkers += walk.length;
  ok(walk.every((f) => f.route && ROUTES[f.patternName] && f.pattern.length === ROUTES[f.patternName].len), `depth ${d} (${sd}): each walks a named route`);
  // Their turns alone, your piece out of the way: 24 turns of everything.
  let c = R.clone(st);
  c.pieces = [];
  const seen = new Map(walk.map((f) => [st.foes.indexOf(f), new Set([f.y * W + f.x])]));
  for (let t = 0; t < 24; t++) {
    c = R.respond(c);
    c.foes.forEach((f, k) => {
      if (f.brain !== 'possessed') return;
      seen.get(k).add(f.y * W + f.x);
      ok(!f.blocked, `depth ${d} (${sd}): the ${f.type} is never stuck`);
      if ((t + 1) % f.pattern.length === 0) ok(f.x === st.foes[k].x && f.y === st.foes[k].y, `depth ${d} (${sd}): the ${f.type} is home after its route`);
    });
  }
  const sets = [...seen.values()];
  for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) ok([...sets[a]].every((q) => !sets[b].has(q)), `depth ${d} (${sd}): two routes share a square`);
}
ok(walkers > 60, `routes were dealt (${walkers})`);

// A walker that finds you on its next square takes you.
{
  let hit = false;
  for (let sd = 1; sd < 60 && !hit; sd++) {
    const lv = deal(1, ['rook'], 5000 + sd), st = R.initialState(lv), k = st.foes.findIndex((f) => f.brain === 'possessed');
    const f = st.foes[k], [dx, dy] = f.pattern[0];
    if (!dx && !dy) continue;
    const c = R.clone(st);
    c.pieces[0].x = f.x + dx; c.pieces[0].y = f.y + dy;
    const after = R.respond(c);
    hit = after.pieces[0].taken && after.foes[k].x === f.x + dx;
  }
  ok(hit, 'a walker steps onto you and takes you');
}

// The hole: shut until every one of theirs is taken; then a move onto it
// jumps in and wins, and a slide cannot pass over it.
{
  const lv = deal(1, ['rook'], 77), st = R.initialState(lv);
  ok(lv.rules.goal === 'clear' && lv.hole, 'a cleared level has a hole');
  ok(!R.holeOpen(st), 'the hole is shut while any of theirs is left');
  const c = R.clone(st);
  c.foes.forEach((f) => { f.taken = true; });
  ok(R.holeOpen(c), 'the hole opens once they are all taken');
  c.pieces[0].type = 'rook';
  const h = lv.hole;
  // Put the rook in line with the hole, two squares off, if the board allows.
  let line = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = [h.x + dx, h.y + dy], b = [h.x + 2 * dx, h.y + 2 * dy], z = [h.x - dx, h.y - dy];
    if ([a, b, z].every(([x, y]) => R.onBoard(lv, x, y) && !lv.stumps.has(y * lv.W + x))) { line = { a, b, z }; break; }
  }
  if (line) {
    c.pieces[0].x = line.b[0]; c.pieces[0].y = line.b[1];
    const ms = R.movesFor(c, 0);
    const into = ms.find((m) => m.x === h.x && m.y === h.y);
    ok(into?.sink, 'a move onto the open hole jumps in');
    ok(!ms.some((m) => m.x === line.z[0] && m.y === line.z[1]), 'a slide cannot pass over the open hole');
    const won = R.playerMove(c, { p: 0, ...into });
    ok(won.won && won.sunk, 'jumping in wins');
  } else ok(false, 'no line to the hole on this board');
}

// One piece on the board, taking turns through the set; each keeps its own.
{
  const run = newRun(['rook', 'knight', 'bishop'], 5, null); run.depth = 2;
  run.hand[1].suit = 'hearts'; run.hand[1].lives = 2;
  const lv = makeLevel(levelSettings(M, { depth: 2, hand: handSettings(run) }, rng('cycle')), 31);
  let c = R.initialState(lv);
  ok(lv.pieces.length === 1 && lv.cycle?.length === 3, 'one piece on the board, three in the set');
  const order = [];
  for (let t = 0; t < 4 && !R.isOver(c); t++) {
    order.push(c.pieces[0].type);
    const mv = R.allMoves(c)[0];
    c = R.apply(c, mv);
  }
  ok(order.join() === 'rook,knight,bishop,rook'.split(',').slice(0, order.length).join(), `it takes turns in order (${order.join(', ')})`);
  ok(R.setOrder(R.initialState(lv)).map((p) => p.type).join() === 'rook,knight,bishop', 'the set in order, from the piece on the board');
  ok(R.initialState(lv).set[1].suit === 'hearts', 'each piece of the set keeps its suit while it waits');
}

// Gears in a set: the piece of Gears may skip to the next, which moves
// this turn; no move is spent, and no second skip in the same turn.
{
  const run = newRun(['rook', 'knight', 'bishop'], 5, null); run.depth = 2;
  run.hand[0].suit = 'gears';
  const lv = makeLevel(levelSettings(M, { depth: 2, hand: handSettings(run) }, rng('gears')), 41);
  const st = R.initialState(lv), skip = R.movesFor(st, 0).find((m) => m.skip);
  ok(skip, 'a piece of Gears can skip');
  ok(R.isLegal(st, { p: 0, ...skip }), 'the skip is legal');
  const mid = R.apply(st, { p: 0, ...skip });
  ok(mid.pieces[0].type === 'knight' && mid.t === 0 && mid.bonus?.why === 'gears', 'skipping brings on the knight, with no move spent');
  ok(!R.movesFor(mid, 0).some((m) => m.skip) && !R.allMoves(mid).some((m) => m.p === -1), 'no second skip, and no passing, in the same turn');
  const mv = R.allMoves(mid)[0], after = R.apply(mid, mv);
  ok(after.t === 1 && after.pieces[0].type === 'bishop', 'the knight moves, and the bishop is next');
  const plain = newRun(['rook', 'knight'], 5, null);
  const lv2 = makeLevel(levelSettings(M, { depth: 2, hand: handSettings(plain) }, rng('gears2')), 42);
  ok(!R.movesFor(R.initialState(lv2), 0).some((m) => m.skip), 'without Gears, no skip');
}

// A sword that aims: it strikes past where it lands, the way it moved.
{
  ok(R.swordAim(0, 3, 1).join() === '0,1' && R.swordAim(-2, 0, 1).join() === '-1,0' && R.swordAim(2, 2, 1).join() === '1,1', 'straight on, for a slide');
  ok(R.swordAim(1, 2, 1).join() === '1,1', 'a knight\u2019s L aims diagonally');
  ok(R.swordAim(0, -1, 2).map(String).sort().join(' ') === ['0,-1', '-1,0', '1,0'].sort().join(' '), 'level 2: straight on and either side');
  ok(R.swordAim(1, 0, 3).length === 5, 'level 3: five squares');
  const run = newRun(['rook'], 5, null); run.hand[0].weapon = 'sword'; run.hand[0].wl = 1;
  let found = false;
  for (let sd = 1; sd < 80 && !found; sd++) {
    const lv = makeLevel(levelSettings(M, { depth: 2, hand: handSettings(run) }, rng('sw' + sd)), 500 + sd);
    ok(lv.rules.swordAims, 'Adventure\u2019s sword aims');
    const st = R.initialState(lv), me = st.pieces[0];
    for (const m of R.movesFor(st, 0)) {
      if (!m.strike) continue;
      const dx = Math.sign(m.x - me.x), dy = Math.sign(m.y - me.y), W = lv.W;
      found = m.strike.length === 1 && m.strike[0] === (m.y + dy) * W + m.x + dx;
      ok(found, 'a rook\u2019s sword strikes the square past where it lands');
      break;
    }
  }
  ok(found, 'a board where the sword strikes');
}

// Five of a bigger collection, drawn each board.
{
  const run = newRun(['rook', 'knight', 'bishop', 'king', 'pawn', 'camel', 'ferz'], 5, null);
  const a = adventureSet(run, rng('a')), b = adventureSet(run, rng('b'));
  ok(a.length === 5 && new Set(a).size === 5 && a.every((i, k) => !k || a[k - 1] < i), 'five of seven, in the order found');
  ok(a.join() !== b.join() || adventureSet(run, rng('c')).join() !== a.join(), 'a different five on a different board');
  const small = newRun(['rook', 'knight'], 5, null);
  ok(adventureSet(small, rng('a')).join() === '0,1', 'all of them while they fit');
  ok(handSettings(run, a).hand.length === 5, 'the board is dealt with only those five');
}

// Rabbits: one for each piece taken, three of a kind make that piece; a
// piece taken on the board is gone.
{
  const run = newRun(['rook', 'knight'], 5, null);
  const end = { foes: [{ type: 'knight', taken: true }, { type: 'knight', taken: true }, { type: 'pawn', taken: true }, { type: 'bishop', taken: false }], pieces: [{ type: 'rook', taken: false }] };
  ok(takeRabbits(run, end).length === 0 && run.rabbits.knight === 2 && run.rabbits.pawn === 1 && !run.rabbits.bishop, 'one rabbit for each piece taken');
  const made = takeRabbits(run, { foes: [{ type: 'knight', taken: true }], pieces: [] });
  ok(made.join() === 'knight' && run.rabbits.knight === 0 && run.hand.length === 3 && run.hand[2].base === 'knight', `${RABBITS_FOR_PIECE} knight rabbits make a knight, and it joins your set`);
  const c = { pieces: [{ type: 'knight', taken: true }], set: [{ type: 'rook' }, { type: 'knight' }, { type: 'knight' }], ci: 1 };
  afterAdventure(run, c, [0, 1, 2]);
  ok(run.hand.length === 2 && run.lost.length === 1 && run.hand[0].base === 'rook', 'the piece taken on the board is gone; the rest stay');
}

// Every depth deals a board that can be cleared, with a par, ending in the hole.
for (const [d, hand] of [[1, ['rook']], [2, ['bishop']], [4, ['knight', 'rook']], [6, ['rook', 'knight', 'bishop']], [9, ['rook', 'knight', 'bishop', 'camel', 'king']]]) {
  const r = newRun(hand, 5, null); r.depth = d;
  const S = levelSettings(M, { depth: d, hand: handSettings(r) }, rng('check:' + d));
  const t0 = Date.now();
  const res = await new Promise((done) => searchLayouts({ settings: S, seed: 7000 + d, parMin: S.parMin, parMax: S.parMax, maxMs: 15000, quick: true }, (m) => { if (m.type !== 'progress') done(m); }));
  ok(res.type === 'done' && res.par >= 1, `depth ${d} deals a board with a par`);
  if (res.line) {
    const { states, ok: legal } = R.replay(makeLevel(S, res.seed), res.line);
    const end = states[states.length - 1];
    ok(legal && end.won && end.sunk, `depth ${d}: the par line ends in the hole`);
  }
  ok(Date.now() - t0 < 12000, `depth ${d} is found in good time (${Date.now() - t0} ms)`);
}

// Cards by par, and never a piece (pieces come from rabbits).
const r2 = newRun(['rook'], 5, null); r2.depth = 6;
for (const [how, want] of [['under', 3], ['par', 2], ['over', 1]]) {
  const cards = adventureCards(r2, PAR_CARDS[how], rng('cards:' + how));
  ok(cards.length === want, `${how} par gives ${want}`);
  ok(cards.every((c) => c.kind === 'suit' || c.kind === 'weapon'), `${how} par: suits and weapons only`);
}
ok(parVerdict(5, 6, true) === 'under' && parVerdict(6, 6, true) === 'par' && parVerdict(7, 6, true) === 'over' && parVerdict(3, 6, false) === 'over', 'the verdicts');

console.log(fails ? `${fails} checks failed.` : 'Adventure: statues, the Changeling, routes, the hole, the set, rabbits, dealing and cards check out.');
if (fails) process.exit(1);

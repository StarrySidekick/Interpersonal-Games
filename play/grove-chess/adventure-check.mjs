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
  const lv = deal(3, ['changeling'], sd, { still: 12, sentries: 0, skittish: 0, crown: false });
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
  ok(army.every((f) => ['possessed', 'still', 'sentry', 'skittish', 'crown'].includes(f.brain)), `depth ${d} (${sd}): theirs are statues, walkers, sentries, skittish or their leader; nothing that thinks`);
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

// The hole: none while any of theirs is left; taking the last wins, and the
// hole opens on a free square next to your piece, for it to jump into.
{
  let checked = 0;
  for (let sd = 1; sd < 40 && checked < 5; sd++) {
    const lv = deal(1, ['rook'], 900 + sd), st = R.initialState(lv);
    ok(lv.rules.goal === 'clear' && !lv.hole, 'no hole until the board is cleared');
    const c = R.clone(st);
    c.foes.forEach((f, k) => { f.taken = k > 0; });
    const last = c.foes[0];
    const mv = R.movesFor(c, 0).find((m) => m.cap && m.x === last.x && m.y === last.y);
    if (!mv) continue;
    checked++;
    const won = R.playerMove(c, { p: 0, ...mv });
    ok(won.won && won.hole, 'taking the last of theirs wins, and the hole opens');
    ok(won.hole && Math.max(Math.abs(won.hole.x - mv.x), Math.abs(won.hole.y - mv.y)) <= 1 && !(won.hole.x === mv.x && won.hole.y === mv.y), 'right beside your piece');
  }
  ok(checked >= 3, `boards where the last capture was tried (${checked})`);
}
{
  // No pawns in Adventure (2026-10-15): not among theirs at any depth.
  let pawns = 0;
  for (const d of [1, 3, 6, 10]) for (let sd = 1; sd <= 10; sd++) pawns += deal(d, ['rook'], 3000 + d * 20 + sd).foes.filter((f) => f.type === 'pawn').length;
  ok(pawns === 0, `no pawns among theirs (${pawns})`);
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

// Tactics (2026-10-15): pins, sentries, skittish flight, the leader, stones.
// Each on a board set out by hand: a 5 x 5 board, your piece, their pieces.
{
  const base = deal(1, ['rook'], 7777);
  const board = (mine, foes, extra = {}) => {
    const lv = { ...base, pieces: [mine], foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), cycle: undefined, hole: null, stumps: new Set(), rules: { ...base.rules, tactics: true, ...extra } };
    return R.initialState(lv);
  };
  const walker = (type, x, y, steps) => ({ type, x, y, brain: 'possessed', route: true, pattern: steps, patternName: 'Shuttle' });

  // 1. A pin holds a walker; without the piece behind, it walks.
  let s = board({ type: 'rook', x: 0, y: 0 }, [walker('knight', 0, 2, [[1, 2], [-1, -2]]), { type: 'bishop', x: 0, y: 4, brain: 'still' }]);
  let n = R.respond(s);
  ok(n.foes[0].x === 0 && n.foes[0].y === 2 && n.tlog.some((l) => l.what === 'pin' && l.k === 0), 'a pinned walker holds');
  s = board({ type: 'rook', x: 0, y: 0 }, [walker('knight', 0, 2, [[1, 2], [-1, -2]]), { type: 'bishop', x: 3, y: 4, brain: 'still' }]);
  n = R.respond(s);
  ok(n.foes[0].x === 1 && n.foes[0].y === 4, 'unpinned, it walks');
  ok(R.tacticalPins(board({ type: 'rook', x: 0, y: 0 }, [walker('knight', 0, 2, [[1, 2], [-1, -2]]), { type: 'bishop', x: 0, y: 4, brain: 'still' }])).has(0), 'tacticalPins finds it');

  // 2. A sentry takes what stands where it attacks; pinned, it cannot.
  s = board({ type: 'rook', x: 4, y: 3 }, [{ type: 'rook', x: 4, y: 0, brain: 'sentry' }, { type: 'pawn', x: 0, y: 4, brain: 'still' }]);
  n = R.respond(s);
  ok(n.pieces[0].taken && n.foes[0].y === 3, 'a sentry takes your piece, moving there');
  s = board({ type: 'bishop', x: 1, y: 4 }, [{ type: 'rook', x: 2, y: 3, brain: 'sentry' }, { type: 'knight', x: 4, y: 1, brain: 'still' }]);
  n = R.respond(s);
  ok(!n.pieces[0].taken, 'a pinned sentry cannot strike');

  // 3. Skittish: attacked twice at once (a fork), only one gets away.
  s = board({ type: 'knight', x: 2, y: 2 }, [{ type: 'rook', x: 0, y: 1, brain: 'skittish' }, { type: 'bishop', x: 4, y: 3, brain: 'skittish' }]);
  n = R.respond(s);
  ok((n.foes[0].x !== 0 || n.foes[0].y !== 1) && n.foes[1].x === 4 && n.foes[1].y === 3 && n.foes[1].trapped, 'a fork: the rook runs, the bishop is left');
  ok(n.tlog.some((l) => l.what === 'flee' && l.k === 0) && n.tlog.some((l) => l.what === 'trapped' && l.k === 1 && l.fork), 'said as a fork');

  // 4. Check: the leader flees; a walker blocks instead if it can; mate when nothing works.
  s = board({ type: 'rook', x: 2, y: 0 }, [{ type: 'king', x: 2, y: 4, brain: 'crown' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.respond(s);
  ok(!(n.foes[0].x === 2 && n.foes[0].y === 4) && n.tlog.some((l) => l.what === 'check' && l.how === 'flee'), 'checked, the leader flees');
  s = board({ type: 'rook', x: 2, y: 0 }, [{ type: 'king', x: 2, y: 4, brain: 'crown' }, walker('rook', 1, 2, [[1, 0], [-1, 0]])]);
  n = R.respond(s);
  ok(n.foes[1].x === 2 && n.foes[1].y === 2 && n.foes[1].brain === 'sentry' && n.tlog.some((l) => l.how === 'block'), 'a walker blocks the check, and stands guard there');
  s = board({ type: 'rook', x: 0, y: 0 }, [{ type: 'king', x: 0, y: 4, brain: 'crown' }, { type: 'knight', x: 4, y: 0, brain: 'still' }]);
  s.stones = [{ type: 'rook', x: 1, y: 2 }];
  n = R.respond(s);
  ok(n.won && n.mate && n.foes.every((f) => f.taken) && n.hole, 'checkmate: they all fall, and the hole opens');
  s = board({ type: 'king', x: 3, y: 3 }, [{ type: 'king', x: 3, y: 4, brain: 'crown' }, { type: 'knight', x: 0, y: 0, brain: 'still' }]);
  n = R.respond(s);
  ok(n.pieces[0].taken, 'the leader takes an unguarded attacker beside it');
  s = board({ type: 'king', x: 3, y: 3 }, [{ type: 'king', x: 3, y: 4, brain: 'crown' }, { type: 'knight', x: 0, y: 0, brain: 'still' }]);
  s.stones = [{ type: 'rook', x: 3, y: 0 }];
  n = R.respond(s);
  ok(!n.pieces[0].taken, 'but not one your stone guards');

  // 5. Stone: a piece of Stone leaves a stone; the stone strikes what comes into its reach.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'stone' }, [walker('knight', 3, 1, [[-1, 2], [1, -2]]), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const leave = R.movesFor(s, 0).find((m) => m.stone && m.x === 0 && m.y === 1);
  ok(leave, 'a piece of Stone can leave a stone');
  n = R.apply(s, { p: 0, ...leave });
  ok(n.stones.length === 1 && n.pieces[0].stoneUsed, 'it leaves one, once');
  ok(!R.movesFor(n, 0).some((m) => m.stone), 'and only once a board');
  const st = R.initialState({ ...s.day });
  st.stones = [{ type: 'rook', x: 2, y: 0 }];
  st.foes[0].x = 3; st.foes[0].y = 1; st.foes[0].pattern = [[-1, 2], [1, -2]];
  const after = R.respond(st);
  ok(after.tlog.some((l) => l.what === 'stone') || after.foes[0].x !== 2, 'a stone strikes what steps into its reach');
  const still = R.initialState({ ...s.day });
  still.stones = [{ type: 'rook', x: 4, y: 0 }]; // the pawn statue stands on its file, at (4, 4)
  still.foes[0].taken = true;
  ok(!R.respond(still).tlog.some((l) => l.what === 'stone'), 'a stone does not take a statue that only stands in its line');
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
    ok(legal && end.won && end.hole, `depth ${d}: the par line clears the board and opens the hole`);
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

console.log(fails ? `${fails} checks failed.` : 'Adventure: statues, the Changeling, routes, the hole, the set, tactics (pins, sentries, flight, the leader, stones), rabbits, dealing and cards check out.');
if (fails) process.exit(1);

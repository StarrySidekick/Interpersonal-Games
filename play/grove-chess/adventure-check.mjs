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
import { modeDefaults, levelSettings, adventurePar, EAGLE_ROOM } from './modes.js';
import { newRun, handSettings, adventureCards, parVerdict, PAR_CARDS, PAR_AUTO, ADVENTURE_GIFTS, adventureSet, afterAdventure, takeRabbits, netCatches, RABBITS_FOR_PIECE, WEAPON_ORDER } from './run.js';
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
  const lv = deal(3, ['changeling'], sd, { still: 12, sentries: 0, scared: 0, crown: false });
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
for (const d of [1, 2, 3, 5, 8, 11, 14]) for (let sd = 1; sd <= 12; sd++) {
  const lv = deal(d, ['rook'], 100 * d + sd);
  const st = R.initialState(lv), W = lv.W;
  const army = st.foes.filter((f) => f.type !== 'rabbit');
  ok(army.some((f) => f.brain === 'possessed'), `depth ${d} (${sd}): at least one of theirs walks a route`);
  ok(army.every((f) => ['possessed', 'still', 'sentry', 'scared'].includes(f.brain)), `depth ${d} (${sd}): theirs are statues, walkers, sentries or scared; no leader, nothing that thinks`);
  ok(army.every((f) => f.type !== 'pawn' || f.brain === 'still'), `depth ${d} (${sd}): pawns are statues`);
  ok(army.every((f) => !f.route || f.pattern.every(([dx, dy]) => dx || dy)), `depth ${d} (${sd}): walkers never rest (a step every turn)`);
  const allowed = ['gears', ...(d >= 4 ? ['vines'] : []), ...(d >= 6 ? ['stars'] : []), ...(d >= 8 ? ['spirals'] : [])];
  ok(army.every((f) => (f.brain === 'possessed' ? allowed.includes(f.suit) : f.brain === 'sentry' ? f.suit === 'stone' : f.brain === 'scared' ? f.suit === 'hearts' : !f.suit)), `depth ${d} (${sd}): walkers carry a suit rabbit the depth allows, sentries a stone one, scared ones a hearts one`);
  if (d < 3) ok(!army.some((f) => f.brain === 'scared'), `depth ${d} (${sd}): no hearts rabbits before depth 3`);
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

// One piece on the board, chosen from your set (2026-10-15): each move
// names which piece it is; once moved, a piece waits until all the set have
// had their turn; each keeps its own while it waits.
{
  const run = newRun(['rook', 'knight', 'bishop'], 3, null); run.depth = 2;
  run.hand[1].suit = 'hearts'; run.hand[1].lives = 2;
  const lv = makeLevel(levelSettings(M, { depth: 2, hand: handSettings(run) }, rng('cycle')), 31);
  let c = R.initialState(lv);
  ok(lv.pieces.length === 1 && lv.cycle?.length === 3, 'one piece on the board, three in the set');
  ok(R.initialState(lv).set[1].suit === 'hearts', 'each piece of the set keeps its suit while it waits');
  const as = (s) => [...new Set(R.allMoves(s).filter((m) => m.p >= 0).map((m) => m.as))].sort().join();
  ok(as(c) === '0,1,2', 'at first any of the three can move');
  // Bishop first, then the rook: no move may use either again until the knight has gone.
  const safe = (s, j) => R.allMoves(s).find((m) => m.as === j && !R.apply(s, m).arrived && !R.isOver(R.apply(s, m)));
  const m1 = safe(c, 2);
  ok(m1 && R.isLegal(c, m1), 'choosing the bishop and moving it is legal');
  c = R.apply(c, m1);
  ok(c.pieces[0].type === 'bishop' && as(c) === '0,1', 'the bishop stays on the board, used; the other two are ready');
  ok(!R.isLegal(c, { ...R.movesFor(c, 0)[0], p: 0, as: 2 }), 'the bishop cannot go again yet');
  const m2 = safe(c, 0);
  c = R.apply(c, m2);
  ok(c.pieces[0].type === 'rook' && as(c) === '1', 'then only the knight is ready');
  const m3 = safe(c, 1);
  c = R.apply(c, m3);
  ok(c.pieces[0].type === 'knight' && as(c) === '0,1,2', 'all three have gone: a new round, all ready again');
  ok(R.setView(c).map((v) => v.p.type).join() === 'rook,knight,bishop' && R.setView(c).filter((v) => v.on).length === 1, 'setView: the set in its own order, one on the board');
  // A pass spends the turn of the piece on the board (2026-10-16), and a
  // finished round counts up, so the page can start again from the first.
  const p0 = R.initialState(lv), passed = R.apply(p0, { p: -1, x: 0, y: 0 });
  ok(R.isLegal(p0, { p: -1, x: 0, y: 0 }) && !R.setReady(passed, passed.ci) && R.firstReady(passed) === 1, 'a pass: the piece on the board has had its turn, and the next is up');
  ok((c.round || 0) === 1, 'the round counts up when all three have gone');
  const lineOf = [m1, m2, m3], { ok: legal, states } = R.replay(lv, lineOf);
  ok(legal && R.stateKey(states[3]) === R.stateKey(c), 'a replay of the moves, each naming its piece, ends the same');
}

// Rabbits are suits (2026-10-16): each suit's face on your piece and on
// theirs. Boards set out by hand on Adventure's rules.
{
  const base = deal(4, ['rook'], 4242);
  ok(base.rules.suitRabbits, 'Adventure has rabbits as suits');
  const board = (mine, foes, set = null) => R.initialState({ ...base, pieces: [{ ...mine }], cycle: set || undefined, hole: null, stumps: new Set(),
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  const walker = (type, x, y, steps, suit) => ({ type, x, y, brain: 'possessed', route: true, pattern: steps, patternName: 'Shuttle', suit, ...(suit === 'hearts' ? { lives: 2 } : {}) });
  const W = base.W;

  // Gears, yours: it moves as any other piece of your set as well.
  let s = board({ type: 'rook', x: 2, y: 2, suit: 'gears' }, [{ type: 'pawn', x: 4, y: 4, brain: 'still' }], [{ type: 'rook', suit: 'gears' }, { type: 'bishop' }, { type: 'knight' }]);
  const ms = R.movesFor(s, 0);
  ok(ms.some((m) => m.gear === 'bishop' && m.x === 3 && m.y === 3) && ms.some((m) => m.gear === 'knight' && m.x === 3 && m.y === 4), 'a gears rabbit moves as the bishop or the knight of its set');
  ok(R.turnsOf({ suit: 'gears' }) === 1, 'and has one turn a round, like the rest');

  // Stars, yours: it moves twice every turn it goes.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'stars' }, [{ type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  let n = R.apply(s, { p: 0, x: 0, y: 1 });
  ok(n.bonus?.why === 'stars', 'a stars rabbit: a second move');
  n = R.apply(R.apply(n, { p: 0, x: 1, y: 1 }), { p: 0, x: 1, y: 2 });
  ok(n.bonus?.why === 'stars', 'and again the next time it goes');

  // Spirals, yours: after taking, it can take again.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'spirals' }, [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'bishop', x: 3, y: 2, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(n.bonus?.why === 'spirals' && R.movesFor(n, 0).every((m) => m.cap), 'a spirals rabbit takes, and may take again');
  ok(!R.movesFor(board({ type: 'rook', x: 0, y: 0, suit: 'spirals' }, [{ type: 'pawn', x: 4, y: 4, brain: 'still' }]), 0).some((m) => m.wrapped), 'and no longer goes round the sides');

  // Vines, yours: a trail where it went; one of theirs landing on it is caught.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'vines' }, [walker('knight', 1, 3, [[-1, -2], [1, 2]], 'gears'), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const mid = R.playerMove(s, { p: 0, x: 0, y: 3 });
  ok(['0,0', '0,1', '0,2'].every((q) => mid.vines.some((v) => v.side === 'you' && `${v.x},${v.y}` === q)), 'a vines rabbit leaves vines on the squares it left and passed');
  n = R.respond(mid);
  ok(n.foes[0].taken && n.tlog.some((l) => l.what === 'vine' && l.side === 'you'), 'their walker steps onto the vine and is caught');
  ok(!(n.vines || []).some((v) => v.side === 'you'), 'and your vines wither after their turn');

  // Vines, theirs: they walk and leave a trail; land on it and you are caught.
  s = board({ type: 'rook', x: 0, y: 1 }, [walker('rook', 2, 0, [[0, 2], [0, -2]], 'vines'), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 0 });
  ok(n.foes[0].y === 2 && ['2,0', '2,1'].every((q) => n.vines?.some((v) => v.side === 'foe' && `${v.x},${v.y}` === q)), 'their vines rabbit leaves a trail');
  ok(R.reachMaps(n).theirs.has(0 * W + 2), 'which is ringed as danger');
  const caught = R.playerMove(n, { p: 0, x: 2, y: 0 });
  ok(caught.pieces[0].taken && caught.pieces[0].vined, 'land on it and it catches you');
  const passed = R.playerMove(n, { p: 0, x: 1, y: 0 });
  ok(!passed.pieces[0].taken && (passed.vines || []).every((v) => v.side !== 'foe'), 'their vines wither once your turn is over');

  // Stars, theirs: two steps a turn.
  s = board({ type: 'rook', x: 0, y: 4 }, [walker('rook', 2, 0, [[0, 1], [0, 1], [0, -1], [0, -1]], 'stars'), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 3 });
  ok(n.foes[0].y === 2, `their stars rabbit walks two steps (${n.foes[0].x},${n.foes[0].y})`);

  // Hearts, theirs: the scared rabbit (2026-10-16): attacked, it runs.
  s = board({ type: 'rook', x: 0, y: 0 }, [{ type: 'knight', x: 2, y: 2, brain: 'scared', suit: 'hearts' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok((n.foes[0].x !== 2 || n.foes[0].y !== 2) && n.tlog.some((l) => l.what === 'flee' && l.k === 0), 'their hearts rabbit runs when attacked');

  // Stone, yours: a stone stands two turns.
  ok(R.STONE_TURNS === 2, 'stones stand two turns');
  // Your stones' reach is shown (2026-10-16): a rook stone at (1, 1) reaches its row and file.
  s = board({ type: 'bishop', x: 4, y: 0 }, [{ type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  s.stones = [{ type: 'rook', x: 1, y: 1, left: 2 }];
  const reach = R.reachMaps(s, true).stones;
  ok(reach.has(1 * W + 3) && reach.has(3 * W + 1) && !reach.has(2 * W + 2), 'your stone\u2019s reach, for the page to ring');
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
  // Squash (2026-10-15): a sword or a lance still takes by landing on a
  // piece in Adventure; without the rule (the descent) it cannot.
  const base = makeLevel(levelSettings(M, { depth: 1, hand: handSettings(newRun(['rook'], 3, null)) }, rng('sq')), 900);
  for (const weapon of ['sword', 'lance']) {
    const st = (squash) => R.initialState({ ...base, pieces: [{ type: 'rook', x: 0, y: 0, weapon, wl: 1 }], cycle: undefined, hole: null, stumps: new Set(),
      foes: [{ type: 'knight', x: 0, y: 3, brain: 'still', target: true }, { type: 'pawn', x: 4, y: 4, brain: 'still', target: true }], rules: { ...base.rules, squash } });
    ok(base.rules.squash && R.movesFor(st(true), 0).some((m) => m.cap && m.x === 0 && m.y === 3), `a ${weapon} can squash in Adventure`);
    ok(!R.movesFor(st(false), 0).some((m) => m.cap && m.x === 0 && m.y === 3), `without squash, a ${weapon} cannot land on a piece`);
  }
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

// Tactics (2026-10-15): pins, sentries, scared flight, the leader, stones.
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
  ok(n.pieces[0].taken && n.foes[0].x === 4 && n.foes[0].y === 0 && n.foes[0].struck?.join() === '4,3', 'a sentry takes your piece from where it stands (it never moves)');
  s = board({ type: 'bishop', x: 1, y: 4 }, [{ type: 'rook', x: 2, y: 3, brain: 'sentry' }, { type: 'knight', x: 4, y: 1, brain: 'still' }]);
  n = R.respond(s);
  ok(!n.pieces[0].taken, 'a pinned sentry cannot strike');

  // 3. Scared: attacked twice at once (a fork), only one gets away.
  s = board({ type: 'knight', x: 2, y: 2 }, [{ type: 'rook', x: 0, y: 1, brain: 'scared' }, { type: 'bishop', x: 4, y: 3, brain: 'scared' }]);
  n = R.respond(s);
  ok((n.foes[0].x !== 0 || n.foes[0].y !== 1) && n.foes[1].x === 4 && n.foes[1].y === 3 && n.foes[1].trapped, 'a fork: the rook runs, the bishop is left');
  ok(n.tlog.some((l) => l.what === 'flee' && l.k === 0) && n.tlog.some((l) => l.what === 'trapped' && l.k === 1 && l.fork), 'said as a fork');

  // 4. Check (a lab setting only since 2026-10-15; Adventure deals no leader):
  // the leader flees; a walker blocks instead if it can; mate when nothing works.
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

  // 5. Stone (2026-10-15): every move of a piece of Stone leaves a stone,
  // which stands for three turns; the stone strikes what comes into its reach.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'stone' }, [walker('knight', 3, 1, [[-1, 2], [1, -2]]), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  ok(!R.movesFor(s, 0).some((m) => m.stone), 'no button: nothing to choose');
  n = R.apply(s, { p: 0, x: 0, y: 1 });
  const first = () => n.stones.find((t) => t.x === 0 && t.y === 0);
  ok(n.stones.length === 1 && first()?.left === R.STONE_TURNS - 1, 'a move leaves a stone where it was, its first turn spent');
  const life = [first()?.left];
  for (let k = 0; k < 2; k++) {
    const mv = R.allMoves(n).find((m) => { if (m.p < 0) return false; const b = R.apply(n, m); return !b.arrived && !R.isOver(b); });
    if (!mv) break;
    n = R.apply(n, mv);
    life.push(first()?.left);
  }
  ok(life.join() === '1,,', `it lasts two turns, then crumbles (${life.join(' ')})`);
  ok(n.stones.length === 1 && n.stones[0].left === 1, 'every move left one, each with its own turns');
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
// A piece of your set taken (2026-10-15): it is gone, the next comes on
// where you came in (out of their reach), and the board goes on; only the
// last one taken loses it. And the net: what it takes joins you whole.
{
  const base = deal(1, ['rook'], 7777);
  const board = (cycle, foes) => R.initialState({ ...base, pieces: [{ ...cycle[0] }], cycle: cycle.length > 1 ? cycle.map(({ x, y, ...o }) => o) : undefined,
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), hole: null, stumps: new Set(), rules: { ...base.rules, tactics: true } });
  let s = board([{ type: 'rook', x: 4, y: 3 }, { type: 'knight' }], [{ type: 'rook', x: 4, y: 0, brain: 'sentry' }, { type: 'pawn', x: 0, y: 4, brain: 'still' }]);
  let n = R.respond(s);
  const p = n.pieces[0], W = n.day.W;
  ok(n.arrived && n.set[0].lost && p.type === 'knight' && !p.taken && !R.isOver(n), 'a piece taken: the next of the set comes on, and the board goes on');
  ok(!n.foes.some((f) => !f.taken && f.x === p.x && f.y === p.y) && !R.reachMaps(n).theirs.has(p.y * W + p.x), 'it comes on a free square out of their reach');
  ok(R.setLeft(n) === 1 && R.setView(n).filter((v) => !v.lost).length === 1, 'the one taken is out of the set');
  const run = newRun(['rook', 'knight'], 5, null);
  afterAdventure(run, n, [0, 1]);
  ok(run.hand.length === 1 && run.hand[0].base === 'knight' && run.lost[0].base === 'rook', 'after the board, the one taken is gone for good');
  const last = R.clone(n); last.pieces[0].x = 4; last.pieces[0].y = 2;
  ok(R.isOver(R.respond(last)), 'the last of the set taken: the board is lost');

  // The net, at level 1: the first piece it takes joins you whole, the next leaves a rabbit.
  s = board([{ type: 'rook', x: 0, y: 0, weapon: 'net', wl: 1 }], [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'bishop', x: 3, y: 2, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(n.foes[0].taken && n.foes[0].netted && n.pieces[0].netted === 1, 'the net catches the first piece it takes');
  n = R.apply(n, { p: 0, x: 3, y: 2 });
  ok(n.foes[1].taken && !n.foes[1].netted, 'a net of level 1 holds one a board');
  const r = newRun(['rook'], 5, null);
  ok(netCatches(r, n).join() === 'knight' && r.hand.length === 2 && r.hand[1].base === 'knight', 'what the net caught joins your collection');
  takeRabbits(r, n);
  ok(!r.rabbits.knight && r.rabbits.bishop === 1, 'and leaves no rabbit; the rest do');
  ok(!WEAPON_ORDER.includes('net') && R.canArm('knight', 'net'), 'the net is Adventure\u2019s own, and any piece can carry one');
}

// The hole opens beside your piece, on the way it was going (2026-10-15:
// not toward the middle every time).
{
  const base = deal(1, ['rook'], 7777);
  const st = R.initialState({ ...base, w: 5, h: 5, pieces: [{ type: 'rook', x: 0, y: 0 }], cycle: undefined, hole: null, stumps: new Set(),
    foes: [{ type: 'knight', x: 0, y: 3, brain: 'still', target: true }], rules: { ...base.rules } });
  const n = R.apply(st, { p: 0, x: 0, y: 3 });
  ok(n.won && n.hole && n.hole.x === 0 && n.hole.y === 4, `the hole opens straight ahead (${n.hole?.x},${n.hole?.y})`);
}
// A bishop after the first board, a knight after the third; and the cards
// with no choice.
ok(ADVENTURE_GIFTS[1] === 'bishop' && ADVENTURE_GIFTS[3] === 'knight' && !ADVENTURE_GIFTS[2], 'the gifts');
ok(PAR_AUTO.bogey === 'card' && PAR_AUTO.worse === 'all' && !PAR_AUTO.par, 'a bogey gives one card to place; worse, one placed by chance');

// Par by depth (2026-10-15): 5, one more every three boards, at most 15.
ok([1, 3, 4, 6, 7, 31, 60].map(adventurePar).join() === '5,5,6,6,7,15,15', 'par by depth');
// Every board dealt is won by the solver, in two under par or three (so an
// eagle is always there to find).
for (const [d, hand] of [[1, ['rook']], [2, ['rook', 'bishop']], [4, ['rook', 'bishop', 'knight']], [7, ['rook', 'bishop', 'knight']], [13, ['rook', 'knight', 'camel']], [31, ['rook', 'bishop', 'knight']]]) {
  const r = newRun(hand, 3, null); r.depth = d;
  const S = levelSettings(M, { depth: d, hand: handSettings(r) }, rng('check:' + d));
  ok(S.parMax === adventurePar(d) - EAGLE_ROOM, `depth ${d}: par ${adventurePar(d)}, dealt to be won in ${S.parMin} to ${S.parMax}`);
  const t0 = Date.now();
  const res = await new Promise((done) => searchLayouts({ settings: S, seed: 7000 + d, parMin: S.parMin, parMax: S.parMax, maxMs: 15000, quick: true }, (m) => { if (m.type !== 'progress') done(m); }));
  const got = res.type === 'done' ? res : res.best;
  ok(got?.line && got.par <= S.parMax, `depth ${d} deals a board the solver wins in ${got?.par} (${res.type})`);
  res.line = got?.line; res.seed = got?.seed;
  if (res.line) {
    const { states, ok: legal } = R.replay(makeLevel(S, res.seed), res.line);
    const end = states[states.length - 1];
    ok(legal && end.won && end.hole, `depth ${d}: the par line clears the board and opens the hole`);
  }
  ok(Date.now() - t0 < 12000, `depth ${d} is found in good time (${Date.now() - t0} ms)`);
}

// Cards by par, and never a piece (pieces come from rabbits).
const r2 = newRun(['rook'], 5, null); r2.depth = 6;
for (const [how, want] of [['eagle', 4], ['birdie', 3], ['par', 2], ['bogey', 1], ['worse', 1]]) {
  const cards = adventureCards(r2, PAR_CARDS[how], rng('cards:' + how));
  ok(cards.length === want, `${how} par gives ${want}`);
  ok(cards.every((c) => c.kind === 'suit' || c.kind === 'weapon'), `${how} par: suits and weapons only`);
}
ok([2, 3, 4, 5, 6, 7].map((t) => parVerdict(t, 5, true)).join() === 'albatross,eagle,birdie,par,bogey,worse' && parVerdict(3, 5, false) === 'worse', 'the verdicts, in golf\u2019s words');

console.log(fails ? `${fails} checks failed.` : 'Adventure: statues, the Changeling, routes, the hole, choosing from the set, rabbits as suits, losing a piece, the net, tactics (pins, sentries, flight, the leader, stones), rabbits, dealing and cards check out.');
if (fails) process.exit(1);

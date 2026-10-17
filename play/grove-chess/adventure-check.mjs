// Proves Adventure's parts of the Grove (2026-10-15) do what they say: their
// statues never move or take; the Changeling takes on the moves of what it
// takes; the pieces with a rabbit inside walk short routes that always come
// home and never get stuck; the hole opens once they are all taken and your
// piece jumps in; one piece on the board takes turns through your set; five
// of a bigger collection are drawn each board; three rabbits of a kind make
// that piece; Adventure deals a board with a par at every depth; and its
// cards come one, two or three by par. Since 2026-10-16: the troupe, rabbits
// with a kind and a suit, hearts that stay, stars that take once, gears that
// swap with anything, the mace's stun, the shield's push, your pieces with a
// rabbit standing by themselves, and a deck of at most sixteen.
//
//   node play/grove-chess/adventure-check.mjs

import * as R from './rules.js';
import { makeLevel, searchLayouts, ROUTES } from './lab.js';
import { modeDefaults, levelSettings, adventurePar, EAGLE_ROOM } from './modes.js';
import { canTakeWeapon, newRun, handSettings, adventureCards, parVerdict, PAR_CARDS, PAR_AUTO, ADVENTURE_GIFTS, adventureSet, afterAdventure, takeTally, netCatches, TAKE_FOR_PIECE, WEAPON_ORDER, rabbitsTaken, ADVENTURE_MAX, applyReward, SUITS } from './run.js';
import { rng } from '../../engine/seed.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const M = modeDefaults('adventure');
// Hand-built positions below are laid out on five by five; Adventure deals
// smaller boards than that at first since 2026-10-17, so they ask for it.
const FIVE = { w: 5, h: 5, foeRows: 4 };
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
  ok(army.every((f) => ['possessed', 'still', 'sentry', 'scared', ...(d >= 4 ? ['simple'] : []), ...(d >= 7 ? ['trap'] : []), ...(d >= 10 ? ['sentient'] : [])].includes(f.brain)), `depth ${d} (${sd}): theirs are statues, walkers, sentries or scared (simple from depth 4, traps from 7, sentient from 10); no leader`);
  ok(army.every((f) => f.brain !== 'simple' || (f.dir && R.simpleNext(st, f, 'foe'))), `depth ${d} (${sd}): a simple rabbit has a line, and a move along it`);
  ok(army.every((f) => f.type !== 'pawn' || f.brain === 'still'), `depth ${d} (${sd}): pawns are statues`);
  ok(army.every((f) => !f.route || f.pattern.every(([dx, dy]) => dx || dy)), `depth ${d} (${sd}): walkers never rest (a step every turn)`);
  const allowed = [...(d >= 4 ? ['hearts'] : []), ...(d >= 5 ? ['vines'] : []), ...(d >= 6 ? ['stars'] : []), ...(d >= 8 ? ['spirals'] : []), ...(d >= 10 ? ['gears'] : [])];
  ok(army.every((f) => (f.brain === 'still' ? !f.suit || (f.suit === 'hearts' && d >= 4) : !f.suit || allowed.includes(f.suit))), `depth ${d} (${sd}): a rabbit carries no suit or one the depth allows; a statue none, or hearts`);
  ok(army.every((f) => (f.suit === 'hearts') === (f.lives === 2)), `depth ${d} (${sd}): hearts, and only hearts, is two lives`);
  ok(army.every((f) => R.PIECES[f.type].kind === 'classic' || R.PIECES[f.type].kind === 'troupe'), `depth ${d} (${sd}): no fairy pieces but the troupe`);
  if (d < 4) ok(army.every((f) => R.PIECES[f.type].kind === 'classic'), `depth ${d} (${sd}): classic pieces only before depth 4`);
  if (d < 3) ok(!army.some((f) => f.brain === 'scared'), `depth ${d} (${sd}): no hearts rabbits before depth 3`);
  const walk = army.filter((f) => f.brain === 'possessed');
  walkers += walk.length;
  ok(walk.every((f) => f.route && ROUTES[f.patternName] && f.pattern.length === ROUTES[f.patternName].len), `depth ${d} (${sd}): each walks a named route`);
  // Their turns alone, your piece out of the way: 24 turns of everything.
  // (A sentient rabbit goes where it likes, and may stand in a loop's way.)
  if (army.some((f) => f.brain === 'sentient')) continue;
  let c = R.clone(st);
  c.pieces = [];
  // (Simple rabbits stand still for this: they go along lines of their own,
  // and may stand in a loop's way, as a sentient one may.)
  for (const f of c.foes) if (f.brain === 'simple') f.brain = 'still';
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
  // (Five by five, so the moves below have room: depth 2 deals three or
  // four squares a side since 2026-10-17.)
  const lv = makeLevel({ ...levelSettings(M, { depth: 2, hand: handSettings(run) }, rng('cycle')), w: 5, h: 5, foeRows: 4 }, 31);
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
  // Since 2026-10-16 (Timothy: "pieces ... leave themselves behind after
  // being played"; 2026-10-17: "the piece moves, then its transforms into
  // the next piece. then, after that piece leaves that spot, the old piece
  // stays there").
  ok(c.pieces[0].type === 'rook' && c.pieces[0].x === m1.x && c.pieces[0].y === m1.y && !R.alliesOf(c).length && c.pending === 2 && as(c) === '0,1', 'the bishop moves and turns into the rook where it landed; the other two are ready');
  ok(!R.isLegal(c, { ...R.movesFor(c, 0)[0], p: 0, as: 2 }), 'the bishop cannot go again yet');
  const m2 = safe(c, 0);
  c = R.apply(c, m2);
  ok(c.pieces[1]?.type === 'bishop' && c.pieces[1].ally && c.pieces[1].x === m1.x && c.pieces[1].y === m1.y, 'the rook moves off, and the bishop stays on that square, by itself');
  ok(c.pieces[0].type === 'knight' && c.pieces[0].x === m2.x && c.pieces[0].y === m2.y && c.pending === 0 && as(c) === '1', 'the rook turns into the knight where it landed; only the knight is ready');
  const m3 = safe(c, 1);
  c = R.apply(c, m3);
  ok(c.pieces[0].type === 'knight' && c.pieces[0].x === m3.x && c.pieces[0].y === m3.y && as(c) === '0,1,2', 'all three have gone: a new round, from where the knight landed, all ready again');
  ok(!R.alliesOf(c).length && c.lifted === 2 && c.pending == null, '"after the full set is played, they are removed from the board"');
  ok(R.setView(c).map((v) => v.p.type).join() === 'rook,knight,bishop' && R.setView(c).filter((v) => v.on).length === 1, 'setView: the set in its own order, one on the board');
  // A pass spends the turn of the piece on the board (2026-10-16), and a
  // finished round counts up, so the page can start again from the first.
  const p0 = R.initialState(lv), passed = R.apply(p0, { p: -1, x: 0, y: 0 });
  ok(R.isLegal(p0, { p: -1, x: 0, y: 0 }) && !R.setReady(passed, passed.ci) && R.firstReady(passed) === 1, 'a pass: the piece on the board has had its turn, and the next is up');
  ok((c.round || 0) === 1, 'the round counts up when all three have gone');
  const lineOf = [m1, m2, m3], { ok: legal, states } = R.replay(lv, lineOf);
  ok(legal && R.stateKey(states[3]) === R.stateKey(c), 'a replay of the moves, each naming its piece, ends the same');
}

// Suits (2026-10-16): the same on either side. Boards set out by hand on
// Adventure's rules: a 5 x 5 board, your piece, their pieces.
{
  const base = { ...deal(1, ['rook'], 4242, FIVE), W: 5, H: 5, holes: new Set() };
  ok(base.rules.suitRabbits, 'Adventure has its rabbits and suits');
  const board = (mine, foes, set = null) => R.initialState({ ...base, pieces: [{ ...mine }], cycle: set || undefined, hole: null, stumps: new Set(),
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  const walker = (type, x, y, steps, suit) => ({ type, x, y, brain: 'possessed', route: true, pattern: steps, patternName: 'Shuttle', ...(suit ? { suit } : {}), ...(suit === 'hearts' ? { lives: 2 } : {}) });
  const W = base.W;
  ok(!SUITS.stone && Object.keys(SUITS).sort().join() === 'gears,hearts,spirals,stars,vines', 'five suits; Stone is gone');

  // Gears, yours: as its move, it trades squares with any piece on the board.
  let s = board({ type: 'rook', x: 2, y: 2, suit: 'gears' }, [{ type: 'knight', x: 4, y: 4, brain: 'still' }, { type: 'pawn', x: 0, y: 4, brain: 'still' }]);
  const sw = R.movesFor(s, 0).find((m) => m.swap && m.x === 4 && m.y === 4);
  ok(sw, 'a piece of gears can swap with one of theirs across the board');
  let n = R.playerMove(s, { p: 0, ...sw });
  ok(n.pieces[0].x === 4 && n.pieces[0].y === 4 && n.foes[0].x === 2 && n.foes[0].y === 2 && !n.foes[0].taken, 'and they trade squares, nothing taken');

  // Stars, yours: two moves, taking at most once.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'stars' }, [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'bishop', x: 3, y: 2, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(n.bonus?.why === 'stars' && n.bonus.noCap && !R.movesFor(n, 0).some((m) => m.cap), 'a piece of stars that took on its first move cannot take on its second');
  n = R.apply(s, { p: 0, x: 0, y: 1 });
  ok(n.bonus?.why === 'stars' && !n.bonus.noCap && R.movesFor(n, 0).some((m) => m.cap), 'one that did not take, can');
  n = R.apply(R.apply(n, { p: 0, x: 1, y: 1 }), { p: 0, x: 1, y: 2 });
  ok(n.bonus?.why === 'stars', 'and two moves again the next time it goes');

  // Spirals, yours: after taking, it can take again, and again.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'spirals' }, [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'bishop', x: 3, y: 2, brain: 'still' }, { type: 'pawn', x: 3, y: 4, brain: 'still' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(n.bonus?.why === 'spirals' && R.movesFor(n, 0).every((m) => m.cap), 'a piece of spirals takes, and may take again');
  n = R.apply(n, { p: 0, x: 3, y: 2 });
  ok(n.bonus?.why === 'spirals', 'and again');
  // But on a capture only (2026-10-16): a heart that holds sends it back
  // and ends the chain, so two hearts cost two moves, not one.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'spirals' }, [{ type: 'knight', x: 0, y: 2, brain: 'still', suit: 'hearts', lives: 2 }, { type: 'bishop', x: 3, y: 0, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(!n.bonus && n.foes[0].lives === 1 && !n.foes[0].taken && n.pieces[0].x === 0 && n.pieces[0].y === 0, 'a heart that holds sends a piece of spirals back, and its chain ends');
  ok(!R.movesFor(board({ type: 'rook', x: 0, y: 0, suit: 'spirals' }, [{ type: 'pawn', x: 4, y: 4, brain: 'still' }]), 0).some((m) => m.wrapped), 'and no longer goes round the sides');

  // Vines, yours: a trail where it went; one of theirs landing on it is caught.
  s = board({ type: 'rook', x: 0, y: 0, suit: 'vines' }, [walker('knight', 1, 3, [[-1, -2], [1, 2]]), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const mid = R.playerMove(s, { p: 0, x: 0, y: 3 });
  ok(['0,0', '0,1', '0,2'].every((q) => mid.vines.some((v) => v.side === 'you' && `${v.x},${v.y}` === q)), 'a piece of vines leaves vines on the squares it left and passed');
  n = R.respond(mid);
  ok(n.foes[0].taken && n.tlog.some((l) => l.what === 'vine' && l.side === 'you'), 'their walker steps onto the vine and is caught');
  ok(!(n.vines || []).some((v) => v.side === 'you'), 'and your vines wither after their turn');

  // Vines, theirs: they walk and leave a trail; land on it and you are caught.
  s = board({ type: 'rook', x: 0, y: 1 }, [walker('rook', 2, 0, [[0, 2], [0, -2]], 'vines'), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 0 });
  ok(n.foes[0].y === 2 && ['2,0', '2,1'].every((q) => n.vines?.some((v) => v.side === 'foe' && `${v.x},${v.y}` === q)), 'their robot of vines leaves a trail');
  ok(R.reachMaps(n).theirs.has(0 * W + 2), 'which is ringed as danger');
  const caught = R.playerMove(n, { p: 0, x: 2, y: 0 });
  ok(caught.pieces[0].taken && caught.pieces[0].vined, 'land on it and it catches you');
  const passed = R.playerMove(n, { p: 0, x: 1, y: 0 });
  ok(!passed.pieces[0].taken && (passed.vines || []).every((v) => v.side !== 'foe'), 'their vines wither once your turn is over');

  // Stars, theirs: two steps a turn.
  s = board({ type: 'rook', x: 0, y: 4 }, [walker('rook', 2, 0, [[0, 1], [0, 1], [0, -1], [0, -1]], 'stars'), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 3 });
  ok(n.foes[0].y === 2, `their robot of stars walks two steps (${n.foes[0].x},${n.foes[0].y})`);

  // A route's next square is framed in its loop's colour, not ringed red.
  s = board({ type: 'rook', x: 0, y: 4 }, [walker('rook', 2, 0, [[0, 1], [0, -1]]), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const rm = R.reachMaps(s);
  ok(rm.steps.has(1 * W + 2) && !rm.theirs.has(1 * W + 2), 'a robot’s next square is a step, not red danger');

  // Hearts, both sides (2026-10-16): hit, it stays and the taker goes back.
  s = board({ type: 'rook', x: 0, y: 0 }, [{ type: 'knight', x: 0, y: 3, brain: 'still', suit: 'hearts', lives: 2 }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.playerMove(s, { p: 0, x: 0, y: 3 });
  ok(!n.foes[0].taken && n.foes[0].lives === 1 && n.foes[0].x === 0 && n.foes[0].y === 3, 'their piece of hearts stays where it is, its heart spent');
  ok(n.pieces[0].x === 0 && n.pieces[0].y === 0 && n.pieces[0].bounced?.join() === '0,3', 'and your piece goes back where it came from');
  n = R.playerMove(R.respond(n), { p: 0, x: 0, y: 3 });
  ok(n.foes[0].taken, 'the second hit takes it');
  s = board({ type: 'rook', x: 2, y: 1, suit: 'hearts', lives: 2 }, [walker('knight', 1, 3, [[1, -2], [-1, 2]]), { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.respond(R.playerMove(s, { p: -1, x: 0, y: 0 }));
  ok(!n.pieces[0].taken && n.pieces[0].lives === 1 && n.pieces[0].x === 2 && n.pieces[0].y === 1, 'your piece of hearts stays where it is when they hit it');
  ok(n.foes[0].x === 1 && n.foes[0].y === 3 && n.foes[0].struck?.join() === '2,1', 'and theirs goes back where it came from');
  ok(n.foes[0].pattern[n.foes[0].i % 2].join() === '1,-2', 'a robot that bounced tries the same step again');

  // Scared, theirs: attacked, it runs, whatever its suit.
  s = board({ type: 'rook', x: 0, y: 0 }, [{ type: 'knight', x: 2, y: 2, brain: 'scared', suit: 'vines' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok((n.foes[0].x !== 2 || n.foes[0].y !== 2) && n.tlog.some((l) => l.what === 'flee' && l.k === 0), 'their scared rabbit runs when attacked');
  ok(n.vines?.some((v) => v.side === 'foe' && v.x === 2 && v.y === 2), 'and, of vines, leaves a vine where it was');

  // Sentient, theirs: it thinks, moves every turn, and takes you if it can.
  // A knight at (2, 2) reaches (0, 1) and (1, 0), among others.
  s = board({ type: 'rook', x: 0, y: 0 }, [{ type: 'knight', x: 2, y: 2, brain: 'sentient', mind: { iq: 6, trait: 'hunter' } }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 4 });
  ok(n.foes[0].x !== 2 || n.foes[0].y !== 2, 'a sentient rabbit moves');
  ok(R.apply(s, { p: 0, x: 0, y: 1 }).pieces[0].taken, 'and takes your piece standing where it can');
  ok(R.reachMaps(s).theirs.has(1 * W + 0), 'its whole reach is danger');
}

// The mace stuns round where it lands, and the stun holds (2026-10-16).
{
  const base = { ...deal(1, ['rook'], 4243, FIVE), W: 5, H: 5, holes: new Set() };
  const board = (mine, foes) => R.initialState({ ...base, pieces: [{ ...mine }], cycle: undefined, hole: null, stumps: new Set(), foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  let s = board({ type: 'rook', x: 0, y: 0, weapon: 'mace', wl: 2 }, [{ type: 'knight', x: 1, y: 2, brain: 'possessed', route: true, pattern: [[1, 2], [-1, -2]], patternName: 'Shuttle' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const m = R.movesFor(s, 0).find((q) => q.x === 0 && q.y === 2);
  ok(m?.stun?.includes(2 * base.W + 1), 'a slide with a mace stuns what stands beside where it lands');
  ok(!R.movesFor(s, 0).some((q) => q.push), 'and pushes nothing');
  const n = R.apply(s, { p: 0, ...m });
  ok(n.foes[0].x === 1 && n.foes[0].y === 2 && n.foes[0].sat && n.tlog.some((l) => l.what === 'stunned' && l.k === 0), 'the stunned robot sits out their turn, and it is said');
  const n2 = R.apply(n, { p: 0, x: 0, y: 3 });
  ok(n2.foes[0].x === 2 && n2.foes[0].y === 4, 'and walks again the turn after');
}

// The shield pushes (2026-10-16); off the board, a piece is taken. (One
// square on, as it was until the slide below: the rule the daily's first
// day, 2026-10-17, still plays.)
{
  const base = { ...deal(1, ['rook'], 4244, FIVE), W: 5, H: 5, holes: new Set() };
  const board = (mine, foes) => R.initialState({ ...base, pieces: [{ ...mine }], cycle: undefined, hole: null, stumps: new Set(), foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules, shieldSlide: false } });
  let s = board({ type: 'rook', x: 0, y: 0, weapon: 'shield', wl: 1 }, [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'bishop', x: 3, y: 0, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const W = base.W, ms = R.movesFor(s, 0);
  // (2026-10-17, Timothy: "for pieces with the shield weapon, always push,
  // no squashing anymore".)
  ok(!ms.some((q) => q.cap && q.x === 0 && q.y === 2), 'a shield never squashes');
  const push = ms.find((q) => q.push && q.x === 0 && q.y === 2);
  ok(push && push.push[0].to === 3 * W, 'or push the piece one square on');
  let n = R.playerMove(s, { p: 0, ...push });
  ok(n.pieces[0].y === 2 && n.foes[0].x === 0 && n.foes[0].y === 3 && !n.foes[0].taken && !n.foes[0].stun, 'it takes the square, and the pushed piece stands one on, not stunned');
  s = board({ type: 'rook', x: 0, y: 0, weapon: 'shield', wl: 1 }, [{ type: 'knight', x: 0, y: 4, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  const off = R.movesFor(s, 0).find((q) => q.push && q.y === 4);
  ok(off && off.push[0].to === -1 && R.takesAny(off), 'pushed off the board, it is taken');
  ok(!WEAPON_ORDER.includes('shield') && R.canArm('knight', 'shield'), 'the shield is Adventure’s own, and any piece can carry one');
}

// A shield's push slides (2026-10-17, Timothy: "shields causes enemy pieces
// to slide perpetually like sliders ... if it hits a piece both peices get
// stunned, if it hits the edge of the board it falls off").
{
  const base = { ...deal(1, ['rook'], 4244, FIVE), W: 5, H: 5, holes: new Set() };
  ok(base.rules.shieldSlide, 'Adventure slides what a shield pushes');
  const board = (mine, foes) => R.initialState({ ...base, pieces: mine.map((p) => ({ ...p })), cycle: undefined, hole: null, stumps: new Set(), foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  const W = base.W, rook = { type: 'rook', x: 0, y: 0, weapon: 'shield', wl: 1 };
  let s = board([rook], [{ type: 'knight', x: 0, y: 1, brain: 'still' }, { type: 'bishop', x: 0, y: 4, brain: 'still' }]);
  let push = R.movesFor(s, 0).find((q) => q.push && q.x === 0 && q.y === 1);
  ok(push && push.push[0].to === 3 * W && push.bump?.includes(3 * W) && push.bump.includes(4 * W), 'a pushed piece slides on until it meets a piece');
  let n = R.playerMove(s, { p: 0, ...push });
  ok(n.pieces[0].y === 1 && n.foes[0].y === 3 && n.foes[0].stun && n.foes[1].stun && !n.foes[0].taken, 'the shield takes its square; the slider and what it hit are both stunned');
  s = board([rook], [{ type: 'knight', x: 0, y: 2, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  push = R.movesFor(s, 0).find((q) => q.push && q.x === 0 && q.y === 2);
  ok(push && push.push[0].to === -1 && R.takesAny(push), 'one with nothing in its way slides off the edge and is taken');
  n = R.playerMove(s, { p: 0, ...push });
  ok(n.foes[0].taken && n.pieces[0].y === 2, 'and falls');
  s = board([rook], [{ type: 'knight', x: 0, y: 1, brain: 'still' }, { type: 'bishop', x: 0, y: 2, brain: 'still' }]);
  ok(!R.movesFor(s, 0).some((q) => q.x === 0 && q.y === 1), 'one that cannot move at all cannot be pushed');
  s = board([rook, { type: 'cat', x: 0, y: 4 }], [{ type: 'knight', x: 0, y: 1, brain: 'still' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  push = R.movesFor(s, 0).find((q) => q.push && q.x === 0 && q.y === 1);
  n = push && R.playerMove(s, { p: 0, ...push });
  ok(n && n.foes[0].y === 3 && n.foes[0].stun && n.pieces[1].stun, 'into a piece of yours, both are stunned too');
}

// The troupe (2026-10-16): the thespian changes its part every move.
{
  ok(['thespian', 'scribe', 'painter', 'bard', 'dancer'].every((k) => R.PIECES[k]?.kind === 'troupe'), 'the troupe is its own kind, so no other mode deals it');
  const base = { ...deal(1, ['rook'], 4245, FIVE), W: 5, H: 5, holes: new Set() };
  let s = R.initialState({ ...base, pieces: [{ type: 'thespian', x: 2, y: 2 }], cycle: undefined, hole: null, stumps: new Set(), foes: [{ type: 'pawn', x: 4, y: 4, brain: 'still', target: true }], rules: { ...base.rules } });
  ok(R.THESPIAN_ROLES.includes(s.pieces[0].role), `a thespian starts with a part (${s.pieces[0].role})`);
  const parts = new Set([s.pieces[0].role]);
  for (let t = 0; t < 8; t++) {
    const was = s.pieces[0].role, mv = R.movesFor(s, 0).find((m) => !m.cap);
    s = R.apply(s, { p: 0, ...mv });
    ok(s.pieces[0].role !== was, 'and a new one every time it moves');
    parts.add(s.pieces[0].role);
  }
  ok(parts.size >= 4, `parts at random (${[...parts].join(', ')})`);
}

// Your pieces with a rabbit (2026-10-16): it stays where it moved, the next
// comes on where it started, and it acts by itself from then on.
{
  const base = { ...deal(1, ['rook'], 4246, FIVE), W: 5, H: 5, holes: new Set() };
  const board = (cycle, foes) => R.initialState({ ...base, pieces: [{ ...cycle[0] }], cycle: cycle.map(({ x, y, ...o }) => o), hole: null, stumps: new Set(),
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  let s = board([{ type: 'rook', x: 0, y: 0, rabbit: 'sentry' }, { type: 'knight' }, { type: 'bishop' }], [{ type: 'knight', x: 2, y: 3, brain: 'still' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  let n = R.apply(s, { p: 0, x: 0, y: 3, as: 0 });
  ok(n.pieces.length === 1 && n.pieces[0].type === 'knight' && n.pieces[0].x === 0 && n.pieces[0].y === 3, 'the rook with a sentry rabbit moves, and turns into the knight there');
  n = R.apply(n, { p: 0, x: 1, y: 1, as: 1 });
  ok(n.pieces[1]?.ally && n.pieces[1].type === 'rook' && n.pieces[1].x === 0 && n.pieces[1].y === 3 && n.set[0].out === 1, 'the knight moves off, and the rook stays on that square');
  ok(!R.setReady(n, 0) && R.allMoves(n).every((m) => m.p <= 0), 'out of your set, and not yours to move');
  ok(n.foes[0].taken && n.tlog.some((l) => l.what === 'ally' && l.how === 'strike'), 'and its sentry strikes what is in its reach, from where it stands');

  // A robot walks there and back.
  s = board([{ type: 'rook', x: 0, y: 0, rabbit: 'robot' }, { type: 'knight' }, { type: 'bishop' }], [{ type: 'bishop', x: 4, y: 3, brain: 'still' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 3, as: 0 });
  const n1 = R.apply(n, { p: 0, x: 1, y: 1, as: 1 }), a = n1.pieces[1], start = [0, 3];
  ok(a?.ally && a.route && a.pattern?.length === 2, 'a robot rabbit of yours gets a loop');
  const n2 = R.apply(n1, { p: -1, x: 0, y: 0, as: 2 });
  ok((n1.pieces[1].x !== start[0] || n1.pieces[1].y !== start[1]) && n2.pieces[1].x === start[0] && n2.pieces[1].y === start[1], 'and walks it, there and back');
  ok(n2.pieces[1].lifted && !R.alliesOf(n2).length, 'and comes off when the whole set has had its turn');

  // A scared one runs from their reach.
  // (Their sentry at (1, 4) reaches down file 1, onto (1, 0); the knight
  // that turns up there has a heart to spare.)
  s = board([{ type: 'rook', x: 0, y: 0, rabbit: 'scared' }, { type: 'knight', suit: 'hearts', lives: 2 }, { type: 'bishop' }], [{ type: 'rook', x: 1, y: 4, brain: 'sentry' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  n = R.apply(R.apply(s, { p: 0, x: 1, y: 0, as: 0 }), { p: 0, x: 3, y: 1, as: 1 });
  ok(n.pieces[1]?.ally && !n.pieces[1].taken && n.pieces[1].x !== 1 && n.tlog.some((l) => l.what === 'ally' && l.how === 'run'), 'a scared rabbit of yours runs out of their reach, the turn it stays');

  // The last of your set ready taken: the set has all played, so the rook
  // comes off and is your piece again, where the knight was taken.
  s = board([{ type: 'rook', x: 0, y: 0, rabbit: 'sentry' }, { type: 'knight' }], [{ type: 'rook', x: 4, y: 2, brain: 'sentry' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 3, as: 0 });
  ok(n.pieces[0].type === 'knight', 'the knight comes on');
  const lose = R.allMoves(n).find((m) => m.p === 0 && m.y === 2 && m.x !== 4);
  n = R.apply(n, lose);
  ok(n.arrived && n.pieces[0].type === 'rook' && !n.pieces[0].taken && n.pieces[0].x === lose.x && n.pieces[0].y === lose.y && !R.isOver(n), 'the knight taken, the rook comes off the board and is your piece again where the knight fell');
  const run = newRun(['rook', 'knight'], 3, null);
  ok(afterAdventure(run, n, [0, 1]).lost.join() === '1', 'and after the board only the knight counts as lost');
}

// Simple rabbits and traps (2026-10-16, Timothy: "simple - just moves once,
// all the way if it's a slider and one hop for a leaper; trap - sentry but
// doesn't move back to its new spot"), theirs and yours.
{
  const base = { ...deal(1, ['rook'], 4246, FIVE), W: 5, H: 5, holes: new Set() };
  const board = (cycle, foes) => R.initialState({ ...base, pieces: [{ ...cycle[0] }], cycle: cycle.map(({ x, y, ...o }) => o), hole: null, stumps: new Set(),
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), rules: { ...base.rules } });
  const pass = (s, as) => R.apply(s, { p: -1, x: 0, y: 0, as });
  // Theirs: a simple rook slides its whole line, then back.
  let s = board([{ type: 'knight', x: 4, y: 0 }, { type: 'bishop' }], [{ type: 'rook', x: 0, y: 4, brain: 'simple' }, { type: 'pawn', x: 2, y: 2, brain: 'still' }]);
  ok(s.foes[0].dir?.join() === '0,-1', 'their simple rook takes the line toward you');
  let n = pass(s, 0);
  ok(n.foes[0].x === 0 && n.foes[0].y === 0, 'and goes all the way along it in one move');
  n = pass(n, 1);
  ok(n.foes[0].x === 0 && n.foes[0].y === 4 && n.foes[0].dir.join() === '0,1', 'at the end of its line it turns back, all the way again');
  // A leaper hops once.
  s = board([{ type: 'rook', x: 4, y: 0 }, { type: 'bishop' }], [{ type: 'knight', x: 0, y: 4, brain: 'simple' }, { type: 'pawn', x: 2, y: 2, brain: 'still' }]);
  const k0 = [s.foes[0].x, s.foes[0].y], d0 = s.foes[0].dir;
  n = pass(s, 0);
  ok(n.foes[0].x === k0[0] + d0[0] && n.foes[0].y === k0[1] + d0[1], 'a simple knight hops once');
  // Standing on its line, you are taken there.
  s = board([{ type: 'rook', x: 0, y: 0 }, { type: 'bishop' }], [{ type: 'rook', x: 0, y: 4, brain: 'simple' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2, as: 0 });
  ok(n.arrived?.lost.type === 'bishop' && n.foes[0].y === 2, 'a piece of yours on its line is taken where it stands');
  // Theirs: a trap takes as a sentry does, and stays.
  s = board([{ type: 'rook', x: 0, y: 0 }, { type: 'bishop' }], [{ type: 'knight', x: 2, y: 3, brain: 'trap' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2, as: 0 });
  ok(n.arrived?.lost.type === 'bishop' && n.foes[0].x === 0 && n.foes[0].y === 2 && n.tlog.some((l) => l.what === 'trap'), 'their trap takes what stands in its reach, and stays on that square');
  ok(R.reachMaps(R.initialState({ ...s.day })).sentry.has(2 * 5 + 0), 'its reach is ringed, as a sentry\u2019s is');
  // Yours: a simple rook stays, then slides its line and takes.
  s = board([{ type: 'rook', x: 0, y: 0, rabbit: 'simple' }, { type: 'knight' }, { type: 'bishop' }], [{ type: 'bishop', x: 4, y: 2, brain: 'still' }, { type: 'pawn', x: 2, y: 4, brain: 'still' }]);
  n = R.apply(R.apply(s, { p: 0, x: 0, y: 2, as: 0 }), { p: 0, x: 1, y: 0, as: 1 });
  ok(n.pieces[1]?.ally && n.pieces[1].dir?.join() === '1,0', 'a simple rabbit of yours, standing, takes a line toward theirs');
  ok(n.foes[0].taken && n.pieces[1].x === 4 && n.pieces[1].y === 2, 'and goes all the way along it, taking what is at the end');
  // Yours: a trap knight takes what comes into its reach, and stays there.
  s = board([{ type: 'knight', x: 0, y: 0, rabbit: 'trap' }, { type: 'rook' }, { type: 'bishop' }], [{ type: 'bishop', x: 3, y: 3, brain: 'still' }, { type: 'pawn', x: 4, y: 0, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 1, y: 2, as: 0 });
  ok(!R.alliesOf(n).length && !n.foes[0].taken, 'a trap of yours waits inside the next piece until that one moves');
  n = R.apply(n, { p: 0, x: 1, y: 0, as: 1 });
  ok(n.foes[0].taken && n.pieces[1].x === 3 && n.pieces[1].y === 3 && n.tlog.some((l) => l.how === 'trap'), 'then stands, takes what is in its reach, and stays where it took');
  ok(R.RABBIT_TYPES.includes('simple') && R.RABBIT_TYPES.includes('trap') && R.rabbitIn({ brain: 'trap' }) === 'trap' && R.rabbitIn({ brain: 'simple' }) === 'simple', 'both are rabbit kinds, theirs and yours');
}

// Vines (2026-10-17, Timothy: "it should leave a vine in your paths and if
// enemy move through it in the next turn, they get captured"): a piece that
// moves through a vine is caught there, theirs or yours.
{
  const base = { ...deal(1, ['rook'], 4246, FIVE), W: 5, H: 5, holes: new Set() };
  const board = (cycle, foes) => R.initialState({ ...base, pieces: [{ ...cycle[0] }], cycle: cycle.map(({ x, y, ...o }) => o), hole: null, stumps: new Set(),
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, i: 0, ...f })), rules: { ...base.rules } });
  // Your rook of Vines leaves (0,0) to (0,2) behind it; their rook slides
  // along row 1, through (0,1).
  let s = board([{ type: 'rook', x: 0, y: 0, suit: 'vines' }, { type: 'bishop' }], [{ type: 'rook', x: 4, y: 1, brain: 'simple', dir: [-1, 0] }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  s.foes[0].dir = [-1, 0];
  let n = R.playerMove(s, { p: 0, x: 0, y: 3, as: 0 });
  ok(n.vines.filter((v) => v.side === 'you').length === 3, 'a piece of Vines leaves a vine where it set out and on every square it passed');
  n = R.respond(n);
  ok(n.foes[0].taken && n.foes[0].x === 0 && n.foes[0].y === 1 && n.tlog.some((l) => l.what === 'vine'), 'their piece that moves onto the vine is caught on it');
  s = board([{ type: 'rook', x: 0, y: 0, suit: 'vines' }, { type: 'bishop' }], [{ type: 'queen', x: 3, y: 1, brain: 'simple' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  s.foes[0].dir = [-1, 0];
  s.foes[0].x = 4; s.foes[0].y = 1;
  n = R.playerMove(s, { p: 0, x: 0, y: 3, as: 0 });
  n.vines = n.vines.filter((v) => !(v.x === 0 && v.y === 1)).concat([{ x: 2, y: 1, side: 'you' }]);
  n = R.respond(n);
  ok(n.foes[0].taken && n.foes[0].x === 2 && n.foes[0].y === 1, 'and one that would slide on through it is stopped and caught there');
  // Theirs catch yours the same way.
  s = board([{ type: 'rook', x: 0, y: 0 }, { type: 'bishop' }], [{ type: 'bishop', x: 4, y: 4, brain: 'still' }, { type: 'pawn', x: 4, y: 3, brain: 'still' }]);
  s.vines = [{ x: 0, y: 2, side: 'foe' }];
  n = R.playerMove(s, { p: 0, x: 0, y: 4, as: 0 });
  ok(n.pieces[0].y === 2 && (n.pieces[0].taken || n.pieces[0].vined), 'a piece of yours sliding through a vine of theirs is caught on it');
}

// A set of four (2026-10-17, Timothy: "you roll a set of four pieces by
// default instead of 5"), and pieces of the troupe to find.
{
  ok(M.maxPieces === 4, 'Adventure\u2019s set is four');
  const r = newRun(['cat', 'bishop', 'knight', 'rook', 'painter', 'bard'], M.maxPieces, null);
  const pick = adventureSet(r, rng('four'));
  ok(pick.length === 4 && pick.includes(0), 'six in the deck: four drawn each board, the cat always one');
  const counts = { 1: 0, 5: 0 }, kinds = new Set();
  for (const d of [1, 5]) for (let k = 0; k < 400; k++) {
    const run = newRun(['cat', 'bishop'], 4, null); run.depth = d;
    for (const c of adventureCards(run, 3, rng(`find:${d}:${k}`))) if (c.kind === 'piece') { counts[d]++; kinds.add(c.type); }
  }
  ok(!counts[1] && counts[5] > 50 && [...kinds].every((t) => R.PIECES[t].kind === 'troupe') && kinds.size === 5, `a piece of the troupe now and then from depth 2 (${counts[5]} in 400 offers), all five to find`);
  const full = newRun(Array(16).fill('rook'), 4, null); full.depth = 5;
  let none = true;
  for (let k = 0; k < 200; k++) if (adventureCards(full, 3, rng(`full:${k}`)).some((c) => c.kind === 'piece')) none = false;
  ok(none, 'none once the deck holds sixteen');
  const run = newRun(['cat'], 4, null);
  applyReward(run, { kind: 'piece', type: 'dancer' });
  ok(run.hand.length === 2 && run.hand[1].base === 'dancer', 'a piece found joins your deck');
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
  // Squash (2026-10-15): a sword or a lance took by landing on a piece in
  // Adventure too, until 2026-10-17 (Timothy: "no squashing for sword or
  // lance either changed my mind. still squashing for mace though").
  const base = makeLevel(levelSettings(M, { depth: 1, hand: handSettings(newRun(['rook'], 3, null)) }, rng('sq')), 900);
  for (const weapon of ['sword', 'lance', 'mace']) {
    const st = R.initialState({ ...base, pieces: [{ type: 'rook', x: 0, y: 0, weapon, wl: 1 }], cycle: undefined, hole: null, stumps: new Set(),
      foes: [{ type: 'knight', x: 0, y: 3, brain: 'still', target: true }, { type: 'pawn', x: 4, y: 4, brain: 'still', target: true }], rules: { ...base.rules } });
    const lands = R.movesFor(st, 0).some((m) => m.cap && m.x === 0 && m.y === 3);
    ok(weapon === 'mace' ? lands : !lands, weapon === 'mace' ? 'a mace still squashes' : `a ${weapon} cannot land on a piece in Adventure`);
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

// Three of a kind: each piece taken counts toward its kind, three make that
// piece; a piece taken on the board is back next board.
{
  const run = newRun(['rook', 'knight'], 5, null);
  const end = { foes: [{ type: 'knight', taken: true }, { type: 'knight', taken: true }, { type: 'pawn', taken: true }, { type: 'bishop', taken: false }], pieces: [{ type: 'rook', taken: false }] };
  ok(takeTally(run, end).length === 0 && run.tally.knight === 2 && run.tally.pawn === 1 && !run.tally.bishop, 'one toward its kind for each piece taken');
  const made = takeTally(run, { foes: [{ type: 'knight', taken: true }], pieces: [] });
  ok(made.join() === 'knight' && run.tally.knight === 0 && run.hand.length === 3 && run.hand[2].base === 'knight', `${TAKE_FOR_PIECE} knights taken make a knight, and it joins your set`);
  // At most sixteen (2026-10-16).
  const big = newRun(Array(ADVENTURE_MAX).fill('rook'), 3, null);
  big.tally = { knight: 2 };
  const none = takeTally(big, { foes: [{ type: 'knight', taken: true }], pieces: [] });
  ok(!none.length && none.full.join() === 'knight' && big.hand.length === ADVENTURE_MAX, 'a deck of sixteen takes no more');
  const c = { pieces: [{ type: 'knight', taken: true }], set: [{ type: 'rook' }, { type: 'knight' }, { type: 'knight' }], ci: 1 };
  const af = afterAdventure(run, c, [0, 1, 2]);
  ok(run.hand.length === 3 && af.lost.join() === '1' && !af.all, 'the piece taken on the board is back next board; the rest stay too');
  ok(afterAdventure(run, { pieces: [{ type: 'knight', taken: true }], set: [{ type: 'rook', lost: true }, { type: 'knight' }, { type: 'knight', lost: true }], ci: 1 }, [0, 1, 2]).all, 'all of the set taken: the adventure is over');
}

// Tactics (2026-10-15): pins, sentries, scared flight, the leader, stones.
// Each on a board set out by hand: a 5 x 5 board, your piece, their pieces.
{
  const base = deal(1, ['rook'], 7777, FIVE);
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

}

// Every depth deals a board that can be cleared, with a par, ending in the hole.
// A piece of your set taken (2026-10-15): it is gone, the next comes on
// where you came in (out of their reach), and the board goes on; only the
// last one taken loses it. And the net: what it takes joins you whole.
{
  const base = deal(1, ['rook'], 7777, FIVE);
  const board = (cycle, foes) => R.initialState({ ...base, pieces: [{ ...cycle[0] }], cycle: cycle.length > 1 ? cycle.map(({ x, y, ...o }) => o) : undefined,
    foes: foes.map((f) => ({ target: true, mx: 1, my: 1, ...f })), hole: null, stumps: new Set(), rules: { ...base.rules, tactics: true } });
  let s = board([{ type: 'rook', x: 4, y: 3 }, { type: 'knight' }], [{ type: 'rook', x: 4, y: 0, brain: 'sentry' }, { type: 'pawn', x: 0, y: 4, brain: 'still' }]);
  let n = R.respond(s);
  const p = n.pieces[0], W = n.day.W;
  ok(n.arrived && n.set[0].lost && p.type === 'knight' && !p.taken && !R.isOver(n), 'a piece taken: the next of the set comes on, and the board goes on');
  ok(p.x === 4 && p.y === 3 && !n.foes.some((f) => !f.taken && f.x === p.x && f.y === p.y), 'it comes on where the one taken stood (the sentry never moved off it)');
  ok(R.setLeft(n) === 1 && R.setView(n).filter((v) => !v.lost).length === 1, 'the one taken is out of the set');
  const run = newRun(['rook', 'knight'], 5, null);
  afterAdventure(run, n, [0, 1]);
  ok(run.hand.length === 2 && run.hand[0].base === 'rook', 'after the board, the one taken is back');
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
  takeTally(r, n);
  ok(!r.tally.knight && r.tally.bishop === 1, 'and counts toward no three of a kind; the rest do');
  // A net's catch brings its rabbit, for certain (2026-10-16).
  s = board([{ type: 'rook', x: 0, y: 0, weapon: 'net', wl: 1 }], [{ type: 'knight', x: 0, y: 2, brain: 'possessed', route: true, pattern: [[1, 2], [-1, -2]], patternName: 'Shuttle', suit: 'spirals' }, { type: 'pawn', x: 4, y: 4, brain: 'still' }]);
  n = R.apply(s, { p: 0, x: 0, y: 2 });
  ok(rabbitsTaken(n, true).map((r) => `${r.rabbit}/${r.suit}`).join() === 'robot/spirals', 'the net\u2019s catch gives its rabbit: a robot rabbit of spirals');
  const r3 = newRun(['rook', 'knight'], 3, null);
  applyReward(r3, { kind: 'rabbit', rabbit: 'robot', suit: 'spirals' }, [1]);
  ok(r3.hand[1].rabbit === 'robot' && r3.hand[1].suit === 'spirals' && handSettings(r3).handMods[1].rabbit === 'robot', 'a rabbit put in a piece, with its suit, goes onto the board with it');
  ok(!WEAPON_ORDER.includes('net') && R.canArm('cat', 'net') && !R.canArm('knight', 'net') && !canTakeWeapon({ base: 'rook' }, 'net') && canTakeWeapon({ base: 'cat' }, 'net'), 'the net is Adventure\u2019s own, and only your cat can carry one (2026-10-17)');
}

// The hole opens beside your piece, on the way it was going (2026-10-15:
// not toward the middle every time).
{
  const base = deal(1, ['rook'], 7777, FIVE);
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
for (const [d, hand] of [[1, ['rook']], [2, ['rook', 'bishop']], [4, ['rook', 'bishop', 'knight']], [7, ['rook', 'bishop', 'knight']], [13, ['rook', 'knight', 'painter']], [31, ['rook', 'bishop', 'knight']]]) {
  const r = newRun(hand, 3, null); r.depth = d;
  let S = levelSettings(M, { depth: d, hand: handSettings(r) }, rng('check:' + d));
  ok(S.parMax === adventurePar(d) - EAGLE_ROOM, `depth ${d}: par ${adventurePar(d)}, dealt to be won in ${S.parMin} to ${S.parMax}`);
  const t0 = Date.now();
  // As the page deals (play/main.js find): a deal that finds nothing in its
  // time is dealt again with fewer of theirs.
  let res = null, got = null;
  for (let k = 0; k < 4 && !got?.line; k++) {
    if (k) S = levelSettings(M, { depth: d, hand: handSettings(r), relax: k }, rng('check:' + d + ':' + k));
    res = await new Promise((done) => searchLayouts({ settings: S, seed: 7000 + d, parMin: S.parMin, parMax: S.parMax, maxMs: k ? 6000 : 15000, quick: true }, (m) => { if (m.type !== 'progress') done(m); }));
    got = res.type === 'done' ? res : res.best;
  }
  ok(got?.line && got.par <= S.parMax, `depth ${d} deals a board the solver wins in ${got?.par} (${res.type})`);
  res.line = got?.line; res.seed = got?.seed;
  if (res.line) {
    const { states, ok: legal } = R.replay(makeLevel(S, res.seed), res.line);
    const end = states[states.length - 1];
    ok(legal && end.won && end.hole, `depth ${d}: the par line clears the board and opens the hole`);
  }
  ok(Date.now() - t0 < 22000, `depth ${d} is found in good time (${Date.now() - t0} ms)`);
}

// The cat (2026-10-16): steps as a king, starts every adventure, and is
// always one of the set drawn.
{
  ok(R.PIECES.cat && R.PIECES.cat.betza === 'K', 'the cat moves as a king');
  ok(M.startPool.join() === 'cat', 'an adventure starts with the cat');
  const run = newRun(['rook', 'knight', 'bishop', 'cat', 'pawn', 'camel', 'ferz'], 3, null);
  ok([...Array(40)].every((_, k) => adventureSet(run, rng('cat:' + k)).includes(3)), 'the cat is in every set drawn');
  const lv = deal(1, ['cat'], 1);
  const st = R.initialState(lv);
  ok(st.pieces[0].type === 'cat' && R.movesFor(st, 0).every((mv) => Math.max(Math.abs(mv.x - st.pieces[0].x), Math.abs(mv.y - st.pieces[0].y)) === 1), 'a first board deals with the cat on it, stepping one square');
}

// Cards by par, and never a piece (pieces come from rabbits).
const r2 = newRun(['rook'], 5, null); r2.depth = 6;
for (const [how, want] of [['eagle', 4], ['birdie', 3], ['par', 2], ['bogey', 1], ['worse', 1]]) {
  const cards = adventureCards(r2, PAR_CARDS[how], rng('cards:' + how));
  ok(cards.length === want, `${how} par gives ${want}`);
  ok(cards.every((c) => c.kind === 'suit' || c.kind === 'weapon'), `${how} par: suits and weapons only`);
}
{
  // Now and then a rabbit you took (2026-10-16: "rarely you get a rabbit").
  let rabbits = 0;
  for (let k = 0; k < 200; k++) rabbits += adventureCards(r2, 2, rng('rc:' + k), [{ rabbit: 'sentry', suit: 'hearts' }]).filter((c) => c.kind === 'rabbit').length;
  ok(rabbits > 15 && rabbits < 70, `a rabbit card about one board in five (${rabbits} of 200)`);
  ok(adventureCards(r2, 2, rng('rc'), []).every((c) => c.kind !== 'rabbit'), 'none when you took no rabbit');
}
ok([2, 3, 4, 5, 6, 7].map((t) => parVerdict(t, 5, true)).join() === 'albatross,eagle,birdie,par,bogey,worse' && parVerdict(3, 5, false) === 'worse', 'the verdicts, in golf\u2019s words');

console.log(fails ? `${fails} checks failed.` : 'Adventure: statues, the Changeling, routes, the hole, choosing from the set, suits on both sides, hearts, the mace and the shield, the troupe, your pieces with rabbits, losing a piece, the net, tactics (pins, sentries, flight, sentient rabbits, the leader), three of a kind, dealing and cards check out.');
if (fails) process.exit(1);

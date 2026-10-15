// Proves Adventure's rules do what the descriptions say: moves, the five
// suits, the three weapons, rabbits, their pieces, and that a run's levels
// can always be cleared by the route par is built on.
//
//   node play/changeling/adventure/check.mjs

import { play, yourMoves, movesOf, occOf, theirMove, rabbitStep } from './rules.js';
const W = 5, H = 5;
const L = { W, H, on: new Uint8Array(25).fill(1) };
const sq = (x, y) => y * W + x;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };
const S = (ps) => ({ L, ps, t: 0, bonus: null });
const tos = (s, id) => movesOf(s, s.ps.find((p) => p.id === id), occOf(s)).map((m) => m.to);

// plain rook: moves and captures, stops at first piece
let s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(0, 4) }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(0, 2) }]);
ok(JSON.stringify(tos(s, 1).sort((a,b)=>a-b)) === JSON.stringify([sq(0,2), sq(0,3), sq(1,4), sq(2,4), sq(3,4), sq(4,4)].sort((a,b)=>a-b)), 'rook moves to empty squares and takes the first piece');
let n = play(s, movesOf(s, s.ps[0]).find((m) => m.to === sq(0, 2)));
ok(n.done === 'cleared' && n.t === 1, 'taking the last statue clears in 1 turn');
// not a doppelganger
ok(n.ps[0].kind === 'rook', 'your piece does not change into what it takes');

// spirals: wraps left-right
s = S([{ id: 1, kind: 'wazir', side: 'you', sq: sq(0, 2), suit: 'spirals' }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(4, 2) }]);
ok(tos(s, 1).includes(sq(4, 2)), 'spirals: a wazir on the left edge reaches the right edge');

// gears: swap with own piece
s = S([{ id: 1, kind: 'knight', side: 'you', sq: sq(0, 4), suit: 'gears' }, { id: 2, kind: 'rook', side: 'you', sq: sq(4, 0) }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 2) }]);
const sw = movesOf(s, s.ps[0]).find((m) => m.swap === 2);
n = play(s, sw);
ok(n.ps.find((p) => p.id === 1).sq === sq(4, 0) && n.ps.find((p) => p.id === 2).sq === sq(0, 4), 'gears: swaps squares with another of yours');

// stars: first move gets a bonus, turn count does not tick
s = S([{ id: 1, kind: 'king', side: 'you', sq: sq(2, 4), suit: 'stars' }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 0) }]);
n = play(s, movesOf(s, s.ps[0]).find((m) => m.to === sq(2, 3)));
ok(n.bonus?.why === 'stars' && n.t === 0, 'stars: a second move, same turn');
n = play(n, yourMoves(n).find((m) => m.to === sq(2, 2)));
ok(!n.bonus && n.t === 1, 'stars: after the second move the turn ends');
n = play(n, yourMoves(n).find((m) => m.to === sq(2, 1)));
ok(!n.bonus && n.t === 2, 'stars: only once a level');

// vines: chain captures
s = S([{ id: 1, kind: 'king', side: 'you', sq: sq(2, 4), suit: 'vines' }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 3) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(2, 2) }, { id: 102, kind: 'pawn', side: 'stone', sq: sq(0, 0) }]);
n = play(s, movesOf(s, s.ps[0]).find((m) => m.to === sq(2, 3)));
ok(n.bonus?.why === 'vines' && n.bonus.cap && yourMoves(n).every((m) => m.wait || m.cap != null), 'vines: may take again, captures only');
n = play(n, yourMoves(n).find((m) => m.to === sq(2, 2)));
ok(!n.bonus && n.t === 1 && n.ps.filter((p) => p.side === 'stone').length === 1, 'vines: two taken in one turn');

// hearts: back to first row
s = S([{ id: 1, kind: 'king', side: 'you', sq: sq(2, 2), suit: 'hearts', lives: 2 }, { id: 100, kind: 'rook', side: 'foe', sq: sq(2, 0) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(4, 0) }]);
n = play(s, movesOf(s, s.ps[0]).find((m) => m.to === sq(1, 2)));
// rook at (2,0) can't take king at (1,2); check AI moved toward/attacked
const s2 = S([{ id: 1, kind: 'king', side: 'you', sq: sq(2, 2), suit: 'hearts', lives: 2 }, { id: 100, kind: 'rook', side: 'foe', sq: sq(0, 0) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(4, 0) }]);
n = play(s2, movesOf(s2, s2.ps[0]).find((m) => m.to === sq(1, 2))); // into the rook's file? rook at (0,0) covers column 0 and row 0; king at (1,2) safe
const s3 = S([{ id: 1, kind: 'king', side: 'you', sq: sq(1, 3), suit: 'hearts', lives: 2 }, { id: 100, kind: 'rook', side: 'foe', sq: sq(0, 0) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(4, 0) }]);
n = play(s3, movesOf(s3, s3.ps[0]).find((m) => m.to === sq(0, 3)));
const me = n.ps.find((p) => p.id === 1);
ok(n.reply?.cap === 1 && me && me.lives === 1 && ((me.sq / W) | 0) === 4, 'hearts: taken by their rook, back on the first row, heart spent');

// sword: cannot land on a piece, strikes in front (up for you)
s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(2, 4), weapon: 'sword', wl: 1 }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 1) }]);
ok(!tos(s, 1).includes(sq(2, 1)), 'sword: cannot move onto a piece');
const strike = movesOf(s, s.ps[0]).find((m) => m.to === sq(2, 2));
ok(strike?.strike?.[0] === 100, 'sword 1: landing below it strikes the piece in front');

// lance: passes through and takes
s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(2, 4), weapon: 'lance', wl: 2 }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 3) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(2, 2) }]);
const lm = movesOf(s, s.ps[0]).find((m) => m.to === sq(2, 1));
ok(lm?.pass?.length === 2, 'lance 2: passes through two and lands beyond');
n = play(s, lm); ok(n.done === 'cleared', 'lance: both taken');

// mace: sliding on past a piece pushes it; pushing a stunned one takes it (same turn, via stars)
s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(2, 4), weapon: 'mace', wl: 1, suit: 'stars' }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(2, 3) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(0, 0) }]);
ok(movesOf(s, s.ps[0]).some((m) => m.to === sq(2, 3) && m.cap === 100), 'mace: still takes where it lands');
const push = movesOf(s, s.ps[0]).find((m) => m.to === sq(2, 2) && m.push);
ok(push && push.push[0].to === sq(2, 1), 'mace: going on past a piece pushes it ahead');
n = play(s, push);
ok(n.ps.find((p) => p.id === 100).stun === true && n.bonus?.why === 'stars', 'mace: the pushed statue is stunned');
const push2 = yourMoves(n).find((m) => m.to === sq(2, 0) && m.push);
ok(push2 && push2.push[0].to === -1, 'mace: pushing a stunned one takes it');
n = play(n, push2);
ok(!n.ps.some((p) => p.id === 100), 'mace: taken');
// stun on a step or leap: their mover misses its turn
s = S([{ id: 1, kind: 'knight', side: 'you', sq: sq(0, 4), weapon: 'mace', wl: 2 }, { id: 100, kind: 'king', side: 'foe', sq: sq(1, 1) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(4, 0) }]);
const stunMove = movesOf(s, s.ps[0]).find((m) => m.to === sq(1, 2));
ok(stunMove?.stun?.includes(100), 'mace 2: a leap stuns what stands in front');
n = play(s, stunMove);
ok(n.ps.find((p) => p.id === 100).sq === sq(1, 1) && !n.reply, 'mace: the stunned king sat out its turn');

// rabbit: blocks, hops, flips at the edge
s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(0, 4) }, { id: 50, kind: 'rabbit', side: 'rabbit', sq: sq(4, 2), pat: [[1, 0]], k: 0 }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(0, 0) }]);
const st = rabbitStep(s, s.ps[1]);
ok(st.flip && st.to === sq(3, 2), 'rabbit: turns round at the edge');
n = play(s, movesOf(s, s.ps[0]).find((m) => m.to === sq(1, 4)));
ok(n.ps.find((p) => p.id === 50).sq === sq(3, 2), 'rabbit: hopped after your move');
s = S([{ id: 1, kind: 'rook', side: 'you', sq: sq(0, 2) }, { id: 50, kind: 'rabbit', side: 'rabbit', sq: sq(2, 2), pat: [[0, 1]], k: 0 }, { id: 100, kind: 'pawn', side: 'stone', sq: sq(4, 2) }]);
ok(!tos(s, 1).includes(sq(4, 2)) && !tos(s, 1).includes(sq(2, 2)), 'rabbit: blocks a slide and cannot be taken');

// their pawn moves down and takes diagonally down
s = S([{ id: 1, kind: 'knight', side: 'you', sq: sq(1, 2) }, { id: 100, kind: 'pawn', side: 'foe', sq: sq(2, 1) }, { id: 101, kind: 'pawn', side: 'stone', sq: sq(4, 4) }]);
ok(theirMove(s)?.cap === 1, 'their pawn takes diagonally down');


// Whole runs: every level deals, and its par route really clears it.
import { newRun, makeLevel, settle, offersFor, takeCard, eligible } from './run.js';
for (const starter of ['rook', 'bishop', 'knight']) {
  const run = newRun(starter, 777);
  for (let d = 1; d <= 10 && !run.over; d++) {
    run.depth = d;
    const lv = makeLevel(run);
    if (!lv) { ok(false, `${starter} run: depth ${d} deals`); break; }
    let st = lv.state;
    for (const turn of lv.route) for (const m of turn) st = play(st, m);
    ok(st.done === 'cleared' && st.t === lv.best && lv.par > lv.best, `${starter} run: depth ${d} clears on its route, par above it`);
    const again = makeLevel(run);
    ok(again.par === lv.par && JSON.stringify(again.state.ps) === JSON.stringify(lv.state.ps), `${starter} run: depth ${d} deals the same twice`);
    settle(run, st);
    const card = offersFor(run, 'under')[0];
    if (card) takeCard(run, card, eligible(run, card)[0]?.id);
  }
}
console.log(fails ? `${fails} checks failed.` : 'Adventure: every rule and three runs of ten levels check out.');
if (fails) process.exit(1);

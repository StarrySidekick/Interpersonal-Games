// Proves Adventure's parts of the Grove (2026-10-15) do what they say: their
// statues never move or take, the Changeling takes on the moves of what it
// takes, Adventure deals a board with a par at every depth, and its cards
// come one, two or three by par.
//
//   node play/grove-chess/adventure-check.mjs

import * as R from './rules.js';
import { makeLevel, searchLayouts } from './lab.js';
import { modeDefaults, levelSettings } from './modes.js';
import { newRun, handSettings, adventureCards, parVerdict, PAR_CARDS } from './run.js';
import { rng } from '../../engine/seed.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const M = modeDefaults('adventure');

// Statues and the Changeling.
const run = newRun(['changeling'], 4, null); run.depth = 3;
let L = null;
for (let sd = 1; sd < 200 && !L; sd++) {
  const lv = makeLevel(levelSettings(M, { depth: 3, hand: handSettings(run) }, rng('chg:' + sd)), sd);
  if (R.movesFor(R.initialState(lv), 0).some((mv) => mv.cap)) L = lv;
}
ok(L, 'a board where the Changeling can take at once');
const s = R.initialState(L);
ok(s.foes.every((f) => f.brain === 'still'), 'at depth 3 all of theirs are statues');
ok(!R.canTake(L.rules, s.foes[0]), 'a statue never takes');
ok(R.movesFor(s, 0).every((mv) => Math.max(Math.abs(mv.x - s.pieces[0].x), Math.abs(mv.y - s.pieces[0].y)) === 1), 'an unshaped Changeling steps like a king');
const cap = R.movesFor(s, 0).find((mv) => mv.cap), victim = s.foes.find((f) => f.x === cap.x && f.y === cap.y);
const n = R.apply(s, { p: 0, ...cap });
ok(n.pieces[0].shape === victim.type || ['king', 'changeling'].includes(victim.type), 'it takes on the shape of what it took');
ok(n.foes.every((f, k) => f.taken || (f.x === s.foes[k].x && f.y === s.foes[k].y)), 'statues stay where they are');

// Every depth deals a board that can be cleared, with a par.
for (const [d, hand] of [[1, ['rook']], [2, ['bishop']], [4, ['knight', 'rook']], [6, ['rook', 'knight', 'bishop']], [9, ['rook', 'knight', 'bishop', 'camel']]]) {
  const r = newRun(hand, 4, null); r.depth = d;
  const S = levelSettings(M, { depth: d, hand: handSettings(r) }, rng('check:' + d));
  const res = await new Promise((done) => searchLayouts({ settings: S, seed: 7000 + d, parMin: S.parMin, parMax: S.parMax, maxMs: 15000, quick: true }, (m) => { if (m.type !== 'progress') done(m); }));
  ok(res.type === 'done' && res.par >= 1, `depth ${d} deals a board with a par`);
}

// Cards by par.
const r2 = newRun(['rook'], 4, null); r2.depth = 6;
for (const [how, want] of [['under', 3], ['par', 2], ['over', 1]]) ok(adventureCards(r2, PAR_CARDS[how], rng('cards:' + how)).length === want, `${how} par gives ${want}`);
ok(parVerdict(5, 6, true) === 'under' && parVerdict(6, 6, true) === 'par' && parVerdict(7, 6, true) === 'over' && parVerdict(3, 6, false) === 'over', 'the verdicts');
r2.depth = 3; // after clearing depth 2, a new piece comes first
ok(adventureCards(r2, 1, rng('piece')).some((c) => c.kind === 'piece'), 'a new piece is due after depth 2');

console.log(fails ? `${fails} checks failed.` : 'Adventure: statues, the Changeling, dealing and cards check out.');
if (fails) process.exit(1);

// Guards the daily boards. Run with:  node play/grove-chess/check-daily.mjs
//
// Every daily board is dealt from its date, so a change anywhere in the
// dealer, the solver or the rules can quietly re-deal every board, past days
// included, and break every link people have shared. This deals 150 boards,
// plays 4 seeded random games on each, and fingerprints the lot (a SHA-256
// hash: a short code that changes if a single detail changes). If the
// fingerprint differs from the one below, the daily game has changed.
//
// If the change is deliberate, version it first (see docs/grove-chess.md),
// then update EXPECTED.

import { createHash } from 'node:crypto';
import { makeDay } from './day.js';
import * as R from './rules.js';
import { rng } from '../../engine/seed.js';

const EXPECTED = '25ec172f74449ded42a98067cea75419bdd897573a22fbb562e8c90dbf75acbb';

const out = [];
for (let i = 0; i < 150; i++) {
  const date = new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10);
  const d = makeDay(date);
  const board = JSON.stringify({ N: d.N, pieces: d.pieces, rabbit: [d.rabbit.x, d.rabbit.y, d.rabbit.mx, d.rabbit.my], pattern: d.pattern, stumps: [...d.stumps], bramble: d.bramble, par: d.par });
  const games = [];
  for (let g = 0; g < 4; g++) {
    const rand = rng(date + ':g' + g);
    let s = R.initialState(d);
    const trace = [];
    while (!R.isOver(s)) {
      const ms = R.allMoves(s);
      const mv = ms[Math.floor(rand() * ms.length)];
      s = R.apply(s, mv);
      const f = s.foes[0];
      trace.push([mv.p, mv.x, mv.y, s.pieces.map((p) => (p.taken ? '-' : p.x + ',' + p.y)).join(' '), f.x, f.y, f.i, f.mx, f.my, !!s.won, s.t, R.isOver(s) ? R.outcome(s) : ''].join('|'));
    }
    games.push(trace);
  }
  out.push({ date, board, games });
}
const hash = createHash('sha256').update(JSON.stringify(out)).digest('hex');
if (hash === EXPECTED) console.log('Daily boards unchanged: 150 boards, 600 games.');
else {
  console.log(`DAILY BOARDS CHANGED.\n  expected ${EXPECTED}\n  got      ${hash}`);
  process.exit(1);
}

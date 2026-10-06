// Guards the daily boards. Run with:  node play/grove-chess/check-daily.mjs
//
// Every daily board is dealt from its date, so a change anywhere in the
// dealer, the solver or the rules can quietly re-deal every board, past days
// included, and break every link people have shared. The dealer is
// versioned (see day.js), and a version never changes once it has shipped.
// For each version this deals 150 boards, plays 4 seeded random games on
// each, and fingerprints the lot (a SHA-256 hash: a short code that changes
// if a single detail changes). If a fingerprint differs from the one below,
// that version's boards have changed.
//
// A deliberate change goes in a new version with a new cutover date (see
// docs/grove-chess.md); then add its fingerprint here. Never edit an old one.

import { createHash } from 'node:crypto';
import { makeDay, VERSIONS } from './day.js';
import * as R from './rules.js';
import { rng } from '../../engine/seed.js';

const EXPECTED = {
  1: '25ec172f74449ded42a98067cea75419bdd897573a22fbb562e8c90dbf75acbb',
  2: '752fb1b70e079d56145481dd89c03c9ce81b50466abac74ef85c4300f9a5e50d'
};

function fingerprint(version, from) {
  const [y, m, d0] = from.split('-').map(Number);
  const out = [];
  for (let i = 0; i < 150; i++) {
    const date = new Date(Date.UTC(y, m - 1, d0 + i)).toISOString().slice(0, 10);
    const d = makeDay(date, version);
    const fields = { N: d.N, pieces: d.pieces, rabbit: [d.rabbit.x, d.rabbit.y, d.rabbit.mx, d.rabbit.my], pattern: d.pattern, stumps: [...d.stumps], bramble: d.bramble, par: d.par };
    if (version >= 2) fields.crumble = !!d.rules.crumble;
    const board = JSON.stringify(fields);
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
        const step = [mv.p, mv.x, mv.y, s.pieces.map((p) => (p.taken ? '-' : p.x + ',' + p.y)).join(' '), f.x, f.y, f.i, f.mx, f.my, !!s.won, s.t, R.isOver(s) ? R.outcome(s) : ''];
        if (version >= 2) step.push(s.gone.join(','));
        trace.push(step.join('|'));
      }
      games.push(trace);
    }
    out.push({ date, board, games });
  }
  return createHash('sha256').update(JSON.stringify(out)).digest('hex');
}

let bad = 0;
for (const { v, from } of VERSIONS) {
  const hash = fingerprint(v, from);
  if (hash === EXPECTED[v]) console.log(`Dealer v${v} unchanged: 150 boards from ${from}, 600 games.`);
  else {
    console.log(`DEALER v${v} CHANGED.\n  expected ${EXPECTED[v]}\n  got      ${hash}`);
    bad++;
  }
}
if (bad) process.exit(1);

// What Adventure's generator makes, depth by depth: deals boards exactly as
// the page does (play/main.js find: dealt from the rules in
// adventure-levels.js, vetted by the solver, dealt again with fewer of theirs
// when nothing is won or more when it comes in short) and reports what came
// out. Anyone can run it; no Claude needed (Timothy, 2026-10-17: "a way for
// levels to be generated ... without Claude, just like using like a set of
// parameters like you would in a rogue like").
//
//   node play/grove-chess/level-report.mjs            depths 1 to 20, 6 boards each
//   node play/grove-chess/level-report.mjs 1 30 10    depths 1 to 30, 10 each
//
// Each line: the depth, its place in its act (and a boss), par, the sizes
// dealt, how many of theirs and of what kind (robot, sentry, trap, scared,
// simple, sentient; with Hearts or another suit), hedges, the best lines the
// solver found, and how long a deal took. This is the generator's spread
// (its "expressive range", Smith and Whitehead): look for flat stretches,
// spikes, and boards that always look alike.

import { modeDefaults, levelSettings, adventurePar } from './modes.js';
import { searchLayouts, makeLevel } from './lab.js';
import { newRun, handSettings } from './run.js';
import { slotOf, bossFor } from './adventure-levels.js';
import { rng } from '../../engine/seed.js';

const [from = 1, to = 20, each = 6] = process.argv.slice(2).map(Number);
const M = modeDefaults('adventure');
const KIND = { possessed: 'robot', sentry: 'sentry', trap: 'trap', scared: 'scared', simple: 'simple', sentient: 'sentient', still: 'statue' };

/** A plain hand that grows as a run's does: the cat, a bishop from 2, a knight from 4. */
const handAt = (d) => handSettings(newRun(['cat', ...(d > 1 ? ['bishop'] : []), ...(d > 3 ? ['knight'] : [])], 4));

/** One board, dealt as the page deals it. */
function deal(runSeed, d) {
  let short = null, relax = 0, press = 0;
  for (let k = 0; k < 12; k++) {
    const S = levelSettings(M, { depth: d, hand: handAt(d), relax, press, runSeed }, rng(`adventure:${runSeed}:${d}${k ? ':' + k : ''}`));
    let out = null;
    searchLayouts({ settings: S, seed: runSeed + d * 1000, parMin: S.parMin, parMax: S.parMax, quick: true, maxMs: k ? 6000 : 7000 }, (x) => { if (x.type !== 'progress') out = x; });
    const pick = out.type === 'done' ? out : out.best;
    const got = pick?.par != null ? { S, seed: pick.seed, best: pick.par, short: pick.par < S.parMin } : null;
    if (got && !got.short) return got;
    if (got) { if (!short || got.best > short.best) short = got; if (press >= 1) break; press++; } else if (short) break; else relax++;
  }
  return short;
}

for (let d = from; d <= to; d++) {
  const rows = [], sizes = {}, kinds = {};
  let hedges = 0, suits = 0, hearts = 0;
  const bosses = new Set();
  for (let i = 0; i < each; i++) {
    const runSeed = 1000 + i * 7, t0 = Date.now(), f = deal(runSeed, d), ms = Date.now() - t0;
    const boss = bossFor(d, runSeed);
    if (boss) bosses.add(boss.name);
    if (!f) { rows.push({ fail: true, ms }); continue; }
    const L = makeLevel(f.S, f.seed);
    sizes[`${L.W}x${L.H}`] = (sizes[`${L.W}x${L.H}`] || 0) + 1;
    for (const q of L.foes) { kinds[KIND[q.brain] || q.brain] = (kinds[KIND[q.brain] || q.brain] || 0) + 1; if (q.lives > 1) hearts++; else if (q.suit) suits++; }
    hedges += L.stumps.size;
    rows.push({ best: f.best, ms, foes: L.foes.length });
  }
  const ok = rows.filter((r) => !r.fail), n = Math.max(1, ok.length), per = (v) => (v / n).toFixed(1);
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`d${String(d).padEnd(3)}${slotOf(d).padEnd(7)}par ${String(adventurePar(d)).padEnd(3)}| ${Object.entries(sizes).map(([k, v]) => `${k}:${v}`).join(' ').padEnd(16)}| ${per(ok.reduce((a, r) => a + r.foes, 0))} of theirs: ${Object.entries(kinds).map(([k, v]) => `${k} ${per(v)}`).join(', ')}; hearts ${per(hearts)}, suits ${per(suits)} | hedges ${per(hedges)} | best ${ok.map((r) => r.best).join(',')} | ${ms[ms.length >> 1]} ms (max ${ms[ms.length - 1]})${rows.length - ok.length ? ` | ${rows.length - ok.length} NOT WON` : ''}${bosses.size ? ` | bosses: ${[...bosses].join(', ')}` : ''}`);
}

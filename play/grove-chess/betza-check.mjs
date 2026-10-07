// Proves every piece's Betza notation (rules.js `betza`) gives exactly the
// moves its own move code gives, on thousands of random boards: empty
// squares, gaps, its own side, the other side, and things in the way.
// Run: node play/grove-chess/betza-check.mjs

import { PIECES } from './rules.js';
import { betzaMoves, patent } from './betza.js';
import { rng } from '../../engine/seed.js';

const KINDS = [0, 1, 1, 1, 1, 1, 2, 3, 3, 4, 7]; // OFF, EMPTY (often), OWN, ENEMY, STUMP, HOLE
const key = (ms) => ms.map((m) => `${m.x},${m.y},${m.cap ? 'x' : '-'}`).sort().join(' ');
let bad = 0, checked = 0;
for (const [type, P] of Object.entries(PIECES)) {
  if (!P.betza) continue;
  const gen = betzaMoves(P.betza);
  patent(P.betza); // must read without error
  for (let i = 0; i < 3000; i++) {
    const rand = rng(`betza:${type}:${i}`), n = 5 + Math.floor(rand() * 5), grid = new Map();
    const p = { x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) grid.set(`${x},${y}`, KINDS[Math.floor(rand() * KINDS.length)]);
    grid.set(`${p.x},${p.y}`, 2);
    const L = (x, y) => grid.get(`${x},${y}`) ?? 0;
    const fwd = rand() < 0.5 ? 1 : -1;
    const a = key(P.moves(L, p, fwd, null)), b = key(gen(L, p, fwd));
    checked++;
    if (a !== b) { if (bad++ < 5) console.log(`${type} (${P.betza}) differs at ${p.x},${p.y}:\n  code  ${a}\n  betza ${b}`); }
  }
}
if (bad) { console.log(`BETZA MISMATCH: ${bad} of ${checked} positions.`); process.exit(1); }
console.log(`Betza notation matches the move code: ${checked} positions, ${Object.values(PIECES).filter((P) => P.betza).length} pieces.`);

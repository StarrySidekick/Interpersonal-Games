// A stored daily board's fingerprint (node only; make-daily.mjs writes it,
// check-daily.mjs checks it). The board as laid out, then four seeded random
// games played on it, hashed (SHA-256, the first 16 characters): if makeLevel
// or the rules change in a way that would move or change the board, the
// fingerprint changes.

import { createHash } from 'node:crypto';
import * as R from './rules.js';
import { rng } from '../../engine/seed.js';

export function boardPrint(day) {
  const board = {
    W: day.W, H: day.H, holes: [...day.holes].sort((a, b) => a - b), stumps: [...day.stumps].sort((a, b) => a - b),
    statues: day.statueKinds ? [...day.statueKinds].sort((a, b) => a[0] - b[0]) : [],
    pieces: day.pieces.map((p) => [p.type, p.x, p.y]),
    foes: day.foes.map((f) => [f.type, f.x, f.y, f.brain, f.pattern, f.mx, f.my, f.mind, f.patternName]),
    hole: day.hole, rules: day.rules, ai: day.ai, par: day.par
  };
  const games = [];
  for (let g = 0; g < 4; g++) {
    const rand = rng(`${day.date}:g${g}`);
    let s = R.initialState(day);
    const trace = [];
    while (!R.isOver(s)) {
      const ms = R.allMoves(s);
      s = R.apply(s, ms[Math.floor(rand() * ms.length)]);
      trace.push(R.stateKey(s) + (s.won ? 'W' : ''));
    }
    trace.push(R.outcome(s));
    games.push(trace);
  }
  return createHash('sha256').update(JSON.stringify({ board, games })).digest('hex').slice(0, 16);
}

// The other side's brain, for lab levels where foes think instead of
// following a pattern.
//
// It is a game-tree search, the oldest idea in computer chess:
// - Try each move it could make. For each, imagine your best reply, then its
//   best answer to that, as many moves deep as its skill allows.
// - At the bottom, score the position (evaluate, below): pieces left on each
//   side, which of its pieces you are threatening, how close it is to yours.
//   Its mood (flee, balanced, hunt) changes the weights.
// - It picks the move whose worst case is best for it. That is "minimax":
//   it maximises its score while assuming you will minimise it.
// - Alpha-beta pruning skips any line once it is provably worse than one
//   already found, which cuts the work enormously without changing the answer.
// - It works to a budget of positions, not a time limit, so the same position
//   gets the same move on every phone.

import {
  PIECES, movesFor, foeMovesFor, clone, foeMove, patternHops, playerMove, lost, allMoves
} from './rules.js';
import { rng } from '../../engine/seed.js';

const MOOD = {
  flee: { keep: 1.5, danger: 1.4, kill: 0.5, close: -0.15 },
  balanced: { keep: 1, danger: 0.9, kill: 1, close: 0.05 },
  hunt: { keep: 0.9, danger: 0.5, kill: 1.6, close: 0.25 }
};
const BUDGET = [0, 400, 6000, 16000]; // positions scored, by skill
const WIN = 1e5;

/** Every move the thinking foes could make: { k, x, y, cap }. */
function foeOptions(s) {
  const out = [];
  s.foes.forEach((f, k) => { for (const m of foeMovesFor(s, k)) out.push({ k, ...m }); });
  // Captures first: alpha-beta prunes far more when good moves come early.
  return out.sort((a, b) => b.cap - a.cap);
}

/** Their move plus the pattern hops that follow it, as a new state. */
function after(s, m) {
  const c = clone(s);
  foeMove(c, m);
  if (!lost(c)) patternHops(c);
  c.t++;
  return c;
}

/** How good a position is for them. Higher is better for the foes. */
function evaluate(s, budget) {
  budget.n++;
  if (s.won) return -WIN;
  if (lost(s)) return WIN;
  const r = s.day.rules, mood = MOOD[s.day.ai.style] || MOOD.balanced, W = s.day.W;
  if (r.maxMoves > 0 && s.t >= r.maxMoves) return WIN / 2; // they lasted till dusk
  const marked = r.goal === 'target' && s.foes.some((f) => f.target);
  const weight = (f) => (marked && f.target ? 4 : 1) * (r.goal === 'any' ? 3 : 1);

  let v = 0;
  const threatened = new Set();
  s.pieces.forEach((p, i) => {
    if (p.taken) return;
    v -= PIECES[p.type].value * mood.kill * (r.royal && p.type === 'king' ? 10 : 1);
    for (const m of movesFor(s, i)) if (m.cap) threatened.add(m.y * W + m.x);
  });
  let dist = 0, alive = 0;
  for (const f of s.foes) {
    if (f.taken) continue;
    alive++;
    v += PIECES[f.type].value * mood.keep * weight(f);
    if (threatened.has(f.y * W + f.x)) v -= PIECES[f.type].value * mood.danger * weight(f);
    let near = 99;
    for (const p of s.pieces) if (!p.taken) near = Math.min(near, Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)));
    dist += near;
  }
  if (alive) v -= mood.close * (dist / alive);
  return v;
}

class OutOfBudget extends Error {}

function yourTurn(s, depth, alpha, beta, budget) {
  if (budget.n > budget.max) throw new OutOfBudget();
  if (depth === 0) return evaluate(s, budget);
  let best = Infinity;
  for (const mv of allMoves(s)) {
    const n = playerMove(s, mv);
    const v = n.won ? -WIN : theirTurn(n, depth - 1, alpha, beta, budget);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break; // they would never let it get here
  }
  return best === Infinity ? evaluate(s, budget) : best;
}

function theirTurn(s, depth, alpha, beta, budget) {
  if (budget.n > budget.max) throw new OutOfBudget();
  if (depth === 0 || lost(s)) return evaluate(s, budget);
  const opts = foeOptions(s);
  if (!opts.length) {
    const c = after(s, null);
    return c.won || lost(c) ? evaluate(c, budget) : yourTurn(c, depth - 1, alpha, beta, budget);
  }
  let best = -Infinity;
  for (const m of opts) {
    const c = after(s, m);
    const v = lost(c) ? WIN : yourTurn(c, depth - 1, alpha, beta, budget);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // you would never let it get here
  }
  return best;
}

/** Choose their move in `s` (your move already made). Null if none. */
export function think(s) {
  let opts = foeOptions(s);
  if (!opts.length) return null;
  const skill = s.day.ai.skill;
  // Seeded by the level and the position, so it is random-looking but the
  // same every time this exact position comes up.
  const rand = rng(`${s.day.seed || 0}:${s.t}:${opts.length}:${s.foes.map((f) => f.x + f.y * 16).join(',')}`);
  if (skill <= 0) return opts[Math.floor(rand() * opts.length)];

  // A sliver of noise to break ties, so equal moves are not always chosen in
  // the same order.
  const jitter = opts.map(() => rand() * 0.01);
  let best = opts[0];
  // Iterative deepening: think one move ahead, then two, then three, keeping
  // the last answer that finished inside the budget.
  for (let depth = 1; depth <= skill; depth++) {
    const budget = { n: 0, max: BUDGET[skill] };
    try {
      const scored = opts.map((m, i) => {
        const c = after(s, m);
        const v = lost(c) ? WIN : depth === 1 ? evaluate(c, budget) : yourTurn(c, depth - 1, -Infinity, Infinity, budget);
        return { m, v: v + jitter[i], j: jitter[i] };
      });
      scored.sort((a, b) => b.v - a.v);
      best = scored[0].m;
      opts = scored.map((x) => x.m); // best first, so the next pass prunes more
      jitter.splice(0, jitter.length, ...scored.map((x) => x.j));
    } catch (e) {
      if (!(e instanceof OutOfBudget)) throw e;
      break;
    }
  }
  return best;
}

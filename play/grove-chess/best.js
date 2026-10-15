// The best move, for testing (Timothy, 2026-10-14: "I'd like a button, no
// matter what mode we're in during a game, that plays the best possible
// move for me for testing purposes"). On a hole (golf) the solver's line
// from where the game stands, since sinking the ball is a search, not a
// matter of material; anywhere else the two-sided bot (sim.js), three moves
// ahead, without the noise it plays with when it is a player.

import { chooseMove } from './sim.js';
import { solveLevel } from './solve.js';

/** The best move for you in state s of `level`, or null if there is none. */
export function bestMove(s, level) {
  // A ball to sink, or (Adventure) a board to clear and a hole to jump in:
  // the solver's line from here, if it finds one.
  if ((level.rules.goal === 'hole' || level.rules.goal === 'clear') && !s.bonus) {
    const left = level.rules.maxMoves > 0 ? level.rules.maxMoves - s.t : 12;
    const r = solveLevel(level, { from: s, maxDepth: Math.max(1, Math.min(level.rules.goal === 'clear' ? 24 : 12, left)), deadline: Date.now() + 4000 });
    if (r.line?.length) return r.line[0];
  }
  return chooseMove(s, 'you', { depth: 3, noise: 0, maxNodes: 60000 });
}

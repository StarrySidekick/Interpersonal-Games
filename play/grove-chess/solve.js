// The lab's solver: can this level be won, and in how few moves?
//
// Their side is deterministic (a pattern always hops the same way, and the
// AI always gives the same answer to the same position), so from your point
// of view the level is a puzzle: each of your moves leads to exactly one next
// position. Finding the shortest win is a search over your moves alone.
//
// Two phases:
// 1. Exhaustive, breadth first: every move, then every reply to every move,
//    merging positions already seen. While this stays small, the first win
//    it finds is the shortest possible, so par is exact.
// 2. Beam search, once phase 1 would grow too big: at each move keep only the
//    most promising positions (the "beam"), judged by a quick score of how
//    close your pieces are to what you need to catch. Much faster, but it can
//    miss the very best line, so par becomes "the solver found a win this
//    short". Beating it is possible; that is a birdie.
//
// It counts its work in replies computed (the expensive part when their side
// thinks) and gives up past a budget, so it always finishes.

import { initialState, allMoves, playerMove, respond, isOver, stateKey, movesFor } from './rules.js';

/** How far a position is from a win. Lower is closer. */
function score(s) {
  const r = s.day.rules, W = s.day.W;
  const alive = s.pieces.filter((p) => !p.taken);
  if (!alive.length) return Infinity;
  const lostPieces = s.pieces.length - alive.length;

  if (r.goal === 'hole') {
    // Closer is better, and sharing a row or column with the hole is a
    // big step: from there one roll can do it.
    const b = alive.find((p) => p.type === 'ball');
    if (!b || !s.hole) return Infinity;
    const dx = Math.abs(b.x - s.hole.x), dy = Math.abs(b.y - s.hole.y);
    return (dx + dy) * 10 - (dx === 0 || dy === 0 ? 15 : 0) + lostPieces * 40;
  }
  let need = s.foes.filter((f) => !f.taken && (r.goal !== 'target' || f.target));
  if (!need.length) need = s.foes.filter((f) => !f.taken);

  const hit = new Set();
  s.pieces.forEach((p, i) => { for (const m of movesFor(s, i)) if (m.cap) hit.add(m.y * W + m.x); });
  const gap = (f) => (hit.has(f.y * W + f.x) ? 0 : 1 + Math.min(...alive.map((p) => Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)))));

  if (r.goal === 'any') return Math.min(...need.map(gap)) * 10 + lostPieces * 40;
  return need.reduce((h, f) => h + 100 + gap(f) * 10, 0) + lostPieces * 40;
}

/**
 * Solve a level. Returns { par, exact, line, work } where line is the
 * winning list of your moves, or { par: null, work } if no win was found
 * within maxDepth moves.
 */
export function solveLevel(level, opts = {}) {
  const thinks = level.foes.some((f) => f.brain === 'ai');
  const {
    maxDepth = 10,
    exactCap = thinks ? 300 : 4000,  // phase 1 stops when a layer would pass this
    width = thinks ? 20 : 60,        // positions kept per move in phase 2
    branch = thinks ? 8 : 12,        // moves tried from each kept position
    budget = thinks ? 2500 : 60000,  // replies computed before giving up
    deadline = Infinity              // a Date.now() to give up at, whatever the budget
  } = opts;

  const s0 = initialState(level);
  if (isOver(s0)) return { par: null, work: 0 };
  let layer = [{ s: s0, line: [] }], exact = true, work = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const beam = !exact || layer.length * 20 > exactCap;
    if (beam) exact = false;
    const next = [], seen = new Set();
    for (const node of layer) {
      let cands = allMoves(node.s).map((mv) => ({ mv, mid: playerMove(node.s, mv) }));
      const win = cands.find((c) => c.mid.won);
      if (win) return { par: depth, exact, line: [...node.line, win.mv], work };
      if (beam) cands = cands.map((c) => ({ ...c, h: score(c.mid) })).sort((a, b) => a.h - b.h).slice(0, branch);
      for (const c of cands) {
        if (++work > budget || (work % 8 === 0 && Date.now() > deadline)) return { par: null, work, gaveUp: true };
        const ch = respond(c.mid);
        if (isOver(ch)) continue; // they won, or you ran out of moves
        const k = stateKey(ch);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: ch, line: [...node.line, c.mv], h: beam ? score(ch) : 0 });
      }
    }
    if (!next.length) return { par: null, work };
    layer = beam ? next.sort((a, b) => a.h - b.h).slice(0, width) : next;
  }
  return { par: null, work };
}

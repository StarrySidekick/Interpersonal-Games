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

import { initialState, allMoves, playerMove, respond, isOver, stateKey, movesFor, foeMovesFor, replay, PIECES, firstCaptures } from './rules.js';

/** How far a position is from a win. Lower is closer. */
export function score(s) {
  const r = s.day.rules, W = s.day.W;
  const alive = s.pieces.filter((p) => !p.taken);
  if (!alive.length) return Infinity;
  const lostPieces = s.pieces.length - alive.length;

  // Rabbits, then the ball: while any rabbit is loose, score the chase (and
  // keep it worse than any position in the ball phase, so catching the last
  // one always looks like progress).
  const loose = r.goal === 'descent' ? s.foes.filter((f) => f.target && !f.taken) : [];
  if (r.goal === 'hole' || (r.goal === 'descent' && !loose.length)) {
    // Closer is better, and sharing a row or column with the hole is a
    // big step: from there one roll can do it. A billiard ball goes
    // diagonally instead, and can only ever reach the hole while the hole
    // is on its colour.
    const b = alive.find((p) => p.type === 'ball');
    if (!b || !s.hole) return Infinity;
    const dx = Math.abs(b.x - s.hole.x), dy = Math.abs(b.y - s.hole.y);
    if (r.ballMove === 'bounce') return Math.max(dx, dy) * 10 - (dx === dy ? 15 : 0) + ((dx + dy) % 2 ? 30 : 0) + lostPieces * 40;
    return (dx + dy) * 10 - (dx === 0 || dy === 0 ? 15 : 0) + lostPieces * 40;
  }
  let need = r.goal === 'descent' ? loose : s.foes.filter((f) => !f.taken && (r.goal !== 'target' || f.target));
  if (!need.length) need = s.foes.filter((f) => !f.taken);

  const hit = new Set();
  s.pieces.forEach((p, i) => { for (const m of movesFor(s, i)) if (m.cap) hit.add(m.y * W + m.x); });
  const gap = (f) => (hit.has(f.y * W + f.x) ? 0 : 1 + Math.min(...alive.map((p) => Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)))));

  if (r.goal === 'any') return Math.min(...need.map(gap)) * 10 + lostPieces * 40;
  return need.reduce((h, f) => h + 100 + gap(f) * 10, 0) + lostPieces * 40 + (r.goal === 'descent' ? 200 : 0);
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
    deadline = Infinity,             // a Date.now() to give up at, whatever the budget
    frozen = null                    // a Set of your pieces that may not move (for assess)
  } = opts;

  const s0 = initialState(level);
  if (isOver(s0)) return { par: null, work: 0 };
  let layer = [{ s: s0, line: [] }], exact = true, work = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const beam = !exact || layer.length * 20 > exactCap;
    if (beam) exact = false;
    const next = [], seen = new Set();
    for (const node of layer) {
      let cands = allMoves(node.s).filter((mv) => !frozen?.has(mv.p)).map((mv) => ({ mv, mid: playerMove(node.s, mv) }));
      const win = cands.find((c) => c.mid.won);
      // Par is moves on the clock, not plies: a move a suit adds (Swords,
      // Stars) is the same turn. Without one the two are the same number.
      if (win) return { par: win.mid.t + 1, exact, line: [...node.line, win.mv], work };
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

// --- Balance: how a level plays, beyond par. -------------------------------

/**
 * What each of your pieces does on a level, whether the rabbits' patterns can
 * be read before they have to be caught, and what you risk. `res` is a
 * solveLevel() result with a line. Each piece is also tried frozen (the
 * level re-solved without it ever moving): if par gets worse or the level
 * cannot be won, the piece is needed. That costs one solve per piece, so it
 * takes a deadline and a budget (a search that runs out counts the piece as
 * needed, so a small budget errs on the side of passing a level).
 *
 * Returns { pieces: [{ type, start, moves, catches, without, needed }],
 *   rabbits: [{ name, len, hops }], attacked, lost }.
 */
export function assess(level, res, { deadline = Infinity, budget = 20000 } = {}) {
  const s0 = initialState(level), { states } = replay(level, res.line);
  const pieces = level.pieces.map((p, i) => {
    let moves = 0, catches = false;
    res.line.forEach((mv, k) => {
      if (mv.p !== i) return;
      moves++;
      const a = states[k], b = states[k + 1];
      if (a.foes.some((f) => !f.taken && f.x === mv.x && f.y === mv.y) || (b?.sunk && !a.sunk)) catches = true;
    });
    const r = solveLevel(level, { maxDepth: res.par + 2, frozen: new Set([i]), deadline, budget });
    // A ball that is hit never moves by itself, so it has no moves of its own to count.
    const hitBall = p.type === 'ball' && level.rules.ballMove === 'hit';
    return { type: p.type, start: movesFor(s0, i).length, moves, catches, without: r.par, needed: !r.par || r.par > res.par, ...(hitBall ? { hit: true } : {}) };
  });
  // A rabbit's hops before it is caught, against the length of its pattern.
  const rabbits = [];
  level.foes.forEach((f, k) => {
    if (f.brain !== 'pattern' && f.brain !== 'possessed') return;
    const j = states.findIndex((st) => st.foes[k].taken);
    rabbits.push({ name: f.patternName, len: f.pattern.length, hops: j < 0 ? null : Math.max(0, j - 1) * (f.hops || 1) });
  });
  // Danger: your pieces something of theirs could take on its first turn,
  // and how many the solver's line gives up.
  const hit = new Set();
  s0.foes.forEach((_, k) => { for (const m of foeMovesFor(s0, k)) if (m.cap) hit.add(m.y * level.W + m.x); });
  const attacked = s0.pieces.filter((p) => hit.has(p.y * level.W + p.x)).length;
  const end = states[states.length - 1], lost = end.pieces.filter((p) => p.taken).length;
  return { pieces, rabbits, attacked, lost, opening: openingCaptures(level) };
}

/** How many pieces on each side could capture on the first move. */
export function openingCaptures(level) {
  const { yours, theirs } = firstCaptures(initialState(level));
  return { yours: yours.length, theirs: theirs.length };
}

/** Pieces whose moves only work in the right circumstances: a grasshopper
    needs something to hop over, a cannon a screen to jump, a pawn something
    diagonally ahead, a mao an open first step. These are the ones most likely
    to be dead weight on a level not set up for them. */
export const CIRCUMSTANTIAL = ['grasshopper', 'cannon', 'pawn', 'mao'];

/**
 * The balance rules: reasons a level is not fair or not interesting, or none.
 *   'on'     no piece on either side can capture on its first move, every
 *            piece can move at the start, and every fairy or
 *            circumstantial piece has a job (it makes a catch in the winning
 *            line, or the level is worse without it).
 *   'strict' every piece has a job, not only the strange ones.
 */
export function unbalanced(a, level = 'on') {
  if (level === 'off' || !a) return [];
  const why = [];
  const name = (p) => PIECES[p.type].name;
  const job = (p) => p.catches || p.needed;
  // No piece, on either side, can capture on its first move (Timothy,
  // 2026-10-07): the opening is for moving, not for trading.
  if (a.opening?.yours) why.push(`${a.opening.yours > 1 ? `${a.opening.yours} of your pieces` : 'one of your pieces'} could capture on the first move`);
  if (a.opening?.theirs) why.push(`${a.opening.theirs > 1 ? `${a.opening.theirs} of their pieces` : 'one of their pieces'} could capture on the first move`);
  for (const p of a.pieces) {
    if (p.hit) continue;
    if (p.start === 0) why.push(`the ${name(p)} could not move at the start`);
    else if (level === 'strict' && !job(p)) why.push(`the ${name(p)} had no job`);
    else if ((PIECES[p.type].kind === 'fairy' || CIRCUMSTANTIAL.includes(p.type)) && !job(p)) why.push(`the ${name(p)} had no job`);
  }
  return why;
}

/** One line per piece and rabbit, for the page and the notebook. */
export function describeBalance(a) {
  if (!a) return [];
  const lines = a.pieces.map((p) => {
    const bits = [`${p.start} move${p.start === 1 ? '' : 's'} at the start`];
    bits.push(p.moves ? `moves ${p.moves} time${p.moves === 1 ? '' : 's'} in the solver's win` : 'sits out the solver\'s win');
    if (p.catches) bits.push(p.type === 'ball' ? 'sinks' : 'makes a catch');
    bits.push(p.needed ? (p.without ? `needed (par ${p.without} without it)` : 'needed (no win without it)') : 'not needed');
    return `${PIECES[p.type].name}: ${bits.join(', ')}.`;
  });
  for (const r of a.rabbits) {
    const readable = r.hops === null ? '' : r.hops >= r.len ? ', so you can see the whole pattern first' : `, ${r.len - r.hops} short of seeing the whole pattern`;
    lines.push(`Rabbit${r.name && r.name !== 'Random' ? ` (${r.name})` : ''}: a pattern of ${r.len}${r.hops === null ? '' : `, hops ${r.hops} time${r.hops === 1 ? '' : 's'} before it is caught`}${readable}.`);
  }
  lines.push(`At the start ${a.attacked ? `${a.attacked} of your pieces can be taken` : 'nothing of yours can be taken'}; the solver's win loses ${a.lost}.`);
  return lines;
}

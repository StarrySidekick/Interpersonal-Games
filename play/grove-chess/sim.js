// One bot for both sides, on the real rules (2026-10-13). The piece trials
// and the Custom page play levels against themselves with it, so a layout is
// judged by the game exactly as it is played: every rule, suit and neutral
// piece included, with no second copy of the rules to drift out of step.
//
// The bot is a minimax search with alpha-beta pruning (ai.js explains both),
// a fixed number of moves deep, then a quiescence search: at the end of each
// line it keeps following captures until the position is quiet, so it never
// stops counting halfway through a trade (the "horizon effect"). Your side
// moves with allMoves and playerMove, theirs with foeMovesFor and
// respondWith, so the same search plays either.
//
// Its sense of a position is the same for both sides: each piece's power on
// this board (power.js), a heart counting for a little more; how many moves
// each side has; how near each side's pieces are to the other King; a mop-up
// term (well ahead in an ending, push the lone King to the edge and bring
// your own close, which is how a King and a rook beat a lone King); and
// contempt (a side treats a draw by going round in circles as a little worse
// than even, so it plays on while it can).
//
// Under wandering clouds each side plans from what it can see (rules.js
// seenBy): the other side's hidden pieces are simply not in its picture,
// and a move that runs into one takes it, as in play. A suit's extra move
// (Swords, Stars) is chosen greedily for both sides alike, the way the rules
// choose it for theirs (rules.js bestFollow), so neither side gets a cleverer
// bonus than the other.

import { allMoves, playerMove, respondWith, foeMovesFor, movesFor, isOver, lost, initialState, stateKey, seenBy, withGrid, PIECES } from './rules.js';
import { powers } from './power.js';
import { rng } from '../../engine/seed.js';

const WIN = 1e4;
class OutOfNodes extends Error {}

/** The bots' sense of a position, in pawns (see above). */
export const EVAL = { mobility: 0.06, attack: 0.12, contempt: 1.5, mopup: 0.35 };

/** Every move their thinking pieces have: { k, x, y, cap, swap }. */
export function foeOptions(s) {
  const out = [];
  withGrid(s, () => s.foes.forEach((f, k) => { for (const m of foeMovesFor(s, k)) out.push({ k, x: m.x, y: m.y, cap: m.cap, ...(m.swap ? { swap: true } : {}) }); }));
  return out;
}

const live = (p) => !p.taken && !p.flying && p.x >= 0;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** What each piece is worth on this board, for state s's level. */
function values(day) {
  if (day._simValues) return day._simValues;
  const pw = powers(day.W, day.H);
  const v = (t) => (t === 'king' ? 0 : pw[t]?.power ?? PIECES[t]?.strength ?? 2);
  return (day._simValues = v);
}

/** How good s is for you (positive) or for them (negative). */
function evaluate(s, mobYou, mobFoe) {
  if (s.won) return WIN - s.t;
  if (lost(s)) return -WIN + s.t;
  const val = values(s.day);
  let lead = 0, v = 0;
  const kY = s.pieces.find((p) => live(p) && p.type === 'king'), kF = s.foes.find((f) => live(f) && f.type === 'king');
  for (const p of s.pieces) if (live(p) && p.type !== 'ball') {
    lead += val(p.type) * ((p.lives || 1) > 1 ? 1.4 : 1);
    if (p.type !== 'king' && kF) v -= EVAL.attack * cheb(p, kF);
  }
  for (const f of s.foes) if (live(f)) {
    lead -= val(f.type) * ((f.lives || 1) > 1 ? 1.4 : 1);
    if (f.type !== 'king' && kY) v += EVAL.attack * cheb(f, kY);
  }
  if (Math.abs(lead) >= 2.5 && kY && kF) {
    const [win, lose] = lead > 0 ? [kY, kF] : [kF, kY], sign = lead > 0 ? 1 : -1;
    const edge = Math.max(Math.abs(lose.x - (s.day.W - 1) / 2), Math.abs(lose.y - (s.day.H - 1) / 2));
    v += sign * EVAL.mopup * (edge - 0.5 * cheb(win, lose));
  }
  return lead + v + EVAL.mobility * (mobYou - mobFoe);
}

/** Your extra move in a turn a suit left open, chosen greedily as the rules
    choose theirs: Swords takes the most valuable piece it can, or stops;
    Stars takes, or else goes where they cannot reach, nearest their King. */
export function bonusMove(s) {
  const b = s.bonus, p = s.pieces[b.p], val = values(s.day);
  const reach = new Set(foeOptions(s).filter((m) => m.cap).map((m) => m.y * s.day.W + m.x));
  const king = s.foes.find((f) => live(f) && f.type === 'king') || s.foes.find(live);
  let best = { p: -1, x: 0, y: 0, cap: false }, bv = b.cap ? 0 : -Infinity;
  for (const m of movesFor(s, b.p)) {
    if (m.swap) continue;
    const victim = m.cap ? s.foes.find((f) => live(f) && f.x === m.x && f.y === m.y) : null;
    if (b.cap && !victim) continue;
    let v = victim ? 100 + (victim.type === 'king' ? 1000 : val(victim.type) * 10) : 0;
    if (reach.has(m.y * s.day.W + m.x)) v -= val(p.type) * 5;
    if (king) v -= cheb(m, king);
    if (v > bv) { bv = v; best = { p: b.p, ...m }; }
  }
  return best;
}

/** Captures only, until the position is quiet. */
function quiesce(s, you, a, b, ctx, qd, mobOther) {
  if (++ctx.nodes > ctx.max) throw new OutOfNodes();
  if (s.won || lost(s)) return evaluate(s, 0, 0);
  if (you && s.bonus) { const n = playerMove(s, bonusMove(s)); return quiesce(n, !!n.bonus, a, b, ctx, qd, mobOther); }
  const mine = you ? allMoves(s) : foeOptions(s);
  const stand = evaluate(s, you ? mine.length : mobOther, you ? mobOther : mine.length);
  if (qd >= 5) return stand;
  if (you ? stand >= b : stand <= a) return stand;
  if (you) a = Math.max(a, stand); else b = Math.min(b, stand);
  for (const m of order(mine.filter((m) => m.cap && m.p !== -1), s, you)) {
    let v;
    if (you) { const n = playerMove(s, m); v = quiesce(n, !!n.bonus, a, b, ctx, qd + 1, mine.length); }
    else v = quiesce(respondWith(s, m), true, a, b, ctx, qd + 1, mine.length);
    if (you) { if (v > a) a = v; } else if (v < b) b = v;
    if (a >= b) break;
  }
  return you ? a : b;
}

function search(s, you, depth, a, b, ctx, mobOther) {
  if (++ctx.nodes > ctx.max) throw new OutOfNodes();
  if (s.won) return WIN - s.t;
  if (lost(s)) return -WIN + s.t;
  if (s.day.rules.maxMoves > 0 && s.t >= s.day.rules.maxMoves) return 0;
  if (you && s.bonus) { const n = playerMove(s, bonusMove(s)); return search(n, !!n.bonus, n.bonus ? depth : depth - 1, a, b, ctx, mobOther); }
  if (depth <= 0) return quiesce(s, you, a, b, ctx, 0, mobOther);
  if (you) {
    const ms = order(allMoves(s), s, true);
    let best = -Infinity;
    for (const mv of ms) {
      const n = playerMove(s, mv);
      const v = n.won ? WIN - s.t : search(n, !!n.bonus, n.bonus ? depth : depth - 1, a, b, ctx, ms.length);
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  }
  const opts = order(foeOptions(s), s, false);
  if (!opts.length) return search(respondWith(s, null), true, depth - 1, a, b, ctx, 0);
  let best = Infinity;
  for (const m of opts) {
    const c = respondWith(s, m);
    const v = lost(c) ? -WIN + s.t : search(c, true, depth - 1, a, b, ctx, opts.length);
    if (v < best) best = v;
    if (v < b) b = v;
    if (a >= b) break;
  }
  return best;
}

/** Captures first, the biggest by the smallest piece, so alpha-beta prunes more. */
function order(ms, s, you) {
  const val = values(s.day), other = you ? s.foes : s.pieces, mine = you ? s.pieces : s.foes;
  const key = (m) => {
    if (!m.cap || m.p === -1) return 0;
    const v = other.find((q) => live(q) && q.x === m.x && q.y === m.y);
    return v ? (v.type === 'king' ? 1e6 : 1000 + val(v.type) * 10 - val(mine[you ? m.p : m.k]?.type)) : 500;
  };
  return ms.map((m) => ({ m, k: key(m) })).sort((x, y) => y.k - x.k).map((x) => x.m);
}

/**
 * The bot's move for `side` ('you' or 'foe') in state s: thinks `depth`
 * moves ahead (each side's move is one), deeper and deeper while it has
 * nodes left, and adds up to `noise` pawns at random to each move's score,
 * so the games differ. `repeats` is a set of positions already seen twice:
 * going back to one is a draw, scored at contempt. Returns a move for
 * playerMove (yours) or respondWith (theirs), or null for none.
 */
export function chooseMove(s, side, { depth = 2, noise = 0.25, rand = Math.random, maxNodes = 20000, repeats = null } = {}) {
  const you = side === 'you';
  // Plan from what this side can see.
  const v = seenBy(s, side);
  if (you && v.bonus) return bonusMove(v);
  let ms = you ? allMoves(v) : foeOptions(v);
  if (!ms.length) return null;
  ms = order(ms, v, you);
  const winNow = ms.find((m) => { const n = you ? playerMove(v, m) : respondWith(v, m); return you ? n.won : lost(n); });
  if (winNow) return winNow;
  const luck = ms.map(() => rand() * noise), ctx = { nodes: 0, max: maxNodes };
  let pick = ms[0];
  for (let d = 1; d <= depth; d++) {
    try {
      let best = -Infinity, bestMove = null;
      const scored = [];
      for (let k = 0; k < ms.length; k++) {
        const m = ms[k], n = you ? playerMove(v, m) : respondWith(v, m);
        let val;
        if (repeats?.has(stateKey(n))) val = -EVAL.contempt;
        else {
          // From this side's point of view: higher is better for it.
          const raw = you ? (n.bonus ? search(n, true, d, -Infinity, Infinity, ctx, ms.length) : search(n, false, d - 1, -Infinity, Infinity, ctx, ms.length))
            : search(n, true, d - 1, -Infinity, Infinity, ctx, ms.length);
          val = you ? raw : -raw;
        }
        scored.push({ m, val, luck: luck[k] });
        if (val + luck[k] > best) { best = val + luck[k]; bestMove = m; }
      }
      pick = bestMove;
      scored.sort((a, b) => b.val + b.luck - (a.val + a.luck));
      ms = scored.map((x) => x.m);
      luck.splice(0, luck.length, ...scored.map((x) => x.luck));
    } catch (e) {
      if (!(e instanceof OutOfNodes)) throw e;
      break;
    }
  }
  return pick;
}

const material = (s) => {
  const val = values(s.day);
  let v = 0;
  for (const p of s.pieces) if (!p.taken && p.type !== 'ball') v += val(p.type);
  for (const f of s.foes) if (!f.taken) v -= val(f.type);
  return v;
};

/**
 * One game on a level between two bots: bots[0] plays you (who moves
 * first, as the level says), bots[1] them. Returns { winner (0 you, 1 them,
 * null a draw), end ('king': a King or everything taken; 'limit': out of
 * moves; 'repeat': going round in circles; 'bare': only the Kings left),
 * plies, lead (your material lead after each move), line (the moves, to
 * replay: { you: move } or { foe: move }), use (each piece: moved, took,
 * lost; yours first, then theirs) }.
 */
export function playGame(level, bots, { seed = 1, maxPlies = 200 } = {}) {
  let s = initialState(level);
  const rand = rng(`sim:${seed}`), seen = new Map(), twice = new Set(), lead = [], line = [];
  const nP = s.pieces.length, use = [...s.pieces, ...s.foes].map((p, i) => ({ t: p.type, ...(p.suit ? { suit: p.suit } : {}), s: i < nP ? 0 : 1, moved: 0, took: 0, lost: false }));
  const finish = (winner, end) => {
    s.pieces.forEach((p, i) => { if (p.taken) use[i].lost = true; });
    s.foes.forEach((f, k) => { if (f.taken) use[nP + k].lost = true; });
    return { winner, end, plies: line.length, lead, line, use };
  };
  for (let ply = 0; ply < maxPlies; ply++) {
    if (s.won) return finish(0, 'king');
    if (lost(s)) return finish(1, 'king');
    if (isOver(s)) return finish(null, 'limit');
    const yoursLeft = s.pieces.filter((p) => !p.taken && p.type !== 'king' && p.type !== 'ball').length, theirsLeft = s.foes.filter((f) => !f.taken && f.type !== 'king' && f.type !== 'bunny').length;
    if (!yoursLeft && !theirsLeft && s.pieces.some((p) => !p.taken && p.type === 'king') && s.foes.some((f) => !f.taken && f.type === 'king')) return finish(null, 'bare');
    // Your turn (or the rest of it, after a suit's extra move).
    const k = stateKey(s), n0 = (seen.get(k) || 0) + 1;
    seen.set(k, n0);
    if (n0 >= 3) return finish(null, 'repeat');
    if (n0 === 2) twice.add(k);
    const mv = chooseMove(s, 'you', { ...bots[0], rand, repeats: twice }) || { p: -1, x: 0, y: 0, cap: false };
    const beforeTaken = s.foes.filter((f) => f.taken).length;
    const mid = playerMove(s, mv);
    if (mv.p >= 0) { use[mv.p].moved++; if (mid.foes.filter((f) => f.taken).length > beforeTaken) use[mv.p].took++; }
    line.push({ you: { p: mv.p, x: mv.x, y: mv.y, cap: !!mv.cap, ...(mv.swap ? { swap: true } : {}) } });
    lead.push(material(mid));
    if (mid.won) { s = mid; continue; }
    if (mid.bonus) { s = mid; continue; }
    // Their turn.
    const m = chooseMove(mid, 'foe', { ...bots[1], rand, repeats: twice });
    const yoursBefore = mid.pieces.filter((p) => p.taken).length;
    s = respondWith(mid, m);
    if (m) { use[nP + m.k].moved++; if (s.pieces.filter((p) => p.taken).length > yoursBefore) use[nP + m.k].took++; }
    line.push({ foe: m ? { k: m.k, x: m.x, y: m.y, ...(m.swap ? { swap: true } : {}) } : null });
    lead.push(material(s));
  }
  return finish(null, 'limit');
}

/** The states of a game, replayed from its line (for watching it). */
export function replayLine(level, line) {
  let s = initialState(level);
  const states = [s];
  for (const step of line) {
    s = step.you ? playerMove(s, step.you) : respondWith(s, step.foe);
    states.push(s);
  }
  return states;
}

/** Can you, moving first, win by force within `moves` of your own moves,
    whatever they do? 'yes', 'no', or 'unknown' if it ran out of budget. */
export function forcedWin(level, moves = 3, maxNodes = 60000) {
  const ctx = { nodes: 0, max: maxNodes };
  const wins = (s, d) => {
    if (++ctx.nodes > ctx.max) throw new OutOfNodes();
    for (const mv of order(allMoves(s), s, true)) {
      const n = playerMove(s, mv);
      if (n.won) return true;
      if (n.bonus) { if (wins(n, d)) return true; continue; }
      if (d <= 1) continue;
      const opts = foeOptions(n);
      let all = true;
      for (const m of opts.length ? opts : [null]) {
        const c = respondWith(n, m);
        if (lost(c) || isOver(c) || !wins(c, d - 1)) { all = false; break; }
      }
      if (all) return true;
    }
    return false;
  };
  try { return wins(initialState(level), moves) ? 'yes' : 'no'; } catch (e) { if (e instanceof OutOfNodes) return 'unknown'; throw e; }
}

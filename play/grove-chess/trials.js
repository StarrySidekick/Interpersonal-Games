// Piece trials (Timothy, 2026-10-13): "i want to be able to test pieces and
// see what they do to games when added or shuffled. i want a mode where i can
// choose what chess pieces are in, choose the size of the board, then you
// calculate the board layout that would make the games balanced and then test
// to see if the game would be "fun" and engaging to any extent and if there
// even is an orientation of pieces that is playable with that selection of
// pieces ... often times is also the assumption that the opposing sides are
// identical and mirrored. i want the ability to then see a newly invented
// piece or fairy piece and play a balanced game (if it exists) with that
// piece weaved in or some combination that works."
//
// How it works, in four steps:
//
// 1. Layouts. Every distinct way to stand the army on its back row (or back
//    two rows), the King always on the back row. The other side is the same
//    army, mirrored (the same files, like chess) or turned (read the other
//    way, as if the board were spun round). A layout and its reflection left
//    to right are the same game, so only one of each pair is kept.
// 2. Quick checks, cheap ones first: can anything be taken on the very first
//    move (Timothy's rule since 2026-10-07)? Can the side that moves first
//    force the King inside three moves, whatever the other side does (a
//    "forced win": the layout is broken)?
// 3. Self-play. Two copies of one bot play the layout against each other many
//    times, with a little noise so the games differ. The bot is the oldest
//    idea in computer chess, a minimax search with alpha-beta pruning
//    (ai.js explains it), plus a "quiescence" search at the end of each line:
//    it keeps following captures until the position is quiet, so it does not
//    stop counting halfway through a trade (the horizon effect). Its sense of
//    a position is the same for both sides: the pieces each has (worth their
//    power on this board, power.js), how many moves each has, and how near
//    each side's pieces stand to the other King.
// 4. Measures. From those games, how balanced and how much fun a layout looks.
//    The idea is Cameron Browne's: his program Ludi (2008) invented board
//    games and judged them by self-play against measures like these
//    (completion, balance, drama, uncertainty, duration), and one game it
//    invented, Yavalath, went on to be published and is still played. These
//    are guesses from bots, not truths: check them by playing.
//
// Everything is seeded, so the same question gets the same answer on any
// phone. Plain functions, no page: it runs in a worker (trials-worker.js),
// and in node for checking.

import { PIECES, OFF, EMPTY, OWN, ENEMY, STUMP } from './rules.js';
import { powers } from './power.js';
import { rng, shuffled } from '../../engine/seed.js';

const WIN = 1e4;
class OutOfNodes extends Error {}

/** Pieces that can stand in a trial: every chess and fairy piece with moves
    of its own, invented ones too. Not the rabbit (it rides heads), the ball
    or the loose rabbit. */
export const trialPiece = (k) => !!PIECES[k] && !!PIECES[k].moves && (['classic', 'fairy'].includes(PIECES[k].kind) || PIECES[k].invented) && k !== 'bunny';

// --- Layouts. -----------------------------------------------------------------

/** Does piece k move the same way mirrored left to right? Most do; a piece
    written with l or r in its Betza notation would not. */
function symmetric(k) {
  const n = 7, L = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? OFF : EMPTY), day = { W: n, H: n, rules: {} };
  for (const [x, y] of [[3, 3], [1, 2], [5, 4]]) {
    const a = new Set(PIECES[k].moves(L, { x, y, type: k }, 1, day).map((m) => `${n - 1 - m.x},${m.y}`));
    const b = PIECES[k].moves(L, { x: n - 1 - x, y, type: k }, 1, day).map((m) => `${m.x},${m.y}`);
    if (a.size !== b.length || b.some((q) => !a.has(q))) return false;
  }
  return true;
}

/** How many distinct arrangements of these items there are. */
function arrangements(items) {
  const count = {};
  for (const t of items) count[t] = (count[t] || 0) + 1;
  let n = 1;
  for (let i = 2; i <= items.length; i++) n *= i;
  for (const c of Object.values(count)) for (let i = 2; i <= c; i++) n /= i;
  return n;
}

/** Every distinct ordering of a list with repeats (null is an empty square). */
function* permutations(items) {
  const a = items.slice().sort((p, q) => String(p).localeCompare(String(q)));
  yield a.slice();
  // The next ordering in dictionary order (Narayana Pandita's algorithm).
  const cmp = (p, q) => String(p).localeCompare(String(q));
  for (;;) {
    let i = a.length - 2;
    while (i >= 0 && cmp(a[i], a[i + 1]) >= 0) i--;
    if (i < 0) return;
    let j = a.length - 1;
    while (cmp(a[j], a[i]) <= 0) j--;
    [a[i], a[j]] = [a[j], a[i]];
    a.splice(i + 1, a.length - i - 1, ...a.slice(i + 1).reverse());
    yield a.slice();
  }
}

/**
 * The layouts to try: arrays of W * rows cells, the back row first, each a
 * piece type or null. The King stands on the back row. A layout and its
 * reflection count once (when every piece is symmetric). Up to `cap`, drawn
 * evenly at random from all of them when there are more.
 */
export function layouts(army, W, rows, { cap = 60, seed = 1 } = {}) {
  const cells = W * rows, items = [...army, ...Array(Math.max(0, cells - army.length)).fill(null)];
  if (army.length > cells) return { list: [], total: 0 };
  const sym = [...new Set(army)].every(symmetric), rand = rng(`trials:layouts:${seed}`);
  const key = (c) => c.map((t) => t || '.').join(',');
  const mirror = (c) => Array.from({ length: cells }, (_, i) => c[Math.floor(i / W) * W + (W - 1 - (i % W))]);
  const kingBack = (c) => c.indexOf('king') < W || !army.includes('king');
  const seen = new Set(), list = [];
  const add = (c) => {
    if (!kingBack(c)) return;
    const k = key(c), m = sym ? key(mirror(c)) : k, id = k < m ? k : m;
    if (seen.has(id)) return;
    seen.add(id); list.push(k <= m ? c : mirror(c));
  };
  const n = arrangements(items);
  if (n <= 20000) for (const c of permutations(items)) add(c);
  else for (let k = 0; k < cap * 40 && list.length < cap * 4; k++) add(shuffled(items, rand));
  const total = n <= 20000 ? list.length : null; // null: too many to count exactly
  return { list: list.length > cap ? shuffled(list, rand).slice(0, cap) : list, total };
}

/**
 * A layout as a starting position: { W, H, pieces: [{ t, s, x, y }],
 * statues: Map(square -> order) }. Side 0 is yours, along the bottom; side 1
 * is theirs, along the top, mirrored ('mirror': the same files) or turned
 * ('turned': the files reversed). `statueRow`: the middle row is statues
 * that open one a turn (the descent's), in an order drawn from `seed`.
 */
export function position(cells, { W, H, rows = 1, facing = 'mirror', statueRow = false, seed = 1 }) {
  const pieces = [];
  cells.forEach((t, i) => {
    if (!t) return;
    const x = i % W, r = Math.floor(i / W);
    pieces.push({ t, s: 0, x, y: r });
    pieces.push({ t, s: 1, x: facing === 'turned' ? W - 1 - x : x, y: H - 1 - r });
  });
  // The statues' row: which square opens when is drawn for each game
  // (statueOrder), as the descent draws it for each board.
  const statueRowY = statueRow && H % 2 === 1 && H >= 2 * rows + 1 ? (H - 1) / 2 : null;
  return { W, H, pieces, statues: statueOrder({ W, statueRowY }, seed), statueRowY };
}

/** The statues of a position's row, opening in an order drawn from `seed`:
    a Map of square to the turn it opens after (0 first). */
export function statueOrder({ W, statueRowY }, seed) {
  const statues = new Map();
  if (statueRowY == null) return statues;
  shuffled(Array.from({ length: W }, (_, x) => statueRowY * W + x), rng(`trials:statues:${seed}`)).forEach((sq, k) => statues.set(sq, k));
  return statues;
}

/** A position in FEN, extended: the six chess letters as usual (capitals
    yours), any other piece as its id in brackets, [Tallrook] for yours and
    [tallrook] for theirs. variants.js readFen reads it. */
export function fenOf({ W, H, pieces }) {
  const LETTER = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };
  const rows = [];
  for (let y = H - 1; y >= 0; y--) {
    let row = '', gap = 0;
    for (let x = 0; x < W; x++) {
      const p = pieces.find((q) => q.x === x && q.y === y);
      if (!p) { gap++; continue; }
      if (gap) { row += gap; gap = 0; }
      const tok = LETTER[p.t] ? LETTER[p.t] : `[${p.t}]`;
      row += p.s === 0 ? (LETTER[p.t] ? tok.toUpperCase() : `[${p.t[0].toUpperCase()}${p.t.slice(1)}]`) : tok;
    }
    if (gap) row += gap;
    rows.push(row);
  }
  return rows.join('/');
}

// --- The game. ------------------------------------------------------------------
// A game state is mutable and undone move by move ("make and unmake"), which is
// much faster than copying it at every step of a search.

function start(pos, maxPlies) {
  const { W, H } = pos, board = new Int16Array(W * H).fill(-1), statue = new Int16Array(W * H).fill(-1);
  const pcs = pos.pieces.map((p) => ({ ...p, alive: true }));
  pcs.forEach((p, i) => { board[p.y * W + p.x] = i; });
  for (const [sq, k] of pos.statues || []) statue[sq] = k;
  const day = { W, H, rules: {}, stumps: new Set(), holes: new Set(), brambleAt: new Map() };
  const vals = powers(W, H);
  const value = pcs.map((p) => (p.t === 'king' ? 0 : vals[p.t]?.power ?? PIECES[p.t].strength ?? 3));
  return { W, H, board, statue, statues: pos.statues?.size || 0, pcs, value, ply: 0, day, maxPlies, kings: [pcs.findIndex((p) => p.t === 'king' && p.s === 0), pcs.findIndex((p) => p.t === 'king' && p.s === 1)] };
}

/** Every move side s has: { i, x, y, c (the piece it takes, or -1), pr }. */
function movesOf(st, s) {
  const { W, H, board, statue, pcs } = st, open = st.ply >> 1, out = [];
  const L = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return OFF;
    const q = y * W + x;
    if (statue[q] >= open) return STUMP;
    const j = board[q];
    return j < 0 ? EMPTY : pcs[j].s === s ? OWN : ENEMY;
  };
  for (let i = 0; i < pcs.length; i++) {
    const p = pcs[i];
    if (!p.alive || p.s !== s) continue;
    const ms = PIECES[p.t].moves(L, { x: p.x, y: p.y, type: p.t }, s === 0 ? 1 : -1, st.day);
    for (const m of ms) {
      if (m.x < 0 || m.y < 0 || m.x >= W || m.y >= H) continue;
      const j = board[m.y * W + m.x];
      if (j >= 0 ? pcs[j].s === s || !m.cap : m.cap || statue[m.y * W + m.x] >= open) continue;
      out.push({ i, x: m.x, y: m.y, c: j, pr: p.t === 'pawn' && m.y === (s === 0 ? H - 1 : 0) ? 'queen' : null });
    }
  }
  return out;
}

function make(st, m) {
  const p = st.pcs[m.i];
  m.fx = p.x; m.fy = p.y; m.ft = p.t;
  st.board[p.y * st.W + p.x] = -1;
  if (m.c >= 0) st.pcs[m.c].alive = false;
  st.board[m.y * st.W + m.x] = m.i;
  p.x = m.x; p.y = m.y;
  if (m.pr) p.t = m.pr;
  st.ply++;
}

function unmake(st, m) {
  const p = st.pcs[m.i];
  st.ply--;
  p.t = m.ft;
  st.board[m.y * st.W + m.x] = m.c;
  if (m.c >= 0) st.pcs[m.c].alive = true;
  p.x = m.fx; p.y = m.fy;
  st.board[p.y * st.W + p.x] = m.i;
}

const takesKing = (st, ms) => ms.some((m) => m.c >= 0 && st.pcs[m.c].t === 'king');
const material = (st, s) => { let v = 0; st.pcs.forEach((p, i) => { if (p.alive && p.s === s) v += st.value[i]; }); return v; };

/** How good the position is for side s (higher is better), the same sense
    for both sides: material, mobility, and pieces near the other King. */
// The weights of the bots' sense of a position, in pawns: per move it has
// over the other side, per square nearer the other King, how much a side
// dislikes a draw by repetition (chess engines call this contempt), and the
// mop-up below.
export const EVAL = { mobility: 0.06, attack: 0.12, contempt: 1.5, mopup: 0.35 };
function evaluate(st, s, mine, theirs) {
  let v = 0, lead = 0;
  const kO = st.pcs[st.kings[1 - s]], kM = st.pcs[st.kings[s]];
  st.pcs.forEach((p, i) => {
    if (!p.alive) return;
    const sign = p.s === s ? 1 : -1, k = p.s === s ? kO : kM;
    lead += sign * st.value[i];
    if (p.t !== 'king' && k?.alive) v -= sign * EVAL.attack * Math.max(Math.abs(p.x - k.x), Math.abs(p.y - k.y));
  });
  // Mop-up, as chess engines do it: a side well ahead in an ending wants the
  // other King on the edge with little room, and its own King close by, which
  // is how a King and a rook beat a lone King.
  if (Math.abs(lead) >= 2.5 && kO?.alive && kM?.alive) {
    const [win, lose] = lead > 0 ? [kM, kO] : [kO, kM], sign = lead > 0 ? 1 : -1;
    const edge = Math.max(Math.abs(lose.x - (st.W - 1) / 2), Math.abs(lose.y - (st.H - 1) / 2));
    const apart = Math.max(Math.abs(win.x - lose.x), Math.abs(win.y - lose.y));
    v += sign * EVAL.mopup * (edge - 0.5 * apart);
  }
  return lead + v + EVAL.mobility * (mine - theirs);
}

/** Captures only, until the position is quiet. */
function quiesce(st, s, alpha, beta, ctx, ms, theirs, qd) {
  if (++ctx.nodes > ctx.max) throw new OutOfNodes();
  if (takesKing(st, ms)) return WIN - st.ply;
  const stand = evaluate(st, s, ms.length, theirs);
  if (qd >= 6 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = ms.filter((m) => m.c >= 0).sort((a, b) => st.value[b.c] - st.value[a.c] || st.value[a.i] - st.value[b.i]);
  for (const m of caps) {
    make(st, m);
    const reply = movesOf(st, 1 - s);
    const v = -quiesce(st, 1 - s, -beta, -alpha, ctx, reply, ms.length, qd + 1);
    unmake(st, m);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/** Order moves so alpha-beta prunes the most: the King first, then the
    biggest captures by the smallest pieces, then the rest. */
function ordered(st, ms) {
  return ms.map((m) => ({ m, k: m.c >= 0 ? (st.pcs[m.c].t === 'king' ? 1e6 : 1000 + st.value[m.c] * 10 - st.value[m.i]) : 0 }))
    .sort((a, b) => b.k - a.k).map((x) => x.m);
}

function search(st, s, depth, alpha, beta, ctx, theirs) {
  if (++ctx.nodes > ctx.max) throw new OutOfNodes();
  const ms = movesOf(st, s);
  if (takesKing(st, ms)) return WIN - st.ply;
  if (st.ply >= st.maxPlies) return 0; // out of moves: a draw
  if (depth <= 0) return quiesce(st, s, alpha, beta, ctx, ms, theirs, 0);
  if (!ms.length) { // no move at all: it passes, as in Grove Chess
    st.ply++;
    const v = -search(st, 1 - s, depth - 1, -beta, -alpha, ctx, 0);
    st.ply--;
    return v;
  }
  let best = -Infinity;
  for (const m of ordered(st, ms)) {
    make(st, m);
    const v = -search(st, 1 - s, depth - 1, -beta, -alpha, ctx, ms.length);
    unmake(st, m);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Side s's move: thinks `depth` moves ahead (each side's move is one),
 * deeper and deeper while it has nodes left, and adds up to `noise` (in
 * pawns) at random to each move's score, so the games differ. A move that
 * scores far below the best is never picked, however lucky its noise.
 */
export function chooseMove(st, s, { depth = 2, noise = 0.25, rand = Math.random, maxNodes = 30000, repeats = null } = {}) {
  let ms = movesOf(st, s);
  if (!ms.length) return null;
  const king = ms.find((m) => m.c >= 0 && st.pcs[m.c].t === 'king');
  if (king) return king;
  ms = ordered(st, ms);
  const luck = ms.map(() => rand() * noise);
  let pick = ms[0];
  const ctx = { nodes: 0, max: maxNodes };
  for (let d = 1; d <= depth; d++) {
    try {
      let best = -Infinity, bestMove = null;
      const scored = [];
      for (let k = 0; k < ms.length; k++) {
        const m = ms[k];
        make(st, m);
        // A move that repeats a position for the third time is a draw (0):
        // the side ahead steers clear of it, the side behind is glad of it.
        // Moves that cannot beat the best so far, noise and all, need only a bound.
        const v = repeats?.has(keyOf(st, 1 - s)) ? -EVAL.contempt : -search(st, 1 - s, d - 1, -Infinity, -(best - noise), ctx, ms.length);
        unmake(st, m);
        scored.push({ m, v, luck: luck[k] });
        if (v + luck[k] > best) { best = v + luck[k]; bestMove = m; }
      }
      pick = bestMove;
      scored.sort((a, b) => b.v + b.luck - (a.v + a.luck));
      ms = scored.map((x) => x.m);
      luck.splice(0, luck.length, ...scored.map((x) => x.luck));
    } catch (e) {
      if (!(e instanceof OutOfNodes)) throw e;
      // Unmake whatever the search left made: replay from a fresh copy is
      // simpler, so the caller passes a state it can throw away (playGame).
      ctx.broken = true;
      break;
    }
  }
  return { ...pick, broken: !!ctx.broken };
}

/** Copy a game state (to recover from a search cut short). */
function copy(st) {
  return { ...st, board: st.board.slice(), statue: st.statue, pcs: st.pcs.map((p) => ({ ...p })), value: st.value, kings: st.kings };
}

/** The squares and pieces as a string, for spotting a repeated position. */
const keyOf = (st, s) => `${s}${st.statues ? Math.min(st.ply >> 1, st.statues) : ''}:${Array.from(st.board).join(',')}`;

/**
 * One game. `bots` is the two sides' players ({ depth, noise, maxNodes });
 * side 0 moves first. Returns { winner (0, 1 or null), plies, end ('king',
 * 'limit', 'repeat', 'bare', 'stuck'), lead: material lead of side 0 after
 * each move, moves: [[from, to]...], use: per piece { moved, took, lost } }.
 */
export function playGame(pos, bots, { seed = 1, maxPlies = 80 } = {}) {
  // Each game draws its own order for the statues to open in.
  const st = start(pos.statueRowY != null ? { ...pos, statues: statueOrder(pos, `${seed}`) } : pos, maxPlies);
  const rand = rng(`trials:game:${seed}`), seen = new Map(), twice = new Set(), lead = [], moves = [];
  const use = st.pcs.map(() => ({ moved: 0, took: 0, lost: false }));
  let s = 0, passes = 0;
  for (;;) {
    if (st.ply >= maxPlies) return finish(null, 'limit');
    const mine = st.pcs.filter((p) => p.alive && p.s === 0 && p.t !== 'king').length, theirs = st.pcs.filter((p) => p.alive && p.s === 1 && p.t !== 'king').length;
    if (!mine && !theirs) return finish(null, 'bare');
    const k = keyOf(st, s), n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n >= 3) return finish(null, 'repeat');
    if (n === 2) twice.add(k);
    const work = copy(st);
    const m = chooseMove(work, s, { ...bots[s], rand, repeats: twice });
    if (!m) {
      if (++passes >= 2) return finish(null, 'stuck');
      st.ply++; s = 1 - s; continue;
    }
    passes = 0;
    const mv = { i: m.i, x: m.x, y: m.y, c: m.c, pr: m.pr };
    use[mv.i].moved++;
    if (mv.c >= 0) { use[mv.i].took++; use[mv.c].lost = true; }
    moves.push([st.pcs[mv.i].x, st.pcs[mv.i].y, mv.x, mv.y]);
    make(st, mv);
    lead.push(material(st, 0) - material(st, 1));
    if (mv.c >= 0 && st.pcs[mv.c].t === 'king') return finish(s, 'king');
    s = 1 - s;
  }
  function finish(winner, end) {
    // (A pawn that became a queen still counts as the pawn it started as.)
    return { winner, end, plies: st.ply, lead, moves, use: use.map((u, i) => ({ ...u, t: pos.pieces[i].t, s: pos.pieces[i].s })) };
  }
}

/** Can side 0, moving first, take the other King by force within `moves`
    of its own moves, whatever side 1 does? A layout where it can is broken.
    Gives up (and says no) past a budget of positions. */
export function forcedWin(pos, moves = 3, maxNodes = 120000) {
  // With a statue row the answer depends on which statues open first: it
  // is a forced win if it is one in most of four orders.
  if (pos.statueRowY != null) {
    const r = [1, 2, 3, 4].map((k) => forcedWin({ ...pos, statueRowY: null, statues: statueOrder(pos, `forced:${k}`) }, moves, maxNodes / 4));
    return r.filter((x) => x === 'yes').length >= 3 ? 'yes' : r.includes('unknown') ? 'unknown' : 'no';
  }
  const st = start(pos, 999), ctx = { nodes: 0, max: maxNodes };
  /** Does s, to move, win by force within d of its own moves? */
  const wins = (s, d) => {
    if (++ctx.nodes > ctx.max) throw new OutOfNodes();
    const ms = movesOf(st, s);
    if (takesKing(st, ms)) return true;
    if (d <= 1) return false;
    for (const m of ordered(st, ms)) {
      make(st, m);
      const replies = movesOf(st, 1 - s);
      let all = !takesKing(st, replies);
      // Every reply must lose. (No reply at all: they pass.)
      if (all) {
        if (!replies.length) { st.ply++; all = wins(s, d - 1); st.ply--; }
        else for (const r of ordered(st, replies)) {
          make(st, r);
          const ok = wins(s, d - 1);
          unmake(st, r);
          if (!ok) { all = false; break; }
        }
      }
      unmake(st, m);
      if (all) return true;
    }
    return false;
  };
  try { return wins(0, moves) ? 'yes' : 'no'; } catch (e) { if (e instanceof OutOfNodes) return 'unknown'; throw e; }
}

/** Could anything be taken on the very first move, by either side? */
export function openingCaptures(pos) {
  const st = start(pos, 999), a = movesOf(st, 0).filter((m) => m.c >= 0).length;
  st.ply++; // as if side 0 had passed: what side 1 could take, from the start
  const b = movesOf(st, 1).filter((m) => m.c >= 0).length;
  return { first: a, second: b };
}

// --- Measures. --------------------------------------------------------------------

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** 1 inside [lo, hi], falling off to 0 at half lo and twice hi. */
const band = (x, lo, hi) => (x < lo ? clamp((x - lo / 2) / (lo / 2)) : x > hi ? clamp(1 - (x - hi) / hi) : 1);

/**
 * How a layout plays, from its games: `games` between equal bots, `skill`
 * games between a stronger and a weaker bot (each a { game, strong } with
 * strong the stronger side), and the forced-win check. Every measure is 0
 * to 100. `fun` puts them together; `verdict` is 'playable', 'shaky' or
 * 'broken', with `why`, plain words.
 */
export function judge(pos, games, skill = [], { forced = 'no', opening = null } = {}) {
  const n = games.length, first = games.filter((g) => g.winner === 0).length, second = games.filter((g) => g.winner === 1).length, decided = first + second;
  // A few games prove little: two wins out of two is luck as often as not.
  // So the first side's share is taken by Laplace's rule of succession (one
  // more win for each side than was seen), which pulls a small sample toward
  // even: 2 of 2 reads as 3 in 4, 8 of 8 as 9 in 10.
  const share = (first + 1) / (decided + 2);
  const balance = 100 * (1 - 2 * Math.abs(share - 0.5));
  const decisive = 100 * (n ? decided / n : 0);
  const won = games.filter((g) => g.winner !== null);
  const avgPlies = won.length ? won.reduce((a, g) => a + g.plies, 0) / won.length : games.reduce((a, g) => a + g.plies, 0) / Math.max(1, n);
  const cells = pos.W * pos.H;
  const length = 100 * band(avgPlies, Math.max(10, cells * 0.5), Math.max(24, cells * 1.8));
  // Drama: how often the lead (by at least a pawn) changes hands in a game,
  // and how often the winner was behind at some point (a comeback).
  let swaps = 0, comebacks = 0, late = 0;
  for (const g of games) {
    let side = 0;
    for (const v of g.lead) { const now = v >= 1 ? 1 : v <= -1 ? -1 : 0; if (now && side && now !== side) swaps++; if (now) side = now; }
    if (g.winner !== null) {
      const sign = g.winner === 0 ? 1 : -1;
      if (g.lead.some((v) => sign * v <= -1)) comebacks++;
      // Uncertainty: when the winner went ahead for good, as a share of the game.
      let k = g.lead.length;
      while (k > 0 && sign * g.lead[k - 1] >= 1) k--;
      late += g.lead.length ? k / g.lead.length : 0;
    }
  }
  const drama = 100 * clamp(0.6 * (swaps / Math.max(1, n)) / 1.2 + 0.4 * (comebacks / Math.max(1, decided)) / 0.35);
  const uncertainty = 100 * (decided ? clamp((late / decided) / 0.7) : 0);
  // Skill: does the stronger bot win? A game the better player usually wins
  // rewards getting better at it (the mastery path).
  const sk = skill.length ? skill.reduce((a, x) => a + (x.game.winner === x.strong ? 1 : x.game.winner === null ? 0.5 : 0), 0) / skill.length : null;
  const skillScore = sk === null ? null : 100 * clamp((sk - 0.5) / 0.4);
  // Every piece has a part: the share of games in which each kind moved.
  const kinds = {};
  for (const g of games) {
    const by = {};
    for (const u of g.use) { const k = u.t; by[k] = by[k] || { moved: 0, n: 0, took: 0, lost: 0 }; by[k].n++; if (u.moved) by[k].moved++; by[k].took += u.took; if (u.lost) by[k].lost++; }
    for (const [k, b] of Object.entries(by)) {
      kinds[k] = kinds[k] || { moved: 0, n: 0, took: 0, lost: 0, moves: 0 };
      kinds[k].moved += b.moved; kinds[k].n += b.n; kinds[k].took += b.took; kinds[k].lost += b.lost;
    }
    for (const u of g.use) kinds[u.t].moves += u.moved;
  }
  // Per piece of that kind, per game: the share that moved at all, captures, the share taken, moves made.
  const pieceUse = Object.fromEntries(Object.entries(kinds).map(([k, b]) => [k, { moved: b.moved / b.n, took: b.took / b.n, lost: b.lost / b.n, moves: b.moves / b.n }]));
  const nonKing = Object.entries(pieceUse).filter(([k]) => k !== 'king');
  const parts = 100 * (nonKing.length ? nonKing.reduce((a, [, u]) => a + clamp(u.moved / 0.75), 0) / nonKing.length : 1);
  // Variety: how many different openings (the first four moves) the games had.
  const openings = new Set(games.map((g) => g.moves.slice(0, 4).map((m) => m.join('')).join('|'))).size;
  const variety = 100 * clamp((openings - 1) / Math.max(1, n * 0.6));

  const fun = Math.round(0.2 * balance + 0.15 * decisive + 0.1 * length + 0.15 * drama + 0.1 * uncertainty + 0.15 * (skillScore ?? 50) + 0.1 * parts + 0.05 * variety);
  const why = [];
  const ahead = first > second ? 'first' : 'second';
  if (forced === 'yes') why.push('the side that moves first can take the King by force within three moves');
  if (decided >= 6 && Math.abs(share - 0.5) >= 0.35) why.push(`the ${ahead} side wins ${Math.max(first, second)} of ${decided} decided games`);
  if (decisive < 15) why.push(`${n - decided} of ${n} games ended with no King taken`);
  const shaky = [];
  if (!why.length) {
    if (decided >= 4 && balance < 55) shaky.push(`lopsided: the ${ahead} side wins ${Math.max(first, second)} of ${decided}`);
    if (decisive < 40) shaky.push('drawish: many games end with no King taken');
    if (skillScore !== null && skill.length >= 8 && skillScore < 30) shaky.push('luck more than skill: the stronger bot barely wins more often');
    if (length < 45) shaky.push(avgPlies < cells * 0.5 ? 'over very fast' : 'drags on');
    for (const [k, u] of nonKing) if (u.moved < 0.3) shaky.push(`the ${PIECES[k].name.toLowerCase()} hardly ever moves`);
    if (opening && (opening.first || opening.second)) shaky.push('something can be taken on the very first move');
  }
  const verdict = why.length ? 'broken' : (fun >= 60 && !shaky.length) || (fun >= 68 && shaky.length <= 1) ? 'playable' : 'shaky';
  return {
    fun, verdict, why: why.length ? why : shaky,
    measures: { balance: Math.round(balance), decisive: Math.round(decisive), length: Math.round(length), drama: Math.round(drama), uncertainty: Math.round(uncertainty), skill: skillScore === null ? null : Math.round(skillScore), parts: Math.round(parts), variety: Math.round(variety) },
    record: { games: n, first, second, draws: n - decided, avgPlies: Math.round(avgPlies * 10) / 10, skillShare: sk, openings, forced },
    pieceUse
  };
}

/** The measures in words, one line each, for the page and for copying out. */
export const MEASURE_WORDS = {
  balance: ['Balance', 'Whether the first and second side win about as often (chess is about 55 to 45).'],
  decisive: ['Decisive', 'How often a game ends with a King taken, not out of moves or going round in circles.'],
  length: ['Length', 'Whether a decided game is a sensible length for the board: not over in a flash, not a slog.'],
  drama: ['Drama', 'How often the lead changes hands, and how often the winner came back from behind.'],
  uncertainty: ['Uncertainty', 'How late in the game the winner pulls ahead for good: later is more exciting.'],
  skill: ['Skill', 'How often a bot that thinks further ahead beats one that does not: does getting better pay?'],
  parts: ['Every piece plays', 'How often each kind of piece gets moved at all.'],
  variety: ['Variety', 'How many different openings the games had.']
};

// --- A whole trial. ----------------------------------------------------------------

/** How hard to look: layouts tried, games in the screen and in the judging,
    how many go through to be judged, and how deep the bots think. */
export const EFFORT = {
  quick: { cap: 30, screen: 4, finalists: 4, games: 10, skill: 4, depth: 2 },
  thorough: { cap: 80, screen: 6, finalists: 8, games: 20, skill: 8, depth: 2 }
};

/**
 * Try an army on a board. `spec`: { army: [types], W, H, rows (1 or 2),
 * facing ('mirror', 'turned' or 'both'), statueRow, firstCapture (throw out
 * layouts where something can be taken on the first move), maxPlies,
 * effort, seed }. Calls `post` with progress ({ type: 'progress', stage,
 * done, total }) and returns { results (best first), tried, total, thrown }.
 */
export function runTrial(spec, post = () => {}) {
  const E = EFFORT[spec.effort] || EFFORT.quick, { W, H } = spec, seed = spec.seed || 1;
  const rows = spec.army.length > W ? 2 : spec.rows || 1;
  const facings = spec.facing === 'both' ? ['mirror', 'turned'] : [spec.facing || 'mirror'];
  const maxPlies = spec.maxPlies || Math.max(60, W * H * 3);
  const found = layouts(spec.army, W, rows, { cap: Math.ceil(E.cap / facings.length), seed }), total = found.total;
  // The order given, as given (`mine`): centred on the back row, and always judged.
  const given = spec.mine ? givenCells(spec.army, W, rows) : null;
  const list = given ? [given, ...found.list.filter((c) => c.join() !== given.join())] : found.list;
  const thrown = {};
  const throwOut = (why) => { thrown[why] = (thrown[why] || 0) + 1; };
  let cands = [];
  const seenPos = new Set(), early = [];
  let k = 0;
  const all = list.length * facings.length;
  for (const cells of list) for (const facing of facings) {
    post({ type: 'progress', stage: 'check', done: ++k, total: all });
    const pos = position(cells, { W, H, rows, facing, statueRow: spec.statueRow, seed });
    const fen = fenOf(pos);
    if (seenPos.has(fen)) continue; // the same both ways (a line that reads the same reversed)
    seenPos.add(fen);
    const opening = openingCaptures(pos);
    const forced = forcedWin(pos, 3);
    if (forced === 'yes' && cells !== given) { throwOut('the first side can take the King by force'); continue; }
    const c = { cells, facing, pos, fen, opening, forced, mine: cells === given };
    if (cells !== given && spec.firstCapture !== false && (opening.first || opening.second)) { throwOut('something could be taken on the first move'); early.push(c); continue; }
    cands.push(c);
  }
  // If the first-move rule threw out every layout, judge them anyway, marked,
  // so the answer says whether anything would be playable without the rule.
  const relaxed = !cands.some((c) => !c.mine) && early.length > 0;
  if (relaxed) cands = [...cands, ...early];
  // The screen: a few quick games each, between quick bots.
  const quickBot = { depth: 1, noise: 0.35, maxNodes: 4000 };
  cands.forEach((c, i) => {
    post({ type: 'progress', stage: 'screen', done: i + 1, total: cands.length });
    c.screen = Array.from({ length: E.screen }, (_, g) => playGame(c.pos, [quickBot, quickBot], { seed: `${seed}:${i}:s${g}`, maxPlies }));
    const j = judge(c.pos, c.screen, [], { forced: c.forced, opening: c.opening });
    c.quick = j.measures.balance * 0.4 + j.measures.decisive * 0.3 + j.measures.drama * 0.15 + j.measures.parts * 0.15;
  });
  // The best of the screen go through, and the order given always does.
  const finalists = cands.filter((c) => !c.mine).sort((a, b) => b.quick - a.quick).slice(0, E.finalists);
  for (const c of cands) if (c.mine) finalists.unshift(c);
  // The judging: more games, between bots that think further, and some between
  // a stronger and a weaker bot.
  const bot = { depth: E.depth, noise: 0.25, maxNodes: 20000 }, weak = { depth: 1, noise: 0.9, maxNodes: 3000 };
  const results = finalists.map((c, i) => {
    post({ type: 'progress', stage: 'judge', done: i + 1, total: finalists.length });
    const games = Array.from({ length: E.games }, (_, g) => playGame(c.pos, [bot, bot], { seed: `${seed}:${c.fen}:g${g}`, maxPlies }));
    const skill = Array.from({ length: E.skill }, (_, g) => {
      const strong = g % 2;
      return { strong, game: playGame(c.pos, strong === 0 ? [bot, weak] : [weak, bot], { seed: `${seed}:${c.fen}:k${g}`, maxPlies }) };
    });
    const j = judge(c.pos, games, skill, { forced: c.forced, opening: c.opening });
    const sample = games.find((g) => g.winner !== null) || games[0];
    return { cells: c.cells, facing: c.facing, fen: c.fen, W, H, rows, statueRow: c.pos.statueRowY != null, mine: !!c.mine, ...j,
      sample: { moves: sample.moves, winner: sample.winner, end: sample.end, seed: `${seed}:${c.fen}:g${games.indexOf(sample)}` } };
  });
  results.sort((a, b) => (b.verdict === 'broken' ? -1 : 0) - (a.verdict === 'broken' ? -1 : 0) || b.fun - a.fun);
  return { army: spec.army, W, H, results, tried: cands.length, total: total ?? null, considered: all, thrown, relaxed };
}

/** The army in the order given, centred on the back row (then the next). */
export function givenCells(army, W, rows = 1) {
  const cells = Array(W * rows).fill(null), back = army.slice(0, W), rest = army.slice(W);
  const at = Math.floor((W - back.length) / 2);
  back.forEach((t, i) => { cells[at + i] = t; });
  const at2 = Math.floor((W - rest.length) / 2);
  rest.forEach((t, i) => { cells[W + at2 + i] = t; });
  return cells;
}

/**
 * Weave a piece into an army: each kind of piece in it but the King swapped,
 * one at a time, for the new one, and the new one added if there is room.
 * Each army gets a smaller trial; the best layout of each comes back, the
 * best army first. Returns { weave, armies: [{ army, change, best, verdictCount }] }.
 */
export function runWeave(spec, post = () => {}) {
  const { army, weave, W } = spec, rows = spec.rows || 1;
  const kinds = [...new Set(army.filter((k) => k !== 'king' && k !== weave))];
  const options = kinds.map((k) => {
    const i = army.indexOf(k), a = army.slice();
    a[i] = weave;
    return { army: a, change: `the ${PIECES[k].name.toLowerCase()} swapped for the ${PIECES[weave].name.toLowerCase()}` };
  });
  if (army.length < W * rows) options.push({ army: [...army, weave], change: `the ${PIECES[weave].name.toLowerCase()} added` });
  const out = options.map((o, i) => {
    const r = runTrial({ ...spec, army: o.army, effort: 'quick' }, (p) => post({ ...p, army: i + 1, armies: options.length }));
    return { army: o.army, change: o.change, best: r.results[0] || null, results: r.results, tried: r.tried, thrown: r.thrown,
      playable: r.results.filter((x) => x.verdict === 'playable').length };
  });
  out.sort((a, b) => (b.best?.verdict === 'playable') - (a.best?.verdict === 'playable') || (b.best?.fun ?? -1) - (a.best?.fun ?? -1));
  return { weave, armies: out };
}

// Changeling's rules, its solver and its dealer. No DOM here, so the same
// file runs in the page and under node (check.mjs).
//
// The game in one line: you are one piece, every move is a capture, and you
// become whatever you take. Clear the board.
//
// A board is a grid with holes. Squares are numbered y * W + x, with y = 0
// at the top. Holes stop sliding pieces; jumping pieces fly over them.

import { rng } from '../../engine/seed.js';

// --- Pieces. ---------------------------------------------------------------
// Each is built from three kinds of move:
//   leap:  jump straight to a square at this offset, over anything;
//   slide: step along this offset again and again, taking the first piece met;
//   hop:   the cannon's move: along a line, over exactly one piece, taking the
//          next piece beyond it.
// An offset [a, b] stands for all eight of its turns and mirrors, except a
// pawn's, which are written out because a pawn only goes up.

export const PIECES = {
  pawn: { name: 'Pawn', say: 'Takes one step diagonally up the board. Never down.', leap: [], only: [[1, -1], [-1, -1]] },
  knight: { name: 'Knight', say: 'Jumps in an L, two one way and one to the side, over anything.', leap: [[1, 2]] },
  bishop: { name: 'Bishop', say: 'Slides any distance diagonally.', slide: [[1, 1]] },
  rook: { name: 'Rook', say: 'Slides any distance up, down, left or right.', slide: [[1, 0]] },
  queen: { name: 'Queen', say: 'Slides any distance in a straight line or a diagonal.', slide: [[1, 0], [1, 1]] },
  king: { name: 'King', say: 'Steps one square in any direction.', leap: [[1, 0], [1, 1]] },
  // The fairy pieces: one of them each day. Real pieces from the history of
  // chess and of chess problems (docs/grove-pieces.md has their stories).
  camel: { name: 'Camel', say: 'A long knight. Jumps three one way and one to the side.', leap: [[1, 3]], fairy: true },
  zebra: { name: 'Zebra', say: 'Jumps three one way and two to the side.', leap: [[2, 3]], fairy: true },
  alfil: { name: 'Alfil', say: 'Jumps exactly two squares diagonally, over anything.', leap: [[2, 2]], fairy: true },
  dabbaba: { name: 'Dabbaba', say: 'Jumps exactly two squares straight, over anything.', leap: [[2, 0]], fairy: true },
  ferz: { name: 'Ferz', say: 'Steps one square diagonally.', leap: [[1, 1]], fairy: true },
  wazir: { name: 'Wazir', say: 'Steps one square up, down, left or right.', leap: [[1, 0]], fairy: true },
  nightrider: { name: 'Nightrider', say: 'A knight that keeps going. Makes the same L again and again in a line, until it lands on a piece.', slide: [[1, 2]], fairy: true },
  cannon: { name: 'Cannon', say: 'Along a straight line, jumps over exactly one piece to take the next piece beyond it.', hop: [[1, 0]], fairy: true },
  squirrel: { name: 'Squirrel', say: 'Jumps to any square exactly two away, straight, diagonal or in between.', leap: [[2, 0], [2, 1], [2, 2]], fairy: true },
  archbishop: { name: 'Archbishop', say: 'A bishop and a knight in one.', slide: [[1, 1]], leap: [[1, 2]], fairy: true },
  chancellor: { name: 'Chancellor', say: 'A rook and a knight in one.', slide: [[1, 0]], leap: [[1, 2]], fairy: true }
};

/** All the turns and mirrors of an offset, without repeats. */
function turns([a, b]) {
  const out = new Map();
  for (const [x, y] of [[a, b], [b, a]])
    for (const sx of [1, -1]) for (const sy of [1, -1]) out.set(`${x * sx},${y * sy}`, [x * sx, y * sy]);
  return [...out.values()];
}
const VEC = {};
for (const [k, p] of Object.entries(PIECES)) {
  VEC[k] = {
    leap: [...(p.leap || []).flatMap(turns), ...(p.only || [])],
    slide: (p.slide || []).flatMap(turns),
    hop: (p.hop || []).flatMap(turns)
  };
}

// --- Boards. ---------------------------------------------------------------
// Named shapes, so a day can say what it is played on. 'x' is a square, '.'
// a hole.

export const SHAPES = {
  meadow: { name: 'the meadow', rows: ['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'] },
  well: { name: 'the well', rows: ['xxxxxx', 'xxxxxx', 'xx..xx', 'xx..xx', 'xxxxxx', 'xxxxxx'] },
  pond: { name: 'the pond', rows: ['xxxxxxx', 'xxxxxxx', 'xx...xx', 'xx...xx', 'xx...xx', 'xxxxxxx', 'xxxxxxx'] },
  stone: { name: 'the round stone', rows: ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'] },
  crossroads: { name: 'the crossroads', rows: ['..xxx..', '..xxx..', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '..xxx..', '..xxx..'] },
  heart: { name: 'the heart', rows: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'] },
  mushroom: { name: 'the mushroom', rows: ['.xxxxx.', 'xxxxxxx', 'xxxxxxx', '..xxx..', '..xxx..', '..xxx..'] },
  rabbit: { name: 'the rabbit', rows: ['.x...x.', '.xx.xx.', '.xx.xx.', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.'] },
  stepping: { name: 'the stepping stones', rows: ['xxxxxx', 'x.xx.x', 'xxxxxx', 'xxxxxx', 'x.xx.x', 'xxxxxx'] },
  diamond: { name: 'the diamond', rows: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'] }
};

/** A board from a shape: its size and which cells are squares. */
export function boardOf(shape) {
  const rows = SHAPES[shape].rows, H = rows.length, W = rows[0].length;
  const on = new Uint8Array(W * H);
  rows.forEach((r, y) => [...r].forEach((c, x) => { on[y * W + x] = c === 'x' ? 1 : 0; }));
  return { shape, W, H, on };
}

// --- Moves. ----------------------------------------------------------------

/** The squares a `kind` on `sq` can take. `occ` says what stands where: -1
    for nothing, otherwise a piece's index. Every move is a capture, so only
    squares with a piece on them count. */
export function targets(b, occ, sq, kind) {
  const { W, H, on } = b, x0 = sq % W, y0 = (sq / W) | 0, v = VEC[kind], out = [];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x];
  for (const [dx, dy] of v.leap) {
    const x = x0 + dx, y = y0 + dy;
    if (inside(x, y) && occ[y * W + x] >= 0) out.push(y * W + x);
  }
  for (const [dx, dy] of v.slide) {
    for (let x = x0 + dx, y = y0 + dy; inside(x, y); x += dx, y += dy) {
      if (occ[y * W + x] >= 0) { out.push(y * W + x); break; }
    }
  }
  for (const [dx, dy] of v.hop) {
    let screen = false;
    for (let x = x0 + dx, y = y0 + dy; inside(x, y); x += dx, y += dy) {
      if (occ[y * W + x] < 0) continue;
      if (!screen) { screen = true; continue; }
      out.push(y * W + x);
      break;
    }
  }
  return out;
}

/** Every square a `kind` on `sq` moves through or onto: where its leaps
    land, and along each line the squares up to and including the first
    piece. Its move set, for drawing as rings, the way the Grove's other
    modes show every piece's reach (they stop at the first piece it could
    take). A cannon's line runs on over the piece it jumps, to the piece it
    would take. */
export function moveSet(b, occ, sq, kind) {
  const { W, H, on } = b, x0 = sq % W, y0 = (sq / W) | 0, v = VEC[kind], out = new Set();
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x];
  for (const [dx, dy] of v.leap) {
    const x = x0 + dx, y = y0 + dy;
    if (inside(x, y)) out.add(y * W + x);
  }
  for (const [dx, dy] of v.slide) {
    for (let x = x0 + dx, y = y0 + dy; inside(x, y); x += dx, y += dy) {
      out.add(y * W + x);
      if (occ[y * W + x] >= 0) break;
    }
  }
  for (const [dx, dy] of v.hop) {
    let screen = false;
    for (let x = x0 + dx, y = y0 + dy; inside(x, y); x += dx, y += dy) {
      if (occ[y * W + x] >= 0 && !screen) { screen = true; continue; }
      out.add(y * W + x);
      if (occ[y * W + x] >= 0) break;
    }
  }
  return [...out];
}

/** The squares a piece of `kind` on `sq` would move through or over on its
    way to `to`: for drawing its path. Leaps have none. */
export function pathOf(b, from, to, kind) {
  const { W } = b, fx = from % W, fy = (from / W) | 0, tx = to % W, ty = (to / W) | 0;
  const dx = tx - fx, dy = ty - fy, v = VEC[kind];
  if (v.leap.some(([a, c]) => a === dx && c === dy)) return [from, to];
  for (const [a, c] of [...v.slide, ...v.hop]) {
    const k = a ? dx / a : dy / c;
    if (k > 0 && Number.isInteger(k) && a * k === dx && c * k === dy) {
      const out = [];
      for (let i = 0; i <= k; i++) out.push((fy + c * i) * W + fx + a * i);
      return out;
    }
  }
  return [from, to];
}

// --- A level. ----------------------------------------------------------------
// { date, version, shape, W, H, on, start: { sq, kind }, pieces: [{ sq, kind }],
//   fairy, weekday }
// The piece you start as is not in `pieces`; the ones to take are.

/** What stands where, for a set of pieces still on the board (a bitmask over
    `pieces`). */
export function occupancy(level, mask) {
  const occ = new Int8Array(level.W * level.H).fill(-1);
  level.pieces.forEach((p, i) => { if (mask & (1 << i)) occ[p.sq] = i; });
  return occ;
}

/** Every route through a level, counted without walking them one by one.
    A state is where you stand (a piece's index, or N for the start) and
    which pieces are left; from there the routes only depend on that. For
    each state it works out:
      ways   how many complete routes there are (a route ends when there is
             nothing left to take),
      clear  how many of them take every piece,
      p      the chance that someone choosing at random clears it,
      left   how many pieces someone choosing at random leaves, on average,
      best   the fewest pieces that can be left.
    Thirteen pieces is at most 14 x 8192 states, so this is quick. */
export function solve(level) {
  const N = level.pieces.length, full = (1 << N) - 1;
  const memo = new Map();
  const kindAt = (i) => (i === N ? level.start.kind : level.pieces[i].kind);
  const sqAt = (i) => (i === N ? level.start.sq : level.pieces[i].sq);
  const occ = new Int8Array(level.W * level.H);
  const sqIndex = new Int8Array(level.W * level.H).fill(-1);
  level.pieces.forEach((p, i) => { sqIndex[p.sq] = i; });

  function next(i, mask) {
    occ.fill(-1);
    for (let j = 0; j < N; j++) if (mask & (1 << j)) occ[level.pieces[j].sq] = j;
    return targets(level, occ, sqAt(i), kindAt(i)).map((s) => sqIndex[s]);
  }
  function at(i, mask) {
    const key = mask * 16 + i;
    let r = memo.get(key);
    if (r) return r;
    const opts = next(i, mask);
    if (!opts.length) {
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      r = { ways: 1, clear: mask === 0 ? 1 : 0, p: mask === 0 ? 1 : 0, left: n, best: n };
    } else {
      r = { ways: 0, clear: 0, p: 0, left: 0, best: Infinity };
      for (const j of opts) {
        const s = at(j, mask & ~(1 << j));
        r.ways += s.ways; r.clear += s.clear;
        r.p += s.p / opts.length; r.left += s.left / opts.length;
        if (s.best < r.best) r.best = s.best;
      }
    }
    memo.set(key, r);
    return r;
  }
  const root = at(N, full);
  const first = next(N, full).length;
  return { ...root, first, states: memo.size, at, next };
}

/** One route that clears the board, as the squares taken in order, or null. */
export function aWayToClear(level, solved = solve(level)) {
  const N = level.pieces.length;
  let i = N, mask = (1 << N) - 1;
  if (!solved.clear) return null;
  const route = [];
  while (mask) {
    const j = solved.next(i, mask).find((j) => solved.at(j, mask & ~(1 << j)).clear > 0);
    route.push(level.pieces[j].sq);
    i = j; mask &= ~(1 << j);
  }
  return route;
}

// --- The dealer. --------------------------------------------------------------
// Version 1, from 2026-10-15. A dealt board never changes once it is out:
// anything that would deal a different board is a new version with a future
// start date, added to VERSIONS, and check.mjs proves the old boards hold.
//
// The week climbs like a newspaper crossword's: Monday is gentle and Sunday
// is hard. How hard is measured, not guessed: `p` from solve(), the chance
// that someone choosing at random clears the board. Everyone plays better
// than random, but random is a fair ruler for comparing boards.

export const VERSIONS = [{ from: '2026-10-15', v: 1 }];
export const FIRST_DAY = '2026-10-15';

const WEEK = [
  // Sunday first, as Date.getUTCDay() counts. `n` is how many pieces there
  // are to take; `p` is the band the random player's chance must land in;
  // `ways` is the fewest routes there must be, so a board is never small
  // enough to try every route in your head.
  { n: [12, 13], p: [0.002, 0.012], ways: 150, feel: 'the hardest' },
  { n: [7, 8], p: [0.12, 0.35], ways: 6, feel: 'gentle' },
  { n: [8, 9], p: [0.06, 0.18], ways: 12, feel: 'easy' },
  { n: [9, 10], p: [0.03, 0.1], ways: 25, feel: 'middling' },
  { n: [10, 11], p: [0.02, 0.06], ways: 40, feel: 'tricky' },
  { n: [10, 11], p: [0.01, 0.04], ways: 60, feel: 'hard' },
  { n: [11, 12], p: [0.005, 0.025], ways: 100, feel: 'harder' }
];

// The fairy pieces in the order the days bring them. Each appears once or
// twice on its day, and since a clear takes every piece, every clear uses it.
export const FAIRIES = ['camel', 'ferz', 'cannon', 'zebra', 'wazir', 'nightrider', 'alfil', 'archbishop', 'squirrel', 'dabbaba', 'chancellor'];
export const SHAPE_ORDER = ['meadow', 'heart', 'well', 'crossroads', 'stone', 'mushroom', 'pond', 'rabbit', 'stepping', 'diamond'];
// How often each classic piece turns up among the rest. Queens are rare: a
// queen is a gift, since she can reach so much.
const CLASSIC = [['knight', 5], ['bishop', 4], ['rook', 4], ['pawn', 3], ['king', 3], ['queen', 1]];
const STARTS = ['knight', 'rook', 'bishop', 'queen', 'king'];

/** Days since the first day (0 on 2026-10-15), from a YYYY-MM-DD date. */
export function dayNumber(date) {
  const t = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.round((t(date) - t(FIRST_DAY)) / 86400000);
}
export const versionFor = (date) => VERSIONS.filter((x) => date >= x.from).pop()?.v ?? 1;
export const weekdayOf = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** How hard the day's board is meant to be, in a word. */
export const feelOf = (date) => WEEK[weekdayOf(date)].feel;
const cycle = (list, i) => list[((i % list.length) + list.length) % list.length];

function pick(rand, weighted) {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of weighted) { if ((r -= w) < 0) return k; }
  return weighted[weighted.length - 1][0];
}

/** The squares a `kind` on `sq` could take on an otherwise empty board, if
    a piece stood there: for laying out a route before the rest is placed.
    A cannon needs something to jump, so it gets the straight lines from two
    squares out, and the full check afterwards weeds out the ones that fail. */
function reach(b, sq, kind, used) {
  const out = [], occ = new Int8Array(b.W * b.H).fill(-1);
  const x0 = sq % b.W, y0 = (sq / b.W) | 0;
  for (let s = 0; s < b.on.length; s++) {
    if (!b.on[s] || used.has(s)) continue;
    if (kind === 'cannon') {
      const x = s % b.W, y = (s / b.W) | 0;
      if ((x === x0 && Math.abs(y - y0) >= 2) || (y === y0 && Math.abs(x - x0) >= 2)) out.push(s);
      continue;
    }
    occ[s] = 0;
    if (targets(b, occ, sq, kind).includes(s)) out.push(s);
    occ[s] = -1;
  }
  return out;
}

/** One candidate board: walk a route from the start, dropping a piece on a
    square the current piece could reach, and becoming it, n times. The
    pieces still to come are not there yet while the route is laid, so a
    later piece can end up in the way of an earlier slide; solve() checks
    the finished board, and it is only kept if some route clears it. */
function candidate(rand, board, squares, n, fairy) {
  const start = { sq: squares[Math.floor(rand() * squares.length)], kind: STARTS[Math.floor(rand() * STARTS.length)] };
  const fairyAt = new Set([1 + Math.floor(rand() * (n - 2))]);
  if (rand() < 0.3) fairyAt.add(1 + Math.floor(rand() * (n - 1)));
  const used = new Set([start.sq]), pieces = [];
  let cur = start;
  for (let t = 0; t < n; t++) {
    const opts = reach(board, cur.sq, cur.kind, used);
    if (!opts.length) return null;
    const sq = opts[Math.floor(rand() * opts.length)];
    const kind = fairyAt.has(t) ? fairy : pick(rand, CLASSIC);
    pieces.push({ sq, kind });
    used.add(sq);
    cur = { sq, kind };
  }
  pieces.sort((a, b) => a.sq - b.sq);
  return { start, pieces };
}

/** Today's board, the same on every phone. Candidates are tried one after
    another from a generator seeded by the date, and the first that fits the
    day is kept, so the same date always gives the same board. */
export function deal(date) {
  const weekday = weekdayOf(date), day = dayNumber(date), want = WEEK[weekday];
  const fairy = cycle(FAIRIES, day), shape = cycle(SHAPE_ORDER, day);
  const board = boardOf(shape);
  const rand = rng(`changeling-v1:${date}`);
  const squares = [];
  for (let s = 0; s < board.on.length; s++) if (board.on[s]) squares.push(s);

  let fallback = null;
  for (let tries = 0; tries < 4000; tries++) {
    // After a while, widen what counts as fitting, so a day always deals.
    const slack = tries < 1500 ? 1 : tries < 3000 ? 2 : 4;
    const n = want.n[0] + Math.floor(rand() * (want.n[1] - want.n[0] + 1));
    const c = candidate(rand, board, squares, n, fairy);
    if (!c) continue;
    const level = { date, version: 1, shape, W: board.W, H: board.H, on: board.on, ...c, fairy, weekday };
    const s = solve(level);
    if (!s.clear || s.first < 2 || !fairyMoves(level, s)) continue;
    if (s.p >= want.p[0] / slack && s.p <= Math.min(0.5, want.p[1] * slack) && s.ways * slack >= want.ways) return { ...level, tries };
    if (!fallback) fallback = { ...level, tries };
  }
  return fallback;
}

/** Whether some clear takes the fairy before the last piece, so you get to
    move as it at least once. */
function fairyMoves(level, s) {
  const N = level.pieces.length;
  const seen = new Set();
  function walk(i, mask) {
    const key = mask * 16 + i;
    if (seen.has(key)) return false;
    seen.add(key);
    for (const j of s.next(i, mask)) {
      const rest = mask & ~(1 << j);
      if (s.at(j, rest).clear === 0) continue;
      if (level.pieces[j].kind === level.fairy && rest) return true;
      if (walk(j, rest)) return true;
    }
    return false;
  }
  return walk(N, (1 << N) - 1);
}

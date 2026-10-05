// The rules of grove chess. Nothing in here touches the page, so the same code
// runs the game, the solver that sets par, the replays of other people's
// games, and the tests.
//
// Coordinates: x runs left to right, y runs bottom to top, and (0, 0) is the
// bottom-left square, on your side of the board.

const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL8 = [...ORTH, ...DIAG];
// The eight knight jumps, in order around the circle. The rose depends on the
// order; everything else does not care.
const KNIGHT = [[2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]];

/** Every orientation of an (a, b) jump: (±a, ±b) and (±b, ±a). */
function sym(a, b) {
  const out = new Map();
  for (const [p, q] of [[a, b], [b, a]])
    for (const sx of [1, -1]) for (const sy of [1, -1]) out.set(`${p * sx},${q * sy}`, [p * sx, q * sy]);
  return [...out.values()];
}

// What a square holds, from the point of view of something moving into it.
export const OFF = 0, EMPTY = 1, PIECE = 2, RABBIT = 3, STUMP = 4, BRAMBLE = 5, HIDDEN = 6;

export function brambleCount(day, t) {
  if (!day.bramble.length) return 0;
  return Math.min(day.bramble.length, 1 + Math.floor(t / day.every));
}

export function isBramble(s, x, y) {
  const k = s.day.brambleAt.get(y * s.day.N + x);
  return k !== undefined && k < brambleCount(s.day, s.t);
}

export function look(s, x, y) {
  const N = s.day.N;
  if (x < 0 || y < 0 || x >= N || y >= N) return OFF;
  for (const p of s.pieces) if (!p.taken && p.x === x && p.y === y) return PIECE;
  const bram = isBramble(s, x, y);
  if (!s.caught && s.rabbit.x === x && s.rabbit.y === y) return bram ? HIDDEN : RABBIT;
  if (s.day.stumps.has(y * N + x)) return STUMP;
  return bram ? BRAMBLE : EMPTY;
}

// --- How things move. Each returns a list of { x, y, cap }. ---------------

function leap(s, p, vecs, out = []) {
  for (const [dx, dy] of vecs) {
    const c = look(s, p.x + dx, p.y + dy);
    if (c === EMPTY || c === RABBIT) out.push({ x: p.x + dx, y: p.y + dy, cap: c === RABBIT });
  }
  return out;
}

function ride(s, p, vecs, out = []) {
  for (const [dx, dy] of vecs) {
    let x = p.x + dx, y = p.y + dy;
    for (;;) {
      const c = look(s, x, y);
      if (c === EMPTY) out.push({ x, y, cap: false });
      else { if (c === RABBIT) out.push({ x, y, cap: true }); break; }
      x += dx; y += dy;
    }
  }
  return out;
}

function grasshopper(s, p) {
  const out = [];
  for (const [dx, dy] of ALL8) {
    let x = p.x + dx, y = p.y + dy;
    while (look(s, x, y) === EMPTY) { x += dx; y += dy; }
    if (look(s, x, y) === OFF) continue; // nothing to hop over
    const c = look(s, x + dx, y + dy);
    if (c === EMPTY || c === RABBIT) out.push({ x: x + dx, y: y + dy, cap: c === RABBIT });
  }
  return out;
}

function cannon(s, p) {
  const out = [];
  for (const [dx, dy] of ORTH) {
    let x = p.x + dx, y = p.y + dy;
    while (look(s, x, y) === EMPTY) { out.push({ x, y, cap: false }); x += dx; y += dy; }
    if (look(s, x, y) === OFF) continue;
    x += dx; y += dy; // over the screen
    while (look(s, x, y) === EMPTY) { x += dx; y += dy; }
    if (look(s, x, y) === RABBIT) out.push({ x, y, cap: true });
  }
  return out;
}

function mao(s, p) {
  const out = [];
  for (const [dx, dy] of ORTH) {
    if (look(s, p.x + dx, p.y + dy) !== EMPTY) continue; // the leg is blocked
    const side = dx ? [[2 * dx, 1], [2 * dx, -1]] : [[1, 2 * dy], [-1, 2 * dy]];
    leap(s, p, side, out);
  }
  return out;
}

function pawn(s, p) {
  const out = [];
  if (look(s, p.x, p.y + 1) === EMPTY) out.push({ x: p.x, y: p.y + 1, cap: false });
  for (const dx of [-1, 1]) if (look(s, p.x + dx, p.y + 1) === RABBIT) out.push({ x: p.x + dx, y: p.y + 1, cap: true });
  return out;
}

function rose(s, p) {
  const seen = new Map();
  for (let k = 0; k < 8; k++)
    for (const dir of [1, -1]) {
      let x = p.x, y = p.y;
      for (let step = 0; step < 7; step++) {
        const [dx, dy] = KNIGHT[(k + dir * step + 16) % 8];
        x += dx; y += dy;
        const c = look(s, x, y);
        if (c !== EMPTY && c !== RABBIT) break;
        seen.set(`${x},${y}`, { x, y, cap: c === RABBIT });
        if (c === RABBIT) break;
      }
    }
  return [...seen.values()];
}

/**
 * The pieces. `tier` is only used when dealing the day's hand: at most one
 * strong piece, so the day stays a puzzle.
 */
export const PIECES = {
  king: { name: 'King', kind: 'classic', tier: 1,
    desc: 'Steps one square in any direction.',
    moves: (s, p) => leap(s, p, ALL8) },
  queen: { name: 'Queen', kind: 'classic', tier: 2,
    desc: 'Slides any distance in a straight line or a diagonal.',
    moves: (s, p) => ride(s, p, ALL8) },
  rook: { name: 'Rook', kind: 'classic', tier: 1,
    desc: 'Slides any distance up, down, left or right.',
    moves: (s, p) => ride(s, p, ORTH) },
  bishop: { name: 'Bishop', kind: 'classic', tier: 1,
    desc: 'Slides any distance diagonally.',
    moves: (s, p) => ride(s, p, DIAG) },
  knight: { name: 'Knight', kind: 'classic', tier: 1,
    desc: 'Jumps in an L, two one way and one to the side, over anything.',
    moves: (s, p) => leap(s, p, KNIGHT) },
  pawn: { name: 'Pawn', kind: 'classic', tier: 0,
    desc: 'Steps one square forward. Can only catch diagonally forward.',
    moves: pawn },

  grasshopper: { name: 'Grasshopper', kind: 'fairy', tier: 1,
    desc: 'Travels along any line but must hop over the first thing in its way, landing just beyond it. No hurdle, no move.',
    origin: 'Invented by T. R. Dawson, 1912.',
    moves: grasshopper },
  nightrider: { name: 'Nightrider', kind: 'fairy', tier: 2,
    desc: 'A knight that keeps going: repeats the same L jump in a straight line until something stops it.',
    origin: 'T. R. Dawson, 1925.',
    moves: (s, p) => ride(s, p, KNIGHT) },
  camel: { name: 'Camel', kind: 'fairy', tier: 1,
    desc: 'A long knight: leaps three one way and one to the side, over anything.',
    origin: 'From Tamerlane chess.',
    moves: (s, p) => leap(s, p, sym(3, 1)) },
  zebra: { name: 'Zebra', kind: 'fairy', tier: 0,
    desc: 'Leaps three one way and two to the side, over anything.',
    moves: (s, p) => leap(s, p, sym(3, 2)) },
  alfil: { name: 'Alfil', kind: 'fairy', tier: 0,
    desc: 'Leaps exactly two squares diagonally, over anything.',
    origin: '"The elephant" of shatranj, the medieval ancestor of the bishop.',
    moves: (s, p) => leap(s, p, sym(2, 2)) },
  ferz: { name: 'Ferz', kind: 'fairy', tier: 0,
    desc: 'Steps one square diagonally.',
    origin: 'The counsellor of shatranj, the ancestor of the queen.',
    moves: (s, p) => leap(s, p, DIAG) },
  wazir: { name: 'Wazir', kind: 'fairy', tier: 0,
    desc: 'Steps one square up, down, left or right.',
    origin: 'Named for the vizier.',
    moves: (s, p) => leap(s, p, ORTH) },
  cannon: { name: 'Cannon', kind: 'fairy', tier: 1,
    desc: 'Slides like a rook, but can only catch by jumping exactly one thing on the way.',
    origin: 'From xiangqi, Chinese chess.',
    moves: cannon },
  mao: { name: 'Mao', kind: 'fairy', tier: 0,
    desc: 'Moves like a knight, but one straight step first. Anything on that first square blocks it.',
    origin: 'The horse of xiangqi.',
    moves: mao },
  squirrel: { name: 'Squirrel', kind: 'fairy', tier: 1,
    desc: 'Leaps to any square exactly two away, over anything.',
    moves: (s, p) => leap(s, p, [...sym(2, 0), ...sym(2, 1), ...sym(2, 2)]) },
  rose: { name: 'Rose', kind: 'fairy', tier: 1,
    desc: 'Makes knight jumps that curve, each one turning further, tracing a circle. Stops at anything in its path.',
    moves: rose },
  archbishop: { name: 'Archbishop', kind: 'fairy', tier: 2,
    desc: 'A bishop that can also jump like a knight.',
    origin: 'From Capablanca chess, 1920s.',
    moves: (s, p) => leap(s, p, KNIGHT, ride(s, p, DIAG)) }
};

export const RABBIT_DESC = 'Hops in a fixed pattern that repeats. If it lands on one of your pieces, it eats it. It bounces off the edges, and if a stump or bramble is in the way it waits a turn. Watch its tracks.';
export const BRAMBLE_DESC = 'Creeps one square every two moves. Nothing can enter it and nothing slides through it. A rabbit caught inside is safe until it hops out.';
export const STUMP_DESC = 'In the way. Sliders stop at it; leapers jump over it.';

// --- State. ----------------------------------------------------------------

export function initialState(day) {
  return {
    day,
    t: 0, // moves you have made
    pieces: day.pieces.map((p) => ({ ...p })),
    rabbit: { ...day.rabbit, i: 0 },
    caught: false
  };
}

export function movesFor(s, i) {
  if (s.caught || s.pieces[i].taken) return [];
  return PIECES[s.pieces[i].type].moves(s, s.pieces[i]);
}

/** Every move available, including waiting. p = -1 means wait. */
export function allMoves(s) {
  const out = [{ p: -1, x: 0, y: 0, cap: false }];
  s.pieces.forEach((_, i) => { for (const m of movesFor(s, i)) out.push({ p: i, ...m }); });
  return out;
}

export function isLegal(s, mv) {
  if (mv.p === -1) return !s.caught;
  if (mv.p < 0 || mv.p >= s.pieces.length || s.pieces[mv.p].taken) return false;
  return movesFor(s, mv.p).some((m) => m.x === mv.x && m.y === mv.y);
}

/** The rabbit's turn. Mutates `s`. Landing on one of your pieces eats it;
    a stump, bramble or the edge of the board stops it, and it waits. */
function rabbitHop(s) {
  const r = s.rabbit, pat = s.day.pattern, N = s.day.N;
  let [dx, dy] = pat[r.i];
  dx *= r.mx; dy *= r.my;
  // Bouncing flips the whole pattern on that axis from here on, the way a
  // ball's direction stays flipped after it hits a wall.
  if (r.x + dx < 0 || r.x + dx >= N) { r.mx = -r.mx; dx = -dx; }
  if (r.y + dy < 0 || r.y + dy >= N) { r.my = -r.my; dy = -dy; }
  r.i = (r.i + 1) % pat.length;
  r.from = [r.x, r.y];
  r.ate = -1;
  const tx = r.x + dx, ty = r.y + dy, c = look(s, tx, ty);
  if (c === PIECE && !isBramble(s, tx, ty)) {
    r.ate = s.pieces.findIndex((p) => !p.taken && p.x === tx && p.y === ty);
    s.pieces[r.ate].taken = true;
  }
  if (c === EMPTY || r.ate >= 0) { r.x = tx; r.y = ty; r.blocked = false; }
  else r.blocked = true;
}

/** Your move, then the rabbit's. Returns a new state. */
export function apply(s, mv) {
  const n = { day: s.day, t: s.t, pieces: s.pieces.map((p) => ({ ...p })), rabbit: { ...s.rabbit }, caught: false };
  if (mv.p >= 0) {
    const p = n.pieces[mv.p];
    p.x = mv.x; p.y = mv.y;
    if (s.rabbit.x === mv.x && s.rabbit.y === mv.y) {
      n.caught = true; n.t++;
      return n;
    }
  }
  rabbitHop(n);
  n.t++;
  return n;
}

export const MAX_MOVES = 15;

export const allTaken = (s) => s.pieces.every((p) => p.taken);

export function isOver(s) { return s.caught || s.t >= MAX_MOVES || allTaken(s); }

/** How a finished game ended: 'caught', 'eaten' (it ate everything) or 'dusk'. */
export function outcome(s) { return s.caught ? 'caught' : allTaken(s) ? 'eaten' : 'dusk'; }

/** Replay a list of moves from the start. Stops at the first illegal one. */
export function replay(day, moves) {
  const states = [initialState(day)];
  for (const mv of moves) {
    const s = states[states.length - 1];
    if (isOver(s) || !isLegal(s, mv)) return { states, ok: false };
    states.push(apply(s, mv));
  }
  return { states, ok: true };
}

export function stateKey(s) {
  let k = '';
  for (const p of s.pieces) k += p.taken ? '--' : p.x + '' + p.y;
  const r = s.rabbit;
  return k + '|' + r.x + r.y + ',' + r.i + (r.mx > 0 ? '+' : '-') + (r.my > 0 ? '+' : '-');
}

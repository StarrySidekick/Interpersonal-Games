// The rules of grove chess. Nothing in here touches the page, so the same code
// runs the game, the solver that sets par, replays of other people's games,
// the lab, and the tests.
//
// A level ("day" in the code, since the daily board came first) is a board
// plus two sides: your pieces, and theirs ("foes"). The daily board is one
// level among many: a square board, one rabbit that hops in a pattern, catch
// it within 15 moves. The lab can make almost anything else.
//
// Coordinates: x runs left to right, y runs bottom to top, and (0, 0) is the
// bottom-left square, on your side of the board. A square's number is
// y * W + x.

import { think } from './ai.js';

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

// What a square holds, from the point of view of the side moving into it.
// OWN is one of your own side; ENEMY is something you could take; HIDDEN is
// an enemy sheltering in the bramble, which nothing can take.
// HOLE is the moving hole of a ball level: only the ball may enter it.
export const OFF = 0, EMPTY = 1, OWN = 2, ENEMY = 3, STUMP = 4, BRAMBLE = 5, HIDDEN = 6, HOLE = 7;

export function brambleCount(day, t) {
  if (!day.bramble.length) return 0;
  return Math.min(day.bramble.length, 1 + Math.floor(t / day.every));
}

export function isBramble(s, x, y) {
  const k = s.day.brambleAt.get(y * s.day.W + x);
  return k !== undefined && k < brambleCount(s.day, s.t);
}

export const onBoard = (day, x, y) => x >= 0 && y >= 0 && x < day.W && y < day.H && !day.holes.has(y * day.W + x);

/** What is on (x, y), as seen by `side` ('you' or 'foe'). */
export function look(s, x, y, side = 'you') {
  if (!onBoard(s.day, x, y)) return OFF;
  const bram = isBramble(s, x, y);
  for (const p of s.pieces)
    if (!p.taken && p.x === x && p.y === y) return side === 'you' ? OWN : bram ? HIDDEN : ENEMY;
  for (const f of s.foes)
    if (!f.taken && f.x === x && f.y === y) return side === 'foe' ? OWN : bram ? HIDDEN : ENEMY;
  if (s.hole && s.hole.x === x && s.hole.y === y) return HOLE;
  if (s.day.stumps.has(y * s.day.W + x)) return STUMP;
  return bram ? BRAMBLE : EMPTY;
}

// --- How things move. Each returns a list of { x, y, cap }. ---------------
// `L(x, y)` is look() from the moving side; `fwd` is +1 for you and -1 for
// them, which only pawns care about.

function leap(L, p, vecs, out = []) {
  for (const [dx, dy] of vecs) {
    const c = L(p.x + dx, p.y + dy);
    if (c === EMPTY || c === ENEMY) out.push({ x: p.x + dx, y: p.y + dy, cap: c === ENEMY });
  }
  return out;
}

function ride(L, p, vecs, out = []) {
  for (const [dx, dy] of vecs) {
    let x = p.x + dx, y = p.y + dy;
    for (;;) {
      const c = L(x, y);
      if (c === EMPTY) out.push({ x, y, cap: false });
      else { if (c === ENEMY) out.push({ x, y, cap: true }); break; }
      x += dx; y += dy;
    }
  }
  return out;
}

function grasshopper(L, p) {
  const out = [];
  for (const [dx, dy] of ALL8) {
    let x = p.x + dx, y = p.y + dy;
    while (L(x, y) === EMPTY) { x += dx; y += dy; }
    if (L(x, y) === OFF) continue; // nothing to hop over
    const c = L(x + dx, y + dy);
    if (c === EMPTY || c === ENEMY) out.push({ x: x + dx, y: y + dy, cap: c === ENEMY });
  }
  return out;
}

function cannon(L, p) {
  const out = [];
  for (const [dx, dy] of ORTH) {
    let x = p.x + dx, y = p.y + dy;
    while (L(x, y) === EMPTY) { out.push({ x, y, cap: false }); x += dx; y += dy; }
    if (L(x, y) === OFF) continue;
    x += dx; y += dy; // over the screen
    while (L(x, y) === EMPTY) { x += dx; y += dy; }
    if (L(x, y) === ENEMY) out.push({ x, y, cap: true });
  }
  return out;
}

function mao(L, p) {
  const out = [];
  for (const [dx, dy] of ORTH) {
    if (L(p.x + dx, p.y + dy) !== EMPTY) continue; // the leg is blocked
    const side = dx ? [[2 * dx, 1], [2 * dx, -1]] : [[1, 2 * dy], [-1, 2 * dy]];
    leap(L, p, side, out);
  }
  return out;
}

/** The ball rolls up, down, left or right and keeps rolling until something
    stops it, like a puzzle on ice. It never takes anything. It drops into the
    hole if it rolls over it, or, when the level says so, only if it comes to
    rest on it. */
function ball(L, p, fwd, day) {
  const out = [], dropsIn = !day?.rules?.ballStops;
  for (const [dx, dy] of ORTH) {
    let x = p.x, y = p.y, onHole = false;
    for (;;) {
      const c = L(x + dx, y + dy);
      if (c !== EMPTY && c !== HOLE) break;
      x += dx; y += dy; onHole = c === HOLE;
      if (onHole && dropsIn) break;
    }
    if (x !== p.x || y !== p.y) out.push({ x, y, cap: false, sink: onHole });
  }
  return out;
}

function pawn(L, p, fwd) {
  const out = [];
  if (L(p.x, p.y + fwd) === EMPTY) out.push({ x: p.x, y: p.y + fwd, cap: false });
  for (const dx of [-1, 1]) if (L(p.x + dx, p.y + fwd) === ENEMY) out.push({ x: p.x + dx, y: p.y + fwd, cap: true });
  return out;
}

function rose(L, p) {
  const seen = new Map();
  for (let k = 0; k < 8; k++)
    for (const dir of [1, -1]) {
      let x = p.x, y = p.y;
      for (let step = 0; step < 7; step++) {
        const [dx, dy] = KNIGHT[(k + dir * step + 16) % 8];
        x += dx; y += dy;
        const c = L(x, y);
        if (c !== EMPTY && c !== ENEMY) break;
        seen.set(`${x},${y}`, { x, y, cap: c === ENEMY });
        if (c === ENEMY) break;
      }
    }
  return [...seen.values()];
}

/**
 * The pieces. `tier` is used when dealing a hand (at most one strong piece);
 * `value` is what the AI thinks a piece is worth.
 */
export const PIECES = {
  king: { name: 'King', kind: 'classic', tier: 1, value: 3,
    desc: 'Steps one square in any direction.',
    moves: (L, p) => leap(L, p, ALL8) },
  queen: { name: 'Queen', kind: 'classic', tier: 2, value: 9,
    desc: 'Slides any distance in a straight line or a diagonal.',
    moves: (L, p) => ride(L, p, ALL8) },
  rook: { name: 'Rook', kind: 'classic', tier: 1, value: 5,
    desc: 'Slides any distance up, down, left or right.',
    moves: (L, p) => ride(L, p, ORTH) },
  bishop: { name: 'Bishop', kind: 'classic', tier: 1, value: 3,
    desc: 'Slides any distance diagonally.',
    moves: (L, p) => ride(L, p, DIAG) },
  knight: { name: 'Knight', kind: 'classic', tier: 1, value: 3,
    desc: 'Jumps in an L, two one way and one to the side, over anything.',
    moves: (L, p) => leap(L, p, KNIGHT) },
  pawn: { name: 'Pawn', kind: 'classic', tier: 0, value: 1,
    desc: 'Steps one square forward. Can only catch diagonally forward.',
    moves: pawn },

  grasshopper: { name: 'Grasshopper', kind: 'fairy', tier: 1, value: 2.5,
    desc: 'Travels along any line but must hop over the first thing in its way, landing just beyond it. No hurdle, no move.',
    origin: 'Invented by T. R. Dawson, 1912.',
    moves: grasshopper },
  nightrider: { name: 'Nightrider', kind: 'fairy', tier: 2, value: 6,
    desc: 'A knight that keeps going: repeats the same L jump in a straight line until something stops it.',
    origin: 'T. R. Dawson, 1925.',
    moves: (L, p) => ride(L, p, KNIGHT) },
  camel: { name: 'Camel', kind: 'fairy', tier: 1, value: 3,
    desc: 'A long knight: leaps three one way and one to the side, over anything.',
    origin: 'From Tamerlane chess.',
    moves: (L, p) => leap(L, p, sym(3, 1)) },
  zebra: { name: 'Zebra', kind: 'fairy', tier: 0, value: 2,
    desc: 'Leaps three one way and two to the side, over anything.',
    moves: (L, p) => leap(L, p, sym(3, 2)) },
  alfil: { name: 'Alfil', kind: 'fairy', tier: 0, value: 1.5,
    desc: 'Leaps exactly two squares diagonally, over anything.',
    origin: '"The elephant" of shatranj, the medieval ancestor of the bishop.',
    moves: (L, p) => leap(L, p, sym(2, 2)) },
  ferz: { name: 'Ferz', kind: 'fairy', tier: 0, value: 1.5,
    desc: 'Steps one square diagonally.',
    origin: 'The counsellor of shatranj, the ancestor of the queen.',
    moves: (L, p) => leap(L, p, DIAG) },
  wazir: { name: 'Wazir', kind: 'fairy', tier: 0, value: 1.5,
    desc: 'Steps one square up, down, left or right.',
    origin: 'Named for the vizier.',
    moves: (L, p) => leap(L, p, ORTH) },
  cannon: { name: 'Cannon', kind: 'fairy', tier: 1, value: 4,
    desc: 'Slides like a rook, but can only catch by jumping exactly one thing on the way.',
    origin: 'From xiangqi, Chinese chess.',
    moves: cannon },
  mao: { name: 'Mao', kind: 'fairy', tier: 0, value: 2.5,
    desc: 'Moves like a knight, but one straight step first. Anything on that first square blocks it.',
    origin: 'The horse of xiangqi.',
    moves: mao },
  squirrel: { name: 'Squirrel', kind: 'fairy', tier: 1, value: 4,
    desc: 'Leaps to any square exactly two away, over anything.',
    moves: (L, p) => leap(L, p, [...sym(2, 0), ...sym(2, 1), ...sym(2, 2)]) },
  rose: { name: 'Rose', kind: 'fairy', tier: 1, value: 4.5,
    desc: 'Makes knight jumps that curve, each one turning further, tracing a circle. Stops at anything in its path.',
    moves: rose },
  archbishop: { name: 'Archbishop', kind: 'fairy', tier: 2, value: 7,
    desc: 'A bishop that can also jump like a knight.',
    origin: 'From Capablanca chess, 1920s.',
    moves: (L, p) => leap(L, p, KNIGHT, ride(L, p, DIAG)) },

  // Only ever on their side. When it thinks (the AI brain) it moves like a
  // king; when it follows a pattern, the pattern decides.
  // Only ever yours, and only on ball-and-hole levels.
  ball: { name: 'Ball', kind: 'special', tier: 0, value: 2,
    desc: 'Rolls up, down, left or right until something stops it. Your other pieces make good walls. Get it into the hole to win.',
    moves: ball },

  rabbit: { name: 'Rabbit', kind: 'quarry', tier: 1, value: 3,
    desc: 'Steps one square in any direction.',
    moves: (L, p) => leap(L, p, ALL8) }
};

export const RABBIT_DESC = 'Hops in a fixed pattern that repeats. If it lands on one of your pieces, it eats it. It bounces off the edges, and if a stump or bramble is in the way it waits a turn. Watch its tracks.';
export const RABBIT_AI_DESC = 'Thinks for itself and steps one square in any direction, like a king. It eats what it lands on.';
export const BRAMBLE_DESC = 'Creeps across the board. Nothing can enter it and nothing slides through it. Anything caught inside is safe until it leaves.';
export const STUMP_DESC = 'In the way. Sliders stop at it; leapers jump over it.';
export const HOLE_DESC = 'The hole. It moves by its own hidden pattern after every turn, bounces off the edges, and waits if anything is in the way. Nothing but the ball can go in it.';

// --- Level rules. ----------------------------------------------------------

/** The daily board's rules. A lab level can set any of these. */
export const DAILY_RULES = {
  goal: 'target',    // 'target': catch every marked foe; 'all': catch them all; 'any': catch one
  maxMoves: 15,      // 0 means no limit
  wait: true,        // may you spend a move standing still?
  foesCapture: true, // can they take your pieces?
  royal: false,      // does losing a King lose the game?
  first: 'you'       // who moves first
};

export const MAX_MOVES = DAILY_RULES.maxMoves;

// --- State. ----------------------------------------------------------------

export function initialState(day) {
  const s = {
    day,
    t: 0, // moves you have made
    pieces: day.pieces.map((p) => ({ ...p, taken: false })),
    foes: day.foes.map((f) => ({ ...f, i: 0, taken: false })),
    hole: day.hole ? { ...day.hole, i: 0 } : null,
    won: false
  };
  if (day.rules.first === 'them') { foesAct(s); s.opened = true; }
  return s;
}

export function clone(s) {
  return { day: s.day, t: s.t, pieces: s.pieces.map((p) => ({ ...p })), foes: s.foes.map((f) => ({ ...f })),
    hole: s.hole ? { ...s.hole } : null, won: s.won, sunk: s.sunk };
}

const youLook = (s) => (x, y) => look(s, x, y, 'you');
const foeLook = (s) => (x, y) => look(s, x, y, 'foe');

export function movesFor(s, i) {
  const p = s.pieces[i];
  if (s.won || p.taken) return [];
  return PIECES[p.type].moves(youLook(s), p, 1, s.day);
}

/** Where a thinking foe can go. */
export function foeMovesFor(s, k) {
  const f = s.foes[k];
  if (f.taken || f.brain !== 'ai') return [];
  const ms = PIECES[f.type].moves(foeLook(s), f, -1, s.day);
  return s.day.rules.foesCapture ? ms : ms.filter((m) => !m.cap);
}

/** Every move available to you, waiting first if waiting is allowed. With
    no move at all you must pass, whatever the rules say about waiting. */
export function allMoves(s) {
  const out = [];
  s.pieces.forEach((_, i) => { for (const m of movesFor(s, i)) out.push({ p: i, ...m }); });
  return s.day.rules.wait || !out.length ? [{ p: -1, x: 0, y: 0, cap: false }, ...out] : out;
}

const canMove = (s) => s.pieces.some((_, i) => movesFor(s, i).length);

export function isLegal(s, mv) {
  if (mv.p === -1) return !s.won && (s.day.rules.wait || !canMove(s));
  if (mv.p < 0 || mv.p >= s.pieces.length || s.pieces[mv.p].taken) return false;
  return movesFor(s, mv.p).some((m) => m.x === mv.x && m.y === mv.y);
}

function goalMet(s) {
  const g = s.day.rules.goal, F = s.foes;
  if (g === 'hole') return false; // only the ball in the hole wins
  if (g === 'any') return F.some((f) => f.taken);
  if (g === 'target' && F.some((f) => f.target)) return F.every((f) => !f.target || f.taken);
  return F.every((f) => f.taken);
}

export const allTaken = (s) => s.pieces.every((p) => p.taken);
export function lost(s) {
  return allTaken(s) || (s.day.rules.royal && s.pieces.some((p) => p.taken && p.type === 'king')) ||
    (s.day.rules.goal === 'hole' && s.pieces.some((p) => p.taken && p.type === 'ball'));
}

// --- Their turn. -----------------------------------------------------------

/** A foe lands on (x, y), taking whatever of yours is there. Mutates. */
function landFoe(s, f, x, y) {
  f.ate = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (f.ate >= 0) s.pieces[f.ate].taken = true;
  f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false;
}

/** A pattern foe's hop. Mutates `s`. Landing on one of your pieces eats it
    (if they may capture); a stump, bramble, another of theirs or a missing
    square stops it, and it waits. */
function hop(s, f) {
  const pat = f.pattern, W = s.day.W, H = s.day.H;
  let [dx, dy] = pat[f.i];
  dx *= f.mx; dy *= f.my;
  // Bouncing flips the whole pattern on that axis from here on, the way a
  // ball's direction stays flipped after it hits a wall.
  if (f.x + dx < 0 || f.x + dx >= W) { f.mx = -f.mx; dx = -dx; }
  if (f.y + dy < 0 || f.y + dy >= H) { f.my = -f.my; dy = -dy; }
  f.i = (f.i + 1) % pat.length;
  const tx = f.x + dx, ty = f.y + dy, c = look(s, tx, ty, 'foe');
  if (c === EMPTY || (c === ENEMY && s.day.rules.foesCapture)) landFoe(s, f, tx, ty);
  else { f.from = [f.x, f.y]; f.ate = -1; f.blocked = true; }
}

/** One move by a thinking foe: { k, x, y }. Mutates. */
export function foeMove(s, m) {
  if (m) landFoe(s, s.foes[m.k], m.x, m.y);
}

/** The pattern foes all hop. Mutates. */
export function patternHops(s) {
  for (const f of s.foes) {
    if (f.taken || f.brain !== 'pattern') continue;
    for (let h = 0; h < (f.hops || 1) && !lost(s); h++) hop(s, f);
  }
}

/** The hole's hop: its pattern, bouncing off the edges like a rabbit, and
    waiting if anything at all is in the way. Mutates. */
function holeHop(s) {
  const h = s.hole, pat = h.pattern, W = s.day.W, H = s.day.H;
  let [dx, dy] = pat[h.i];
  dx *= h.mx; dy *= h.my;
  if (h.x + dx < 0 || h.x + dx >= W) { h.mx = -h.mx; dx = -dx; }
  if (h.y + dy < 0 || h.y + dy >= H) { h.my = -h.my; dy = -dy; }
  h.i = (h.i + 1) % pat.length;
  h.from = [h.x, h.y];
  if (look(s, h.x + dx, h.y + dy) === EMPTY) { h.x += dx; h.y += dy; h.blocked = false; }
  else h.blocked = true;
}

/** Their whole turn: the thinkers choose one move between them, then every
    pattern foe hops, then the hole moves. Mutates. */
function foesAct(s) {
  for (const f of s.foes) { f.from = [f.x, f.y]; f.ate = -1; f.blocked = false; }
  if (s.foes.some((f) => !f.taken && f.brain === 'ai')) foeMove(s, think(s));
  if (!lost(s)) patternHops(s);
  if (s.hole?.pattern && !lost(s)) holeHop(s);
}

/** Only your move, with no reply yet. Returns a new state. */
export function playerMove(s, mv) {
  const n = clone(s);
  if (mv.p >= 0) {
    const p = n.pieces[mv.p];
    p.x = mv.x; p.y = mv.y;
    const f = n.foes.find((f) => !f.taken && f.x === mv.x && f.y === mv.y);
    if (f) f.taken = true;
    if (f && goalMet(n)) n.won = true;
    if (p.type === 'ball' && n.hole && p.x === n.hole.x && p.y === n.hole.y) n.won = n.sunk = true;
  }
  return n;
}

/** Your move, then theirs. Returns a new state. */
export function apply(s, mv) {
  const n = playerMove(s, mv);
  if (!n.won) foesAct(n);
  n.t++;
  return n;
}

/** Just their reply to a move you already made with playerMove(). The same
    as the second half of apply(), split out so a page can show your move
    before they finish thinking. */
export function respond(n) {
  const c = clone(n);
  if (!c.won) foesAct(c);
  c.t++;
  return c;
}

export function isOver(s) {
  const max = s.day.rules.maxMoves;
  return s.won || lost(s) || (max > 0 && s.t >= max);
}

/** How a finished game ended: 'caught' (you won), 'eaten' (you lost your
    pieces, or your royal King) or 'dusk' (out of moves). */
export function outcome(s) { return s.won ? 'caught' : lost(s) ? 'eaten' : 'dusk'; }

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
  for (const p of s.pieces) k += p.taken ? '--' : p.x + ',' + p.y + ';';
  k += '|';
  for (const f of s.foes) k += f.taken ? '--' : f.x + ',' + f.y + ',' + f.i + (f.mx > 0 ? '+' : '-') + (f.my > 0 ? '+' : '-') + ';';
  if (s.hole) k += `|h${s.hole.x},${s.hole.y},${s.hole.i}${s.hole.mx > 0 ? '+' : '-'}${s.hole.my > 0 ? '+' : '-'}`;
  return k;
}

// The rules of grove chess. Nothing in here touches the page, so the same code
// runs the game, the solver that sets par, replays of other people's games,
// the lab, and the tests.
//
// A level ("day" in the code, since the daily board came first) is a board
// plus two sides: your pieces, and theirs ("foes"). The daily board is one
// level among many: a square board, one rabbit that hops in a pattern, catch
// it within 15 moves. The lab can make almost anything else.
//
// Stumps and bramble are out of the game for now (2026-10-06). The rules
// still know them because the first two daily boards had them, and links to
// those boards must keep replaying. Nothing new deals them.
//
// Possession (2026-10-06, Timothy's idea): a piece of theirs can be
// possessed by a rabbit. The rabbit's pattern says which way the piece goes
// each turn (left, up-right, or a pause); the piece's own moves say how. See
// possessedStep below.
//
// Coordinates: x runs left to right, y runs bottom to top, and (0, 0) is the
// bottom-left square, on your side of the board. A square's number is
// y * W + x.

import { think } from './ai.js';
import { rng } from '../../engine/seed.js';
import { betzaMoves } from './betza.js';

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
// A square that has crumbled away reads as OFF, the same as the board's edge.
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

// --- The magic board (Timothy, 2026-10-07: "pieces can loop around each
// side like a pac-man level"). `rules.wrap` is 'sides' (left and right are
// joined, like Pac-Man's tunnel) or 'all' (top and bottom too: a torus).
// Off the edge is the other edge. A slider that goes all the way round
// comes back to where it started, and stops there: every piece sees its
// own square as the edge of the world (sight, below), so it can never land
// on it, loop for ever, or hop over itself.

const wrapsX = (day) => day.rules?.wrap === 'sides' || day.rules?.wrap === 'all';
const wrapsY = (day) => day.rules?.wrap === 'all';

/** A square folded back onto a magic board (unchanged on any other). */
export function fold(day, x, y) {
  if (wrapsX(day)) x = ((x % day.W) + day.W) % day.W;
  if (wrapsY(day)) y = ((y % day.H) + day.H) % day.H;
  return [x, y];
}

// --- The geared board (Timothy, 2026-10-07: "rotated 90 degrees every
// turn"). After every turn the board, and everything on it, turns a
// quarter turn clockwise. Your pieces turn with it, so their own moves are
// unchanged (a pawn still goes toward them). What does not turn is
// everything that moves by a pattern: rabbits, possessed pieces, the hole.
// Their patterns are fixed to the world, not the board, so a rabbit that
// hops "up" always hops up the screen, which is a different way across the
// board every turn. Positions are kept in the board's own squares; only
// patterns need turning (patternStep) and only the drawing turns the view.

/** How many quarter turns the board has made by state s. */
export const turns = (s) => (s.day.rules.geared ? ((s.t % 4) + 4) % 4 : 0);

/**
 * A pattern's next step for `o` (a rabbit, a possessed piece, the hole), in
 * the board's squares: the step as the pattern says it (raw), facing the
 * way o faces (o.mx, o.my), turned to match the board on a geared board,
 * and bounced off any edge it would leave (which flips o's facing on that
 * axis from then on). Mutates o.mx and o.my.
 */
function patternStep(s, o, raw) {
  const r = turns(s), W = s.day.W, H = s.day.H;
  const turn = () => {
    let x = raw[0] * o.mx, y = raw[1] * o.my;
    for (let k = 0; k < r; k++) [x, y] = [-y, x]; // the world's step, on a board turned r times clockwise
    return [x, y];
  };
  let [dx, dy] = turn();
  // Bouncing flips the facing of whichever of the pattern's axes is
  // along that edge now (on a turned board the board's x is the world's y).
  if (!wrapsX(s.day) && (o.x + dx < 0 || o.x + dx >= W)) { if (r % 2) o.my = -o.my; else o.mx = -o.mx; [dx, dy] = turn(); }
  if (!wrapsY(s.day) && (o.y + dy < 0 || o.y + dy >= H)) { if (r % 2) o.mx = -o.mx; else o.my = -o.my; [dx, dy] = turn(); }
  return [dx, dy];
}

/** The shortest way from one column (or row) to another, on a magic board
    the way round the back if that is shorter. */
function delta(day, d, axis) {
  const n = axis === 'x' ? day.W : day.H, wraps = axis === 'x' ? wrapsX(day) : wrapsY(day);
  if (!wraps) return d;
  d = ((d % n) + n) % n;
  return d > n / 2 ? d - n : d;
}

/** Has the square at (x, y) crumbled away? Only on crumbling levels, where
    every square you move off falls away behind you. */
export const crumbled = (s, x, y) => s.gone.length > 0 && s.gone.includes(y * s.day.W + x);

/** Has the square at (x, y) fallen off the edge? Only on shrinking levels.
    Unlike a crumbled square it is no longer part of the board at all. */
export const shrunk = (s, x, y) => s.shrunk?.length > 0 && s.shrunk.includes(y * s.day.W + x);

/** Is the hole open? On a descent level it stays shut until every rabbit
    has been caught; anywhere else it is always open. A shut hole is just
    ground: anything can stand on it and the ball rolls straight over. */
export const holeOpen = (s) => s.day.rules.goal !== 'descent' || s.foes.every((f) => !f.target || f.taken);

/** Can this foe take your pieces? Rabbits have their own rule (and by
    default they do not eat); the first daily boards, which predate it, fall
    back to the rule for everything. */
export function canTake(rules, f) {
  return f.type === 'rabbit' ? (rules.rabbitsEat ?? rules.foesCapture) : rules.foesCapture;
}

/** What is on (x, y), as seen by `side` ('you' or 'foe'). */
export function look(s, x, y, side = 'you') {
  if (s.day.rules.wrap) [x, y] = fold(s.day, x, y);
  if (!onBoard(s.day, x, y) || crumbled(s, x, y) || shrunk(s, x, y)) return OFF;
  const bram = isBramble(s, x, y);
  for (const p of s.pieces)
    if (!p.taken && p.x === x && p.y === y) {
      // A ball that is hit (ballMove 'hit') is something either side can
      // move into: the move generators see it as a catch, and landing on it
      // knocks it on instead (knock, below).
      if (p.type === 'ball' && s.day.rules.ballMove === 'hit') return ENEMY;
      return side === 'you' ? OWN : bram ? HIDDEN : ENEMY;
    }
  for (const f of s.foes)
    if (!f.taken && f.x === x && f.y === y) return side === 'foe' ? OWN : bram ? HIDDEN : ENEMY;
  if (s.hole && s.hole.x === x && s.hole.y === y && holeOpen(s)) return HOLE;
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

/** The ball never takes anything. It drops into the hole if it rolls over
    it, or, when the level says so, only if it comes to rest on it. How it
    moves is the level's `ballMove`:
    - 'ice' (the first ball, and the daily's): up, down, left or right, and
      it keeps rolling until something stops it, like a puzzle on ice.
    - 'putt': up, down, left or right, as far as you like, like a rook.
    - 'bounce': diagonally, as far as you like, bouncing off the edge of the
      board like a billiard ball. This is a real fairy chess piece, the
      reflecting bishop, from Billiards Chess (Jacques Berthoumeau, 1950s),
      except that the ball never takes anything. */
function ball(L, p, fwd, day) {
  const how = day?.rules?.ballMove || 'ice';
  if (how === 'hit') return []; // it only moves when something hits it
  if (how === 'bounce') return billiard(L, p, day);
  if (how === 'putt') return putt(L, p, day);
  const out = [], dropsIn = !day?.rules?.ballStops, takes = !!day?.rules?.ballCaptures;
  for (const [dx, dy] of ORTH) {
    let x = p.x, y = p.y, onHole = false, cap = false;
    for (;;) {
      const c = L(x + dx, y + dy);
      // A ball that captures (ballCaptures, 2026-10-07) rolls into the
      // first piece of theirs in its way, takes it, and stops there.
      if (c === ENEMY && takes) { x += dx; y += dy; cap = true; break; }
      if (c !== EMPTY && c !== HOLE) break;
      x += dx; y += dy; onHole = c === HOLE;
      if (onHole && dropsIn) break;
    }
    // On a magic board a roll with nothing in its way goes all the way
    // round and arrives back where it started (its own square stopped it):
    // that is no move at all.
    if (day?.rules?.wrap && !cap && !onHole) {
      const [nx, ny] = fold(day, x + dx, y + dy);
      if (nx === p.x && ny === p.y) continue;
    }
    if (x !== p.x || y !== p.y) out.push({ x, y, cap, sink: onHole && !cap });
  }
  return out;
}

/** The putting ball: a rook that never takes. Past an open hole it cannot
    go (it would drop in), unless the level says it must stop on it. */
function putt(L, p, day) {
  const out = [], dropsIn = !day?.rules?.ballStops, takes = !!day?.rules?.ballCaptures;
  for (const [dx, dy] of ORTH)
    for (let x = p.x + dx, y = p.y + dy; ; x += dx, y += dy) {
      const c = L(x, y);
      if (c === ENEMY && takes) { out.push({ x, y, cap: true }); break; }
      if (c !== EMPTY && c !== HOLE) break;
      out.push({ x, y, cap: false, sink: c === HOLE });
      if (c === HOLE && dropsIn) break;
    }
  return out;
}

/** The billiard ball: diagonally, as far as you like, and off the edge of
    the board it bounces at a right angle. The cushion runs through the
    middle of the edge squares, so from b1 it goes a2 and back out to b3.
    Gaps in the board (a crumbled square, a shrunk edge) are edges too.
    Each move remembers the squares it bounced on (`via`), so it can be
    drawn going the way it went. Like any bishop it keeps to its colour. */
function billiard(L, p, day) {
  const dropsIn = !day?.rules?.ballStops, found = new Map();
  const off = (x, y) => L(x, y) === OFF;
  for (let [dx, dy] of DIAG) {
    let x = p.x, y = p.y;
    const via = [];
    for (let step = 0; step < 64; step++) {
      if (off(x + dx, y + dy)) {
        const fx = off(x + dx, y), fy = off(x, y + dy);
        if (fx) dx = -dx;
        if (fy) dy = -dy;
        if (!fx && !fy) { dx = -dx; dy = -dy; } // the point of a corner: straight back
        if (off(x + dx, y + dy)) break;
        if (x !== p.x || y !== p.y) via.push([x, y]);
      }
      x += dx; y += dy;
      const c = L(x, y);
      if (c === ENEMY && day?.rules?.ballCaptures) { if (!found.has(y * 64 + x)) found.set(y * 64 + x, { x, y, cap: true, ...(via.length ? { via: via.slice() } : {}) }); break; }
      if (c !== EMPTY && c !== HOLE) break; // anything in the way, itself included
      const k = y * 64 + x;
      if (!found.has(k)) found.set(k, { x, y, cap: false, sink: c === HOLE, ...(via.length ? { via: via.slice() } : {}) });
      if (c === HOLE && dropsIn) break;
    }
  }
  return [...found.values()];
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
 * `value` is what the AI thinks a piece is worth (left as it was, so the
 * thinking pieces of old levels play as they did).
 *
 * `betza` is the piece written in Betza notation (betza.js), its patent:
 * the codified answer to how it moves, captures, and what it needs. The
 * pieces from before 2026-10-07 keep their own move code, and a check
 * proves their notation gives the same moves; the pieces after that are
 * made from their notation alone.
 *
 * `strength` is how strong a piece is in pawns, the way chess players
 * count (a knight about 3, a rook 5, a queen 9 and a half). The classic
 * ones are the usual modern values; the fairy ones are estimates from what
 * fairy chess players have published for them and from their mobility
 * (betza.js), which docs/grove-pieces.md sets out. Estimates, not truths.
 */
export const PIECES = {
  king: { name: 'King', kind: 'classic', tier: 1, value: 3, betza: 'K', strength: 3,
    desc: 'Steps one square in any direction.',
    moves: (L, p) => leap(L, p, ALL8) },
  queen: { name: 'Queen', kind: 'classic', tier: 2, value: 9, betza: 'Q', strength: 9.5,
    desc: 'Slides any distance in a straight line or a diagonal.',
    moves: (L, p) => ride(L, p, ALL8) },
  rook: { name: 'Rook', kind: 'classic', tier: 1, value: 5, betza: 'R', strength: 5,
    desc: 'Slides any distance up, down, left or right.',
    moves: (L, p) => ride(L, p, ORTH) },
  bishop: { name: 'Bishop', kind: 'classic', tier: 1, value: 3, betza: 'B', strength: 3.25,
    desc: 'Slides any distance diagonally.',
    moves: (L, p) => ride(L, p, DIAG) },
  knight: { name: 'Knight', kind: 'classic', tier: 1, value: 3, betza: 'N', strength: 3.25,
    desc: 'Jumps in an L, two one way and one to the side, over anything.',
    moves: (L, p) => leap(L, p, KNIGHT) },
  pawn: { name: 'Pawn', kind: 'classic', tier: 0, value: 1, betza: 'mfWcfF', strength: 1,
    desc: 'Steps one square forward. Can only catch diagonally forward.',
    moves: pawn },

  grasshopper: { name: 'Grasshopper', kind: 'fairy', tier: 1, value: 2.5, betza: 'gQ', strength: 2,
    desc: 'Travels along any line but must hop over the first thing in its way, landing just beyond it. No hurdle, no move.',
    origin: 'Invented by T. R. Dawson, 1912.',
    moves: grasshopper },
  nightrider: { name: 'Nightrider', kind: 'fairy', tier: 2, value: 6, betza: 'NN', strength: 5,
    desc: 'A knight that keeps going: repeats the same L jump in a straight line until something stops it.',
    origin: 'T. R. Dawson, 1925.',
    moves: (L, p) => ride(L, p, KNIGHT) },
  camel: { name: 'Camel', kind: 'fairy', tier: 1, value: 3, betza: 'C', strength: 2.5,
    desc: 'A long knight: leaps three one way and one to the side, over anything.',
    origin: 'From Tamerlane chess.',
    moves: (L, p) => leap(L, p, sym(3, 1)) },
  zebra: { name: 'Zebra', kind: 'fairy', tier: 0, value: 2, betza: 'Z', strength: 2.25,
    desc: 'Leaps three one way and two to the side, over anything.',
    moves: (L, p) => leap(L, p, sym(3, 2)) },
  alfil: { name: 'Alfil', kind: 'fairy', tier: 0, value: 1.5, betza: 'A', strength: 1.25,
    desc: 'Leaps exactly two squares diagonally, over anything.',
    origin: '"The elephant" of shatranj, the medieval ancestor of the bishop.',
    moves: (L, p) => leap(L, p, sym(2, 2)) },
  ferz: { name: 'Ferz', kind: 'fairy', tier: 0, value: 1.5, betza: 'F', strength: 1.5,
    desc: 'Steps one square diagonally.',
    origin: 'The counsellor of shatranj, the ancestor of the queen.',
    moves: (L, p) => leap(L, p, DIAG) },
  wazir: { name: 'Wazir', kind: 'fairy', tier: 0, value: 1.5, betza: 'W', strength: 1.5,
    desc: 'Steps one square up, down, left or right.',
    origin: 'Named for the vizier.',
    moves: (L, p) => leap(L, p, ORTH) },
  cannon: { name: 'Cannon', kind: 'fairy', tier: 1, value: 4, betza: 'mRcpR', strength: 4,
    desc: 'Slides like a rook, but can only catch by jumping exactly one thing on the way.',
    origin: 'From xiangqi, Chinese chess.',
    moves: cannon },
  mao: { name: 'Mao', kind: 'fairy', tier: 0, value: 2.5, betza: 'nN', strength: 2.75,
    desc: 'Moves like a knight, but one straight step first. Anything on that first square blocks it.',
    origin: 'The horse of xiangqi.',
    moves: mao },
  squirrel: { name: 'Squirrel', kind: 'fairy', tier: 1, value: 4, betza: 'NAD', strength: 5,
    desc: 'Leaps to any square exactly two away, over anything.',
    moves: (L, p) => leap(L, p, [...sym(2, 0), ...sym(2, 1), ...sym(2, 2)]) },
  rose: { name: 'Rose', kind: 'fairy', tier: 1, value: 4.5, betza: 'qN', strength: 5.5,
    desc: 'Makes knight jumps that curve, each one turning further, tracing a circle. Stops at anything in its path.',
    moves: rose },
  archbishop: { name: 'Archbishop', kind: 'fairy', tier: 2, value: 7, betza: 'BN', strength: 8.75,
    desc: 'A bishop that can also jump like a knight.',
    origin: 'From Capablanca chess, 1920s.',
    moves: (L, p) => leap(L, p, KNIGHT, ride(L, p, DIAG)) },

  // --- Added 2026-10-07, made from their Betza notation alone. -------------
  chancellor: { name: 'Chancellor', kind: 'fairy', tier: 2, value: 8, betza: 'RN', strength: 9,
    desc: 'A rook that can also jump like a knight.',
    origin: 'From Capablanca chess, the 1920s; earlier, as the "champion" and "marshal", in variants back to the 1600s.',
    moves: betzaMoves('RN') },
  amazon: { name: 'Amazon', kind: 'fairy', tier: 2, value: 12, betza: 'QN', strength: 12.5,
    desc: 'A queen that can also jump like a knight. The strongest piece here.',
    origin: 'The queen of some 18th-century Russian chess, and the maharaja of the Indian game "The Maharajah and the Sepoys".',
    moves: betzaMoves('QN') },
  dabbaba: { name: 'Dabbaba', kind: 'fairy', tier: 0, value: 1.5, betza: 'D', strength: 1.25,
    desc: 'Leaps exactly two squares up, down, left or right, over anything.',
    origin: 'The war engine (dabbaba, a covered siege machine) of Tamerlane chess, 14th century.',
    moves: betzaMoves('D') },
  silver: { name: 'Silver general', kind: 'fairy', tier: 0, value: 2.5, betza: 'FfW', strength: 2.5,
    desc: 'Steps one square diagonally, or one square straight forward. It cannot step sideways or straight back.',
    origin: 'From shogi, Japanese chess, where pieces are wedges that point at the enemy; this one has been in the game since about the 1100s.',
    moves: betzaMoves('FfW') },
  lance: { name: 'Lance', kind: 'fairy', tier: 1, value: 3, betza: 'fR', strength: 2.25,
    desc: 'Slides any distance straight forward, and only forward.',
    origin: 'The kyōsha, "incense chariot", of shogi.',
    moves: betzaMoves('fR') },

  // Only ever on their side. When it thinks (the AI brain) it moves like a
  // king; when it follows a pattern, the pattern decides.
  // Only ever yours, and only on ball-and-hole levels.
  ball: { name: 'Ball', kind: 'special', tier: 0, value: 2, betza: null, strength: null,
    desc: 'Rolls up, down, left or right until something stops it. Your other pieces make good walls. Get it into the hole to win.',
    moves: ball },

  rabbit: { name: 'Rabbit', kind: 'quarry', tier: 1, value: 3, betza: 'K', strength: null,
    desc: 'Steps one square in any direction.',
    moves: (L, p) => leap(L, p, ALL8) }
};

export const RABBIT_DESC = 'Hops in a fixed pattern that repeats. If it lands on one of your pieces, it eats it. It bounces off the edges, and if it cannot land where it is hopping, it waits a turn. Watch its tracks.';
export const RABBIT_GENTLE_DESC = 'Hops in a fixed pattern that repeats. It bounces off the edges, and if it cannot land where it is hopping (one of your pieces is in the way, say), it waits a turn. It does not eat. Watch its tracks.';
/** The rabbit's description for a level's rules: does it eat or not? */
export const rabbitDesc = (rules) => ((rules.rabbitsEat ?? rules.foesCapture) ? RABBIT_DESC : RABBIT_GENTLE_DESC);
export const RABBIT_AI_DESC = 'Thinks for itself and steps one square in any direction, like a king. It eats what it lands on.';
export const BRAMBLE_DESC = 'Creeps across the board. Nothing can enter it and nothing slides through it. Anything caught inside is safe until it leaves.';
export const STUMP_DESC = 'A statue: a piece in grey stone, older than the board. It never moves and nothing can take it. Sliders stop at it, leapers jump over it, and pieces that hop (the grasshopper, the cannon) can hop over it.';

/** The kind of piece a statue on square sq is a statue of. (The rules call
    statues stumps: they were tree stumps until 2026-10-07, and rule for
    rule they are the same thing.) */
const STATUE_KINDS = ['pawn', 'rook', 'knight', 'bishop', 'king', 'queen'];
export const statueKind = (day, sq) => day.statueKinds?.get(sq) ?? STATUE_KINDS[sq % STATUE_KINDS.length];
export const CRUMBLE_DESC = 'Every square you move off crumbles away behind you. Nothing can stand on it again: sliders stop at the gap, leapers can still jump it, and a rabbit that tries to hop in waits instead.';
export const SHRINK_DESC = 'The edge of the board falls away. Every few moves one square on the rim drops into the dark for good, and the rim closes in. It never takes a square anything is standing on, never cuts the board in two, and stops when half the board is gone.';
/** On a level where the ball captures, the sentence that says so. */
const takesLine = (rules) => (rules?.ballCaptures ? ' Here the ball captures: rolling into one of their pieces, it takes it and stops there.' : '');

/** The ball, in words, for how it moves on this level (`ballMove`). */
export function ballDesc(rules) {
  const how = rules?.ballMove || 'ice';
  if (how === 'hit') return 'Never moves by itself: a piece hits it. Move any piece into the ball and it slides away along the line of that move, like on ice (a knight sends it on in knight\u2019s jumps), until something stops it. Their pieces hit it too. Nothing can take it. Knock it into the open hole to win.' + takesLine(rules);
  if (how === 'putt') return `Rolls up, down, left or right, as far as you like, and stops where you choose.${rules?.ballCaptures ? '' : ' It never takes anything.'} Get it into the hole to win.${takesLine(rules)}`;
  if (how === 'bounce') return `Rolls diagonally, as far as you like, and bounces off the edge of the board, like a billiard ball: the reflecting bishop of Billiards Chess. Like a bishop it keeps to its colour.${rules?.ballCaptures ? '' : ' It never takes anything.'} Get it into the hole to win.${takesLine(rules)}`;
  return PIECES.ball.desc + takesLine(rules);
}

/** A piece's description on a level: the ball's depends on the level. */
export const descOf = (type, rules) => (type === 'ball' ? ballDesc(rules) : PIECES[type].desc);

export const LOCKED_DESC = 'The hole stays shut until every rabbit is caught. Shut, it is only ground: anything can stand on it and the ball rolls over it. Once it opens, sink the ball to fall through to the next level.';
export const HOLE_DESC = 'The hole. It moves by its own hidden pattern after every turn, bounces off the edges, and waits if anything is in the way. Nothing but the ball can go in it.';

// --- Level rules. ----------------------------------------------------------

/** The daily board's rules. A lab level can set any of these. */
export const DAILY_RULES = {
  goal: 'target',    // 'target': catch every marked foe; 'all': catch them all; 'any': catch one
  maxMoves: 15,      // 0 means no limit
  wait: true,        // may you spend a move standing still?
  foesCapture: true, // can they take your pieces?
  royal: false,      // does losing a King lose the game?
  first: 'you',      // who moves first
  crumble: false     // does every square you move off fall away?
  // Lab levels can also set: rabbitsEat (rabbits take your pieces; without
  // it rabbits follow foesCapture, which is how the first daily boards
  // work), shrink ('random' or 'spiral': the edge falls away every
  // shrinkEvery moves), and goal 'descent' (catch every rabbit to open the
  // hole, then sink the ball).
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
    gone: [], // squares that have crumbled away, in the order they went
    shrunk: [], // squares that have fallen off the edge, in the order they went
    won: false
  };
  if (day.rules.first === 'them') { foesAct(s); s.opened = true; }
  return s;
}

export function clone(s) {
  return { day: s.day, t: s.t, pieces: s.pieces.map((p) => ({ ...p })), foes: s.foes.map((f) => ({ ...f })),
    hole: s.hole ? { ...s.hole } : null, gone: s.gone.slice(), shrunk: s.shrunk ? s.shrunk.slice() : [], won: s.won, sunk: s.sunk };
}

const youLook = (s) => (x, y) => look(s, x, y, 'you');
const foeLook = (s) => (x, y) => look(s, x, y, 'foe');

/** What piece p sees, from `side`: the board as it is, except that on a
    magic board its own square reads as the edge. */
function sight(s, p, side) {
  if (!s.day.rules.wrap) return side === 'you' ? youLook(s) : foeLook(s);
  return (x, y) => {
    const [a, b] = fold(s.day, x, y);
    return a === p.x && b === p.y ? OFF : look(s, a, b, side);
  };
}

/** Piece p's moves, from `side`, folded back onto a magic board. */
function pieceMoves(s, p, side) {
  const ms = PIECES[p.type].moves(sight(s, p, side), p, side === 'you' ? 1 : -1, s.day);
  if (!s.day.rules.wrap) return ms;
  const out = new Map();
  for (const m of ms) {
    const [x, y] = fold(s.day, m.x, m.y), k = y * s.day.W + x;
    if (!out.has(k)) out.set(k, { ...m, x, y });
  }
  return [...out.values()];
}

export function movesFor(s, i) {
  const p = s.pieces[i];
  if (s.won || p.taken) return [];
  const ms = pieceMoves(s, p, 'you');
  return s.day.rules.ballMove === 'hit' ? ms.filter((m) => hitOk(s, p, m)) : ms;
}

/** Where a thinking foe can go. */
export function foeMovesFor(s, k) {
  const f = s.foes[k];
  if (f.taken || f.brain !== 'ai') return [];
  const ms = pieceMoves(s, f, 'foe');
  if (s.day.rules.ballMove === 'hit') return ms.filter((m) => hitOk(s, f, m) && (!m.cap || hitBall(s, m.x, m.y) || canTake(s.day.rules, f)));
  return canTake(s.day.rules, f) ? ms : ms.filter((m) => !m.cap);
}

/**
 * Who could capture on the very first move, from where everything starts:
 * your pieces that have a capture among their moves, and their pieces that
 * could take one of yours (a thinking or possessed piece by any of its
 * moves, a rabbit by its first hop), as far as the level lets them take.
 * Hitting a ball is not a capture. Returns { yours, theirs }, lists of
 * indexes. (Timothy, 2026-10-07: no piece should be able to capture on its
 * first move; the tester throws such layouts out, solve.js unbalanced.)
 */
export function firstCaptures(s) {
  const onFoe = (m) => s.foes.some((f) => !f.taken && f.x === m.x && f.y === m.y);
  const onMine = (m) => s.pieces.some((p) => !p.taken && p.type !== 'ball' && p.x === m.x && p.y === m.y) ||
    s.pieces.some((p) => !p.taken && p.type === 'ball' && p.x === m.x && p.y === m.y && s.day.rules.ballMove !== 'hit');
  const yours = [], theirs = [];
  s.pieces.forEach((p, i) => { if (!p.taken && pieceMoves(s, p, 'you').some((m) => m.cap && onFoe(m))) yours.push(i); });
  s.foes.forEach((f, k) => {
    if (f.taken || !canTake(s.day.rules, f)) return;
    if (f.brain === 'pattern') {
      // A rabbit's first hop is the only move it has.
      const [dx, dy] = patternStep(s, { ...f }, f.pattern[f.i || 0]); // a copy: only looking
      const [tx, ty] = fold(s.day, f.x + dx, f.y + dy);
      if (onMine({ x: tx, y: ty })) theirs.push(k);
      return;
    }
    if (pieceMoves(s, f, 'foe').some((m) => m.cap && onMine(m))) theirs.push(k);
  });
  return { yours, theirs };
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
  if (g === 'hole' || g === 'descent') return false; // only the ball in the hole wins
  if (g === 'any') return F.some((f) => f.taken);
  if (g === 'target' && F.some((f) => f.target)) return F.every((f) => !f.target || f.taken);
  return F.every((f) => f.taken);
}

export const allTaken = (s) => s.pieces.every((p) => p.taken);
export function lost(s) {
  return allTaken(s) || (s.day.rules.royal && s.pieces.some((p) => p.taken && p.type === 'king')) ||
    ((s.day.rules.goal === 'hole' || s.day.rules.goal === 'descent') && s.pieces.some((p) => p.taken && p.type === 'ball'));
}

// --- Their turn. -----------------------------------------------------------

/** A foe lands on (x, y), taking whatever of yours is there. Mutates. */
function landFoe(s, f, x, y) {
  const b = hitBall(s, x, y);
  if (b) { knock(s, b, f.x, f.y); f.ate = -1; f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; return; }
  f.ate = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (f.ate >= 0) s.pieces[f.ate].taken = true;
  f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false;
}

/** A pattern foe's hop. Mutates `s`. Landing on one of your pieces eats it
    (if they may capture); another of theirs, a missing or crumbled square,
    or (on the first two daily boards) a stump or bramble stops it, and it
    waits. */
function hop(s, f) {
  const pat = f.pattern;
  // Bouncing flips the whole pattern on that axis from here on, the way a
  // ball's direction stays flipped after it hits a wall (patternStep; on a
  // magic board a joined edge is no wall: it hops on round).
  const [dx, dy] = patternStep(s, f, pat[f.i]);
  f.i = (f.i + 1) % pat.length;
  const [tx, ty] = fold(s.day, f.x + dx, f.y + dy), c = look(s, tx, ty, 'foe');
  const ball = c === ENEMY && hitBall(s, tx, ty);
  if (c === EMPTY || (c === ENEMY && canTake(s.day.rules, f) && !ball) || (ball && hitOk(s, f, { x: tx, y: ty }))) landFoe(s, f, tx, ty);
  else { f.from = [f.x, f.y]; f.ate = -1; f.blocked = true; }
}

/** One move by a thinking foe: { k, x, y }. Mutates. */
export function foeMove(s, m) {
  if (m) landFoe(s, s.foes[m.k], m.x, m.y);
}

/** Does list a sort before list b, comparing item by item? */
function before(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * A possessed piece's step. The rabbit inside says which way: the next step
 * of its pattern, a direction like (1, 0) for right or (0, 0) for a pause.
 * The piece says how: of its own legal moves that head that way, it takes
 * the one landing closest to where the step points (ties: the shorter move,
 * then the one nearer you, then the one further left). If none heads that
 * way it waits. Like a rabbit, a step that would leave the board flips the
 * pattern on that axis from then on. Mutates.
 */
function possessedStep(s, f) {
  const raw = f.pattern[f.i];
  f.i = (f.i + 1) % f.pattern.length;
  f.from = [f.x, f.y]; f.ate = -1; f.blocked = false; f.rested = false;
  if (!raw[0] && !raw[1]) { f.rested = true; return; }
  const [dx, dy] = patternStep(s, f, raw);
  const [tx, ty] = fold(s.day, f.x + dx, f.y + dy), take = canTake(s.day.rules, f);
  let best = null, bk = null;
  for (const m of pieceMoves(s, f, 'foe')) {
    const ball = m.cap && hitBall(s, m.x, m.y);
    if (ball ? !hitOk(s, f, m) : m.cap && !take) continue;
    // (On a magic board, distances go the short way round.)
    const mx = delta(s.day, m.x - f.x, 'x'), my = delta(s.day, m.y - f.y, 'y');
    if (mx * dx + my * dy <= 0) continue; // not this way
    const key = [delta(s.day, m.x - tx, 'x') ** 2 + delta(s.day, m.y - ty, 'y') ** 2, mx * mx + my * my, m.y, m.x];
    if (!bk || before(key, bk)) { best = m; bk = key; }
  }
  if (!best) { f.blocked = true; return; }
  landFoe(s, f, best.x, best.y);
}

/** The pattern foes all hop, and the possessed pieces take their steps.
    Mutates. */
export function patternHops(s) {
  for (const f of s.foes) {
    if (f.taken) continue;
    if (f.brain === 'pattern') for (let h = 0; h < (f.hops || 1) && !lost(s); h++) hop(s, f);
    else if (f.brain === 'possessed' && !lost(s)) possessedStep(s, f);
  }
}

/** The hole's hop: its pattern, bouncing off the edges like a rabbit, and
    waiting if anything at all is in the way. Mutates. */
function holeHop(s) {
  const h = s.hole, pat = h.pattern;
  const [dx, dy] = patternStep(s, h, pat[h.i]);
  h.i = (h.i + 1) % pat.length;
  h.from = [h.x, h.y];
  if (look(s, h.x + dx, h.y + dy) === EMPTY) { [h.x, h.y] = fold(s.day, h.x + dx, h.y + dy); h.blocked = false; }
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

// --- Hitting the ball (ballMove 'hit', 2026-10-07). ---------------------
// Timothy: "find a way for the regular pieces to interact with a ball more
// ... maybe having the ball be moved by the pieces, like it's getting hit."

/** Where a hit ball would end up, or null if it cannot budge. A piece
    moving from (fx, fy) into the ball sends it sliding on along the same
    line, like on ice (Timothy, 2026-10-07: "slide like ice when hit"): one
    step of the move's shape at a time (a rook's hit, one square; a knight's,
    one L) until something stops it. It drops into an open hole it slides
    over (or, with ballStops, only one it stops on). A ball that captures
    (ballCaptures) slides into the first piece of theirs in its way and
    takes it (`takes`, the foe's index). */
function knockPath(s, b, fx, fy) {
  const vx = b.x - fx, vy = b.y - fy;
  const g = gcd(Math.abs(vx), Math.abs(vy)) || 1, sx = vx / g, sy = vy / g;
  let x = b.x, y = b.y, sunk = false, takes = -1;
  for (let k = 0; k < 64; k++) {
    // On a magic board: all the way round and back to where it started is
    // no move at all.
    const [nx, ny] = fold(s.day, x + sx, y + sy);
    if (nx === b.x && ny === b.y) return null;
    // The hitter has left its square by the time the ball gets there.
    const c = nx === fx && ny === fy ? EMPTY : look(s, x + sx, y + sy, 'you');
    if (c === ENEMY && s.day.rules.ballCaptures) {
      takes = s.foes.findIndex((f) => !f.taken && f.x === nx && f.y === ny);
      if (takes >= 0) { x = nx; y = ny; break; }
    }
    if (c !== EMPTY && c !== HOLE) break;
    x = nx; y = ny;
    if (c === HOLE && !s.day.rules.ballStops) { sunk = true; break; }
  }
  if (!sunk && s.day.rules.ballStops && s.hole && holeOpen(s) && x === s.hole.x && y === s.hole.y) sunk = true;
  return x === b.x && y === b.y ? null : { x, y, sunk, takes };
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** The ball piece standing on (x, y) on a level where it is hit, if any. */
function hitBall(s, x, y) {
  if (s.day.rules.ballMove !== 'hit') return null;
  return s.pieces.find((p) => !p.taken && p.type === 'ball' && p.x === x && p.y === y) || null;
}

/** A move (from `p` to `m`) that hits the ball must be able to move it. */
const hitOk = (s, p, m) => { const b = hitBall(s, m.x, m.y); return !b || !!knockPath(s, b, p.x, p.y); };

/** Knock the ball on from a hit by a piece coming from (fx, fy). Mutates. */
function knock(s, b, fx, fy) {
  const to = knockPath(s, b, fx, fy);
  if (!to) return false;
  b.from = [b.x, b.y]; b.x = to.x; b.y = to.y;
  if (to.takes >= 0) {
    s.foes[to.takes].taken = true;
    if (goalMet(s)) s.won = true;
  }
  if (to.sunk && holeOpen(s)) s.won = s.sunk = true;
  return true;
}

/** Your piece i lands on (x, y): the square it left may crumble, anything
    of theirs there is caught, and the game may be won. Mutates. */
function landMine(n, i, x, y) {
  const p = n.pieces[i];
  const hit = hitBall(n, x, y);
  if (hit && hit !== p) knock(n, hit, p.x, p.y);
  // Crumbling ground: the square you leave falls away behind you.
  if (n.day.rules.crumble) n.gone.push(p.y * n.day.W + p.x);
  p.x = x; p.y = y;
  const f = n.foes.find((f) => !f.taken && f.x === x && f.y === y);
  if (f) f.taken = true;
  if (f && goalMet(n)) n.won = true;
  if (p.type === 'ball' && n.hole && p.x === n.hole.x && p.y === n.hole.y && holeOpen(n)) n.won = n.sunk = true;
  // Catching the last rabbit opens the hole; a ball already resting on
  // the shut hole drops straight in.
  const b = f && n.day.rules.goal === 'descent' && holeOpen(n) && n.pieces.find((q) => q.type === 'ball' && !q.taken);
  if (b && n.hole && b.x === n.hole.x && b.y === n.hole.y) n.won = n.sunk = true;
}

/** Only your move, with no reply yet. Returns a new state. */
export function playerMove(s, mv) {
  const n = clone(s);
  if (mv.p >= 0) landMine(n, mv.p, mv.x, mv.y);
  return n;
}

// --- Autochess. ------------------------------------------------------------
// (Timothy, 2026-10-07.) Rabbits you have caught can possess your pieces
// too. A possessed piece of yours moves by itself, exactly the way one of
// theirs does: the rabbit's pattern says which way, the piece's own moves
// say how (possessedStep, above). You choose which rabbit goes in which
// piece, which way it faces, and the order of your line; then the game
// plays itself.

/**
 * One possessed piece of yours takes its step. The same choice as theirs,
 * from your side: of its legal moves that head the pattern's way, the one
 * landing closest to where the step points (ties: the shorter move, then
 * the one nearer them, then the one further left). Mutates.
 */
function mineStep(n, i) {
  const p = n.pieces[i], raw = p.pattern[p.i];
  p.i = (p.i + 1) % p.pattern.length;
  p.from = [p.x, p.y]; p.blocked = false; p.rested = false;
  if (!raw[0] && !raw[1]) { p.rested = true; return; }
  const [dx, dy] = patternStep(n, p, raw);
  const [tx, ty] = fold(n.day, p.x + dx, p.y + dy);
  let best = null, bk = null;
  for (const m of pieceMoves(n, p, 'you')) {
    if (!hitOk(n, p, m)) continue;
    const mx = delta(n.day, m.x - p.x, 'x'), my = delta(n.day, m.y - p.y, 'y');
    if (mx * dx + my * dy <= 0) continue; // not this way
    const key = [delta(n.day, m.x - tx, 'x') ** 2 + delta(n.day, m.y - ty, 'y') ** 2, mx * mx + my * my, -m.y, m.x];
    if (!bk || before(key, bk)) { best = m; bk = key; }
  }
  if (!best) { p.blocked = true; return; }
  landMine(n, i, best.x, best.y);
}

/** Is this one of your pieces with a rabbit inside? */
export const autoPiece = (p) => p.brain === 'possessed' && !p.taken;

/** Your half of an autochess turn: every possessed piece of yours steps,
    in order from the left of the board (then the bottom), as they stand at
    the start of the turn, until the game is won. No reply yet. Returns a
    new state. */
export function autoMove(s) {
  const n = clone(s);
  const order = n.pieces.map((p, i) => i).filter((i) => autoPiece(n.pieces[i]))
    .sort((a, b) => n.pieces[a].x - n.pieces[b].x || n.pieces[a].y - n.pieces[b].y);
  for (const i of order) if (!n.won && !lost(n) && autoPiece(n.pieces[i])) mineStep(n, i);
  return n;
}

/** A whole autochess turn: yours, then theirs. Returns a new state. */
export const autoApply = (s) => respond(autoMove(s));

// --- Shrinking ground. -----------------------------------------------------

/** Per level, worked out once: how many squares it starts with, and the
    order squares go in. Of the squares free to fall, the one earliest in the
    order goes. On a spiral board the order runs clockwise round the edge and
    inward; otherwise it is a shuffle fixed when the level is made, so the
    square drawn as falling next is the one that does, unless something
    moves onto it. */
function shrinkInfo(day) {
  if (day._shrink) return day._shrink;
  const W = day.W, H = day.H, order = new Map();
  if (day.rules.shrink !== 'spiral') {
    const rand = rng(`shrink:${day.shrinkKey ?? ''}`), all = [];
    for (let k = 0; k < W * H; k++) all.push(k);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    all.forEach((k, i) => order.set(k, i));
  } else {
    let n = 0, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
    while (x0 <= x1 && y0 <= y1) {
      for (let x = x0; x <= x1; x++) order.set(y1 * W + x, n++);                   // along the top, left to right
      for (let y = y1 - 1; y >= y0; y--) order.set(y * W + x1, n++);               // down the right side
      if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) order.set(y0 * W + x, n++); // back along the bottom
      if (x0 < x1) for (let y = y0 + 1; y < y1; y++) order.set(y * W + x0, n++);  // up the left side
      x0++; y0++; x1--; y1--;
    }
  }
  // The board's squares, and the same squares in the order they go.
  const base = new Uint8Array(W * H), ranked = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (onBoard(day, x, y)) { base[y * W + x] = 1; ranked.push(y * W + x); }
  ranked.sort((a, b) => order.get(a) - order.get(b));
  return (day._shrink = { base, ranked, total: ranked.length });
}

// The eight squares around one, in order round the circle, starting above.
const RING = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

/** One square falls off the edge. Never one with anything on it, never one
    that would cut the board in two, and never past half the board. Of the
    squares free to go, the earliest in the level's order goes. Mutates.
    (The solver runs this a great deal, so it works on plain arrays.) */
function shrinkStep(s) {
  const day = s.day, W = day.W, H = day.H, info = shrinkInfo(day);
  const present = info.base.slice();
  for (const q of s.shrunk) present[q] = 0;
  const used = new Uint8Array(W * H);
  let nUsed = 0;
  const use = (q) => { if (!used[q]) { used[q] = 1; nUsed++; } };
  for (const p of s.pieces) if (!p.taken) use(p.y * W + p.x);
  for (const f of s.foes) if (!f.taken) use(f.y * W + f.x);
  if (s.hole) use(s.hole.y * W + s.hole.x);
  const left = info.total - s.shrunk.length;
  if (left <= Math.max(Math.ceil(info.total / 2), nUsed + 2)) return;
  const here = (x, y) => x >= 0 && y >= 0 && x < W && y < H && present[y * W + x] === 1;

  /** Would the board still be one piece without square `sq`? First a quick
      local look: walk the eight squares around it, and if every neighbour
      it touches lies on one unbroken run of them, they stay joined without
      it. Only when that fails, search the whole board. */
  const staysWhole = (sq) => {
    const x0 = sq % W, y0 = (sq / W) | 0;
    const on = RING.map(([dx, dy]) => here(x0 + dx, y0 + dy));
    let runs = 0;
    for (let i = 0; i < 8; i++) {
      if (!on[i] || on[(i + 7) % 8]) continue; // not the start of a run
      let touches = false;
      for (let j = i; on[j % 8] && j < i + 8; j++) if (j % 2 === 0) touches = true; // even = straight neighbours
      if (touches) runs++;
    }
    if (runs <= 1) return true;
    const start = info.ranked.find((k) => k !== sq && present[k]);
    const seen = new Uint8Array(W * H), stack = [start];
    seen[start] = seen[sq] = 1;
    let count = 1;
    while (stack.length) {
      const q = stack.pop(), x = q % W, y = (q / W) | 0;
      for (const [dx, dy] of RING) {
        if (dx && dy) continue; // straight neighbours only
        const k = (y + dy) * W + x + dx;
        if (here(x + dx, y + dy) && !seen[k]) { seen[k] = 1; stack.push(k); count++; }
      }
    }
    return count === left - 1;
  };
  for (const sq of info.ranked) {
    if (!present[sq] || used[sq]) continue;
    const x = sq % W, y = (sq / W) | 0;
    if (here(x + 1, y) && here(x - 1, y) && here(x, y + 1) && here(x, y - 1)) continue; // not on the edge
    if (staysWhole(sq)) { s.shrunk.push(sq); return; }
  }
}

/** What happens once a whole move is over: on shrinking ground, every few
    moves the edge falls away. Mutates. */
function afterMove(n) {
  const r = n.day.rules;
  if (r.shrink && !n.won && !lost(n) && n.t % (r.shrinkEvery || 2) === 0) shrinkStep(n);
}

/** The square that will fall next if the edge fell now, for drawing it
    faintly ahead of time. Null when nothing would. */
export function nextShrink(s) {
  if (!s.day.rules.shrink) return null;
  const c = clone(s);
  shrinkStep(c);
  return c.shrunk.length > s.shrunk.length ? c.shrunk[c.shrunk.length - 1] : null;
}

/** Your move, then theirs. Returns a new state. */
export function apply(s, mv) {
  const n = playerMove(s, mv);
  if (!n.won) foesAct(n);
  n.t++;
  afterMove(n);
  return n;
}

/** Just their reply to a move you already made with playerMove(). The same
    as the second half of apply(), split out so a page can show your move
    before they finish thinking. */
export function respond(n) {
  const c = clone(n);
  if (!c.won) foesAct(c);
  c.t++;
  afterMove(c);
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
  // Which squares are gone matters; the order they went in does not.
  if (s.gone.length) k += '|g' + s.gone.slice().sort((a, b) => a - b).join(',');
  if (s.shrunk?.length) k += '|s' + s.shrunk.slice().sort((a, b) => a - b).join(',');
  // On a geared board the same position facing another way is not the same.
  if (s.day.rules.geared) k += '|r' + turns(s);
  return k;
}

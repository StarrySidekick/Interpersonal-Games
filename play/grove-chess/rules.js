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
import { betzaMoves, rideVecs } from './betza.js';
import { CONFIG } from './config.js';

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

/** Is there a statue on square sq? A statue row (2026-10-12) opens one
    statue a turn, so a statue that has opened is gone. */
export const statueAt = (s, sq) => s.day.stumps.has(sq) && !(s.open?.length > 0 && s.open.includes(sq));

// --- Neutral pieces (Timothy, 2026-10-13): ghosts, gates and wandering
// clouds, beside statues (which can now be taken). None belongs to a side's
// army; ghosts belong to a side but never move.

/** Whose ghost stands on square sq, 'you' or 'foe', or null. A ghost goes
    for good once a piece of its own side passes through or onto it. */
export const ghostAt = (s, sq) => (s.day.ghosts?.size ? (s.ghostGone?.includes(sq) ? null : s.day.ghosts.get(sq) || null) : null);

/** Is the gate on square sq up? Gates swap every turn; one with anything
    standing on it stays down until it is left. */
export function gateUp(s, sq) {
  const g = s.day.gates?.get(sq);
  if (g == null || (s.t + g) % 2 === 0) return false;
  const x = sq % s.day.W, y = Math.floor(sq / s.day.W), on = (q) => !q.taken && !q.flying && q.x === x && q.y === y;
  return !s.pieces.some(on) && !s.foes.some(on);
}

/** Golf's hazards (Timothy, 2026-10-13: "there can be obstacles like gates
    and clouds and various things of that nature"). Sand: a hit ball stops
    dead in it; pieces cross it as ground. Water: no piece crosses it or
    stands in it, and a ball that rolls in goes back to the tee (if the tee
    is taken, it stops at the water's edge). */
export const sandAt = (s, sq) => !!s.day.sand?.has(sq);
export const waterAt = (s, sq) => !!s.day.water?.has(sq);
export const SAND_DESC = 'Sand: a ball hit into it stops dead there. Your pieces cross it like grass.';
export const WATER_DESC = 'Water: nothing of yours can cross it or stand in it, and a ball that rolls in goes back to the tee, where it started the hole (if something stands there, it stops at the water\u2019s edge).';

/** Is a wandering cloud over square sq? */
export const cloudOver = (s, sq) => s.clouds?.length > 0 && s.clouds.some((c) => c.y * s.day.W + c.x === sq);

/** The other side's pieces that `side` cannot see: those under a cloud.
    Indexes into s.foes (for 'you') or s.pieces (for 'foe'). */
export function hiddenFrom(s, side) {
  const out = new Set();
  if (!s.clouds?.length) return out;
  (side === 'you' ? s.foes : s.pieces).forEach((p, i) => { if (!p.taken && !p.flying && cloudOver(s, p.y * s.day.W + p.x)) out.add(i); });
  return out;
}

/** The state as `side` sees it: the other side's pieces under clouds are
    taken off to one side (to -99, -99, where nothing reaches them and
    nothing is counted as lost). The same state when nothing is hidden.
    Kept on the state while its pieces have not moved. */
export function seenBy(s, side) {
  if (!s.clouds?.length) return s;
  const H = hiddenFrom(s, side);
  if (!H.size) return s;
  const sig = posSig(s), key = side === 'you' ? '_seenYou' : '_seenFoe';
  if (s[key]?.sig === sig) return s[key].v;
  const v = clone(s);
  for (const i of H) { const p = side === 'you' ? v.foes[i] : v.pieces[i]; p.x = -99; p.y = -99; p.hid = true; }
  Object.defineProperty(s, key, { value: { sig, v }, enumerable: false, configurable: true, writable: true });
  return v;
}
const posSig = (s) => s.pieces.map((p) => (p.taken ? '-' : `${p.x},${p.y}`)).join(';') + '|' + s.foes.map((f) => (f.taken ? '-' : `${f.x},${f.y}`)).join(';') + '|' + s.clouds.map((c) => `${c.x},${c.y}`).join(';') + '|' + (s.bonus ? s.bonus.p : '') + s.t;

/** The squares strictly between two on a straight line or diagonal (a
    knight's L has none: it leaps). */
function between(W, fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy, g = gcd(Math.abs(dx), Math.abs(dy)) || 1, out = [];
  for (let i = 1; i < g; i++) out.push((fy + (dy / g) * i) * W + fx + (dx / g) * i);
  return out;
}

/** Where a move really ends when the mover could not see everything: the
    first square on its way, or its landing square, where a piece of the
    other side hides under a cloud. It stops there and takes it (2026-10-13:
    a cloud hides pieces, so anything that runs into one takes it). */
function contact(s, side, p, m) {
  if (!s.clouds?.length || m.swap) return m;
  const hidden = hiddenFrom(s, side);
  if (!hidden.size) return m;
  const other = side === 'you' ? s.foes : s.pieces, W = s.day.W;
  const there = (sq) => [...hidden].some((j) => other[j].y * W + other[j].x === sq);
  if (!s.day.rules.wrap && !m.wrapped) for (const sq of between(W, p.x, p.y, m.x, m.y)) if (there(sq)) return { ...m, x: sq % W, y: Math.floor(sq / W), cap: true, bumped: true };
  return there(m.y * W + m.x) ? { ...m, cap: true, bumped: true } : m;
}

/** A piece of `side` moved from (fx, fy) to (tx, ty): its own ghosts on the
    way, and on the square it lands on, are gone for good. Mutates. */
function passGhosts(s, side, fx, fy, tx, ty, wrapped = false) {
  if (!s.day.ghosts?.size) return;
  const W = s.day.W;
  for (const sq of [...(s.day.rules.wrap || wrapped ? [] : between(W, fx, fy, tx, ty)), ty * W + tx])
    if (s.day.ghosts.get(sq) === side && !s.ghostGone.includes(sq)) { s.ghostGone.push(sq); s.ghostsLost = (s.ghostsLost || 0) + 1; }
}

/** A statue taken where a piece lands (statues can be taken, 2026-10-13). Mutates. */
function breakStatue(s, x, y) {
  const sq = y * s.day.W + x;
  if (s.day.rules.statuesTake && statueAt(s, sq)) { s.open = [...(s.open || []), sq]; s.broke = sq; }
}

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

// --- Weapons (Timothy, 2026-10-13). ----------------------------------------
// A piece may carry one weapon as well as one suit: p.weapon ('sword',
// 'lance' or 'mace') at level p.wl, 1 to 3. They change its moves (armed,
// below, for either side) and what a move does (armsBefore, armsAfter):
// - Sword: it no longer takes where it lands, so it cannot move onto
//   anything. It strikes round where it lands instead: the square in front
//   (1), and to each side (2), and diagonally in front (3). Front is toward
//   the other side.
// - Lance: only on a piece that slides. It takes what it slides through, up
//   to 1, 2 or 3 pieces, and lands on an empty square beyond; it no longer
//   takes where it lands either.
// - Mace: on a slide it may go on into what is in its way, pushing it ahead,
//   up to 1, 2 or 3 pieces in a row, one square for each square it goes on.
//   A piece of the other side it pushes is stunned; one that was stunned
//   already is taken. Its own side's pieces can be pushed, never stunned.
//   On a step or a leap it stuns what stands round where it lands: in front
//   and behind (1), and to each side (2), and on the diagonals (3). It still
//   takes where it lands.
// Stunned (p.stun): it cannot move on its side's next turn.
// A move carries what it does with it: `strike` and `pass` (squares taken),
// `push` ([{ from, to }], to -1 when the pushed piece is taken), `stun`.

const SWORD = { 1: [[0, 1]], 2: [[0, 1], [-1, 0], [1, 0]], 3: [[0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const MACE = { 1: [[0, 1], [0, -1]], 2: [[0, 1], [0, -1], [-1, 0], [1, 0]], 3: [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]] };
export const WEAPON_KINDS = ['sword', 'lance', 'mace'];

const rideCache = new Map();
/** The directions piece type t slides in, for a side moving `fwd`. */
function slideVecs(t, fwd) {
  const k = `${t}|${fwd}|${PIECES[t]?.betza}`;
  if (!rideCache.has(k)) rideCache.set(k, PIECES[t]?.betza ? rideVecs(PIECES[t].betza, fwd) : []);
  return rideCache.get(k);
}
/** Does piece type t slide (so a lance suits it, and its mace pushes)? */
export const slides = (t) => slideVecs(t, 1).length > 0;
/** Can piece type t carry weapon w? Any real piece can; a lance only one that slides. */
export const canArm = (t, w) => !!PIECES[t]?.betza && WEAPON_KINDS.includes(w) && (w !== 'lance' || slides(t));

/** The piece of the other side of `side` standing on square sq (not a rabbit
    riding a head, not a ball), or null. */
function enemyOn(s, side, sq) {
  const W = s.day.W, x = sq % W, y = (sq / W) | 0;
  return (side === 'you' ? s.foes : s.pieces).find((q) => !q.taken && !q.flying && q.rides == null && q.type !== 'ball' && q.x === x && q.y === y) || null;
}
/** The rabbit to capture is free on square sq. */
const flagFree = (s, sq) => !!s.flag && !s.flag.by && s.flag.y * s.day.W + s.flag.x === sq;
/** Is there something on sq that `side` could take: a piece of the other
    side, a statue that can be taken, or the free rabbit? */
const takeable = (s, side, sq) => !!enemyOn(s, side, sq) || (s.day.rules.statuesTake && statueAt(s, sq)) || flagFree(s, sq);

/** The squares a move takes on: where it lands, if it takes there; a
    sword's strikes; a lance's passes; a mace's pushes that take. */
export function capturesOf(m, W) {
  const out = m.cap ? [m.y * W + m.x] : [];
  if (m.strike) out.push(...m.strike);
  if (m.pass) out.push(...m.pass);
  if (m.push) for (const e of m.push) if (e.to < 0) out.push(e.from);
  return out;
}
/** Does this move take anything at all? */
export const takesAny = (m) => !!(m.cap || m.strike?.length || m.pass?.length || m.push?.some((e) => e.to < 0));

/** Piece p's moves as its weapon changes them, from `side`. */
function armed(s, p, side, ms) {
  const lv = Math.max(1, Math.min(3, p.wl || 1)), fwd = side === 'you' ? 1 : -1, W = s.day.W, L = sight(s, p, side), home = p.y * W + p.x;
  const sqOf = (x, y) => { const [a, b] = fold(s.day, x, y); return onBoard(s.day, a, b) ? b * W + a : -1; };
  const around = (m, pat) => pat.map(([dx, dy]) => sqOf(m.x + dx, m.y + dy * fwd)).filter((q) => q >= 0 && q !== home);
  if (p.weapon === 'sword') {
    return ms.filter((m) => m.swap || !m.cap).map((m) => {
      if (m.swap) return m;
      const strike = around(m, SWORD[lv]).filter((q) => takeable(s, side, q));
      return strike.length ? { ...m, strike } : m;
    });
  }
  const vecs = slideVecs(p.type, fwd);
  if (p.weapon === 'lance') {
    if (!vecs.length) return ms;
    const out = ms.filter((m) => m.swap || !m.cap), seen = new Set(out.map((m) => m.y * W + m.x));
    for (const [dx, dy] of vecs) {
      const pass = [];
      let x = p.x, y = p.y;
      for (let n = 0; n < MAX_SLIDE; n++) {
        x += dx; y += dy;
        const q = sqOf(x, y);
        if (q < 0 || q === home) break;
        const c = L(x, y);
        if (c === EMPTY) { if (pass.length && !seen.has(q)) { seen.add(q); out.push({ x: q % W, y: (q / W) | 0, cap: false, pass: pass.slice() }); } continue; }
        if (c === ENEMY && pass.length < lv && enemyOn(s, side, q)) { pass.push(q); continue; }
        break;
      }
    }
    return out;
  }
  if (p.weapon === 'mace') {
    const along = (m) => vecs.some(([dx, dy]) => {
      const ex = m.x - p.x, ey = m.y - p.y, k = dx ? ex / dx : ey / dy;
      return Number.isInteger(k) && k >= 1 && ex === k * dx && ey === k * dy;
    });
    const out = ms.map((m) => {
      if (m.swap || m.wrapped || along(m)) return m;
      const stun = around(m, MACE[lv]).filter((q) => enemyOn(s, side, q));
      return stun.length ? { ...m, stun } : m;
    });
    const seen = new Set(out.map((m) => m.y * W + m.x));
    for (const [dx, dy] of vecs) pushes(s, p, side, dx, dy, lv, out, seen);
    return out;
  }
  return ms;
}

/** A mace's slide along (dx, dy) that goes on into what is in its way,
    pushing up to lv pieces in a row ahead of it. Every square it could stop
    on is added to `out`, with what it pushed. A piece of the other side
    that was stunned before the move is taken when it is pushed; the rest go
    one square on for each square the mace goes on, and need open ground to
    go onto (not the edge, a statue, a ghost, a raised gate or the hole). */
function pushes(s, p, side, dx, dy, lv, out, seen) {
  const W = s.day.W, home = p.y * W + p.x, own = side === 'you' ? s.pieces : s.foes, line = [];
  let x = p.x, y = p.y;
  for (let n = 0; n < MAX_SLIDE; n++) {
    x += dx; y += dy;
    const [a, b] = fold(s.day, x, y), q = b * W + a;
    if (!onBoard(s.day, a, b) || q === home) break;
    const mine = own.find((o) => !o.taken && !o.flying && o.rides == null && o.type !== 'ball' && o.x === a && o.y === b), theirs = enemyOn(s, side, q);
    if (mine || theirs) { line.push({ q, piece: { from: q, own: !!mine, stunned: !!(theirs && theirs.stun) } }); continue; }
    const c = look(s, a, b, side);
    line.push({ q, walk: c === EMPTY, open: c === EMPTY && !ghostAt(s, q) && !flagFree(s, q) });
    if (c !== EMPTY) break;
  }
  const at = line.map((c) => c.piece || null), log = new Map();
  for (let k = 0; k < line.length; k++) {
    if (at[k]) {
      let j = k;
      while (j < line.length && at[j]) j++;
      if (j - k > lv || j >= line.length || !line[j].open) return;
      for (let i = j - 1; i >= k; i--) {
        const c = at[i];
        at[i] = null;
        if (!c.own && c.stunned) log.set(c.from, -1);
        else { at[i + 1] = c; log.set(c.from, line[i + 1].q); }
      }
    } else if (!line[k].walk) return;
    if (!log.size) continue; // nothing pushed yet: an ordinary move, already listed
    const q = line[k].q;
    if (seen.has(q)) continue;
    seen.add(q);
    out.push({ x: q % W, y: (q / W) | 0, cap: false, push: [...log].map(([from, to]) => ({ from, to })) });
  }
}

/** What a weapon does before its piece lands: a lance takes what it passed
    through, a mace pushes. Mutates; returns how many it took. */
function armsBefore(n, side, i, m) {
  let took = 0;
  for (const q of m.pass || []) if (takeAt(n, side, i, q)) took++;
  if (m.push?.length) {
    const W = n.day.W, all = [...n.pieces.map((q) => ['you', q]), ...n.foes.map((q) => ['foe', q])];
    const moving = m.push.map((e) => ({ e, hit: all.find(([, q]) => !q.taken && !q.flying && q.rides == null && q.type !== 'ball' && q.y * W + q.x === e.from) }));
    for (const { e, hit } of moving) {
      if (!hit) continue;
      const [who, q] = hit;
      if (e.to < 0) { if (takeAt(n, side, i, e.from)) took++; continue; }
      const list = who === 'you' ? n.pieces : n.foes, j = list.indexOf(q), tx = e.to % W, ty = (e.to / W) | 0;
      q.from = [q.x, q.y]; q.x = tx; q.y = ty; q.pushed = true;
      list.forEach((r) => { if (!r.taken && r.rides === j) { r.x = tx; r.y = ty; } });
      if (who !== side) q.stun = true;
    }
  }
  return took;
}

/** What a weapon does once its piece has landed: a sword strikes, a mace
    on a step or a leap stuns. Mutates; returns how many it took. */
function armsAfter(n, side, i, m) {
  let took = 0;
  for (const q of m.strike || []) if (takeAt(n, side, i, q)) took++;
  for (const q of m.stun || []) { const e = enemyOn(n, side, q); if (e) e.stun = true; }
  return took;
}

/** Side `side`'s piece i takes whatever stands on square sq, away from where
    it lands (a weapon). Mutates; returns true if it took something. */
function takeAt(n, side, i, sq) {
  const e = enemyOn(n, side, sq);
  if (e) { if (side === 'you') captureFoe(n, e, i); else capturePiece(n, e, i); return true; }
  if (n.day.rules.statuesTake && statueAt(n, sq)) { n.open = [...(n.open || []), sq]; n.broke = sq; return true; }
  if (flagFree(n, sq)) { n.flag.by = side; n.flag.i = i; return true; }
  return false;
}

/** Your piece p is taken by their piece k (k -1: by nothing in particular).
    The rabbit to capture, if p carried it, goes to the taker. Hearts: a
    life more sends it home instead (respawn). Anything riding on it is
    taken with it. Mutates; true if it is gone. */
function capturePiece(s, p, k) {
  const i = s.pieces.indexOf(p), x = p.x, y = p.y;
  if (s.flag?.by === 'you' && s.flag.i === i) { if (k >= 0) { s.flag.by = 'foe'; s.flag.i = k; } else { s.flag.by = null; s.flag.x = x; s.flag.y = y; } }
  if ((p.lives || 1) > 1) { p.lives--; p.reviving = true; return false; }
  p.taken = true;
  s.pieces.forEach((q) => { if (!q.taken && q.x === x && q.y === y) q.taken = true; });
  return true;
}
/** Their piece f is taken by your piece i: the same, the other way. Taking
    it may win. Mutates; true if it is gone. */
function captureFoe(n, f, i) {
  const k = n.foes.indexOf(f), x = f.x, y = f.y;
  if (n.flag?.by === 'foe' && n.flag.i === k) { if (i >= 0) { n.flag.by = 'you'; n.flag.i = i; } else { n.flag.by = null; n.flag.x = x; n.flag.y = y; } }
  if ((f.lives || 1) > 1) { f.lives--; f.reviving = true; return false; }
  f.taken = true;
  n.foes.forEach((q) => { if (!q.taken && q.x === x && q.y === y) q.taken = true; });
  if (goalMet(n)) n.won = true;
  return true;
}

/**
 * Hearts (Timothy, 2026-10-13: "extra life, when hit placed in first row in
 * space of choice, if no slot present pick from second row, and so on").
 * A piece taken with a life to spare goes back to its own side's first row,
 * on a free square, or the second row if the first is full, and so on. The
 * squares it could go to are kept (s.revived) so you can choose among them
 * for one of yours (placeRevived); it starts on the one nearest the middle.
 * Mutates.
 */
function settleRevivals(s) {
  for (const [side, list] of [['you', s.pieces], ['foe', s.foes]]) list.forEach((p, i) => {
    if (!p.reviving) return;
    delete p.reviving;
    const options = homeSquares(s, side, p), W = s.day.W;
    if (!options.length) { p.taken = true; list.forEach((q) => { if (!q.taken && q.rides === i) q.taken = true; }); if (side === 'foe' && goalMet(s)) s.won = true; return; }
    const from = [p.x, p.y], q = options[0];
    p.from = from; p.x = q % W; p.y = (q / W) | 0;
    list.forEach((r) => { if (!r.taken && r.rides === i) { r.x = p.x; r.y = p.y; } });
    s.revived = { side, i, options, from };
  });
}
/** Free squares on side's first row, or the first row from its end with any:
    nearest the middle first. */
function homeSquares(s, side, p) {
  const W = s.day.W, H = s.day.H;
  for (let r = 0; r < H; r++) {
    const y = side === 'you' ? r : H - 1 - r, row = [];
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      if (!onBoard(s.day, x, y) || crumbled(s, x, y) || shrunk(s, x, y) || statueAt(s, q) || s.day.ghosts?.get(q) || (s.day.gates?.size && gateUp(s, q))) continue;
      if (s.hole && s.hole.x === x && s.hole.y === y) continue;
      if (flagFree(s, q)) continue;
      if ([...s.pieces, ...s.foes].some((o) => o !== p && !o.taken && !o.flying && o.x === x && o.y === y)) continue;
      row.push(q);
    }
    if (row.length) return row.sort((a, b) => Math.abs((a % W) - (W - 1) / 2) - Math.abs((b % W) - (W - 1) / 2) || a - b);
  }
  return [];
}
/** Put your piece that came back from a heart on another of its squares.
    A new state; the same one if that is not one of its squares. */
export function placeRevived(s, sq) {
  const r = s.revived;
  if (!r || r.side !== 'you' || !r.options.includes(sq)) return s;
  const n = clone(s), W = s.day.W, p = n.pieces[r.i];
  p.x = sq % W; p.y = (sq / W) | 0;
  n.pieces.forEach((q) => { if (!q.taken && q.rides === r.i) { q.x = p.x; q.y = p.y; } });
  n.revived = { ...r, placed: sq };
  return n;
}

/** Pawns in the descent (Timothy, 2026-10-13: they "can turn into any
    duplicate of any one of your other pieces on the board when they reach
    the other side"): a pawn's move onto the far row is one move for each
    kind of piece its side has on the board (not a pawn, not the King), and
    it becomes that kind. None to copy: it stays a pawn. */
function promoteChoices(s, side, i, ms) {
  const list = side === 'you' ? s.pieces : s.foes, last = side === 'you' ? s.day.H - 1 : 0;
  const kinds = [...new Set(list.filter((q, j) => j !== i && !q.taken && !q.flying && q.rides == null && q.x >= 0 && !['pawn', 'king', 'bunny', 'ball', 'rabbit'].includes(q.type)).map((q) => q.type))]
    .sort((a, b) => (PIECES[b].strength ?? 0) - (PIECES[a].strength ?? 0));
  if (!kinds.length) return ms;
  return ms.flatMap((m) => (m.y === last && !m.swap ? kinds.map((t) => ({ ...m, promote: t })) : [m]));
}
/** Becoming what it promotes into; a lance goes if it no longer slides. */
function promoteTo(p, t) {
  p.type = t; p.promoted = true;
  if (p.weapon && !canArm(t, p.weapon)) { delete p.weapon; delete p.wl; }
}

/** The rabbit to capture (goal 'flag'): where it is, on the ground or on the
    head of whoever carries it. */
export function flagAt(s) {
  if (!s.flag) return null;
  if (!s.flag.by) return { x: s.flag.x, y: s.flag.y, by: null };
  const p = (s.flag.by === 'you' ? s.pieces : s.foes)[s.flag.i];
  return p && !p.taken ? { x: p.x, y: p.y, by: s.flag.by, i: s.flag.i } : { x: s.flag.x, y: s.flag.y, by: null };
}
/** Carried home, the rabbit wins: yours on your first row, theirs on theirs. */
function flagHome(s) {
  const f = flagAt(s);
  if (!f?.by) return;
  if (f.by === 'you' && f.y === 0) s.won = true;
  if (f.by === 'foe' && f.y === s.day.H - 1) s.flagLost = true;
}

/** The rabbit that rides one side's pieces (goal 'carrier', 2026-10-13):
    it hops from the piece it is on to another of that side's, at random. */
export const carrierOf = (s, side) => (side === 'you' ? s.pieces : s.foes).find((q) => q.brain === 'carrier' && !q.taken) || null;
function carrierHop(s, side) {
  const list = side === 'you' ? s.pieces : s.foes, r = list.find((q) => q.brain === 'carrier' && !q.taken);
  if (!r) return;
  const at = list.map((q, j) => j).filter((j) => j !== r.rides && list[j] !== r && !list[j].taken && !list[j].flying && list[j].rides == null && !['bunny', 'ball'].includes(list[j].type) && list[j].x >= 0);
  if (!at.length) return;
  const j = at[Math.floor(hash01(`rabbit:${s.day.seed ?? 0}:${s.t}:${side}`) * at.length)];
  r.from = [r.x, r.y]; r.x = list[j].x; r.y = list[j].y; r.rides = j; r.hopped = true;
}
/** How many more of your moves until the riding rabbits hop. */
export function hopIn(s) {
  const n = s.day.rules.rabbitHop;
  return s.day.rules.goal === 'carrier' && n > 0 ? n - (s.t % n) : null;
}

/** A spirals piece sees the board with its left and right edges joined
    (wrapView): the state as that piece's moves are listed. */
const wrapView = (s) => ({ ...s, day: { ...s.day, rules: { ...s.day.rules, wrap: 'sides' } } });

// Where everything stands, square by square, for one state while its moves
// are listed (2026-10-13, for speed: look() otherwise searches both sides'
// lists for every square it is asked about, which was a third of the bots'
// time). Built by withGrid, used by look() for that state only; a state is
// never changed while its moves are being listed. 0 is empty, i + 1 a piece
// of yours, -(k + 1) one of theirs: the first in each list, as the search
// below finds them.
let gridFor = null, grid = null;
function buildGrid(s) {
  const W = s.day.W, H = s.day.H, g = new Int16Array(W * H);
  s.pieces.forEach((p, i) => { if (!p.taken && p.x >= 0 && p.y >= 0 && p.x < W && p.y < H && !g[p.y * W + p.x]) g[p.y * W + p.x] = i + 1; });
  s.foes.forEach((f, k) => { if (!f.taken && f.x >= 0 && f.y >= 0 && f.x < W && f.y < H && !g[f.y * W + f.x]) g[f.y * W + f.x] = -(k + 1); });
  return g;
}
/** Run fn with state s's grid in place. */
export function withGrid(s, fn) {
  if (gridFor === s) return fn();
  const pf = gridFor, pg = grid;
  gridFor = s; grid = buildGrid(s);
  try { return fn(); } finally { gridFor = pf; grid = pg; }
}

/** What is on (x, y), as seen by `side` ('you' or 'foe'). */
export function look(s, x, y, side = 'you') {
  if (s.day.rules.wrap) [x, y] = fold(s.day, x, y);
  if (!onBoard(s.day, x, y) || crumbled(s, x, y) || shrunk(s, x, y)) return OFF;
  // The cloud (2026-10-10): for the first turn each side's second row is
  // under a cloud. Nothing passes through it and nothing in it can be taken:
  // here it reads as the edge of the world, so sliders stop, leapers cannot
  // land, and hoppers find nothing to hop. A piece may still step into an
  // empty square of it (pieceMoves asks again with `openCloud`).
  if (s.cloudy && cloudFor(s, side)?.has(y * s.day.W + x)) {
    const empty = !s.pieces.some((p) => !p.taken && p.x === x && p.y === y) && !s.foes.some((f) => !f.taken && f.x === x && f.y === y)
      && !statueAt(s, y * s.day.W + x) && !(s.hole && s.hole.x === x && s.hole.y === y);
    if (!(openCloud && empty)) return OFF;
  }
  const bram = isBramble(s, x, y);
  if (gridFor === s) {
    const v = grid[y * s.day.W + x];
    if (v > 0) return s.pieces[v - 1].type === 'ball' && s.day.rules.ballMove === 'hit' ? ENEMY : side === 'you' ? OWN : bram ? HIDDEN : ENEMY;
    if (v < 0) return side === 'foe' ? OWN : bram ? HIDDEN : ENEMY;
  } else for (const p of s.pieces)
    if (!p.taken && p.x === x && p.y === y) {
      // A ball that is hit (ballMove 'hit') is something either side can
      // move into: the move generators see it as a catch, and landing on it
      // knocks it on instead (knock, below).
      if (p.type === 'ball' && s.day.rules.ballMove === 'hit') return ENEMY;
      return side === 'you' ? OWN : bram ? HIDDEN : ENEMY;
    }
  if (gridFor !== s) for (const f of s.foes)
    if (!f.taken && f.x === x && f.y === y) return side === 'foe' ? OWN : bram ? HIDDEN : ENEMY;
  // The rabbit to capture (goal 'flag', 2026-10-13), while nobody carries
  // it: something either side can take.
  if (s.flag && !s.flag.by && s.flag.x === x && s.flag.y === y) return ENEMY;
  if (s.hole && s.hole.x === x && s.hole.y === y && holeOpen(s)) return HOLE;
  const sq = y * s.day.W + x;
  // A statue that can be taken reads as something to take, to either side
  // (not to a ball, which only stops at it).
  if (statueAt(s, sq)) return s.day.rules.statuesTake && !ballView ? ENEMY : STUMP;
  // A ghost: open ground to its own side, a wall to the other.
  const ghost = ghostAt(s, sq);
  if (ghost) return ghost === side ? EMPTY : STUMP;
  // A gate that is up: nothing passes and nothing stands there.
  if (s.day.gates?.size && gateUp(s, sq)) return OFF;
  // Water (golf): nothing passes or stands there either.
  if (s.day.water?.has(sq)) return OFF;
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

// Every loop that slides is capped at 64 steps: no real slide is longer
// (a lap of a magic board is under 20), and a mistake somewhere can then
// never freeze a phone in an endless loop.
const MAX_SLIDE = 64;

function ride(L, p, vecs, out = []) {
  for (const [dx, dy] of vecs) {
    let x = p.x + dx, y = p.y + dy;
    for (let n = 0; n < MAX_SLIDE; n++) {
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
    for (let n = 0; n < MAX_SLIDE && L(x, y) === EMPTY; n++) { x += dx; y += dy; }
    if (L(x, y) === OFF || L(x, y) === EMPTY) continue; // nothing to hop over
    const c = L(x + dx, y + dy);
    if (c === EMPTY || c === ENEMY) out.push({ x: x + dx, y: y + dy, cap: c === ENEMY });
  }
  return out;
}

function cannon(L, p) {
  const out = [];
  for (const [dx, dy] of ORTH) {
    let x = p.x + dx, y = p.y + dy;
    for (let n = 0; n < MAX_SLIDE && L(x, y) === EMPTY; n++) { out.push({ x, y, cap: false }); x += dx; y += dy; }
    if (L(x, y) === OFF || L(x, y) === EMPTY) continue;
    x += dx; y += dy; // over the screen
    for (let n = 0; n < MAX_SLIDE && L(x, y) === EMPTY; n++) { x += dx; y += dy; }
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
  if (how === 'sticky' || how === 'ghost') return oddBall(L, p, day, how);
  const out = [], dropsIn = !day?.rules?.ballStops, takes = !!day?.rules?.ballCaptures;
  for (const [dx, dy] of ORTH) {
    let x = p.x, y = p.y, onHole = false, cap = false;
    for (let n = 0; n < MAX_SLIDE; n++) {
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

/** Two balls for golf (2026-10-08). Both roll up, down, left or right
    like a ball on ice. Sticky: it stops on the first square beside anything
    (a piece of either side, a statue) that it rolls past. Ghost: it rolls
    straight through pieces and statues, and stops only at the edge, a gap
    or the hole; if it would end on something, it stops on the last empty
    square before. Both drop into an open hole they roll over. */
function oddBall(L, p, day, how) {
  const out = [], dropsIn = !day?.rules?.ballStops;
  const solid = (c) => c !== EMPTY && c !== HOLE && c !== OFF;
  for (const [dx, dy] of ORTH) {
    let x = p.x, y = p.y, onHole = false, lastFree = null;
    for (let step = 0; step < 64; step++) {
      const c = L(x + dx, y + dy);
      if (how === 'sticky') {
        if (c !== EMPTY && c !== HOLE) break;
        x += dx; y += dy; onHole = c === HOLE;
        if (onHole && dropsIn) break;
        // Beside anything (not itself, not behind it): it sticks.
        if (ALL8.some(([ax, ay]) => !(ax === -dx && ay === -dy) && solid(L(x + ax, y + ay)))) break;
      } else {
        if (c === OFF) break;
        x += dx; y += dy;
        if (c === EMPTY || c === HOLE) { lastFree = [x, y]; onHole = c === HOLE; if (onHole && dropsIn) break; }
        else onHole = false;
      }
    }
    if (how === 'ghost') { if (!lastFree) continue; [x, y] = lastFree; }
    if (day?.rules?.wrap) { const [nx, ny] = fold(day, x, y); if (nx === p.x && ny === p.y) continue; }
    if (x !== p.x || y !== p.y) out.push({ x, y, cap: false, sink: onHole });
  }
  return out;
}

/** The putting ball: a rook that never takes. Past an open hole it cannot
    go (it would drop in), unless the level says it must stop on it. */
function putt(L, p, day) {
  const out = [], dropsIn = !day?.rules?.ballStops, takes = !!day?.rules?.ballCaptures;
  for (const [dx, dy] of ORTH)
    for (let x = p.x + dx, y = p.y + dy, n = 0; n < MAX_SLIDE; x += dx, y += dy, n++) {
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

/** The rabbit's two hops: a square in any direction, then another, onto
    empty squares or the heads of its own side's pieces; never a capture,
    never back where it started. (pieceMoves0 also keeps it off a head that
    already has a rider.) */
function bunnyHops(L, p) {
  const out = new Map(), ok = (c) => c === EMPTY || c === OWN;
  for (const [ax, ay] of ALL8) {
    const x1 = p.x + ax, y1 = p.y + ay;
    if (!ok(L(x1, y1))) continue;
    for (const [bx, by] of ALL8) {
      const x2 = x1 + bx, y2 = y1 + by;
      if ((x2 === p.x && y2 === p.y) || !ok(L(x2, y2))) continue;
      out.set(`${x2},${y2}`, { x: x2, y: y2, cap: false });
    }
  }
  return [...out.values()];
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

  // --- Added 2026-10-10, made from their Betza notation alone. Smaller and
  // stranger move sets (Timothy: "more fairy chess pieces that represent
  // smaller kinds of move sets ... even more unconventional"). Each keeps
  // its real fairy chess name as its record; the name the game shows can
  // be changed in config.js (the settings console).
  gold: { name: 'Gold general', kind: 'fairy', tier: 0, value: 3, betza: 'WfF', strength: 3,
    desc: 'Steps one square straight in any direction, or one square diagonally forward. It cannot step diagonally back.',
    origin: 'From shogi, Japanese chess.',
    moves: betzaMoves('WfF') },
  copper: { name: 'Copper general', kind: 'fairy', tier: 0, value: 2, betza: 'vWfF', strength: 2,
    desc: 'Steps one square straight forward or straight back, or one square diagonally forward. Never sideways.',
    origin: 'From chu shogi, the larger shogi of medieval Japan.',
    moves: betzaMoves('vWfF') },
  leopard: { name: 'Ferocious leopard', kind: 'fairy', tier: 0, value: 2.75, betza: 'FvW', strength: 2.75,
    desc: 'Steps one square in any direction but sideways.',
    origin: 'From chu shogi.',
    moves: betzaMoves('FvW') },
  tiger: { name: 'Blind tiger', kind: 'fairy', tier: 0, value: 2.75, betza: 'FsbW', strength: 2.75,
    desc: 'Steps one square in any direction but straight forward.',
    origin: 'From chu shogi, where it cannot see what is in front of it.',
    moves: betzaMoves('FsbW') },
  kirin: { name: 'Kirin', kind: 'fairy', tier: 0, value: 2.5, betza: 'FD', strength: 2.5,
    desc: 'Steps one square diagonally, or leaps exactly two squares straight, over anything.',
    origin: 'From chu shogi, named for the kirin, a beast of East Asian legend.',
    moves: betzaMoves('FD') },
  phoenix: { name: 'Phoenix', kind: 'fairy', tier: 0, value: 2.75, betza: 'WA', strength: 2.75,
    desc: 'Steps one square straight, or leaps exactly two squares diagonally, over anything.',
    origin: 'From chu shogi.',
    moves: betzaMoves('WA') },
  elephant: { name: 'Elephant', kind: 'fairy', tier: 0, value: 2.25, betza: 'FA', strength: 2.25,
    desc: 'Goes one or two squares diagonally, leaping over anything on the way.',
    origin: 'The ferz and alfil together, the elephant of several modern variants (sometimes called the modern elephant).',
    moves: betzaMoves('FA') },
  woody: { name: 'Woody rook', kind: 'fairy', tier: 0, value: 2.75, betza: 'WD', strength: 2.75,
    desc: 'Steps one square straight, or leaps exactly two squares straight, over anything. A rook that cannot go far.',
    origin: 'The wazir and dabbaba together, a short-range rook from Ralph Betza\u2019s Chess with Different Armies.',
    moves: betzaMoves('WD') },
  alibaba: { name: 'Alibaba', kind: 'fairy', tier: 0, value: 2.5, betza: 'AD', strength: 2.5,
    desc: 'Leaps exactly two squares in any of the eight directions, over anything, and never anywhere nearer.',
    origin: 'The alfil and dabbaba together, named in fairy chess catalogues.',
    moves: betzaMoves('AD') },
  threeleaper: { name: 'Threeleaper', kind: 'fairy', tier: 0, value: 1.25, betza: 'H', strength: 1.25,
    desc: 'Leaps exactly three squares up, down, left or right, over anything.',
    origin: 'A plain leaper of fairy chess problems, the (3,0) jump.',
    moves: betzaMoves('H') },
  tripper: { name: 'Tripper', kind: 'fairy', tier: 0, value: 1, betza: 'G', strength: 1,
    desc: 'Leaps exactly three squares diagonally, over anything.',
    origin: 'A plain leaper of fairy chess problems, the (3,3) jump.',
    moves: betzaMoves('G') },
  frog: { name: 'Frog', kind: 'fairy', tier: 0, value: 2.25, betza: 'FH', strength: 2.25,
    desc: 'Steps one square diagonally, or leaps exactly three squares straight, over anything.',
    origin: 'The ferz and threeleaper together, named in fairy chess catalogues.',
    moves: betzaMoves('FH') },
  vao: { name: 'Vao', kind: 'fairy', tier: 1, value: 2.5, betza: 'mBcpB', strength: 2.5,
    desc: 'Slides like a bishop, but can only catch by jumping exactly one thing on the way.',
    origin: 'The cannon (pao) of xiangqi turned diagonal, from 20th-century variants.',
    moves: betzaMoves('mBcpB') },

  // --- Added 2026-10-13, Timothy's names: "short rook: slides fully left and
  // right but only moves one space up and down; tall rook: slide fully up and
  // down but only moves one space left and right". Both are real pieces of
  // chu shogi, kept as their records. Up and down are the same both ways, so
  // they play the same for either side.
  shortrook: { name: 'Short rook', record: 'Side mover', kind: 'fairy', tier: 1, value: 3, betza: 'sRvW', strength: 3,
    desc: 'Slides any distance left or right, and steps one square up or down.',
    origin: 'The side mover (ōgyō) of chu shogi, the larger shogi of medieval Japan.',
    moves: betzaMoves('sRvW') },
  tallrook: { name: 'Tall rook', record: 'Vertical mover', kind: 'fairy', tier: 1, value: 3.5, betza: 'vRsW', strength: 3.5,
    desc: 'Slides any distance up or down, and steps one square left or right.',
    origin: 'The vertical mover (kengyō) of chu shogi, the larger shogi of medieval Japan.',
    moves: betzaMoves('vRsW') },

  // --- Added 2026-10-11: the rabbit as a chess piece (Timothy: "rabbits are
  // now a fairy chess piece (same model) and function differently. they hop
  // twice in any direction each turn, cannot capture, and can hop onto other
  // pieces of their side's heads. taking the piece captures the rabbit. it
  // can be captured by itself as well"). No Betza: no notation lands on its
  // own side's pieces. The loose rabbits of the daily and golf (`rabbit`,
  // below) are a different thing and stay as they were.
  bunny: { name: 'Rabbit', kind: 'fairy', tier: 0, value: 1.5, betza: null, strength: 1.5,
    desc: 'Hops twice each turn: one square in any direction, then another, so it can turn a corner. It never takes anything. It can hop onto the head of a piece of its own side and ride there; taking that piece takes the rabbit too.',
    origin: 'Grove Chess\u2019s own, 2026.',
    moves: bunnyHops },

  // Only ever on their side. When it thinks (the AI brain) it moves like a
  // king; when it follows a pattern, the pattern decides.
  // Only ever yours, and only on ball-and-hole levels.
  ball: { name: 'Ball', kind: 'special', tier: 0, value: 2, betza: null, strength: null,
    desc: 'Rolls up, down, left or right until something stops it. Your other pieces make good walls. Get it into the hole to win.',
    moves: ball },

  rabbit: { name: 'Wild rabbit', kind: 'quarry', tier: 1, value: 3, betza: 'K', strength: null,
    desc: 'Steps one square in any direction.',
    moves: (L, p) => leap(L, p, ALL8) },

  // --- Neutral pieces (Timothy, 2026-10-13: "clouds and statues are now
  // neutral fairy pieces", with ghosts and gates). They are in the catalog,
  // with their rules, but never in anyone's army: a level places them
  // (lab.js), and the rules read them as parts of the board.
  ghost: { name: 'Ghost', kind: 'neutral', tier: 0, value: 0, betza: null, strength: null,
    desc: 'Never moves and never takes. Its own side moves through it as if it were not there, and once one of them passes through or onto it, it is gone for good. The other side cannot pass it or land on it, though a leaper can jump over. A row of them stands in front of each side, where pawns stand in chess.',
    origin: 'Grove Chess’s own, 2026.', moves: () => [] },
  statue: { name: 'Statue', kind: 'neutral', tier: 0, value: 0, betza: null, strength: null,
    desc: 'A standing stone with a spiral cut in it. It never moves and does nothing, and it belongs to nobody. Sliders stop at it; leapers and hoppers go over it. Either side can take it, and then it is gone.',
    origin: 'Grove Chess’s own, 2026: tree stumps first, statues from 2026-10-07.', moves: () => [] },
  cloud: { name: 'Cloud', kind: 'neutral', tier: 0, value: 0, betza: null, strength: null,
    desc: 'Drifts one square a turn, any way, on its own, over anything. A piece under a cloud is hidden from the other side, and so is its move into the cloud. A move that runs into a hidden piece stops there and takes it.',
    origin: 'Grove Chess’s own, 2026. Hidden pieces are the oldest idea in chess variants of secrecy: Kriegspiel (1899) hides the whole other side.', moves: () => [] },
  gate: { name: 'Gate', kind: 'neutral', tier: 0, value: 0, betza: null, strength: null,
    desc: 'Up one turn and down the next. Down, it is open ground; up, nothing passes it and nothing can stand there. With a piece on it, it stays down until the piece leaves.',
    origin: 'Grove Chess’s own, 2026.', moves: () => [] }
};

// Every piece's record: its real name, kept when the game calls it
// something else. Then Timothy's names and words from config.js.
// (A piece Timothy named himself keeps its fairy chess name as `record`.)
for (const k of Object.keys(PIECES)) PIECES[k].record = PIECES[k].record || PIECES[k].name;
for (const [k, o] of Object.entries(CONFIG.pieces || {})) {
  if (!PIECES[k] || !o) continue;
  if (typeof o.name === 'string' && o.name.trim()) PIECES[k].name = o.name.trim();
  if (typeof o.desc === 'string' && o.desc.trim()) PIECES[k].desc = o.desc.trim();
}

export const RABBIT_DESC = 'Hops in a fixed pattern that repeats. If it lands on one of your pieces, it eats it. It bounces off the edges, and if it cannot land where it is hopping, it waits a turn. Watch its tracks.';
export const RABBIT_GENTLE_DESC = 'Hops in a fixed pattern that repeats. It bounces off the edges, and if it cannot land where it is hopping (one of your pieces is in the way, say), it waits a turn. It does not eat. Watch its tracks.';
/** The rabbit's description for a level's rules: does it eat or not? */
export const rabbitDesc = (rules) => ((rules.rabbitsEat ?? rules.foesCapture) ? RABBIT_DESC : RABBIT_GENTLE_DESC);
export const RABBIT_AI_DESC = 'Thinks for itself and steps one square in any direction, like a king. It eats what it lands on.';
export const BRAMBLE_DESC = 'Creeps across the board. Nothing can enter it and nothing slides through it. Anything caught inside is safe until it leaves.';
export const GHOST_DESC = 'A ghost of {side}. It never moves and never takes. Its own side moves through it as if it were not there, and once one of them passes through or onto it, it is gone for good. The other side cannot pass it or land on it; a leaper can jump over it.';
export const GATE_DESC = 'A gate: up one turn and down the next. Down, it is open ground; up, nothing passes it and nothing can stand there. With a piece on it, it stays down until the piece leaves.';
export const WANDER_DESC = 'A cloud, drifting one square a turn on its own. A piece under it is hidden from the other side, and so is its move into the cloud. A move that runs into a hidden piece stops there and takes it. You see your own pieces under it. A ball hit into a cloud stops dead there.';
export const STATUE_TAKE_DESC = 'A statue: a standing stone with a spiral cut in it. It never moves and belongs to nobody. Sliders stop at it; leapers and hoppers go over it. Either side can take it, and then it is gone.';
/** A statue, in words, for this level's rules. */
export const statueDesc = (rules) => (rules?.statuesTake ? STATUE_TAKE_DESC : STUMP_DESC);
export const STATUE_ROW_DESC = 'Here the whole middle row is statues, and after every turn one of them, at random, sinks away and opens its square.';
export const STUMP_DESC = 'A statue: a standing stone with a spiral cut in it, older than the board. It never moves and nothing can take it. Sliders stop at it, leapers jump over it, and pieces that hop (the grasshopper, the cannon) can hop over it.';

/** The kind of piece a statue on square sq is a statue of. (The rules call
    statues stumps: they were tree stumps until 2026-10-07, and rule for
    rule they are the same thing.) */
const STATUE_KINDS = ['pawn', 'rook', 'knight', 'bishop', 'king', 'queen'];
export const statueKind = (day, sq) => day.statueKinds?.get(sq) ?? STATUE_KINDS[sq % STATUE_KINDS.length];
export const CLOUD_DESC = 'A cloud over the row in front of each side, for the first turn only. Your pieces move through your own cloud freely, but the other side\'s stops them: they can step into it, not past it, and nothing in it can be taken. The same goes for theirs. So nobody can take anything on the very first move. It lifts once both sides have moved.';
/** The words for a level's cloud: the old one stopped everyone. */
export const cloudDesc = (rules) => (rules?.cloudOwn ? CLOUD_DESC
  : 'A cloud over the second row on each side, for the first turn only. A piece can step into it but nothing goes through it, and nothing in it can be taken, so nobody can take anything on the very first move. It lifts once both sides have moved.');
export const CRUMBLE_DESC = 'Every square you move off crumbles away behind you. Nothing can stand on it again: sliders stop at the gap, leapers can still jump it, and a rabbit that tries to hop in waits instead.';
export const SHRINK_DESC = 'The edge of the board falls away. Every few moves one square on the rim drops into the dark for good, and the rim closes in. It never takes a square anything is standing on, never cuts the board in two, and stops when half the board is gone.';
/** On a level where the ball captures, the sentence that says so. */
const takesLine = (rules) => (rules?.ballCaptures ? ' Here the ball captures: rolling into one of their pieces, it takes it and stops there.' : '');

/** The ball, in words, for how it moves on this level (`ballMove`). */
export function ballDesc(rules) {
  const how = rules?.ballMove || 'ice';
  if (how === 'sticky') return 'Rolls up, down, left or right like a ball on ice, but it is sticky: it stops on the first square beside anything it rolls past, a piece of either side or a statue. Get it into the hole to win.';
  if (how === 'ghost') return 'Rolls up, down, left or right like a ball on ice, straight through pieces and statues, and stops only at the edge, a gap or the hole (on the last empty square, if it would end on something). Get it into the hole to win.';
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
    open: [], // statues of a statue row that have opened, in the order they went
    won: false
  };
  if (day.rules.cloud && day.cloud?.size) s.cloudy = true;
  // Neutral pieces (2026-10-13): the ghosts that have gone, and where the
  // wandering clouds are.
  if (day.ghosts?.size) s.ghostGone = [];
  if (day.clouds?.length) s.clouds = day.clouds.map((c) => ({ ...c }));
  // The rabbit to capture (goal 'flag'), on its square.
  if (day.flag) s.flag = { x: day.flag.x, y: day.flag.y, by: null, i: -1 };
  if (day.rules.first === 'them') { foesAct(s); s.opened = true; }
  return s;
}

export function clone(s) {
  return { day: s.day, t: s.t, pieces: s.pieces.map((p) => ({ ...p })), foes: s.foes.map((f) => ({ ...f })),
    hole: s.hole ? { ...s.hole } : null, gone: s.gone.slice(), shrunk: s.shrunk ? s.shrunk.slice() : [], open: s.open ? s.open.slice() : [], won: s.won, sunk: s.sunk,
    bonus: s.bonus || null, treasure: s.treasure || 0, foeTreasure: s.foeTreasure || 0, ft: s.ft || 0, ...(s.cloudy ? { cloudy: true } : {}),
    ...(s.ghostGone ? { ghostGone: s.ghostGone.slice(), ghostsLost: s.ghostsLost || 0 } : {}), ...(s.clouds ? { clouds: s.clouds.map((c) => ({ ...c })) } : {}),
    ...(s.flag ? { flag: { ...s.flag } } : {}), ...(s.flagLost ? { flagLost: true } : {}) };
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

/**
 * The cloud squares that stand in `side`'s way. Timothy, 2026-10-11: "the
 * clouds are to prevent opposing pieces from captures in the first turn, not
 * stopping your own pieces from moving past their own second row." So from
 * settings version 13 (`cloudOwn`) each side's cloud stops only the other
 * side: yours (the row in front of your pieces) stops theirs, and theirs
 * stops yours. Before that (the dailies of 2026-10-11) both clouds stopped
 * everyone.
 */
export function cloudFor(s, side) {
  if (!s.day.rules.cloudOwn) return s.day.cloud;
  return side === 'you' ? s.day.cloudFoe : s.day.cloudYou;
}

/** While true, look() lets an empty square under the cloud read as empty. */
let openCloud = false;
/** While true, look() is reading for a ball, which stops at statues. */
let ballView = false;

/** Piece p's moves, from `side`. Under the first-turn cloud: its moves with
    the cloud as a wall, plus any that end on an empty square of the cloud
    itself (stepping in is allowed; going through, or taking, is not). */
function pieceMoves(s, p, side) {
  const B = s.cloudy && !openCloud ? cloudFor(s, side) : null;
  if (!B?.size) return pieceMoves0(s, p, side);
  const out = pieceMoves0(s, p, side), seen = new Set(out.map((m) => m.y * s.day.W + m.x));
  openCloud = true;
  try {
    for (const m of pieceMoves0(s, p, side)) {
      const k = m.y * s.day.W + m.x;
      if (m.cap || !B.has(k) || seen.has(k) || throughCloud(B, s.day.W, p, m)) continue;
      seen.add(k); out.push(m);
    }
  } finally { openCloud = false; }
  return out;
}

/** Does the straight way from p to m cross a square of the cloud before
    it gets there? (A knight's L crosses no square; a slide crosses every
    square on its line.) */
function throughCloud(B, W, p, m) {
  const dx = m.x - p.x, dy = m.y - p.y, g = gcd(Math.abs(dx), Math.abs(dy)) || 1;
  for (let i = 1; i < g; i++) if (B.has((p.y + (dy / g) * i) * W + p.x + (dx / g) * i)) return true;
  return false;
}

/** Piece p's moves, from `side`, folded back onto a magic board. */
function pieceMoves0(s, p, side) {
  // Spirals (2026-10-13): this piece goes round the left and right edges,
  // as on a board whose sides join (Pac-Man's tunnel).
  if (p.suit === 'spirals' && !s.day.rules.wrap) return pieceMoves0(wrapView(s), p, side);
  let ms;
  if (p.type === 'ball') { ballView = true; try { ms = PIECES[p.type].moves(sight(s, p, side), p, 1, s.day); } finally { ballView = false; } }
  else ms = PIECES[p.type].moves(sight(s, p, side), p, side === 'you' ? 1 : -1, s.day);
  // A rabbit rides one piece at a time: not onto a rabbit, a ball, or a
  // head that already has a rider.
  if (p.type === 'bunny') {
    const own = side === 'you' ? s.pieces : s.foes;
    ms = ms.filter((m) => { const there = own.filter((q) => q !== p && !q.taken && q.x === m.x && q.y === m.y); return !there.length || (there.length === 1 && !['bunny', 'ball'].includes(there[0].type)); });
  }
  // Chess variants (2026-10-11): a pawn on its starting row may step two,
  // if both squares ahead are empty. (No en passant.)
  if (s.day.rules.pawnDouble && p.type === 'pawn') {
    const f = side === 'you' ? 1 : -1, L = sight(s, p, side);
    if (p.y === (f > 0 ? 1 : s.day.H - 2) && L(p.x, p.y + f) === EMPTY && L(p.x, p.y + 2 * f) === EMPTY) ms = [...ms, { x: p.x, y: p.y + 2 * f, cap: false }];
  }
  // Weapons (2026-10-13): a sword, a lance or a mace changes what its
  // moves do (armed, above).
  if (p.weapon && PIECES[p.type]?.betza) ms = armed(s, p, side, ms);
  if (!s.day.rules.wrap) return ms;
  const out = new Map();
  for (const m of ms) {
    const [x, y] = fold(s.day, m.x, m.y), k = y * s.day.W + x;
    if (!out.has(k)) out.set(k, { ...m, x, y, ...(x !== m.x || y !== m.y ? { wrapped: true } : {}) });
  }
  return [...out.values()];
}

export function movesFor(s, i) {
  // Under clouds (2026-10-13) you choose from what you can see.
  if (s.clouds?.length) { const v = seenBy(s, 'you'); if (v !== s) return withGrid(v, () => movesFor(v, i)); }
  const p = s.pieces[i];
  if (s.won || p.taken) return [];
  // A turn left open by a suit (below): only that piece moves, and after a
  // Vines capture only to take again.
  if (s.bonus && s.bonus.p !== i) return [];
  // Stunned by a mace (2026-10-13): it sits out this turn. A rabbit riding
  // your pieces (goal 'carrier') never moves by itself.
  if (p.stun || p.brain === 'carrier') return [];
  let ms = pieceMoves(s, p, 'you');
  if (s.day.rules.ballMove === 'hit') ms = ms.filter((m) => hitOk(s, p, m));
  if (s.bonus?.cap) return ms.filter(takesAny);
  if (s.day.rules.noCheck) ms = ms.filter((m) => !givesCheck(s, 'you', i, m));
  if (s.day.rules.promote === 'copy' && p.type === 'pawn') ms = promoteChoices(s, 'you', i, ms);
  // Gears (Spirals until 2026-10-13): it may trade squares with any other
  // piece of yours.
  if (p.suit === 'gears') {
    s.pieces.forEach((q, k) => { if (k !== i && !q.taken && q.type !== 'ball' && q.rides == null && q.brain !== 'carrier') ms.push({ x: q.x, y: q.y, cap: false, swap: true }); });
  }
  return ms;
}

const onFoe = (s, m) => s.foes.some((f) => !f.taken && f.x === m.x && f.y === m.y);

/*
 * The suits that are rules, not moves (Timothy, 2026-10-08; renamed and
 * changed 2026-10-13): Vines chain captures (after it takes a piece it may
 * take again, the same turn; until 2026-10-13 this was Swords), Stars moves
 * twice (once a level, its first move is followed by another), Gears swaps
 * (movesFor, above; it was Spirals), Spirals goes round the left and right
 * edges (pieceMoves0), and Hearts is a life more (settleRevivals).
 *
 * A turn left open is `s.bonus = { p, cap, why }`: the next move must be that
 * piece's, or waiting, which ends the turn. While it is open they do not
 * reply and the move count does not tick (respond(), apply()), so every
 * caller that plays a move then a reply (the page, the solver, the
 * measures) handles it unchanged.
 */
function openBonus(n, i, took, wasBonus) {
  const p = n.pieces[i];
  if (n.won || p.taken || lost(n)) return;
  if (p.suit === 'vines' && took && pieceMoves(n, p, 'you').some(takesAny)) { n.bonus = { p: i, cap: true, why: 'vines' }; return; }
  if (p.suit === 'stars' && !p.starUsed && !wasBonus) { p.starUsed = true; n.bonus = { p: i, cap: false, why: 'stars' }; }
}

/** Where a thinking foe can go. */
/** Every move piece k of theirs could make now, whatever moves it (its
    rabbit, a pattern, thought): for Kung fu, where they choose in real
    time (kungfu.js). */
export function foeMovesAny(s, k) {
  const f = s.foes[k];
  if (f.taken || f.flying || f.stun) return [];
  const ms = pieceMoves(s, f, 'foe');
  return canTake(s.day.rules, f) ? ms : ms.filter((m) => !takesAny(m));
}

export function foeMovesFor(s, k) {
  if (s.clouds?.length) { const v = seenBy(s, 'foe'); if (v !== s) return withGrid(v, () => foeMovesFor(v, k)); }
  const f = s.foes[k];
  if (f.taken || f.brain !== 'ai' || f.stun) return [];
  let ms = pieceMoves(s, f, 'foe');
  if (s.day.rules.promote === 'copy' && f.type === 'pawn') ms = promoteChoices(s, 'foe', k, ms);
  // Gears on a piece of theirs (Spirals until 2026-10-13): it may trade
  // squares with any other piece of theirs, as its move.
  if (f.suit === 'gears') s.foes.forEach((q, j) => { if (j !== k && !q.taken && q.rides == null && q.type !== 'bunny') ms = [...ms, { x: q.x, y: q.y, cap: false, swap: true }]; });
  if (s.day.rules.noCheck) ms = ms.filter((m) => !givesCheck(s, 'foe', k, m));
  if (s.day.rules.ballMove === 'hit') return ms.filter((m) => hitOk(s, f, m) && (!m.cap || hitBall(s, m.x, m.y) || canTake(s.day.rules, f)));
  return canTake(s.day.rules, f) ? ms : ms.filter((m) => !takesAny(m));
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
  const W = s.day.W, onFoeSq = (q) => s.foes.some((f) => !f.taken && f.y * W + f.x === q), onMineSq = (q) => onMine({ x: q % W, y: (q / W) | 0 });
  s.pieces.forEach((p, i) => { if (!p.taken && pieceMoves(s, p, 'you').some((m) => capturesOf(m, W).some(onFoeSq))) yours.push(i); });
  s.foes.forEach((f, k) => {
    if (f.taken || !canTake(s.day.rules, f)) return;
    if (f.brain === 'pattern') {
      // A rabbit's first hop is the only move it has.
      const [dx, dy] = patternStep(s, { ...f }, f.pattern[f.i || 0]); // a copy: only looking
      const [tx, ty] = fold(s.day, f.x + dx, f.y + dy);
      if (onMine({ x: tx, y: ty })) theirs.push(k);
      return;
    }
    if (pieceMoves(s, f, 'foe').some((m) => capturesOf(m, W).some(onMineSq))) theirs.push(k);
  });
  return { yours, theirs };
}

/**
 * Racing Kings (2026-10-11): nobody may give check. Would moving piece i of
 * `side` to m leave either King where the other side could take it?
 */
function givesCheck(s, side, i, m) {
  const c = clone(s), mine = side === 'you' ? c.pieces : c.foes, theirs = side === 'you' ? c.foes : c.pieces;
  mine[i].x = m.x; mine[i].y = m.y;
  const hit = theirs.find((q) => !q.taken && q.x === m.x && q.y === m.y);
  if (hit) hit.taken = true;
  const attacked = (who, list) => {
    const k = list.find((q) => !q.taken && q.type === 'king');
    if (!k) return false;
    const other = who === 'you' ? c.foes : c.pieces, oside = who === 'you' ? 'foe' : 'you';
    return other.some((q) => !q.taken && pieceMoves0(c, q, oside).some((mv) => mv.cap && mv.x === k.x && mv.y === k.y));
  };
  return attacked('you', c.pieces) || attacked('foe', c.foes);
}

/** Every move available to you, waiting first if waiting is allowed. With
    no move at all you must pass, whatever the rules say about waiting. */
export function allMoves(s) { return withGrid(s, () => allMoves0(s)); }
function allMoves0(s) {
  const out = [];
  if (s.bonus) {
    // Waiting ends a turn a suit left open.
    for (const m of movesFor(s, s.bonus.p)) out.push({ p: s.bonus.p, ...m });
    return [{ p: -1, x: 0, y: 0, cap: false }, ...out];
  }
  s.pieces.forEach((_, i) => { for (const m of movesFor(s, i)) out.push({ p: i, ...m }); });
  return s.day.rules.wait || !out.length ? [{ p: -1, x: 0, y: 0, cap: false }, ...out] : out;
}

const canMove = (s) => s.pieces.some((_, i) => movesFor(s, i).length);

export function isLegal(s, mv) {
  if (mv.p === -1) return !s.won && (!!s.bonus || s.day.rules.wait || !canMove(s));
  if (mv.p < 0 || mv.p >= s.pieces.length || s.pieces[mv.p].taken) return false;
  return movesFor(s, mv.p).some((m) => m.x === mv.x && m.y === mv.y);
}

function goalMet(s) {
  const g = s.day.rules.goal, F = s.foes;
  if (g === 'hole' || g === 'descent' || g === 'flag') return false; // only the ball in the hole, or the rabbit brought home, wins
  if (g === 'any') return F.some((f) => f.taken);
  // Capturing (2026-10-13): any number of theirs, from one to every one
  // (captureN 0). The rabbit riding them is not one of them.
  if (g === 'capture') {
    const army = F.filter((f) => f.type !== 'bunny'), need = s.day.rules.captureN || army.length;
    return army.filter((f) => f.taken).length >= Math.min(need, army.length);
  }
  // Their rabbit's carrier taken (and the rabbit with it).
  if (g === 'carrier') return F.some((f) => f.brain === 'carrier' && f.taken);
  if (g === 'target' && F.some((f) => f.target)) return F.every((f) => !f.target || f.taken);
  return F.every((f) => f.taken);
}

export const allTaken = (s) => s.pieces.every((p) => p.taken);
/** King of the Hill: is this King on one of the middle squares? */
export function onHill(s, k) {
  if (!s.day.rules.hill) return false;
  const W = s.day.W, H = s.day.H;
  return Math.abs(k.x - (W - 1) / 2) < 1 && Math.abs(k.y - (H - 1) / 2) < 1;
}
/** Has their King won by getting somewhere (the hill, the top row)? */
const theyArrived = (s) => (s.day.rules.hill || s.day.rules.race) &&
  s.foes.some((f) => !f.taken && f.type === 'king' && (onHill(s, f) || (s.day.rules.race && f.y === s.day.H - 1)));

export function lost(s) {
  return allTaken(s) || (s.day.rules.royal && s.pieces.some((p) => p.taken && p.type === 'king')) || theyArrived(s) ||
    ((s.day.rules.goal === 'hole' || s.day.rules.goal === 'descent') && s.pieces.some((p) => p.taken && p.type === 'ball')) ||
    // Your own rabbit's carrier taken (both sides with a rabbit), or theirs
    // carrying the rabbit home (2026-10-13).
    (s.day.rules.goal === 'carrier' && s.pieces.some((p) => p.brain === 'carrier' && p.taken)) || !!s.flagLost;
}

// --- Their turn. -----------------------------------------------------------

/** A foe lands on (x, y), taking whatever of yours is there. `m`, the move
    it made, if it made one: it may promote. Mutates. */
function landFoe(s, f, x, y, m = null) {
  const k = s.foes.indexOf(f);
  // A rabbit of theirs hopping onto one of their heads rides there.
  const mate = f.type === 'bunny' ? s.foes.find((q) => q !== f && !q.taken && q.x === x && q.y === y) : null;
  if (mate) { f.ate = -1; f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; f.rides = s.foes.indexOf(mate); return; }
  // Gears: landing on another piece of theirs trades squares with it, and
  // a rabbit riding either goes with its carrier.
  const swap = f.suit === 'gears' ? s.foes.find((q) => q !== f && !q.taken && q.rides == null && q.x === x && q.y === y) : null;
  if (swap) {
    const j = s.foes.indexOf(swap), fx = f.x, fy = f.y;
    f.ate = -1; f.from = [fx, fy]; f.x = x; f.y = y; f.blocked = false;
    swap.from = [x, y]; swap.x = fx; swap.y = fy;
    s.foes.forEach((q) => { if (q.taken) return; if (q.rides === k) { q.x = x; q.y = y; } else if (q.rides === j) { q.x = fx; q.y = fy; } });
    return;
  }
  const b = hitBall(s, x, y);
  if (b) { knock(s, b, f.x, f.y); f.ate = -1; f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; return; }
  f.ate = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y && p.rides == null);
  f.wounded = -1;
  // Taking it, or (Hearts, 2026-10-13) sending it home with a life less.
  if (f.ate >= 0 && !capturePiece(s, s.pieces[f.ate], k)) { f.wounded = f.ate; f.ate = -1; }
  f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; delete f.rides;
  s.foes.forEach((q) => { if (q.rides === k && !q.taken) { q.from = [q.x, q.y]; q.x = x; q.y = y; } });
  // The rabbit to capture, picked up where it sits.
  if (flagFree(s, y * s.day.W + x)) { s.flag.by = 'foe'; s.flag.i = k; }
  // A pawn of theirs on your first row: a copy of one of theirs (the
  // descent), or a queen (chess variants, 2026-10-11).
  if (m?.promote && f.type === 'pawn' && PIECES[m.promote]) promoteTo(f, m.promote);
  else if (s.day.rules.promote === true && f.type === 'pawn' && y === 0) f.type = 'queen';
}

/** Their piece k makes move m: what its weapon does, landing, and what
    follows. Mutates; returns how many it took. */
function foeLand(s, k, m) {
  const f = s.foes[k], fx = f.x, fy = f.y, gone = () => s.pieces.filter((p) => p.taken).length + (s.revived?.side === 'you' ? 1 : 0);
  const was = gone();
  delete s.revived;
  let took = armsBefore(s, 'foe', k, m);
  landFoe(s, f, m.x, m.y, m);
  took += armsAfter(s, 'foe', k, m);
  settleRevivals(s);
  if (!m.swap) passGhosts(s, 'foe', fx, fy, m.x, m.y, m.wrapped);
  flagHome(s);
  return Math.max(took, gone() - was);
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
  if (!m) return;
  const f = s.foes[m.k], gone = () => s.pieces.filter((p) => p.taken).length;
  const before = gone();
  // Under clouds they choose from what they can see, and may run into one
  // of yours that hides there.
  m = contact(s, 'foe', f, m);
  if (m.bumped) s.bumped = 'foe';
  if (!m.swap) breakStatue(s, m.x, m.y);
  const took = foeLand(s, m.k, m);
  if (f.taken || lost(s)) return;
  // Their suits that change a turn (2026-10-13, Timothy: "enemy pieces
  // should be able to receive all the different suits"). Vines: after a
  // capture it takes again while it can, the best thing in reach each time.
  // Stars: once a level, its first move is followed by a second. Both pick
  // their extra move greedily (bestFollow), the same on every phone, and the
  // thinking side's lookahead plays them the same way (ai.js after).
  if (f.suit === 'vines' && (took > 0 || gone() > before)) {
    for (let n = 0; n < 8 && !lost(s) && !f.taken; n++) {
      const c = bestFollow(s, m.k, true);
      if (!c) break;
      if (!foeLand(s, m.k, c)) break;
      s.foeBonus = 'vines';
    }
  } else if (f.suit === 'stars' && !f.starUsed) {
    f.starUsed = true;
    const c = bestFollow(s, m.k, false);
    if (c) { foeLand(s, m.k, c); s.foeBonus = 'stars'; }
  }
}

/** The extra move a suit gives piece k of theirs: the most valuable piece
    of yours it can take, or (not `capOnly`) failing that the move that
    keeps it out of your reach and brings it nearest your King. */
function bestFollow(s, k, capOnly) {
  const f = s.foes[k], reach = reachOf(s, 'you');
  const king = s.pieces.find((p) => !p.taken && p.type === 'king') || s.pieces.find((p) => !p.taken);
  let best = null, bv = -Infinity;
  const W = s.day.W;
  for (const m of foeMovesFor(s, k)) {
    if (m.swap) continue;
    const victims = capturesOf(m, W).map((q) => enemyOn(s, 'foe', q)).filter(Boolean);
    if (capOnly && !takesAny(m)) continue;
    const royal = victims.some((v) => s.day.rules.royal && v.type === 'king');
    let v = victims.length ? 100 + (royal ? 1000 : victims.reduce((n, p) => n + PIECES[p.type].value * 10, 0)) : 0;
    if (reach.has(m.y * s.day.W + m.x)) v -= PIECES[f.type].value * 5;
    if (king) v -= Math.max(Math.abs(m.x - king.x), Math.abs(m.y - king.y));
    if (v > bv) { bv = v; best = m; }
  }
  return best;
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
function possessedStep(s, f, force = false) {
  const raw = f.pattern[f.i];
  f.i = (f.i + 1) % f.pattern.length;
  f.from = [f.x, f.y]; f.ate = -1; f.blocked = false; f.rested = false;
  if (!raw[0] && !raw[1] && !force) { f.rested = true; return; }
  // Made to move (foesMust): a pause or a blocked way still moves, by the
  // move that heads most nearly where the step points (a pause: the
  // shortest move there is).
  const [dx, dy] = raw[0] || raw[1] ? patternStep(s, f, raw) : [0, 0];
  const [tx, ty] = fold(s.day, f.x + dx, f.y + dy), take = canTake(s.day.rules, f);
  let best = null, bk = null;
  for (const m of pieceMoves(s, f, 'foe')) {
    const ball = m.cap && hitBall(s, m.x, m.y);
    if (ball ? !hitOk(s, f, m) : m.cap && !take) continue;
    // (On a magic board, distances go the short way round.)
    const mx = delta(s.day, m.x - f.x, 'x'), my = delta(s.day, m.y - f.y, 'y');
    const off = mx * dx + my * dy <= 0;
    if (off && !force) continue; // not this way
    const key = [off ? 1 : 0, delta(s.day, m.x - tx, 'x') ** 2 + delta(s.day, m.y - ty, 'y') ** 2, mx * mx + my * my, m.y, m.x];
    if (!bk || before(key, bk)) { best = m; bk = key; }
  }
  if (!best) { f.blocked = true; return; }
  foeLand(s, s.foes.indexOf(f), best);
}

/** The pattern foes all hop, the possessed pieces take their steps, and
    every rabbit with a mind thinks for itself. Mutates. */
export function patternHops(s) {
  s.foes.forEach((f, k) => {
    if (f.taken || f.stun) return;
    if (f.mind) { if (!lost(s)) mindStep(s, f, k, 'foe', f.brain === 'leader'); return; }
    if (f.brain === 'pattern') for (let h = 0; h < (f.hops || 1) && !lost(s); h++) hop(s, f);
    else if (f.brain === 'possessed' && !lost(s)) possessedStep(s, f);
  });
}

// --- Rabbit minds (Timothy, 2026-10-08: "currently rabbits are too stupid
// ... intelligence level from 1-10, along with a trait"). ------------------
//
// A rabbit with a mind (loose, or inside one of their pieces, or inside one
// of yours in autochess) looks at every move it has, and staying put, and
// scores each: what it would catch, whether the other side could take it
// there next turn, how near the other side it ends up, how much room it
// would have to move from there (so it never boxes itself into a corner),
// how near the middle it is. Its trait says how much each of those matters;
// its intelligence says how well it sees danger and how much it fumbles.
// The fumbling is not random: it comes from a hash of the position, so the
// same position always gets the same move, on every phone, and the solver
// can still treat the level as a puzzle.

/** What each trait cares about. cap: catching; danger: standing where it
    can be taken; near: distance to the nearest of the other side (minus
    means closer is better); target: distance to the other side's strongest
    piece; ally: distance to its own side; room: moves it would have next
    turn; center: distance to the middle (minus: likes the middle); long:
    the length of the move; follow: going the way its pattern says; noise:
    extra fumbling. */
export const TRAITS = {
  aggressive: { name: 'Aggressive', cap: 9, danger: -3, near: -1.4, room: 0.3, center: -0.2,
    desc: 'Goes for your pieces, and takes any it can.' },
  hunter: { name: 'Hunter', cap: 5, capTarget: 10, danger: -4, target: -2.2, room: 0.3,
    desc: 'Picks your strongest piece and goes after it, whatever else is on the board.' },
  shy: { name: 'Shy', cap: 1.5, danger: -10, near: 1.6, room: 0.7, center: -0.3,
    desc: 'Keeps away from your pieces and never stands where you could take it, if it can help it.' },
  guard: { name: 'Guard', cap: 4, danger: -6, ally: -1.3, near: -0.2, room: 0.3,
    desc: 'Stays close to its own side, keeps out of reach, and takes what wanders near.' },
  messy: { name: 'Messy', cap: 4, danger: -2, near: -0.4, room: 0.2, long: 0.6, noise: 3,
    desc: 'All over the place: long, odd moves, and only half an eye on danger.' },
  pattern: { name: 'Habit', cap: 3, danger: -5, follow: 4, room: 0.4,
    desc: 'Keeps a habit you can learn, a pattern of ways it likes to go, but steps round trouble instead of walking into it.' }
};

/**
 * One rabbit leads their side (darkBrain 'rabbit', 2026-10-13, Timothy:
 * "its just that one rabbit and their type/personality that defines the
 * enemy team in difficulty and style"). Their pieces think (ai.js); the
 * rabbit's trait is their mood and its intelligence how far ahead they look.
 */
export function leaderMind(trait, iq) {
  const style = { aggressive: 'hunt', hunter: 'hunt', shy: 'flee' }[trait] || 'balanced';
  let skill = iq <= 2 ? 0 : iq <= 5 ? 1 : iq <= 8 ? 2 : 3;
  if (trait === 'messy') skill = Math.max(0, skill - 1);
  return { skill, style, guard: true };
}

/** The rabbit that leads their side, in words, for a tap on it. */
export function leaderDesc(f, day) {
  const T = TRAITS[f.mind.trait] || TRAITS.aggressive;
  const mood = { hunt: 'they hunt your pieces', flee: 'they keep out of reach', balanced: 'they weigh it up' }[day.ai?.style] || 'they weigh it up';
  const ahead = ['at random', 'one move ahead', 'two moves ahead', 'three moves ahead'][day.ai?.skill] ?? 'one move ahead';
  return `The rabbit that leads them: ${T.name.toLowerCase()}, intelligence ${f.mind.iq}. ${T.desc} With it in charge ${mood}, thinking ${ahead}. It hops every turn, up to two squares, and never takes anything.`;
}

/** A number in [0, 1) from a string, the same everywhere (FNV-1a). */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Squares the side `who` could move to next turn: where a piece of the
    other side would be standing in reach. (A little generous: a pawn's
    forward step is counted though it cannot capture that way.) */
/**
 * Where every piece can go, for showing on the board (2026-10-10: "every
 * piece's movement pattern shows on the board ... to make the first
 * approach to the game easier for non-chess players"). { yours, theirs }:
 * Sets of squares (y * W + x) any piece of that side could move to or take
 * on, as things stand. Rabbits on a fixed pattern have no moves to show.
 *
 * With `pattern` (the rings, 2026-10-12), each piece's move set as it maps
 * onto the board rather than only its moves this turn (Timothy: "we need to
 * see the highlights as to where enemy pieces could move, even if it's
 * underneath another enemy piece"): see patternReach.
 */
export function reachMaps(s, pattern = false) {
  s = seenBy(s, 'you'); // a piece hidden in a cloud shows no reach (2026-10-13)
  const W = s.day.W, yours = new Set(), theirs = new Set();
  if (s.won) return { yours, theirs };
  s.pieces.forEach((p, i) => {
    if (p.taken || p.flying) return;
    for (const m of movesFor(s, i)) if (!m.swap) { yours.add(m.y * W + m.x); for (const q of capturesOf(m, W)) yours.add(q); }
    if (pattern && p.type !== 'ball') for (const k of patternReach(s, p, 'you', true)) yours.add(k);
  });
  for (const f of s.foes) {
    // The rabbit that leads them never takes anything, so its hops are no
    // danger to show (Timothy, 2026-10-13: "the rabbit shouldn't have its
    // moveset present as a purple reach outline"); nor does a rabbit that
    // rides their pieces.
    if (f.taken || f.flying || f.brain === 'pattern' || f.brain === 'leader' || f.brain === 'carrier') continue;
    const ms = pieceMoves(s, f, 'foe');
    for (const m of ms) { theirs.add(m.y * W + m.x); for (const q of capturesOf(m, W)) theirs.add(q); }
    // A sword strikes round every square it could land on: all of those are
    // dangerous to stand on.
    if (f.weapon === 'sword') for (const m of ms) for (const [dx, dy] of SWORD[Math.max(1, Math.min(3, f.wl || 1))]) {
      const [x, y] = fold(s.day, m.x + dx, m.y - dy);
      if (onBoard(s.day, x, y)) theirs.add(y * W + x);
    }
    if (pattern && f.weapon !== 'sword' && f.weapon !== 'lance') for (const k of patternReach(s, f, 'foe', canTake(s.day.rules, f))) theirs.add(k);
  }
  return { yours, theirs };
}

// Pieces with moves that only take, never step (a pawn's diagonals, a
// cannon's or vao's shot over a screen): their empty target squares are
// found one by one.
const TAKES_ONLY = new Set(['pawn', 'cannon', 'vao']);

/** The squares piece p's move set covers beyond its moves this turn, as
    squares (y * W + x): those its own side stands on, where it would take
    if one of the other side stood there instead (the piece guards them);
    and, for a piece that can take there, the empty squares it could only
    take on. Things in the way still stop it, and its own side stops it on
    the square it guards. Nothing for a piece that cannot take. */
function patternReach(s, p, side, takes) {
  const out = new Set();
  if (!takes) return out;
  const base = sight(s, p, side), fwd = side === 'you' ? 1 : -1, moves = PIECES[p.type].moves, W = s.day.W, wrap = s.day.rules.wrap;
  const at = (x, y) => (wrap ? fold(s.day, x, y) : [x, y]);
  for (const m of moves((x, y) => { const c = base(x, y); return c === OWN ? ENEMY : c; }, p, fwd, s.day)) if (m.cap) { const [x, y] = at(m.x, m.y); out.add(y * W + x); }
  if (TAKES_ONLY.has(p.type))
    for (let y = 0; y < s.day.H; y++) for (let x = 0; x < W; x++) {
      // A pawn only takes next to itself: no need to try further off.
      if (p.type === 'pawn' && !wrap && (Math.abs(x - p.x) > 1 || Math.abs(y - p.y) > 1)) continue;
      if (base(x, y) !== EMPTY) continue;
      const L = (a, b) => { const [fa, fb] = at(a, b); return fa === x && fb === y ? ENEMY : base(a, b); };
      if (moves(L, p, fwd, s.day).some((m) => { const [mx, my] = at(m.x, m.y); return m.cap && mx === x && my === y; })) out.add(y * W + x);
    }
  return out;
}

/**
 * Your pieces that are guarded (2026-10-11): if one of theirs took it where
 * it stands, another piece of yours could take back on that square. Kings
 * are left out: losing one ends the game, so taking back is no comfort.
 * Returns a Map of index into s.pieces to the indexes of the pieces of
 * yours that guard it (one guard: a silver shield; two or more: gold). Who
 * guards is kept so the shield can fly from the guard (2026-10-13).
 */
export function guarded(s) {
  s = seenBy(s, 'you'); // nothing hidden in a cloud is given away
  const out = new Map();
  if (s.won) return out;
  s.pieces.forEach((p, i) => {
    if (p.taken || p.flying || p.type === 'king' || p.type === 'ball' || p.rides != null) return;
    // As if one of theirs now stood there, having taken it (and anything riding on it).
    const c = clone(s);
    c.pieces.forEach((q) => { if (!q.taken && q.x === p.x && q.y === p.y) q.taken = true; });
    c.foes.push({ type: 'pawn', x: p.x, y: p.y, taken: false, brain: 'none' });
    const by = [];
    const sq = p.y * s.day.W + p.x;
    c.pieces.forEach((q, j) => { if (!q.taken && !q.flying && q.type !== 'ball' && q.brain !== 'carrier' && pieceMoves(c, q, 'you').some((m) => capturesOf(m, s.day.W).includes(sq))) by.push(j); });
    if (by.length) out.set(i, by);
  });
  return out;
}

/** Which of your pieces could take back on square sq if one of theirs
    stood there (the test `guarded` makes, for any square). Indexes into
    s.pieces. */
function guardsOf(s, sq) {
  const W = s.day.W, x = sq % W, y = Math.floor(sq / W), c = clone(s), by = [];
  c.foes.push({ type: 'pawn', x, y, taken: false, brain: 'none' });
  c.pieces.forEach((q, j) => { if (!q.taken && !q.flying && q.type !== 'ball' && q.brain !== 'carrier' && pieceMoves(c, q, 'you').some((m) => capturesOf(m, W).includes(sq))) by.push(j); });
  return by;
}

/**
 * Empty squares that would be guarded (Timothy, 2026-10-13: "if that
 * piece's reach overlaps with the position present on the enemy's reaches
 * outline, wherein if you moved a piece there, then that piece would be
 * able to actually defend that slot, then put a flat shield icon onto that
 * cell"). Of `squares` (y * W + x; their reach), the empty ones where, if a
 * piece of yours stood there and they took it, another of yours could take
 * back. With a piece `sel` selected, its own moves are tried for real: the
 * piece is moved there, and only the others count, from where they then
 * stand (it cannot guard itself, and leaving may open or close a line).
 * Returns a Map of square to the indexes of the pieces that would guard it.
 */
export function guardedSquares(s, squares, sel = null, legal = []) {
  s = seenBy(s, 'you'); // nothing hidden in a cloud is given away
  const out = new Map();
  if (s.won) return out;
  const W = s.day.W, mine = new Map();
  if (sel != null) for (const mv of legal) if (!mv.cap && !mv.swap && (mv.p == null || mv.p === sel)) mine.set(mv.y * W + mv.x, mv); // legal: the selected piece's moves
  for (const sq of squares) {
    const x = sq % W, y = Math.floor(sq / W);
    if (look(s, x, y, 'you') !== EMPTY) continue;
    let by;
    if (mine.has(sq)) {
      // Moved there and taken there: off its own square, and off this one.
      const n = clone(s), p = n.pieces[sel];
      p.x = x; p.y = y; p.taken = true;
      by = guardsOf(n, sq);
    } else by = guardsOf(s, sq);
    if (by.length) out.set(sq, by);
  }
  return out;
}

/**
 * Pieces pinned to their King (2026-10-13, Timothy: "pieces that would be
 * considered absolutely pinned (as in they cannot move legally because it
 * would expose their king)").
 *
 * In chess a pin is a piece standing between an attacker and something
 * behind it; an absolute pin is one where the thing behind is the King, so
 * moving the piece off the line is illegal (a relative pin is to anything
 * else, and only costly). Grove Chess has no rule against moving into
 * danger (a King left where it can be taken is simply lost), so a pinned
 * piece can still move; moving it loses. It is found the plain way: lift
 * the piece off the board, and see whether a piece of the other side that
 * could not take the King before now can. That catches every kind of pin,
 * a slider's along a line or a cannon's through a screen.
 *
 * Only where losing the King loses: yours with a royal King, theirs when
 * taking their King wins. Returns { mine, theirs }: Maps of index into
 * s.pieces or s.foes to the indexes of the pieces that pin it.
 */
export function pinned(s) {
  s = seenBy(s, 'you'); // nothing hidden in a cloud is given away
  const mine = new Map(), theirs = new Map();
  if (s.won || lost(s)) return { mine, theirs };
  const r = s.day.rules;
  /** Which pieces of `side`'s enemies could take its King in state c. */
  const attackers = (c, side, king) => {
    const out = [];
    const sq = king.y * c.day.W + king.x, hits = (m) => capturesOf(m, c.day.W).includes(sq);
    if (side === 'you') c.foes.forEach((f, k) => { if (!f.taken && !f.flying && f.brain !== 'pattern' && canTake(r, f) && pieceMoves(c, f, 'foe').some(hits)) out.push(k); });
    else c.pieces.forEach((p, i) => { if (!p.taken && !p.flying && p.type !== 'ball' && pieceMoves(c, p, 'you').some(hits)) out.push(i); });
    return out;
  };
  const sides = [
    ['you', s.pieces, mine, r.royal ? s.pieces.find((p) => !p.taken && p.type === 'king') : null],
    ['foe', s.foes, theirs, (r.goal === 'king' || r.goal === 'target') ? s.foes.find((f) => !f.taken && f.type === 'king' && (r.goal === 'king' || f.target)) : null]
  ];
  for (const [side, list, out, king] of sides) {
    if (!king) continue;
    const before = attackers(s, side, king);
    list.forEach((p, i) => {
      if (p === king || p.taken || p.flying || p.type === 'ball' || p.rides != null) return;
      const c = clone(s), own = side === 'you' ? c.pieces : c.foes;
      own[i].taken = true;
      // Anything riding on it comes off with it.
      own.forEach((q) => { if (q.rides === i) q.taken = true; });
      const by = attackers(c, side, king).filter((k) => !before.includes(k));
      if (by.length) out.set(i, by);
    });
  }
  return { mine, theirs };
}

/**
 * What could be taken next (2026-10-11, the beacons): `mine`, your pieces
 * one of theirs could take on their next turn if you left them where they
 * are (on your King, that is check), and `theirs`, their pieces you could
 * take now. Sets of indexes into s.pieces and s.foes. A piece riding on
 * another counts with it. Loose rabbits on a fixed pattern are left out.
 */
export function threats(s) {
  s = seenBy(s, 'you'); // nothing hidden in a cloud is given away
  const mine = new Set(), theirs = new Set();
  if (s.won) return { mine, theirs };
  const W = s.day.W, at = (list, q, out) => list.forEach((o, k) => { if (!o.taken && !o.flying && o.y * W + o.x === q) out.add(k); });
  s.pieces.forEach((p, i) => { if (!p.taken && !p.flying) for (const m of movesFor(s, i)) if (!m.swap) for (const q of capturesOf(m, W)) at(s.foes, q, theirs); });
  s.foes.forEach((f) => {
    if (f.taken || f.flying || f.brain === 'pattern' || !canTake(s.day.rules, f)) return;
    for (const m of pieceMoves(s, f, 'foe')) for (const q of capturesOf(m, W)) at(s.pieces, q, mine);
  });
  for (const k of [...mine]) if (s.pieces[k].type === 'ball') mine.delete(k);
  return { mine, theirs };
}

function reachOf(s, who) {
  const out = new Set(), W = s.day.W;
  const list = who === 'you' ? s.pieces : s.foes;
  for (const p of list) {
    if (p.taken || p.type === 'ball') continue;
    if (who === 'foe' && !canTake(s.day.rules, p)) continue;
    for (const m of pieceMoves(s, p, who)) { out.add(m.y * W + m.x); for (const q of capturesOf(m, W)) out.add(q); }
  }
  return out;
}

/**
 * One rabbit-minded piece's turn: `f` is s.foes[k] (side 'foe') or
 * s.pieces[k] (side 'you', autochess). Mutates.
 */
function mindStep(s, f, k, side, force = false) {
  const day = s.day, W = day.W, H = day.H, T = TRAITS[f.mind.trait] || TRAITS.aggressive;
  const iq = Math.max(1, Math.min(10, f.mind.iq || 5));
  const other = side === 'foe' ? 'you' : 'foe';
  const them = (side === 'foe' ? s.pieces : s.foes).filter((p) => !p.taken && p.type !== 'ball');
  const mine = (side === 'foe' ? s.foes : s.pieces).filter((p) => !p.taken && p !== f);
  const reach = reachOf(s, other);
  const take = side === 'foe' ? canTake(day.rules, f) : true;
  const dist = (ax, ay, bx, by) => Math.max(Math.abs(delta(day, ax - bx, 'x')), Math.abs(delta(day, ay - by, 'y')));
  const strongest = them.reduce((a, p) => (!a || (PIECES[p.type].strength || 0) > (PIECES[a.type].strength || 0) ? p : a), null);
  // A habit, if it has one: the way its pattern points this turn.
  let want = null;
  if (T.follow && f.pattern) { want = patternStep(s, f, f.pattern[f.i || 0]); f.i = ((f.i || 0) + 1) % f.pattern.length; }
  const aware = 0.25 + 0.75 * (iq / 10), fumble = (11 - iq) * 0.55 + (T.noise || 0);

  /** How many moves it would have standing on (x, y). */
  const room = (x, y) => {
    const L0 = sight(s, f, side);
    // Where it would stand is its own edge of the world (checked first: when
    // it stays put that is also the square it is on); where it stands now it
    // will have left.
    const L = (a, b) => { const [p, q] = fold(day, a, b); if (p === x && q === y) return OFF; if (p === f.x && q === f.y) return EMPTY; return L0(a, b); };
    return PIECES[f.type].moves(L, { ...f, x, y }, side === 'foe' ? -1 : 1, day).length;
  };
  const score = (x, y, cap) => {
    let v = 0;
    const victim = cap ? them.find((p) => p.x === x && p.y === y) : null;
    if (victim) v += T.cap * (PIECES[victim.type].strength || 3) / 3 + (victim === strongest ? T.capTarget || 0 : 0);
    if (reach.has(y * W + x) && !(cap && iq < 4)) v += T.danger * aware;
    if (them.length) {
      const near = Math.min(...them.map((p) => dist(x, y, p.x, p.y)));
      v += (T.near || 0) * near;
      if (T.target && strongest) v += T.target * dist(x, y, strongest.x, strongest.y);
    }
    if (T.ally && mine.length) v += T.ally * Math.min(...mine.map((p) => dist(x, y, p.x, p.y)));
    v += (T.room || 0) * Math.min(8, room(x, y)) * (0.5 + iq / 20);
    v += (T.center || 0) * (Math.abs(x - (W - 1) / 2) + Math.abs(y - (H - 1) / 2)) / 2;
    // Every rabbit dislikes edges and, more, corners: that is where they get
    // stuck. (Not on a joined edge of a magic board: there is no edge.)
    const edgeX = !wrapsX(day) && (x === 0 || x === W - 1), edgeY = !wrapsY(day) && (y === 0 || y === H - 1);
    v -= (edgeX && edgeY ? 1.6 : edgeX || edgeY ? 0.5 : 0) * (0.4 + iq / 10);
    v += (T.long || 0) * Math.max(Math.abs(delta(day, x - f.x, 'x')), Math.abs(delta(day, y - f.y, 'y')));
    if (want) {
      const mx = delta(day, x - f.x, 'x'), my = delta(day, y - f.y, 'y');
      if (mx * want[0] + my * want[1] > 0) v += T.follow;
    }
    return v + hash01(`${day.seed ?? 0}|${s.t}|${side}${k}|${x},${y}`) * fumble;
  };

  // Staying put gets less appealing the longer it has stayed: restless.
  // Made to move (foesMust): staying put is not on the list.
  let best = force ? { x: f.x, y: f.y, cap: false, v: -Infinity } : { x: f.x, y: f.y, cap: false, v: score(f.x, f.y, false) - 0.8 - 1.2 * (f.idle || 0) };
  for (const m of pieceMoves(s, f, side)) {
    const ball = m.cap && hitBall(s, m.x, m.y);
    if (ball ? !hitOk(s, f, m) : m.cap && !take) continue;
    if (side === 'you' && !hitOk(s, f, m)) continue;
    const v = score(m.x, m.y, m.cap && !ball);
    if (v > best.v) best = { ...m, v };
  }
  f.from = [f.x, f.y];
  if (best.x === f.x && best.y === f.y) { f.rested = true; f.blocked = false; f.idle = (f.idle || 0) + 1; return; }
  f.rested = false; f.idle = 0;
  if (side === 'foe') foeLand(s, k, best);
  else { armsBefore(s, 'you', k, best); landMine(s, k, best.x, best.y, best); armsAfter(s, 'you', k, best); settleRevivals(s); }
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
function foesAct(s, chosen) {
  for (const f of s.foes) { f.from = [f.x, f.y]; f.ate = -1; f.blocked = false; }
  if (s.day.rules.oneMove) return oneFoeActs(s, chosen);
  if (s.foes.some((f) => !f.taken && f.brain === 'ai')) foeMove(s, chosen !== undefined ? chosen : think(seenBy(s, 'foe')));
  if (!lost(s)) patternHops(s);
  if (s.hole?.pattern && !lost(s)) holeHop(s);
}

/** One piece of theirs takes its step (its rabbit's mind, or its pattern). */
function foeStep(s, k, force = false) {
  const f = s.foes[k];
  if (f.mind) mindStep(s, f, k, 'foe', force);
  else if (f.brain === 'possessed') possessedStep(s, f, force);
}

/** Did foe k do something on its step from a to b: move, or try a capture
    that bounced off a heart? */
const acted = (a, b, k) => b.foes[k].x !== a.foes[k].x || b.foes[k].y !== a.foes[k].y || b.foes[k].wounded >= 0;

/**
 * Their turn, one piece at a time (Timothy, 2026-10-09: "the opposing team
 * should only be able to move one piece a turn like we can"). A side that
 * thinks makes its one best move, as it always did. A side moved by
 * rabbits: if one of its pieces would take one of yours this turn, that
 * one moves; otherwise they take turns, in order, so you can tell who goes
 * next. Loose rabbits are not their side: they still hop every turn.
 */
function oneFoeActs(s, chosen) {
  for (const f of s.foes) f.wounded = -1;
  if (s.foes.some((f) => !f.taken && f.brain === 'ai')) foeMove(s, chosen !== undefined ? chosen : think(seenBy(s, 'foe')));
  else {
    const side = s.foes.map((f, k) => k).filter((k) => !s.foes[k].taken && !s.foes[k].stun && s.foes[k].type !== 'rabbit' && s.foes[k].brain !== 'leader' && (s.foes[k].mind || s.foes[k].brain === 'possessed'));
    if (side.length) {
      const before = (c) => c.pieces.filter((p) => p.taken).length + c.foes.filter((f) => f.wounded >= 0).length;
      const takes = side.find((k) => { const c = clone(s); foeStep(c, k); return before(c) > before(s); });
      let k = takes ?? side[(s.ft || 0) % side.length], force = false;
      // Nobody waits (foesMust, 2026-10-10): if the one whose turn it is
      // would stay put, it moves anyway; if it cannot move at all, the next
      // in order goes. A side with no move anywhere passes.
      if (s.day.rules.foesMust && takes === undefined) {
        const tryStep = (j, f) => { const c = clone(s); foeStep(c, j, f); return acted(s, c, j); };
        if (!tryStep(k, false)) {
          const order = side.map((_, n) => side[((s.ft || 0) + n) % side.length]);
          const j = order.find((q) => tryStep(q, true));
          if (j !== undefined) { k = j; force = !tryStep(j, false); }
        }
      }
      foeStep(s, k, force);
      s.ft = (s.ft || 0) + 1;
    }
  }
  // The rabbit that leads them (darkBrain 'rabbit', 2026-10-13) hops every
  // turn, by its own mind, after their piece has moved.
  s.foes.forEach((f, k) => { if (!f.taken && f.brain === 'leader' && f.mind && !lost(s)) mindStep(s, f, k, 'foe', true); });
  // Loose rabbits, as before.
  s.foes.forEach((f, k) => {
    if (f.taken || f.type !== 'rabbit' || lost(s)) return;
    if (f.mind) mindStep(s, f, k, 'foe');
    else if (f.brain === 'pattern') for (let h = 0; h < (f.hops || 1) && !lost(s); h++) hop(s, f);
    else if (f.brain === 'possessed') possessedStep(s, f);
  });
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
    const nq = ny * s.day.W + nx;
    // Water (golf, 2026-10-13): in it goes, and back to the tee, unless
    // something stands there (the hitter takes the ball's square).
    if (s.day.water?.has(nq)) {
      const tee = s.day.pieces[s.pieces.indexOf(b)];
      const busy = !tee || (tee.x === b.x && tee.y === b.y) || [...s.pieces, ...s.foes].some((q) => q !== b && !q.taken && q.x === tee.x && q.y === tee.y);
      if (!busy) return { x: tee.x, y: tee.y, sunk: false, takes: -1, splash: [nx, ny] };
      break;
    }
    // The hitter has left its square by the time the ball gets there.
    const c = nx === fx && ny === fy ? EMPTY : look(s, x + sx, y + sy, 'you');
    if (c === ENEMY && s.day.rules.ballCaptures) {
      takes = s.foes.findIndex((f) => !f.taken && f.x === nx && f.y === ny);
      if (takes >= 0) { x = nx; y = ny; break; }
    }
    if (c !== EMPTY && c !== HOLE) break;
    x = nx; y = ny;
    if (c === HOLE && !s.day.rules.ballStops) { sunk = true; break; }
    // Sand, or a wandering cloud over the square: it stops dead there.
    if (s.day.sand?.has(nq) || cloudOver(s, nq)) break;
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
  // A splash is kept with the turn it happened on, so the page can say so.
  if (to.splash) b.splash = { at: to.splash, t: s.t };
  if (to.takes >= 0) {
    s.foes[to.takes].taken = true;
    if (goalMet(s)) s.won = true;
  }
  if (to.sunk && holeOpen(s)) s.won = s.sunk = true;
  return true;
}

/** Your piece i lands on (x, y): the square it left may crumble, anything
    of theirs there is caught, and the game may be won. `m`, the move it
    made, if it made one: it may promote. Mutates. */
function landMine(n, i, x, y, m = null) {
  const p = n.pieces[i], riding = p.rides != null;
  const mate = n.pieces.find((q, k) => k !== i && !q.taken && q.type !== 'ball' && q.x === x && q.y === y);
  // A rabbit hopping onto a head rides there (2026-10-11).
  if (mate && p.type === 'bunny') {
    if (n.day.rules.crumble && !riding) n.gone.push(p.y * n.day.W + p.x);
    p.x = x; p.y = y; p.rides = n.pieces.indexOf(mate);
    return null;
  }
  // Gears: landing on a piece of yours trades squares with it, and a rabbit
  // riding either goes with its carrier.
  if (mate) {
    const j = n.pieces.indexOf(mate), px = p.x, py = p.y;
    mate.x = px; mate.y = py; p.x = x; p.y = y;
    n.pieces.forEach((q) => { if (q.taken) return; if (q.rides === i) { q.x = x; q.y = y; } else if (q.rides === j) { q.x = px; q.y = py; } });
    return null;
  }
  const hit = hitBall(n, x, y);
  if (hit && hit !== p) knock(n, hit, p.x, p.y);
  // Crumbling ground: the square you leave falls away behind you (not when
  // a rabbit hops off a head: the piece under it is still there).
  if (n.day.rules.crumble && !riding) n.gone.push(p.y * n.day.W + p.x);
  p.x = x; p.y = y; delete p.rides;
  // A rabbit riding on this piece goes with it.
  n.pieces.forEach((q) => { if (q.rides === i && !q.taken) { q.x = x; q.y = y; } });
  // A pawn on the far row: a copy of one of yours (the descent,
  // 2026-10-13), or a queen (chess variants, 2026-10-11). A King on the
  // hill, or on the top row in a race, wins.
  if (m?.promote && p.type === 'pawn' && PIECES[m.promote]) promoteTo(p, m.promote);
  else if (n.day.rules.promote === true && p.type === 'pawn' && y === n.day.H - 1) p.type = 'queen';
  if (p.type === 'king' && (onHill(n, p) || (n.day.rules.race && y === n.day.H - 1))) n.won = true;
  // Taking what is there (and a rabbit riding on it); with a heart, it goes
  // home instead (captureFoe). Or picking up the rabbit to capture.
  const f = n.foes.find((f) => !f.taken && f.x === x && f.y === y && f.rides == null);
  if (f) captureFoe(n, f, i);
  if (flagFree(n, y * n.day.W + x)) { n.flag.by = 'you'; n.flag.i = i; }
  if (p.type === 'ball' && n.hole && p.x === n.hole.x && p.y === n.hole.y && holeOpen(n)) n.won = n.sunk = true;
  // Catching the last rabbit opens the hole; a ball already resting on
  // the shut hole drops straight in.
  const b = f && n.day.rules.goal === 'descent' && holeOpen(n) && n.pieces.find((q) => q.type === 'ball' && !q.taken);
  if (b && n.hole && b.x === n.hole.x && b.y === n.hole.y) n.won = n.sunk = true;
  return f || null;
}

/** Only your move, with no reply yet. Returns a new state. */
/** The whole of a move given only as { p, x, y } (a link's, a page's): what
    its weapon does, and the promotion if one is named (the strongest if
    not). Moves of pieces with nothing of the kind are left as they are. */
function fullMove(s, mv) {
  const p = s.pieces[mv.p];
  if (!p || mv.strike || mv.pass || mv.push || mv.stun || (!p.weapon && !(s.day.rules.promote === 'copy' && p.type === 'pawn'))) return mv;
  const same = movesFor(s, mv.p).filter((m) => m.x === mv.x && m.y === mv.y && !!m.swap === !!mv.swap);
  const m = same.find((q) => !mv.promote || q.promote === mv.promote) || same[0];
  return m ? { ...m, ...mv, ...(m.strike ? { strike: m.strike } : {}), ...(m.pass ? { pass: m.pass } : {}), ...(m.push ? { push: m.push } : {}), ...(m.stun ? { stun: m.stun } : {}), promote: mv.promote || m.promote } : mv;
}

export function playerMove(s, mv) {
  // Hearts (2026-10-13): where you put a piece of yours that came back,
  // carried with your next move so a replay puts it there too.
  if (mv.place != null && s.revived?.side === 'you') s = placeRevived(s, mv.place);
  if (mv.p >= 0) mv = fullMove(s, mv);
  const n = clone(s), was = n.bonus;
  n.bonus = null;
  delete n.broke; delete n.bumped; delete n.revived;
  if (mv.p >= 0) {
    // A move chosen under clouds may run into a hidden piece and take it.
    const m = contact(s, 'you', s.pieces[mv.p], mv);
    if (m.bumped) n.bumped = 'you';
    const p = n.pieces[mv.p], fx = p.x, fy = p.y;
    if (!m.swap) breakStatue(n, m.x, m.y);
    const gone = () => n.foes.filter((f) => f.taken).length;
    const before = gone(), lives = n.foes.reduce((t, f) => t + (f.lives || 1), 0);
    // A weapon's work before it lands (a lance's passes, a mace's pushes),
    // landing, and its work after (a sword's strikes, a mace's stuns).
    armsBefore(n, 'you', mv.p, m);
    landMine(n, mv.p, m.x, m.y, m);
    armsAfter(n, 'you', mv.p, m);
    settleRevivals(n);
    if (!m.swap) passGhosts(n, 'you', fx, fy, m.x, m.y, m.wrapped);
    flagHome(n);
    const took = gone() > before || n.foes.reduce((t, f) => t + (f.lives || 1), 0) < lives;
    openBonus(n, mv.p, took, was);
  }
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
  armsBefore(n, 'you', i, best);
  landMine(n, i, best.x, best.y, best);
  armsAfter(n, 'you', i, best);
  settleRevivals(n);
}

/** Is this one of your pieces with a rabbit inside? */
export const autoPiece = (p) => (p.brain === 'possessed' || p.mind) && !p.taken;

/** Your half of an autochess turn: every possessed piece of yours steps,
    in order from the left of the board (then the bottom), as they stand at
    the start of the turn, until the game is won. No reply yet. Returns a
    new state. */
export function autoMove(s) {
  const n = clone(s);
  const order = n.pieces.map((p, i) => i).filter((i) => autoPiece(n.pieces[i]))
    .sort((a, b) => n.pieces[a].x - n.pieces[b].x || n.pieces[a].y - n.pieces[b].y);
  for (const i of order) if (!n.won && !lost(n) && autoPiece(n.pieces[i])) { if (n.pieces[i].mind) mindStep(n, n.pieces[i], i, 'you'); else mineStep(n, i); }
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
  // A showdown with no shrinking ground of its own closes in as a spiral.
  if ((day.rules.shrink || 'spiral') !== 'spiral') {
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
  if (n.won || lost(n)) return;
  // Wandering clouds (2026-10-13) drift a square each turn, any way, over
  // anything; which way is drawn from the level and the turn, so the same
  // game drifts the same way on any phone.
  if (n.clouds?.length) n.clouds.forEach((c, i) => {
    const ways = ALL8.map(([dx, dy]) => [c.x + dx, c.y + dy]).filter(([x, y]) => onBoard(n.day, x, y) && !shrunk(n, x, y));
    if (ways.length) [c.x, c.y] = ways[Math.floor(hash01(`cloud:${n.day.seed ?? 0}:${n.t}:${i}`) * ways.length)];
  });
  // A statue row (2026-10-12, Timothy: "the middle row is filled with the
  // statue things, and every round one randomly disappears to open up the
  // spot"): one statue opens each turn, in an order the level drew at random.
  if (r.statuesOpen && n.day.statueOrder) {
    if (!n.open) n.open = [];
    const next = n.day.statueOrder.find((q) => !n.open.includes(q));
    if (next != null) n.open.push(next);
  }
  if (r.shrink && n.t % (r.shrinkEvery || 2) === 0) shrinkStep(n);
  else if (showdown(n)) shrinkStep(n);
  // The rabbit that rides a side's pieces (goal 'carrier', 2026-10-13: "hops
  // only between other enemy pieces and not on its own ... anywhere from
  // every turn to every five turns"): every rabbitHop turns, to another of
  // that side's pieces, at random (the same on every phone).
  if (r.goal === 'carrier' && r.rabbitHop > 0 && n.t % r.rabbitHop === 0) { carrierHop(n, 'foe'); carrierHop(n, 'you'); }
}

/**
 * The showdown (Timothy, 2026-10-09: "stalemates happen, and maybe
 * something should change when there are only two pieces left"). With
 * rules.showdown on, once only two pieces are left on the board, one of
 * yours and one of theirs, the edge falls away every move, round and
 * inward. A square with a piece on it never falls, so the board closes in
 * round them until they meet.
 */
export function showdown(s) {
  if (!s.day.rules.showdown) return false;
  const mine = s.pieces.filter((p) => !p.taken && p.type !== 'ball').length, theirs = s.foes.filter((f) => !f.taken).length;
  return mine === 1 && theirs === 1;
}

/** The square that will fall next if the edge fell now, for drawing it
    faintly ahead of time. Null when nothing would. */
export function nextShrink(s) {
  if (!s.day.rules.shrink && !showdown(s)) return null;
  const c = clone(s);
  shrinkStep(c);
  return c.shrunk.length > s.shrunk.length ? c.shrunk[c.shrunk.length - 1] : null;
}

/** Your move, then theirs. Returns a new state. */
/** Do they move after this move of yours? Usually yes. Double Time (a
    joker: rules.movesPerTurn 2) gives you two moves to their one; Lazy
    Rabbits (rules.lazyFoes) has them sit out every other turn. */
function theyMove(s) {
  const r = s.day.rules, per = r.movesPerTurn || 1, k = s.t + 1;
  if (k % per) return false;
  return !r.lazyFoes || (k / per) % 2 === 1;
}

/** Stunned pieces sit out one turn of their side: yours are free again
    once your turn is over, theirs once theirs is (2026-10-13). Mutates. */
const unstun = (list) => { for (const q of list) if (q.stun) delete q.stun; };
/** Their turn, with the stuns that it ends. Mutates. */
function theirTurn(c, chosen) {
  unstun(c.pieces);
  if (c.won || !theyMove(c)) return;
  foesAct(c, chosen);
  unstun(c.foes);
}

export function apply(s, mv) {
  const n = playerMove(s, mv);
  if (n.bonus) return n;
  theirTurn(n);
  if (n.cloudy) delete n.cloudy; // as in respond(): the cloud lifts
  n.t++;
  afterMove(n);
  return n;
}

/** Just their reply to a move you already made with playerMove(). The same
    as the second half of apply(), split out so a page can show your move
    before they finish thinking. */
export function respond(n) {
  const c = clone(n);
  if (c.bonus) return c;
  theirTurn(c);
  // Both sides have had their first move: the cloud lifts.
  if (c.cloudy) delete c.cloudy;
  c.t++;
  afterMove(c);
  return c;
}

/** Their reply with their thinking side's move chosen for them: `m` is
    { k, x, y } (one of foeMovesFor), or null for none. Everything else in
    their turn goes as in respond(). For a bot that plays their side
    (sim.js, 2026-10-13), so both sides can be played by the same bot. */
export function respondWith(n, m) {
  const c = clone(n);
  if (c.bonus) return c;
  theirTurn(c, m);
  if (c.cloudy) delete c.cloudy;
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
  for (const p of s.pieces) k += p.taken ? '--' : p.x + ',' + p.y + (p.lives > 1 ? 'L' + p.lives : '') + (p.starUsed ? '*' : '') + (p.stun ? 'z' : '') + (p.promoted ? p.type : '') + ';';
  if (s.bonus) k += `|b${s.bonus.p}${s.bonus.cap ? 'c' : ''}`;
  if (s.cloudy) k += '|c';
  if (s.day.rules.oneMove) k += `|f${s.ft || 0}`; // whose turn it is on their side
  k += '|';
  for (const f of s.foes) k += f.taken ? '--' : f.x + ',' + f.y + ',' + f.i + (f.lives > 1 ? 'L' + f.lives : '') + (f.starUsed ? '*' : '') + (f.mx > 0 ? '+' : '-') + (f.my > 0 ? '+' : '-') + (f.idle ? 'i' + f.idle : '') + (f.stun ? 'z' : '') + (f.promoted ? f.type : '') + ';';
  if (s.flag) k += `|F${s.flag.by || ''}${s.flag.i},${s.flag.x},${s.flag.y}`;
  if (s.hole) k += `|h${s.hole.x},${s.hole.y},${s.hole.i}${s.hole.mx > 0 ? '+' : '-'}${s.hole.my > 0 ? '+' : '-'}`;
  // Which squares are gone matters; the order they went in does not.
  if (s.gone.length) k += '|g' + s.gone.slice().sort((a, b) => a - b).join(',');
  if (s.shrunk?.length) k += '|s' + s.shrunk.slice().sort((a, b) => a - b).join(',');
  // Statues open in a fixed order; statues that can be taken go in any.
  if (s.open?.length) k += '|o' + (s.day.rules.statuesTake ? s.open.slice().sort((a, b) => a - b).join(',') : s.open.length);
  if (s.ghostGone?.length) k += '|g' + s.ghostGone.slice().sort((a, b) => a - b).join(',');
  if (s.clouds?.length) k += '|c' + s.clouds.map((c) => c.x + ',' + c.y).join(';') + 't' + s.t;
  if (s.day.gates?.size) k += '|u' + (s.t % 2);
  // On a geared board the same position facing another way is not the same.
  if (s.day.rules.geared) k += '|r' + turns(s);
  // Nor, with Double Time or Lazy Rabbits, at a different point in the turn.
  if (s.day.rules.movesPerTurn > 1 || s.day.rules.lazyFoes) k += '|t' + (s.t % (2 * (s.day.rules.movesPerTurn || 1)));
  return k;
}

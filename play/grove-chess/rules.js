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
// Every square exactly two away (the squirrel's, and the dancer's), worked
// out once.
const TWO_AWAY = [...sym(2, 0), ...sym(2, 1), ...sym(2, 2)];

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
// (Which piece stands where counts too: your set changes the piece on one
// square, 2026-10-16; before, a view made for one piece of the set was given
// to the next, with the first one's moves.)
const posSig = (s) => s.pieces.map((p) => (p.taken ? '-' : `${p.x},${p.y}${p.type}${p.shape || ''}${p.role || ''}${p.suit || ''}${p.weapon || ''}${p.wl || ''}`)).join(';') + '|' + s.foes.map((f) => (f.taken ? '-' : `${f.x},${f.y}`)).join(';') + '|' + s.clouds.map((c) => `${c.x},${c.y}`).join(';') + '|' + (s.bonus ? s.bonus.p : '') + s.t;

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
  if (s.day.rules.statuesTake && !s.day.rules.hedges && statueAt(s, sq)) { s.open = [...(s.open || []), sq]; s.broke = sq; }
}

/** Is the hole open? On a descent level it stays shut until every rabbit
    has been caught, and on a clearing level (Adventure, goal 'clear') until
    every piece of theirs has been; anywhere else it is always open. A shut
    hole is just ground: anything can stand on it and the ball rolls
    straight over. */
export const holeOpen = (s) => (s.day.rules.goal !== 'descent' && s.day.rules.goal !== 'clear') || s.foes.every((f) => !f.target || f.taken);

/** Can this foe take your pieces? Rabbits have their own rule (and by
    default they do not eat); the first daily boards, which predate it, fall
    back to the rule for everything. */
export function canTake(rules, f) {
  // A statue of theirs (Adventure, 2026-10-15) never takes anything.
  if (f.brain === 'still') return false;
  // A scared piece (Adventure's tactics) runs; it never takes.
  if (f.brain === 'scared') return false;
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
// A sword that aims (rules.swordAims, Adventure, 2026-10-15, Timothy: "the
// sword should be based on the direction you move, not just the space
// above"): the same fan, turned to face the way the move went, to the
// nearest of the eight directions. Each is a turn of that direction in
// eighths: straight on (1), and square to each side (2), and half way
// between (3).
const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const SWORD_AIM = { 1: [0], 2: [0, 2, -2], 3: [0, 2, -2, 1, -1] };
/** The squares a sword that aims strikes, for a move by (dx, dy) landing
    on (x, y): as [dx, dy] steps from where it lands. */
export function swordAim(dx, dy, lv) {
  const d = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return SWORD_AIM[Math.max(1, Math.min(3, lv || 1))].map((k) => DIR8[(((d + k) % 8) + 8) % 8]);
}
const MACE = { 1: [[0, 1], [0, -1]], 2: [[0, 1], [0, -1], [-1, 0], [1, 0]], 3: [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]] };
// The net is Adventure's own (2026-10-15): it changes no move, only what a
// catch is worth (captureFoe).
// The shield is Adventure's too (2026-10-16, Timothy: "shield (new) - pushes
// pieces, can still squash. just the push. if the piece is pushed off the
// board it is captured"): the mace's push, given its own weapon.
export const WEAPON_KINDS = ['sword', 'lance', 'mace', 'net', 'shield'];

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
// (The net only on your cat, 2026-10-17: Timothy, "net can only be equipped
// by your cat".)
export const canArm = (t, w) => !!PIECES[t]?.betza && WEAPON_KINDS.includes(w) && (w !== 'lance' || slides(t)) && (w !== 'net' || t === 'cat');

/** The piece of the other side of `side` standing on square sq (not a rabbit
    riding a head, not a ball), or null. */
function enemyOn(s, side, sq) {
  const W = s.day.W, x = sq % W, y = (sq / W) | 0;
  return (side === 'you' ? s.foes : s.pieces).find((q) => !q.taken && !q.flying && q.rides == null && q.type !== 'ball' && !q.bubble && q.x === x && q.y === y) || null;
}
/** The rabbit to capture is free on square sq. */
const flagFree = (s, sq) => !!s.flag && !s.flag.by && s.flag.y * s.day.W + s.flag.x === sq;
/** Is there something on sq that `side` could take: a piece of the other
    side, a statue that can be taken, or the free rabbit? */
const takeable = (s, side, sq) => !!enemyOn(s, side, sq) || (s.day.rules.statuesTake && !s.day.rules.hedges && statueAt(s, sq)) || flagFree(s, sq);

/** The squares a move takes on: where it lands, if it takes there; a
    sword's strikes; a lance's passes; a mace's pushes that take. */
export function capturesOf(m, W) {
  const out = m.cap ? [m.y * W + m.x] : [];
  if (m.strike) out.push(...m.strike);
  if (m.pass) out.push(...m.pass);
  if (m.push) for (const e of m.push) if (e.to < 0) out.push(e.from);
  if (m.ep != null) out.push(m.ep);
  return out;
}
/** Does this move take anything at all? */
export const takesAny = (m) => !!(m.cap || m.ep != null || m.strike?.length || m.pass?.length || m.push?.some((e) => e.to < 0));

/** Piece p's moves as its weapon changes them, from `side`. */
function armed(s, p, side, ms) {
  const lv = Math.max(1, Math.min(3, p.wl || 1)), fwd = side === 'you' ? 1 : -1, W = s.day.W, L = sight(s, p, side), home = p.y * W + p.x;
  const sqOf = (x, y) => { const [a, b] = fold(s.day, x, y); return onBoard(s.day, a, b) ? b * W + a : -1; };
  const around = (m, pat) => pat.map(([dx, dy]) => sqOf(m.x + dx, m.y + dy * fwd)).filter((q) => q >= 0 && q !== home);
  if (p.weapon === 'net') return ms;
  // Squash (rules.squash, Adventure, 2026-10-15, Timothy: "weapons no longer
  // disable the normal capturing ability, which is now called squash"): a
  // sword or a lance still took the ordinary way, by landing on a piece, as
  // well as its own way. Not since 2026-10-17 (Timothy: "for pieces with the
  // shield weapon, always push, no squashing anymore. no squashing for sword
  // or lance either changed my mind. still squashing for mace though"):
  // in Adventure only the mace squashes.
  const squash = !!s.day.rules.squash && !s.day.rules.suitRabbits;
  if (p.weapon === 'sword') {
    return ms.filter((m) => m.swap || !m.cap || squash).map((m) => {
      if (m.swap || m.cap) return m;
      const strike = (s.day.rules.swordAims
        ? swordAim(m.x - p.x, m.y - p.y, lv).map(([dx, dy]) => sqOf(m.x + dx, m.y + dy)).filter((q) => q >= 0 && q !== home)
        : around(m, SWORD[lv])).filter((q) => takeable(s, side, q));
      return strike.length ? { ...m, strike } : m;
    });
  }
  const vecs = slideVecs(formOf(p), fwd);
  if (p.weapon === 'lance') {
    if (!vecs.length) return ms;
    const out = ms.filter((m) => m.swap || !m.cap || squash), seen = new Set(out.map((m) => m.y * W + m.x));
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
  // Adventure's mace (2026-10-16, Timothy: "still stuns and no longer pushes
  // anything, just adds the AOE stun to the landing"): every move, slide or
  // not, stuns what stands round where it lands; nothing is pushed.
  if (p.weapon === 'mace' && s.day.rules.suitRabbits) return ms.map((m) => {
    if (m.swap) return m;
    const stun = around(m, MACE[lv]).filter((q) => enemyOn(s, side, q));
    return stun.length ? { ...m, stun } : m;
  });
  if (p.weapon === 'shield') return (s.day.rules.suitRabbits ? ms.filter((m) => m.swap || !m.cap || !enemyOn(s, side, m.y * W + m.x)) : ms).concat(shoves(s, p, side, ms, lv));
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

/** A shield's pushes (Adventure, 2026-10-16): each move of piece p that
    lands on a piece of the other side can instead push it one square on,
    the way the move went (to the nearest of the eight directions, as a
    sword aims), and the shield takes its square. A row of them goes
    together, up to lv pieces (1 to 3). Pushed off the board, the last is
    taken; into anything else (a statue, a piece of its own side, more than
    lv in a row) there is no push. Theirs are not stunned. */
function shoves(s, p, side, ms, lv) {
  const W = s.day.W, out = [];
  for (const m of ms) {
    if (!m.cap || m.swap || m.wrapped || !enemyOn(s, side, m.y * W + m.x)) continue;
    const [ux, uy] = DIR8[(((Math.round(Math.atan2(m.y - p.y, m.x - p.x) / (Math.PI / 4))) % 8) + 8) % 8];
    if (s.day.rules.shieldSlide) { const sl = shieldSlides(s, p, side, m, ux, uy, lv); if (sl) out.push(sl); continue; }
    const row = [m.y * W + m.x];
    let x = m.x, y = m.y, push = null;
    for (let n = 0; n < 8; n++) {
      x += ux; y += uy;
      const [a, b] = fold(s.day, x, y), q = b * W + a;
      if (!onBoard(s.day, a, b) || crumbled(s, a, b) || shrunk(s, a, b) || waterAt(s, q)) { push = row.map((f, i) => ({ from: f, to: i + 1 < row.length ? row[i + 1] : -1 })); break; }
      if (enemyOn(s, side, q)) { if (row.length >= lv) break; row.push(q); continue; }
      if (look(s, a, b, side) === EMPTY && !ghostAt(s, q) && !flagFree(s, q) && !(s.hole && s.hole.x === a && s.hole.y === b)) push = row.map((f, i) => ({ from: f, to: i + 1 < row.length ? row[i + 1] : q }));
      break;
    }
    if (push) out.push({ x: m.x, y: m.y, cap: false, push, shove: true });
  }
  return out;
}

/** A shield's push that slides (rules.shieldSlide, Adventure, 2026-10-17,
    Timothy: "shields causes enemy pieces to slide perpetually like
    sliders, not just move the space relative to the pusher ... if it hits
    a piece both peices get stunned, if it hits the edge of the board it
    falls off"). The piece p lands on, and up to lv in a row behind it, slide
    on the way p moved (to the nearest of the eight directions) until
    something stops them: off the edge (or onto fallen ground), the whole row
    falls and is taken; into a piece, either side's, they stop against it and
    the front one and the one it hit are stunned (`bump`); into anything else
    (a raised gate, say), they stop and the front one is stunned. A row that
    cannot move at all cannot be pushed. The move, or null. */
function shieldSlides(s, p, side, m, ux, uy, lv) {
  const { W, H } = s.day, own = side === 'you' ? s.pieces : s.foes;
  const sqAt = (x, y) => { const [a, b] = fold(s.day, x, y); return { a, b, q: b * W + a, off: !onBoard(s.day, a, b) || crumbled(s, a, b) || shrunk(s, a, b) || waterAt(s, b * W + a) }; };
  const pieceOn = (q) => !!enemyOn(s, side, q) || own.some((o) => o !== p && !o.taken && !o.flying && o.rides == null && o.type !== 'ball' && o.y * W + o.x === q);
  const row = [m.y * W + m.x];
  let x = m.x, y = m.y;
  for (;;) {
    const c = sqAt(x + ux, y + uy);
    if (c.off || !enemyOn(s, side, c.q) || row.length >= lv) break;
    row.push(c.q); x += ux; y += uy;
  }
  let k = 0, falls = false, hit = null;
  for (let n = 0; n < W * H; n++) {
    const c = sqAt(x + ux * (k + 1), y + uy * (k + 1));
    if (c.off) { falls = true; break; }
    if (pieceOn(c.q) || statueAt(s, c.q)) { hit = c.q; break; }
    if (look(s, c.a, c.b, side) !== EMPTY || ghostAt(s, c.q) || flagFree(s, c.q) || (s.hole && s.hole.x === c.a && s.hole.y === c.b)) { hit = -1; break; }
    k++;
  }
  if (!falls && !k) return null;
  const on = (q, d) => sqAt((q % W) + ux * d, ((q / W) | 0) + uy * d).q;
  const push = row.map((f) => ({ from: f, to: falls ? -1 : on(f, k) }));
  const bump = falls ? [] : [on(row[row.length - 1], k), ...(hit >= 0 && hit !== null ? [hit] : [])];
  return { x: m.x, y: m.y, cap: false, push, shove: true, slid: falls ? -1 : k, dir: [ux, uy], ...(bump.length ? { bump } : {}) };
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
      if (who !== side && !m.shove) q.stun = true;
    }
    // A shield's slide that hit something: the front piece and what it hit
    // are stunned, whichever side each is on.
    for (const sq of m.bump || []) for (const r of [...n.pieces, ...n.foes]) if (!r.taken && !r.flying && r.rides == null && r.type !== 'ball' && r.y * W + r.x === sq) r.stun = true;
  }
  return took;
}

/** What a weapon does once its piece has landed: a sword strikes, a mace
    on a step or a leap stuns. Mutates; returns how many it took. */
function armsAfter(n, side, i, m) {
  let took = 0;
  // A hedge a sword stopped on is cut down (2026-10-17).
  if (m.cut != null && statueAt(n, m.cut)) { n.open = [...(n.open || []), m.cut]; n.cutAt = m.cut; }
  for (const q of m.strike || []) if (takeAt(n, side, i, q)) took++;
  for (const q of m.stun || []) { const e = enemyOn(n, side, q); if (e) e.stun = true; }
  return took;
}

/** Side `side`'s piece i takes whatever stands on square sq, away from where
    it lands (a weapon). Mutates; returns true if it took something. */
function takeAt(n, side, i, sq) {
  const e = enemyOn(n, side, sq);
  if (e) { if (side === 'you') captureFoe(n, e, i); else capturePiece(n, e, i); return true; }
  if (n.day.rules.statuesTake && !n.day.rules.hedges && statueAt(n, sq)) { n.open = [...(n.open || []), sq]; n.broke = sq; return true; }
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
  // Hearts in Adventure (2026-10-16, Timothy: "heart pieces stay where they
  // are after being hit, and the piece that move to capture it then moves
  // back to its original spot"): the heart is spent and it stays put (the
  // taker's bounce back is landMine's and landFoe's). Elsewhere it goes
  // home to its first row.
  if ((p.lives || 1) > 1) { p.lives--; if (!s.day.rules.suitRabbits) p.reviving = true; return false; }
  p.taken = true;
  s.pieces.forEach((q) => { if (!q.taken && q.x === x && q.y === y) q.taken = true; });
  if (k >= 0) reshape(s.foes[k], p);
  return true;
}
/** Their piece f is taken by your piece i: the same, the other way. Taking
    it may win. Mutates; true if it is gone. */
function captureFoe(n, f, i) {
  const k = n.foes.indexOf(f), x = f.x, y = f.y;
  if (n.flag?.by === 'foe' && n.flag.i === k) { if (i >= 0) { n.flag.by = 'you'; n.flag.i = i; } else { n.flag.by = null; n.flag.x = x; n.flag.y = y; } }
  if ((f.lives || 1) > 1) { f.lives--; if (!n.day.rules.suitRabbits) f.reviving = true; return false; }
  f.taken = true;
  n.foes.forEach((q) => { if (!q.taken && q.x === x && q.y === y) q.taken = true; });
  if (i >= 0) { reshape(n.pieces[i], f); netIt(n.pieces[i], f); }
  if (goalMet(n)) n.won = true;
  return true;
}

/** The net (Adventure, 2026-10-15, Timothy: "new weapon/tool: net (like a
    bug net) using it captures the piece you capture, and you just get it
    without having to collect 3 of them"): a piece with a net catches the
    first piece of theirs it takes on a board whole (two at level 2, three
    at 3), and that piece joins your collection when the board ends
    (netCatches in run.js) instead of leaving a rabbit. Mutates. */
function netIt(taker, victim) {
  if (taker?.weapon !== 'net' || !victim || (taker.netted || 0) >= Math.max(1, Math.min(3, taker.wl || 1))) return;
  if (!PIECES[victim.type]?.betza || ['ball', 'bunny', 'rabbit'].includes(victim.type)) return;
  victim.netted = true;
  taker.netted = (taker.netted || 0) + 1;
}

/** A Changeling that takes a piece takes on its moves (2026-10-15): it is
    in that piece's shape until it takes another. Rabbits, balls and other
    things that are not pieces leave it as it was. A weapon that no longer
    suits the shape goes, as when a pawn promotes. Mutates. */
function reshape(taker, victim) {
  if (!taker || taker.type !== 'changeling' || !victim) return;
  const t = victim.shape || victim.type;
  const P = PIECES[t];
  if (!P?.moves || !P.betza || t === 'ball' || t === 'bunny' || t === 'rabbit' || P.kind === 'neutral' || P.kind === 'quarry') return;
  taker.shape = t === 'changeling' ? undefined : t;
  if (!taker.shape) delete taker.shape;
  if (taker.weapon && taker.shape && !canArm(taker.shape, taker.weapon)) { delete taker.weapon; delete taker.wl; }
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
    it hops from the piece it is on to another of that side's. Since later
    that day (Timothy: "moving the rabbit is now purposeful and costs a turn
    to do for the side that has one. It is no longer random. However,
    there's a setting that exists that allows it to be random again") its
    side moves it, as that side's move for the turn (`rabbitMove:
    'choose'`); with 'random' it hops by itself every `rabbitHop` turns, at
    random. A side whose pieces do not think (nothing to choose with) keeps
    the random hop. */
export const carrierOf = (s, side) => (side === 'you' ? s.pieces : s.foes).find((q) => q.brain === 'carrier' && !q.taken) || null;
/** Is the riding rabbit moved by its side, as a turn? */
export const rabbitChosen = (rules) => rules.goal === 'carrier' && rules.rabbitMove !== 'random';
/** The pieces of `list` the rabbit r could hop onto: any other of its side. */
const perches = (list, r) => list.map((q, j) => j).filter((j) => j !== r.rides && list[j] !== r && !list[j].taken && !list[j].flying && list[j].rides == null && !['bunny', 'ball'].includes(list[j].type) && list[j].x >= 0);
/** The rabbit's moves when its side moves it: onto any other of its pieces. */
function hopMoves(s, side, r) {
  const list = side === 'you' ? s.pieces : s.foes;
  return perches(list, r).map((j) => ({ x: list[j].x, y: list[j].y, cap: false, hop: true }));
}
function carrierHop(s, side) {
  const list = side === 'you' ? s.pieces : s.foes, r = list.find((q) => q.brain === 'carrier' && !q.taken);
  if (!r) return;
  const at = perches(list, r);
  if (!at.length) return;
  const j = at[Math.floor(hash01(`rabbit:${s.day.seed ?? 0}:${s.t}:${side}`) * at.length)];
  r.from = [r.x, r.y]; r.x = list[j].x; r.y = list[j].y; r.rides = j; r.hopped = true;
}
/** How many more of your moves until the riding rabbits hop by themselves
    (only when they hop at random). */
export function hopIn(s) {
  const n = s.day.rules.rabbitHop;
  return s.day.rules.goal === 'carrier' && !rabbitChosen(s.day.rules) && n > 0 ? n - (s.t % n) : null;
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
  // A piece in its bubble (Tile Chess, 2026-10-14: invincible until it
  // first moves in the round) is a wall to the other side: nothing takes it,
  // nothing passes it.
  if (gridFor === s) {
    const v = grid[y * s.day.W + x];
    if (v > 0) return s.pieces[v - 1].type === 'ball' && s.day.rules.ballMove === 'hit' ? ENEMY : side === 'you' ? OWN : bram ? HIDDEN : s.pieces[v - 1].bubble ? STUMP : ENEMY;
    if (v < 0) return side === 'foe' ? OWN : bram ? HIDDEN : s.foes[-v - 1].bubble ? STUMP : ENEMY;
  } else for (const p of s.pieces)
    if (!p.taken && p.x === x && p.y === y) {
      // A ball that is hit (ballMove 'hit') is something either side can
      // move into: the move generators see it as a catch, and landing on it
      // knocks it on instead (knock, below).
      if (p.type === 'ball' && s.day.rules.ballMove === 'hit') return ENEMY;
      return side === 'you' ? OWN : bram ? HIDDEN : p.bubble ? STUMP : ENEMY;
    }
  if (gridFor !== s) for (const f of s.foes)
    if (!f.taken && f.x === x && f.y === y) return side === 'foe' ? OWN : bram ? HIDDEN : f.bubble ? STUMP : ENEMY;
  // The rabbit to capture (goal 'flag', 2026-10-13), while nobody carries
  // it: something either side can take.
  // Your stones (the Stone suit, Adventure): yours to you, something to
  // take to them.
  if (s.stones?.length) for (const t of s.stones) if (t.x === x && t.y === y) return side === 'you' ? OWN : ENEMY;
  if (s.flag && !s.flag.by && s.flag.x === x && s.flag.y === y) return ENEMY;
  if (s.hole && s.hole.x === x && s.hole.y === y && holeOpen(s)) return HOLE;
  const sq = y * s.day.W + x;
  // A statue that can be taken reads as something to take, to either side
  // (not to a ball, which only stops at it).
  if (statueAt(s, sq)) return cutting ? EMPTY : s.day.rules.statuesTake && !s.day.rules.hedges && !ballView ? ENEMY : STUMP;
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
  // The Changeling (Timothy, 2026-10-15: "shelve changeling mode for now ...
  // as a consolation, create a changeling fairy piece"). It steps like a
  // king until it takes something, then moves like the last piece it took,
  // and changes again with every capture (reshape, below). Its shape is
  // p.shape; its Betza code is what it starts as. A shape lasts one board.
  changeling: { name: 'Changeling', kind: 'fairy', tier: 1, value: 3, betza: 'K', strength: 3.5,
    desc: 'Steps one square in any direction until it takes something. From then on it moves like the last piece it took, and changes again with every capture.',
    origin: 'Invented in the Grove, 2026, in place of the Changeling daily.',
    moves: (L, p, fwd, day) => (p.shape && p.shape !== 'changeling' && PIECES[p.shape]?.moves ? PIECES[p.shape].moves(L, p, fwd, day) : leap(L, p, ALL8)) },
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
  // Adventure's own (Timothy, 2026-10-16: "the player has a special new
  // piece call the cat, and it has the move set of the king. it can be given
  // suits and weapons like other pieces, and it is always rolled as one of
  // your pieces when you play. it is your starting piece"). Its own kind, so
  // the daily, their sides and the other modes' pools never deal it.
  cat: { name: 'Cat', kind: 'companion', tier: 1, value: 3, betza: 'K', strength: 3,
    desc: 'Steps one square in any direction, as a king does. Yours from the start, and always one of your set.',
    moves: (L, p) => leap(L, p, ALL8) },
  // Adventure's troupe (Timothy, 2026-10-16: "fairy pieces available
  // currently in adventure, all of them basically new ... they should look
  // like chess pieces, not people"). Their own kind, so only Adventure
  // deals them (the daily's and Chaos's fairy pools are kind 'fairy').
  // The thespian plays a part: p.role is the piece whose moves it has now,
  // a new one at random every time it moves (recast, below). Its Betza code
  // is what it moves as before its first part, as the Changeling's is.
  thespian: { name: 'Thespian', kind: 'troupe', tier: 1, value: 3.5, betza: 'K', strength: 3.75,
    desc: 'Plays a part: it moves as another piece does, and every time it moves it takes a new part, chosen at random.',
    origin: 'Adventure’s troupe, 2026.',
    moves: (L, p, fwd, day) => (p.role && p.role !== 'thespian' && PIECES[p.role]?.moves ? PIECES[p.role].moves(L, p, fwd, day) : leap(L, p, ALL8)) },
  // "one space any straight, then one space any diagonal": straight on and
  // out makes a knight's L that a piece on its first square blocks (the
  // xiangqi horse); turning back on the diagonal lands it one square
  // straight from where it started, so it also steps like a wazir.
  scribe: { name: 'Scribe', kind: 'troupe', tier: 1, value: 3.5, betza: 'nNW', strength: 3.75,
    desc: 'One square straight, then one square diagonally, any way: a knight’s L that a piece on its first square blocks, or, turning back, one square straight.',
    origin: 'Adventure’s troupe, 2026.',
    moves: betzaMoves('nNW') },
  // "knight, but slides instead of hops": the knight's L as a rider.
  painter: { name: 'Painter', kind: 'troupe', tier: 2, value: 6, betza: 'NN', strength: 5,
    desc: 'A knight that slides: the same L again and again in a straight line, until something stops it.',
    origin: 'Adventure’s troupe, 2026; the nightrider of fairy chess.',
    moves: (L, p) => ride(L, p, KNIGHT) },
  // "rook and bishop, but only every other space. hops every other space to
  // get there": two squares at a hop, straight or diagonal, again and again.
  bard: { name: 'Bard', kind: 'troupe', tier: 2, value: 5, betza: 'DDAA', strength: 4.5,
    desc: 'A rook and a bishop on every other square: it hops two squares straight or diagonally, over anything, and on again two at a time while it lands on empty squares.',
    origin: 'Adventure’s troupe, 2026.',
    moves: betzaMoves('DDAA') },
  // "hops to any space two away".
  dancer: { name: 'Dancer', kind: 'troupe', tier: 1, value: 4, betza: 'NAD', strength: 5,
    desc: 'Hops to any square exactly two away, over anything.',
    origin: 'Adventure’s troupe, 2026; the squirrel of fairy chess.',
    moves: (L, p) => leap(L, p, TWO_AWAY) },
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
    moves: (L, p) => leap(L, p, TWO_AWAY) },
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

/** The kinds of rabbit (Adventure, 2026-10-16, Timothy: "rabbit defines
    move behavior. rabbits have a type and a suit now"): what a piece with
    one inside does by itself. A piece's `rabbit` (yours) or its brain
    (theirs: 'possessed' is the robot) says which. */
export const RABBIT_TYPES = ['robot', 'sentry', 'scared', 'sentient', 'simple', 'trap'];
/** The kind of rabbit inside piece p, or null: from its brain (theirs) or
    its `rabbit` (yours). */
export const rabbitIn = (p) => (p?.rabbit && RABBIT_TYPES.includes(p.rabbit) ? p.rabbit : ({ possessed: 'robot', sentry: 'sentry', scared: 'scared', sentient: 'sentient', simple: 'simple', trap: 'trap' })[p?.brain] || null);

/** The parts a thespian can play (Adventure's pieces, no pawn: it only goes
    one way, and no cat, which steps as a king does). */
export const THESPIAN_ROLES = ['king', 'queen', 'rook', 'bishop', 'knight', 'scribe', 'painter', 'bard', 'dancer'];
/** The piece whose moves piece p makes now: a Changeling's borrowed shape,
    a thespian's part, or its own kind. */
export const formOf = (p) => p.shape || p.role || p.type;
/** A thespian takes a new part, at random but the same on every phone: from
    the level, the turn, where it stands and the part it had. Mutates. */
function recast(s, p, salt = '') {
  if (p?.type !== 'thespian' || p.taken) return;
  const roles = THESPIAN_ROLES.filter((r) => r !== p.role);
  p.role = roles[Math.floor(hash01(`role:${s.day.seed ?? 0}:${s.t}:${salt}:${p.x},${p.y}:${p.role || ''}`) * roles.length)];
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
export const HEDGE_DESC = 'A hedge. Nothing can stop on it or slide through it; a leaper, like a knight, hops over. A piece with a sword goes straight through, and cuts down one it stops on.';
export const statueDesc = (rules) => (rules?.hedges ? HEDGE_DESC : rules?.statuesTake ? STATUE_TAKE_DESC : STUMP_DESC);
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
export const EXIT_DESC = 'The way down. It opens beside your piece the moment you take the last of theirs, and your piece jumps in.';
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
  // Bubbles (Tile Chess, 2026-10-14, Timothy: "a rule that gives every
  // piece at the beginning of the round invincibility until it moves for the
  // first time in the round, denoted by a bubble around the piece").
  if (day.rules.bubbles) for (const q of [...s.pieces, ...s.foes]) if (!['ball', 'bunny', 'rabbit'].includes(q.type)) q.bubble = true;
  // Your set, taking turns on one square (Adventure, 2026-10-15): the piece
  // on the board is the first of them.
  if (day.cycle?.length > 1) { s.set = day.cycle.map((e) => ({ ...e })); s.ci = 0; }
  if (day.rules.tactics) s.stones = [];
  // A thespian's first part (Adventure's troupe, 2026-10-16), drawn from the
  // level, so the same board deals it the same part.
  const cast = (p, salt) => { if (p.type === 'thespian' && !p.role) p.role = THESPIAN_ROLES[Math.floor(hash01(`cast:${day.seed ?? 0}:${salt}`) * THESPIAN_ROLES.length)]; };
  s.pieces.forEach((p, i) => cast(p, `you${i}`));
  s.foes.forEach((f, k) => cast(f, `foe${k}`));
  (s.set || []).forEach((e, j) => { if (j === s.ci) e.role = s.pieces[0].role; else cast(e, `set${j}`); });
  // A simple rabbit of theirs (2026-10-16) takes its line: toward you.
  for (const f of s.foes) if (f.brain === 'simple' && !f.dir) planLine(s, f, 'foe');
  if (day.rules.first === 'them') { foesAct(s); s.opened = true; }
  return s;
}

// --- Your set, chosen from (Adventure, 2026-10-15). --------------------------
// First (Timothy: "every turn you cycle through your piece set. so there is
// still always just one piece on the board") the piece on the board became
// the next of the set after every move. Then: "you don't automatically
// cycle between your pieces, you choose between your set. sets are three
// instead of five now. however, you have to use all three before you can
// use them again." So the board holds one piece of yours, on one square;
// each move you choose which of your set it is (the move's `as`, an index
// into the set), from those that are ready, and it moves. Once moved it is
// used for the round; when none is ready any more, the round starts again
// and all are. A piece of Gears has two turns a round. Each piece keeps
// what is its own (its suit, its weapon, a heart spent, a Changeling's
// borrowed shape) while it waits.

/** What a piece carries that is about where it is and what is happening to
    it now, not what it is: these stay on the board when it changes. */
const PLACE = ['x', 'y', 'from', 'taken', 'rides', 'stun', 'bubble', 'ate', 'blocked', 'rested', 'wounded', 'splash'];

/** Piece j of your set as it is now (the one on the board is pieces[0]). */
const inSet = (s, j) => (j === s.ci ? s.pieces[0] : s.set[j]);
/** How many turns a round a piece of the set has: Gears two, the rest one. */
export const turnsOf = () => 1;
/** Can piece j of your set move this turn: still yours, and with a turn
    left this round? */
export const setReady = (s, j) => { const e = inSet(s, j); return !!e && !e.lost && !e.taken && e.out == null && (e.used || 0) < turnsOf(e); };

/** Bring piece j of your set onto the board, on the same square. Mutates. */
function bringOn(n, j) {
  if (j === n.ci) return;
  const p = n.pieces[0], own = {}, keep = {};
  for (const [k, v] of Object.entries(p)) (PLACE.includes(k) ? keep : own)[k] = v;
  n.set[n.ci] = own;
  n.ci = j;
  n.pieces[0] = { ...n.set[j], ...keep };
}
/** The state with piece j of your set on the board instead (it must be
    ready): what choosing it looks like before it moves. */
export function chooseInSet(s, j) {
  if (!s.set || j === s.ci || !setReady(s, j)) return s;
  const n = clone(s);
  bringOn(n, j);
  return n;
}
/** The end of your turn: the piece that moved has had its turn this round;
    if none of the set is ready now, a new round starts. Mutates. */
function spendTurn(n) {
  const p = n.pieces[0];
  if (!n.set || !p || p.taken) return;
  p.used = (p.used || 0) + 1;
  // In Adventure the round ends at the start of their turn (deploy), when
  // the pieces standing on the board come off.
  if (n.day.rules.suitRabbits || n.set.some((_, j) => setReady(n, j))) return;
  for (let j = 0; j < n.set.length; j++) { const e = inSet(n, j); if (!e.lost && e.out == null) delete e.used; }
  // A new round (the page starts it again from the first of the set).
  n.round = (n.round || 0) + 1;
}
/** The first of your set that is ready, from the one after the piece on the
    board, round to it; -1 if none. */
export function firstReady(s) {
  const L = s.set.length;
  for (let k = 1; k <= L; k++) if (setReady(s, (s.ci + k) % L)) return (s.ci + k) % L;
  return -1;
}
/** How many of your set are still yours (the one on the board included). */
export const setLeft = (s) => (s.set ? s.set.filter((e, j) => (j === s.ci ? !s.pieces[0]?.taken : e.out != null ? !s.pieces[e.out]?.taken : !e.lost)).length : s.pieces.filter((p) => !p.taken).length);

/** A piece of your set taken (Adventure, 2026-10-15, Timothy: "you need to
    lose all your pieces to lose the game and you don't just go to the next
    level if you lose one"): it is out of the set for the rest of the board
    (it comes back on the next), and one of the rest comes on where it was
    taken (entrySpot): the first that is ready (if none is, a new round
    starts). You can still
    choose another before you move. The board is lost only when none is
    left. `arrived` says what happened, for the page; it is not kept.
    Mutates. */
function nextAfterLoss(n) {
  const p = n.pieces[0];
  if (!n.set || !p?.taken || n.won) return;
  const own = {};
  for (const [k, v] of Object.entries(p)) if (!PLACE.includes(k)) own[k] = v;
  const others = () => n.set.map((_, j) => j).filter((j) => j !== n.ci && !n.set[j].lost && n.set[j].out == null);
  // Adventure (2026-10-16): none of the rest ready means the set has all
  // been played: a new round. The pieces standing come off the board, and
  // the first comes on where this one was taken.
  if (n.day.rules.suitRabbits && !others().some((j) => setReady(n, j)) && alliesOf(n).length) {
    n.set[n.ci] = { ...own, lost: true };
    if (n.day.rules.stayBehind === 'tactics') return freePlay(n);
    newRound(n);
  }
  const live = others();
  if (!live.length) return recall(n, p);
  const at = entrySpot(n, p);
  if (!at) return;
  n.set[n.ci] = { ...own, lost: true };
  if (!live.some((j) => setReady(n, j))) for (const j of live) delete n.set[j].used;
  const L = n.set.length;
  let j = live[0];
  for (let k = 1; k <= L; k++) if (live.includes((n.ci + k) % L) && setReady(n, (n.ci + k) % L)) { j = (n.ci + k) % L; break; }
  n.arrived = { lost: { ...p }, from: n.ci };
  n.ci = j;
  n.pieces[0] = { ...n.set[j], x: at.x, y: at.y };
  if (n.pending === j) n.pending = null;
}

/** The last of your set taken while pieces of yours with a rabbit still
    stand (2026-10-16): the first of them is your piece again, where it
    stands. Mutates. */
function recall(n, p) {
  const k = n.pieces.findIndex((q, i) => i > 0 && q.ally && !q.taken);
  const j = k < 0 ? -1 : n.set.findIndex((e) => e.out === k);
  if (j < 0) return;
  const own = {};
  for (const [key, v] of Object.entries(p)) if (!PLACE.includes(key)) own[key] = v;
  n.set[n.ci] = { ...own, lost: true };
  const a = n.pieces[k], back = {};
  for (const [key, v] of Object.entries(a)) if (!['ally', 'fresh', 'pattern', 'route', 'i', 'mx', 'my', 'patternName', 'mind', 'struck', 'fled', 'trapped', 'blocked'].includes(key)) back[key] = v;
  n.arrived = { lost: { ...p }, from: n.ci, recalled: k };
  delete n.set[j].out;
  n.ci = j;
  n.pieces[0] = back;
  n.pieces[k] = { ...a, taken: true, recalled: true };
}

/** What a piece standing by itself carries that is about standing there,
    not about what it is: left behind when it comes off the board. */
const ALLY_ONLY = ['ally', 'fresh', 'pattern', 'route', 'i', 'mx', 'my', 'patternName', 'mind', 'struck', 'fled', 'trapped', 'blocked', 'dir'];

/** A new round (Adventure, 2026-10-16, Timothy: "after the full set is
    played, they are removed from the board and then it starts again"):
    every piece of yours standing by itself comes off the board, back into
    your set as it is now (one taken while it stood is out for the board),
    and every piece of the set is ready again. The piece on the board stays:
    the new round starts where it stands. Those lifted stay in s.pieces, in
    their places, taken and `lifted`, for the page to show them going; the
    next piece left standing clears them away (deploy). Mutates. */
function newRound(n) {
  let lifted = 0;
  n.set.forEach((e, j) => {
    if (j === n.ci || e.out == null) return;
    const k = e.out, a = n.pieces[k];
    if (!a || a.taken) { const { out, ...rest } = e; n.set[j] = { ...rest, lost: true }; return; }
    const back = {};
    for (const [key, v] of Object.entries(a)) if (!PLACE.includes(key) && !ALLY_ONLY.includes(key)) back[key] = v;
    delete back.used;
    n.set[j] = back;
    n.pieces[k] = { ...a, taken: true, lifted: true };
    lifted++;
  });
  for (let j = 0; j < n.set.length; j++) { const e = inSet(n, j); if (!e.lost) delete e.used; }
  n.round = (n.round || 0) + 1;
  n.pending = null;
  if (lifted) n.lifted = lifted;
}

/** Stone (Adventure, 2026-10-15, Timothy: "stone suit now leaves behind a
    sentry of their piece each time it moves? and it lasts for three moves
    than disappears"): how many turns a stone stands, their turn just after
    it is left counted first. */
export const STONE_TURNS = 2;
/** The end of a whole turn: every stone of yours has a turn less, and
    crumbles away when it has none left. Mutates. */
function stonesAge(n) {
  if (!n.stones?.length) return;
  for (const t of n.stones) t.left = (t.left ?? STONE_TURNS) - 1;
  n.stones = n.stones.filter((t) => t.left > 0);
}
/** Everything at the end of a whole turn of theirs: your stones age, your
    vines wither (theirs wait for your move), a lost piece is replaced, and a
    board their turn cleared (a vine or a stone taking the last) opens its
    hole. Mutates. */
function turnOver(n) {
  stonesAge(n);
  if (n.vines) n.vines = n.vines.filter((v) => v.side !== 'you');
  if (n.won && n.day.rules.goal === 'clear' && !n.hole) n.hole = exitSpot(n);
  starve(n);
  nextAfterLoss(n);
  // Adventure (2026-10-16): the whole set has played, so the pieces
  // standing come off and a new round starts. (Tactics: they stay, and
  // from now on move freely.)
  if (n.set && n.day.rules.suitRabbits && !n.won && n.pieces[0] && !n.pieces[0].taken && !n.set.some((_, j) => setReady(n, j))) {
    if (n.day.rules.stayBehind === 'tactics') freePlay(n); else newRound(n);
  }
}

/** The dark (rules.starve, Adventure, 2026-10-17, Timothy: "a point at
    which your pieces start to get eaten every turn or something, like
    past a double bogey"): from that many moves on, at the end of each of
    their turns the dark takes a piece of yours: the one on the board (or,
    moving freely, the first still standing). A heart holds once, as
    always. Taken, the next of your set comes on (nextAfterLoss); the last
    taken loses the board. Mutates. */
function starve(n) {
  const at = n.day.rules.starve;
  if (!at || n.t + 1 < at || n.won || lost(n)) return; // (n.t counts up after this)
  const i = n.free ? n.pieces.findIndex((p) => !p.taken) : 0, p = n.pieces[i];
  if (!p || p.taken) return;
  const gone = capturePiece(n, p, -1);
  (n.tlog = n.tlog || []).push({ what: 'starve', i, held: !gone });
}

/** Adventure Tactics (rules.stayBehind 'tactics', Timothy, 2026-10-17: "you
    have three pieces in a set, and you play them like you do now, and they
    stay where the are, but then once you play the three, you then can move
    them each one by one like regular chess, for the rest of the level"):
    the set is done with, and every piece of yours still on the board is
    yours to move, any one a turn. One with a rabbit no longer acts by
    itself. Mutates. */
function freePlay(n) {
  n.pieces = n.pieces.map((p) => {
    if (p.taken) return p;
    const q = { ...p };
    for (const k of [...ALLY_ONLY, 'used', 'idle']) delete q[k];
    return q;
  });
  delete n.set; delete n.ci; delete n.round;
  n.pending = null;
  n.free = true;
  n.freed = true; // this turn: for the page to say so
}

// --- Vines (Adventure's suits as rabbits, 2026-10-16). -----------------------
// Timothy: "vine: leaves a vine between previous location and new one, if
// next turn an enemy moves into it it captures them. disappears after one
// turn <-> same for enemy". A piece with a vines rabbit leaves a vine on
// the square it moves off and every square it passes on the way (a leap
// goes along its long side, then its short one, as the routes are drawn).
// The other side's next move that lands on one is caught by it. Yours
// wither at the end of their turn; theirs at the end of yours.

/** The squares a move from (ax, ay) to (bx, by) leaves a vine on: where it
    started and where it went on the way, not where it landed. */
export function trailOf(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, out = [[ax, ay]];
  if (!dx && !dy) return [];
  let x = ax, y = ay;
  const step = (tx, ty) => { while (x !== tx || y !== ty) { x += Math.sign(tx - x); y += Math.sign(ty - y); if (x !== bx || y !== by) out.push([x, y]); } };
  if (!dx || !dy || Math.abs(dx) === Math.abs(dy)) step(bx, by);
  else { step(...(Math.abs(dx) > Math.abs(dy) ? [bx, ay] : [ax, by])); step(bx, by); }
  return out;
}
/** Leave `side`'s vines along a move. Only on open ground: not on a piece,
    a statue, the hole, water or ground that is gone. Mutates. */
function addTrail(n, side, ax, ay, bx, by) {
  n.vines = n.vines || [];
  for (const [x, y] of trailOf(ax, ay, bx, by)) {
    if (!onBoard(n.day, x, y) || crumbled(n, x, y) || shrunk(n, x, y) || statueAt(n, y * n.day.W + x) || waterAt(n, y * n.day.W + x)) continue;
    if ((n.hole && n.hole.x === x && n.hole.y === y) || n.pieces.some((p) => !p.taken && p.x === x && p.y === y) || n.foes.some((f) => !f.taken && f.x === x && f.y === y)) continue;
    if (!n.vines.some((v) => v.x === x && v.y === y && v.side === side)) n.vines.push({ x, y, side });
  }
}
/** Is a vine of `side` on (x, y)? If so it is used up. Mutates. */
function takeVine(n, side, x, y) {
  const i = n.vines?.findIndex((v) => v.side === side && v.x === x && v.y === y) ?? -1;
  if (i < 0) return false;
  n.vines.splice(i, 1);
  return true;
}
/** A move through a vine (2026-10-17, Timothy: "it should leave a vine in
    your paths and if enemy move through it in the next turn, they get
    captured"): the first square on the way of piece p's move m, not where
    it lands, with a vine of `side` on it, as a move that stops there (and
    is caught there); null if there is none. Before, only landing on one
    caught, which a slide could pass straight over. */
function vineCut(s, side, p, m) {
  if (!s.vines?.length || !s.day.rules.suitRabbits || m.swap || m.hop || m.wrapped) return null;
  const W = s.day.W;
  for (const q of between(W, p.x, p.y, m.x, m.y)) if (s.vines.some((v) => v.side === side && v.y * W + v.x === q)) return { x: q % W, y: Math.floor(q / W), cap: false };
  return null;
}
/** Piece k of yours (one standing by itself) makes move m: a vine of
    theirs on its way stops it, its weapon's work, landing, and a vine of
    theirs where it stops catches it. Mutates. */
function moveMine(s, k, m) {
  const p = s.pieces[k];
  m = vineCut(s, 'foe', p, m) || m;
  armsBefore(s, 'you', k, m); landMine(s, k, m.x, m.y, m); armsAfter(s, 'you', k, m); settleRevivals(s);
  if (s.day.rules.suitRabbits && !p.taken && s.vines && takeVine(s, 'foe', p.x, p.y)) { p.vined = true; if (!capturePiece(s, p, -1)) delete p.vined; settleRevivals(s); }
}
/** Where the next of your set comes on after a loss: the square the lost
    one was taken on (`e`), or the free square nearest it. */
function entrySpot(n, e = n.day.pieces[0]) {
  // Since 2026-10-16 (Timothy: "when a piece of yours is to be destroyed in
  // a level, don't then move the player position, the next piece in the
  // lineup simply appears in that spot"): the square it was taken on, or,
  // if one of theirs stands there now, the nearest free square to it (out
  // of their reach if one is as near).
  // (Where theirs could move or take next turn: foeDanger, lighter than
  // reachMaps, since the solver comes here for every loss it looks at.)
  const W = n.day.W, H = n.day.H, reach = foeDanger(n), spots = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!onBoard(n.day, x, y) || statueAt(n, y * W + x) || crumbled(n, x, y) || shrunk(n, x, y) || waterAt(n, y * W + x)) continue;
    if (n.foes.some((f) => !f.taken && f.x === x && f.y === y) || n.stones?.some((t) => t.x === x && t.y === y)) continue;
    if (n.hole && n.hole.x === x && n.hole.y === y) continue;
    // Nor where a piece of yours stands (one with a rabbit, 2026-10-16).
    if (n.pieces.some((p) => !p.taken && p.x === x && p.y === y)) continue;
    spots.push({ x, y, hot: reach.has(y * W + x) ? 1 : 0, d: Math.max(Math.abs(x - e.x), Math.abs(y - e.y)), m: Math.abs(x - e.x) + Math.abs(y - e.y) });
  }
  spots.sort((a, b) => a.d - b.d || a.hot - b.hot || a.m - b.m || a.y - b.y || a.x - b.x);
  return spots[0] || null;
}

/** Your set, in its own order: each piece as it is now, its index, and
    whether it is on the board, ready, used this round, or lost. */
export function setView(s) {
  if (!s.set) return [];
  // A piece standing by itself with its rabbit (`out`) is shown as it
  // stands on the board.
  return s.set.map((e, j) => { const out = j !== s.ci && e.out != null, p = out ? s.pieces[e.out] : inSet(s, j); return { p, j, on: j === s.ci, out, ready: setReady(s, j), used: p.used || 0, lost: !!p.lost || ((j === s.ci || out) && !!p.taken) }; });
}

export function clone(s) {
  // Field by field, not by spreading (for speed, 2026-10-16: the solver
  // clones a state for every position it looks at).
  const n = { day: s.day, t: s.t, pieces: s.pieces.map((p) => ({ ...p })), foes: s.foes.map((f) => ({ ...f })),
    hole: s.hole ? { ...s.hole } : null, gone: s.gone.slice(), shrunk: s.shrunk ? s.shrunk.slice() : [], open: s.open ? s.open.slice() : [], won: s.won, sunk: s.sunk,
    bonus: s.bonus || null, treasure: s.treasure || 0, foeTreasure: s.foeTreasure || 0, ft: s.ft || 0 };
  if (s.cloudy) n.cloudy = true;
  if (s.ghostGone) { n.ghostGone = s.ghostGone.slice(); n.ghostsLost = s.ghostsLost || 0; }
  if (s.clouds) n.clouds = s.clouds.map((c) => ({ ...c }));
  if (s.flag) n.flag = { ...s.flag };
  if (s.flagLost) n.flagLost = true;
  if (s.ep) n.ep = { ...s.ep };
  if (s.set) { n.set = s.set.map((e) => ({ ...e })); n.ci = s.ci; n.round = s.round || 0; }
  if (s.stones) n.stones = s.stones.map((t) => ({ ...t }));
  if (s.vines) n.vines = s.vines.map((v) => ({ ...v }));
  if (s.turnFrom) n.turnFrom = s.turnFrom;
  if (s.pending != null) n.pending = s.pending;
  if (s.free) n.free = true;
  return n;
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
/** While true, look() reads a hedge as open ground: a sword cuts through
    (rules.hedges, Adventure, 2026-10-17). */
let cutting = false;

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
  if (p.suit === 'spirals' && !s.day.rules.wrap && !s.day.rules.suitRabbits) return pieceMoves0(wrapView(s), p, side);
  let ms;
  if (p.type === 'ball') { ballView = true; try { ms = PIECES[p.type].moves(sight(s, p, side), p, 1, s.day); } finally { ballView = false; } }
  else ms = PIECES[p.type].moves(sight(s, p, side), p, side === 'you' ? 1 : -1, s.day);
  // A rabbit rides one piece at a time: not onto a rabbit, a ball, or a
  // head that already has a rider.
  if (p.type === 'bunny') {
    const own = side === 'you' ? s.pieces : s.foes;
    ms = ms.filter((m) => { const there = own.filter((q) => q !== p && !q.taken && q.x === m.x && q.y === m.y); return !there.length || (there.length === 1 && !['bunny', 'ball'].includes(there[0].type)); });
  }
  // Pawns (2026-10-14, Timothy: "Pawns should have en passant and moving
  // two squares as the first move in all modes by default"): a pawn that
  // has not moved yet this game may step two, if both squares ahead are
  // empty; and one that stands beside a pawn of the other side that has
  // just stepped two may take it as it passes, landing on the square it
  // passed over (the move's `ep` is the square of the pawn it takes).
  if (p.type === 'pawn' && s.day.rules.pawnTwo && !p.moved && !s.day.rules.pawnDouble) {
    const f = side === 'you' ? 1 : -1, L = sight(s, p, side);
    if (L(p.x, p.y + f) === EMPTY && L(p.x, p.y + 2 * f) === EMPTY) ms = [...ms, { x: p.x, y: p.y + 2 * f, cap: false, two: true }];
  }
  if (p.type === 'pawn' && s.day.rules.enPassant && s.ep && s.ep.side !== side) {
    const f = side === 'you' ? 1 : -1, W = s.day.W, ex = s.ep.at % W, ey = (s.ep.at / W) | 0;
    if (ey === p.y + f && Math.abs(ex - p.x) === 1 && sight(s, p, side)(ex, ey) === EMPTY && enemyOn(s, side, s.ep.pawn)?.type === 'pawn')
      ms = [...ms, { x: ex, y: ey, cap: false, ep: s.ep.pawn }];
  }
  // Chess variants (2026-10-11): a pawn on its starting row may step two,
  // if both squares ahead are empty. (No en passant.)
  if (s.day.rules.pawnDouble && p.type === 'pawn') {
    const f = side === 'you' ? 1 : -1, L = sight(s, p, side);
    if (p.y === (f > 0 ? 1 : s.day.H - 2) && L(p.x, p.y + f) === EMPTY && L(p.x, p.y + 2 * f) === EMPTY) ms = [...ms, { x: p.x, y: p.y + 2 * f, cap: false }];
  }
  // Hedges (rules.hedges, Adventure, 2026-10-17, Timothy: "can be moved
  // through if one has a sword, otherwise can only be hopped over"): a piece
  // with a sword goes through them as if they were open ground, and one it
  // stops on it cuts down (`cut`).
  if (p.weapon === 'sword' && s.day.rules.hedges && s.day.stumps.size) {
    const seen = new Set(ms.map((m) => m.y * s.day.W + m.x));
    let more;
    cutting = true;
    try { more = PIECES[p.type].moves(sight(s, p, side), p, side === 'you' ? 1 : -1, s.day); } finally { cutting = false; }
    for (const m of more) {
      const q = m.y * s.day.W + m.x;
      if (seen.has(q)) continue;
      seen.add(q);
      ms = [...ms, statueAt(s, q) ? { ...m, cap: false, cut: q } : m];
    }
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
  // A rabbit riding your pieces (goal 'carrier'): moved by you, onto
  // another of your pieces, as your move; or never, if it hops at random.
  if (p.brain === 'carrier') return rabbitChosen(s.day.rules) ? hopMoves(s, 'you', p) : [];
  // Stunned by a mace (2026-10-13): it sits out this turn.
  if (p.stun) return [];
  let ms = pieceMoves(s, p, 'you');
  if (s.day.rules.ballMove === 'hit') ms = ms.filter((m) => hitOk(s, p, m));
  if (s.bonus?.cap) return ms.filter(takesAny);
  if (s.bonus?.noCap) ms = ms.filter((m) => !takesAny(m));
  if (s.day.rules.noCheck) ms = ms.filter((m) => !givesCheck(s, 'you', i, m));
  if (s.day.rules.promote === 'copy' && p.type === 'pawn') ms = promoteChoices(s, 'you', i, ms);
  // Gears (Spirals until 2026-10-13): it may trade squares with any other
  // piece of yours.
  if (p.suit === 'gears' && !s.day.rules.suitRabbits) {
    s.pieces.forEach((q, k) => { if (k !== i && !q.taken && q.type !== 'ball' && q.rides == null && q.brain !== 'carrier') ms.push({ x: q.x, y: q.y, cap: false, swap: true }); });
  }
  // Gears in Adventure (2026-10-16, Timothy: "gears - copper - swap places
  // with another piece"): as its move, it can trade squares with any other
  // piece on the board, yours or theirs. (It changed gear, moving as any
  // piece of your set, from earlier that day.)
  // Not with one it could squash where it stands: taking it is the move,
  // and asking which every time was a nuisance (Timothy, 2026-10-16, of a
  // popup on moving his cat).
  if (p.suit === 'gears' && s.day.rules.suitRabbits) {
    const takes = new Set(ms.filter((m) => m.cap).map((m) => m.y * s.day.W + m.x));
    for (const q of [...s.pieces, ...s.foes]) {
      if (q === p || q.taken || q.flying || q.rides != null || q.x < 0 || ['ball', 'bunny', 'rabbit'].includes(q.type) || takes.has(q.y * s.day.W + q.x)) continue;
      ms.push({ x: q.x, y: q.y, cap: false, swap: true });
    }
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
function openBonus(n, i, took, wasBonus, caught = took) {
  const p = n.pieces[i];
  if (n.won || p.taken || lost(n)) return;
  // With suits as rabbits (Adventure, 2026-10-16) the chain is Spirals'
  // (Vines leave a trail instead), and Stars move twice every turn they go.
  // Spirals chains on a capture only (2026-10-16): a hit a heart holds sends
  // the hitter back and ends it, or two hearts cost no more than one move.
  const sr = n.day.rules.suitRabbits, chain = sr ? 'spirals' : 'vines';
  if (p.suit === chain && (sr ? caught : took) && pieceMoves(n, p, 'you').some(takesAny)) { n.bonus = { p: i, cap: true, why: chain }; return; }
  // Stars in Adventure (2026-10-16, Timothy: "two moves, can still only
  // capture once"): if the first move took something, the second cannot.
  if (p.suit === 'stars' && (sr || !p.starUsed) && !wasBonus) { p.starUsed = true; n.bonus = { p: i, cap: false, why: 'stars', ...(sr && took ? { noCap: true } : {}) }; }
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
  // Their riding rabbit: moved by them, as their move (goal 'carrier').
  if (!f.taken && f.brain === 'carrier') return rabbitChosen(s.day.rules) && s.foes.some((q) => !q.taken && q.brain === 'ai') ? hopMoves(s, 'foe', f) : [];
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
    // Waiting ends a turn a suit left open (after Gears, only if the piece
    // that came on cannot move).
    for (const m of movesFor(s, s.bonus.p)) out.push({ p: s.bonus.p, ...m });
    return [{ p: -1, x: 0, y: 0, cap: false }, ...out];
  }
  // Your set (Adventure): every move of every piece of it that is ready,
  // each saying which it is.
  if (s.set) {
    // Each ready piece is stood on the square in turn, in place (no copy of
    // the state: the solver lists these at every position it looks at), and
    // the one that was there is put back.
    const p0 = s.pieces[0], keep = {}, ready = s.set.map((_, j) => setReady(s, j));
    for (const k of PLACE) if (k in p0) keep[k] = p0[k];
    try {
      s.set.forEach((_, j) => {
        if (!ready[j]) return;
        s.pieces[0] = j === s.ci ? p0 : { ...s.set[j], ...keep };
        for (const m of movesFor(s, 0)) out.push({ p: 0, ...m, as: j });
      });
    } finally { s.pieces[0] = p0; }
    return s.day.rules.wait || !out.length ? [{ p: -1, x: 0, y: 0, cap: false }, ...out] : out;
  }
  s.pieces.forEach((_, i) => { for (const m of movesFor(s, i)) out.push({ p: i, ...m }); });
  return s.day.rules.wait || !out.length ? [{ p: -1, x: 0, y: 0, cap: false }, ...out] : out;
}

const canMove = (s) => (s.set && !s.bonus ? allMoves(s).some((m) => m.p >= 0) : s.pieces.some((_, i) => movesFor(s, i).length));

export function isLegal(s, mv) {
  if (mv.p === -1) return !s.won && (!!s.bonus || s.day.rules.wait || !canMove(s));
  if (mv.p < 0 || mv.p >= s.pieces.length || s.pieces[mv.p].taken) return false;
  // A piece of yours with a rabbit moves by itself, not by you.
  if (s.pieces[mv.p].ally) return false;
  // Your set (Adventure): the piece chosen must be ready (a turn a suit
  // left open is the same piece's).
  if (s.set && !s.bonus) { const j = mv.as ?? s.ci; if (!setReady(s, j)) return false; s = chooseInSet(s, j); }
  return movesFor(s, mv.p).some((m) => m.x === mv.x && m.y === mv.y);
}

function goalMet(s) {
  const g = s.day.rules.goal, F = s.foes;
  if (g === 'hole' || g === 'descent' || g === 'flag') return false; // only the ball in the hole, or the rabbit brought home, wins
  // Take them all, then the hole (Adventure): taking the last of theirs
  // wins, and your piece jumps into the hole that opens beside it.
  if (g === 'clear') return F.every((f) => !f.target || f.taken);
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

/** A piece of `side` (index i) moving to (x, y) by move m: it has moved
    (no two-square step for a pawn after that); a pawn stepping two leaves
    the square it passed over open to en passant; and taking en passant
    takes the pawn that passed. Mutates. */
function enPassant(n, side, p, i, x, y, m) {
  if (m?.ep != null) {
    const e = enemyOn(n, side, m.ep);
    if (e) { if (side === 'you') captureFoe(n, e, i); else capturePiece(n, e, i); }
  }
  if (p.type === 'pawn' && m?.two) n.ep = { at: ((p.y + y) / 2) * n.day.W + x, pawn: y * n.day.W + x, side };
  p.moved = true;
}

/** A foe lands on (x, y), taking whatever of yours is there. `m`, the move
    it made, if it made one: it may promote. Mutates. */
function landFoe(s, f, x, y, m = null) {
  const k = s.foes.indexOf(f);
  delete f.bubble;
  // A vine of yours on its way stops it there, to be caught (2026-10-17).
  const cut = vineCut(s, 'you', f, { x, y, swap: m?.swap, hop: m?.hop, wrapped: m?.wrapped });
  if (cut) { x = cut.x; y = cut.y; m = null; }
  enPassant(s, 'foe', f, k, x, y, m);
  // A rabbit of theirs hopping onto one of their heads rides there.
  const mate = f.type === 'bunny' ? s.foes.find((q) => q !== f && !q.taken && q.x === x && q.y === y) : null;
  if (mate) { f.ate = -1; f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; f.rides = s.foes.indexOf(mate); return; }
  // Gears: landing on another piece of theirs trades squares with it, and
  // a rabbit riding either goes with its carrier.
  const swap = f.suit === 'gears' && !s.day.rules.suitRabbits ? s.foes.find((q) => q !== f && !q.taken && q.rides == null && q.x === x && q.y === y) : null;
  if (swap) {
    const j = s.foes.indexOf(swap), fx = f.x, fy = f.y;
    f.ate = -1; f.from = [fx, fy]; f.x = x; f.y = y; f.blocked = false;
    swap.from = [x, y]; swap.x = fx; swap.y = fy;
    s.foes.forEach((q) => { if (q.taken) return; if (q.rides === k) { q.x = x; q.y = y; } else if (q.rides === j) { q.x = fx; q.y = fy; } });
    return;
  }
  const b = hitBall(s, x, y);
  if (b) { knock(s, b, f.x, f.y); f.ate = -1; f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; return; }
  // A stone of yours where it lands is broken (Adventure).
  const st = s.stones?.findIndex((t) => t.x === x && t.y === y) ?? -1;
  if (st >= 0) { s.stones.splice(st, 1); f.broke = true; }
  f.ate = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y && p.rides == null);
  f.wounded = -1;
  // Taking it, or (Hearts, 2026-10-13) sending it home with a life less.
  if (f.ate >= 0 && !capturePiece(s, s.pieces[f.ate], k)) { f.wounded = f.ate; f.ate = -1; }
  // A heart of yours spent (Adventure): your piece stays, and theirs goes
  // back where it came from, lunging and back (`struck`, for the page).
  if (f.wounded >= 0 && s.day.rules.suitRabbits) { f.from = [f.x, f.y]; f.struck = [x, y]; f.bounced = true; f.blocked = false; recast(s, f, 'b' + k); return; }
  f.from = [f.x, f.y]; f.x = x; f.y = y; f.blocked = false; delete f.rides;
  s.foes.forEach((q) => { if (q.rides === k && !q.taken) { q.from = [q.x, q.y]; q.x = x; q.y = y; } });
  // The rabbit to capture, picked up where it sits.
  if (flagFree(s, y * s.day.W + x)) { s.flag.by = 'foe'; s.flag.i = k; }
  // A pawn of theirs on your first row: a copy of one of theirs (the
  // descent), or a queen (chess variants, 2026-10-11).
  if (m?.promote && f.type === 'pawn' && PIECES[m.promote]) promoteTo(f, m.promote);
  else if (s.day.rules.promote === true && f.type === 'pawn' && y === 0) f.type = 'queen';
  // A vine of yours where it lands catches it (Adventure's Vines).
  if (s.vines && takeVine(s, 'you', x, y)) { captureFoe(s, f, -1); s.tlog?.push({ what: 'vine', side: 'you', k }); }
  recast(s, f, 'f' + k);
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
  if (!m.swap && !m.hop) passGhosts(s, 'foe', fx, fy, m.x, m.y, m.wrapped);
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
function possessedStep(s, f, force = false, noTake = false) {
  const raw = f.pattern[f.i];
  f.i = (f.i + 1) % f.pattern.length;
  f.from = [f.x, f.y]; f.ate = -1; f.blocked = false; f.rested = false; delete f.bounced;
  if (!raw[0] && !raw[1] && !force) { f.rested = true; return; }
  // Made to move (foesMust): a pause or a blocked way still moves, by the
  // move that heads most nearly where the step points (a pause: the
  // shortest move there is).
  const [dx, dy] = raw[0] || raw[1] ? patternStep(s, f, raw) : [0, 0];
  const [tx, ty] = fold(s.day, f.x + dx, f.y + dy), take = canTake(s.day.rules, f) && !noTake;
  let best = null, bk = null;
  for (const m of pieceMoves(s, f, 'foe')) {
    const ball = m.cap && hitBall(s, m.x, m.y);
    if (ball ? !hitOk(s, f, m) : m.cap && !take) continue;
    // A route (Adventure) goes to its next square or nowhere: anything in
    // the way that it may not take, it waits for.
    if (f.route && (m.x !== tx || m.y !== ty)) continue;
    // (On a magic board, distances go the short way round.)
    const mx = delta(s.day, m.x - f.x, 'x'), my = delta(s.day, m.y - f.y, 'y');
    const off = mx * dx + my * dy <= 0;
    if (off && !force) continue; // not this way
    const key = [off ? 1 : 0, delta(s.day, m.x - tx, 'x') ** 2 + delta(s.day, m.y - ty, 'y') ** 2, mx * mx + my * my, m.y, m.x];
    if (!bk || before(key, bk)) { best = m; bk = key; }
  }
  // A piece walking a route (Adventure) that cannot take its step tries the
  // same step next turn, so it never falls out of step with its route.
  if (!best) { f.blocked = true; if (f.route) f.i = (f.i + f.pattern.length - 1) % f.pattern.length; return; }
  foeLand(s, s.foes.indexOf(f), best);
  // Bounced off a heart (Adventure): back home, it tries the step again.
  if (f.bounced && f.route) f.i = (f.i + f.pattern.length - 1) % f.pattern.length;
}

/**
 * Where a piece of theirs would walk with pattern `steps` from where it
 * stands: the squares of one whole turn round the pattern, on the level as
 * dealt and with nothing else moving. Null if it would ever be blocked,
 * bounce off an edge, or not end back where it began, facing the same way.
 * For dealing Adventure's routes (lab.js), which have to be safe from
 * getting stuck. Does not change s.
 */
export function routeSquares(s, k, steps) {
  const c = clone(s), f = c.foes[k];
  c.pieces = []; // nothing of yours in the way: a route is checked bare
  Object.assign(f, { pattern: steps, i: 0, mx: 1, my: 1, brain: 'possessed', route: true });
  const W = s.day.W, home = f.y * W + f.x, out = [home];
  for (let n = 0; n < steps.length; n++) {
    possessedStep(c, f);
    if (f.blocked || f.mx !== 1 || f.my !== 1) return null;
    const at = f.y * W + f.x;
    if (!out.includes(at)) out.push(at);
  }
  return f.y * W + f.x === home ? out : null;
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
  const W = s.day.W, yours = new Set(), theirs = new Set(), sentry = new Set();
  const stones = new Set(), steps = new Set();
  if (s.won) return { yours, theirs, threat: theirs, sentry, stones, steps };
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
    // Adventure's crowned leader takes only in answer to a check, so its
    // reach is no danger to stand in either (2026-10-15).
    if (f.taken || f.flying || f.brain === 'pattern' || f.brain === 'leader' || f.brain === 'carrier' || f.brain === 'still' || f.brain === 'scared' || f.brain === 'crown') continue;
    // A simple rabbit (2026-10-16) goes along its line to one square.
    if (f.brain === 'simple') {
      const nx = simpleNext(s, f, 'foe');
      if (nx && canTake(s.day.rules, f)) (s.day.rules.tactics ? steps : theirs).add(nx.m.y * W + nx.m.x);
      continue;
    }
    // A piece walking a route (Adventure) only ever goes to its next square.
    if (f.route) {
      // Its next square is framed in its loop's colour, not ringed red
      // (Timothy, 2026-10-16: "the highlighted square where a gear rabbit
      // piece will go next should be the color of the line that shows its
      // path, not red"), so with tactics it goes in `steps`, not `theirs`.
      const L = f.pattern.length, [dx, dy] = f.pattern[f.i % L], to = s.day.rules.tactics ? steps : theirs;
      if ((dx || dy) && canTake(s.day.rules, f)) to.add((f.y + dy) * W + f.x + dx);
      // A stars rabbit walks two steps a turn: both are danger.
      if (s.day.rules.suitRabbits && f.suit === 'stars' && canTake(s.day.rules, f)) { const [ex, ey] = f.pattern[(f.i + 1) % L]; if (ex || ey) to.add((f.y + dy + ey) * W + f.x + dx + ex); }
      continue;
    }
    const ms = pieceMoves(s, f, 'foe');
    for (const m of ms) { theirs.add(m.y * W + m.x); for (const q of capturesOf(m, W)) theirs.add(q); }
    // A sentry rabbit's reach (Adventure): stand in it and it leaps.
    if (f.brain === 'sentry' || f.brain === 'trap') for (const m of ms) { sentry.add(m.y * W + m.x); for (const q of capturesOf(m, W)) sentry.add(q); }
    // A sword strikes round every square it could land on: all of those are
    // dangerous to stand on.
    if (f.weapon === 'sword') for (const m of ms) for (const [dx, dy] of SWORD[Math.max(1, Math.min(3, f.wl || 1))]) {
      const [x, y] = fold(s.day, m.x + dx, m.y - dy);
      if (onBoard(s.day, x, y)) theirs.add(y * W + x);
    }
    if (pattern && f.weapon !== 'sword' && f.weapon !== 'lance') for (const k of patternReach(s, f, 'foe', canTake(s.day.rules, f))) theirs.add(k);
  }
  // Their rings (2026-10-14, Timothy: "the purple reach highlights seems to
  // be still pushing past where a piece could reasonably capture"): where
  // each piece can go or take, a line stopping at the first thing in its
  // way and ringing it only if it could take it. A stunned piece still
  // shows its reach, and a pawn its empty diagonals (patternReach). The
  // look through their own pieces, ghosts and gates (releases 56 and 57)
  // is gone. `threat` is the same set, for the shields.
  // Their vines (Adventure): land on one and it catches you.
  for (const v of s.vines || []) if (v.side === 'foe') theirs.add(v.y * W + v.x);
  // Your stones' reach (the Stone suit, 2026-10-16, Timothy: "we should see
  // your sentries reach while they are present to be able to plan
  // tactics"): where one of theirs that moves in is taken.
  for (const t of s.stones || []) for (const m of pieceMoves(s, { ...t, taken: false }, 'you')) if (!m.swap) { stones.add(m.y * W + m.x); for (const q of capturesOf(m, W)) stones.add(q); }
  return { yours, theirs, threat: theirs, sentry, stones, steps };
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
  if (TAKES_ONLY.has(formOf(p)))
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

/** How many of their pieces could take on square sq, if one of yours
    stood there. */
function attackersOf(s, sq) {
  const W = s.day.W, x = sq % W, y = Math.floor(sq / W), c = clone(s);
  c.pieces.push({ type: 'pawn', x, y, taken: false });
  return c.foes.filter((f) => !f.taken && !f.flying && f.brain !== 'leader' && f.brain !== 'carrier' && canTake(c.day.rules, f) && pieceMoves(c, f, 'foe').some((m) => capturesOf(m, W).includes(sq))).length;
}

/**
 * Empty squares that would be guarded (Timothy, 2026-10-13: "if that
 * piece's reach overlaps with the position present on the enemy's reaches
 * outline, wherein if you moved a piece there, then that piece would be
 * able to actually defend that slot, then put a flat shield icon onto that
 * cell"). Of `squares` (y * W + x; their reach), the empty ones one of
 * yours could move to and, taken there, another of yours could take back.
 *
 * Since later that day ("the shield only shows if two friendly pieces are
 * able to go to that spot in some way and then also if it's three then put
 * a gold shield"), a square needs a piece that can really move there: one
 * that only guards it, with nothing of yours able to step in, has no
 * shield. Each piece that can move there is tried for real: moved there
 * and taken there, and only the others count, from where they then stand
 * (it cannot guard itself, and leaving may open or close a line). The one
 * guarded best counts: one guard is two of your pieces (silver), two
 * guards are three (gold). With a piece `sel` selected, on its own moves
 * only it is tried.
 * Returns a Map of square to the indexes of the pieces that would guard it.
 */
export function guardedSquares(s, squares, sel = null, legal = []) {
  s = seenBy(s, 'you'); // nothing hidden in a cloud is given away
  const out = new Map();
  if (s.won) return out;
  const W = s.day.W;
  // Where each piece of yours can move, onto an empty square, this turn.
  const movers = new Map(); // square: indexes of the pieces that can go there
  const add = (sq, j) => { const l = movers.get(sq) || movers.set(sq, []).get(sq); if (!l.includes(j)) l.push(j); };
  const ok = (mv) => !mv.cap && !mv.swap;
  // A royal King is never the one to step in (2026-10-14, Timothy: "the
  // king shouldn't be included in that calculation in situations where the
  // king would get captured if it [moved] there"): taken there, the game is
  // lost, and taking back does not help.
  const royal = (q) => q.type === 'king' && s.day.rules.royal;
  s.pieces.forEach((q, j) => {
    if (q.taken || q.flying || q.type === 'ball' || q.brain === 'carrier' || royal(q)) return;
    const ms = j === sel && legal.length ? legal.filter((mv) => mv.p == null || mv.p === sel) : movesFor(s, j);
    for (const mv of ms) if (ok(mv)) add(mv.y * W + mv.x, j);
  });
  for (const sq of squares) {
    const x = sq % W, y = Math.floor(sq / W);
    if (look(s, x, y, 'you') !== EMPTY) continue;
    let who = movers.get(sq);
    if (!who) continue;
    if (sel != null && who.includes(sel)) who = [sel];
    let best = [], alone = null;
    for (const j of who) {
      // Moved there and taken there: off its own square, and off this one.
      const n = clone(s), p = n.pieces[j];
      p.x = x; p.y = y; p.taken = true;
      let by = guardsOf(n, sq);
      // A royal King takes back only where nothing else of theirs could
      // then take it: one attacker on the square, not two.
      if (by.some((k) => royal(s.pieces[k]))) {
        if (alone === null) alone = attackersOf(n, sq) <= 1;
        if (!alone) by = by.filter((k) => !royal(s.pieces[k]));
      }
      if (by.length > best.length) best = by;
    }
    if (best.length) out.set(sq, best);
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
  // Adventure's tactics: their pieces on your lines with another behind.
  if (s.day.rules.tactics) { for (const k of tacticalPins(s).keys()) theirs.set(k, [0]); return { mine, theirs }; }
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
function mindStep(s, f, k, side, force = false, noTake = false) {
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
    if (ball ? !hitOk(s, f, m) : m.cap && (!take || noTake)) continue;
    if (noTake && takesAny(m)) continue;
    if (side === 'you' && !hitOk(s, f, m)) continue;
    const v = score(m.x, m.y, m.cap && !ball);
    if (v > best.v) best = { ...m, v };
  }
  // A sentient rabbit of gears (Adventure, 2026-10-16) can trade squares
  // with another piece of its own side, as its move.
  if (f.suit === 'gears' && day.rules.suitRabbits) for (const q of (side === 'foe' ? s.foes : s.pieces)) {
    if (q === f || q.taken || q.rides != null || q.x < 0) continue;
    const v = score(q.x, q.y, false) - 0.5;
    if (v > best.v) best = { x: q.x, y: q.y, cap: false, swap: true, v };
  }
  f.from = [f.x, f.y];
  if (best.x === f.x && best.y === f.y) { f.rested = true; f.blocked = false; f.idle = (f.idle || 0) + 1; return; }
  f.rested = false; f.idle = 0;
  if (best.swap && side === 'foe') {
    const q = s.foes.find((o) => o !== f && !o.taken && o.x === best.x && o.y === best.y);
    if (q) { q.from = [q.x, q.y]; [q.x, q.y, f.x, f.y] = [f.x, f.y, q.x, q.y]; recast(s, f, 'g' + k); }
    return;
  }
  if (side === 'foe') foeLand(s, k, best);
  else moveMine(s, k, best);
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
  if (s.day.rules.tactics) { tacticsTurn(s); if (s.hole?.pattern && !lost(s)) holeHop(s); return; }
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
  const p = n.pieces[i], riding = p.rides != null, ox = p.x, oy = p.y;
  delete p.bubble; // its first move this round: the bubble is gone
  enPassant(n, 'you', p, i, x, y, m);
  // Gears in Adventure (2026-10-16, Timothy: "swap places with another
  // piece"): with one of theirs, too.
  if (m?.swap && n.day.rules.suitRabbits) {
    const f = n.foes.find((q) => !q.taken && q.rides == null && q.x === x && q.y === y);
    if (f) { f.from = [x, y]; f.x = ox; f.y = oy; p.x = x; p.y = y; recast(n, p, 'swap'); return null; }
  }
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
  // A heart spent (Adventure): it stays, and the taker goes back where it
  // came from (`bounced` says where it went, for the page to show).
  if (f && !f.taken && n.day.rules.suitRabbits) {
    if (n.day.rules.crumble && !riding && n.gone[n.gone.length - 1] === oy * n.day.W + ox) n.gone.pop();
    p.x = ox; p.y = oy; p.bounced = [x, y];
  }
  recast(n, p, 'm' + i);
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
  // Your set (Adventure): the piece chosen comes on first.
  if (mv.as != null && s.set && !s.bonus && mv.as !== s.ci) s = chooseInSet(s, mv.as);
  if (mv.p >= 0) mv = fullMove(s, mv);
  const n = clone(s), was = n.bonus;
  n.bonus = null;
  delete n.broke; delete n.bumped; delete n.revived;
  for (const q of n.pieces) delete q.bounced;
  // Where the piece on the board started this turn (Adventure's set): a
  // piece with a rabbit stays where it went, and the next comes on here.
  if (n.set && !was) { const p0 = n.pieces[0]; if (mv.p >= 0 && p0 && !p0.taken) n.turnFrom = [p0.x, p0.y]; else delete n.turnFrom; }
  // En passant on theirs is now or never.
  if (n.ep?.side === 'foe') delete n.ep;
  if (mv.p >= 0) {
    // A move chosen under clouds may run into a hidden piece and take it.
    let m = contact(s, 'you', s.pieces[mv.p], mv);
    if (m.bumped) n.bumped = 'you';
    // A vine of theirs on its way stops it there, to be caught (2026-10-17).
    m = vineCut(n, 'foe', n.pieces[mv.p], m) || m;
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
    if (!m.swap && !m.hop) passGhosts(n, 'you', fx, fy, m.x, m.y, m.wrapped);
    flagHome(n);
    const caught = gone() > before, took = caught || n.foes.reduce((t, f) => t + (f.lives || 1), 0) < lives;
    // Stone (Adventure): every move leaves a stone of itself on the square
    // it left, a sentry of yours for three turns (stonesAge).
    if (p.suit === 'stone' && n.stones && !crumbled(n, fx, fy) && (fx !== p.x || fy !== p.y) && !n.stones.some((t) => t.x === fx && t.y === fy))
      n.stones.push({ type: p.shape || p.type, x: fx, y: fy, left: STONE_TURNS });
    // Vines (suits as rabbits): a vine of theirs where it lands catches it;
    // a piece of Vines leaves a trail of its own.
    if (n.day.rules.suitRabbits && !p.taken) {
      if (n.vines && takeVine(n, 'foe', p.x, p.y)) { p.vined = true; if (!capturePiece(n, p, -1)) delete p.vined; settleRevivals(n); }
      else if (p.suit === 'vines' && (fx !== p.x || fy !== p.y)) addTrail(n, 'you', fx, fy, p.x, p.y);
    }
    openBonus(n, mv.p, took, was, caught);
  }
  // The board cleared (goal 'clear'): the hole opens beside your piece, on
  // the way it was going.
  if (n.won && n.day.rules.goal === 'clear' && !n.hole) {
    const was = s.pieces[mv.p], now = n.pieces[mv.p];
    n.hole = exitSpot(n, was && now ? [Math.sign(now.x - was.x), Math.sign(now.y - was.y)] : null);
  }
  // Your turn is over (unless a suit left it open for this piece): the
  // piece that moved has had its turn this round.
  // A pass too (Timothy, 2026-10-16: "when you pass, the piece you have
  // should move to the next one").
  if (!n.bonus) spendTurn(n);
  // Their vines wither once your turn is over.
  if (!n.bonus && n.vines) n.vines = n.vines.filter((v) => v.side !== 'foe');
  return n;
}

/** Where the way down opens on a cleared board (Adventure, 2026-10-15,
    Timothy: "the hole should just be like an animation where the piece
    jumping in, it's boring to have to move it yourself"): the free square
    nearest your piece, so the jump in is a short hop; of those, the one most
    the way it was going (`dir`), so it hops on into it rather than always
    toward the middle (Timothy, 2026-10-15: "hole always shows up in the
    center space"). */
function exitSpot(n, dir = null) {
  const p = n.pieces.find((q) => !q.taken) || n.pieces[0], W = n.day.W, H = n.day.H, spots = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x === p.x && y === p.y) || !onBoard(n.day, x, y) || statueAt(n, y * W + x) || crumbled(n, x, y) || shrunk(n, x, y)) continue;
    if (n.foes.some((f) => !f.taken && f.x === x && f.y === y) || n.pieces.some((q) => !q.taken && q.x === x && q.y === y)) continue;
    spots.push({ x, y, d: Math.max(Math.abs(x - p.x), Math.abs(y - p.y)), m: Math.abs(x - p.x) + Math.abs(y - p.y), on: dir ? (x - p.x) * dir[0] + (y - p.y) * dir[1] : 0 });
  }
  spots.sort((a, b) => a.d - b.d || b.on - a.on || a.m - b.m || b.y - a.y || a.x - b.x);
  const s = spots[0] || { x: p.x, y: p.y };
  return { x: s.x, y: s.y, mx: 1, my: 1, i: 0 };
}

// --- Adventure's tactics (Timothy, 2026-10-15). ------------------------------
// "i want to find a way to still have opportunities for pinning and other
// chess technique even know we are working with one piece at a time"; then
// "yea let's do everything but 6. also 5 should be a new suit called stone
// that lets you leave a sentry behind of your piece." With rules.tactics,
// their turn goes like this, and in this order:
//
// 1. Pins. Your piece and your stones look along their lines. One of theirs
//    with another of theirs behind it on such a line is pinned for the whole
//    turn: it cannot step, strike, flee or block.
// 2. Check. If you attack their leader (the crowned King), they answer it:
//    a piece of theirs takes the attacker if one can (the leader only if
//    nothing else of yours guards that square); else one steps in to block
//    the line (and stands guard there from then on, a sentry); else the
//    leader flees to a square you do not attack; else it is checkmate, and
//    every piece of theirs lays down its arms. Attacked twice at once
//    (double check), only fleeing will do.
// 3. Flight. One piece of theirs with a scared rabbit that you attack
//    steps out of reach: the most valuable that can. Only one a turn: attack
//    two at once (a fork) and the other stays to be taken.
// 4. The walkers take their steps, except the pinned, which hold.
// 5. Their sentries strike: each takes anything of yours standing where it
//    attacks (your piece first), moving there.
// 6. Your stones strike: each takes one of theirs that moved this turn to
//    where it attacks (the most valuable), moving there: a trap, not a
//    turret, so a stone never takes a statue that only stands in its way.
//
// Everything is decided by the position alone, so the solver still sees a
// puzzle. What happened is written to s.tlog for the page to say.

/** Your attackers: the piece on the board, and your stones. */
function yourAttackers(s) {
  const out = [], p = s.pieces[0];
  if (p && !p.taken) out.push({ p, kind: 'piece' });
  // Your pieces with a rabbit (2026-10-16) pin and threaten too.
  s.pieces.forEach((q, i) => { if (i && (q.ally || s.free) && !q.taken) out.push({ p: q, kind: 'ally', i }); });
  (s.stones || []).forEach((t, j) => out.push({ p: { ...t, taken: false }, kind: 'stone', j }));
  return out;
}

/** Every square your attackers reach or could take on, the squares a piece
    of theirs is not safe on. */
function yourControl(s) {
  const W = s.day.W, out = new Set();
  for (const a of yourAttackers(s)) for (const m of pieceMoves(s, a.p, 'you')) {
    if (m.swap) continue;
    out.add(m.y * W + m.x);
    for (const q of capturesOf(m, W)) out.add(q);
  }
  return out;
}

/** Which of your attackers could take on square sq. */
function yourAttackersOf(s, sq) {
  const W = s.day.W;
  return yourAttackers(s).filter((a) => pieceMoves(s, a.p, 'you').some((m) => capturesOf(m, W).includes(sq)));
}

/** Pieces of theirs pinned by your lines: Map of foe index to the attacker
    whose line it is. */
export function tacticalPins(s) {
  const out = new Map();
  if (!s.day.rules.tactics) return out;
  for (const a of yourAttackers(s)) for (const [dx, dy] of slideVecs(formOf(a.p), 1)) {
    let x = a.p.x, y = a.p.y, first = -1;
    for (let n = 0; n < MAX_SLIDE; n++) {
      x += dx; y += dy;
      const c = look(s, x, y, 'you');
      if (c === EMPTY || c === BRAMBLE) continue;
      if (c !== ENEMY) break;
      const k = s.foes.findIndex((f) => !f.taken && f.x === x && f.y === y);
      if (k < 0) break;
      if (first < 0) { first = k; continue; }
      if (!out.has(first)) out.set(first, a);
      break;
    }
  }
  return out;
}

/** The leader of theirs (the crowned King), if it is still on the board. */
const leaderOf = (s) => s.foes.find((f) => !f.taken && f.brain === 'crown') || null;

/** Do you attack their leader now (check)? */
export function inCheck(s) {
  const lead = s.day.rules.tactics && leaderOf(s);
  return !!lead && yourAttackersOf(s, lead.y * s.day.W + lead.x).length > 0;
}

/** Their side's turn with tactics (above). Mutates. */
function tacticsTurn(s) {
  const W = s.day.W, log = (s.tlog = []), acted = new Set(), sr = s.day.rules.suitRabbits;
  for (const f of s.foes) { delete f.pinned; delete f.trapped; delete f.fled; delete f.broke; delete f.struck; delete f.bounced; delete f.sat; f.from = [f.x, f.y]; }
  for (const t of s.stones || []) delete t.from;
  // Your side finishes its turn first (Adventure, 2026-10-16): a piece of
  // yours with a rabbit inside stays where it moved, and the next of your
  // set comes on where it started; then every one of yours with a rabbit
  // acts by itself.
  if (sr) { deploy(s, log); alliesAct(s, log); if (s.won) return; }
  // Stunned by a mace (2026-10-16, Timothy: "make sure stun functionality
  // actually works"): it sits out this whole turn, said, and marked (`sat`).
  s.foes.forEach((f, k) => { if (!f.taken && f.stun) { f.sat = true; log.push({ what: 'stunned', k }); } });
  const pins = tacticalPins(s);
  for (const k of pins.keys()) { s.foes[k].pinned = true; log.push({ what: 'pin', k, by: pins.get(k).kind }); }
  const free = (k) => !s.foes[k].taken && !s.foes[k].stun && !pins.has(k) && !acted.has(k);
  const quiet = (f) => pieceMoves(s, f, 'foe').filter((m) => !m.cap && !m.swap);
  const toSentry = (f) => { f.brain = 'sentry'; f.patternName = 'Sentry'; delete f.pattern; delete f.route; delete f.dir; };
  const value = (f) => PIECES[f.type]?.value || 1;
  const mate = () => {
    for (const f of s.foes) if (!f.taken) f.taken = true;
    s.won = true; s.mate = true;
    if (s.day.rules.goal === 'clear' && !s.hole) s.hole = exitSpot(s);
  };
  // How many of yours are down (a heart spent counts): to tell whether a
  // move of theirs took something.
  const down = () => s.pieces.reduce((t, p) => t + (p.taken ? 9 : 0) - (p.lives || 1), 0) + (s.stones || []).length * -1;
  // How many of yours are taken (for a spirals chain, which goes on only
  // after a capture).
  const fell = () => s.pieces.filter((p) => p.taken).length;
  // A vines rabbit leaves its trail wherever it went (2026-10-16: the suits
  // are the same on theirs as on yours).
  const trail = (f, start) => { if (sr && f.suit === 'vines' && !f.taken && (f.x !== start[0] || f.y !== start[1])) addTrail(s, 'foe', start[0], start[1], f.x, f.y); };

  // 2. Check.
  const lead = leaderOf(s);
  if (lead) {
    const lk = s.foes.indexOf(lead), lsq = lead.y * W + lead.x, checkers = yourAttackersOf(s, lsq);
    if (checkers.length) {
      let done = false;
      if (checkers.length === 1) {
        const c = checkers[0], csq = c.p.y * W + c.p.x;
        // (a) Take the attacker. The leader only where nothing else of yours guards it.
        const guarded = () => { const t = c.kind === 'stone' ? s.stones[c.j] : s.pieces[c.i ?? 0]; const was = { x: t.x, y: t.y }; t.x = -99; t.y = -99; const g = yourControl(s).has(csq); t.x = was.x; t.y = was.y; return g; };
        for (let k = 0; k < s.foes.length && !done; k++) {
          const f = s.foes[k];
          if (!free(k) || !canTake(s.day.rules, f) || f.brain === 'scared') continue;
          const m = pieceMoves(s, f, 'foe').find((q) => q.cap && q.x === c.p.x && q.y === c.p.y);
          if (!m || (f.brain === 'crown' && guarded())) continue;
          foeLand(s, k, m); acted.add(k);
          if (f.brain === 'possessed') toSentry(f);
          log.push({ what: 'check', how: 'take', k, by: c.kind }); done = true;
        }
        // (b) Block the line.
        const line = between(W, c.p.x, c.p.y, lead.x, lead.y);
        for (let k = 0; k < s.foes.length && !done && line.length; k++) {
          const f = s.foes[k];
          if (!free(k) || k === lk || !['possessed', 'sentry', 'scared', 'simple', 'trap'].includes(f.brain)) continue;
          const m = quiet(f).find((q) => line.includes(q.y * W + q.x));
          if (!m) continue;
          landFoe(s, f, m.x, m.y); acted.add(k); toSentry(f);
          log.push({ what: 'check', how: 'block', k, by: c.kind }); done = true;
        }
      }
      // (c) The leader flees.
      if (!done && free(lk)) {
        lead.taken = true; const ctl = yourControl(s); lead.taken = false;
        const near = s.pieces[0] && !s.pieces[0].taken ? s.pieces[0] : checkers[0].p;
        const ways = quiet(lead).filter((m) => !ctl.has(m.y * W + m.x))
          .sort((a, b) => Math.max(Math.abs(b.x - near.x), Math.abs(b.y - near.y)) - Math.max(Math.abs(a.x - near.x), Math.abs(a.y - near.y)) || b.y - a.y || a.x - b.x);
        if (ways.length) { landFoe(s, lead, ways[0].x, ways[0].y); acted.add(lk); log.push({ what: 'check', how: 'flee', k: lk, double: checkers.length > 1 }); done = true; }
      }
      // (d) Checkmate.
      if (!done) { log.push({ what: 'mate', k: lk }); mate(); return; }
    }
  }
  if (lost(s)) return;

  // 3. Flight: the most valuable scared piece you attack that can get away.
  const shy = s.foes.some((f, k) => f.brain === 'scared' && !f.taken && !acted.has(k)), ctl = shy ? yourControl(s) : null;
  const scared = !shy ? [] : s.foes.map((f, k) => k).filter((k) => s.foes[k].brain === 'scared' && !s.foes[k].taken && !s.foes[k].stun && !acted.has(k) && ctl.has(s.foes[k].y * W + s.foes[k].x))
    .sort((a, b) => value(s.foes[b]) - value(s.foes[a]) || a - b);
  let fled = false;
  for (const k of scared) {
    const f = s.foes[k];
    // Pinned, it cannot run; and once one has run, the rest must stay.
    if (pins.has(k)) { f.trapped = true; log.push({ what: 'trapped', k, pinned: true }); continue; }
    if (fled) { f.trapped = true; log.push({ what: 'trapped', k, fork: true }); continue; }
    f.taken = true; const safe = yourControl(s); f.taken = false;
    const near = s.pieces[0] && !s.pieces[0].taken ? s.pieces[0] : f;
    const far = (a, b) => Math.max(Math.abs(b.x - near.x), Math.abs(b.y - near.y)) - Math.max(Math.abs(a.x - near.x), Math.abs(a.y - near.y)) || b.y - a.y || a.x - b.x;
    const ways = quiet(f).filter((m) => !safe.has(m.y * W + m.x)).sort(far);
    const start = [f.x, f.y];
    if (ways.length) landFoe(s, f, ways[0].x, ways[0].y);
    else {
      // A scared rabbit of gears (2026-10-16) can run by trading squares
      // with another of theirs that stands out of your reach.
      const mates = sr && f.suit === 'gears' ? s.foes.filter((q) => q !== f && !q.taken && q.rides == null && !safe.has(q.y * W + q.x)).sort(far) : [];
      if (!mates.length) { f.trapped = true; log.push({ what: 'trapped', k }); continue; }
      const q = mates[0];
      q.from = [q.x, q.y]; [q.x, q.y, f.x, f.y] = [f.x, f.y, q.x, q.y];
      log.push({ what: 'swap', k, with: s.foes.indexOf(q) });
    }
    f.fled = true; acted.add(k); fled = true;
    trail(f, start);
    log.push({ what: 'flee', k });
  }

  // 4. The walkers step, but not the pinned. Their suits (2026-10-16):
  // stars walks two steps, taking at most once; spirals steps on again
  // after a step that takes, as long as it takes; vines leaves a trail.
  s.foes.forEach((f, k) => {
    if (f.taken || (f.brain !== 'possessed' && f.brain !== 'simple') || acted.has(k) || f.stun || lost(s)) return;
    if (pins.has(k)) { f.from = [f.x, f.y]; f.blocked = false; f.rested = false; f.ate = -1; return; }
    // A simple rabbit (2026-10-16): one move along its line, all the way.
    if (f.brain === 'simple') {
      const start = [f.x, f.y], was = down(), fellWas = fell();
      simpleStep(s, f, k, 'foe');
      if (sr && f.suit === 'stars' && !f.taken && !lost(s)) simpleStep(s, f, k, 'foe', down() > was);
      for (let c = 0; sr && f.suit === 'spirals' && fell() > fellWas && c < 16 && !f.taken && !lost(s); c++) {
        const w = fell();
        log.push({ what: 'chain', k });
        if (!simpleStep(s, f, k, 'foe') || fell() <= w) break;
      }
      trail(f, start);
      return;
    }
    const start = [f.x, f.y], was = down();
    possessedStep(s, f);
    const took = down() > was;
    if (sr && f.suit === 'stars' && !f.taken && !lost(s)) possessedStep(s, f, false, took);
    // (On a capture only: a heart of yours that holds ends the chain.)
    for (let c = 0; sr && f.suit === 'spirals' && c < 16 && !f.taken && !lost(s) && (f.ate >= 0 || f.broke); c++) { delete f.broke; log.push({ what: 'chain', k }); possessedStep(s, f); }
    trail(f, start);
  });
  if (lost(s)) return;

  // 4b. Sentient rabbits (2026-10-16, Timothy: "actual piece behavior like a
  // game of chess against a simple ai"): each thinks one move ahead (the
  // rabbit minds' way, mindStep) and makes its move, unless pinned.
  s.foes.forEach((f, k) => {
    if (f.taken || f.brain !== 'sentient' || !free(k) || lost(s)) return;
    const start = [f.x, f.y], was = down(), fellWas = fell();
    f.mind = f.mind || { iq: 6, trait: 'hunter' };
    mindStep(s, f, k, 'foe');
    let took = down() > was, caught = fell() > fellWas;
    if (sr && f.suit === 'stars' && !f.taken && !lost(s)) mindStep(s, f, k, 'foe', false, took);
    for (let c = 0; sr && f.suit === 'spirals' && caught && c < 16 && !f.taken && !lost(s); c++) {
      const m = bestTake(s, f, 'foe');
      if (!m) break;
      const w = down(), fw = fell();
      foeLand(s, k, m);
      log.push({ what: 'chain', k });
      took = down() > w; caught = fell() > fw;
    }
    acted.add(k);
    if (f.x !== start[0] || f.y !== start[1] || took) log.push({ what: 'think', k });
    trail(f, start);
  });
  if (lost(s)) return;

  // 5. Their sentries strike: your piece first, then your pieces with
  // rabbits, then your stones; from where they stand. A sentry of spirals
  // strikes everything of yours in its reach.
  s.foes.forEach((f, k) => {
    // A trap (2026-10-16, Timothy: "sentry but doesn't move back to its
    // new spot") takes the same way, and stays where it took.
    if ((f.brain !== 'sentry' && f.brain !== 'trap') || !free(k) || lost(s)) return;
    for (let c = 0; c < (sr && f.suit === 'spirals' ? 16 : 1) && !lost(s); c++) {
      const ms = pieceMoves(s, f, 'foe').filter((m) => m.cap && canTake(s.day.rules, f));
      const at = (q) => s.pieces.findIndex((p) => !p.taken && p.x === q.x && p.y === q.y);
      const order = (m) => { const i = at(m); return i === 0 ? 0 : i > 0 ? 1 + 10 - (PIECES[s.pieces[i].type]?.value || 1) : 50; };
      const m = ms.filter((q) => at(q) >= 0 || (s.stones || []).some((t) => t.x === q.x && t.y === q.y)).sort((a, b) => order(a) - order(b))[0];
      if (!m) break;
      const i = at(m);
      // With rabbits as suits a sentry never moves (Timothy, 2026-10-16:
      // "sentry rabbit shouldn't move"): it strikes from where it stands, and
      // the page shows it lunging and back (`struck`).
      if (sr && f.brain === 'sentry') {
        f.struck = [m.x, m.y];
        if (i >= 0) { f.ate = i; if (!capturePiece(s, s.pieces[i], k)) { f.wounded = i; f.ate = -1; } settleRevivals(s); }
        else { const st = s.stones.findIndex((t) => t.x === m.x && t.y === m.y); if (st >= 0) s.stones.splice(st, 1); f.broke = true; }
        recast(s, f, 's' + k);
      } else foeLand(s, k, m);
      acted.add(k);
      log.push({ what: f.brain === 'trap' ? 'trap' : 'sentry', k, on: i === 0 ? 'piece' : i > 0 ? 'ally' : 'stone', i });
      // A heart that holds ends a sentry of spirals' strikes too.
      if (sr && f.wounded >= 0) break;
    }
  });
  if (lost(s)) return;

  // 6. Your stones strike, at what moved into their reach.
  const moved = (f) => acted.has(s.foes.indexOf(f)) || (f.from && (f.from[0] !== f.x || f.from[1] !== f.y));
  for (let j = 0; j < (s.stones || []).length; j++) {
    const t = s.stones[j], st = { ...t, taken: false };
    const caps = pieceMoves(s, st, 'you').filter((m) => m.cap);
    const hit = caps.map((m) => s.foes.findIndex((f) => !f.taken && f.x === m.x && f.y === m.y && moved(f))).filter((k) => k >= 0)
      .sort((a, b) => value(s.foes[b]) - value(s.foes[a]) || a - b)[0];
    if (hit === undefined) continue;
    const f = s.foes[hit];
    t.from = [t.x, t.y]; t.x = f.x; t.y = f.y;
    captureFoe(s, f, -1);
    log.push({ what: 'stone', k: hit, j });
    if (s.won) { if (s.day.rules.goal === 'clear' && !s.hole) s.hole = exitSpot(s); return; }
  }
}

/** The most valuable piece of the other side piece f can take now, as a
    move, or null: for a spirals rabbit's chain. */
function bestTake(s, f, side) {
  const W = s.day.W, other = side === 'foe' ? s.pieces : s.foes;
  let best = null, bv = -1;
  for (const m of pieceMoves(s, f, side)) {
    if (!m.cap) continue;
    const v = other.find((q) => !q.taken && q.x === m.x && q.y === m.y);
    const val = v ? PIECES[v.type]?.value || 1 : 0;
    if (v && val > bv) { bv = val; best = m; }
  }
  return best;
}

// --- Your pieces with a rabbit inside (Adventure, 2026-10-16). -----------------
// Timothy: "at the end of a level, you now have a chance of capturing a
// rabbit to be able to infuse one of your peices with it ... rabbits, when
// added to a piece, allow it to be sort of be automated. peices with rabbits
// stay behind after you move with the following peice (sort of like old
// stone functionality, expect the peice is placed in the new spot rather
// than in the spot it started) and then stay there."
//
// So: move a piece of your set with a rabbit inside, and when your turn
// ends it stays on the square it moved to, out of your set for the rest of
// the board (`ally`, with its set entry's `out` its index in s.pieces), and
// the next of your set comes on where it started. From then on it acts by
// itself at the end of every turn of yours, by its rabbit:
// - sentry: stands, and takes the most valuable piece of theirs in its
//   reach, from where it stands;
// - robot: walks there and back along its shortest move toward the nearest
//   of theirs, taking what it steps onto;
// - scared: stands, and runs to a square they do not reach when they do;
// - sentient: thinks one move ahead, as their sentient rabbits do.
// Its suit works as it does on any piece. It stays only while another of
// your set is there to come on; the last one keeps playing as your piece.

/** Your pieces with a rabbit standing on the board by themselves. */
export const alliesOf = (s) => s.pieces.filter((p, i) => i > 0 && p.ally && !p.taken);

/** The end of your turn in Adventure (2026-10-16, Timothy: "pieces ...
    leave themselves behind after being played. the rabbit simply defines
    what the peice does after its now on the board. after the full set is
    played, they are removed from the board and then it starts again"; and
    2026-10-17, the order: "the piece moves, then its transforms into the
    next piece. then, after that piece leaves that spot, the old piece stays
    there"):
    1. The piece before this one (`pending`) stays on the square this one
       set out from (or the free square nearest it): `ally`, by itself,
       acting by its rabbit from this turn on.
    2. This one turns into the next of your set that is ready, where it
       landed, and is pending in its turn.
    When none is ready the whole set has played: this one stays your piece,
    the pieces standing act once more, and at the end of their turn they
    come off (newRound, from turnOver). A pass leaves nothing and changes
    nothing here. Mutates. */
function deploy(n, log) {
  const p = n.pieces[0], from = n.turnFrom;
  n.turnFrom = null;
  if (!n.set || n.won) return;
  if (from && n.pending != null && n.pending !== n.ci) standBehind(n, from, log);
  if (!from || !p || p.taken) return;
  const ready = n.set.map((_, j) => j).filter((j) => j !== n.ci && setReady(n, j));
  if (!ready.length) return;
  const L = n.set.length;
  let j = ready[0];
  for (let d = 1; d <= L; d++) if (ready.includes((n.ci + d) % L)) { j = (n.ci + d) % L; break; }
  // Only some stay (rules.stayBehind 'some', Timothy, 2026-10-17: "no more
  // leaving pieces behind outside of gear suits in the regular adventure"):
  // a piece with a rabbit inside (which acts by itself only while it
  // stands) or of Gears; the rest just turn into the next.
  n.pending = n.day.rules.stayBehind !== 'some' || p.rabbit || p.suit === 'gears' ? n.ci : null;
  bringOn(n, j);
}

/** The pending piece of your set (see deploy) stands on the board by
    itself, on `from` or the free square nearest it. Mutates. */
function standBehind(n, from, log) {
  const j = n.pending, e = n.set[j];
  n.pending = null;
  if (!e || e.lost || e.out != null) return;
  const at = entrySpot(n, { x: from[0], y: from[1] });
  if (!at) return;
  // The first to stand this round clears away the pieces of the last
  // (lifted, or taken where they stood): nothing points at them now.
  if (n.pieces.length > 1 && !n.set.some((q) => q.out != null)) n.pieces = [n.pieces[0]];
  const k = n.pieces.length, a = { ...e, x: at.x, y: at.y, ally: true };
  delete a.used; delete a.out;
  if (a.rabbit === 'robot') planRoute(n, a);
  if (a.rabbit === 'simple') planLine(n, a, 'you');
  if (a.rabbit === 'sentient') a.mind = { iq: 8, trait: 'aggressive' };
  n.pieces.push(a);
  n.set[j] = { ...e, out: k };
  n.stood = { k, j };
  log.push({ what: 'stand', i: k });
}

/** A simple rabbit's line for piece q of `side` (2026-10-16): of the ways
    its moves go, the one most toward the nearest piece of the other side
    (ties: the one that goes further). Sets q.dir, or deletes it if it has
    no move. Mutates q. */
export function planLine(s, q, side) {
  const other = (side === 'foe' ? s.pieces : s.foes).filter((o) => !o.taken && o.x >= 0);
  const near = other.sort((f, g) => Math.max(Math.abs(f.x - q.x), Math.abs(f.y - q.y)) - Math.max(Math.abs(g.x - q.x), Math.abs(g.y - q.y)))[0];
  const ways = new Map();
  for (const m of pieceMoves(s, q, side)) {
    if (m.swap || m.push?.length) continue;
    const ex = m.x - q.x, ey = m.y - q.y, g = gcd(Math.abs(ex), Math.abs(ey)) || 1, key = `${ex / g},${ey / g}`;
    ways.set(key, Math.max(ways.get(key) || 0, g));
  }
  if (!ways.size) { delete q.dir; return; }
  const toward = near ? [near.x - q.x, near.y - q.y] : [0, side === 'foe' ? 1 : -1], d = Math.hypot(...toward) || 1;
  const cos = ([x, y]) => (x * toward[0] + y * toward[1]) / (Math.hypot(x, y) * d);
  const best = [...ways.entries()].map(([k, far]) => ({ v: k.split(',').map(Number), far }))
    .sort((a, b) => cos(b.v) - cos(a.v) || b.far - a.far || a.v[1] - b.v[1] || a.v[0] - b.v[0])[0];
  q.dir = best.v;
}

/** A simple rabbit's move this turn (2026-10-16, Timothy: "simple - just
    moves once, all the way if it's a slider and one hop for a leaper"): of
    piece q's moves along its line (q.dir), the one that goes furthest: a
    slider to the edge, or to the first piece in its way (taking it if it is
    the other side's); a leaper one hop. If it cannot go its way it turns
    back. Returns { m, path, turned } (path: every square it could stop on
    that way, which is where it would take a piece standing there), or null
    if it can go neither way. `noTake`: a move that takes is not allowed. */
export function simpleNext(s, q, side, noTake = false) {
  if (!q.dir) return null;
  const W = s.day.W, ms = pieceMoves(s, q, side).filter((m) => !m.swap && !m.push?.length && (!noTake || !takesAny(m)));
  const along = (dx, dy) => {
    let best = null, bt = 0;
    const path = [];
    for (const m of ms) {
      const ex = m.x - q.x, ey = m.y - q.y, t = dx ? ex / dx : ey / dy;
      if (!(t > 0) || ex !== t * dx || ey !== t * dy || !Number.isInteger(t)) continue;
      path.push(m.y * W + m.x);
      if (t > bt) { bt = t; best = m; }
    }
    return best ? { m: best, path } : null;
  };
  const [dx, dy] = q.dir;
  const go = along(dx, dy);
  if (go) return go;
  const back = along(-dx, -dy);
  return back ? { ...back, turned: true } : null;
}

/** A simple rabbit's move, made: piece q (index k) of `side`. A thespian,
    whose moves change, finds its line again when it has none. Returns
    whether it moved. Mutates. */
function simpleStep(s, q, k, side, noTake = false) {
  delete q.bounced;
  let nx = simpleNext(s, q, side, noTake);
  if (!nx && (!q.dir || q.type === 'thespian')) { planLine(s, q, side); nx = simpleNext(s, q, side, noTake); }
  if (!nx) { q.from = [q.x, q.y]; q.blocked = true; return false; }
  if (nx.turned) q.dir = [-q.dir[0], -q.dir[1]];
  if (side === 'foe') foeLand(s, k, nx.m);
  else { q.from = [q.x, q.y]; moveMine(s, k, nx.m); }
  q.blocked = false;
  return true;
}

/** A robot rabbit's loop for your piece a: there and back along its
    shortest move, the one most toward the nearest piece of theirs. */
function planRoute(n, a) {
  const live = n.foes.filter((f) => !f.taken && f.x >= 0);
  const near = live.sort((f, g) => Math.max(Math.abs(f.x - a.x), Math.abs(f.y - a.y)) - Math.max(Math.abs(g.x - a.x), Math.abs(g.y - a.y)))[0];
  const ms = pieceMoves(n, a, 'you').filter((m) => !m.swap && !m.push).map((m) => [m.x - a.x, m.y - a.y]);
  if (!ms.length) { delete a.pattern; delete a.route; return; }
  const len = (v) => Math.max(Math.abs(v[0]), Math.abs(v[1])), short = Math.min(...ms.map(len));
  const toward = near ? [near.x - a.x, near.y - a.y] : [0, 1], d = Math.hypot(...toward) || 1;
  const v = ms.filter((q) => len(q) === short).sort((p, q) => (q[0] * toward[0] + q[1] * toward[1]) / (Math.hypot(...q) * d) - (p[0] * toward[0] + p[1] * toward[1]) / (Math.hypot(...p) * d) || p[1] - q[1] || p[0] - q[0])[0];
  Object.assign(a, { pattern: [v, [-v[0], -v[1]]], i: 0, route: true, mx: 1, my: 1, patternName: 'Shuttle' });
}

/** Where one of theirs could move or take next turn: where a piece of yours
    is not safe to stand. */
function foeDanger(s) {
  const W = s.day.W, out = new Set();
  for (const f of s.foes) {
    if (f.taken || f.flying || f.stun || !canTake(s.day.rules, f) || ['scared', 'still', 'crown'].includes(f.brain)) continue;
    if (f.brain === 'simple') { const nx = simpleNext(s, f, 'foe'); for (const q of nx?.path || []) out.add(q); continue; }
    if (f.route) {
      const L = f.pattern.length, [dx, dy] = f.pattern[f.i % L];
      out.add((f.y + dy) * W + f.x + dx);
      if (s.day.rules.suitRabbits && f.suit === 'stars') { const [ex, ey] = f.pattern[(f.i + 1) % L]; out.add((f.y + dy + ey) * W + f.x + dx + ex); }
      continue;
    }
    for (const m of pieceMoves(s, f, 'foe')) { out.add(m.y * W + m.x); for (const q of capturesOf(m, W)) out.add(q); }
  }
  for (const v of s.vines || []) if (v.side === 'foe') out.add(v.y * W + v.x);
  return out;
}

/** Every piece of yours with a rabbit takes its turn. Mutates. */
function alliesAct(s, log) {
  const W = s.day.W, gone = () => s.foes.reduce((t, f) => t + (f.taken ? 9 : 0) - (f.lives || 1), 0), fell = () => s.foes.filter((f) => f.taken).length;
  for (let k = 1; k < s.pieces.length; k++) {
    const a = s.pieces[k];
    if (!a.ally || a.taken || s.won || lost(s)) continue;
    delete a.struck; delete a.bounced; delete a.fled; delete a.trapped; a.from = [a.x, a.y]; a.blocked = false;
    // (It stands only from a turn after it moved, so it acts at once.)
    if (a.stun) continue;
    const start = [a.x, a.y], was = gone();
    if (a.rabbit === 'sentry') {
      for (let c = 0; c < (a.suit === 'spirals' ? 16 : 1) && !s.won; c++) {
        const m = bestTake(s, a, 'you');
        if (!m) break;
        const f = s.foes.find((q) => !q.taken && q.x === m.x && q.y === m.y);
        a.struck = [m.x, m.y];
        const down = captureFoe(s, f, k);
        recast(s, a, 'a' + k);
        log.push({ what: 'ally', how: 'strike', i: k, k: s.foes.indexOf(f) });
        // Spirals strikes on while it takes; a heart that holds ends it.
        if (!down) break;
      }
    } else if (a.rabbit === 'trap') {
      // A trap (2026-10-16, Timothy: "sentry but doesn't move back to its
      // new spot"): it takes as a sentry does, and stays where it took.
      for (let c = 0; c < (a.suit === 'spirals' ? 16 : 1) && !s.won && !a.taken; c++) {
        const m = bestTake(s, a, 'you');
        if (!m) break;
        const f = fell();
        moveMine(s, k, m);
        log.push({ what: 'ally', how: 'trap', i: k, held: !!a.bounced });
        if (fell() <= f) break;
      }
    } else if (a.rabbit === 'simple') {
      const steps = a.suit === 'stars' ? 2 : 1;
      let took = false;
      for (let c = 0; c < steps && !s.won && !a.taken; c++) {
        const before = gone(), fellBefore = fell();
        if (!simpleStep(s, a, k, 'you', c > 0 && took)) break;
        if (gone() > before) took = true;
        for (let r = 0; a.suit === 'spirals' && fell() > fellBefore && r < 16 && !s.won && !a.taken; r++) {
          const b2 = fell();
          if (!simpleStep(s, a, k, 'you') || fell() <= b2) break;
        }
      }
      if (a.x !== start[0] || a.y !== start[1] || gone() > was) log.push({ what: 'ally', how: 'walk', i: k });
    } else if (a.rabbit === 'robot' && a.pattern) {
      const steps = a.suit === 'stars' ? 2 : 1;
      let took = false;
      for (let c = 0; c < steps && !s.won && !a.taken; c++) {
        const before = gone(), fellBefore = fell();
        if (!allyStep(s, a, k, c > 0 && took)) break;
        if (gone() > before) took = true;
        for (let r = 0; a.suit === 'spirals' && fell() > fellBefore && r < 16 && !s.won && !a.taken; r++) {
          const b2 = fell();
          if (!allyStep(s, a, k, false) || fell() <= b2) break;
        }
      }
      if (a.x !== start[0] || a.y !== start[1] || gone() > was) log.push({ what: 'ally', how: 'walk', i: k });
    } else if (a.rabbit === 'scared') {
      const danger = foeDanger(s);
      if (danger.has(a.y * W + a.x)) {
        const near = s.foes.filter((f) => !f.taken);
        const gap = (m) => Math.min(99, ...near.map((f) => Math.max(Math.abs(f.x - m.x), Math.abs(f.y - m.y))));
        const ways = pieceMoves(s, a, 'you').filter((m) => !m.swap && !takesAny(m) && !danger.has(m.y * W + m.x)).sort((p, q) => gap(q) - gap(p) || q.y - p.y || p.x - q.x);
        if (ways.length) { moveMine(s, k, ways[0]); a.fled = true; log.push({ what: 'ally', how: 'run', i: k }); }
        else { a.trapped = true; log.push({ what: 'ally', how: 'stuck', i: k }); }
      }
    } else if (a.rabbit === 'sentient') {
      a.mind = a.mind || { iq: 8, trait: 'aggressive' };
      const fellWas = fell();
      mindStep(s, a, k, 'you');
      const took = gone() > was;
      let caught = fell() > fellWas;
      if (a.suit === 'stars' && !a.taken && !s.won) mindStep(s, a, k, 'you', false, took);
      for (let c = 0; a.suit === 'spirals' && caught && c < 16 && !a.taken && !s.won; c++) {
        const m = bestTake(s, a, 'you');
        if (!m) break;
        const w = fell();
        moveMine(s, k, m);
        caught = fell() > w;
      }
      if (a.x !== start[0] || a.y !== start[1] || gone() > was) log.push({ what: 'ally', how: 'think', i: k });
    }
    if (a.suit === 'vines' && !a.taken && (a.x !== start[0] || a.y !== start[1])) addTrail(s, 'you', start[0], start[1], a.x, a.y);
  }
}

/** One step of your robot a (index k) along its loop: onto its next square,
    taking what is there (unless `noTake`), or waiting if it cannot. A
    thespian, whose moves change, plans its loop again when its step is not
    one of them. Returns whether it stepped. Mutates. */
function allyStep(s, a, k, noTake) {
  for (let tries = 0; tries < 2; tries++) {
    delete a.bounced;
    const [dx, dy] = a.pattern[a.i % a.pattern.length], tx = a.x + dx, ty = a.y + dy;
    const m = pieceMoves(s, a, 'you').find((q) => q.x === tx && q.y === ty && !q.swap && !q.push && (!noTake || !takesAny(q)));
    if (m) {
      moveMine(s, k, m);
      if (!a.bounced) a.i = (a.i + 1) % a.pattern.length;
      return true;
    }
    if (a.type !== 'thespian' || tries) break;
    planRoute(s, a);
    if (!a.pattern) break;
  }
  a.blocked = true;
  return false;
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
  // Bubbles (Tile Chess) last a few turns at most: then every one still
  // left bursts, so a King that never moves cannot hide in its own.
  if (r.bubbles && r.bubbleTurns > 0 && n.t >= r.bubbleTurns) for (const q of [...n.pieces, ...n.foes]) delete q.bubble;
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
  if (r.goal === 'carrier' && r.rabbitHop > 0 && n.t % r.rabbitHop === 0) {
    if (!rabbitChosen(r)) { carrierHop(n, 'foe'); carrierHop(n, 'you'); }
    // Chosen, but their side cannot choose (nothing of theirs thinks).
    else if (!n.foes.some((q) => !q.taken && q.brain === 'ai')) carrierHop(n, 'foe');
  }
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
  const yours = c.ep?.side === 'you' ? c.ep : null;
  foesAct(c, chosen);
  // Their chance at en passant on yours has gone with their turn.
  if (yours && c.ep === yours) delete c.ep;
  unstun(c.foes);
}

export function apply(s, mv) {
  const n = playerMove(s, mv);
  if (n.bonus) return n;
  theirTurn(n);
  turnOver(n);
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
  turnOver(c);
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
  turnOver(c);
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
  for (const p of s.pieces) k += p.lifted ? '' : p.taken ? '--' : p.x + ',' + p.y + (p.dir ? 'd' + p.dir : '') + (p.lives > 1 ? 'L' + p.lives : '') + (p.starUsed ? '*' : '') + (p.stun ? 'z' : '') + (p.bubble ? 'o' : '') + (p.moved && p.type === 'pawn' && s.day.rules.pawnTwo ? 'm' : '') + (p.promoted ? p.type : '') + (p.shape ? '~' + p.shape : '') + (p.role ? '%' + p.role : '') + (p.netted ? 'n' + p.netted : '') + (p.used ? 'u' + p.used : '') + (p.ally ? 'a' + (p.i ?? '') + (p.idle ? 'i' + p.idle : '') : '') + ';';
  if (s.bonus) k += `|b${s.bonus.p}${s.bonus.cap ? 'c' : ''}${s.bonus.noCap ? 'n' : ''}${s.bonus.why === 'gears' ? 'g' : ''}`;
  if (s.cloudy) k += '|c';
  if (s.day.rules.oneMove) k += `|f${s.ft || 0}`; // whose turn it is on their side
  // Your set (Adventure): which of it is on the board, and what each keeps.
  if (s.stones?.length) k += '|S' + s.stones.map((t) => `${t.type}${t.x},${t.y}:${t.left}`).join(';');
  if (s.vines?.length) k += '|V' + s.vines.map((v) => `${v.side[0]}${v.x},${v.y}`).sort().join(';');
  if (s.set) k += `|k${s.ci}${s.pending != null ? 'p' + s.pending : ''}` + s.set.map((e, j) => j === s.ci ? '' : (e.lives > 1 ? 'L' + e.lives : '') + (e.starUsed ? '*' : '') + (e.shape ? '~' + e.shape : '') + (e.role ? '%' + e.role : '') + (e.netted ? 'n' + e.netted : '') + (e.used ? 'u' + e.used : '') + (e.lost ? 'x' : '') + (e.out != null ? 'o' + e.out : '') + (e.moved && e.type === 'pawn' ? 'm' : '')).join(',');
  k += '|';
  for (const f of s.foes) k += f.taken ? '--' : f.x + ',' + f.y + ',' + f.i + (f.dir ? 'd' + f.dir : '') + (f.lives > 1 ? 'L' + f.lives : '') + (f.starUsed ? '*' : '') + (f.mx > 0 ? '+' : '-') + (f.my > 0 ? '+' : '-') + (f.idle ? 'i' + f.idle : '') + (f.stun ? 'z' : '') + (f.bubble ? 'o' : '') + (f.moved && f.type === 'pawn' && s.day.rules.pawnTwo ? 'm' : '') + (f.promoted ? f.type : '') + (f.shape ? '~' + f.shape : '') + (f.role ? '%' + f.role : '') + (f.brain === 'sentry' ? 's' : '') + ';';
  if (s.flag) k += `|F${s.flag.by || ''}${s.flag.i},${s.flag.x},${s.flag.y}`;
  if (s.ep) k += `|e${s.ep.side}${s.ep.at}`;
  if (s.hole) k += `|h${s.hole.x},${s.hole.y},${s.hole.i}${s.hole.mx > 0 ? '+' : '-'}${s.hole.my > 0 ? '+' : '-'}`;
  // Which squares are gone matters; the order they went in does not.
  if (s.gone.length) k += '|g' + s.gone.slice().sort((a, b) => a - b).join(',');
  if (s.shrunk?.length) k += '|s' + s.shrunk.slice().sort((a, b) => a - b).join(',');
  // Statues open in a fixed order; statues that can be taken go in any.
  if (s.open?.length) k += '|o' + (s.day.rules.statuesTake || s.day.rules.hedges ? s.open.slice().sort((a, b) => a - b).join(',') : s.open.length);
  if (s.ghostGone?.length) k += '|g' + s.ghostGone.slice().sort((a, b) => a - b).join(',');
  if (s.clouds?.length) k += '|c' + s.clouds.map((c) => c.x + ',' + c.y).join(';') + 't' + s.t;
  if (s.day.gates?.size) k += '|u' + (s.t % 2);
  // On a geared board the same position facing another way is not the same.
  if (s.day.rules.geared) k += '|r' + turns(s);
  // Nor, with Double Time or Lazy Rabbits, at a different point in the turn.
  if (s.day.rules.movesPerTurn > 1 || s.day.rules.lazyFoes) k += '|t' + (s.t % (2 * (s.day.rules.movesPerTurn || 1)));
  return k;
}

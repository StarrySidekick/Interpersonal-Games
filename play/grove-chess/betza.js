// Pieces written down: Betza notation, and the "patent" it gives each piece.
//
// Betza notation (Ralph Betza, "funny notation", from the 1990s) is how fairy
// chess people write a piece down. A piece is a list of moves; each move is
// an atom, the shape of one jump, with letters in front that change it.
//
//   Atoms (a jump of (a, b) squares, in all eight orientations):
//     W (1,0) wazir   F (1,1) ferz    D (2,0) dabbaba  N (2,1) knight
//     A (2,2) alfil   H (3,0)         C (3,1) camel    Z (3,2) zebra
//     G (3,3)         (a,b) any other jump
//     K = WF (king)   R = WW (rook)   B = FF (bishop)  Q = RB (queen)
//   An atom written twice (NN, WW) is a rider: it repeats the jump in a
//   straight line until something stops it. That is what sliding is.
//   Letters in front:
//     m  moves only, never captures      c  captures only
//     p  must hop over one thing first (a screen), then may go on: the
//        xiangqi cannon captures this way (mRcpR)
//     g  grasshopper: hops over the first thing in its line and lands just
//        beyond it
//     n  lame: a leaper that can be blocked on the way, like the xiangqi
//        horse (nN)
//     q  circular: the rose's knight jumps turning round a circle (qN)
//     f b s v  forward, backward, sideways, forward-and-back only (for your
//        pieces forward is up; for theirs it is down)
//
// This module reads that notation, turns it into moves the rules can use
// (`betzaMoves`), and into plain words (`patent`). The pieces that existed
// before it keep their own hand-written move code, so no daily board can
// change; a check proves the notation gives exactly the same moves
// (betza-check.mjs). Pieces added since are made from their notation alone,
// which is also how a new piece could be made one day: write its letters.

// What a square holds, from the mover's side. The same numbers as rules.js
// (copied, not imported, so this module has no import cycle with it).
const OFF = 0, EMPTY = 1, ENEMY = 3;
const MAX_SLIDE = 64; // as in rules.js: no slide is longer, and no loop can run for ever

const ATOMS = { W: [1, 0], F: [1, 1], D: [2, 0], N: [2, 1], A: [2, 2], H: [3, 0], C: [3, 1], Z: [3, 2], G: [3, 3] };
const COMPOUND = { K: 'WF', R: 'WW', B: 'FF', Q: 'WWFF' };
const ATOM_WORDS = {
  '1,0': 'one square straight', '1,1': 'one square diagonally', '2,0': 'two squares straight', '2,1': 'a knight’s L (two and one)',
  '2,2': 'two squares diagonally', '3,0': 'three squares straight', '3,1': 'a long L (three and one)', '3,2': 'a wide L (three and two)',
  '3,3': 'three squares diagonally'
};
const RIDE_WORDS = { '1,0': 'any distance straight', '1,1': 'any distance diagonally', '2,1': 'knight’s Ls, again and again in a line' };

/** Every orientation of an (a, b) jump, going round the circle. */
function orient(a, b) {
  const out = [];
  for (const [p, q] of [[a, b], [b, a], [-b, a], [-a, b], [-a, -b], [-b, -a], [b, -a], [a, -b]])
    if (!out.some(([x, y]) => x === p && y === q)) out.push([p, q]);
  const angle = ([x, y]) => (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  return out.sort((u, v) => angle(u) - angle(v)); // anticlockwise from straight right
}

/** Betza text -> a list of terms: { mods, dirs, jump: [a, b], ride }. */
export function parseBetza(code) {
  const out = [];
  let i = 0;
  const s = code.replace(/\s+/g, '');
  while (i < s.length) {
    let mods = '', dirs = '';
    while (i < s.length && /[mcpgnqfbsvlr]/.test(s[i])) { if ('fbsvlr'.includes(s[i])) dirs += s[i]; else mods += s[i]; i++; }
    let jumps = [];
    if (s[i] === '(') {
      const j = s.indexOf(')', i), [a, b] = s.slice(i + 1, j).split(',').map(Number);
      jumps = [[a, b]]; i = j + 1;
    } else if (COMPOUND[s[i]]) {
      const c = COMPOUND[s[i++]];
      for (let k = 0; k < c.length; k++) {
        const ride = c[k + 1] === c[k];
        out.push({ mods, dirs, jump: ATOMS[c[k]], ride });
        if (ride) k++;
      }
      continue;
    } else if (ATOMS[s[i]]) jumps = [ATOMS[s[i++]]];
    else throw new Error(`Betza: cannot read "${s[i]}" in ${code}`);
    let ride = false;
    if (s[i] && s[i] === s[i - 1] && ATOMS[s[i]]) { ride = true; i++; }
    for (const jump of jumps) out.push({ mods, dirs, jump, ride });
  }
  return out;
}

/** Does direction (dx, dy) suit these direction letters? `fwd` is +1 for
    you (forward is up) and -1 for them. */
function suits(dirs, dx, dy, fwd) {
  if (!dirs) return true;
  const f = dy * fwd > 0, b = dy * fwd < 0, side = dy === 0, vert = dx === 0;
  return [...dirs].some((d) => (d === 'f' && f) || (d === 'b' && b) || (d === 's' && side) || (d === 'v' && vert));
}

/**
 * The move function for a piece written in Betza notation, in the shape
 * rules.js uses: (L, p, fwd) -> [{ x, y, cap }]. `L(x, y)` says what a
 * square holds from the mover's side (OFF, EMPTY, ENEMY, or something in
 * the way).
 */
export function betzaMoves(code) {
  const terms = parseBetza(code);
  return (L, p, fwd = 1) => {
    const found = new Map();
    const put = (x, y, cap) => { const k = `${x},${y}`; if (!found.has(k)) found.set(k, { x, y, cap }); };
    for (const { mods, dirs, jump, ride } of terms) {
      const moveOk = !mods.includes('c') || mods.includes('m'), capOk = !mods.includes('m') || mods.includes('c');
      const vecs = orient(...jump).filter(([dx, dy]) => suits(dirs, dx, dy, fwd));
      if (mods.includes('q')) { circular(L, p, vecs, put); continue; }
      for (const [dx, dy] of vecs) {
        if (mods.includes('g')) {          // grasshopper: over the first thing, land just beyond
          let x = p.x + dx, y = p.y + dy;
          for (let n = 0; n < MAX_SLIDE && L(x, y) === EMPTY; n++) { x += dx; y += dy; }
          if (L(x, y) === OFF || L(x, y) === EMPTY) continue;
          const c = L(x + dx, y + dy);
          if (c === EMPTY || c === ENEMY) put(x + dx, y + dy, c === ENEMY);
          continue;
        }
        if (mods.includes('p')) {          // over one screen first, then on
          let x = p.x + dx, y = p.y + dy;
          for (let n = 0; n < MAX_SLIDE && L(x, y) === EMPTY; n++) { x += dx; y += dy; }
          if (L(x, y) === OFF || L(x, y) === EMPTY) continue;
          x += dx; y += dy;
          for (let n = 0; n < MAX_SLIDE; n++) {
            const c = L(x, y);
            if (c === EMPTY) { if (moveOk) put(x, y, false); if (!ride) break; }
            else { if (c === ENEMY && capOk) put(x, y, true); break; }
            x += dx; y += dy;
          }
          continue;
        }
        if (mods.includes('n') && !ride) { // lame: the square on the way must be empty
          const bx = Math.abs(dx) === Math.abs(dy) ? dx / 2 : Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
          const by = Math.abs(dx) === Math.abs(dy) ? dy / 2 : Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0;
          if (L(p.x + bx, p.y + by) !== EMPTY) continue;
        }
        let x = p.x + dx, y = p.y + dy;
        for (let n = 0; n < MAX_SLIDE; n++) {
          const c = L(x, y);
          if (c === EMPTY) { if (moveOk) put(x, y, false); }
          else { if (c === ENEMY && capOk) put(x, y, true); break; }
          if (!ride) break;
          x += dx; y += dy;
        }
      }
    }
    return [...found.values()];
  };
}

/** The rose's way (q): jumps that turn one place round the circle each
    time, either way round, until something stops them. */
function circular(L, p, vecs, put) {
  const n = vecs.length;
  for (let k = 0; k < n; k++)
    for (const dir of [1, -1]) {
      let x = p.x, y = p.y;
      for (let step = 0; step < n - 1; step++) {
        const [dx, dy] = vecs[(k + dir * step + n * 2) % n];
        x += dx; y += dy;
        const c = L(x, y);
        if (c !== EMPTY && c !== ENEMY) break;
        put(x, y, c === ENEMY);
        if (c === ENEMY) break;
      }
    }
}

// --- The patent: a piece in plain words. ----------------------------------

/**
 * What a piece is, from its notation: how it travels (leaps, slides, hops),
 * how it captures, whether it needs something to hop over, whether it can be
 * blocked, which ways it may go, and the shapes of its moves.
 */
export function patent(code) {
  const terms = parseBetza(code);
  const travel = new Set(), shapes = [], capture = new Set(), notes = new Set();
  for (const t of terms) {
    const key = `${t.jump[0]},${t.jump[1]}`;
    const step = Math.max(...t.jump.map(Math.abs)) === 1;
    const how = t.mods.includes('g') || t.mods.includes('p') ? 'hops' : t.mods.includes('q') ? 'circles' : t.ride ? 'slides' : step ? 'steps' : 'leaps';
    travel.add(how);
    let words = t.mods.includes('q') ? 'knight’s Ls that turn round a circle'
      : t.ride ? RIDE_WORDS[key] || `(${key}) jumps, again and again in a line` : ATOM_WORDS[key] || `a (${key}) jump`;
    if (t.mods.includes('g')) words = `${words.replace('any distance ', '')}, over the first thing in the way, landing just beyond it`;
    if (t.mods.includes('p')) words = `${words}, but over exactly one thing first`;
    const dir = t.dirs ? ` (${[...t.dirs].map((d) => ({ f: 'forward', b: 'backward', s: 'sideways', v: 'forward or back' })[d]).join(' or ')} only)` : '';
    const only = t.mods.includes('m') && !t.mods.includes('c') ? ', to move' : t.mods.includes('c') && !t.mods.includes('m') ? ', to capture' : '';
    shapes.push(words + dir + only);
    if (t.mods.includes('c') && !t.mods.includes('m')) capture.add(t.mods.includes('p') ? 'only by hopping over something' : 'a different way from how it moves');
    else if (!t.mods.includes('m')) capture.add('the way it moves');
    if (t.mods.includes('g') || t.mods.includes('p')) notes.add('needs something to hop over');
    if (t.mods.includes('n')) notes.add('can be blocked on the way');
    if (how === 'leaps' && !t.mods.includes('n')) notes.add(terms.length > 1 ? 'jumps over anything on its leaps' : 'jumps over anything');
    if (t.dirs) notes.add('has a forward');
  }
  const cap = capture.size ? [...capture].join(', or ') : 'never';
  return {
    code,
    travel: [...travel].join(' and '),
    captures: capture.has('the way it moves') && capture.size > 1 ? 'the way it moves, and by hopping' : cap,
    shapes,
    notes: [...notes]
  };
}

/** How many squares a piece reaches on an empty board, averaged over every
    square it could stand on: its mobility, the plainest measure of how
    strong a piece is. Board of n by n. */
export function mobility(moves, n = 6) {
  let total = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const L = (a, b) => (a < 0 || b < 0 || a >= n || b >= n ? OFF : EMPTY);
      total += moves(L, { x, y }, 1).length;
    }
  return total / (n * n);
}

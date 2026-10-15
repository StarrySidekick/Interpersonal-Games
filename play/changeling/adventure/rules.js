// Adventure's rules. No DOM, so the page, the par search and node tests all
// use the same code.
//
// Adventure (Timothy, 2026-10-15) is Changeling turned into a roguelite. You
// start with one rook, bishop or knight and find more, up to four. Pieces
// move as in chess, take by landing, and do not change into what they take.
// The goal on every level is to take every piece of theirs in as few moves
// as you can. Theirs are grey statues that never move; deeper down,
// purple pieces that do move, one a turn, and take yours. Neutral rabbits
// hop in a pattern you can see coming and get in everyone's way. Suits and
// weapons work as in the Grove's descent (play/grove-chess/run.js, rules.js).
//
// Squares are numbered y * W + x, y = 0 at the top. You start at the bottom
// and "forward" for you is up; for theirs it is down.

// --- Pieces. -------------------------------------------------------------------
// leap: jump to this offset; slide: repeat it until something is in the way;
// hop: the cannon's capture, along a line over exactly one thing to the next
// piece beyond (it moves like a rook when not taking). An offset stands for
// all eight of its turns and mirrors. Pawns are their own rule.

export const PIECES = {
  pawn: { name: 'Pawn', say: 'Steps one square forward; takes one square diagonally forward.', value: 1 },
  knight: { name: 'Knight', say: 'Jumps in an L, two one way and one to the side, over anything.', leap: [[1, 2]], value: 3 },
  bishop: { name: 'Bishop', say: 'Slides any distance diagonally.', slide: [[1, 1]], value: 3 },
  rook: { name: 'Rook', say: 'Slides any distance up, down, left or right.', slide: [[1, 0]], value: 5 },
  queen: { name: 'Queen', say: 'Slides any distance in a straight line or a diagonal.', slide: [[1, 0], [1, 1]], value: 9 },
  king: { name: 'King', say: 'Steps one square in any direction.', leap: [[1, 0], [1, 1]], value: 3 },
  camel: { name: 'Camel', say: 'A long knight: jumps three one way and one to the side.', leap: [[1, 3]], value: 2.5 },
  zebra: { name: 'Zebra', say: 'Jumps three one way and two to the side.', leap: [[2, 3]], value: 2.5 },
  alfil: { name: 'Alfil', say: 'Jumps exactly two squares diagonally, over anything.', leap: [[2, 2]], value: 1.5 },
  dabbaba: { name: 'Dabbaba', say: 'Jumps exactly two squares straight, over anything.', leap: [[2, 0]], value: 1.5 },
  ferz: { name: 'Ferz', say: 'Steps one square diagonally.', leap: [[1, 1]], value: 1.5 },
  wazir: { name: 'Wazir', say: 'Steps one square up, down, left or right.', leap: [[1, 0]], value: 1.5 },
  nightrider: { name: 'Nightrider', say: 'A knight that keeps going: the same L again and again in a line.', slide: [[1, 2]], value: 5 },
  cannon: { name: 'Cannon', say: 'Moves like a rook; takes by jumping over exactly one thing in a straight line to the piece beyond.', hop: [[1, 0]], value: 4 },
  squirrel: { name: 'Squirrel', say: 'Jumps to any square exactly two away: straight, diagonal or in between.', leap: [[2, 0], [2, 1], [2, 2]], value: 4 },
  archbishop: { name: 'Archbishop', say: 'A bishop and a knight in one.', slide: [[1, 1]], leap: [[1, 2]], value: 7 },
  chancellor: { name: 'Chancellor', say: 'A rook and a knight in one.', slide: [[1, 0]], leap: [[1, 2]], value: 8 }
};
export const STARTERS = ['rook', 'bishop', 'knight'];

function turns([a, b]) {
  const out = new Map();
  for (const [x, y] of [[a, b], [b, a]])
    for (const sx of [1, -1]) for (const sy of [1, -1]) out.set(`${x * sx},${y * sy}`, [x * sx, y * sy]);
  return [...out.values()];
}
const VEC = {};
for (const [k, p] of Object.entries(PIECES)) {
  VEC[k] = { leap: (p.leap || []).flatMap(turns), slide: (p.slide || []).flatMap(turns), hop: (p.hop || []).flatMap(turns) };
}
/** Does this kind slide (so a lance suits it and its mace pushes)? */
export const slides = (kind) => VEC[kind].slide.length > 0 || VEC[kind].hop.length > 0;

// --- Suits and weapons: the Grove's, word for word where they apply. --------------

export const SUITS = {
  hearts: { name: 'Hearts', mark: '♥', colour: '#e0445a', desc: 'A life more: when it is taken it goes back to your first row instead, and the heart is spent.' },
  spirals: { name: 'Spirals', mark: '@', colour: '#f0903a', desc: 'Round the sides: off the left edge it comes back on at the right, and the other way, like Pac-Man.' },
  gears: { name: 'Gears', mark: '⚙', colour: '#8fa6bd', desc: 'Swap: as its move, it can trade squares with any other piece of yours.' },
  stars: { name: 'Stars', mark: '★', colour: '#e8c547', desc: 'Moves twice: once a level, its first move is followed straight away by a second.' },
  vines: { name: 'Vines', mark: '❦', colour: '#2fb8a0', desc: 'Chain captures: after it takes a piece, it may take another the same turn, and another after that.' }
};
export const WEAPONS = {
  sword: { name: 'Sword', mark: '†', colour: '#d4dbe3', desc: (lv) => `Strikes instead of landing: it cannot move onto a piece, but takes what stands ${['', 'in front of', 'in front of or beside', 'in front of, beside or diagonally in front of'][lv]} where it lands.` },
  lance: { name: 'Lance', mark: '↟', colour: '#c9a46a', desc: (lv) => `Takes what it slides through, up to ${['', 'one piece', 'two pieces', 'three pieces'][lv]}, and lands on an empty square beyond; it cannot move onto a piece. Only on a piece that slides.` },
  mace: { name: 'Mace', mark: '✸', colour: '#a07a5a', desc: (lv) => `Sliding, it pushes up to ${['', 'one piece', 'two pieces', 'three pieces'][lv]} ahead of it; theirs it pushes are stunned, and one already stunned is taken. Stepping or leaping, it stuns what stands ${['', 'in front of and behind', 'round the sides of', 'all round'][lv]} where it lands. A stunned piece misses its next turn.` }
};
const SWORD = { 1: [[0, 1]], 2: [[0, 1], [-1, 0], [1, 0]], 3: [[0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const MACE = { 1: [[0, 1], [0, -1]], 2: [[0, 1], [0, -1], [-1, 0], [1, 0]], 3: [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]] };
export const canArm = (kind, w) => w !== 'lance' || slides(kind);

// --- State. ---------------------------------------------------------------------
// A level: { W, H, on, shape, depth, par }. A state: { L, ps, t, bonus }.
// ps is every piece on the board: { id, kind, side, sq, ... }. Sides:
//   'you'     yours: may carry suit, lives (hearts), weapon and wl, starUsed
//   'foe'     theirs, purple, that move: one of them each turn
//   'stone'   theirs, grey statues that never move
//   'rabbit'  neutral: hops along `pat` (offsets), next step `k`; nobody can take it
// stun: sits out its side's next turn (a mace).
// t counts your turns; bonus is a turn left open by stars or vines.

export const isTheirs = (p) => p.side === 'foe' || p.side === 'stone';
const enemyOf = (side, q) => (side === 'you' ? isTheirs(q) : q.side === 'you');

export function occOf(s) {
  const occ = new Int16Array(s.L.W * s.L.H).fill(-1);
  s.ps.forEach((p, i) => { occ[p.sq] = i; });
  return occ;
}
const clone = (s) => ({ ...s, ps: s.ps.map((p) => ({ ...p })), bonus: s.bonus ? { ...s.bonus } : null });

// --- Moves. ------------------------------------------------------------------------
// A move: { id, to, cap (the id taken where it lands), strike, pass, push, stun,
// swap (the id it trades with) }, or { wait: true } to end a turn a bonus left open.

/** The square at (x, y) for piece p, folding round the sides for Spirals;
    -1 off the board or in a hole. */
function sqFor(L, p, x, y) {
  if (p.suit === 'spirals') x = ((x % L.W) + L.W) % L.W;
  if (x < 0 || y < 0 || x >= L.W || y >= L.H || !L.on[y * L.W + x]) return -1;
  return y * L.W + x;
}

/** Where piece p can go, before its weapon changes anything. */
function baseMoves(s, p, occ) {
  const { L } = s, x0 = p.sq % L.W, y0 = (p.sq / L.W) | 0, fwd = p.side === 'you' ? -1 : 1, out = [], seen = new Set();
  const what = (q) => (occ[q] < 0 ? 'empty' : enemyOf(p.side, s.ps[occ[q]]) ? 'enemy' : 'block');
  const add = (q, cap) => { if (!seen.has(q)) { seen.add(q); out.push({ id: p.id, to: q, ...(cap ? { cap: s.ps[occ[q]].id } : {}) }); } };
  if (p.kind === 'pawn') {
    const f = sqFor(L, p, x0, y0 + fwd);
    if (f >= 0 && what(f) === 'empty') add(f, false);
    for (const dx of [-1, 1]) { const q = sqFor(L, p, x0 + dx, y0 + fwd); if (q >= 0 && what(q) === 'enemy') add(q, true); }
    return out;
  }
  const v = VEC[p.kind];
  for (const [dx, dy] of v.leap) {
    const q = sqFor(L, p, x0 + dx, y0 + dy);
    if (q < 0 || q === p.sq) continue;
    const w = what(q);
    if (w === 'empty') add(q, false); else if (w === 'enemy') add(q, true);
  }
  const limit = L.W * L.H;
  for (const [dx, dy] of v.slide) {
    for (let n = 1, x = x0 + dx, y = y0 + dy; n < limit; n++, x += dx, y += dy) {
      const q = sqFor(L, p, x, y);
      if (q < 0 || q === p.sq) break;
      const w = what(q);
      if (w === 'empty') { add(q, false); continue; }
      if (w === 'enemy') add(q, true);
      break;
    }
  }
  for (const [dx, dy] of v.hop) {
    let screen = false;
    for (let n = 1, x = x0 + dx, y = y0 + dy; n < limit; n++, x += dx, y += dy) {
      const q = sqFor(L, p, x, y);
      if (q < 0 || q === p.sq) break;
      const w = what(q);
      if (!screen) { if (w === 'empty') { add(q, false); continue; } screen = true; continue; }
      if (w === 'empty') continue;
      if (w === 'enemy') add(q, true);
      break;
    }
  }
  return out;
}

/** The directions a piece slides in (for a lance or a mace). */
function slideDirs(p) { return [...VEC[p.kind].slide, ...VEC[p.kind].hop]; }

/** Piece p's moves as its weapon changes them (the Grove's `armed`). */
function armed(s, p, occ, ms) {
  if (!p.weapon) return ms;
  const { L } = s, lv = Math.max(1, Math.min(3, p.wl || 1)), fwd = p.side === 'you' ? -1 : 1;
  const enemyAt = (q) => occ[q] >= 0 && enemyOf(p.side, s.ps[occ[q]]);
  const around = (to, pat) => pat.map(([dx, dy]) => sqFor(L, p, (to % L.W) + dx, ((to / L.W) | 0) + dy * fwd)).filter((q) => q >= 0 && q !== p.sq);
  if (p.weapon === 'sword') {
    return ms.filter((m) => !m.cap).map((m) => {
      const strike = around(m.to, SWORD[lv]).filter(enemyAt).map((q) => s.ps[occ[q]].id);
      return strike.length ? { ...m, strike } : m;
    });
  }
  const x0 = p.sq % L.W, y0 = (p.sq / L.W) | 0, dirs = slideDirs(p), limit = L.W * L.H;
  if (p.weapon === 'lance') {
    if (!dirs.length) return ms;
    const out = ms.filter((m) => !m.cap), seen = new Set(out.map((m) => m.to));
    for (const [dx, dy] of dirs) {
      const pass = [];
      for (let n = 1, x = x0 + dx, y = y0 + dy; n < limit; n++, x += dx, y += dy) {
        const q = sqFor(L, p, x, y);
        if (q < 0 || q === p.sq) break;
        if (occ[q] < 0) { if (pass.length && !seen.has(q)) { seen.add(q); out.push({ id: p.id, to: q, pass: pass.slice() }); } continue; }
        if (enemyAt(q) && pass.length < lv) { pass.push(s.ps[occ[q]].id); continue; }
        break;
      }
    }
    return out;
  }
  if (p.weapon === 'mace') {
    const along = (to) => dirs.some(([dx, dy]) => {
      const ex = (to % L.W) - x0, ey = ((to / L.W) | 0) - y0, k = dx ? ex / dx : ey / dy;
      return Number.isInteger(k) && k >= 1 && ex === k * dx && ey === k * dy;
    });
    const out = ms.map((m) => {
      if (along(m.to)) return m;
      const stun = around(m.to, MACE[lv]).filter(enemyAt).map((q) => s.ps[occ[q]].id);
      return stun.length ? { ...m, stun } : m;
    });
    const seen = new Set(out.map((m) => m.to));
    for (const [dx, dy] of dirs) pushes(s, p, occ, dx, dy, lv, out, seen);
    return out;
  }
  return ms;
}

/** A mace's slide along (dx, dy) that goes on into what is in its way,
    pushing up to lv pieces in a row ahead, one square for each square it
    goes on, onto open ground. One of theirs already stunned is taken. Rabbits
    cannot be pushed. (The Grove's `pushes`.) */
function pushes(s, p, occ, dx, dy, lv, out, seen) {
  const { L } = s, line = [], limit = L.W * L.H;
  for (let n = 1, x = (p.sq % L.W) + dx, y = ((p.sq / L.W) | 0) + dy; n < limit; n++, x += dx, y += dy) {
    const q = sqFor(L, p, x, y);
    if (q < 0 || q === p.sq) break;
    if (occ[q] >= 0) {
      const o = s.ps[occ[q]];
      if (o.side === 'rabbit') { line.push({ q, walk: false, open: false }); break; }
      line.push({ q, piece: { id: o.id, own: o.side === p.side, stunned: !!o.stun } });
      continue;
    }
    line.push({ q, walk: true, open: true });
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
        if (!c.own && c.stunned) log.set(c.id, -1);
        else { at[i + 1] = c; log.set(c.id, line[i + 1].q); }
      }
    } else if (!line[k].walk) return;
    if (!log.size) continue;
    const q = line[k].q;
    if (seen.has(q)) continue;
    seen.add(q);
    out.push({ id: p.id, to: q, push: [...log].map(([id, to]) => ({ id, to })) });
  }
}

/** Every move piece p has now: its weapon, Gears, and a turn left open. */
export function movesOf(s, p, occ = occOf(s)) {
  if (p.stun || p.side === 'stone' || p.side === 'rabbit') return [];
  let ms = armed(s, p, occ, baseMoves(s, p, occ));
  if (p.suit === 'gears') for (const q of s.ps) if (q !== p && q.side === p.side) ms.push({ id: p.id, to: q.sq, swap: q.id });
  if (s.bonus?.cap) ms = ms.filter(takes);
  return ms;
}
/** Does the move take anything? */
export const takes = (m) => !!(m.cap != null || m.strike?.length || m.pass?.length || m.push?.some((e) => e.to < 0));
/** The ids a move takes. */
export const takenBy = (m) => [...(m.cap != null ? [m.cap] : []), ...(m.strike || []), ...(m.pass || []), ...(m.push || []).filter((e) => e.to < 0).map((e) => e.id)];

/** All your moves now: any piece's, or, with a turn left open, that piece's
    and waiting. */
export function yourMoves(s) {
  const occ = occOf(s);
  if (s.bonus) {
    const p = s.ps.find((q) => q.id === s.bonus.id);
    return [...(p ? movesOf(s, p, occ) : []), { wait: true }];
  }
  return s.ps.filter((p) => p.side === 'you').flatMap((p) => movesOf(s, p, occ));
}

// --- Playing a move. ---------------------------------------------------------------

/** Take piece `id` off the board; one of yours with a heart left goes back
    to your first row. Mutates. Returns 1 if it was theirs. */
function remove(s, id) {
  const i = s.ps.findIndex((q) => q.id === id);
  if (i < 0) return 0;
  const p = s.ps[i];
  if (p.side === 'you' && (p.lives || 1) > 1) {
    const home = homeSquare(s, p);
    if (home >= 0) { p.lives -= 1; p.sq = home; p.revived = true; return 0; }
  }
  s.ps.splice(i, 1);
  if (p.side === 'you') s.lost = [...(s.lost || []), p.id];
  return isTheirs(p) ? 1 : 0;
}
/** A free square on your first row, nearest the middle, or the row above. */
function homeSquare(s, p) {
  const { L } = s, occ = occOf(s);
  for (let y = L.H - 1; y >= 0; y--) {
    const row = [];
    for (let x = 0; x < L.W; x++) { const q = y * L.W + x; if (L.on[q] && occ[q] < 0) row.push(q); }
    if (row.length) { row.sort((a, b) => Math.abs((a % L.W) - (L.W - 1) / 2) - Math.abs((b % L.W) - (L.W - 1) / 2)); return row[0]; }
  }
  return -1;
}

/** Apply one move of `side`'s piece. Mutates. Returns how many of theirs it took. */
function moveOne(s, m) {
  const p = s.ps.find((q) => q.id === m.id);
  if (!p) return 0;
  let took = 0;
  if (m.swap != null) {
    const o = s.ps.find((q) => q.id === m.swap);
    if (o) { const a = p.sq; p.sq = o.sq; o.sq = a; }
    return 0;
  }
  // A lance takes what it passes; a mace pushes, before it lands.
  for (const id of m.pass || []) took += remove(s, id);
  for (const e of m.push || []) {
    if (e.to < 0) { took += remove(s, e.id); continue; }
    const o = s.ps.find((q) => q.id === e.id);
    if (o) { o.sq = e.to; if (o.side !== p.side) o.stun = true; }
  }
  if (m.cap != null) took += remove(s, m.cap);
  p.sq = m.to;
  // A sword strikes, a mace on a step or a leap stuns, once it has landed.
  for (const id of m.strike || []) took += remove(s, id);
  for (const id of m.stun || []) { const o = s.ps.find((q) => q.id === id); if (o) o.stun = true; }
  return took;
}

export const cleared = (s) => !s.ps.some(isTheirs);
export const lost = (s) => !s.ps.some((p) => p.side === 'you');

/** Your move, and the rest of the turn: a bonus left open by Stars or
    Vines, or the rabbits' hops and their reply. Returns a new state. While a
    bonus is open, nobody replies and the turn count does not tick. With
    `trace`, s.mid is where everything stood after your move, before the
    rabbits and their reply, for the page to animate in two steps. */
export function play(s0, m, trace = false) {
  const s = clone(s0);
  for (const p of s.ps) delete p.revived;
  delete s.mid; delete s.reply;
  s.last = m;
  if (m.wait) { s.bonus = null; return endTurn(s, trace); }
  const wasBonus = !!s.bonus;
  s.bonus = null;
  const took = moveOne(s, m);
  const p = s.ps.find((q) => q.id === m.id);
  if (cleared(s)) { s.t += 1; s.done = 'cleared'; return s; }
  if (p && p.side === 'you') {
    if (p.suit === 'vines' && took && movesOf(s, p).some(takes)) { s.bonus = { id: p.id, cap: true, why: 'vines' }; return s; }
    if (p.suit === 'stars' && !p.starUsed && !wasBonus) { p.starUsed = true; s.bonus = { id: p.id, cap: false, why: 'stars' }; return s; }
  }
  return endTurn(s, trace);
}

/** The turn's end: yours are unstunned, the rabbits hop, theirs reply, and
    theirs are unstunned. Mutates and returns s. */
function endTurn(s, trace = false) {
  s.t += 1;
  for (const p of s.ps) if (p.side === 'you') delete p.stun;
  if (trace) s.mid = s.ps.map((p) => ({ ...p }));
  hopRabbits(s);
  const m = theirMove(s);
  s.reply = m || null;
  if (m) moveOne(s, m);
  for (const p of s.ps) if (p.side !== 'you') delete p.stun;
  if (lost(s)) s.done = 'lost';
  return s;
}

/** Each rabbit takes the next hop of its pattern. Off the board or into a
    hole, the pattern turns round (and it tries that); onto anything, it
    waits. Mutates. */
export function hopRabbits(s) {
  for (const r of s.ps) {
    if (r.side !== 'rabbit') continue;
    const step = rabbitStep(s, r);
    if (step.flip) { r.pat = r.pat.map(([a, b]) => [-a, -b]); }
    if (step.to >= 0) { r.sq = step.to; r.k = (r.k + 1) % r.pat.length; }
  }
}
/** Where a rabbit will hop next ({ to, flip }), so the page can show it. */
export function rabbitStep(s, r) {
  const { L } = s, occ = occOf(s);
  const at = (pat) => {
    const [dx, dy] = pat[r.k % pat.length], x = (r.sq % L.W) + dx, y = ((r.sq / L.W) | 0) + dy;
    return x < 0 || y < 0 || x >= L.W || y >= L.H || !L.on[y * L.W + x] ? -2 : occ[y * L.W + x] >= 0 ? -1 : y * L.W + x;
  };
  let q = at(r.pat);
  if (q === -2) { const flipped = r.pat.map(([a, b]) => [-a, -b]); const q2 = at(flipped); return { to: q2 >= 0 ? q2 : -1, flip: true }; }
  return { to: q, flip: false };
}

// --- Their mind. ----------------------------------------------------------------------
// One of their moving pieces moves each turn. Deterministic, so the same
// position always gets the same reply, which is what lets the par search
// play a level out ahead of you. In order of wants: take your most valuable
// piece; save one of theirs that you could take; come at you without
// stepping where you could take it.

export function theirMove(s) {
  const occ = occOf(s), foes = s.ps.filter((p) => p.side === 'foe' && !p.stun);
  if (!foes.length) return null;
  const yours = s.ps.filter((p) => p.side === 'you');
  if (!yours.length) return null;
  const danger = new Set();
  for (const p of yours) for (const m of baseMoves(s, { ...p, stun: false, weapon: null }, occ)) if (m.cap != null) danger.add(m.to);
  const { W } = s.L, dist = (a, b) => Math.max(Math.abs((a % W) - (b % W)), Math.abs(((a / W) | 0) - ((b / W) | 0)));
  let best = null, bestScore = -Infinity;
  for (const f of foes) {
    const value = PIECES[f.kind].value;
    for (const m of movesOf(s, f, occ)) {
      let score = 0;
      const hit = takenBy(m).map((id) => s.ps.find((q) => q.id === id)).filter(Boolean);
      for (const h of hit) score += 100 + PIECES[h.kind].value * 10 - ((h.lives || 1) > 1 ? 40 : 0);
      if (danger.has(m.to)) score -= value * 12;
      if (danger.has(f.sq) && !danger.has(m.to)) score += value * 8;
      const near = Math.min(...yours.map((y) => dist(m.to, y.sq)));
      score -= near * 2;
      if (score > bestScore) { bestScore = score; best = m; }
    }
  }
  return best;
}

// --- The par search. ---------------------------------------------------------------------
// A beam search over whole turns: from each kept position, every way to play
// a turn (a bonus included), keep the most promising few, until one clears
// the board. Not always the shortest route, but always a real one, since
// their replies and the rabbits are deterministic. Par is built on it.

/** Moves needed for each kind to get from one square to another on the empty
    board, for judging how close a position is to done. */
function distTables(L, kinds) {
  const out = {};
  for (const kind of kinds) {
    const n = L.W * L.H, tab = new Array(n);
    for (let a = 0; a < n; a++) {
      const d = new Int16Array(n).fill(99);
      if (!L.on[a]) { tab[a] = d; continue; }
      d[a] = 0;
      const queue = [a];
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        const fake = { L, ps: [{ id: 0, kind, side: 'you', sq: q }] };
        for (const m of baseMoves(fake, fake.ps[0], occOf(fake))) if (d[m.to] === 99) { d[m.to] = d[q] + 1; queue.push(m.to); }
      }
      tab[a] = d;
    }
    out[kind] = tab;
  }
  return out;
}

function keyOf(s) {
  return s.ps.map((p) => `${p.id}:${p.sq}${p.stun ? 's' : ''}${p.lives > 1 ? 'h' : ''}${p.starUsed ? '*' : ''}${p.side === 'rabbit' ? 'k' + p.k + (p.pat[0][0] + 9) + (p.pat[0][1] + 9) : ''}`).sort().join(',') + (s.bonus ? `|b${s.bonus.id}${s.bonus.cap ? 'c' : ''}` : '');
}

function score(s, D) {
  const theirs = s.ps.filter(isTheirs), yours = s.ps.filter((p) => p.side === 'you');
  if (!yours.length) return 1e9;
  let near = 99, sum = 0;
  for (const e of theirs) {
    let d = 99;
    for (const y of yours) d = Math.min(d, (D[y.kind]?.[y.sq]?.[e.sq] ?? 99));
    near = Math.min(near, d); sum += Math.min(d, 6);
  }
  return theirs.length * 10 + (theirs.length ? near * 2 + sum * 0.5 : 0) + (s.lost?.length || 0) * 80;
}

/** Every way to finish the turn from s: a list of [moves, state]. */
function turnsFrom(s) {
  const out = [];
  const walk = (st, seq, depth) => {
    for (const m of yourMoves(st)) {
      const n = play(st, m);
      if (n.bonus && depth < 6) walk(n, [...seq, m], depth + 1);
      else out.push([[...seq, m], n]);
    }
  };
  walk(s, [], 0);
  return out;
}

/** The best route the beam finds: { turns, route } (route a list of turns,
    each a list of moves), or null if none clears within `cap` turns. */
export function search(s0, { width = 80, cap = 40 } = {}) {
  const kinds = [...new Set(s0.ps.filter((p) => p.side === 'you').map((p) => p.kind))];
  const D = distTables(s0.L, kinds);
  let beam = [{ s: s0, route: [] }];
  const seen = new Set([keyOf(s0)]);
  for (let t = 0; t < cap; t++) {
    const next = [];
    for (const { s, route } of beam) {
      for (const [moves, n] of turnsFrom(s)) {
        if (n.done === 'cleared') return { turns: n.t, route: [...route, moves] };
        if (n.done === 'lost') continue;
        const k = keyOf(n);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: n, route: [...route, moves], h: score(n, D) });
      }
    }
    if (!next.length) return null;
    next.sort((a, b) => a.h - b.h);
    beam = next.slice(0, width);
  }
  return null;
}

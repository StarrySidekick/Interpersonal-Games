// Kung fu: chess without turns (Timothy, 2026-10-11: "i want to be able to
// test kung fu chess as a variant, and have it be a version of descent you
// can play").
//
// Kung-Fu Chess (Shizmoo Games, 2001-02; Audience Choice at the 2002
// Independent Games Festival) is chess in real time: either side may move
// any piece at any moment, a move takes time to travel, and a piece that has
// moved must rest before it moves again. There is no check: the game ends
// when a King is taken. Its "lightning" speed is a square every fifth of a
// second and two seconds' rest. Here the default is a little slower to read
// (0.3 seconds a square), and their side gentler at first (below).
//
// How this one plays it, on the Grove Chess rules:
// - A move is chosen from the piece's ordinary moves (rules.js movesFor), as
//   things stand when it starts. The piece then leaves its square and is in
//   the air until it lands, a square's travel time per square of distance.
// - Landing on a piece of theirs takes it (or costs it a heart: the attacker
//   bounces back). Landing where a piece of your own has since moved bounces
//   back too. Nothing collides in the air.
// - After moving, a piece rests: yours `cool` ms, theirs `foeCool`. A ring
//   under each resting piece runs down as it recovers (board3d.js marks).
// - Their side chooses in real time, like one opponent: a move at most
//   every `gap` ms, after a head start, noticing yours only after a short
//   reaction time. A move is scored for what it takes, what it dodges, the
//   danger it walks into and how close it gets to your King, with a little
//   noise that sharper rabbits (higher intelligence) have less of.
// - Suits keep their meaning where they can: Hearts a second life, Vines no
//   rest after a capture, Stars no rest after the level's first move, Gears
//   an instant swap, Spirals round the sides. (Weapons are not played here.)
//
// The clock only runs while the page is drawing (requestAnimationFrame), so
// it stops when the phone is put away.

import { PIECES, movesFor, foeMovesAny, reachMaps, clone, lost } from './rules.js';
import { haptic } from '../../engine/ui.js';
import * as sfx from './sounds.js';

const KING = 1000;
const worth = (type) => (type === 'king' ? KING : PIECES[type]?.value ?? 3);

/**
 * Run a level in real time. `level` is the level, `state` its starting
 * state. Calls back: onEnd(state) once, when a King is taken or nothing of
 * yours is left; onStatus(text), onInfo(text) for the lines under the board;
 * onClock(ms). Returns { tap(cell), stop(), state() }.
 */
export function startKungFu({ board, level, state, iq = 5, myCool = 2000, foeCool = 5000, step = 300, gap = 1800, onEnd, onStatus, onInfo, onClock }) {
  const s = clone(state);
  // Weapons (2026-10-13) strike, pierce and push as a turn resolves; with no
  // turns here, they are set aside, and a piece takes by landing as before.
  for (const p of [...s.pieces, ...s.foes]) { delete p.weapon; delete p.wl; delete p.stun; }
  s.t = 0; s.treasure = 0;
  const all = (side) => (side === 'you' ? s.pieces : s.foes);
  for (const p of [...s.pieces, ...s.foes]) { p.ready = 0; p.flying = false; }
  const flights = [];
  // Their side plays like one opponent, not a swarm (2026-10-11: "enemy
  // pieces moving so fast, feels very hard to play"): they start a move at
  // most every `gap` ms, the first only after a head start, and they notice
  // a move of yours only once it has been in the air for `react` ms, so a
  // quick strike cannot be dodged on the instant. Sharper rabbits react
  // sooner.
  let t = 0, last = 0, sel = null, legal = [], alive = true, nextThink = 2500, firstMove = true, lastFoeMove = -Infinity;
  const aware = 0.3 + 0.7 * Math.max(1, Math.min(10, iq)) / 10, react = Math.max(250, 750 - 45 * iq);
  const rand = mulberry(level.seed || 1);

  // --- Moving. ---------------------------------------------------------------
  const at = (list, x, y) => list.findIndex((q) => !q.taken && !q.flying && q.x === x && q.y === y);
  function freeNear(x, y) {
    for (let r = 0; r < Math.max(level.W, level.H); r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const a = x + dx, b = y + dy;
        if (a < 0 || b < 0 || a >= level.W || b >= level.H || level.holes.has(b * level.W + a) || level.stumps.has(b * level.W + a)) continue;
        if (at(s.pieces, a, b) < 0 && at(s.foes, a, b) < 0) return [a, b];
      }
    return [x, y];
  }

  function launch(side, i, m) {
    const p = all(side)[i], dist = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y));
    const rest = side === 'you' ? (firstMove && p.suit === 'stars' ? 0 : myCool) : foeCool;
    if (m.swap) { // Gears: an instant trade of squares with a piece of yours
      const q = s.pieces.find((o) => !o.taken && !o.flying && o.x === m.x && o.y === m.y);
      if (q) { q.x = p.x; q.y = p.y; q.ready = t + rest; }
      p.x = m.x; p.y = m.y; p.ready = t + rest;
    } else {
      const t1 = t + Math.max(1, dist) * step, list = all(side);
      flights.push({ side, i, fx: p.x, fy: p.y, tx: m.x, ty: m.y, t0: t, t1 });
      // A rabbit riding on its head goes along (and is not tired by it).
      list.forEach((q, j) => { if (q.rides === i && !q.taken && !q.flying) { flights.push({ side, i: j, fx: p.x, fy: p.y, tx: m.x, ty: m.y, t0: t, t1, rider: true }); q.flying = true; q.x = -100; q.y = -100; } });
      p.flying = true; p.fromX = p.x; p.fromY = p.y; p.x = -100; p.y = -100; delete p.rides;
      p.ready = t1 + rest;
    }
    if (side === 'you') { s.t++; firstMove = false; sfx.move(); haptic(8); }
    else sfx.slide();
  }

  function land(f) {
    const mine = all(f.side), theirs = all(f.side === 'you' ? 'foe' : 'you'), p = mine[f.i];
    p.flying = false;
    const back = () => { [p.x, p.y] = freeNear(f.fx, f.fy); sfx.bump(); };
    // A rabbit landing on a head of its own side rides there.
    const head = at(mine, f.tx, f.ty);
    if (head >= 0 && p.type === 'bunny' && mine[head].type !== 'bunny' && !mine.some((q) => q.rides === head && !q.taken)) {
      p.x = f.tx; p.y = f.ty; p.rides = head; sfx.drop(f.i); return;
    }
    if (f.rider) { [p.x, p.y] = freeNear(f.tx, f.ty); return; } // its carrier did not make it
    if (head >= 0) return back(); // one of its own got there first
    const k = at(theirs, f.tx, f.ty);
    if (k >= 0) {
      const v = theirs[k];
      if ((v.lives || 1) > 1) { v.lives--; back(); haptic([20, 30, 20]); return; } // Hearts
      v.taken = true;
      theirs.forEach((q) => { if (!q.taken && !q.flying && q.x === f.tx && q.y === f.ty) q.taken = true; }); // and a rabbit riding on it
      if (f.side === 'you') {
        sfx.capture(); haptic([30, 20, 40]);
        if (p.suit === 'vines') p.ready = t; // Vines: no rest after a capture
        onStatus?.(`You took their ${PIECES[v.type].name}.`);
      } else { sfx.eat(); haptic([40, 30, 40]); onStatus?.(`Their ${PIECES[p.type].name} took your ${PIECES[v.type].name}.`); }
      if (sel != null && f.side === 'foe' && v === s.pieces[sel]) { sel = null; legal = []; }
    }
    p.x = f.tx; p.y = f.ty; p.moved = true;
    // A pawn on the far row becomes a queen, where the level says so (the
    // descent's copies are chosen on a turn, so here it stays a pawn).
    if (level.rules.promote === true && p.type === 'pawn' && p.y === (f.side === 'you' ? level.H - 1 : 0)) p.type = 'queen';
    sfx.drop(f.i);
    if (sel != null) legal = selectable(sel) ? movesFor(s, sel) : [];
  }

  // --- Their side, in real time. ---------------------------------------------
  function think() {
    if (t - lastFoeMove < gap) return;
    const reach = reachMaps(s).yours, W = level.W;
    for (const f of flights) if (f.side === 'you' && t - f.t0 >= react) reach.add(f.ty * W + f.tx); // where yours are about to land, once seen
    const king = s.pieces.find((p) => !p.taken && !p.flying && p.type === 'king') || s.pieces.find((p) => !p.taken && !p.flying);
    let best = null;
    s.foes.forEach((f, k) => {
      if (f.taken || f.flying || f.ready > t) return;
      const threatened = reach.has(f.y * W + f.x), mine = worth(f.type);
      for (const m of foeMovesAny(s, k)) {
        let v = 0;
        const victim = m.cap ? s.pieces.find((p) => !p.taken && !p.flying && p.x === m.x && p.y === m.y) : null;
        if (victim) v += 10 * worth(victim.type);
        if (reach.has(m.y * W + m.x)) v -= aware * 6 * Math.min(mine, 60);
        if (threatened) v += aware * 6 * Math.min(mine, 60); // dodging
        if (king) v -= 0.3 * Math.max(Math.abs(m.x - king.x), Math.abs(m.y - king.y));
        v += rand() * (11 - iq) * 0.6;
        if (!best || v > best.v) best = { k, m, v };
      }
    });
    if (best && best.v > -4) { launch('foe', best.k, best.m); lastFoeMove = t; }
  }

  // --- The clock. -------------------------------------------------------------
  function frame(now) {
    if (!alive) return;
    const dt = last ? Math.min(100, now - last) : 0; // a long gap (the phone asleep) does not count
    last = now; t += dt;
    // Land whatever has arrived, in the order it set off (a carrier before
    // the rabbit riding on it).
    const due = flights.filter((f) => f.t1 <= t);
    for (const f of due) { flights.splice(flights.indexOf(f), 1); land(f); }
    if (!s.won && s.foes.some((f) => f.target && f.taken)) s.won = true;
    if (s.won || lost(s)) { alive = false; draw(); setTimeout(() => onEnd?.(s), 700); return; }
    if (t >= nextThink) { think(); nextThink = t + 260 + rand() * 220; }
    onClock?.(t);
    draw();
    requestAnimationFrame(frame);
  }

  /** What the board shows: pieces in the air part way along, and each
      resting piece's `cool`, the share of its rest still to go. */
  function draw() {
    const d = clone(s);
    const put = (list, dl, side) => list.forEach((p, i) => {
      const q = dl[i];
      q.cool = !p.flying && p.ready > t ? Math.min(1, (p.ready - t) / (side === 'you' ? myCool : foeCool)) : 0;
    });
    put(s.pieces, d.pieces, 'you'); put(s.foes, d.foes, 'foe');
    for (const f of flights) {
      const k = Math.min(1, (t - f.t0) / (f.t1 - f.t0)), e = k * k * (3 - 2 * k), q = all(f.side) === s.pieces ? d.pieces[f.i] : d.foes[f.i];
      q.x = f.fx + (f.tx - f.fx) * e; q.y = f.fy + (f.ty - f.fy) * e;
    }
    board.draw({ state: d, sel, legal });
  }

  const selectable = (i) => { const p = s.pieces[i]; return p && !p.taken && !p.flying && p.ready <= t; };

  function tap(c) {
    if (!alive) return;
    if (sel != null && legal.some((m) => m.x === c.x && m.y === c.y)) {
      const m = legal.find((q) => q.x === c.x && q.y === c.y);
      if (selectable(sel)) { launch('you', sel, m); sel = null; legal = []; onInfo?.('Tap a piece of yours that is ready.'); return; }
    }
    // Two of yours on one square (a rabbit on a head): rabbit first, then the piece under it.
    const here = s.pieces.map((q, k) => k).filter((k) => !s.pieces[k].taken && !s.pieces[k].flying && s.pieces[k].x === c.x && s.pieces[k].y === c.y)
      .sort((a, b) => (s.pieces[b].rides != null) - (s.pieces[a].rides != null));
    const i = here.length ? (here.includes(sel) ? here[here.indexOf(sel) + 1] ?? -1 : here[0]) : -1;
    if (i < 0) { sel = null; legal = []; return; }
    if (!selectable(i)) { onInfo?.(`Your ${PIECES[s.pieces[i].type].name} is resting. The ring under it shows how long.`); sel = null; legal = []; return; }
    sel = i;
    legal = movesFor(s, sel);
    if (sel != null) onInfo?.(`${PIECES[s.pieces[i].type].name}: tap where it should go.`);
  }

  /** The best move it can see for you now (the testing button): the most
      valuable capture by a piece that is ready, else a move by one to a
      square none of theirs can reach. No turns here, so no lookahead. */
  function best() {
    if (!alive) return false;
    const reach = reachMaps(s).theirs, W = level.W, worth = (t) => PIECES[t]?.value || 1;
    let pick = null, score = -Infinity;
    s.pieces.forEach((p, i) => {
      if (!selectable(i) || p.type === 'ball') return;
      for (const m of movesFor(s, i)) {
        const f = s.foes.find((q) => !q.taken && !q.flying && q.x === m.x && q.y === m.y);
        const v = (f ? worth(f.type) * 10 + (f.type === 'king' ? 1000 : 0) : 0) - (reach.has(m.y * W + m.x) ? worth(p.type) * 5 : 0) + Math.random();
        if (v > score) { score = v; pick = { i, m }; }
      }
    });
    if (!pick) return false;
    launch('you', pick.i, pick.m); sel = null; legal = [];
    return true;
  }

  requestAnimationFrame(frame);
  return { tap, best, stop: () => { alive = false; }, state: () => s };
}

/** A small seeded random number generator (mulberry32). */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

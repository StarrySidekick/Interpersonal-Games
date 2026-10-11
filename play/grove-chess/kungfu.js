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
// - Suits keep their meaning where they can: Hearts a second life, Swords no
//   rest after a capture, Stars no rest after the level's first move,
//   Diamonds treasure, Spirals an instant swap, Spirits through anything.
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
    if (m.swap) { // Spirals: an instant trade of squares with a piece of yours
      const q = s.pieces.find((o) => !o.taken && !o.flying && o.x === m.x && o.y === m.y);
      if (q) { q.x = p.x; q.y = p.y; q.ready = t + rest; }
      p.x = m.x; p.y = m.y; p.ready = t + rest;
    } else {
      flights.push({ side, i, fx: p.x, fy: p.y, tx: m.x, ty: m.y, t0: t, t1: t + Math.max(1, dist) * step });
      p.flying = true; p.fromX = p.x; p.fromY = p.y; p.x = -100; p.y = -100;
      p.ready = t + Math.max(1, dist) * step + rest;
    }
    if (side === 'you') { s.t++; firstMove = false; sfx.move(); haptic(8); }
    else sfx.slide();
  }

  function land(f) {
    const mine = all(f.side), theirs = all(f.side === 'you' ? 'foe' : 'you'), p = mine[f.i];
    p.flying = false;
    const back = () => { [p.x, p.y] = freeNear(f.fx, f.fy); sfx.bump(); };
    if (at(mine, f.tx, f.ty) >= 0) return back(); // one of its own got there first
    const k = at(theirs, f.tx, f.ty);
    if (k >= 0) {
      const v = theirs[k];
      if ((v.lives || 1) > 1) { v.lives--; back(); haptic([20, 30, 20]); return; } // Hearts
      v.taken = true;
      if (f.side === 'you') {
        sfx.capture(); haptic([30, 20, 40]);
        if (p.suit === 'diamonds') s.treasure++;
        if (p.suit === 'swords') p.ready = t; // Swords: no rest after a capture
        onStatus?.(`You took their ${PIECES[v.type].name}.`);
      } else { sfx.eat(); haptic([40, 30, 40]); onStatus?.(`Their ${PIECES[p.type].name} took your ${PIECES[v.type].name}.`); }
      if (sel != null && f.side === 'foe' && v === s.pieces[sel]) { sel = null; legal = []; }
    }
    p.x = f.tx; p.y = f.ty;
    // A pawn on the far row becomes a queen, where the level says so.
    if (level.rules.promote && p.type === 'pawn' && p.y === (f.side === 'you' ? level.H - 1 : 0)) p.type = 'queen';
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
    for (let n = flights.length - 1; n >= 0; n--) if (flights[n].t1 <= t) { const f = flights.splice(n, 1)[0]; land(f); }
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
    const i = at(s.pieces, c.x, c.y);
    if (i < 0) { sel = null; legal = []; return; }
    if (!selectable(i)) { onInfo?.(`Your ${PIECES[s.pieces[i].type].name} is resting. The ring under it shows how long.`); sel = null; legal = []; return; }
    sel = sel === i ? null : i;
    legal = sel == null ? [] : movesFor(s, sel);
    if (sel != null) onInfo?.(`${PIECES[s.pieces[i].type].name}: tap where it should go.`);
  }

  requestAnimationFrame(frame);
  return { tap, stop: () => { alive = false; }, state: () => s };
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

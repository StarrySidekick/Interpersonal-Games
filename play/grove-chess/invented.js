// Pieces Timothy invents in the catalog (pieces/), and his notes on the
// pieces there are: which to keep out of the game for now, and how each
// should change. (Timothy, 2026-10-08: "a global setting for pieces so i
// can veto some pieces for future build, with a comment area to say how it
// should change ... also allow me to invent new pieces there".)
//
// An invented piece is a name, a Betza code (betza.js: the code IS the
// piece; its moves are made from it), the look of an existing piece, and a
// description. Registered, it is a piece like any other: it can be dealt,
// drawn, diagrammed and played.

import { PIECES } from './rules.js';
import { betzaMoves, parseBetza, mobility } from './betza.js';
import { setLook } from './models.js';
import { CONFIG } from './config.js';

const KEY = 'ig.grove.catalog.v1';

/** The catalog's notes: { vetoed: [type], notes: { type: text }, invented: [piece] }. */
/** Off until a mode gives them a use (2026-10-09): pieces that cannot take
    anything without something to hop over, which on a small board with few
    pieces is seldom there. Measured by power.js (needsScreen); a test checks
    the two agree. Turned off once, as vetoes: let one back in from the
    catalog and it stays in. */
export const DEFAULT_OFF = ['cannon', 'grasshopper'];
// Each later step is applied once, on top: the vao (2026-10-10) needs a
// screen like the cannon. Then any piece config.js turns off, once each.
const OFF_STEPS = [DEFAULT_OFF, ['vao']];

export function loadCatalog() {
  let c = null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1) c = { vetoed: [], notes: {}, invented: [], ...s };
  } catch { /* storage blocked */ }
  c = c || { version: 1, vetoed: [], notes: {}, invented: [] };
  const step = c.offDefaults || 0, cfgOff = Object.keys(CONFIG.pieces || {}).filter((k) => CONFIG.pieces[k]?.off);
  const newlyOff = cfgOff.filter((k) => !(c.configOff || []).includes(k));
  // And any config.js lets back in (`on`: a piece off by default, wanted in).
  const newlyOn = Object.keys(CONFIG.pieces || {}).filter((k) => CONFIG.pieces[k]?.on && !(c.configOn || []).includes(k));
  if (step < OFF_STEPS.length || newlyOff.length || newlyOn.length) {
    c.vetoed = [...new Set([...c.vetoed, ...OFF_STEPS.slice(step).flat(), ...newlyOff])].filter((k) => !newlyOn.includes(k));
    c.offDefaults = OFF_STEPS.length;
    c.configOff = [...new Set([...(c.configOff || []), ...newlyOff])];
    c.configOn = [...new Set([...(c.configOn || []), ...newlyOn])];
    saveCatalog(c);
  }
  return c;
}

export function saveCatalog(c) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...c, version: 1 })); } catch { /* never lose a game over storage */ }
}

/** Does a Betza code read? Returns an error message, or null. */
export function betzaError(code) {
  if (!code || !code.trim()) return 'Write a Betza code, like N for a knight or RN for a rook that can also jump like a knight.';
  let terms;
  try { terms = parseBetza(code); } catch (e) { return e.message.replace(/^Betza: /, ''); }
  if (terms.some((t) => t.mods.includes('q') && (t.ride || /[pgn]/.test(t.mods))))
    return 'Circular moves (q) work only on a plain leap, like qN (the rose) or qW, not on a slide or a hop.';
  if (!betzaMoves(code)((x, y) => (x < 0 || y < 0 || x > 6 || y > 6 ? 0 : 1), { x: 3, y: 3 }, 1).length) return 'It reads, but it cannot move anywhere on an empty board.';
  return null;
}

/**
 * Strength in pawns, estimated from mobility (the plain measure) on an
 * eight by eight board: about 0.38 of a pawn per square for sliding moves
 * and 0.55 for leaps and steps (0.43 for circling), which is roughly what the known pieces
 * show (a rook: 14 squares, 5 pawns; a knight: 5.3 squares, 3.25), and a
 * pawn and a half more for pieces that both slide and leap.
 */
export function estimateStrength(code) {
  let total = 0;
  const terms = parseBetza(code);
  // A piece that both slides and leaps is worth more than its halves: each
  // covers what the other cannot reach.
  if (terms.some((t) => t.ride) && terms.some((t) => !t.ride && !t.mods)) total += 1.5;
  for (const t of terms) {
    const one = betzaMoves(`${t.mods}${t.dirs}${t.ride ? atomName(t.jump).repeat(2) : `(${t.jump[0]},${t.jump[1]})`}`);
    // Circling (q) reaches many squares, but each can be blocked on the way
    // round, so it counts between a slide and a leap (the rose comes out at
    // its known 5.5).
    const rate = t.ride ? 0.38 : t.mods.includes('q') ? 0.43 : 0.55;
    total += mobility(one, 8) * rate * (t.mods.includes('m') || t.mods.includes('c') ? 0.6 : 1);
  }
  return Math.max(0.5, Math.round(total * 4) / 4);
}
const atomName = ([a, b]) => ({ '1,0': 'W', '1,1': 'F', '2,0': 'D', '2,1': 'N', '2,2': 'A', '3,0': 'H', '3,1': 'C', '3,2': 'Z', '3,3': 'G' })[`${a},${b}`] || 'W';

/** Only the invented pieces that are whole and readable. */
export function cleanInvented(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((p) => p && typeof p.id === 'string' && /^x-[a-z0-9-]{1,40}$/.test(p.id) && typeof p.name === 'string' && !betzaError(p.betza))
    .map((p) => ({ id: p.id, name: p.name.slice(0, 40), betza: p.betza.trim(), look: PIECES[p.look] && !PIECES[p.look].invented ? p.look : 'pawn', desc: String(p.desc || '').slice(0, 300),
      ...(p.made ? { made: true } : {}) }));
}

/** Make invented pieces real pieces. Safe to call again. */
export function registerInvented(list) {
  for (const p of cleanInvented(list)) {
    if (PIECES[p.id] && !PIECES[p.id].invented) continue; // never replace a real piece
    const strength = estimateStrength(p.betza);
    PIECES[p.id] = {
      name: p.name, kind: 'fairy', invented: true, look: p.look,
      tier: strength >= 7 ? 2 : strength >= 3 ? 1 : 0, value: strength, strength, betza: p.betza,
      desc: p.desc || `An invented piece: ${p.betza}.`, origin: p.made ? `Made in a run, from a ${PIECES[p.look]?.name.toLowerCase() || 'piece'}, by a suit or by fusing.` : 'Invented by Timothy, in the pieces catalog.',
      moves: betzaMoves(p.betza)
    };
    setLook(p.id, p.look);
  }
}

/** An id for a new invented piece, from its name. */
export function newId(name, taken) {
  const base = 'x-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'piece');
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

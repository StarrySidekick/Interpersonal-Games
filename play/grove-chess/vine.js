// The vine: how a group chat becomes the database.
//
// Your share link carries your whole game, as a list of moves, in the part of
// the URL after the #. That part (the fragment) is never sent to any server;
// it stays inside the browser that opens it. Because every phone deals the
// same board for a date, a list of moves is enough to replay anyone's game.
//
// When someone plays from your link, their link carries your game and theirs.
// So a link is a branch: everyone from the first post down to the latest
// reply. Each browser keeps every game it has ever been shown for a day, and
// only ever adds to that list, so two links merge by putting them together.
//
// Link format:  #d=2026-10-05&v=Mara.0a1b2c~Tombo.w00d3e
//   each game:  name . moves      games joined by ~
//   each move:  piece (0-3, or w for wait), then the square as one base-36
//               character (y * N + x)

import { replay, isOver, outcome } from './rules.js';

const KEY = 'ig.grove.v1';

export function cleanName(s) {
  return String(s || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 14);
}

export function encodeMoves(moves, N) {
  return moves.map((m) => (m.p < 0 ? 'w0' : m.p + (m.y * N + m.x).toString(36))).join('');
}

export function decodeMoves(str, N) {
  if (!/^([0-3w][0-9a-z])*$/.test(str) || str.length > 60) return null;
  const out = [];
  for (let i = 0; i < str.length; i += 2) {
    if (str[i] === 'w') { out.push({ p: -1, x: 0, y: 0 }); continue; }
    const sq = parseInt(str[i + 1], 36);
    out.push({ p: Number(str[i]), x: sq % N, y: Math.floor(sq / N) });
  }
  return out;
}

/** A finished game, checked by replaying it. Null if it is not a real one. */
export function checkPlay(day, name, moves) {
  if (!moves) return null;
  const { states, ok } = replay(day, moves);
  const end = states[states.length - 1];
  if (!ok || !isOver(end)) return null;
  return { name: cleanName(name) || 'Someone', moves, caught: end.won, score: end.t, outcome: outcome(end), states };
}

export function playKey(p, N) { return p.name + '.' + encodeMoves(p.moves, N); }

export function readLink(hash = location.hash) {
  const out = { date: null, plays: [] };
  for (const part of hash.replace(/^#/, '').split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq), v = part.slice(eq + 1);
    if (k === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out.date = v;
    if (k === 'v') out.raw = v;
  }
  return out;
}

/** Turn the raw vine from a link into checked games, for a known day. */
export function parseVine(day, raw) {
  if (!raw) return [];
  const plays = [];
  for (const chunk of raw.split('~').slice(0, 200)) {
    const dot = chunk.lastIndexOf('.');
    if (dot < 0) continue;
    let name;
    try { name = decodeURIComponent(chunk.slice(0, dot)); } catch { continue; }
    const p = checkPlay(day, name, decodeMoves(chunk.slice(dot + 1), day.N));
    if (p) plays.push(p);
  }
  return plays;
}

export function makeLink(base, day, plays) {
  const v = plays.map((p) => encodeURIComponent(cleanName(p.name) || 'Someone') + '.' + encodeMoves(p.moves, day.N)).join('~');
  return `${base}#d=${day.date}&v=${v}`;
}

// --- What this browser remembers. -----------------------------------------
// Things are only ever added: a game you have seen stays seen.

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1 && s.days) return s;
  } catch { /* private mode, blocked storage, a corrupt blob: play anyway */ }
  return { version: 1, name: '', days: {} };
}

export function save(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* never end a game over storage */ }
}

/** The day's entry: your moves, whether you finished, the branch you came
    in on, and every game seen, all as encoded strings so they survive JSON. */
export function dayEntry(store, date) {
  if (!store.days[date]) store.days[date] = { moves: '', done: false, branch: '', seen: [] };
  return store.days[date];
}

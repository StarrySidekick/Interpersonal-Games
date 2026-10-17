// The daily from 2026-10-17 (version 5): three boards of Adventure, the
// same for everyone that day (Timothy, 2026-10-17: "i want to adapt daily
// mode to be a 5 minute or less version of adventure you can play and
// share").
//
// A day is made ahead of time by make-daily5.mjs and kept in
// dailies5/YYYY-MM.js: a name, the day's set (your cat and three more, some
// with a suit or a weapon), and three boards, each a level in the
// workshop's terms (its settings and seed, which makeLevel lays out
// exactly) with its par. check-daily5.mjs keeps a fingerprint of each.
// Why stored and not dealt on the phone: Adventure deals against the clock
// (lab.js searchLayouts gives up after so many seconds), so two phones
// would deal two different boards.
//
// Scoring is golf's, board by board. Par is the solver's best line plus
// two, so an eagle is the best line it found (Adventure's own par, set by
// depth, comes out about the same). A board not cleared, or cleared worse
// than a double bogey, counts as a double bogey: golf's "net double bogey"
// cap. And a board ends there: at par plus two moves not cleared, the
// floor gives way, so no board can eat the five minutes.
//
// Sharing is the old daily's vine, made small: the link carries each
// player's moves per board (not every move: the boards are the same for
// everyone, so a score is all a friend needs to compare), and whoever plays
// from it adds theirs.
//
//   #d=2026-10-18&r=Mara.3.5.6~Tombo.4.x.7
//   each player: name, then the moves on each board ('x' not cleared)

import { decodeLevel } from './lab.js';
import { cleanName } from './vine.js';

export const DAILY5_FROM = '2026-10-17';
/** A board ends, not cleared, this many moves past par. */
export const PICK_UP = 2;
/** How many boards a day. */
export const BOARDS = 3;

const ms = (date) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** Which daily this is: #1 on 2026-10-17. */
export const dailyNumber = (date) => Math.round((ms(date) - ms(DAILY5_FROM)) / 86400000) + 1;
/** The date n days on (or back) from this one. */
export const shiftDate = (date, n) => new Date(ms(date) + n * 86400000).toISOString().slice(0, 10);

const months = new Map();
/** The stored days for a month ({} if there are none). */
export function monthOf(date) {
  const ym = date.slice(0, 7);
  if (!months.has(ym)) months.set(ym, import(`./dailies5/${ym}.js`).then((m) => m.default).catch(() => ({})));
  return months.get(ym);
}

/** A date's day, or null if none was made for it. */
export async function loadToday(date) {
  if (date < DAILY5_FROM) return null;
  const b = (await monthOf(date))[date];
  return b ? { date, number: dailyNumber(date), ...b } : null;
}

/** A stored board's level: { settings, seed }, for makeLevel. */
export const boardLevel = (b) => decodeLevel(`lab=${b.lab}&v=${b.v}&seed=${b.seed}`);

// --- Scoring. --------------------------------------------------------------------

/** A board's strokes: the moves it took, capped at a double bogey; not
    cleared, a double bogey. `r` is { t, won } or null (not played). */
export const strokesOf = (r, par) => (r?.won ? Math.min(r.t, par + PICK_UP) : par + PICK_UP);

/** The golf word for strokes against par. */
export const scoreWord = (d) => (d <= -3 ? 'Albatross' : ({ '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey' })[d] ?? 'Double bogey');

/** A scorecard's mark, as golf scorecards draw them: an eagle circled
    twice, a birdie once, par plain, a bogey boxed, a double bogey boxed
    twice. Plain text, so a share reads the same in any chat. */
export const markOf = (d) => (d <= -2 ? '◎' : d === -1 ? '○' : d === 0 ? '–' : d === 1 ? '□' : '▣');

/** A whole card: per board { par, strokes, d }, and the totals. */
export function card(day, results) {
  const rows = day.boards.map((b, i) => {
    const r = results[i] || null, strokes = r ? strokesOf(r, b.par) : null;
    return { par: b.par, strokes, d: strokes == null ? null : strokes - b.par, won: !!r?.won };
  });
  const played = rows.filter((r) => r.strokes != null);
  return { rows, par: day.boards.reduce((a, b) => a + b.par, 0), strokes: played.reduce((a, r) => a + r.strokes, 0),
    vs: played.reduce((a, r) => a + r.d, 0), done: played.length === day.boards.length };
}

/** "-3", "+1", "E" (even), as golf says it. */
export const vsText = (vs) => (vs === 0 ? 'E' : vs > 0 ? `+${vs}` : `${vs}`);

// --- What this browser remembers. -------------------------------------------------
// Only ever added to: a day you played stays played. No streaks: the record
// counts days played, never days in a row.

const KEY = 'ig.grove.daily5.v1';

export function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1 && s.days) return s; } catch { /* blocked: play anyway */ }
  return { version: 1, days: {} };
}
export function saveStore(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* never end a game over storage */ } }

/** A date's entry: results so far ({ t, won } per board), the moves of the
    board in play (to pick up where you left off), whether it is done, the
    branch you came in on, and every friend's result seen. */
export function dayEntry(store, date) {
  if (!store.days[date]) store.days[date] = { results: [], moves: [], done: false, branch: '', seen: [] };
  return store.days[date];
}

/** Your name: the old daily's, so it carries over (vine.js keeps it). */
export function myName() {
  try { return cleanName(JSON.parse(localStorage.getItem('ig.grove.v1'))?.name || ''); } catch { return ''; }
}
export function setMyName(name) {
  try {
    const s = JSON.parse(localStorage.getItem('ig.grove.v1')) || { version: 1, name: '', days: {} };
    s.name = cleanName(name);
    localStorage.setItem('ig.grove.v1', JSON.stringify(s));
  } catch { /* blocked */ }
}

// --- Links. ------------------------------------------------------------------------

/** One player's chunk: "Mara.3.5.6" (x for a board not cleared). */
export function chunkOf(name, results) {
  return `${encodeURIComponent(cleanName(name) || 'Someone')}.${results.map((r) => (r?.won ? r.t : 'x')).join('.')}`;
}

/** A chunk back into { name, results }, or null if it does not read. */
export function readChunk(chunk) {
  const parts = String(chunk).split('.');
  if (parts.length !== BOARDS + 1) return null;
  let name;
  try { name = cleanName(decodeURIComponent(parts[0])); } catch { return null; }
  const results = parts.slice(1).map((p) => (p === 'x' ? { t: null, won: false } : /^\d{1,2}$/.test(p) ? { t: +p, won: true } : undefined));
  return name && results.every(Boolean) ? { name, results, chunk: `${encodeURIComponent(name)}.${parts.slice(1).join('.')}` } : null;
}

/** What a link carries: its date and the players on it. */
export function readLink(hash = location.hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get('d') || '') ? p.get('d') : null;
  const players = (p.get('r') || '').split('~').slice(0, 200).map(readChunk).filter(Boolean);
  return { date, players };
}

/** The link to share: the branch you came in on, then you. */
export function makeLink(base, date, chunks) {
  return `${base}#d=${date}&r=${[...new Set(chunks)].join('~')}`;
}

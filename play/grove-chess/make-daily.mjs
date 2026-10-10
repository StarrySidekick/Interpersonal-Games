// Makes the daily boards ahead of time, from dealer version 4 (2026-10-09).
//
//   node play/grove-chess/make-daily.mjs 2026-10-09 60
//
// deals boards for 60 days from that date and writes them into
// dailies/YYYY-MM.js, one file a month. A date already in a file is never
// dealt again: a shipped board never changes (check-daily.mjs guards them).
// Each board carries its fingerprint (daily-print.mjs).
//
//   node play/grove-chess/make-daily.mjs --stamp
//
// adds the fingerprint to any stored board that has none, and nothing else.
//
// Why ahead of time: the daily wants the heavy measures (metrics.js plays
// each candidate two dozen times), and many rolls are thrown away before one
// passes. That is minutes of work, too slow for a phone at breakfast. Done
// here once, every phone just reads the board, and it is the same everywhere
// by construction rather than by everyone throwing away the same boards.
//
// What a v4 daily must be (Timothy, 2026-10-08): "one board, large spectrum
// between moves to win possible, as in its really hard to win the match in a
// few moves and easy to win in a lot ... high skill ceiling ... very
// balanced ... can draw from any other rule as long as those parameters are
// met." So each roll is a Chaos roll (any rules at all), kept only if:
//   - the solver can win it, in 4 to 10 moves (par; 3 to 10 from 2026-10-11);
//   - it passes the balance rules (solve.js);
//   - difficulty 3 to 6 of 10, and a novice bot wins at least half its games
//     (easy to win in a lot of moves);
//   - skill ceiling at least 0.6: the novice takes 1.6 times par or more
//     (hard to win in few);
//   - engagement at least 50 of 100;
//   - the move limit is at least twice par, so the slow way really is open.
// And a few limits so the daily's share links keep working: at most 36
// squares, at most 30 moves (vine.js writes a move as two characters: the
// piece, and the square in base 36). From 2026-10-11 (settings version 12)
// each side has a full row, as many pieces as the board is wide (Timothy,
// 2026-10-10: "mostly for the daily board"), with the first-turn cloud and
// every piece's reach shown; the link's piece digit runs 0 to 9 for it. It
// was at most four pieces of yours before.

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modeDefaults, levelSettings } from './modes.js';
import { searchLayouts, encodeLevel, clean, SETTINGS_VERSION } from './lab.js';
import { rng } from '../../engine/seed.js';
import { dailyName, THEMES } from './daily-names.js';
import { dayFromBoard } from './daily4.js';
import { boardPrint } from './daily-print.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [from = '2026-10-09', count = '30'] = process.argv.slice(2);
const MAX_ROLLS = 80;

/** A roll's settings, held to the daily's limits. */
function dailyRoll(rand) {
  const S = levelSettings(modeDefaults('daily'), {}, rand);
  while (S.w * S.h > 36) { if (S.w >= S.h) S.w--; else S.h--; }
  if (S.fullRow) {
    // A full row each (2026-10-10). Measured: with any rules at all, almost
    // no roll passed (twelve random pieces, fairy pieces without a job, odd
    // shapes with no clean first row). Held closer to chess, about one in
    // four does: a rectangle five or six wide and six tall, take their
    // King and keep yours, and hands mostly classic, with up to two kinds
    // of fairy piece on your side and one on theirs. Everything else is
    // still rolled.
    const classic = ['knight', 'bishop', 'rook', 'queen'];
    const fairy = S.minePool.filter((k) => !classic.includes(k) && !['king', 'pawn', 'rabbit'].includes(k)).slice(0, 2);
    Object.assign(S, { shape: 'rect', holes: 0, w: 5 + Math.floor(rand() * 2), h: 6, goal: 'king', royal: true, dealKing: true, mirror: false, rabbits: 0,
      minePool: [...classic, ...fairy], foePool: ['king', 'pawn', 'knight', 'bishop', 'rook', ...fairy.slice(0, 1)], mineDupes: true, foeDupes: true });
    if (S.magic === 'all') S.magic = 'sides';
    if (S.geared) S.geared = false;
  }
  S.maxMoves = Math.max(18, Math.min(30, S.maxMoves || 25));
  S.mode = 'hand';
  S.foesCapture = true; // pieces can always take pieces (Timothy, 2026-10-09)
  S.difficulty = 'any'; // checked here instead, with the daily's own band
  return clean(S);
}

function good(m, par, S) {
  return m.difficulty >= 3 && m.difficulty <= 6 && m.novice.winRate >= 0.5 && (m.ceiling ?? 0) >= 0.6 &&
    m.engagement >= 50 && S.maxMoves >= par * 2;
}

/** One day's board, or null if nothing passed. */
function deal(date) {
  // Rolls come in streams of 80; a rare day where none passes goes on to a
  // second stream, and so on.
  for (let stream = 1; stream <= 4; stream++) {
    const b = dealStream(date, stream);
    if (b) return b;
  }
  return null;
}

function dealStream(date, stream) {
  const rand = rng(stream === 1 ? `daily4:${date}` : `daily4:${date}:${stream}`);
  for (let k = 0; k < MAX_ROLLS; k++) {
    const S = dailyRoll(rand), seed = 1 + Math.floor(rand() * 1e6);
    let out = null;
    // Par from 4 (from 3 with a full row each: taking a King with six
    // pieces a side is quick once the cloud lifts).
    searchLayouts({ settings: S, seed, parMin: S.fullRow ? 3 : 4, parMax: 10, maxTries: 60, maxMs: 6000 }, (d) => { if (d.type !== 'progress') out = d; });
    if (out?.type !== 'done' || !out.measure || !good(out.measure, out.par, S)) continue;
    const level = new URLSearchParams(encodeLevel(S, out.seed));
    const m = out.measure;
    return {
      name: dailyName(rand), theme: THEMES[Math.floor(rand() * THEMES.length)].id,
      lab: level.get('lab'), v: SETTINGS_VERSION, seed: out.seed, par: out.par,
      measure: { difficulty: m.difficulty, ceiling: +m.ceiling.toFixed(2), engagement: m.engagement, winRate: +m.novice.winRate.toFixed(2), winLen: +m.novice.winLen.toFixed(1) },
      rolls: (stream - 1) * MAX_ROLLS + k + 1
    };
  }
  return null;
}

const fileOf = (date) => join(here, 'dailies', `${date.slice(0, 7)}.js`);
function readMonth(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
function writeMonth(path, boards) {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(boards).sort().map((k) => [k, boards[k]]));
  writeFileSync(path, `// Daily boards for ${path.slice(-10, -3)}, made by make-daily.mjs. A shipped board never changes.\nexport default ${JSON.stringify(sorted, null, 1)};\n`);
}

if (from === '--stamp') {
  for (const f of readdirSync(join(here, 'dailies')).filter((n) => /^\d{4}-\d{2}\.js$/.test(n))) {
    const path = join(here, 'dailies', f), boards = readMonth(path);
    let n = 0;
    for (const [date, b] of Object.entries(boards)) if (!b.print) { b.print = boardPrint(dayFromBoard(date, b)); n++; }
    if (n) writeMonth(path, boards);
    console.log(f, `${n} stamped`);
  }
  process.exit(0);
}

const [y, mo, d0] = from.split('-').map(Number);
for (let i = 0; i < +count; i++) {
  const date = new Date(Date.UTC(y, mo - 1, d0 + i)).toISOString().slice(0, 10);
  const path = fileOf(date);
  if (readMonth(path)[date]) { console.log(date, 'already made'); continue; }
  const t0 = Date.now(), b = deal(date);
  if (!b) { console.log(date, 'NOTHING PASSED'); continue; }
  b.print = boardPrint(dayFromBoard(date, b));
  // Read again just before writing, so runs side by side on one month
  // do not lose each other's boards.
  const boards = readMonth(path);
  if (boards[date]) continue;
  boards[date] = b;
  writeMonth(path, boards);
  console.log(date, `${((Date.now() - t0) / 1000).toFixed(0)}s`, b.rolls, 'rolls', b.name, '|', JSON.stringify(b.measure), 'par', b.par);
}

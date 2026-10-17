// Makes the daily from version 5 (2026-10-17) ahead of time: three boards
// of Adventure a day, the same for everyone (daily5.js says why stored).
//
//   node play/grove-chess/make-daily5.mjs 2026-10-17 30
//
// deals 30 days from that date into dailies5/YYYY-MM.js, one file a month.
// A date already in a file is never dealt again: a shipped day never changes
// (check-daily5.mjs guards them). Each board carries its fingerprint.
//
// A day, in Timothy's terms (2026-10-17: "a 5 minute or less version of
// adventure you can play and share"):
//   - your set: your cat, always, and three more: two of the rook, bishop
//     and knight, and most days one of the troupe (a different one each
//     day in turn, as the first daily had one fairy piece a day); one piece
//     may carry a suit and another a weapon (not the net: it adds pieces to
//     your set, and the daily's set never grows);
//   - three boards, dealt as Adventure deals them at three depths, climbing:
//     Monday and Tuesday at depths 3, 5 and 7; Wednesday and Thursday 4, 6
//     and 8; Friday and Saturday 5, 7 and 9; Sunday 6, 8 and 10. So the week
//     climbs, as a crossword's does, and Monday is a gentle one. No board's
//     best line is under three moves (a two-move board is over before it
//     is a puzzle);
//   - each board vetted by the solver, as Adventure's are, with longer to
//     look (20 seconds a deal, not 7) since nobody is waiting; par is the
//     best line it found plus two (daily5.js).
// Every board is dealt for that set: the boards do not change with
// anything you do, so everyone plays the same three.

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modeDefaults, levelSettings, EAGLE_ROOM } from './modes.js';
import { searchLayouts, encodeLevel, makeLevel, SETTINGS_VERSION } from './lab.js';
import { newRun, handSettings, canTakeWeapon, armHand } from './run.js';
import { rng, shuffled } from '../../engine/seed.js';
import { dailyName } from './daily-names.js';
import { dailyNumber, boardLevel, DAILY5_FROM } from './daily5.js';
import { boardPrint } from './daily-print.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [from = DAILY5_FROM, count = '30'] = process.argv.slice(2);

const CLASSIC = ['rook', 'bishop', 'knight'];
const TROUPE = ['thespian', 'scribe', 'painter', 'bard', 'dancer'];
const SUITS = ['hearts', 'vines', 'stars', 'spirals', 'gears'];
const WEAPONS = ['sword', 'mace', 'shield', 'lance'];
/** Depths by weekday, Sunday first (getUTCDay). */
const DEPTHS = [[6, 8, 10], [3, 5, 7], [3, 5, 7], [4, 6, 8], [4, 6, 8], [5, 7, 9], [5, 7, 9]];
/** No board's best line shorter than this. */
const MIN_BEST = 3;

const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** The day's set, as a hand (run.js): [{ base, suit?, lives?, weapon?, wl? }]. */
function daySet(date, rand) {
  const n = dailyNumber(date);
  const two = shuffled(CLASSIC, rand).slice(0, 2);
  const rest = CLASSIC.find((k) => !two.includes(k));
  const fourth = rand() < 0.75 ? TROUPE[(n - 1) % TROUPE.length] : rest;
  const run = newRun(['cat', ...two, fourth], 4);
  if (rand() < 0.85) {
    const h = run.hand[Math.floor(rand() * 4)], suit = SUITS[Math.floor(rand() * SUITS.length)];
    h.suit = suit;
    if (suit === 'hearts') h.lives = 2;
  }
  if (rand() < 0.6) {
    const w = WEAPONS[Math.floor(rand() * WEAPONS.length)], can = run.hand.map((h, i) => i).filter((i) => !run.hand[i].suit && canTakeWeapon(run.hand[i], w));
    if (can.length) armHand(run.hand[can[Math.floor(rand() * can.length)]], w);
  }
  return run;
}

/** One board at a depth, as the runner deals Adventure (play/main.js
    find): dealt again with fewer of theirs when nothing is won (relax), or
    with more when it comes in short (press, once). Null if nothing won. */
function dealBoard(date, k, depth, run) {
  const M = modeDefaults('adventure');
  let short = null, relax = 0, press = 0;
  for (let a = 0; a < 12; a++) {
    const S = levelSettings(M, { depth, hand: handSettings(run), relax, press }, rng(`daily5:${date}:${k}${a ? ':' + a : ''}`));
    S.parMin = Math.max(S.parMin, MIN_BEST); S.parMax = Math.max(S.parMax, S.parMin);
    const seed = 1 + Math.floor(rng(`daily5:${date}:${k}:seed:${a}`)() * 1e6);
    let out = null;
    searchLayouts({ settings: S, seed, parMin: S.parMin, parMax: S.parMax, quick: true, maxMs: 20000 }, (d) => { if (d.type !== 'progress') out = d; });
    const pick = out?.type === 'done' ? out : out?.best;
    const got = pick?.par != null ? { S, seed: pick.seed, best: pick.par, short: pick.par < S.parMin, tries: a + 1 } : null;
    if (got && !got.short) return got;
    if (got) { if (!short || got.best > short.best) short = got; if (press >= 1) break; press++; }
    else if (short) break;
    else relax++;
  }
  return short;
}

function deal(date) {
  const rand = rng(`daily5:${date}`);
  const run = daySet(date, rand);
  const boards = [];
  for (const [k, depth] of DEPTHS[weekday(date)].entries()) {
    const b = dealBoard(date, k, depth, run);
    if (!b) return null;
    const lab = new URLSearchParams(encodeLevel(b.S, b.seed)).get('lab');
    const board = { depth, lab, v: SETTINGS_VERSION, seed: b.seed, par: b.best + EAGLE_ROOM, best: b.best };
    board.print = printOf(date, k, board);
    boards.push(board);
  }
  // A name no other stored day has (the word lists repeat now and then).
  let name = dailyName(rand);
  for (let k = 0; k < 40 && namesUsed().has(name); k++) name = dailyName(rand);
  return { name, set: run.hand, boards };
}

/** Every stored day's name. */
function namesUsed() {
  const dir = join(here, 'dailies5'), out = new Set();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => /^\d{4}-\d{2}\.js$/.test(n))) for (const d of Object.values(readMonth(join(dir, f)))) out.add(d.name);
  return out;
}

/** A stored board's fingerprint (daily-print.mjs), from what was stored. */
export function printOf(date, k, b) {
  const lv = boardLevel(b), day = makeLevel(lv.settings, lv.seed);
  return boardPrint(Object.assign(day, { date: `${date}:${k}`, par: b.par }));
}

const fileOf = (date) => join(here, 'dailies5', `${date.slice(0, 7)}.js`);
export function readMonth(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
function writeMonth(path, days) {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(days).sort().map((k) => [k, days[k]]));
  writeFileSync(path, `// The daily for ${path.slice(-10, -3)}, three boards a day, made by make-daily5.mjs. A shipped day never changes.\nexport default ${JSON.stringify(sorted, null, 1)};\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [y, mo, d0] = from.split('-').map(Number);
  for (let i = 0; i < +count; i++) {
    const date = new Date(Date.UTC(y, mo - 1, d0 + i)).toISOString().slice(0, 10);
    const path = fileOf(date);
    if (readMonth(path)[date]) { console.log(date, 'already made'); continue; }
    const t0 = Date.now(), day = deal(date);
    if (!day) { console.log(date, 'NOTHING WON'); continue; }
    // Read again just before writing, so runs side by side on one month
    // do not lose each other's days.
    const days = readMonth(path);
    if (days[date]) continue;
    days[date] = day;
    writeMonth(path, days);
    console.log(date, `${((Date.now() - t0) / 1000).toFixed(0)}s`, day.name, '|', day.set.map((h) => [h.base, h.suit, h.weapon].filter(Boolean).join('+')).join(' '), '|',
      day.boards.map((b) => `d${b.depth} best ${b.best} par ${b.par}`).join(', '));
  }
}

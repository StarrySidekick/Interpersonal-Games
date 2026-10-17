// The runner: any mode (modes.js), from its settings. One page plays them
// all: one level at a time, a descent, a golf course, or autochess rounds.
// `?mode=` says which; `#lab=...` (Chaos's "Play as a descent") puts a
// level's settings under the mode for a test run, which keeps nothing.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { makeTarget, render, snapshot } from '../../../engine/lowpoly.js';
import { rng } from '../../../engine/seed.js';
import * as sfx from '../sounds.js';
import {
  PIECES, descOf, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, STATUE_ROW_DESC, statueAt, statueDesc, GHOST_DESC, GATE_DESC, WANDER_DESC, ghostAt, gateUp, cloudOver, hiddenFrom, HOLE_DESC, cloudDesc, sandAt, waterAt, SAND_DESC, WATER_DESC, movesFor, playerMove, respond, isOver, outcome, initialState,
  allMoves, holeOpen, crumbled, shrunk, apply, showdown, firstCaptures, onBoard, leaderDesc, placeRevived, hopIn, flagAt, carrierOf, rabbitChosen, EXIT_DESC, setView, setLeft, setReady, chooseInSet, firstReady,
  rabbitIn, formOf, tacticalPins
} from '../rules.js';
import { suitIcon, rabbitIcon, weaponIcon, WEAPON_INK } from '../icons.js';
import { pickMove } from '../choose.js';
import { bestMove } from '../best.js';
import { newTiles, fillOffers, flip, frontier, tier, bounds, layout, foePick, tileKey, tileXY, SIZES } from '../tiles.js';
import { solveLevel } from '../solve.js';
import { scene, sceneFrame, sprite, crispWidth } from '../board.js';
import { suitLook, model, CAT_OPTIONS, catLook, setCatLook } from '../models.js';
import { piecesSheet } from '../sheet.js';
import { playIntro } from '../intro.js';
import { makeLevel, searchLayouts, decodeLevel, rabbitPool, GOAL_PILL, summary } from '../lab.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch, routeText } from '../rabbits.js';
import { makeBoard } from '../board3d.js';
import { startFall } from '../fall.js';
import { fillMenu } from '../menu.js';
import { buildForm, FORM_CSS, partsList } from '../form.js';
import { loadCatalog, registerInvented } from '../invented.js';
import { MODES, modeSettings, saveModeSettings, resetModeSettings, cleanMode, PANEL, levelSettings, COURSES, COURSE_ORDER, holesOf, settingShown, settingNote, describe, partLine, adventurePar } from '../modes.js';
import {
  newRun, rewardsFor, applyReward, cardText, handSettings, afterLevel, pieceOf, SUITS, JOKERS,
  WAYSTONES, litWaystones, newlyLit, startChoices, keepsakeCards, acornsFor, priceOf, shopStock,
  canCombine, applyCombine, combineText, boardCards, boardCardText, applyMerge, mergeTargets, foeUpgrade, WEAPONS, canTakeWeapon, carriesText, foeCanUse, foeTake,
  adventureCards, parVerdict, PAR_CARDS, PAR_AUTO, scoreName, ADVENTURE_GIFTS, adventureSet, afterAdventure, takeTally, netCatches, TAKE_FOR_PIECE,
  RABBITS, rabbitName, rabbitsTaken, roomFor, ADVENTURE_MAX, suitDesc, weaponDesc, weaponName
} from '../run.js';
import { setupPanel, setupState, playOut } from '../autosetup.js';
import { VARIANTS, VARIANT_ORDER, differs } from '../variants.js';
import { startKungFu } from '../kungfu.js';
import { describeMeasure } from '../metrics.js';
import { todayStr } from '../day.js';
import { logSitting } from '../../../engine/record.js';
import {
  loadToday, boardLevel, card, strokesOf, scoreWord, markOf, vsText, loadStore, saveStore, dayEntry, myName, setMyName,
  chunkOf, readChunk, readLink as readDailyLink, makeLink as makeDailyLink, dailyNumber, shiftDate, PICK_UP
} from '../daily5.js';
import { cleanName } from '../vine.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };
document.head.append(el('style', {}, FORM_CSS));

// --- The mode. ---------------------------------------------------------------

const asked = new URLSearchParams(location.search).get('mode');
const modeId = MODES[asked] ? asked : 'chaos';
const MODE = MODES[modeId];
const test = decodeLevel(location.hash)?.settings || null;
let M = test ? cleanMode({ ...modeSettings(modeId), ...test, run: modeSettings(modeId).run, roll: 'fixed' }) : modeSettings(modeId);
const catalog = loadCatalog();
registerInvented(catalog.invented);

// The daily (2026-10-17, Timothy: "adapt daily mode to be a 5 minute or
// less version of adventure you can play and share"): Adventure's runner
// with three stored boards a day (daily5.js). `today` is the day, `entry`
// what this browser has of it. `?test` adds a way between days and the
// best-move button, which the daily otherwise hides: a shared score means
// nothing if a button can play it.
const daily = modeId === 'today';
const dailyTest = daily && new URLSearchParams(location.search).has('test');
let today = null, dstore = null, entry = null, ddate = null;
async function initDaily() {
  const link = readDailyLink();
  ddate = link.date || todayStr();
  today = await loadToday(ddate);
  dstore = loadStore();
  entry = dayEntry(dstore, ddate);
  // Friends on the link: kept for good; and the branch you came in on, until
  // you finish (your share goes on the end of it).
  if (link.players.length && link.date) {
    for (const p of link.players) if (!entry.seen.includes(p.chunk)) entry.seen.push(p.chunk);
    if (!entry.done) entry.branch = link.players.map((p) => p.chunk).join('~');
    saveStore(dstore);
  }
}

// --- Records: only ever go up (nothing decays, no streaks). -----------------

const REC = 'ig.grove.records.v1';
const CATLOOK = 'ig.grove.cat.v1';
try { setCatLook(JSON.parse(localStorage.getItem(CATLOOK)) || {}); } catch { /* blocked */ }

function loadRecords() { try { const r = JSON.parse(localStorage.getItem(REC)); if (r && r.version === 1) return r; } catch { /* blocked */ } return { version: 1 }; }
const records = loadRecords();
const mine = () => (records[modeId] = records[modeId] || { played: 0, best: null });
function saveRecords() { if (test) return; try { localStorage.setItem(REC, JSON.stringify(records)); } catch { /* blocked */ } }

// --- What carries between descents: the roster of pieces found. ------------

const ROSTER = 'ig.grove.roster.v1';
function loadRoster() { try { const r = JSON.parse(localStorage.getItem(ROSTER)); if (r && r.version === 1 && Array.isArray(r.found)) return r; } catch { /* blocked */ } return { version: 1, found: [] }; }
const roster = loadRoster();
const carries = () => M.run === 'descent' && M.carry && !test;
function addToRoster(type) {
  if (!carries() || roster.found.includes(type) || !PIECES[type]) return;
  roster.found.push(type);
  try { localStorage.setItem(ROSTER, JSON.stringify(roster)); } catch { /* blocked */ }
}
const deepest = () => records.descent?.best || 0;

// --- Golf: which courses are open. ------------------------------------------

const courseRec = (id) => ((mine().courses = mine().courses || {})[id] = mine().courses[id] || { played: 0, best: null });
const courseOpen = (id) => { const k = COURSE_ORDER.indexOf(id); return k <= 0 || !!records.golf?.courses?.[COURSE_ORDER[k - 1]]?.played; };

function recordsLine() {
  const r = records[modeId];
  // The daily: days played, never days in a row.
  if (daily) return r?.played ? `Days played: ${r.played}. Best card: ${vsText(r.best)}.` : '';
  if (M.run === 'course' && COURSES[M.courseName]) {
    const c = r?.courses?.[M.courseName];
    return c?.played ? `${COURSES[M.courseName].name}: best ${c.best > 0 ? '+' : ''}${c.best} against par. Played ${c.played}.` : `${COURSES[M.courseName].name}: not played yet.`;
  }
  if (!r?.played) return test ? 'A test run: nothing is kept.' : '';
  if (M.run === 'descent') return `Deepest: depth ${r.best}. Descents: ${r.played}.`;
  if (M.run === 'course') return r.best != null ? `Best course: ${r.best > 0 ? '+' : ''}${r.best} against par. Courses played: ${r.played}.` : `Courses played: ${r.played}.`;
  if (M.run === 'rounds') return `Most rounds won: ${r.best}. Runs: ${r.played}.`;
  return `Levels played: ${r.played}${r.won ? `, won ${r.won}` : ''}.`;
}

// --- A session. ------------------------------------------------------------
// n: which level (depth, hole or round). run: the hand and what has
// happened to it (run.js), for a descent and autochess rounds.

let session = null;

function newSession() {
  const seed = 1 + Math.floor(Math.random() * 1e9), rand = rng(`start:${seed}`);
  const pool = M.startPool.filter((k) => !catalog.vetoed.includes(k));
  // The "another piece" waystone deals one more, as far as the hand holds.
  const extra = carries() && litWaystones(deepest()).some((w) => w.id === 'extra') ? 1 : 0;
  const count = Math.min(M.maxPieces, M.startPieces + extra);
  // A royal King is dealt first, and kept (kingLocked, below); only one, since
  // with a royal King any King of yours taken would end the descent.
  const royalKing = M.royal && M.run === 'descent';
  const from = royalKing && pool.some((k) => k !== 'king') ? pool.filter((k) => k !== 'king') : pool.length ? pool : M.startPool;
  const start = Array.from({ length: count }, () => from[Math.floor(rand() * from.length)]);
  if (royalKing) start[0] = 'king';
  // Adventure starts with your cat (Timothy, 2026-10-16: "it is your
  // starting piece"; a rook before that).
  if (M.upgrades === 'par') start.splice(0, start.length, 'cat');
  session = { seed, n: 1, found: new Map(), seen: new Set(), strokes: [], lives: M.lives, wins: 0, caught: [], claimed: [], acorns: 0, deepestBefore: deepest() };
  // One upgrade a board (2026-10-12): they carry a lineup too, their King
  // and the rest dealt from their pool, as wide as the board.
  // From 2026-10-13 the lineup is not dealt: it is "You start with", in its
  // order (like Microchess: rook, bishop, knight, King), and theirs is the
  // same, facing it.
  let foes = null;
  if (M.run === 'descent' && oneBoard()) {
    const given = M.startPool.filter((k) => !catalog.vetoed.includes(k) || k === 'king');
    start.splice(0, start.length, ...(given.includes('king') ? given : [...given, 'king']));
    // Theirs facing yours on the same files (Microchess), or yours reversed
    // (Timothy, 2026-10-13: "the enemy side is the same but reversed").
    foes = M.foeLine === 'turned' ? start.slice().reverse() : start.slice();
  }
  if (M.run === 'descent' || M.run === 'rounds') session.run = newRun(start, M.maxPieces, foes);
  // A row of pawns in front of each line (2026-10-14), as wide as the board.
  if (M.pawnRow && oneBoard() && session.run) for (const list of [session.run.hand, session.run.foes]) for (let i = 0; i < M.w; i++) list.push({ base: 'pawn', row: 1 });
  // Tile Chess (2026-10-14): the board is carried too, and no rabbit.
  if (M.upgrades === 'tiles' && session.run) { session.run.tiles = newTiles(M.w, M.h); session.run.foeRabbit = false; }
  // The daily: the day's set, the same for everyone, and the board you are on.
  if (daily && today) {
    session.seed = dailyNumber(ddate);
    session.run.hand = today.set.map((h) => ({ ...h }));
    session.n = Math.min(today.boards.length, entry.results.length + 1);
    // A piece's card in the intro plays the first day it turns up, not every day.
    session.seen = new Set(dstore.seen || []);
  }
  // The set you were dealt: laying out your pieces opens once it changes.
  session.dealt = session.run ? JSON.stringify(session.run.hand) : null;
}

/** Adventure's set for board n: which of your pieces take turns on it
    (all of them, up to five; past that, five drawn at random). The same
    for the same pieces, so finding the board and playing it agree. Null
    outside Adventure: the whole hand plays. */
const setFor = (n) => (M.upgrades === 'par' && session.run ? adventureSet(session.run, rng(`set:${session.seed}:${n}:${session.run.hand.length}`)) : null);

/** Has your set changed from the one you were dealt (a piece found, lost,
    swapped on the title, suited or fused)? Timothy, 2026-10-10: "you should
    be allowed to organize pieces only after your default set you start
    with changes." */
const setChanged = () => !!session.run && JSON.stringify(session.run.hand) !== session.dealt;

/** The level for level number n of this session, found on a background
    thread (and kept, so asking again is free). */
function find(n = session.n) {
  // The daily: its stored board, no dealing.
  if (daily) {
    const b = today.boards[n - 1], lv = boardLevel(b);
    return Promise.resolve({ settings: lv.settings, seed: lv.seed, par: b.par, line: null, measure: null, autoBest: null, setups: null, passed: true });
  }
  const hand = session.run ? handSettings(session.run, setFor(n)) : null;
  if (hand && session.run.tiles) hand.tiles = layout(session.run.tiles);
  const key = `${n}|${JSON.stringify(hand?.hand || null)}|${JSON.stringify(hand?.handMods || null)}|${JSON.stringify(hand?.foeHand || null)}|${JSON.stringify(hand?.foeMods || null)}|${(session.run?.jokers || []).join(',')}|${hand?.tiles ? hand.tiles.open.join('.') : ''}`;
  if (session.found.has(key)) return session.found.get(key);
  // A rolled level (Chaos, the daily's way) that finds nothing passing gets
  // fresh rolls, up to six, before settling for the best it saw: the daily's
  // bar in particular passes about one roll in twenty.
  const rolled = M.roll !== 'fixed';
  // Adventure (Timothy, 2026-10-15: "levels should be vetted before
  // generating each time, should be verified that they can be completed"):
  // only a board the solver has won is ever played. A deal that finds none
  // in its time is dealt again with fewer of theirs (relax), and again, as
  // many times as it takes.
  const vetted = M.upgrades === 'par';
  // And tuned to par (2026-10-16, Timothy: "make sure levels are tuned
  // properly with par rules that i set out"): a board whose best line came
  // out shorter than par asks (a strong set clears more than one a move) is
  // dealt again with more to do (`press`: more of theirs, more of Hearts),
  // once, and the longer kept. (Up to three times until every piece stayed
  // where it moved, 2026-10-16: since then a second or third time has not
  // once landed on par, and each cost five seconds.)
  const p = (async () => {
    let last = null, short = null, relax = 0, press = 0;
    for (let k = 0; k < (rolled ? 6 : vetted ? 12 : 1); k++) {
      last = await findOnce(n, hand, k, relax, press);
      if (!vetted) { if (last.passed) break; continue; }
      if (last.line && !last.short) break;
      if (last.line) {
        if (!short || last.par > short.par) short = last;
        if (press >= 1) break;
        press++;
      } else if (short) break; // more to do found nothing: the longest short one
      else relax++;
    }
    return vetted && short && (!last.line || last.short) ? short : last;
  })();
  session.found.set(key, p);
  return p;
}

function findOnce(n, hand, attempt, relax = 0, press = 0) {
  const settings = levelSettings(M, { depth: n, hole: n, round: n, hand, veto: catalog.vetoed, invented: catalog.invented, relax: M.upgrades === 'par' ? relax : 0, press: M.upgrades === 'par' ? press : 0 },
    rng(`${modeId}:${session.seed}:${n}${attempt ? ':' + attempt : ''}`));
  if (session.run?.jokers.includes('overtime') && settings.maxMoves) settings.maxMoves += 5;
  // One upgrade a board (2026-10-13, Timothy: "the calculation for balancing
  // and stuff for the level shouldn't need to happen every level, as we will
  // just deal with the random suits upgrades"): the board is the two lineups
  // as they stand, so it is laid out straight away, with no search and no par.
  if (oneBoard()) return Promise.resolve({ settings, seed: session.seed + n * 1000, par: null, measure: null, autoBest: null, setups: null, passed: true });
  const msg = { settings, seed: session.seed + n * 1000, parMin: settings.parMin, parMax: settings.parMax, maxMs: 15000,
    pool: rabbitPool(settings, myRabbits(), Math.max(1, settings.mine)), quick: M.upgrades === 'par' };
  if (M.roll !== 'fixed') msg.maxMs = 8000;
  // Adventure: six seconds a deal again, seven the first (2026-10-16: a
  // first deal that finds no win in seven seconds rarely finds one in
  // fifteen; dealing again with fewer of theirs is quicker).
  if (M.upgrades === 'par') msg.maxMs = attempt ? 6000 : 7000;
  return new Promise((resolve) => {
    const done = (data) => {
      if (data.type === 'progress') return;
      const pick = data.type === 'done' ? data : data.best;
      resolve({ settings, seed: pick ? pick.seed : msg.seed, par: pick?.par ?? null, line: pick?.line || null, measure: pick?.measure || null, autoBest: pick?.setup || null,
        setups: pick?.setups ? { wins: pick.wins, tried: pick.setups } : null, passed: data.type === 'done', short: pick?.par != null && pick.par < settings.parMin });
    };
    try {
      const w = new Worker(new URL('../lab-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => { if (data.type !== 'progress') { w.terminate(); done(data); } };
      w.onerror = () => { w.terminate(); searchLayouts({ ...msg, maxMs: 4000 }, done); };
      w.postMessage(msg);
    } catch { setTimeout(() => searchLayouts({ ...msg, maxMs: 4000 }, done), 30); }
  });
}

/** Rabbits for autochess: your collection, and the ones caught this run. */
function myRabbits() {
  const out = { ...caughtRabbits() };
  for (const n of session?.caught || []) out[n] = (out[n] || 0) + 1;
  return out;
}

/** Your royal King cannot be fused, promoted or swapped away: it is the
    thing you protect. */
const kingLocked = (h) => M.royal && M.run === 'descent' && h.base === 'king' && !h.fused;

// A rabbit's colour: in Adventure (2026-10-16, rabbits have a kind and a
// suit) its kind's, for theirs and for yours with one; elsewhere its
// pattern's.
const furOf = (f) => (M.upgrades === 'par' ? RABBITS[rabbitIn(f)]?.colour || null
  : ((f.brain === 'pattern' || f.brain === 'possessed' || f.brain === 'sentry' || f.brain === 'scared' || f.mind) && FUR[f.patternName]) || null);
/** "a robot rabbit of Spirals" and so on, for a piece f (Adventure). */
const rabbitOf = (f) => (rabbitIn(f) ? `a ${rabbitName(rabbitIn(f), f.suit).toLowerCase()}` : 'a rabbit');
/** How a piece of yours looks: in Adventure, its suit's look (Timothy,
    2026-10-15: "the vine look should be for the vine suit, we should have
    custom looks for the others that are colored like the suit"), or green
    with no suit; elsewhere, green. */
const lookOf = (p) => (M.upgrades === 'par' ? suitLook(p?.suit) : 'you');
const levelWord = () => ({ descent: M.upgrades === 'tiles' ? 'Round' : 'Depth', course: 'Hole', rounds: 'Round', single: 'Level' })[M.run];
/** A descent whose sides are given and upgraded a board at a time: one
    upgrade each (the descent), or tiles turned over (Tile Chess). */
const oneBoard = () => M.upgrades === 'each' || M.upgrades === 'tiles';

// --- Playing a level. --------------------------------------------------------

let setups = null;
let level = null, par = null, measured = null, board = null, game = null, sel = null, legal = [], busy = false, shown = null, openSheet = null, panel = null, autoBest = null;
const now = () => game.states[game.states.length - 1];
const thinks = (s) => s.foes.some((f) => !f.taken && f.brain === 'ai');
const nameOf = (x) => PIECES[x.type]?.name || x.type;
const isAuto = () => level?.settings.mode === 'auto';

/** Foresight (a joker): where each of theirs would go if you waited. */
function foresight() {
  if (!session.run?.jokers.includes('foresight') || isOver(now())) return null;
  return respond(playerMove(now(), { p: -1, x: 0, y: 0 }));
}

function draw() {
  const f = !busy && !isAuto() ? foresight() : null;
  board.draw({ state: shown || now(), track: f ? [...game.states, f] : game.states, sel, legal });
}

function hud() {
  if (M.upgrades === 'par' && session?.run) { setRow(); nextUp(); }
  $('#movecount').textContent = now().t;
  const hop = hopIn(now());
  if (daily) { $('#movemax').textContent = `· par ${par}`; $('#goalpill').textContent = `${par + PICK_UP} moves at most`; return; }
  $('#movemax').textContent = [level.rules.maxMoves && !(M.run === 'course' && par) ? `of ${level.rules.maxMoves}` : '', par ? `${M.run === 'course' ? 'of ' : '· '}par ${par}` : '', hop ? `· the rabbit hops ${hop === 1 ? 'next turn' : `in ${hop}`}` : ''].filter(Boolean).join(' ');
}

/** Adventure's three of a kind, as they stand now: what the run has kept,
    and what this board has taken so far. [{ type, have, made }]: `have` of
    the next three of that kind, and how many pieces this board has made. */
function tallyCounts(s = now()) {
  const kept = session.run.tally || {}, out = new Map();
  for (const [type, n] of Object.entries(kept)) out.set(type, { type, base: n, now: 0 });
  for (const f of s.foes) if (f.taken && !f.netted && PIECES[f.type] && !['rabbit', 'bunny', 'ball'].includes(f.type)) {
    if (!out.has(f.type)) out.set(f.type, { type: f.type, base: 0, now: 0 });
    out.get(f.type).now++;
  }
  return [...out.values()].map(({ type, base, now: n }) => ({ type, have: (base + n) % TAKE_FOR_PIECE, made: Math.floor((base + n) / TAKE_FOR_PIECE) })).filter((r) => r.have || r.made);
}

/** What a piece carries, as small drawn marks (Adventure, 2026-10-16): its
    suit's icon, its weapon's mark and level, its rabbit's head. */
function marks(p) {
  const out = [];
  if (SUITS[p.suit]) out.push(suitIcon(p.suit, SUITS[p.suit].colour, 15));
  if (WEAPONS[p.weapon]) out.push(weaponIcon(p.weapon, 15), ...((p.wl || 1) > 1 ? [el('span', { class: 'suit' }, String(p.wl))] : []));
  if (RABBITS[p.rabbit]) out.push(rabbitIcon(RABBITS[p.rabbit].colour, 15));
  return out;
}

/** Adventure (2026-10-15): right under the board, your set, icons only,
    each in its suit's look (Timothy: "show all pieces in your cycle, and
    don't show text, just the piece icons"). Since you choose from your set
    ("you choose between your set ... you have to use all three before you
    can use them again") it is also where you choose: the one on the board
    is outlined, the ones still ready this round can be tapped to bring
    them on instead, and the ones used this round are faded. Lost ones are
    gone from it. It pops when the piece on the board changes. Names are
    there for screen readers. */
let lastNext = null;
const WEAPON_MODEL = { sword: 'wSword', lance: 'wLance', mace: 'wMace', net: 'wNet', shield: 'wShield' };
function nextUp() {
  const s = now(), box = $('#nextup'), view = s.set ? setView(s).filter((v) => !v.lost) : [];
  if (view.length < 2 || s.pieces[0]?.taken || s.won) { box.hidden = true; lastNext = null; return; }
  // Each piece as it stands, with its weapon beside it, and a rabbit's head
  // on one with a rabbit inside.
  const icon = (p) => {
    const cv = el('canvas', { class: 'pix', width: 38, height: 36 }), g = cv.getContext('2d');
    g.drawImage(sprite(p.shape || p.type, lookOf(p)), 0, 0);
    if (p.weapon && WEAPON_MODEL[p.weapon]) g.drawImage(sprite(WEAPON_MODEL[p.weapon], 'you'), 9, -3);
    const wrap = el('span', { class: 'slotart' }, cv);
    if (RABBITS[p.rabbit]) wrap.append(rabbitIcon(RABBITS[p.rabbit].colour, 20, 'sicon badge'));
    return wrap;
  };
  const open = !s.bonus && !busy && !isOver(s), key = `${s.ci}`;
  box.replaceChildren(...view.map((v) => {
    // A piece standing by itself with its rabbit (2026-10-16): out of your
    // choosing, marked so.
    const how = v.on ? 'on' : v.out ? 'out' : v.ready ? 'ready' : 'used', name = nameOf(v.p);
    const b = el('button', { class: `slot ${how}`, title: name, 'aria-label': `${name}${v.on ? ', your move' : v.out ? ', standing where it moved' : v.ready ? ', ready' : ', used this round'}`, 'aria-pressed': String(v.on), disabled: !open || !v.ready || v.on ? '' : null }, icon(v.p));
    if (open && v.ready && !v.on) b.addEventListener('click', () => { if (!tipHeld()) choose(v.j); });
    inspectable(b, () => v.p, () => (v.on ? 'on' : v.out ? 'out' : v.ready ? 'ready' : 'used'));
    return b;
  }));
  box.hidden = false;
  if (lastNext !== null && lastNext !== key) { box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn'); }
  lastNext = key;
}

/** Bring piece j of your set onto the board (Adventure): the piece there
    spins down into its plinth and this one spins up; then its moves light. */
// Quick (2026-10-16, Timothy: "switching pieces is kind of slow"): the
// swap no longer holds the board. Its moves light at once and can be
// played while the old piece is still spinning down; the spin is 170 ms.
function choose(j) {
  const s = now();
  if (busy || !s.set || s.bonus || isOver(s) || j === s.ci || !setReady(s, j)) return;
  const c = chooseInSet(s, j);
  game.states[game.states.length - 1] = c;
  haptic(8);
  sel = null; legal = []; placing = null;
  hideTip();
  select(null);
  board.animate(s, c, { p: -1 });
}

/** At the start of your turn (Adventure): if the piece on the board has had
    its turn this round, the first of your set that is ready comes on, as a
    start; tap another under the board to choose it instead. */
async function readyUp(prev = null) {
  const s = now();
  if (!s.set || s.bonus || isOver(s)) return;
  // A new round starts again from the first of the set (Timothy,
  // 2026-10-16: "when you complete the set of pieces you have it should just
  // start again from number 1 -> 2 -> 3 again for that level").
  const fresh = prev && (s.round || 0) !== (prev.round || 0);
  const j = fresh ? s.set.findIndex((_, i) => setReady(s, i)) : setReady(s, s.ci) ? -1 : firstReady(s);
  if (j < 0 || j === s.ci) return;
  const c = chooseInSet(s, j);
  game.states[game.states.length - 1] = c;
  // Not waited for: its moves light as it spins up (2026-10-16).
  board.animate(s, c, { p: -1 });
}

/** Adventure (2026-10-15): your set, each with its suit and weapon and
    whether it is on the board, ready or used this round; and your rabbits,
    three of a kind to a piece. */
function setRow() {
  const s = now(), box = $('#playhand');
  const view = s.set ? setView(s).filter((v) => !v.lost) : s.pieces.slice(0, 1).map((p) => ({ p, on: true }));
  box.replaceChildren(...view.map((v) => {
    const p = v.p, cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(p.shape || p.type, lookOf(p)), 0, 0);
    const cell = el('div', { class: `handcell${v.on ? ' picked' : ''}` },
      el('span', { class: 'dim' }, v.on ? (p.taken ? 'Taken' : 'Now') : v.out ? 'Standing' : v.ready ? 'Ready' : 'Used'), cv, el('span', { class: 'marks' }, ...marks(p), ' ', nameOf(p)));
    inspectable(cell, () => p, () => (v.on ? 'on' : v.out ? 'out' : v.ready ? 'ready' : 'used'));
    return cell;
  }));
  // Taken from your set on this board, and caught in your net.
  const fell = (s.set || []).filter((e) => e.lost);
  if (fell.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Lost'), ...fell.map((e) => el('span', { class: 'small dim' }, el('s', {}, nameOf(e))))));
  const netted = s.foes.filter((f) => f.taken && f.netted);
  if (netted.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, `${WEAPONS.net.mark} Netted`), ...netted.map((f) => el('span', { class: 'small' }, nameOf(f)))));
  // The daily's set is the day's, all of it, and never grows.
  if (daily) return;
  const bench = session.run.hand.length - (session.pick?.length || session.run.hand.length);
  if (bench > 0) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Resting'), el('span', {}, `${bench} more`), el('span', { class: 'small dim' }, 'next board, maybe')));
  const r = tallyCounts(s);
  if (r.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Three of a kind'),
    ...r.map((c) => el('span', { class: 'small' }, `${PIECES[c.type].name}: ${c.made ? `a new one${c.have ? ` + ${c.have}/${TAKE_FOR_PIECE}` : ''}` : `${c.have}/${TAKE_FOR_PIECE}`}`))));
  box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Your pieces'), el('span', {}, `${session.run.hand.length} of ${ADVENTURE_MAX}`)));
}

/** Your hand, as a row of little pieces with their suits. */
function handRow(box, { pick = null, picked = [] } = {}) {
  box.replaceChildren();
  if (!session?.run) return;
  session.run.hand.forEach((h, i) => {
    const { type, name } = pieceOf(h, session.run.made);
    registerInvented(session.run.made);
    const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(type, lookOf(h)), 0, 0);
    const lives = h.lives > 1 ? ` (${h.lives} lives)` : '';
    const cell = el('div', { class: `handcell${picked.includes(i) ? ' picked' : ''}` }, cv, el('span', { class: 'marks' }, ...(M.upgrades === 'par' ? marks(h) : [h.suit && SUITS[h.suit] ? el('span', { class: 'suit', style: `color:${SUITS[h.suit].colour}` }, SUITS[h.suit].mark + ' ') : null,
      h.weapon && WEAPONS[h.weapon] ? el('span', { class: 'suit' }, WEAPONS[h.weapon].mark + (h.wl > 1 ? h.wl : '') + ' ') : null]), ' ', name + lives));
    if (pick) { cell.style.cursor = 'pointer'; cell.addEventListener('click', () => pick(i)); }
    box.append(cell);
  });
  if (session.run.jokers.length) box.append(el('div', { class: 'handcell' }, el('span', {}, 'Jokers'), el('span', { class: 'small' }, session.run.jokers.map((j) => JOKERS[j].name).join(', '))));
}

function goalCard() {
  if (session.seen.has('goal')) return null;
  session.seen.add('goal');
  let text = {
    // A sentence or two each (Timothy, 2026-10-17: "the super long
    // descriptions for the modes need to go"); holding a piece says the rest.
    descent: M.upgrades === 'par' ? 'Take every piece of theirs, then jump into the hole. Each turn, choose which of your set moves; each has its turn before any goes again, and stays standing where it moved. Pieces on a coloured plinth move by themselves. Hold any piece to see what it does.'
      : M.upgrades === 'tiles' ? 'Take their King to win the round, then turn over a tile at the edge: the board grows, and its upgrade is yours. Keep your King.'
      : M.upgrades === 'each' && M.goal === 'carrier' ? 'Take the piece their rabbit rides to fall to the next board, where you choose an upgrade. Keep your King.'
      : M.upgrades === 'each' ? 'Take their King to fall to the next board, where each side gets an upgrade. Keep yours.'
      : M.goal === 'king' ? 'Take their King to fall to the next level. Keep yours; a piece taken is gone for good.'
      : 'Take every piece of theirs to fall to the next level. A piece taken is gone for good.',
    course: 'Move a piece into the ball and it slides on until something stops it. Sink it at par or better; over par, the hole again.',
    rounds: 'Put rabbits in your pieces and let them fight. Win the round to grow your side; a lost round costs a life.',
    single: 'One level. Win it how it says above.'
  }[M.run];
  // A chess variant: its own goal, and what Grove Chess plays differently.
  if (M.realtime && M.run === 'descent') text = text + ' No turns: move any piece whenever it is ready; the ring under it shows its rest.';
  const V = VARIANTS[M.variant];
  if (V && M.run === 'single') return { kind: 'king', side: 'foe', title: V.name, text: [V.blurb, ...differs(V)].join(' ') };
  if (M.position && M.run === 'single' && M.goal === 'flag') return { kind: 'flag', side: 'you', title: MODE.name,
    text: 'Take the rabbit in the middle and carry it back to your first row. If they take the piece carrying it, they carry it home instead.' };
  if (M.position && M.run === 'single') return { kind: 'king', side: 'foe', title: MODE.name,
    text: 'Take their King and keep yours. There is no check: a King left where it can be taken is lost.' };
  return { kind: M.run === 'course' ? 'flag' : 'rabbit', side: M.run === 'course' ? 'you' : 'foe', title: MODE.name, text };
}

async function startLevel() {
  const found = await find(session.n);
  level = makeLevel(found.settings, found.seed);
  session.claimed = [];
  session.pick = setFor(session.n);
  par = found.par; measured = found.measure; autoBest = found.autoBest; setups = found.setups;
  // Golf (2026-10-13): par or better wins the hole. Par is the fewest
  // strokes the solver found plus some slack (two on the first two holes,
  // one after), so under par, a birdie, means finding the best line or
  // near it; and par is the hole's stroke limit.
  if (M.run === 'course' && par) { par += session.n <= 2 ? 2 : 1; level.rules = { ...level.rules, maxMoves: par }; }
  // Adventure (2026-10-15): par is set by depth, and the board was dealt so
  // its best line is two or three under it (modes.js adventurePar).
  if (M.upgrades === 'par') par = daily ? found.par : adventurePar(session.n);
  game = { states: [initialState(level)], moves: [] };
  // The daily: a board left part way picks up where it was.
  const resumed = daily && entry.moves.length && entry.results.length === session.n - 1 ? replay(entry.moves) : false;
  board = makeBoard($('#board'), level);
  board.lookOf = M.upgrades === 'par' ? lookOf : null;
  board.lookOfFoe = M.upgrades === 'par' ? (f) => suitLook(f?.suit) : null;
  $('#drop').hidden = M.upgrades !== 'par'; dropArmed = false; $('#drop').textContent = 'Let the floor give way';
  board.reach = level.settings.showReach;
  board.reachMine = level.settings.showMyReach;
  board.guards = level.settings.showGuards;
  board.safe = level.settings.showSafe;
  board.beacons = level.settings.showBeacons;
  board.pins = level.settings.showPins;
  board.redraw = draw;
  board.fur = furOf;
  sel = null; legal = []; shown = null;
  $('#sheet-list').replaceChildren();
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, { when: daily ? `Board ${session.n} of ${today.boards.length}` : `${levelWord()} ${session.n}` });
  $('#modepill').textContent = daily ? `Board ${session.n} of ${today.boards.length}` : M.run === 'single' ? MODE.name : `${levelWord()} ${session.n}`;
  $('#goalpill').textContent = level.rules.race ? 'Race to the top row' : level.rules.hill ? 'Take their King, or the hill' : GOAL_PILL[level.goalKind] || '';
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${level.W} × ${level.H}`));
  if (M.run === 'rounds') chips.append(el('span', { class: 'pill lifeline' }, '♥'.repeat(session.lives)));
  if (M.run === 'rounds' && M.shop) chips.append(el('span', { class: 'pill' }, `${session.acorns} acorn${session.acorns === 1 ? '' : 's'}`));
  if (M.run === 'course' && COURSES[M.courseName]) chips.append(el('span', { class: 'pill' }, COURSES[M.courseName].name));
  if (M.run === 'course') {
    // Golf's hazards on this hole (2026-10-13).
    const hz = [level.sand?.size && 'Sand', level.water?.size && 'Water', level.gates?.size && 'Gates', level.clouds?.length && 'Clouds'].filter(Boolean);
    if (hz.length) chips.append(el('span', { class: 'pill' }, hz.join(', ')));
    if ((session.tries?.[session.n] || 0) > 0) chips.append(el('span', { class: 'pill' }, `Try ${session.tries[session.n] + 1}`));
  }
  if (level.rules.crumble) chips.append(el('span', { class: 'pill' }, 'Crumbling'));
  if (level.rules.shrink) chips.append(el('span', { class: 'pill' }, 'Shrinking'));
  if (level.rules.wrap) chips.append(el('span', { class: 'pill' }, 'Magic edges'));
  if (level.rules.geared) chips.append(el('span', { class: 'pill' }, 'Geared'));
  if (measured) chips.append(el('span', { class: 'pill' }, `Difficulty ${measured.difficulty}`));
  // Autochess: how forgiving the round is, as the solver found it.
  if (setups?.tried) chips.append(el('span', { class: 'pill' }, `${Math.max(1, Math.round(100 * setups.wins / setups.tried))}% of setups win`));
  show('play');
  keepAwake();
  hud();
  if (M.upgrades !== 'par') handRow($('#playhand'));
  $('#setup').hidden = true;
  $('#arrange').hidden = true; arranging = null;
  kf?.stop(); kf = null;
  $('#movecount').previousSibling.textContent = 'Move ';
  $('#controls').hidden = true;
  busy = true;
  if (!resumed) await playIntro(board, level, { section: $('[data-screen=play]'), seen: session.seen, goal: daily ? dailyGoal() : goalCard() });
  if (daily) { dstore.seen = [...session.seen]; saveStore(dstore); }
  busy = false;
  if (isAuto()) return setUp();
  if (level.settings.arrange && level.pieces.length && setChanged()) await arrange();
  if (level.rules.realtime) return beginKungFu();
  $('#controls').hidden = false;
  $('#best').hidden = daily && !dailyTest;
  if (daily && resumed) {
    // Left during the cheer, or at the last move allowed: finish the board.
    if (isOver(now())) return levelOver(now());
    if (!now().bonus && now().t >= par + PICK_UP) return levelOver({ ...now(), gaveUp: true, pickedUp: true });
    status(`Board ${session.n} of ${today.boards.length}, where you left it.`); await readyUp(); return select(null);
  }
  if (daily) { status(`Board ${session.n} of ${today.boards.length}. Take them all, then the hole.`); return select(null); }
  status(`${levelWord()} ${session.n}. ${$('#goalpill').textContent}.${now().cloudy ? (now().day.rules.cloudOwn ? ' For the first turn, a cloud in front of each side stops the other side.' : ' A cloud covers the second rows for the first turn.') : ''}`);
  select(null);
}

// --- Kung fu: no turns (2026-10-11, kungfu.js). -----------------------------------

let kf = null;

async function beginKungFu() {
  const R = level.rules.realtime, jokers = session.run?.jokers || [];
  $('#controls').hidden = false; $('#wait').hidden = true;
  $('#movemax').textContent = '';
  $('#movecount').previousSibling.textContent = 'Time ';
  // Turn-based measures (difficulty, par) say nothing about real time.
  for (const c of $('#chips').children) if (/^Difficulty/.test(c.textContent)) c.remove();
  // Ready, then go: a beat to look at the board before the clock starts.
  status('Kung fu: no turns. Ready…');
  info('Move any piece of yours whenever it is ready. It rests after, and the ring under it shows for how long.');
  haptic(10);
  await sleep(1100);
  status('Go!'); sfx.slam(); haptic([20, 40, 20]);
  kf = startKungFu({
    board, level, state: now(), iq: level.settings.iq,
    // Jokers, read for real time: Double Time halves your rest, Lazy Rabbits doubles theirs.
    myCool: R.cool / (jokers.includes('double') ? 2 : 1), foeCool: R.foeCool * (jokers.includes('lazy') ? 2 : 1), step: R.step,
    gap: (R.gap || 1800) * (jokers.includes('lazy') ? 2 : 1),
    onStatus: status, onInfo: info,
    onClock: (ms) => { $('#movecount').textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; },
    onEnd: (end) => { kf = null; game.states = [end]; levelOver(end); }
  });
}

// --- Laying out your pieces (2026-10-10). --------------------------------------
// Timothy: "you should be able to lay out your pieces when you start on the
// board where you want them in the first two rows." Before the first move:
// tap a piece, then a square in your first two rows (or another piece of
// yours, to swap). A square is offered only if, with the piece there,
// nothing on either side could take on its first move, the same balance
// rule the dealt layout keeps. Par was found for the dealt layout, so if
// anything moved it is worked out again.

let arranging = null;

/** Your first two rows' squares that are free to stand on. */
function homeSquares() {
  const rows = [...new Set(Array.from({ length: level.H }, (_, y) => y).filter((y) => Array.from({ length: level.W }, (_, x) => x).some((x) => onBoard(level, x, y))))].slice(0, 2);
  const out = [];
  for (const y of rows) for (let x = 0; x < level.W; x++) {
    if (!onBoard(level, x, y) || level.stumps.has(y * level.W + x)) continue;
    if (level.foes.some((f) => f.x === x && f.y === y) || (level.hole && level.hole.x === x && level.hole.y === y)) continue;
    out.push({ x, y });
  }
  return out;
}

/** The layout with piece i at (x, y), swapping with whoever stands there. */
function placed(spots, i, x, y) {
  const out = spots.map((p) => ({ ...p })), j = out.findIndex((p, k) => k !== i && p.x === x && p.y === y);
  if (j >= 0) { out[j].x = out[i].x; out[j].y = out[i].y; }
  out[i].x = x; out[i].y = y;
  return out;
}

/** Does this layout let anything take on its first move? Then not allowed. */
function clashes(spots) {
  const was = level.pieces.map((p) => ({ x: p.x, y: p.y }));
  spots.forEach((p, i) => { level.pieces[i].x = p.x; level.pieces[i].y = p.y; });
  const { yours, theirs } = firstCaptures(initialState(level));
  was.forEach((p, i) => { level.pieces[i].x = p.x; level.pieces[i].y = p.y; });
  return yours.length || theirs.length ? { yours, theirs } : null;
}

function arrange() {
  const dealt = level.pieces.map((p) => ({ x: p.x, y: p.y })), home = homeSquares();
  let spots = dealt.map((p) => ({ ...p })), picked = null;
  const paint = () => {
    spots.forEach((p, i) => { level.pieces[i].x = p.x; level.pieces[i].y = p.y; });
    game.states = [initialState(level)];
    const lit = picked == null ? [] : home.filter((q) => !(spots[picked].x === q.x && spots[picked].y === q.y) && !clashes(placed(spots, picked, q.x, q.y)))
      .map((q) => ({ ...q, cap: false }));
    sel = picked; legal = lit;
    board.draw({ state: now(), track: game.states, sel, legal });
  };
  $('#controls').hidden = true;
  $('#arrange').hidden = false;
  status('Lay out your pieces.');
  info('Tap a piece of yours, then where it should start.');
  paint();
  return new Promise((resolve) => {
    arranging = (c) => {
      const i = spots.findIndex((p) => p.x === c.x && p.y === c.y);
      if (picked != null && legal.some((m) => m.x === c.x && m.y === c.y)) {
        spots = placed(spots, picked, c.x, c.y); picked = null; haptic(8); sfx.drop?.(0);
        info('Tap a piece of yours, then where it should start.');
      } else if (i >= 0) {
        picked = picked === i ? null : i;
        if (picked != null) info(`${nameOf(level.pieces[i])}: ${descOf(level.pieces[i].type, level.rules)} The lit squares are where it may start.`);
      } else if (picked != null && home.some((q) => q.x === c.x && q.y === c.y)) {
        const why = clashes(placed(spots, picked, c.x, c.y));
        info(why?.yours.length ? 'Not there: something of yours could take one of theirs on its first move.' : 'Not there: one of theirs could take one of yours on its first move.');
        return;
      } else { picked = null; info('Only your first two rows. Tap a piece of yours.'); }
      paint();
    };
    $('#arrangereset').onclick = () => { spots = dealt.map((p) => ({ ...p })); picked = null; paint(); };
    $('#arrangepieces').onclick = () => openSheet?.();
    $('#arrangego').onclick = async () => {
      arranging = null; sel = null; legal = [];
      $('#arrange').hidden = true;
      if (spots.some((p, i) => p.x !== dealt[i].x || p.y !== dealt[i].y) && par != null) {
        status('Working out par for your layout…');
        await sleep(30);
        const r = solveLevel(level, { deadline: Date.now() + 1500 });
        par = r.par;
        hud();
      }
      game.states = [initialState(level)];
      resolve();
    };
  });
}

/** Their riding rabbit, in words, for a tap on it. */
function carrierText(s, f) {
  const hop = hopIn(s);
  return `The rabbit riding their ${nameOf(s.foes[f.rides])}: take that piece to win. ${hop ? `It never moves by itself; ${hop === 1 ? 'next turn' : `in ${hop} turns`} it hops to another of their pieces.` : 'They can move it onto another of their pieces, but that is their whole move for the turn.'}`;
}

/** What a turn a suit left open says. */
function bonusLine(s) {
  const p = s.pieces[s.bonus.p], name = nameOf(p);
  return s.bonus.why === 'vines' || s.bonus.why === 'spirals' ? `${s.bonus.why === 'vines' ? 'Vines' : 'Spirals'}: your ${name} can take again. Take one, or end the turn.`
    : `Stars: your ${name} moves again. Move it, or end the turn.`;
}

/** One piece on the board (Adventure): its moves are always lit, with no
    tap needed (Timothy, 2026-10-15: "since we have one piece you shouldn't
    need to tap it to see where you can move"). */
const solo = () => M.upgrades === 'par';

function select(i) {
  const s0 = now(), auto = i == null && solo() && !placing && s0.pieces[0] && !s0.pieces[0].taken && !isOver(s0);
  if (auto) i = s0.bonus ? s0.bonus.p : 0;
  sel = i;
  // Waiting is off by default (2026-10-10): the button shows only when it
  // is allowed, when a suit left the turn open, or when nothing can move.
  const passOk = allMoves(now()).some((m) => m.p === -1);
  $('#wait').hidden = !passOk;
  $('#wait').textContent = now().bonus ? 'End turn' : now().set ? 'Pass: the next piece comes on' : now().day.rules.wait ? 'Wait a turn' : 'Pass (nothing can move)';
  legal = i == null ? [] : movesFor(now(), i);
  if (auto) info(`${now().set && setView(now()).filter((v) => !v.lost && !v.out).length > 1 ? 'Tap a lit square to move there, or a piece under the board to bring it on instead.' : 'Tap a lit square to move there.'} Hold any piece to see what it does.`);
  else if (i == null) info(level.hole ? (holeOpen(now()) ? 'Tap a piece to see where it can go. The hole is open.' : 'Tap a piece to see where it can go. The hole opens once every rabbit is caught.') : 'Tap a piece to light up where it can go.');
  else {
    const p = now().pieces[i], type = p.type;
    if (p.brain === 'carrier') info(`Your rabbit, riding your ${nameOf(now().pieces[p.rides] || p)}: if they take the piece it rides, you lose. ${legal.length ? 'Tap another of your pieces to move it there; that is your move for the turn.' : hopIn(now()) ? 'It hops by itself, at random.' : 'It has nowhere to go right now.'}`);
    else info(`${nameOf({ type })}: ${descOf(type, now().day.rules)}${carriesText(p, M.upgrades === 'par')}${legal.length || p.stun ? '' : ' It has nowhere to go right now.'}`);
  }
  // Your set under the board (Adventure): what can be chosen now.
  if (solo() && session?.run) { setRow(); nextUp(); }
  draw();
}

// --- Looking closer (Adventure, 2026-10-16, Timothy: "we need like an item
// tooltip thing games have for inspecting pieces on the board to see what
// they do and stuff"). Hold a piece (on the board or under it) or rest the
// mouse on it, and a card says everything it is: its moves, its rabbit, its
// suit, its weapon, and how it stands now. Tapping a piece that is not a
// move shows it too. In other modes the line under the board says it, as
// before.

let tipTimer = null, tipAt = 0, tipKey = null;
/** Did a hold just show the card (so the tap that ends it does nothing)? */
const tipHeld = () => performance.now() - tipAt < 700;
function hideTip() { clearTimeout(tipTimer); tipTimer = null; tipKey = null; const t = $('#tip'); if (t) t.hidden = true; }

/** One line of the card: an icon, a name in bold, and words. */
const tipRow = (icon, head, words) => el('div', { class: 'tiprow' }, icon || el('span', { class: 'sicon' }), el('div', {}, el('b', {}, head), ' ', words));

/** The card for piece p: `side` 'you' or 'foe'; `how` what it is doing
    ('on', 'ready', 'used', 'out', or for theirs nothing). */
function tipCard(p, side, how = null) {
  const s = now(), adv = M.upgrades === 'par', form = formOf(p), P = PIECES[p.type] || {}, F = PIECES[form] || P;
  const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
  cv.getContext('2d').drawImage(sprite(p.shape || p.type, side === 'you' ? lookOf(p) : p.brain === 'still' && !adv ? 'grey' : adv ? suitLook(p.suit) : 'foe', furOf(p)), 0, 0);
  const r = rabbitIn(p);
  const title = `${side === 'you' ? 'Your' : 'Their'} ${(P.name || p.type).toLowerCase()}${SUITS[p.suit] ? ` of ${SUITS[p.suit].name}` : ''}`;
  const sub = side === 'you'
    ? { on: 'Your move', ready: 'Ready this round', used: 'Has had its turn this round', out: r ? 'Standing where it moved, acting by its rabbit, until the whole set has played' : 'Standing where it moved until the whole set has played' }[how] || 'Yours'
    : p.brain === 'still' ? 'A statue: it never moves and never takes' : r ? `${rabbitName(r, p.suit)} inside` : 'Theirs';
  const rows = [];
  rows.push(tipRow(null, 'Moves:', `${form !== p.type && F.name ? `Plays the part of a ${F.name.toLowerCase()} now, until it moves again. ` : ''}${F.desc || ''}`));
  if (p.type === 'thespian') rows.push(tipRow(null, 'Thespian:', P.desc));
  if (r && RABBITS[r]) rows.push(tipRow(rabbitIcon(RABBITS[r].colour, 20), `${RABBITS[r].name} rabbit:`, `${side === 'you' ? RABBITS[r].mine : RABBITS[r].desc}${p.route && side === 'foe' ? ` ${routeText(p)}` : ''}`));
  else if (side === 'foe' && p.brain === 'still') rows.push(tipRow(null, 'No rabbit:', 'nothing moves it. Take it.'));
  if (SUITS[p.suit]) rows.push(tipRow(suitIcon(p.suit, SUITS[p.suit].colour, 20), `${SUITS[p.suit].name}:`, `${suitDesc(p.suit, adv)}${p.suit === 'hearts' ? ((p.lives || 1) > 1 ? ' Its heart is not spent yet.' : ' Its heart is spent.') : ''}`));
  if (WEAPONS[p.weapon]) rows.push(tipRow(el('span', { class: 'sicon wlight' }, weaponIcon(p.weapon, 20)), `${weaponName(p.weapon, p.wl || 1)}:`, weaponDesc(p.weapon, p.wl || 1, adv)));
  const now2 = [];
  if (p.stun || p.sat) now2.push('Stunned: it sits out its next turn.');
  if (p.pinned) now2.push('Pinned by a line of yours: it holds this turn.');
  if (p.trapped) now2.push('Last turn it could not run.');
  if (p.netted && side === 'foe') now2.push('Netted.');
  if (p.shape && PIECES[p.shape]) now2.push(`In the shape of a ${PIECES[p.shape].name.toLowerCase()} until it takes something else.`);
  if (now2.length) rows.push(tipRow(null, 'Now:', now2.join(' ')));
  return el('div', { class: 'tipcard' }, el('div', { class: 'tiphead' }, cv, el('div', {}, el('h3', {}, title), el('p', { class: 'dim' }, sub))), ...rows);
}

/** Show the card for p near the point (x, y) on the screen. */
function showTip(p, side, x, y, how = null) {
  if (!p) return hideTip();
  const t = $('#tip');
  t.replaceChildren(tipCard(p, side, how));
  t.hidden = false;
  const w = Math.min(320, innerWidth - 24), h = t.offsetHeight;
  t.style.width = `${w}px`;
  t.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, x - w / 2))}px`;
  t.style.top = `${y - h - 18 > 8 ? y - h - 18 : Math.min(innerHeight - h - 8, y + 24)}px`;
}

/** Hold (or, with a mouse, rest on) element e to see its piece's card. */
function inspectable(e, piece, how) {
  let timer = null, x0 = 0, y0 = 0;
  const show = (ev) => { const r = e.getBoundingClientRect(); showTip(piece(), 'you', r.left + r.width / 2, r.top, how?.()); tipAt = ev?.pointerType === 'mouse' ? 0 : performance.now(); };
  e.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'mouse') return; x0 = ev.clientX; y0 = ev.clientY; clearTimeout(timer); timer = setTimeout(() => show(ev), 420); });
  e.addEventListener('pointermove', (ev) => { if (ev.pointerType !== 'mouse' && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) clearTimeout(timer); });
  e.addEventListener('pointerup', () => clearTimeout(timer));
  e.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') { clearTimeout(timer); timer = setTimeout(() => show(ev), 300); } });
  e.addEventListener('pointerleave', (ev) => { clearTimeout(timer); if (ev.pointerType === 'mouse') hideTip(); });
  e.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

/** The piece on square (x, y) of the board, as you see it: { p, side }. */
function pieceAt(s, x, y) {
  const hidden = hiddenFrom(s, 'you');
  const mine = s.pieces.find((p) => !p.taken && p.x === x && p.y === y && p.type !== 'ball');
  if (mine) return { p: mine, side: 'you', how: mine === s.pieces[0] ? 'on' : mine.ally ? 'out' : null };
  const f = s.foes.find((q, k) => !q.taken && q.x === x && q.y === y && !hidden.has(k) && q.rides == null);
  return f ? { p: f, side: 'foe' } : null;
}

// Holding a piece on the board, or resting the mouse on it.
{
  const cv = $('#board');
  let timer = null, x0 = 0, y0 = 0, at = null;
  const look = (ev, mouse) => {
    if (!board || M.upgrades !== 'par' || !game) return;
    const c = board.cellAt(ev), hit = c && pieceAt(now(), c.x, c.y);
    if (!hit) return mouse ? hideTip() : null;
    const r = cv.getBoundingClientRect();
    showTip(hit.p, hit.side, ev.clientX, Math.max(r.top + 10, ev.clientY - 20), hit.how);
    tipKey = `${c.x},${c.y}`;
    tipAt = mouse ? 0 : performance.now();
  };
  cv.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'mouse') return; x0 = ev.clientX; y0 = ev.clientY; clearTimeout(timer); hideTip(); timer = setTimeout(() => look(ev, false), 420); });
  cv.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) clearTimeout(timer); return; }
    const c = board?.cellAt(ev), key = c ? `${c.x},${c.y}` : null;
    if (key === at) return;
    at = key; clearTimeout(timer);
    if (tipKey && tipKey !== key) hideTip();
    timer = setTimeout(() => look(ev, true), 300);
  });
  cv.addEventListener('pointerup', () => clearTimeout(timer));
  cv.addEventListener('pointerleave', () => { clearTimeout(timer); at = null; hideTip(); });
  cv.addEventListener('contextmenu', (ev) => { if (M.upgrades === 'par') ev.preventDefault(); });
  document.addEventListener('pointerdown', (ev) => { if (!$('#tip')?.hidden && !ev.target.closest?.('#tip')) hideTip(); }, true);
}

/** Catches this turn: into the run's tally, and (not on a test) your collection. */
function noteCatches(a, b) {
  b.foes.forEach((f, k) => {
    if ((f.type !== 'rabbit' && f.brain !== 'possessed' && !f.mind) || !f.taken || a.foes[k].taken) return;
    if (f.patternName && FUR[f.patternName]) { session.caught.push(f.patternName); if (!test) recordCatch(f.patternName); }
  });
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken && !session.firstCatch) session.firstCatch = f.type; });
  // Claimed: every piece of theirs taken this level, to combine with yours after it.
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken && ['classic', 'fairy'].includes(PIECES[f.type]?.kind)) session.claimed.push(f.type); });
}

function whatHappened(a, b, mv = null) {
  const bits = [];
  // A shield's push (2026-10-17): what it sent sliding, and what stopped it.
  const shoved = mv?.shove ? new Set(mv.push.map((e) => e.from)) : null;
  if (mv?.shove && mv.slid !== -1 && M.upgrades === 'par') {
    const W = a.day.W, at = (q) => a.foes.find((f) => !f.taken && f.y * W + f.x === q) || a.pieces.find((p, i) => i && !p.taken && p.y * W + p.x === q);
    const front = at(mv.push[mv.push.length - 1].from), hit = mv.bump?.[1] != null ? at(mv.bump[1]) : null;
    const whose = (p) => (a.foes.includes(p) ? 'their' : 'your');
    if (front) bits.push(`Your shield sends their ${nameOf(front).toLowerCase()} sliding${hit ? ` into ${whose(hit)} ${nameOf(hit).toLowerCase()}: both are stunned` : mv.bump?.length ? ': it hits something and is stunned' : ''}.`);
  }
  b.foes.forEach((f, k) => {
    if (!f.taken || a.foes[k].taken) return;
    if (M.upgrades === 'par' && session?.run) {
      // Adventure: every piece taken counts toward three of a kind.
      const c = tallyCounts(b).find((q) => q.type === f.type), was = tallyCounts(a).find((q) => q.type === f.type);
      const name = nameOf(f).toLowerCase(), r = rabbitIn(a.foes[k]);
      if (f.netted) { bits.push(`You netted their ${name}: it joins your set after this board${r ? `, and its ${rabbitName(r, f.suit).toLowerCase()} is yours` : ''}.`); return; }
      // Landing on it, the ordinary chess way, is a squash (Timothy,
      // 2026-10-15); a weapon's strike only takes. A piece of yours with a
      // rabbit may have taken it by itself (2026-10-16).
      const at = (p) => (!p.taken || p.lifted) && p.x === a.foes[k].x && p.y === a.foes[k].y;
      const ally = b.pieces.find((p, i) => i && p.ally && (at(p) || (b.tlog || []).some((l) => l.what === 'ally' && l.how === 'strike' && l.k === k && b.pieces[l.i] === p)));
      const squashed = at(b.pieces[0] || {}), vined = (b.tlog || []).some((l) => l.what === 'vine' && l.k === k);
      const three = c && c.made > (was?.made || 0);
      const pushedOff = shoved?.has(a.foes[k].y * a.day.W + a.foes[k].x);
      bits.push(`${pushedOff ? 'Your shield pushes' : vined ? 'Your vine catches' : ally ? `Your ${nameOf(ally).toLowerCase()} takes` : squashed ? 'You squash' : 'You take'} their ${name}${pushedOff ? ' off the edge' : ''}${r ? `, and the ${RABBITS[r].name.toLowerCase()} rabbit in it` : ''}.${daily ? '' : ' '}${daily ? '' : three ? (roomFor(session.run) ? `That is three: ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} joins your set after this board.` : `That is three, but your set is full (${ADVENTURE_MAX}).`) : `(${PIECES[f.type].name}s taken: ${c?.have || 0} of ${TAKE_FOR_PIECE}.)`}`);
      return;
    }
    bits.push(f.brain === 'leader' ? `You took the rabbit that leads them.` : f.mind || f.brain === 'possessed' ? `You took their ${nameOf(f)}, and the rabbit inside is yours.` : `You took their ${nameOf(f)}.`);
  });
  // Hearts (2026-10-16): spent, it stays; the piece that hit it goes back.
  b.foes.forEach((f, k) => { if (!f.taken && (f.lives || 1) < (a.foes[k].lives || 1)) bits.push(`Their ${nameOf(f).toLowerCase()}\u2019s heart is spent: it stays where it is${b.pieces.some((p) => p.bounced) ? ', and your piece goes back where it came from' : ''}.`); });
  // A piece with a rabbit stays behind (2026-10-16).
  // Every piece stays (2026-10-16): it moves, turns into the next, and is
  // left standing when that one moves on (2026-10-17); when the whole set
  // has played, they come off.
  if (b.stood) { const p = b.pieces[b.stood.k]; if (p) bits.push(`Your ${nameOf(p).toLowerCase()} stays behind${RABBITS[p.rabbit] ? `, its ${RABBITS[p.rabbit].name.toLowerCase()} rabbit in charge` : ''}.`); }
  // Your set takes turns: say what you are now.
  if (b.set && !b.won && !b.arrived && !b.pieces[0].taken && b.pieces[0].type !== a.pieces[0].type) { const n = nameOf(b.pieces[0]).toLowerCase(); bits.push(`Now you are ${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}.`); }
  // Adventure's tactics: what their turn was, in words.
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const me = b.pieces[0], myName = me ? nameOf(me).toLowerCase() : 'piece';
  const theirs = (k) => `their ${b.foes[k]?.brain === 'crown' ? 'leader' : nameOf(b.foes[k] || {}).toLowerCase()}`;
  const by = (l) => (l.by === 'stone' ? 'your stone' : l.by === 'ally' ? 'a piece of yours' : `your ${myName}`);
  for (const l of b.tlog || []) {
    if (l.what === 'pin') bits.push(`${cap(by(l))} pins ${theirs(l.k)}: it holds.`);
    if (l.what === 'check') bits.push(l.how === 'take' ? `Check! ${cap(theirs(l.k))} takes ${by(l)}.` : l.how === 'block' ? `Check! ${cap(theirs(l.k))} steps in to block, and its rabbit stands guard there now, a sentry.`
      : `${l.double ? 'Double check' : 'Check'}! Their leader runs.`);
    if (l.what === 'mate') bits.push('Checkmate! Their leader is caught, and the rest lay down their arms.');
    if (l.what === 'flee') bits.push(`The scared rabbit in ${theirs(l.k)} runs.`);
    if (l.what === 'swap') bits.push(`It trades squares with their ${nameOf(b.foes[l.with] || {}).toLowerCase()} to get away (Gears).`);
    if (l.what === 'stunned') bits.push(`${cap(theirs(l.k))} is stunned, and sits out this turn.`);
    if (l.what === 'ally' && l.how === 'run') bits.push(`Your ${nameOf(b.pieces[l.i]).toLowerCase()} runs from their reach.`);
    if (l.what === 'ally' && l.how === 'stuck') bits.push(`Your ${nameOf(b.pieces[l.i]).toLowerCase()} would run, but has nowhere to go.`);
    if (l.what === 'ally' && l.how === 'trap') bits.push(l.held ? `Your ${nameOf(b.pieces[l.i]).toLowerCase()} springs its trap, but a heart holds and it goes back.` : `Your ${nameOf(b.pieces[l.i]).toLowerCase()} springs its trap, and stays there.`);
    if (l.what === 'trapped') bits.push(l.fork ? `Fork! ${cap(theirs(l.k))} could not run as well.` : l.pinned ? `${cap(theirs(l.k))} would run, but it is pinned.` : `${cap(theirs(l.k))} has nowhere to run.`);
    if (l.what === 'sentry') bits.push(l.on === 'stone' ? `The sentry rabbit in ${theirs(l.k)} strikes and breaks your stone.` : `The sentry rabbit in ${theirs(l.k)} strikes.`);
    if (l.what === 'trap') bits.push(`The trap rabbit in ${theirs(l.k)} springs, and stays where it took.`);
    if (l.what === 'chain') bits.push(`${cap(theirs(l.k))} takes again (Spirals).`);
    if (l.what === 'stone') bits.push(`Your stone takes ${theirs(l.k)}.`);
  }
  if (b.lifted) bits.push(`Your whole set has played: your pieces come off the board, and a new round starts from here.`);
  // A piece of your set taken (Adventure): gone, and the next comes on.
  if (b.arrived) {
    const t = b.foes.find((f) => !f.taken && f.ate === 0), left = setLeft(b);
    bits.push(`${b.arrived.lost.vined ? 'A vine of theirs catches' : t ? `${cap(theirs(b.foes.indexOf(t)))} squashes` : 'They took'} your ${nameOf(b.arrived.lost).toLowerCase()}: it is out for this board. ${b.arrived.recalled ? `Your ${myName}, with its rabbit, is your piece again` : `Your ${myName} comes on in its place`}${left > 1 ? ` (${left} pieces left)` : ', your last piece: lose it and the adventure is over'}.`);
  }
  if (b.foeBonus === 'vines') bits.push('Their piece of Vines takes again.');
  if (b.foeBonus === 'stars') bits.push('Their piece of Stars moves twice.');
  b.foes.forEach((f) => {
    if (f.ate > 0 && M.upgrades === 'par' && b.pieces[f.ate]?.taken && a.pieces[f.ate] && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f).toLowerCase()} took your ${nameOf(b.pieces[f.ate]).toLowerCase()} where it stood: it is out for this board.`);
    else if (f.ate >= 0 && b.pieces[f.ate]?.taken && a.pieces[f.ate] && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
    if (f.wounded >= 0) bits.push(M.upgrades === 'par' ? `Their ${nameOf(f).toLowerCase()} hits your ${nameOf(b.pieces[f.wounded]).toLowerCase()}: its heart is spent, it stays, and theirs goes back.` : `Their ${nameOf(f)} took your ${nameOf(b.pieces[f.wounded])}, but its heart sends it back to your first row.`);
  });
  // Weapons and the rabbits (2026-10-13).
  if (b.revived?.side === 'foe') bits.push(`Their ${nameOf(b.foes[b.revived.i])} had a heart: it goes back to their first row.`);
  b.pieces.forEach((p, i) => { if (p.stun && a.pieces[i] && !a.pieces[i].stun) bits.push(`Your ${nameOf(p)} is stunned and sits out your next turn.`); });
  b.foes.forEach((f, k) => { if (f.stun && !a.foes[k].stun) bits.push(`Their ${nameOf(f)} is stunned and sits out their next turn.`); });
  const ra = carrierOf(a, 'foe'), rb = carrierOf(b, 'foe');
  if (ra && rb && ra.rides !== rb.rides) bits.push(rabbitChosen(b.day.rules) ? `They move the rabbit to their ${nameOf(b.foes[rb.rides])}.` : `The rabbit hops to their ${nameOf(b.foes[rb.rides])}.`);
  const ma = carrierOf(a, 'you'), mb = carrierOf(b, 'you');
  if (ma && mb && ma.rides !== mb.rides) bits.push(`Your rabbit hops to your ${nameOf(b.pieces[mb.rides])}.`);
  const fa = flagAt(a), fb = flagAt(b);
  if (fb && fa && fb.by !== fa.by) bits.push(fb.by === 'you' ? 'You have the rabbit: bring it back to your first row.' : fb.by === 'foe' ? 'They have the rabbit: take the piece carrying it.' : 'The rabbit is loose.');
  if (b.hole && !holeOpen(a) && holeOpen(b) && b.day.rules.goal !== 'clear') bits.push('The hole is open.');
  // Golf (2026-10-13): a ball into the water goes back to the tee.
  b.pieces.forEach((p, i) => { if (p.splash && p.splash.t !== a.pieces[i]?.splash?.t) bits.push('Splash: into the water, and back to the tee.'); });
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
  if ((b.open?.length || 0) > (a.open?.length || 0)) {
    const onIt = (q) => [...b.pieces, ...b.foes].some((p) => !p.taken && p.y * b.day.W + p.x === q);
    const opened = b.open.filter((q) => !(a.open || []).includes(q));
    if (opened.some(onIt)) bits.push('A statue is broken.');
    if (opened.some((q) => !onIt(q))) bits.push(b.open.length >= b.day.stumps.size ? 'The last statue sinks away.' : 'A statue sinks away.');
  }
  const gone = (b.ghostGone || []).filter((q) => !(a.ghostGone || []).includes(q)), whose = (side) => gone.filter((q) => b.day.ghosts.get(q) === side).length;
  const g = (n, who) => (n === 1 ? `${who} ghost is gone.` : `${n} of ${who.toLowerCase()} ghosts are gone.`);
  if (whose('you')) bits.push(g(whose('you'), 'Your'));
  if (whose('foe')) bits.push(g(whose('foe'), 'Their'));
  if (b.clouds?.length) {
    const hidA = hiddenFrom(a, 'you'), hidB = hiddenFrom(b, 'you');
    if ([...hidB].some((k) => !hidA.has(k))) bits.push('Something of theirs is hidden in a cloud.');
    // A piece of yours that ran into one of theirs hiding in a cloud.
    if (b.foes.some((f, k) => f.taken && !a.foes[k].taken && hidA.has(k))) bits.push('You ran into one of theirs hiding in a cloud, and took it.');
  }
  if (!bits.length) bits.push('Your move.');
  return [...new Set(bits)].join(' ');
}

/** A piece of yours that came back from a heart (2026-10-13): while set,
    tapping one of the squares it could go to puts it there instead. */
let placing = null;
/** Adventure: the first tap on "Let the floor give way" (the second ends the board). */
let dropArmed = false;

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  let a = now();
  sel = null; legal = []; placing = null; pendingPlace = null;
  if (dropArmed) { dropArmed = false; $('#drop').textContent = 'Let the floor give way'; }
  // Your set (Adventure): every move says which piece of it moved; one that
  // names another than the piece on the board (the best-move button) brings
  // it on first.
  if (mv.p >= 0 && a.set && !a.bonus) {
    if (mv.as != null && mv.as !== a.ci && setReady(a, mv.as)) {
      const c = chooseInSet(a, mv.as);
      game.states[game.states.length - 1] = c;
      await board.animate(a, c, { p: -1 });
      a = c;
    }
    mv = { ...mv, as: a.ci };
  }
  const mid = playerMove(a, mv);
  shown = mid;
  await board.animate(a, mid, mv);
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await sleep(30); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  if (daily) { entry.moves.push({ ...mv, ci: a.ci }); saveStore(dstore); }
  shown = null;
  noteCatches(a, b);
  haptic(b.won ? [20, 40, 30] : b.arrived || b.pieces.some((p, i) => p.taken && a.pieces[i] && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  // A piece of your set taken (Adventure): first they take it, then the
  // next of your set drops in where you came onto the board.
  if (b.arrived) {
    // (Pieces of yours standing by themselves stay where they are; one
    // that becomes your piece again is still standing there till then.)
    const gone = { ...b, pieces: [{ ...b.arrived.lost }, ...b.pieces.slice(1).map((p) => (p.recalled ? { ...p, taken: false } : p))], ci: b.arrived.from };
    await board.animate(mid, gone, { p: -1 });
    await board.animate(gone, b, { p: -1 });
  } else if (!b.won && !b.bonus) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return levelOver(b);
  // The daily: par and two more, not cleared, and the floor gives way (a
  // double bogey whatever came after, so no board eats the five minutes).
  if (daily && !b.bonus && b.t >= par + PICK_UP) return levelOver({ ...b, gaveUp: true, pickedUp: true });
  // A suit left the turn open (Vines, Stars): the same piece goes again.
  if (b.bonus) { haptic([12, 30, 12]); sfx.gain(); status(bonusLine(b)); return select(b.bonus.p); }
  status(whatHappened(a, b, mv));
  // Your set (Adventure): a ready piece comes on, as a start.
  await readyUp(a);
  // Hearts: one of yours is back on your first row; you may put it on
  // another free square there.
  if (b.revived?.side === 'you' && b.revived.options.length > 1) {
    placing = b.revived;
    status(`${whatHappened(a, b)} Tap a lit square to put it somewhere else there, or play on.`);
    sel = null; legal = placing.options.map((q) => ({ x: q % level.W, y: Math.floor(q / level.W), place: q }));
    draw();
    return;
  }
  // The showdown: two left, and the board starts closing in.
  if (showdown(b) && !showdown(a)) {
    haptic([20, 60, 20, 60, 20]); sfx.dusk?.();
    status('Two left. The board closes in.');
    $('#chips').append(el('span', { class: 'pill' }, 'Showdown'));
  }
  select(null);
}

let pendingPlace = null;
$('#board').addEventListener('click', async (e) => {
  if (!board || busy || isOver(now())) return;
  // The tap that ends a hold only showed a piece's card.
  if (tipHeld()) return;
  const c = board.cellAt(e);
  if (!c) return;
  if (kf) return kf.tap(c);
  if (arranging) return arranging(c);
  if (isAuto()) { if (!$('#setup').hidden) panel?.pickAt(c.x, c.y); return; }
  const { x, y } = c, s = now();
  // Hearts: putting the piece that came back on another square of its row.
  if (placing) {
    const m = legal.find((q) => q.x === x && q.y === y && q.place != null);
    if (m) { game.states[game.states.length - 1] = placeRevived(s, m.place); pendingPlace = m.place; placing = null; legal = []; sfx.gain(); select(null); return status('There. Your move.'); }
    placing = null; legal = [];
  }
  if (sel != null) {
    // The whole move (a weapon's strikes, pushes, a promotion), and a choice
    // when more than one ends on this square.
    const here = legal.filter((m) => m.x === x && m.y === y);
    const m = here.length > 1 ? await pickMove(here, s.pieces[sel]) : here[0];
    if (here.length) { if (m) return play({ p: sel, ...m, ...(pendingPlace != null ? { place: pendingPlace } : {}) }); return; }
  }
  // A square can hold two of yours: a rabbit on a piece's head. Tapping
  // goes rabbit first, then the piece under it, then neither.
  const here = s.pieces.map((p, k) => k).filter((k) => !s.pieces[k].taken && s.pieces[k].x === x && s.pieces[k].y === y)
    .sort((a, b) => (s.pieces[b].rides != null) - (s.pieces[a].rides != null));
  // One piece on the board (Adventure): its moves are lit already; tapping
  // it, or a piece of yours standing by itself, shows its card.
  if (here.length && solo()) { const h = pieceAt(s, x, y); if (h) showTip(h.p, 'you', e.clientX, e.clientY - 20, h.how); return; }
  if (here.length) { const at = here.indexOf(sel); return select(at < 0 ? here[0] : at + 1 < here.length ? here[at + 1] : null); }
  select(null);
  // A stone of yours (Stone suit).
  const stone = (s.stones || []).find((t) => t.x === x && t.y === y);
  if (stone) return info(`Your stone, in the shape of a ${nameOf(stone).toLowerCase()}: a sentry of yours. Its reach is ringed in sand. At the end of their turn it takes one of theirs that moved into where it attacks, and its lines pin and give check like your piece's. Their pieces can break it. It crumbles ${stone.left > 1 ? `after ${stone.left} more turns` : 'after this turn'}.`);
  if (s.hole && s.hole.x === x && s.hole.y === y && !s.foes.some((f) => !f.taken && f.x === x && f.y === y)) return info(s.day.rules.goal === 'clear' ? `${EXIT_DESC} It is ${holeOpen(s) ? 'open' : 'shut'}.` : HOLE_DESC);
  if (s.cloudy && s.day.cloud?.has(y * s.day.W + x)) return info(cloudDesc(s.day.rules));
  if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
  if (shrunk(s, x, y)) return info(SHRINK_DESC);
  const sq = y * s.day.W + x;
  if (statueAt(s, sq)) return info(s.day.statueOrder ? `${statueDesc(s.day.rules)} ${STATUE_ROW_DESC}` : statueDesc(s.day.rules));
  // Neutral pieces (2026-10-13). What is under a cloud stays hidden.
  if (ghostAt(s, sq)) return info(GHOST_DESC.replace('{side}', ghostAt(s, sq) === 'you' ? 'yours' : 'theirs'));
  if (s.day.gates?.has(sq)) return info(`${GATE_DESC} It is ${gateUp(s, sq) ? 'up' : 'down'} now.`);
  if (waterAt(s, sq)) return info(WATER_DESC);
  const hidden = hiddenFrom(s, 'you');
  if (cloudOver(s, sq) && !s.foes.some((f, k) => !f.taken && f.x === x && f.y === y && !hidden.has(k))) return info(WANDER_DESC);
  if (sandAt(s, sq) && !s.foes.some((f) => !f.taken && f.x === x && f.y === y)) return info(SAND_DESC);
  // A rider first: the rabbit on their King's head is what you see on top.
  const seen = (f) => !f.taken && f.x === x && f.y === y && !hidden.has(s.foes.indexOf(f));
  const f = s.foes.find((f) => seen(f) && f.rides != null) || s.foes.find(seen);
  if (f?.brain === 'leader') return info(leaderDesc(f, s.day));
  // Adventure (2026-10-16): theirs show their card.
  if (M.upgrades === 'par' && f) return showTip(f, 'foe', e.clientX, e.clientY - 20);
  if (f?.brain === 'carrier') return info(carrierText(s, f));
  if (f?.brain === 'still') return info(`A statue of their ${nameOf(f).toLowerCase()}: it never moves and never takes. Take it.`);
  // Adventure's tactics.
  if (f?.brain === 'sentry') return info(`Their ${nameOf(f).toLowerCase()}, with a sentry rabbit inside (red). It never walks, but if anything of yours stands in its reach (ringed red) when their turn ends, it leaps to take it. Pinned, it cannot.`);
  if (f?.brain === 'scared') return info(`Their ${nameOf(f).toLowerCase()}, with a scared rabbit inside (white): when you attack it, it runs to a square you do not attack. Their side can save only one a turn, so attack two at once.${f.trapped ? ' Last turn it could not run.' : ''}`);
  if (f?.brain === 'crown') return info('Their leader, a crowned King. Attack it, and they must answer: take your attacker if they can (the King only if nothing else of yours guards that square), else block the line (the blocker stands guard there after), else the King runs. If none of those works, it is checkmate, and every piece of theirs falls.');
  if (f?.route) return info(`Their ${nameOf(f).toLowerCase()}. ${routeText(f)}`);
  if (f) info(f.mind ? `Their ${nameOf(f)}, with a ${f.patternName ? f.patternName.toLowerCase() + ' ' : ''}rabbit inside (intelligence ${f.mind.iq}).` : `Their ${nameOf(f)}. ${PIECES[f.type].desc}${carriesText(f)}`);
  const fl = flagAt(s);
  if (!f && fl && !fl.by && fl.x === x && fl.y === y) info('The rabbit to capture: take it, and the piece that took it carries it. Bring it back to your first row to win; if they take the piece carrying it, it is theirs to bring home.');
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
// The best move, for testing (2026-10-14): whatever the mode.
$('#best').onclick = async () => {
  if (!board || !game || busy || isOver(now())) return;
  if (kf) { if (!kf.best()) info('None of your pieces is ready to move.'); return; }
  if (arranging || isAuto()) return info('Nothing to move yet: this is the setting up.');
  status('Finding the best move\u2026');
  await sleep(30);
  const m = bestMove(now(), level);
  if (!m) return status('There is no move to make.');
  return play(m.p == null || m.p < 0 ? { p: -1, x: 0, y: 0 } : m);
};
// Stuck (Adventure, 2026-10-15): a board can still leave no way through
// once a piece of your set is lost, and nobody should have to play out the
// moves to find that out. Two taps end the board, not cleared.
$('#drop').onclick = () => {
  if (!board || !game || busy || isOver(now())) return;
  if (!dropArmed) { dropArmed = true; haptic(8); $('#drop').textContent = 'Tap again: the board ends, not cleared'; return; }
  dropArmed = false; $('#drop').textContent = 'Let the floor give way';
  levelOver({ ...now(), gaveUp: true });
};
$('#pieces').onclick = () => openSheet?.();
$('#setuppieces').onclick = () => openSheet?.();
$('#sheet-close').onclick = () => $('#sheet').close();

// --- Autochess rounds. ---------------------------------------------------------

function setUp() {
  const pool = rabbitPool(level.settings, myRabbits(), level.pieces.length);
  panel = setupPanel({ tray: $('#tray'), slots: $('#slots'), level, pool, onChange: (list) => {
    game.states = [setupState(level, list)];
    $('#go').disabled = !list.some((u) => u.rabbit);
    draw();
  } });
  $('#controls').hidden = true;
  $('#setup').hidden = false;
  status(`${levelWord()} ${session.n}. Set up your line, then let them go.`);
  info(Object.keys(pool).length ? '' : 'No rabbits to put in your pieces yet: set "Your rabbits" to every named kind in the settings.');
  panel.paint();
}

$('#go').onclick = async () => {
  if (busy) return;
  busy = true;
  $('#setup').hidden = true;
  game = { states: [setupState(level, panel.setup())], moves: [] };
  status('Off they go.'); info('');
  draw();
  await playOut({ board, level, states: game.states, moves: game.moves, setShown: (s) => { shown = s; },
    onTurn: (a, b) => { noteCatches(a, b); hud(); if (!isOver(b)) status(whatHappened(a, b)); } });
  busy = false;
  levelOver(now());
};
$('#clearsetup').onclick = () => panel?.clear();

// --- The end of a level. -------------------------------------------------------

async function levelOver(end) {
  const won = end.won, how = outcome(end);
  ({ caught: () => sfx.fanfare(par ? sfx.levelFor(end.t - par) : 2), dusk: () => sfx.dusk(), eaten: () => sfx.lost() })[how]?.();
  if (M.run === 'single') return singleOver(end);
  if (M.run === 'course') {
    // Par or better wins the hole (2026-10-13); over par, the same hole
    // again, as many times as it takes. Nothing is lost by trying again.
    session.tries = session.tries || {};
    if (!won) {
      session.tries[session.n] = (session.tries[session.n] || 0) + 1;
      status(par ? `Over par. The hole again: par ${par}.` : 'Out of strokes. The hole again.');
      await sleep(1400);
      return startLevel();
    }
    session.strokes.push({ hole: session.n, par, strokes: end.t, sunk: true, tries: (session.tries[session.n] || 0) + 1 });
    status(`Sunk in ${end.t}.`);
    await sleep(1200);
    if (session.n >= holesOf(M)) return courseOver();
    session.n++;
    return between({ note: `Hole ${session.n}`, sub: par ? `${golf(end.t - par)[0].toUpperCase()}${golf(end.t - par).slice(1)} on that hole.` : '' });
  }
  if (M.run === 'rounds') {
    if (won) session.wins++; else session.lives--;
    const earned = M.shop ? acornsFor(won, end.foes.filter((f) => f.taken).length) : 0;
    session.acorns += earned;
    status((won ? 'Round won.' : `Round lost. ${session.lives} ${session.lives === 1 ? 'life' : 'lives'} left.`) + (earned ? ` ${earned} acorns.` : ''));
    await sleep(1400);
    if (session.lives <= 0) return runOver('Out of lives.');
    session.n++;
    if (M.shop) return between({ note: `Round ${session.n}`, shop: true });
    return between({ note: `Round ${session.n}`, rewards: won && M.rewards });
  }
  if (daily) return dailyOver(end);
  if (M.upgrades === 'par') return adventureOver(end);
  // A descent.
  const allGone = end.pieces.every((p) => p.taken);
  const kingGone = level.rules.royal && end.pieces.some((p) => p.taken && p.type === 'king');
  // Nothing is lost for good with one upgrade a board (2026-10-13): every
  // board starts with your whole lineup again.
  if (!oneBoard()) afterLevel(session.run, end);
  if (kingGone) { status('They took your King.'); await sleep(1600); return runOver('They took your King.'); }
  if (allGone) { status('They took everything.'); await sleep(1600); return runOver('Every piece you had is gone.'); }
  if (!won && M.outOfMoves === 'end') { status('Out of moves.'); await sleep(1600); return runOver('You ran out of moves.'); }
  if (oneBoard()) {
    // One upgrade a board, each side: on every new board, won or not.
    session.n++; session.run.depth = session.n;
    if (!test) { const r = mine(); r.best = Math.max(r.best || 0, session.n); saveRecords(); }
    if (M.upgrades === 'tiles') {
      status(won ? 'Round won. You turn a tile over first.' : 'Out of moves. They turn a tile over first.');
      await sleep(900);
      return between({ note: `Round ${session.n}`, board: true, won });
    }
    status(won ? 'The floor gives way.' : 'Out of moves: the floor gives way anyway.');
    if (!calm()) { await sleep(400); if (board.collapse) await board.collapse(); }
    return between({ note: `Depth ${session.n}`, board: true, fall: true });
  }
  // Recruiter: the first piece you took joins you, if there is room.
  let recruited = null;
  if (won && session.run.jokers.includes('recruiter') && session.firstCatch && PIECES[session.firstCatch]?.kind !== 'quarry'
    && ['classic', 'fairy'].includes(PIECES[session.firstCatch]?.kind) && session.run.hand.length < session.run.maxPieces) {
    session.run.hand.push({ base: session.firstCatch }); recruited = session.firstCatch;
    addToRoster(recruited);
  }
  session.firstCatch = null;
  session.n++; session.run.depth = session.n;
  // A waystone lit by going deeper than ever: said, sounded and felt.
  const before = deepest();
  if (!test) { const r = mine(); r.best = Math.max(r.best || 0, session.n); saveRecords(); }
  const lit = carries() ? newlyLit(before, deepest()) : [];
  status(won ? 'The floor gives way.' : 'Out of moves: the floor gives way anyway.');
  if (!calm()) { await sleep(400); if (board.collapse) await board.collapse(); }
  if (lit.length) { sfx.fanfare(3); haptic([30, 40, 30, 40, 60]); }
  const sub = (won ? '' : 'Nothing found on the way down this time. ')
    + (recruited ? `Your first catch, the ${PIECES[recruited].name.toLowerCase()}, comes with you. ` : '')
    + lit.map((w) => `A waystone is lit at depth ${w.depth}: ${w.text}${w.id.startsWith('keepsake') && !M.keepsakes ? ' (Off for now: "Waystones give upgrades at the start" in the settings.)' : ''}`).join(' ');
  return between({ note: `Depth ${session.n}`, sub, rewards: won && M.rewards, combine: won, fall: true });
}

/**
 * The end of an Adventure board (2026-10-15). Cleared: you jumped into the
 * hole. Not cleared: out of moves, or they took the last of your set, and
 * the floor gives way anyway. Either way the pieces they took are gone for
 * good, what your net caught joins you, every other piece you took leaves
 * its rabbit, three of a kind become that piece in your set, and you choose
 * a card: one over par (or not cleared), a choice of two on par, three
 * under. Lose your last piece and the adventure is over.
 */
async function adventureOver(end) {
  const run = session.run, won = end.won, took = !won && end.pieces[0]?.taken ? nameOf(end.pieces[0]).toLowerCase() : null;
  // Pieces of your set they took on the way (back next board).
  const fell = (end.set || []).filter((e) => e.lost).map((e) => nameOf(e).toLowerCase());
  const after = afterAdventure(run, end, session.pick || [0]);
  // What you took: rabbits now and then, and for certain from a net (2026-10-16).
  const taken = rabbitsTaken(end), sure = rabbitsTaken(end, true);
  const netted = netCatches(run, end);
  const made = takeTally(run, end);
  if (after.all) { status(`They took your ${took || 'last piece'}.`); await sleep(1600); return runOver('They took every piece of your set on one board.'); }
  const how = parVerdict(end.t, par, won), score = scoreName(end.t, par, won);
  // A piece given after this depth (a bishop after the first board, a knight
  // after the third), so you have a set to work with.
  const gift = ADVENTURE_GIFTS[session.n] && roomFor(run) ? ADVENTURE_GIFTS[session.n] : null;
  if (gift) { run.hand.push({ base: gift }); run.found.push(gift); }
  session.n++; run.depth = session.n;
  if (!test) { const r = mine(); r.best = Math.max(r.best || 0, session.n); saveRecords(); }
  status(won ? `${score}${how === 'worse' ? '' : '!'} A hole opens: down you go.`
    : end.gaveUp ? 'You let the floor give way.' : took ? `They took your ${took}. The floor gives way.` : 'Out of moves: the floor gives way anyway.');
  // Cleared: your piece hops into the hole that opened beside it (Timothy,
  // 2026-10-15: "the hole should just be like an animation where the piece
  // jumping in"). Otherwise the floor gives way.
  if (won) await cheer(score, `${end.t} moves, par ${par}`);
  if (!calm()) { await sleep(won ? 150 : 400); if (won && board.intoHole) await board.intoHole(); else if (board.collapse) await board.collapse(); }
  if (made.length || netted.length || gift) { sfx.fanfare(3); haptic([30, 40, 30, 40, 60]); }
  const cards = adventureCards(run, PAR_CARDS[how], rng(`reward:${session.seed}:${session.n}`), taken);
  const n = PAR_CARDS[how], count = ['', 'one', 'two', 'three', 'four'][n];
  const note = `${score}: ${won ? `${end.t} moves, par ${par}.` : 'the floor gave way.'} `
    + (PAR_AUTO[how] === 'all' ? 'One card, and it goes to a piece of chance\u2019s choosing.' : PAR_AUTO[how] === 'card' ? 'One card: choose the piece for it.' : `Choose one of ${count}.`);
  const a = (t) => (/^[aeiou]/i.test(PIECES[t].name) ? 'An' : 'A');
  const sub = [gift ? `${a(gift)} ${PIECES[gift].name.toLowerCase()} joins your set.` : '',
    fell.length ? `Taken on this board, back for the next: your ${fell.join(', ')}.` : '',
    ...netted.map((t) => `In your net: ${a(t).toLowerCase()} ${PIECES[t].name.toLowerCase()} joins your set.`),
    ...made.map((t) => `Three ${PIECES[t].name.toLowerCase()}s taken: ${a(t).toLowerCase()} ${PIECES[t].name.toLowerCase()} joins your set.`),
    [...netted.full, ...made.full].length ? `Your set is full, ${ADVENTURE_MAX} pieces: no room for the ${[...netted.full, ...made.full].map((t) => PIECES[t].name.toLowerCase()).join(' or the ')}.` : '',
    run.hand.length > run.maxPieces ? `You have ${run.hand.length} pieces: each board, ${run.maxPieces} of them are your set, drawn at random.` : ''].filter(Boolean).join(' ');
  // A rabbit your net caught is yours for certain: put it in a piece after
  // the card (each in turn), while some piece has none.
  const extra = sure.map((r) => ({ kind: 'rabbit', ...r }));
  return between({ note: `Depth ${session.n}`, sub, rewards: true, cards, rewardNote: note, rewardAuto: PAR_AUTO[how] || null, fall: true, extra });
}

// --- The daily (2026-10-18). ------------------------------------------------------
// Three stored boards of Adventure (daily5.js), scored as golf, shared as a
// link that carries each friend's moves per board.

/** Play kept moves back onto this board (the daily, picking up where you
    left off): each as play() made it, the piece of the set it was first. */
function replay(moves) {
  let s = now();
  for (const mv of moves) {
    if (isOver(s)) break;
    if (s.set && !s.bonus && mv.ci != null && mv.ci !== s.ci && setReady(s, mv.ci)) s = chooseInSet(s, mv.ci);
    const b = respond(playerMove(s, mv));
    game.moves.push(mv); game.states.push(b); s = b;
  }
  return game.moves.length > 0;
}

/** The first board's card, for someone who has never played Adventure. */
function dailyGoal() {
  if (session.seen.has('goal')) return null;
  session.seen.add('goal');
  return { kind: 'cat', side: lookOf(null), title: 'The daily', text: 'Take every piece of theirs, then jump into the hole. Each turn, choose which of your set moves; each has its turn before any goes again. Pieces on a coloured plinth move by themselves. Hold any piece to see what it does.' };
}

/** A daily board is over: cleared, or the floor gave way. */
async function dailyOver(end) {
  const b = today.boards[session.n - 1], won = !!end.won, res = { t: end.t, won };
  entry.results[session.n - 1] = res; entry.moves = [];
  const last = session.n >= today.boards.length;
  if (last) entry.done = true;
  saveStore(dstore);
  const d = strokesOf(res, b.par) - b.par, word = scoreWord(d);
  status(won ? `${word}! A hole opens: down you go.` : end.pickedUp ? `Par and two more, not cleared: the floor gives way. ${word}.`
    : end.gaveUp ? `You let the floor give way. ${word}.` : `They took your whole set: the floor gives way. ${word}.`);
  if (won) await cheer(word, `${end.t} moves, par ${b.par}`);
  if (!calm()) { await sleep(won ? 150 : 400); if (won && board.intoHole) await board.intoHole(); else if (board.collapse) await board.collapse(); }
  if (last) return dailyDone(true);
  session.n++;
  return between({ note: `Board ${session.n} of ${today.boards.length}`, sub: `${word} on that one: ${vsText(card(today, entry.results).vs)} so far.`, fall: true });
}

/** A player's row on the card: name, a mark a board, and the total. */
function vineRow(name, results, me = false) {
  const c = card(today, results);
  return el('tr', { class: me ? 'me' : '' }, el('td', {}, me ? el('b', {}, name) : name),
    el('td', { class: 'marks5' }, c.rows.map((r) => (r.d == null ? '·' : markOf(r.d))).join(' ')),
    el('td', {}, vsText(c.vs)));
}

/** The day's card: your score, board by board, a share, and your vine. */
function dailyDone(fresh = false) {
  const c = card(today, entry.results);
  if (fresh && !dailyTest) {
    const r = mine(); r.played = (r.played || 0) + 1; r.best = r.best == null ? c.vs : Math.min(r.best, c.vs); saveRecords();
    logSitting({ game: 'grove-chess', data: { date: ddate, daily: 5, number: today.number, vs: c.vs, strokes: c.strokes, par: c.par, results: entry.results } });
    sfx.fanfare(c.vs <= -4 ? 3 : c.vs <= 0 ? 2 : 1); haptic([30, 40, 30, 40, 60]);
  }
  show('over');
  $('#overeyebrow').textContent = `Hikari Garden daily #${today.number}`;
  $('#overbig').textContent = c.vs === 0 ? 'Even par' : `${Math.abs(c.vs)} ${c.vs < 0 ? 'under' : 'over'} par`;
  $('#overwhy').textContent = `${c.strokes} moves, par ${c.par}. ${today.name}.`;
  const table = el('table', { class: 'score' },
    el('tr', {}, el('th', {}, 'Board'), el('th', {}, 'Par'), el('th', {}, 'Moves'), el('th', {}, '')),
    ...c.rows.map((r, i) => el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, String(r.par)), el('td', {}, r.strokes == null ? '·' : String(r.strokes)),
      el('td', {}, r.d == null ? '' : `${markOf(r.d)} ${scoreWord(r.d).toLowerCase()}${r.won ? '' : ', not cleared'}`))));
  // Share: your name, then the link (the branch you came in on, then you).
  const name = el('input', { type: 'text', id: 'd5name', maxlength: 14, placeholder: 'Your name', value: myName(), 'aria-label': 'Your name' });
  const note = el('p', { class: 'small dim center' });
  const share = el('button', { class: 'primary', onclick: async () => {
    const who = cleanName(name.value);
    if (!who) { note.textContent = 'Add a name first, so your friends know whose card it is.'; name.focus(); return; }
    setMyName(who);
    const mineChunk = chunkOf(who, entry.results);
    const branch = (entry.branch ? entry.branch.split('~') : []).filter((ch) => readChunk(ch) && readChunk(ch).name !== who);
    const url = makeDailyLink(new URL('../daily/', location.href).href, ddate, [...branch, mineChunk]);
    const text = `Hikari Garden daily #${today.number}: ${today.name}\n${c.rows.map((r) => markOf(r.d)).join(' ')}  ${vsText(c.vs)} (${c.strokes} moves, par ${c.par})`;
    paintVine(who);
    if (navigator.share) {
      try { await navigator.share({ text, url }); note.textContent = 'Sent.'; return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); note.textContent = 'Copied. Paste it into your chat.'; }
    catch { note.replaceChildren('Copy this: ', el('input', { type: 'text', value: `${text} ${url}`, readonly: true })); }
  } }, 'Share your card');
  const vine = el('div', {});
  const paintVine = (who = cleanName(name.value) || 'You') => {
    const others = entry.seen.map(readChunk).filter((p) => p && p.name !== who);
    vine.replaceChildren(el('h3', { class: 'center' }, 'Your vine'),
      el('p', { class: 'small dim center' }, others.length ? 'Everyone whose card reached you today, then you.' : 'Share your card: whoever plays from your link joins your vine, and you see theirs when they send it back.'),
      el('table', { class: 'score vine5' }, ...others.map((p) => vineRow(p.name, p.results)), vineRow(who, entry.results, true)));
  };
  paintVine(myName() || 'You');
  $('#overbody').replaceChildren(table, el('div', { class: 'stack', style: 'margin-top:14px' }, name, share), note, vine,
    el('p', { class: 'small dim center' }, 'A new one tomorrow. The week climbs: Monday is gentle, Sunday is not.'));
  $('#again').textContent = 'Play Adventure';
  $('#again').onclick = () => { location.href = './?mode=adventure'; };
  $('#oversettings').hidden = true;
}

/** The title for the daily: the date, the name, the set, and how far you are. */
function dailyTitle() {
  const date = new Date(`${ddate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#modename').textContent = today ? today.name : 'The daily';
  $('#modeblurb').textContent = today
    ? `Daily #${today.number}, ${date}. Three boards of Adventure, the same for everyone today. Take every piece in as few moves as you can: par is ${card(today, []).par} across the three. About five minutes.`
    : `There is no daily made for ${date} yet.`;
  $('.partsbox').hidden = true;
  $('#opensettings').hidden = true;
  const friends = entry.seen.map(readChunk).filter(Boolean);
  $('#records').textContent = [recordsLine(), friends.length ? `On your vine: ${friends.slice(-3).map((p) => `${p.name} ${vsText(card(today, p.results).vs)}`).join(', ')}.` : ''].filter(Boolean).join(' ');
  $('#handnote').hidden = !today;
  $('#handnote').textContent = 'Today’s set. Hold a piece to see what it does.';
  if (dailyTest) {
    $('#testnote').hidden = false;
    const go = (d) => { location.hash = `d=${d}`; location.reload(); };
    $('#testnote').replaceChildren('Test: ', el('button', { class: 'quiet', onclick: () => go(shiftDate(ddate, -1)) }, 'Day before'), ' ',
      el('button', { class: 'quiet', onclick: () => go(shiftDate(ddate, 1)) }, 'Day after'), ' ',
      el('button', { class: 'quiet', onclick: () => go(todayStr()) }, 'Today'), ' ',
      el('button', { class: 'quiet', onclick: () => { delete dstore.days[ddate]; saveStore(dstore); location.reload(); } }, 'Clear this day'));
  }
}

/** A board cleared (Adventure, 2026-10-16, Timothy: "animations for ...
    completing the level"): the score word pops up over the board in a burst
    of confetti in the suits' colours, then the piece goes down the hole. */
async function cheer(word, line) {
  const box = $('#cheer'), cols = Object.values(SUITS).map((x) => x.colour).concat('#fff6d8', '#f2c14e');
  const bits = calm() ? [] : Array.from({ length: 28 }, (_, i) => {
    const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.2, r = 90 + ((i * 37) % 90);
    return el('i', { style: `--c:${cols[i % cols.length]};--x:${Math.round(Math.cos(ang) * r)}px;--y:${Math.round(Math.sin(ang) * r - 20)}px;--r:${(i * 47) % 360}deg;--d:${(i % 5) * 45}ms` });
  });
  box.replaceChildren(...bits, el('div', {}, el('div', { class: 'word' }, word), el('div', { class: 'line' }, line)));
  box.hidden = false;
  haptic([20, 40, 20, 40, 40]);
  await sleep(calm() ? 900 : 1400);
  box.hidden = true;
}

// --- Between levels: the fall, and what you find. -------------------------------

let fall = null;

async function between({ note, sub = '', rewards = false, combine = false, shop: shopping = false, fall: falling = false, board: newBoard = false, won = false, cards: rewardCards = null, rewardNote = null, rewardAuto = null, extra = [] }) {
  show('between');
  $('#betweennote').textContent = note;
  $('#betweensub').textContent = sub;
  $('#offer').hidden = true; $('#pickbox').hidden = true; $('#betweennext').hidden = true; $('#tilebox').hidden = true;
  const kinds = session.run ? session.run.hand.map((h) => ({ kind: pieceOf(h, session.run.made).type, side: lookOf(h), weapon: M.upgrades === 'par' ? h.weapon : null })) : [];
  // Adventure: the fall fills the screen (Timothy, 2026-10-16), so the
  // canvas takes the screen's shape, its short side about 240 pixels.
  const full = falling && !calm() && M.upgrades === 'par';
  $('[data-screen=between]').classList.toggle('fullfall', full);
  const cv = $('#fallcv');
  if (full) {
    const r = innerHeight / Math.max(1, innerWidth);
    [cv.width, cv.height] = r >= 1 ? [240, Math.round(240 * Math.min(r, 2.4))] : [Math.round(260 / Math.max(r, 0.4)), 260];
  } else [cv.width, cv.height] = [240, 300];
  fall = falling && !calm() && kinds.length ? startFall(cv, kinds) : null;
  cv.hidden = !fall;
  if (rewards && session.run) await reward({ k: 0, note: rewardNote, cards: rewardCards, auto: rewardAuto });
  for (const card of extra) if (session.run?.hand.some((h) => !h.rabbit)) await reward({ k: 1, note: `In your net: a ${rabbitName(card.rabbit, card.suit).toLowerCase()}, yours.`, cards: [card], auto: 'card' });
  if (shopping && session.run) await shop();
  if (newBoard && session.run) await (M.upgrades === 'tiles' ? tileStep(won) : boardUpgrade());
  if (combine && session.run && session.claimed?.length) await combineStep();
  const t0 = performance.now();
  const slow = setTimeout(() => { $('#betweensub').textContent = 'Finding the next one…'; }, 1500);
  const found = await find(session.n);
  clearTimeout(slow);
  if (fall) {
    await sleep(Math.max(0, 1200 - (performance.now() - t0)));
    const next = makeLevel(found.settings, found.seed);
    await fall.land(next, initialState(next));
    fall.stop(); fall = null;
  } else {
    $('#betweennext').hidden = false;
    await new Promise((res) => { $('#nextlevel').onclick = res; });
  }
  startLevel();
}

/** A suit or weapon card's name with its mark: "♥ Hearts". */
const cardName = (c) => (c.kind === 'suit' ? `${SUITS[c.suit].mark} ${SUITS[c.suit].name}` : c.kind === 'rabbit' ? rabbitName(c.rabbit, c.suit) : `${WEAPONS[c.weapon].mark} ${WEAPONS[c.weapon].name}`);

/** Offer the rewards for a finished level; resolves once one is taken. */
function reward({ k = 0, note = null, cards: given = null, room = false, auto = false } = {}) {
  const fairy = M.run !== 'descent' || session.n >= M.fairyFrom;
  const run = session.run, cards = (given || rewardsFor(run, rng(`reward:${session.seed}:${session.n}${k ? ':' + k : ''}`), catalog.vetoed, fairy))
    .filter((c) => c.kind !== 'joker' || M.jokers)
    // (Adventure's pieces to find are its own, the troupe, 2026-10-17.)
    .filter((c) => (c.kind !== 'piece' && c.kind !== 'merge') || (M.upgrades === 'par' && c.kind === 'piece') || M.findPool.includes(c.type));
  if (!cards.length) return Promise.resolve();
  const box = $('#offer');
  $('[data-screen=between]').classList.add('offering');
  return new Promise((resolve) => {
    const done = () => { box.hidden = true; $('#pickbox').hidden = true; $('[data-screen=between]').classList.remove('offering'); session.found.clear(); resolve(); };
    // The card taking hold, on the way down (Adventure, 2026-10-16): the
    // piece spins into its suit, or its weapon drops into its hand.
    const takeHold = (card, i) => {
      if (!fall || M.upgrades !== 'par' || i == null || !run.hand[i]) return;
      if (card.kind === 'suit') { fall.restyle(i, lookOf(run.hand[i]), SUITS[card.suit].colour); sfx.transform(0.35); }
      if (card.kind === 'weapon') { fall.arm(i, run.hand[i].weapon, WEAPONS[card.weapon].colour); sfx.equip(0.6); }
      if (card.kind === 'rabbit') { fall.restyle(i, lookOf(run.hand[i]), RABBITS[card.rabbit].colour); sfx.transform(0.35); }
    };
    const choose = (card) => {
      haptic(14); sfx.gain();
      box.hidden = true;
      const need = card.kind === 'fuse' ? 2 : card.kind === 'suit' || card.kind === 'weapon' || card.kind === 'promote' || card.kind === 'merge' || card.kind === 'rabbit' ? 1 : 0;
      if (!need) { applyReward(run, card, [], catalog.vetoed); if (card.kind === 'piece') { fall?.add(card.type); addToRoster(card.type); } return done(); }
      // Pick the piece (or two) it is for.
      const picked = [];
      $('#pickbox').hidden = false;
      $('#picktext').textContent = card.kind === 'fuse' ? 'Choose two pieces to fuse into one.' : card.kind === 'promote' ? 'Choose a piece to promote.'
        : card.kind === 'merge' ? `Choose a piece of yours for the ${PIECES[card.type].name}.`
        : card.kind === 'rabbit' ? `Choose a piece to put the ${rabbitName(card.rabbit, card.suit).toLowerCase()} in (one with no rabbit yet).`
        : card.kind === 'weapon' ? `Choose a piece to give the ${WEAPONS[card.weapon].name.toLowerCase()} to${card.weapon === 'lance' ? ' (one that slides)' : ''}.` : `Choose a piece to give ${SUITS[card.suit].name} to.`;
      // A piece card can also take a gap in the row, if a piece was lost.
      const gap = card.kind === 'merge' && room ? el('button', { class: 'quiet', onclick: () => { gap.remove(); applyMerge(run, -1, card.type); fall?.add(card.type); done(); } }, `Put the ${PIECES[card.type].name} in the gap in your row`) : null;
      if (gap) $('#pickdone').after(gap);
      const paint = () => {
        handRow($('#pickhand'), { picked, pick: (i) => {
          const h = run.hand[i];
          if (card.kind === 'suit' && h.suit) return;
          if (card.kind === 'rabbit' && h.rabbit) return;
          if (card.kind === 'weapon' && !canTakeWeapon(h, card.weapon, run.made)) return;
          if (card.kind === 'merge' && !mergeTargets(run.hand, card.type, M.royal, run.made).includes(i)) return;
          if ((card.kind === 'fuse' || card.kind === 'promote') && (kingLocked(h) || (card.kind === 'fuse' && h.base === 'bunny'))) return;
          const at = picked.indexOf(i);
          if (at >= 0) picked.splice(at, 1); else { picked.push(i); if (picked.length > need) picked.shift(); }
          paint();
        } });
        $('#pickdone').disabled = picked.length !== need;
        if (card.kind === 'merge') $('#picktext').textContent = picked.length ? combineText(run.hand[picked[0]], card.type, run.made, 'the') : `Choose a piece of yours for the ${PIECES[card.type].name}.`;
      };
      paint();
      $('#pickdone').onclick = () => { gap?.remove(); if (card.kind === 'merge') applyMerge(run, picked[0], card.type); else { applyReward(run, card, picked, catalog.vetoed); takeHold(card, picked[0]); } done(); };
    };
    // A tile turned over (Tile Chess), or a bogey in Adventure: its one
    // card, straight to choosing the piece for it.
    if (auto === true && cards.length === 1) { $('#betweensub').textContent = note || ''; return choose(cards[0]); }
    if (auto === 'card' && cards.length === 1) { $('#betweensub').textContent = `${$('#betweensub').textContent} ${note || ''} The card: ${cardName(cards[0])}.`.trim(); return choose(cards[0]); }
    // Worse than a bogey (Adventure): the one card goes to a piece chosen by
    // chance, with nothing to choose.
    if (auto === 'all' && cards.length === 1 && cards[0].kind === 'piece') {
      const card = cards[0];
      applyReward(run, card, [], catalog.vetoed); fall?.add(card.type); addToRoster(card.type);
      haptic(14); sfx.gain();
      $('#betweensub').textContent = `${$('#betweensub').textContent} ${note || ''} A ${PIECES[card.type].name.toLowerCase()} joins your deck.`.trim();
      return sleep(2200).then(done);
    }
    if (auto === 'all' && cards.length === 1) {
      const card = cards[0], fits = run.hand.map((h, i) => i).filter((i) => (card.kind === 'suit' ? !run.hand[i].suit : card.kind === 'rabbit' ? !run.hand[i].rabbit : canTakeWeapon(run.hand[i], card.weapon, run.made)));
      if (!fits.length) return done();
      const i = fits[Math.floor(rng(`luck:${session.seed}:${session.n}`)() * fits.length)], who = pieceOf(run.hand[i], run.made).name.toLowerCase();
      applyReward(run, card, [i], catalog.vetoed);
      takeHold(card, i);
      haptic(14); sfx.gain();
      $('#betweensub').textContent = `${$('#betweensub').textContent} ${note || ''} ${cardName(card)} goes to your ${who}.`.trim();
      return sleep(2200).then(done);
    }
    const head = note || (given ? 'A keepsake, from the waystones. Take one.' : run.hand.length < run.maxPieces ? 'Something is down here with you. Take one of them.' : 'Your hand is full. Take an upgrade.');
    // Adventure: a card is its icon and its name, nothing more (Timothy,
    // 2026-10-16: "we don't need descriptions for the upgrades"), drawn as
    // a playing card ("suits upgrades should be presented as cards with the
    // suit on them"): the suit's pip in its corners and large in the middle;
    // a weapon's or a rabbit's the same way. Its words are kept for a hold
    // or the mouse resting on it (title).
    const pcard = (c, i) => {
      const colour = c.kind === 'suit' ? SUITS[c.suit].colour : c.kind === 'rabbit' ? RABBITS[c.rabbit].colour : c.kind === 'piece' ? '#5d8a4a' : WEAPON_INK[c.weapon] || '#a9d98b';
      const pip = (size, cls) => {
        if (c.kind === 'suit') return suitIcon(c.suit, colour, size, cls);
        if (c.kind === 'rabbit') return rabbitIcon(colour, size, cls);
        // A piece to find (2026-10-17): the piece itself.
        if (c.kind === 'piece') {
          const cv = el('canvas', { class: `pix ${cls}`, width: 30, height: 36, style: `width:${Math.round(size * 0.84)}px;height:${size}px;image-rendering:pixelated` });
          cv.getContext('2d').drawImage(sprite(c.type, 'you'), 0, 0);
          return cv;
        }
        return weaponIcon(c.weapon, size, cls);
      };
      const name = c.kind === 'suit' ? SUITS[c.suit].name : c.kind === 'rabbit' ? rabbitName(c.rabbit, c.suit) : c.kind === 'piece' ? PIECES[c.type].name : WEAPONS[c.weapon]?.name || cardText(c).title;
      return el('button', { class: `pcard ${c.kind}`, style: `--pc:${colour};--i:${i}`, title: cardText(c, true).text, 'aria-label': name, onclick: () => choose(c) },
        el('span', { class: 'corner tl' }, pip(15, 'pip')),
        el('span', { class: 'face' }, pip(52, 'pip'), c.kind === 'rabbit' && SUITS[c.suit] ? suitIcon(c.suit, SUITS[c.suit].colour, 22, 'pip suitof') : null),
        el('span', { class: 'pname' }, name),
        el('span', { class: 'corner br' }, pip(15, 'pip')));
    };
    if (M.upgrades === 'par') {
      box.replaceChildren(el('p', { class: 'center' }, head), el('div', { class: 'cardrow' }, ...cards.map(pcard)),
        el('div', { class: 'stack', style: 'margin-top:10px' }, el('button', { class: 'quiet', onclick: done }, 'Take nothing')));
      box.hidden = false;
      return;
    }
    box.replaceChildren(el('p', { class: 'center' }, head),
      ...cards.map((c) => {
        const t = boardCardText(c, M.upgrades === 'par'), cv = el('canvas', { class: 'model', width: 30, height: 36 });
        if (c.kind === 'piece' || c.kind === 'merge') cv.getContext('2d').drawImage(sprite(c.type, 'you'), 0, 0);
        return el('button', { class: 'offercard', onclick: () => choose(c) },
          el('div', {}, c.kind === 'piece' || c.kind === 'merge' ? cv : el('div', { style: `font-size:40px;text-align:center;color:${c.suit ? SUITS[c.suit].colour : c.weapon ? WEAPONS[c.weapon].colour : 'var(--accent)'}` }, c.suit ? SUITS[c.suit].mark : c.weapon ? WEAPONS[c.weapon].mark : c.kind === 'fuse' ? '✦' : c.kind === 'promote' ? '▲' : '❀')),
          el('div', {}, el('span', { class: 'tag' }, t.tag), el('h3', {}, t.title), el('p', {}, t.text)));
      }),
      el('button', { class: 'quiet', onclick: done }, 'Take nothing'));
    box.hidden = false;
  });
}

/** A new board, one upgrade a board (2026-10-12): from depth `growAt` the
    board opens to seven by seven and each side gets two more pieces; then
    they get an upgrade at random, said before you choose, and you choose
    one of two. */
async function boardUpgrade() {
  const run = session.run, rand = rng(`board:${session.seed}:${session.n}`), fairy = session.n >= M.fairyFrom;
  const width = M.growAt > 0 && session.n >= M.growAt ? 7 : M.w, lines = [];
  if (M.growAt > 0 && session.n === M.growAt) {
    const pick = (a) => a[Math.floor(rand() * a.length)];
    // Two minor pieces, different ones: a knight, a bishop or a rook.
    const ours = ['knight', 'bishop', 'rook'].filter((k) => !catalog.vetoed.includes(k));
    const theirs = M.foePool.filter((k) => k !== 'king' && !catalog.vetoed.includes(k));
    const got = [];
    // One at each end of the line, so a King in the middle of five stays in
    // the middle of seven.
    const add = (list, h, i) => (i % 2 ? list.push(h) : list.unshift(h));
    // (The first row only: a row of pawns in front does not count.)
    const back = (list) => list.filter((h) => h.row !== 1).length;
    for (let i = 0; i < 2 && back(run.hand) < Math.max(run.maxPieces, width); i++) {
      const left = ours.filter((k) => !got.includes(PIECES[k].name.toLowerCase())), t = pick(left.length ? left : ['knight']);
      add(run.hand, { base: t }, i); got.push(PIECES[t].name.toLowerCase()); fall?.add(t);
    }
    for (let i = 0; i < 2 && back(run.foes) < width; i++) add(run.foes, { base: pick(theirs.length ? theirs : ['pawn']) }, i);
    // With a row of pawns, two more pawns to fill it out.
    if (M.pawnRow) for (const list of [run.hand, run.foes]) list.push({ base: 'pawn', row: 1 }, { base: 'pawn', row: 1 });
    sfx.fanfare(2); haptic([30, 40, 30]);
    lines.push(`The board opens to seven by seven.${got.length ? ` A ${got.join(' and a ')} join you, and two more join them.` : ''}`);
  }
  const theirs = foeUpgrade(run, rand);
  if (theirs) lines.push(`Their side: ${theirs}.`);
  $('#betweensub').textContent = [$('#betweensub').textContent, ...lines].filter(Boolean).join(' ');
  const room = run.hand.length < Math.min(width, run.maxPieces);
  const cards = boardCards(run, rand);
  if (cards.length) await reward({ cards, note: 'A new board. Choose a suit or a weapon.', room });
  session.found.clear();
}

/** Tile Chess (2026-10-14): after a round each side turns over one tile
    at the edge of the board, the winner first. The board grows by that
    square and the suit or weapon on it goes to the side that turned it.
    When the board reaches as many squares as the next size up, both sides
    get the same new piece. */
async function tileStep(won) {
  const run = session.run, t = run.tiles, rand = rng(`tiles:${session.seed}:${session.n}`);
  const before = tier(t.open.length), lines = [];
  fillOffers(t, rand);
  const canYou = (card) => card && (card.kind === 'suit' ? run.hand.some((h) => !h.suit) : run.hand.some((h) => canTakeWeapon(h, card.weapon, run.made)));
  for (const who of won ? ['you', 'foe'] : ['foe', 'you']) {
    if (!Object.keys(t.offers).length) break;
    if (who === 'foe') {
      const k = foePick(t, (c) => foeCanUse(run, c), rand), card = flip(t, k);
      const said = foeTake(run, card, rand);
      lines.push(`They turn over a tile${said ? `: ${said}` : ', but none of their pieces can take what is on it'}.`);
      paintTiles({ last: k, note: lines.join(' ') });
      sfx.gain(); await sleep(1300);
    } else {
      const k = await pickTile(lines.join(' '));
      const card = flip(t, k);
      paintTiles({ last: k, note: '' });
      sfx.gain(); haptic(14);
      const name = card.kind === 'suit' ? `${SUITS[card.suit].mark} ${SUITS[card.suit].name}` : `${WEAPONS[card.weapon].mark} ${WEAPONS[card.weapon].name}`;
      if (canYou(card)) await reward({ cards: [card], note: `You turned over ${name}. Choose the piece it goes to.`, auto: true });
      else { lines.push(`You turned over ${name}, but none of your pieces can take it.`); await sleep(900); }
    }
    fillOffers(t, rand);
  }
  // A size up: the same new piece for each side.
  const after = tier(t.open.length);
  if (after > before) {
    const pool = ['knight', 'bishop', 'rook'].filter((k) => !catalog.vetoed.includes(k));
    const type = (pool.length ? pool : ['knight'])[Math.floor(rand() * (pool.length || 1))];
    run.hand.push({ base: type }); run.foes.push({ base: type });
    const [w, h] = SIZES[after];
    sfx.fanfare(2); haptic([30, 40, 30]);
    lines.push(`The board is as big as ${w} by ${h} now: a ${PIECES[type].name.toLowerCase()} joins each side.`);
  }
  $('#tilebox').hidden = true;
  $('#betweensub').textContent = lines.join(' ');
  session.found.clear();
}

/** The board as it stands, for choosing a tile: open squares, and round
    them the tiles that could be turned over, each with its upgrade.
    `pick(k)`, if given, is called with the tile tapped. */
function paintTiles({ pick = null, last = null, note = '' } = {}) {
  const t = session.run.tiles, box = $('#tilebox'), { x0, y0, x1, y1 } = bounds(t, 1);
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1, open = new Set(t.open);
  const size = Math.max(22, Math.min(44, Math.floor(340 / Math.max(cols, rows))));
  const grid = el('div', { class: 'tilegrid', style: `grid-template-columns: repeat(${cols}, ${size}px); grid-auto-rows: ${size}px` });
  for (let y = y1; y >= y0; y--) for (let x = x0; x <= x1; x++) {
    const k = tileKey(x, y), card = t.offers[k];
    if (open.has(k)) grid.append(el('div', { class: `tile open${(x + y) % 2 ? ' dark' : ''}${k === last ? ' last' : ''}` }));
    else if (card) {
      const mark = card.kind === 'suit' ? SUITS[card.suit].mark : WEAPONS[card.weapon].mark, colour = card.kind === 'suit' ? SUITS[card.suit].colour : WEAPONS[card.weapon].colour;
      const name = card.kind === 'suit' ? SUITS[card.suit].name : WEAPONS[card.weapon].name;
      grid.append(pick ? el('button', { class: 'tile offer', title: name, 'aria-label': `Turn over: ${name}`, style: `color:${colour}`, onclick: () => pick(k) }, mark)
        : el('div', { class: 'tile offer', title: name, style: `color:${colour}` }, mark));
    } else grid.append(el('div', { class: 'tile none' }));
  }
  box.replaceChildren(el('p', { class: 'center' }, note || (pick ? 'Turn over a tile at the edge of the board: the board grows by that square, and what is on it is yours.' : '')), grid,
    el('p', { class: 'center dim small' }, `${t.open.length} squares. ${tier(t.open.length) + 1 < SIZES.length ? `A new piece each at ${SIZES[tier(t.open.length) + 1][0] * SIZES[tier(t.open.length) + 1][1]}.` : ''}`));
  box.hidden = false;
}

/** Wait for you to tap a tile; resolves with its key. */
function pickTile(note) {
  return new Promise((resolve) => paintTiles({ note: note ? `${note} Your turn: tap a tile to turn it over.` : '', pick: (k) => resolve(k) }));
}

/** Combine one claimed piece of theirs with one of yours, or neither. */
function combineStep() {
  const run = session.run, box = $('#offer');
  const claimed = [...new Set(session.claimed)].filter((t) => run.hand.some((h) => canCombine(h, t, M.royal)));
  if (!claimed.length) return Promise.resolve();
  $('[data-screen=between]').classList.add('offering');
  return new Promise((resolve) => {
    const done = () => { box.hidden = true; $('#pickbox').hidden = true; $('[data-screen=between]').classList.remove('offering'); session.found.clear(); resolve(); };
    box.replaceChildren(el('p', { class: 'center' }, 'You claimed these. Combine one with a piece of yours: the same kind makes a veteran with a heart more; another kind fuses into one with both their moves.'),
      ...claimed.map((type) => {
        const cv = el('canvas', { class: 'model', width: 30, height: 36 });
        cv.getContext('2d').drawImage(sprite(type, 'foe'), 0, 0);
        return el('button', { class: 'offercard', onclick: () => {
          haptic(12);
          box.hidden = true;
          $('#pickbox').hidden = false;
          let picked = null;
          const paint = () => {
            $('#picktext').textContent = picked == null ? `Choose a piece of yours for their ${PIECES[type].name}.` : combineText(run.hand[picked], type, run.made);
            handRow($('#pickhand'), { picked: picked == null ? [] : [picked], pick: (i) => { if (!canCombine(run.hand[i], type, M.royal)) return; picked = i; paint(); } });
            $('#pickdone').disabled = picked == null;
          };
          paint();
          $('#pickdone').onclick = () => { sfx.gain(); applyCombine(run, picked, type); done(); };
        } }, el('div', {}, cv), el('div', {}, el('span', { class: 'tag' }, 'Claimed'), el('h3', {}, `Their ${PIECES[type].name}`), el('p', {}, PIECES[type].desc)));
      }),
      el('button', { class: 'quiet', onclick: done }, 'Keep my pieces as they are'));
    box.hidden = false;
  });
}

/** Pick the piece (or two) a card is for, then apply it. */
function pickFor(card, run) {
  const need = card.kind === 'fuse' ? 2 : card.kind === 'suit' || card.kind === 'promote' ? 1 : 0;
  if (!need) { applyReward(run, card, [], catalog.vetoed); return Promise.resolve(true); }
  return new Promise((resolve) => {
    const picked = [];
    $('#pickbox').hidden = false;
    $('#picktext').textContent = card.kind === 'fuse' ? 'Choose two pieces to fuse into one.' : card.kind === 'promote' ? 'Choose a piece to promote.' : `Choose a piece to give ${SUITS[card.suit].name} to.`;
    const paint = () => {
      handRow($('#pickhand'), { picked, pick: (i) => {
        if (card.kind === 'suit' && run.hand[i].suit) return;
        if ((card.kind === 'fuse' || card.kind === 'promote') && (kingLocked(run.hand[i]) || (card.kind === 'fuse' && run.hand[i].base === 'bunny'))) return;
        const at = picked.indexOf(i);
        if (at >= 0) picked.splice(at, 1); else { picked.push(i); if (picked.length > need) picked.shift(); }
        paint();
      } });
      $('#pickdone').disabled = picked.length !== need;
    };
    paint();
    $('#pickdone').onclick = () => { applyReward(run, card, picked, catalog.vetoed); $('#pickbox').hidden = true; resolve(true); };
  });
}

/** The autochess shop: acorns for pieces and upgrades, until Done. */
function shop() {
  const run = session.run, box = $('#offer');
  let roll = 0, stock = null;
  const restock = () => { stock = shopStock(run, rng(`shop:${session.seed}:${session.n}:${roll}`), { veto: catalog.vetoed, findPool: M.findPool, jokers: M.jokers }); };
  restock();
  $('[data-screen=between]').classList.add('offering');
  return new Promise((resolve) => {
    const paint = () => {
      box.hidden = false;
      const full = run.hand.length >= run.maxPieces;
      box.replaceChildren(
        el('p', { class: 'center' }, el('b', {}, `${session.acorns} acorn${session.acorns === 1 ? '' : 's'}`), ' to spend. What you do not spend is kept for later rounds.'),
        el('div', { class: 'handrow', id: 'shophand' }),
        ...stock.map((c, i) => {
          const t = cardText(c), price = priceOf(c), cv = el('canvas', { class: 'model', width: 30, height: 36 });
          if (c.kind === 'piece') cv.getContext('2d').drawImage(sprite(c.type, 'you'), 0, 0);
          const cant = price > session.acorns || (c.kind === 'piece' && full);
          return el('button', { class: 'offercard', disabled: cant, style: cant ? 'opacity:.5' : '', onclick: async () => {
            if (cant) return;
            haptic(14); sfx.gain();
            session.acorns -= price;
            stock.splice(i, 1);
            box.hidden = true;
            await pickFor(c, run);
            paint();
          } },
          el('div', {}, c.kind === 'piece' ? cv : el('div', { style: `font-size:40px;text-align:center;color:${c.suit ? SUITS[c.suit].colour : 'var(--accent)'}` }, c.suit ? SUITS[c.suit].mark : c.kind === 'fuse' ? '✦' : c.kind === 'promote' ? '▲' : '❀'),
            el('p', { class: 'center small', style: 'margin:6px 0 0' }, `${price} acorns`)),
          el('div', {}, el('span', { class: 'tag' }, t.tag), el('h3', {}, t.title), el('p', {}, t.text.replace(' Choose a piece to give it to.', ''))));
        }),
        el('div', { class: 'row' },
          el('button', { class: 'quiet', disabled: session.acorns < 1, onclick: () => { if (session.acorns < 1) return; session.acorns--; roll++; restock(); paint(); } }, 'New stock (1 acorn)'),
          el('button', { class: 'primary', onclick: () => { box.hidden = true; $('[data-screen=between]').classList.remove('offering'); session.found.clear(); resolve(); } }, 'Done')));
      handRow($('#shophand'));
    };
    paint();
  });
}

// --- Endings. -------------------------------------------------------------------

function singleOver(end) {
  const r = mine(); r.played++; if (end.won) r.won = (r.won || 0) + 1; saveRecords();
  show('over');
  const V = VARIANTS[level.variant];
  $('#overeyebrow').textContent = V ? V.name : MODE.name;
  const kingTaken = end.pieces.some((p) => p.taken && p.type === 'king');
  $('#overbig').textContent = end.won ? (end.sunk ? `Sunk in ${end.t}` : `Won in ${end.t}`) : outcome(end) === 'dusk' ? 'Out of moves'
    : kingTaken ? 'They took your King' : V && (level.rules.hill || level.rules.race) ? 'Their King got there first' : 'They took everything';
  $('#overwhy').textContent = par ? `Par ${par}.` : '';
  const lines = V ? [V.history, ...differs(V)] : level.position ? [`A layout from the piece trials. Its position, in FEN (theirs on top, capitals yours): ${level.position}.`]
    : [summary(level.settings), ...describeMeasure(measured)];
  $('#overbody').replaceChildren(...lines.map((t) => el('p', { class: 'small dim' }, t)));
  $('#again').textContent = V || level.position ? 'Play it again' : 'Another level';
}

/** Chess variants: pick one on the title. */
function variantList() {
  const box = $('#variants');
  box.replaceChildren();
  box.hidden = !(MODE === MODES.variants || (M.variant && M.variant !== 'none'));
  if (box.hidden) return;
  for (const id of VARIANT_ORDER) {
    const V = VARIANTS[id], on = M.variant === id;
    box.append(el('button', { class: `coursecard${on ? ' on' : ''}`, 'aria-pressed': String(on),
      onclick: () => { M = cleanMode({ ...M, variant: id }); if (!test) saveModeSettings(modeId, M); haptic(10); prepareTitle(); } },
    el('b', {}, `${V.name} · ${V.size}`), el('span', { class: 'small dim' }, V.blurb)));
  }
}

function courseOver() {
  const total = session.strokes.reduce((a, s) => a + s.strokes, 0), totalPar = session.strokes.reduce((a, s) => a + (s.par || s.strokes), 0);
  const r = mine(); r.played++; const vs = total - totalPar; if (r.best == null || vs < r.best) r.best = vs;
  // A named course keeps its own best, and finishing it opens the next.
  const C = COURSES[M.courseName];
  let opened = null;
  if (C && !test) {
    const next = COURSE_ORDER[COURSE_ORDER.indexOf(M.courseName) + 1];
    const was = next && courseOpen(next);
    const c = courseRec(M.courseName); c.played++; if (c.best == null || vs < c.best) c.best = vs;
    if (next && !was) opened = COURSES[next];
  }
  saveRecords();
  show('over');
  $('#overeyebrow').textContent = C ? C.name : 'The course';
  $('#overbig').textContent = `${total} strokes`;
  $('#overwhy').textContent = `${vs > 0 ? '+' : ''}${vs} against par ${totalPar}.`;
  $('#overbody').replaceChildren(el('table', { class: 'score' },
    el('tr', {}, el('th', {}, 'Hole'), el('th', {}, 'Par'), el('th', {}, 'Strokes'), el('th', {}, ''), el('th', {}, 'Tries')),
    ...session.strokes.map((s) => el('tr', {}, el('td', {}, String(s.hole)), el('td', {}, String(s.par ?? '-')), el('td', {}, String(s.strokes)),
      el('td', {}, !s.sunk ? 'picked up' : s.par ? golf(s.strokes - s.par) : ''), el('td', {}, String(s.tries || 1))))));
  if (opened) { sfx.fanfare(3); haptic([30, 40, 60]); $('#overbody').append(el('p', { class: 'center' }, el('b', {}, `${opened.name} is open.`), ' ', opened.blurb)); }
  $('#again').textContent = 'Play the course again';
}

function golf(d) { return d <= -3 ? 'albatross' : ({ '-2': 'eagle', '-1': 'birdie', 0: 'par', 1: 'bogey', 2: 'double bogey' })[d] ?? `+${d}`; }

function runOver(why) {
  const r = mine(); r.played++;
  if (M.run === 'rounds') r.best = Math.max(r.best || 0, session.wins);
  if (M.run === 'descent') r.best = Math.max(r.best || 0, session.n);
  saveRecords();
  show('over');
  $('#overeyebrow').textContent = M.run === 'descent' ? 'The descent ends' : 'The run ends';
  $('#overbig').textContent = M.run === 'descent' ? `Depth ${session.n}` : `${session.wins} round${session.wins === 1 ? '' : 's'} won`;
  $('#overwhy').textContent = why;
  const body = [el('p', { class: 'center' }, recordsLine())];
  if (session.run.lost.length) body.push(el('p', { class: 'small dim center' }, `Lost on the way: ${session.run.lost.map((h) => pieceOf(h, session.run.made).name).join(', ')}.`));
  if (session.run.jokers.length) body.push(el('p', { class: 'small dim center' }, `Jokers: ${session.run.jokers.map((j) => JOKERS[j].name).join(', ')}.`));
  if (session.caught.length) body.push(el('p', { class: 'small dim center' }, `Rabbits caught: ${session.caught.length}.`));
  $('#overbody').replaceChildren(...body);
  $('#again').textContent = M.run === 'descent' ? 'Descend again' : 'Again';
}

// --- The title, and settings. ---------------------------------------------------

const pv = $('#preview'), pitch = 0.62, pscale = 2;
let pmesh = null, pframe = null, ptarget = null, pyaw = 0.6, plast = 0;

function previewFrame(ts) {
  if (!$('[data-screen=title]').hidden && pmesh) {
    pyaw += plast ? Math.min(0.05, (ts - plast) / 1000) * 0.4 : 0;
    render(ptarget, pmesh, { yaw: pyaw, pitch, scale: pscale, cx: pv.width / 2, cy: pframe.cy });
    pv.getContext('2d').putImageData(ptarget.img, 0, 0);
  }
  plast = ts;
  requestAnimationFrame(previewFrame);
}

async function prepareTitle() {
  kf?.stop(); kf = null;
  newSession();
  show('title');
  $('#modename').textContent = MODE.name;
  $('#modeblurb').textContent = MODE.blurb;
  $('#modeparts').replaceChildren(partsList(describe(M)));
  $('#records').textContent = recordsLine();
  $('#testnote').hidden = !test;
  if (test) $('#testnote').textContent = 'Settings from Chaos: a test run. Nothing is kept.';
  if (daily) dailyTitle();
  if (daily && !today) { $('#titlehand').replaceChildren(); $('#catpick').hidden = true; $('#begin').disabled = true; $('#begin').textContent = 'No daily today'; return; }
  titleHand();
  catPicker();
  waystoneList();
  courseList();
  variantList();
  await previewFirst();
}

let previewTicket = 0;
/** Find the first level and turn it on the title. Again after a swap. */
async function previewFirst() {
  $('#begin').disabled = true; $('#begin').textContent = 'Finding the first level…';
  const ticket = ++previewTicket;
  const f = await find(daily ? session.n : 1);
  if (ticket !== previewTicket) return; // a newer hand asked since
  const first = makeLevel(f.settings, f.seed);
  pframe = sceneFrame(first, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  crispWidth(pv, Math.min(440, pv.parentElement?.clientWidth || 440));
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(first, initialState(first), furOf);
  $('#begin').disabled = false;
  $('#begin').textContent = { descent: 'Descend', course: 'Tee off', rounds: 'Begin', single: 'Play' }[M.run];
  if (daily) $('#begin').textContent = entry.done ? 'See your card' : entry.results.length || entry.moves.length ? `Carry on: board ${session.n} of ${today.boards.length}` : 'Play today\u2019s three';
}

/** The hand on the title. With carrying on, tap a piece to swap it for any
    piece you have found. */
let swapping = null;
function titleHand() {
  const box = $('#titlechoices');
  box.replaceChildren(); box.hidden = true;
  if (!carries()) { handRow($('#titlehand')); $('#handnote').hidden = true; return; }
  const choices = startChoices(M.startPool, roster.found, catalog.vetoed);
  $('#handnote').hidden = false;
  $('#handnote').textContent = roster.found.length ? `Tap a piece to swap it. Your roster: ${choices.length} pieces.` : 'Pieces you find on the way down join your roster, to start with next time.';
  if (!roster.found.length) { handRow($('#titlehand')); return; }
  handRow($('#titlehand'), { picked: swapping == null ? [] : [swapping], pick: (i) => {
    if (kingLocked(session.run.hand[i])) { $('#handnote').textContent = 'Your King stays: it is the piece you protect.'; return; }
    swapping = swapping === i ? null : i;
    titleHand();
    if (swapping == null) return;
    box.hidden = false;
    for (const type of choices) {
      const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
      cv.getContext('2d').drawImage(sprite(type, 'you'), 0, 0);
      box.append(el('button', { class: 'handcell', onclick: () => {
        session.run.hand[swapping] = { base: type };
        swapping = null; haptic(10);
        titleHand(); previewFirst();
      } }, cv, el('span', {}, PIECES[type].name)));
    }
  } });
}

/** Your cat's look, Adventure only: a feature at a time, kept on this
    device. Only the model changes; the cat moves as a king whatever it wears. */
const CAT_WORD = { ears: 'Ears', tail: 'Tail', whiskers: 'Face', coat: 'Coat' };
function catPicker() {
  const box = $('#catpick');
  box.hidden = M.upgrades !== 'par';
  if (box.hidden) return;
  const look = catLook();
  const big = snapshot(model('cat', lookOf(null)), { w: 90, h: 108, cx: 45, cy: 94, scale: 6 });
  $('#catcv').getContext('2d').clearRect(0, 0, 90, 108);
  $('#catcv').getContext('2d').drawImage(big, 0, 0);
  $('#catopts').replaceChildren(...Object.entries(CAT_OPTIONS).map(([part, opts]) =>
    el('div', { class: 'catrow' }, el('b', {}, CAT_WORD[part]), ...opts.map(([id, word]) =>
      el('button', { class: look[part] === id ? 'on' : '', 'aria-pressed': String(look[part] === id), onclick: () => {
        setCatLook({ ...catLook(), [part]: id });
        try { localStorage.setItem(CATLOOK, JSON.stringify(catLook())); } catch { /* blocked */ }
        haptic(8);
        catPicker(); titleHand();
      } }, word)))));
}

/** The waystones, lit and not yet. */
function waystoneList() {
  const box = $('#waystones');
  box.replaceChildren();
  box.hidden = !carries();
  if (box.hidden) return;
  for (const w of WAYSTONES) {
    const lit = deepest() >= w.depth, idle = w.id.startsWith('keepsake') && !M.keepsakes;
    box.append(el('div', { class: `waystone${lit ? ' lit' : ''}` }, el('span', { class: 'stone', 'aria-hidden': 'true' }, lit ? '◆' : '◇'),
      el('span', {}, el('b', {}, `Depth ${w.depth}: ${w.name}. `), lit ? w.text : `Reach depth ${w.depth} to light it.`,
        idle ? ' (Off in this mode\u2019s settings: "Waystones give upgrades at the start".)' : '')));
  }
}

/** Adventure: the piece you start with (Timothy, 2026-10-15: "you start
    with either a rook, bishop, or knight"). */
/** Golf: the courses, open ones pressable. */
function courseList() {
  const box = $('#courses');
  box.replaceChildren();
  box.hidden = M.run !== 'course';
  if (box.hidden) return;
  COURSE_ORDER.forEach((id, k) => {
    const C = COURSES[id], open = courseOpen(id) || test, c = records.golf?.courses?.[id];
    const line = !open ? `Finish ${COURSES[COURSE_ORDER[k - 1]].name} to open it.` : c?.played ? `Best ${c.best > 0 ? '+' : ''}${c.best}. ${C.holes} holes.` : C.blurb;
    box.append(el('button', { class: `coursecard${M.courseName === id ? ' on' : ''}`, disabled: !open, 'aria-pressed': String(M.courseName === id),
      onclick: () => { if (!open) return; M = cleanMode({ ...M, courseName: id }); if (!test) saveModeSettings(modeId, M); haptic(10); prepareTitle(); } },
    el('b', {}, open ? C.name : `${C.name} (shut)`), el('span', { class: 'small dim' }, line)));
  });
}

let formBuilt = false, updateForm = null;
function openSettings() {
  show('settings');
  $('#settingstitle').textContent = `${MODE.name}: settings`;
  if (!formBuilt) {
    formBuilt = true;
    updateForm = buildForm($('#form'), PANEL, () => M, (k, v) => { M = cleanMode({ ...M, [k]: v }); if (!test) saveModeSettings(modeId, M); updateForm(); },
      (g) => g === 'Format' || g === 'Difficulty', { show: settingShown, note: settingNote, line: partLine });
  } else updateForm();
}

$('#opensettings').onclick = openSettings;
$('#oversettings').onclick = openSettings;
$('#closesettings').onclick = () => prepareTitle();
$('#resetsettings').onclick = () => { resetModeSettings(modeId); M = modeSettings(modeId); updateForm?.(); };
$('#begin').onclick = async () => {
  haptic(12);
  if (daily && entry.done) return dailyDone(false);
  // Keepsakes from the waystones: upgrades of your choice before the first level.
  const n = carries() && M.keepsakes ? litWaystones(deepest()).filter((w) => w.id.startsWith('keepsake')).length : 0;
  if (n && session.run) {
    show('between');
    $('#betweennote').textContent = 'The waystones';
    $('#betweensub').textContent = n > 1 ? 'Two keepsakes for this descent.' : 'A keepsake for this descent.';
    $('#fallcv').hidden = true; $('#betweennext').hidden = true;
    for (let k = 0; k < n; k++) await reward({ cards: keepsakeCards(session.run, rng(`keep:${session.seed}:${k}`), catalog.vetoed, M.jokers) });
    session.found.clear();
  }
  startLevel();
};
$('#again').onclick = () => { if (M.run === 'single') { session.n++; return startLevel(); } prepareTitle(); };
$('#titlepieces').onclick = async () => {
  const f = await find(1), L = makeLevel(f.settings, f.seed);
  $('#sheet-list').replaceChildren();
  piecesSheet($('#sheet'), $('#sheet-list'), L, { when: `${levelWord()} 1` })();
};

$('.topbar .pill').before(soundToggle(), themeToggle());
$('#modepill').textContent = MODE.name;
document.title = `Grove Chess: ${MODE.name}`;
fillMenu($('#modes'), modeId, '../');
if (daily) await initDaily();
prepareTitle();
requestAnimationFrame(previewFrame);

// For automated tests: read-only access, and a way to move.
window.__play = { now: () => (game ? now() : null), level: () => level, board: () => board, kf: () => kf, session: () => session, settings: () => M, play: (mv) => play(mv), par: () => par, busy: () => busy, select: (i) => select(i) };

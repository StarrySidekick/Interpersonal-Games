// The runner: any mode (modes.js), from its settings. One page plays them
// all: one level at a time, a descent, a golf course, or autochess rounds.
// `?mode=` says which; `#lab=...` (Chaos's "Play as a descent") puts a
// level's settings under the mode for a test run, which keeps nothing.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { rng } from '../../../engine/seed.js';
import * as sfx from '../sounds.js';
import {
  PIECES, descOf, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, STATUE_ROW_DESC, statueAt, statueDesc, GHOST_DESC, GATE_DESC, WANDER_DESC, ghostAt, gateUp, cloudOver, hiddenFrom, HOLE_DESC, cloudDesc, sandAt, waterAt, SAND_DESC, WATER_DESC, movesFor, playerMove, respond, isOver, outcome, initialState,
  allMoves, holeOpen, crumbled, shrunk, apply, showdown, firstCaptures, onBoard, leaderDesc, placeRevived, hopIn, flagAt, carrierOf, rabbitChosen, EXIT_DESC, setOrder, setLeft
} from '../rules.js';
import { pickMove } from '../choose.js';
import { bestMove } from '../best.js';
import { newTiles, fillOffers, flip, frontier, tier, bounds, layout, foePick, tileKey, tileXY, SIZES } from '../tiles.js';
import { solveLevel } from '../solve.js';
import { scene, sceneFrame, sprite, crispWidth } from '../board.js';
import { suitLook } from '../models.js';
import { piecesSheet } from '../sheet.js';
import { playIntro } from '../intro.js';
import { makeLevel, searchLayouts, decodeLevel, rabbitPool, GOAL_PILL, summary } from '../lab.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch, routeText } from '../rabbits.js';
import { makeBoard } from '../board3d.js';
import { startFall } from '../fall.js';
import { fillMenu } from '../menu.js';
import { buildForm, FORM_CSS, partsList } from '../form.js';
import { loadCatalog, registerInvented } from '../invented.js';
import { MODES, modeSettings, saveModeSettings, resetModeSettings, cleanMode, PANEL, levelSettings, COURSES, COURSE_ORDER, holesOf, settingShown, settingNote, describe, partLine } from '../modes.js';
import {
  newRun, rewardsFor, applyReward, cardText, handSettings, afterLevel, pieceOf, SUITS, JOKERS,
  WAYSTONES, litWaystones, newlyLit, startChoices, keepsakeCards, acornsFor, priceOf, shopStock,
  canCombine, applyCombine, combineText, boardCards, boardCardText, applyMerge, mergeTargets, foeUpgrade, WEAPONS, canTakeWeapon, carriesText, foeCanUse, foeTake,
  adventureCards, adventureSlack, parVerdict, PAR_CARDS, adventureSet, afterAdventure, takeRabbits, netCatches, RABBITS_FOR_PIECE
} from '../run.js';
import { setupPanel, setupState, playOut } from '../autosetup.js';
import { VARIANTS, VARIANT_ORDER, differs } from '../variants.js';
import { startKungFu } from '../kungfu.js';
import { describeMeasure } from '../metrics.js';

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

// --- Records: only ever go up (nothing decays, no streaks). -----------------

const REC = 'ig.grove.records.v1';
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
  // Adventure always starts with a rook (Timothy, 2026-10-15: "you always
  // start with the rook, no choice").
  if (M.upgrades === 'par') start.splice(0, start.length, 'rook');
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
  const hand = session.run ? handSettings(session.run, setFor(n)) : null;
  if (hand && session.run.tiles) hand.tiles = layout(session.run.tiles);
  const key = `${n}|${JSON.stringify(hand?.hand || null)}|${JSON.stringify(hand?.handMods || null)}|${JSON.stringify(hand?.foeHand || null)}|${JSON.stringify(hand?.foeMods || null)}|${(session.run?.jokers || []).join(',')}|${hand?.tiles ? hand.tiles.open.join('.') : ''}`;
  if (session.found.has(key)) return session.found.get(key);
  // A rolled level (Chaos, the daily's way) that finds nothing passing gets
  // fresh rolls, up to six, before settling for the best it saw: the daily's
  // bar in particular passes about one roll in twenty.
  const rolled = M.roll !== 'fixed';
  const p = (async () => {
    let last = null;
    for (let k = 0; k < (rolled ? 6 : 1); k++) {
      last = await findOnce(n, hand, k);
      if (last.passed) break;
    }
    return last;
  })();
  session.found.set(key, p);
  return p;
}

function findOnce(n, hand, attempt) {
  const settings = levelSettings(M, { depth: n, hole: n, round: n, hand, veto: catalog.vetoed, invented: catalog.invented },
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
  return new Promise((resolve) => {
    const done = (data) => {
      if (data.type === 'progress') return;
      const pick = data.type === 'done' ? data : data.best;
      resolve({ settings, seed: pick ? pick.seed : msg.seed, par: pick?.par ?? null, measure: pick?.measure || null, autoBest: pick?.setup || null,
        setups: pick?.setups ? { wins: pick.wins, tried: pick.setups } : null, passed: data.type === 'done' });
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

const furOf = (f) => ((f.brain === 'pattern' || f.brain === 'possessed' || f.brain === 'sentry' || f.brain === 'scared' || f.mind) && FUR[f.patternName]) || null;
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
  $('#movemax').textContent = [level.rules.maxMoves && !(M.run === 'course' && par) ? `of ${level.rules.maxMoves}` : '', par ? `${M.run === 'course' ? 'of ' : '· '}par ${par}` : '', hop ? `· the rabbit hops ${hop === 1 ? 'next turn' : `in ${hop}`}` : ''].filter(Boolean).join(' ');
}

/** Adventure's rabbits, as they stand now: what the run has kept, and what
    this board has taken so far. [{ type, have, made }]: `have` of the next
    three of that kind, and how many pieces this board has made. */
function rabbitCounts(s = now()) {
  const kept = session.run.rabbits || {}, out = new Map();
  for (const [type, n] of Object.entries(kept)) out.set(type, { type, base: n, now: 0 });
  for (const f of s.foes) if (f.taken && !f.netted && PIECES[f.type] && !['rabbit', 'bunny', 'ball'].includes(f.type)) {
    if (!out.has(f.type)) out.set(f.type, { type: f.type, base: 0, now: 0 });
    out.get(f.type).now++;
  }
  return [...out.values()].map(({ type, base, now: n }) => ({ type, have: (base + n) % RABBITS_FOR_PIECE, made: Math.floor((base + n) / RABBITS_FOR_PIECE) })).filter((r) => r.have || r.made);
}

/** Adventure (2026-10-15, Timothy: "a clear little icon thing underneath
    the board to show what piece comes up next"): right under the board, the
    piece that comes on after this turn, and the one after that, faded. It
    pops when it changes. */
let lastNext = null;
function nextUp() {
  const s = now(), box = $('#nextup'), order = s.set ? setOrder(s) : [];
  if (order.length < 2 || s.pieces[0]?.taken || s.won) { box.hidden = true; lastNext = null; return; }
  const icon = (p) => { const cv = el('canvas', { class: 'pix', width: 30, height: 36 }); cv.getContext('2d').drawImage(sprite(p.type, lookOf(p)), 0, 0); return cv; };
  const marks = (p) => [p.suit && SUITS[p.suit] ? el('span', { class: 'suit', style: `color:${SUITS[p.suit].colour}` }, SUITS[p.suit].mark) : null,
    p.weapon && WEAPONS[p.weapon] ? el('span', { class: 'suit' }, WEAPONS[p.weapon].mark) : null];
  const next = order[1], key = `${s.ci}:${next.type}:${s.t}`;
  box.replaceChildren(
    el('span', { class: 'lbl' }, 'Next'),
    el('span', { class: 'slot next' }, icon(next), el('span', {}, ...marks(next), ' ', nameOf(next))),
    ...(order.length > 2 ? [el('span', { class: 'arrow' }, '›'), el('span', { class: 'slot then' }, icon(order[2]), el('span', { class: 'small' }, nameOf(order[2])))] : []));
  box.hidden = false;
  if (lastNext !== null && lastNext !== key) { box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn'); }
  lastNext = key;
}

/** Adventure (2026-10-15): your set in the order it takes turns, from the
    piece on the board now; and your rabbits, three of a kind to a piece. */
function setRow() {
  const s = now(), box = $('#playhand');
  const order = s.set ? setOrder(s) : s.pieces.slice(0, 1);
  box.replaceChildren(...order.map((p, k) => {
    const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(p.type, lookOf(p)), 0, 0);
    const mark = [p.suit && SUITS[p.suit] ? el('span', { class: 'suit', style: `color:${SUITS[p.suit].colour}` }, SUITS[p.suit].mark + ' ') : null,
      p.weapon && WEAPONS[p.weapon] ? el('span', { class: 'suit' }, WEAPONS[p.weapon].mark + (p.wl > 1 ? p.wl : '') + ' ') : null];
    return el('div', { class: `handcell${k === 0 ? ' picked' : ''}` },
      el('span', { class: 'dim' }, k === 0 ? (p.taken ? 'Taken' : 'Now') : k === 1 ? 'Next' : `In ${k}`), cv, el('span', {}, mark, nameOf(p)));
  }));
  // Taken from your set on this board, and caught in your net.
  const fell = (s.set || []).filter((e) => e.lost);
  if (fell.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Lost'), ...fell.map((e) => el('span', { class: 'small dim' }, el('s', {}, nameOf(e))))));
  const netted = s.foes.filter((f) => f.taken && f.netted);
  if (netted.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, `${WEAPONS.net.mark} Netted`), ...netted.map((f) => el('span', { class: 'small' }, nameOf(f)))));
  const bench = session.run.hand.length - (session.pick?.length || session.run.hand.length);
  if (bench > 0) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Resting'), el('span', {}, `${bench} more`), el('span', { class: 'small dim' }, 'next board, maybe')));
  const r = rabbitCounts(s);
  if (r.length) box.append(el('div', { class: 'handcell' }, el('span', { class: 'dim' }, 'Rabbits'),
    ...r.map((c) => el('span', { class: 'small' }, `${PIECES[c.type].name}: ${c.made ? `a new one${c.have ? ` + ${c.have}/${RABBITS_FOR_PIECE}` : ''}` : `${c.have}/${RABBITS_FOR_PIECE}`}`))));
}

/** Your hand, as a row of little pieces with their suits. */
function handRow(box, { pick = null, picked = [] } = {}) {
  box.replaceChildren();
  if (!session?.run) return;
  session.run.hand.forEach((h, i) => {
    const { type, name } = pieceOf(h, session.run.made);
    registerInvented(session.run.made);
    const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(type, 'you'), 0, 0);
    const mark = [h.suit && SUITS[h.suit] ? el('span', { class: 'suit', style: `color:${SUITS[h.suit].colour}` }, SUITS[h.suit].mark + ' ') : null,
      h.weapon && WEAPONS[h.weapon] ? el('span', { class: 'suit' }, WEAPONS[h.weapon].mark + (h.wl > 1 ? h.wl : '') + ' ') : null];
    const lives = h.lives > 1 ? ` (${h.lives} lives)` : '';
    const cell = el('div', { class: `handcell${picked.includes(i) ? ' picked' : ''}` }, cv, el('span', {}, mark, name + lives));
    if (pick) { cell.style.cursor = 'pointer'; cell.addEventListener('click', () => pick(i)); }
    box.append(cell);
  });
  if (session.run.jokers.length) box.append(el('div', { class: 'handcell' }, el('span', {}, 'Jokers'), el('span', { class: 'small' }, session.run.jokers.map((j) => JOKERS[j].name).join(', '))));
}

function goalCard() {
  if (session.seen.has('goal')) return null;
  session.seen.add('goal');
  let text = {
    descent: M.upgrades === 'par' ? 'Take every piece of theirs. When the last one goes, a hole opens beside you and you jump down it to the next board. Grey statues never move. A piece with a rabbit inside walks a short loop every turn, the rabbit\u2019s colour says which; the whole loop is drawn on the board, its next step boldest: stand there and it takes you. You have one piece on the board, and after every turn it becomes the next piece of your set. Every piece you take leaves you its rabbit, and three rabbits of a kind become that piece, which joins your set. If they take the piece on the board, it is gone for good, and the next of your set comes on where you came in; lose every one and the adventure is over. A net catches the first piece it takes on a board whole, with no rabbits needed. There are three kinds of rabbit inside their pieces: robot rabbits walk a set loop; sentry rabbits (red) leap at anything of yours that stands in their reach; scared rabbits (white) run when attacked, one a turn, so fork them. A line of yours through one of theirs to another pins it, so it holds still. Deeper down, their crowned leader must answer a check: checkmate it and the whole board falls.'
      : M.upgrades === 'tiles' ? 'Take their King to win the round. After each round you each turn over a tile at the edge of the board, the winner first: the board grows by that square, and the suit or weapon on the tile is yours. When the board has as many squares as the next size up, both sides get the same new piece. Every piece starts each round in a bubble: nothing can take it until it moves. Four statues stand in the middle; either side can break one by taking it. Keep your King: if they take it, the run is over.'
      : M.upgrades === 'each' && M.goal === 'carrier' ? `A rabbit rides one of their pieces. ${M.rabbitMove === 'random' ? `Every ${M.rabbitHop === 1 ? 'turn' : `${M.rabbitHop} turns`} it hops to another, at random.` : 'They can move it to another of their pieces, but that is their move for the turn.'} Take the piece it is on to fall to the next board, where you choose a suit or a weapon and they get one too. Keep your King: if they take it, the descent is over. Anything else of yours they take comes back on the next board.${M.promote === 'copy' ? ' A pawn that reaches the far row becomes a copy of another of your pieces.' : ''}`
      : M.upgrades === 'each' ? 'Take their King to fall to the next board, where each side gets an upgrade. Keep yours: if they take your King, the descent is over. Anything else of yours they take comes back on the next board. One rabbit leads their side, riding on their King: tap it to see what kind it is.'
      : M.goal === 'king' ? 'Take their King to fall to the next level, where you find something. Keep yours: if they take your King, the descent is over. Any other piece of yours that is taken is gone for good.'
      : 'Take every piece of theirs to fall to the next level, where you find something. A piece of yours that is taken is gone for good; when they are all gone, so is the descent.',
    course: 'Your pieces are the clubs: move one into the ball and it slides on the same way until something stops it. Sink it in the hole at par or better to go on to the next hole; over par, you play the hole again. Sand stops the ball dead, water sends it back to the tee, gates rise and fall, and clouds drift and stop it.',
    rounds: 'Put rabbits in your pieces and let them fight. Win the round to grow your side; a lost round costs a life.',
    single: 'One level. Win it how it says above.'
  }[M.run];
  // A chess variant: its own goal, and what Grove Chess plays differently.
  if (M.realtime && M.run === 'descent') text = text + ' Kung fu: there are no turns. Move any piece of yours whenever it is ready, and so do they. A move takes time to travel, so a piece can dodge one coming for it, and a piece that has moved rests for a moment: the ring under it runs down.';
  const V = VARIANTS[M.variant];
  if (V && M.run === 'single') return { kind: 'king', side: 'foe', title: V.name, text: [V.blurb, ...differs(V)].join(' ') };
  if (M.position && M.run === 'single' && M.goal === 'flag') return { kind: 'flag', side: 'you', title: MODE.name,
    text: 'A rabbit sits in the middle of the board. Take it, and the piece that took it carries it on its head: bring that piece back to your first row to win. If they take the piece carrying it, the rabbit rides theirs, and they win by carrying it to their first row. There are no Kings: the rabbit is the whole game.' };
  if (M.position && M.run === 'single') return { kind: 'king', side: 'foe', title: MODE.name,
    text: 'A layout from the piece trials: the same army on each side, theirs thinking. Take their King and keep yours. A King left where it can be taken is lost: there is no check, and no checkmate.' };
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
  // Adventure (2026-10-15): par is the solver's route plus some slack, more
  // the deeper you are, so under par is always possible.
  if (M.upgrades === 'par' && par) par += adventureSlack(session.n);
  game = { states: [initialState(level)], moves: [] };
  board = makeBoard($('#board'), level);
  board.lookOf = M.upgrades === 'par' ? lookOf : null;
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
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, { when: `${levelWord()} ${session.n}` });
  $('#modepill').textContent = M.run === 'single' ? MODE.name : `${levelWord()} ${session.n}`;
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
  await playIntro(board, level, { section: $('[data-screen=play]'), seen: session.seen, goal: goalCard() });
  busy = false;
  if (isAuto()) return setUp();
  if (level.settings.arrange && level.pieces.length && setChanged()) await arrange();
  if (level.rules.realtime) return beginKungFu();
  $('#controls').hidden = false;
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
  if (s.bonus.why === 'gears') return `Gears: skipped. Your ${name.toLowerCase()} comes on: its move.`;
  return s.bonus.why === 'vines' ? `Vines: your ${name} can take again. Take one, or end the turn.`
    : `Stars: your ${name} moves again. Move it, or end the turn.`;
}

function select(i) {
  sel = i;
  // Waiting is off by default (2026-10-10): the button shows only when it
  // is allowed, when a suit left the turn open, or when nothing can move.
  const passOk = allMoves(now()).some((m) => m.p === -1);
  $('#wait').hidden = !passOk;
  $('#wait').textContent = now().bonus ? 'End turn' : now().day.rules.wait ? 'Wait a turn' : 'Pass (nothing can move)';
  // Stone (Adventure): with the button pressed, the moves that leave a stone.
  const stoneable = movesFor(now(), 0).some((m) => m.stone);
  if (!stoneable) stoneArmed = false;
  $('#stone').hidden = !stoneable;
  $('#stone').setAttribute('aria-pressed', String(stoneArmed));
  $('#stone').textContent = stoneArmed ? '◆ Leaving a stone: pick a move' : '◆ Leave a stone';
  legal = i == null ? [] : movesFor(now(), i).filter((m) => !m.skip && !!m.stone === stoneArmed);
  // Gears in Adventure: skip to the next piece of your set, by a button.
  const skip = movesFor(now(), 0).find((m) => m.skip), next = skip && setOrder(now())[1];
  $('#skip').hidden = !skip;
  if (next) $('#skip').textContent = `⚙ Skip to the ${nameOf(next).toLowerCase()}`;
  if (i == null) info(level.hole ? (holeOpen(now()) ? 'Tap a piece to see where it can go. The hole is open.' : 'Tap a piece to see where it can go. The hole opens once every rabbit is caught.') : 'Tap a piece to light up where it can go.');
  else {
    const p = now().pieces[i], type = p.type;
    if (p.brain === 'carrier') info(`Your rabbit, riding your ${nameOf(now().pieces[p.rides] || p)}: if they take the piece it rides, you lose. ${legal.length ? 'Tap another of your pieces to move it there; that is your move for the turn.' : hopIn(now()) ? 'It hops by itself, at random.' : 'It has nowhere to go right now.'}`);
    else info(`${nameOf({ type })}: ${descOf(type, now().day.rules)}${carriesText(p, M.upgrades === 'par')}${legal.length || p.stun ? '' : ' It has nowhere to go right now.'}`);
  }
  draw();
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

function whatHappened(a, b) {
  const bits = [];
  b.foes.forEach((f, k) => {
    if (!f.taken || a.foes[k].taken) return;
    if (M.upgrades === 'par' && session?.run) {
      // Adventure: every piece taken leaves its rabbit with you.
      const c = rabbitCounts(b).find((q) => q.type === f.type), was = rabbitCounts(a).find((q) => q.type === f.type);
      const name = nameOf(f).toLowerCase();
      if (f.netted) { bits.push(`You netted their ${name}: it joins your set after this board.`); return; }
      bits.push(`You took their ${name}. ${c && c.made > (was?.made || 0) ? `That is three ${name} rabbits: ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} joins your set after this board.` : `Its rabbit comes with you (${name} rabbits: ${c?.have || 0} of ${RABBITS_FOR_PIECE}).`}`);
      return;
    }
    bits.push(f.brain === 'leader' ? `You took the rabbit that leads them.` : f.mind || f.brain === 'possessed' ? `You took their ${nameOf(f)}, and the rabbit inside is yours.` : `You took their ${nameOf(f)}.`);
  });
  // Your set takes turns: say what you are now.
  if (b.set && !b.won && !b.arrived && !b.pieces[0].taken && b.pieces[0].type !== a.pieces[0].type) { const n = nameOf(b.pieces[0]).toLowerCase(); bits.push(`Now you are ${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}.`); }
  // Adventure's tactics: what their turn was, in words.
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const me = b.pieces[0], myName = me ? nameOf(me).toLowerCase() : 'piece';
  const theirs = (k) => `their ${b.foes[k]?.brain === 'crown' ? 'leader' : nameOf(b.foes[k] || {}).toLowerCase()}`;
  const by = (l) => (l.by === 'stone' ? 'your stone' : `your ${myName}`);
  for (const l of b.tlog || []) {
    if (l.what === 'pin') bits.push(`${cap(by(l))} pins ${theirs(l.k)}: it holds.`);
    if (l.what === 'check') bits.push(l.how === 'take' ? `Check! ${cap(theirs(l.k))} takes ${by(l)}.` : l.how === 'block' ? `Check! ${cap(theirs(l.k))} steps in to block, and its rabbit stands guard there now, a sentry.`
      : `${l.double ? 'Double check' : 'Check'}! Their leader runs.`);
    if (l.what === 'mate') bits.push('Checkmate! Their leader is caught, and the rest lay down their arms.');
    if (l.what === 'flee') bits.push(`The scared rabbit in ${theirs(l.k)} runs.`);
    if (l.what === 'trapped') bits.push(l.fork ? `Fork! ${cap(theirs(l.k))} could not run as well.` : l.pinned ? `${cap(theirs(l.k))} would run, but it is pinned.` : `${cap(theirs(l.k))} has nowhere to run.`);
    if (l.what === 'sentry') bits.push(l.on === 'stone' ? `The sentry rabbit in ${theirs(l.k)} leaps and breaks your stone.` : `The sentry rabbit in ${theirs(l.k)} leaps.`);
    if (l.what === 'stone') bits.push(`Your stone takes ${theirs(l.k)}.`);
  }
  // A piece of your set taken (Adventure): gone, and the next comes on.
  if (b.arrived) {
    const t = b.foes.find((f) => !f.taken && f.ate === 0), left = setLeft(b);
    bits.push(`${t ? cap(theirs(b.foes.indexOf(t))) : 'They'} took your ${nameOf(b.arrived.lost).toLowerCase()}: it is gone for good. Your ${myName} comes on where you came in${left > 1 ? ` (${left} pieces left)` : ', your last piece'}.`);
  }
  if (b.foeBonus === 'vines') bits.push('Their piece of Vines takes again.');
  if (b.foeBonus === 'stars') bits.push('Their piece of Stars moves twice.');
  b.foes.forEach((f) => {
    if (f.ate >= 0 && b.pieces[f.ate].taken && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
    if (f.wounded >= 0) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.wounded])}, but its heart sends it back to your first row.`);
  });
  // Weapons and the rabbits (2026-10-13).
  if (b.revived?.side === 'foe') bits.push(`Their ${nameOf(b.foes[b.revived.i])} had a heart: it goes back to their first row.`);
  b.pieces.forEach((p, i) => { if (p.stun && !a.pieces[i].stun) bits.push(`Your ${nameOf(p)} is stunned and sits out your next turn.`); });
  b.foes.forEach((f, k) => { if (f.stun && !a.foes[k].stun) bits.push(`Their ${nameOf(f)} is stunned and sits out their next turn.`); });
  const ra = carrierOf(a, 'foe'), rb = carrierOf(b, 'foe');
  if (ra && rb && ra.rides !== rb.rides) bits.push(rabbitChosen(b.day.rules) ? `They move the rabbit to their ${nameOf(b.foes[rb.rides])}.` : `The rabbit hops to their ${nameOf(b.foes[rb.rides])}.`);
  const ma = carrierOf(a, 'you'), mb = carrierOf(b, 'you');
  if (ma && mb && ma.rides !== mb.rides) bits.push(`Your rabbit hops to your ${nameOf(b.pieces[mb.rides])}.`);
  const fa = flagAt(a), fb = flagAt(b);
  if (fb && fa && fb.by !== fa.by) bits.push(fb.by === 'you' ? 'You have the rabbit: bring it back to your first row.' : fb.by === 'foe' ? 'They have the rabbit: take the piece carrying it.' : 'The rabbit is loose.');
  if (b.hole && !holeOpen(a) && holeOpen(b) && b.day.rules.goal !== 'clear') bits.push('The hole is open.');
  // Golf (2026-10-13): a ball into the water goes back to the tee.
  b.pieces.forEach((p, i) => { if (p.splash && p.splash.t !== a.pieces[i].splash?.t) bits.push('Splash: into the water, and back to the tee.'); });
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
  return bits.join(' ');
}

/** A piece of yours that came back from a heart (2026-10-13): while set,
    tapping one of the squares it could go to puts it there instead. */
let placing = null;
/** Stone (Adventure): the next move leaves a stone behind. */
let stoneArmed = false;

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  const a = now();
  sel = null; legal = []; placing = null; pendingPlace = null; stoneArmed = false;
  const mid = playerMove(a, mv);
  shown = mid;
  await board.animate(a, mid, mv);
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await sleep(30); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  shown = null;
  noteCatches(a, b);
  haptic(b.won ? [20, 40, 30] : b.arrived || b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  // A piece of your set taken (Adventure): first they take it, then the
  // next of your set drops in where you came onto the board.
  if (b.arrived) {
    const gone = { ...b, pieces: [{ ...b.arrived.lost }], ci: b.arrived.from };
    await board.animate(mid, gone, { p: -1 });
    await board.animate(gone, b, { p: -1 });
  } else if (!b.won && !b.bonus) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return levelOver(b);
  // A suit left the turn open (Vines, Stars): the same piece goes again.
  if (b.bonus) { haptic([12, 30, 12]); sfx.gain(); status(bonusLine(b)); return select(b.bonus.p); }
  status(whatHappened(a, b));
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
  const c = board.cellAt(e);
  if (!c) return;
  if (kf) return kf.tap(c);
  if (arranging) return arranging(c);
  if (isAuto()) { if (!$('#setup').hidden) panel?.pickAt(c.x, c.y); return; }
  const { x, y } = c, s = now();
  // Hearts: putting the piece that came back on another square of its row.
  if (placing) {
    const m = legal.find((q) => q.x === x && q.y === y && q.place != null);
    if (m) { game.states[game.states.length - 1] = placeRevived(s, m.place); pendingPlace = m.place; placing = null; legal = []; sfx.gain(); draw(); return status('There. Your move.'); }
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
  if (here.length) { const at = here.indexOf(sel); return select(at < 0 ? here[0] : at + 1 < here.length ? here[at + 1] : null); }
  select(null);
  // A stone of yours (Stone suit).
  const stone = (s.stones || []).find((t) => t.x === x && t.y === y);
  if (stone) return info(`Your stone, in the shape of a ${nameOf(stone).toLowerCase()}. It stays where it was left. At the end of their turn it takes one of theirs standing where it attacks, and its lines pin and give check like your piece's. Their pieces can break it.`);
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
  if (f?.brain === 'carrier') return info(carrierText(s, f));
  if (f?.brain === 'still') return info(`A statue of their ${nameOf(f).toLowerCase()}: it never moves and never takes. Take it.`);
  // Adventure's tactics.
  if (f?.brain === 'sentry') return info(`Their ${nameOf(f).toLowerCase()}, with a sentry rabbit inside (red). It never walks, but if anything of yours stands in its reach (shaded red) when their turn ends, it leaps to take it. Pinned, it cannot.`);
  if (f?.brain === 'scared') return info(`Their ${nameOf(f).toLowerCase()}, with a scared rabbit inside (white): when you attack it, it runs to a square you do not attack. Their side can save only one a turn, so attack two at once.${f.trapped ? ' Last turn it could not run.' : ''}`);
  if (f?.brain === 'crown') return info('Their leader, a crowned King. Attack it, and they must answer: take your attacker if they can (the King only if nothing else of yours guards that square), else block the line (the blocker stands guard there after), else the King runs. If none of those works, it is checkmate, and every piece of theirs falls.');
  if (f?.route) return info(`Their ${nameOf(f).toLowerCase()}. ${routeText(f)}`);
  if (f) info(f.mind ? `Their ${nameOf(f)}, with a ${f.patternName ? f.patternName.toLowerCase() + ' ' : ''}rabbit inside (intelligence ${f.mind.iq}).` : `Their ${nameOf(f)}. ${PIECES[f.type].desc}${carriesText(f)}`);
  const fl = flagAt(s);
  if (!f && fl && !fl.by && fl.x === x && fl.y === y) info('The rabbit to capture: take it, and the piece that took it carries it. Bring it back to your first row to win; if they take the piece carrying it, it is theirs to bring home.');
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
$('#skip').onclick = () => { const p = now().pieces[0]; if (p) play({ p: 0, x: p.x, y: p.y, skip: true }); };
$('#stone').onclick = () => { if (!board || busy || isOver(now())) return; stoneArmed = !stoneArmed; haptic(8); select(0); };
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
  // Pieces of your set they took on the way (each gone for good).
  const fell = (end.set || []).filter((e) => e.lost).map((e) => nameOf(e).toLowerCase());
  afterAdventure(run, end, session.pick || [0]);
  const netted = netCatches(run, end);
  const made = takeRabbits(run, end);
  if (!run.hand.length) { status(`They took your ${took || 'last piece'}.`); await sleep(1600); return runOver('Every piece you had is gone.'); }
  const how = parVerdict(end.t, par, won);
  session.n++; run.depth = session.n;
  if (!test) { const r = mine(); r.best = Math.max(r.best || 0, session.n); saveRecords(); }
  status(won ? `${{ under: 'Under par', par: 'On par', over: 'Over par' }[how]}. A hole opens: down you go.`
    : took ? `They took your ${took}: it is gone. The floor gives way.` : 'Out of moves: the floor gives way anyway.');
  // Cleared: your piece hops into the hole that opened beside it (Timothy,
  // 2026-10-15: "the hole should just be like an animation where the piece
  // jumping in"). Otherwise the floor gives way.
  if (!calm()) { await sleep(won ? 250 : 400); if (won && board.intoHole) await board.intoHole(); else if (board.collapse) await board.collapse(); }
  if (made.length || netted.length) { sfx.fanfare(3); haptic([30, 40, 30, 40, 60]); }
  const cards = adventureCards(run, PAR_CARDS[how], rng(`reward:${session.seed}:${session.n}`));
  const note = !won ? 'Not cleared, but you take one thing with you.' : how === 'under' ? `Under par: ${end.t} moves, par ${par}. Choose one of three.`
    : how === 'par' ? `On par: ${end.t} moves. Choose one of two.` : `Over par: ${end.t} moves, par ${par}. Take it; beat par for a choice.`;
  const a = (t) => (/^[aeiou]/i.test(PIECES[t].name) ? 'An' : 'A');
  const sub = [fell.length && run.hand.length ? `Lost on this board: your ${fell.join(', ')}.` : '',
    ...netted.map((t) => `In your net: ${a(t).toLowerCase()} ${PIECES[t].name.toLowerCase()} joins your set.`),
    ...made.map((t) => `Three ${PIECES[t].name.toLowerCase()} rabbits: ${a(t).toLowerCase()} ${PIECES[t].name.toLowerCase()} joins your set.`),
    run.hand.length > run.maxPieces ? `You have ${run.hand.length} pieces: each board, ${run.maxPieces} of them take turns, drawn at random.` : ''].filter(Boolean).join(' ');
  return between({ note: `Depth ${session.n}`, sub, rewards: true, cards, rewardNote: note, fall: true });
}

// --- Between levels: the fall, and what you find. -------------------------------

let fall = null;

async function between({ note, sub = '', rewards = false, combine = false, shop: shopping = false, fall: falling = false, board: newBoard = false, won = false, cards: rewardCards = null, rewardNote = null }) {
  show('between');
  $('#betweennote').textContent = note;
  $('#betweensub').textContent = sub;
  $('#offer').hidden = true; $('#pickbox').hidden = true; $('#betweennext').hidden = true; $('#tilebox').hidden = true;
  const kinds = session.run ? session.run.hand.map((h) => ({ kind: pieceOf(h, session.run.made).type, side: lookOf(h) })) : [];
  fall = falling && !calm() && kinds.length ? startFall($('#fallcv'), kinds) : null;
  $('#fallcv').hidden = !fall;
  if (rewards && session.run) await reward({ k: 0, note: rewardNote, cards: rewardCards });
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

/** Offer the rewards for a finished level; resolves once one is taken. */
function reward({ k = 0, note = null, cards: given = null, room = false, auto = false } = {}) {
  const fairy = M.run !== 'descent' || session.n >= M.fairyFrom;
  const run = session.run, cards = (given || rewardsFor(run, rng(`reward:${session.seed}:${session.n}${k ? ':' + k : ''}`), catalog.vetoed, fairy))
    .filter((c) => c.kind !== 'joker' || M.jokers)
    .filter((c) => (c.kind !== 'piece' && c.kind !== 'merge') || M.findPool.includes(c.type));
  if (!cards.length) return Promise.resolve();
  const box = $('#offer');
  $('[data-screen=between]').classList.add('offering');
  return new Promise((resolve) => {
    const done = () => { box.hidden = true; $('#pickbox').hidden = true; $('[data-screen=between]').classList.remove('offering'); session.found.clear(); resolve(); };
    const choose = (card) => {
      haptic(14); sfx.gain();
      box.hidden = true;
      const need = card.kind === 'fuse' ? 2 : card.kind === 'suit' || card.kind === 'weapon' || card.kind === 'promote' || card.kind === 'merge' ? 1 : 0;
      if (!need) { applyReward(run, card, [], catalog.vetoed); if (card.kind === 'piece') { fall?.add(card.type); addToRoster(card.type); } return done(); }
      // Pick the piece (or two) it is for.
      const picked = [];
      $('#pickbox').hidden = false;
      $('#picktext').textContent = card.kind === 'fuse' ? 'Choose two pieces to fuse into one.' : card.kind === 'promote' ? 'Choose a piece to promote.'
        : card.kind === 'merge' ? `Choose a piece of yours for the ${PIECES[card.type].name}.`
        : card.kind === 'weapon' ? `Choose a piece to give the ${WEAPONS[card.weapon].name.toLowerCase()} to${card.weapon === 'lance' ? ' (one that slides)' : ''}.` : `Choose a piece to give ${SUITS[card.suit].name} to.`;
      // A piece card can also take a gap in the row, if a piece was lost.
      const gap = card.kind === 'merge' && room ? el('button', { class: 'quiet', onclick: () => { gap.remove(); applyMerge(run, -1, card.type); fall?.add(card.type); done(); } }, `Put the ${PIECES[card.type].name} in the gap in your row`) : null;
      if (gap) $('#pickdone').after(gap);
      const paint = () => {
        handRow($('#pickhand'), { picked, pick: (i) => {
          const h = run.hand[i];
          if (card.kind === 'suit' && h.suit) return;
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
      $('#pickdone').onclick = () => { gap?.remove(); if (card.kind === 'merge') applyMerge(run, picked[0], card.type); else applyReward(run, card, picked, catalog.vetoed); done(); };
    };
    // A tile turned over (Tile Chess): its one card, straight to choosing
    // the piece for it.
    if (auto && cards.length === 1) { $('#betweensub').textContent = note || ''; return choose(cards[0]); }
    const head = note || (given ? 'A keepsake, from the waystones. Take one.' : run.hand.length < run.maxPieces ? 'Something is down here with you. Take one of them.' : 'Your hand is full. Take an upgrade.');
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
  titleHand();
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
  const f = await find(1);
  if (ticket !== previewTicket) return; // a newer hand asked since
  const first = makeLevel(f.settings, f.seed);
  pframe = sceneFrame(first, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  crispWidth(pv, Math.min(440, pv.parentElement?.clientWidth || 440));
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(first, initialState(first), furOf);
  $('#begin').disabled = false;
  $('#begin').textContent = { descent: 'Descend', course: 'Tee off', rounds: 'Begin', single: 'Play' }[M.run];
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
prepareTitle();
requestAnimationFrame(previewFrame);

// For automated tests: read-only access, and a way to move.
window.__play = { now: () => (game ? now() : null), level: () => level, board: () => board, kf: () => kf, session: () => session, settings: () => M, play: (mv) => play(mv), par: () => par, busy: () => busy };

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
  PIECES, descOf, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, HOLE_DESC, CLOUD_DESC, movesFor, playerMove, respond, isOver, outcome, initialState,
  allMoves, holeOpen, crumbled, shrunk, apply, showdown, firstCaptures, onBoard
} from '../rules.js';
import { solveLevel } from '../solve.js';
import { scene, sceneFrame, sprite } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { playIntro } from '../intro.js';
import { makeLevel, searchLayouts, decodeLevel, rabbitPool, GOAL_PILL, summary } from '../lab.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch } from '../rabbits.js';
import { makeBoard } from '../board3d.js';
import { startFall } from '../fall.js';
import { fillMenu } from '../menu.js';
import { buildForm, FORM_CSS } from '../form.js';
import { loadCatalog, registerInvented } from '../invented.js';
import { MODES, modeSettings, saveModeSettings, resetModeSettings, cleanMode, PANEL, levelSettings, COURSES, COURSE_ORDER, holesOf, settingShown, settingNote } from '../modes.js';
import {
  newRun, rewardsFor, applyReward, cardText, handSettings, afterLevel, pieceOf, SUITS, JOKERS,
  WAYSTONES, litWaystones, newlyLit, startChoices, keepsakeCards, acornsFor, priceOf, shopStock,
  canCombine, applyCombine, combineText
} from '../run.js';
import { setupPanel, setupState, playOut } from '../autosetup.js';
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
  session = { seed, n: 1, found: new Map(), seen: new Set(), strokes: [], lives: M.lives, wins: 0, caught: [], claimed: [], acorns: 0, deepestBefore: deepest() };
  if (M.run === 'descent' || M.run === 'rounds') session.run = newRun(start, M.maxPieces);
  // The set you were dealt: laying out your pieces opens once it changes.
  session.dealt = session.run ? JSON.stringify(session.run.hand) : null;
}

/** Has your set changed from the one you were dealt (a piece found, lost,
    swapped on the title, suited or fused)? Timothy, 2026-10-10: "you should
    be allowed to organize pieces only after your default set you start
    with changes." */
const setChanged = () => !!session.run && JSON.stringify(session.run.hand) !== session.dealt;

/** The level for level number n of this session, found on a background
    thread (and kept, so asking again is free). */
function find(n = session.n) {
  const hand = session.run ? handSettings(session.run) : null;
  const key = `${n}|${JSON.stringify(hand?.hand || null)}|${JSON.stringify(hand?.handMods || null)}|${(session.run?.jokers || []).join(',')}`;
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
  const msg = { settings, seed: session.seed + n * 1000, parMin: settings.parMin, parMax: settings.parMax, maxMs: 15000,
    pool: rabbitPool(settings, myRabbits(), Math.max(1, settings.mine)) };
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

const furOf = (f) => ((f.brain === 'pattern' || f.brain === 'possessed' || f.mind) && FUR[f.patternName]) || null;
const levelWord = () => ({ descent: 'Depth', course: 'Hole', rounds: 'Round', single: 'Level' })[M.run];

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
  $('#movecount').textContent = now().t;
  $('#movemax').textContent = [level.rules.maxMoves ? `of ${level.rules.maxMoves}` : '', par ? `· par ${par}` : ''].join(' ');
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
    const mark = h.suit ? el('span', { class: 'suit', style: `color:${SUITS[h.suit].colour}` }, SUITS[h.suit].mark + ' ') : null;
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
  const text = {
    descent: M.goal === 'king' ? 'Take their King to fall to the next level, where you find something. Keep yours: if they take your King, the descent is over. Any other piece of yours that is taken is gone for good.'
      : 'Take every piece of theirs to fall to the next level, where you find something. A piece of yours that is taken is gone for good; when they are all gone, so is the descent.',
    course: 'Sink the ball in the hole in as few strokes as you can. Each hole has its own ball; the pieces sheet says how it rolls.',
    rounds: 'Put rabbits in your pieces and let them fight. Win the round to grow your side; a lost round costs a life.',
    single: 'One level. Win it how it says above.'
  }[M.run];
  return { kind: M.run === 'course' ? 'flag' : 'rabbit', side: M.run === 'course' ? 'you' : 'foe', title: MODE.name, text };
}

async function startLevel() {
  const found = await find(session.n);
  level = makeLevel(found.settings, found.seed);
  session.claimed = [];
  par = found.par; measured = found.measure; autoBest = found.autoBest; setups = found.setups;
  game = { states: [initialState(level)], moves: [] };
  board = makeBoard($('#board'), level);
  board.reach = level.settings.showReach;
  board.redraw = draw;
  board.fur = furOf;
  sel = null; legal = []; shown = null;
  $('#sheet-list').replaceChildren();
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, { when: `${levelWord()} ${session.n}` });
  $('#modepill').textContent = M.run === 'single' ? MODE.name : `${levelWord()} ${session.n}`;
  $('#goalpill').textContent = GOAL_PILL[level.goalKind] || '';
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${level.W} × ${level.H}`));
  if (M.run === 'rounds') chips.append(el('span', { class: 'pill lifeline' }, '♥'.repeat(session.lives)));
  if (M.run === 'rounds' && M.shop) chips.append(el('span', { class: 'pill' }, `${session.acorns} acorn${session.acorns === 1 ? '' : 's'}`));
  if (M.run === 'course' && COURSES[M.courseName]) chips.append(el('span', { class: 'pill' }, COURSES[M.courseName].name));
  if (M.run === 'course') chips.append(el('span', { class: 'pill' }, `Ball: ${({ ice: 'on ice', putt: 'putting', bounce: 'billiard', hit: 'hit by the pieces', sticky: 'sticky', ghost: 'a ghost' })[level.rules.ballMove || 'ice']}`));
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
  handRow($('#playhand'));
  $('#setup').hidden = true;
  $('#arrange').hidden = true; arranging = null;
  $('#controls').hidden = true;
  busy = true;
  await playIntro(board, level, { section: $('[data-screen=play]'), seen: session.seen, goal: goalCard() });
  busy = false;
  if (isAuto()) return setUp();
  if (level.settings.arrange && level.pieces.length && setChanged()) await arrange();
  $('#controls').hidden = false;
  status(`${levelWord()} ${session.n}. ${GOAL_PILL[level.goalKind] || ''}.${now().cloudy ? ' A cloud covers the second rows for the first turn.' : ''}`);
  select(null);
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

/** What a turn a suit left open says. */
function bonusLine(s) {
  const p = s.pieces[s.bonus.p], name = nameOf(p);
  return s.bonus.why === 'swords' ? `Swords: your ${name} can take again. Take one, or end the turn.`
    : `Stars: your ${name} moves again. Move it, or end the turn.`;
}

function select(i) {
  sel = i;
  // Waiting is off by default (2026-10-10): the button shows only when it
  // is allowed, when a suit left the turn open, or when nothing can move.
  const passOk = allMoves(now()).some((m) => m.p === -1);
  $('#wait').hidden = !passOk;
  $('#wait').textContent = now().bonus ? 'End turn' : now().day.rules.wait ? 'Wait a turn' : 'Pass (nothing can move)';
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info(level.hole ? (holeOpen(now()) ? 'Tap a piece to see where it can go. The hole is open.' : 'Tap a piece to see where it can go. The hole opens once every rabbit is caught.') : 'Tap a piece to light up where it can go.');
  else {
    const p = now().pieces[i], type = p.type, suit = p.suit ? ` ${SUITS[p.suit].mark} ${SUITS[p.suit].desc}` : '';
    info(`${nameOf({ type })}: ${descOf(type, now().day.rules)}${suit}${legal.length ? '' : ' It has nowhere to go right now.'}`);
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
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken) bits.push(f.mind || f.brain === 'possessed' ? `You took their ${nameOf(f)}, and the rabbit inside is yours.` : `You took their ${nameOf(f)}.`); });
  b.foes.forEach((f) => {
    if (f.ate >= 0 && b.pieces[f.ate].taken && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
    if (f.wounded >= 0) bits.push(`Your ${nameOf(b.pieces[f.wounded])} lost a heart.`);
  });
  if (b.hole && !holeOpen(a) && holeOpen(b)) bits.push('The hole is open.');
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
  if ((b.treasure || 0) > (a.treasure || 0)) bits.push('♦ Treasure: another pick when this level is done.');
  if (!bits.length) bits.push('Your move.');
  return bits.join(' ');
}

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  const a = now();
  sel = null; legal = [];
  const mid = playerMove(a, mv);
  shown = mid;
  await board.animate(a, mid, mv);
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await sleep(30); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  shown = null;
  noteCatches(a, b);
  haptic(b.won ? [20, 40, 30] : b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  if (!b.won && !b.bonus) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return levelOver(b);
  // A suit left the turn open (Swords, Stars): the same piece goes again.
  if (b.bonus) { haptic([12, 30, 12]); sfx.gain(); status(bonusLine(b)); return select(b.bonus.p); }
  status(whatHappened(a, b));
  // The showdown: two left, and the board starts closing in.
  if (showdown(b) && !showdown(a)) {
    haptic([20, 60, 20, 60, 20]); sfx.dusk?.();
    status('Two left. The board closes in.');
    $('#chips').append(el('span', { class: 'pill' }, 'Showdown'));
  }
  select(null);
}

$('#board').addEventListener('click', (e) => {
  if (!board || busy || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  if (arranging) return arranging(c);
  if (isAuto()) { if (!$('#setup').hidden) panel?.pickAt(c.x, c.y); return; }
  const { x, y } = c, s = now();
  if (sel != null) { const m = legal.find((m) => m.x === x && m.y === y); if (m) return play({ p: sel, x, y }); }
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.hole && s.hole.x === x && s.hole.y === y) return info(HOLE_DESC);
  if (s.cloudy && s.day.cloud?.has(y * s.day.W + x)) return info(CLOUD_DESC);
  if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
  if (shrunk(s, x, y)) return info(SHRINK_DESC);
  if (s.day.stumps.has(y * s.day.W + x)) return info(STUMP_DESC);
  const f = s.foes.find((f) => !f.taken && f.x === x && f.y === y);
  if (f) info(f.mind ? `Their ${nameOf(f)}, with a ${f.patternName ? f.patternName.toLowerCase() + ' ' : ''}rabbit inside (intelligence ${f.mind.iq}).` : `Their ${nameOf(f)}. ${PIECES[f.type].desc}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
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
    // A hole not sunk counts the limit and two more, as if picked up.
    session.strokes.push({ hole: session.n, par, strokes: won ? end.t : (level.rules.maxMoves || 15) + 2, sunk: won });
    status(won ? `Sunk in ${end.t}.` : 'Picked up.');
    await sleep(1200);
    if (session.n >= holesOf(M)) return courseOver();
    session.n++;
    return between({ note: `Hole ${session.n}`, sub: won ? (par ? `${end.t - par > 0 ? '+' : ''}${end.t - par} on that hole.` : '') : 'Picked up on that one.' });
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
    return between({ note: `Round ${session.n}`, rewards: won && M.rewards, extra: won ? end.treasure || 0 : 0 });
  }
  // A descent.
  const allGone = end.pieces.every((p) => p.taken);
  const kingGone = level.rules.royal && end.pieces.some((p) => p.taken && p.type === 'king');
  afterLevel(session.run, end);
  if (kingGone) { status('They took your King.'); await sleep(1600); return runOver('They took your King.'); }
  if (allGone) { status('They took everything.'); await sleep(1600); return runOver('Every piece you had is gone.'); }
  if (!won && M.outOfMoves === 'end') { status('Out of moves.'); await sleep(1600); return runOver('You ran out of moves.'); }
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
  return between({ note: `Depth ${session.n}`, sub, rewards: won && M.rewards, extra: won ? end.treasure || 0 : 0, combine: won, fall: true });
}

// --- Between levels: the fall, and what you find. -------------------------------

let fall = null;

async function between({ note, sub = '', rewards = false, extra = 0, combine = false, shop: shopping = false, fall: falling = false }) {
  show('between');
  $('#betweennote').textContent = note;
  $('#betweensub').textContent = sub;
  $('#offer').hidden = true; $('#pickbox').hidden = true; $('#betweennext').hidden = true;
  const kinds = session.run ? session.run.hand.map((h) => pieceOf(h, session.run.made).type) : [];
  fall = falling && !calm() && kinds.length ? startFall($('#fallcv'), kinds) : null;
  $('#fallcv').hidden = !fall;
  if (rewards && session.run) {
    // Diamonds' treasure: a pick more for each piece it took, two at most.
    for (let k = 0; k <= Math.min(2, extra); k++) await reward({ k, note: k ? '♦ Treasure: another pick.' : null });
  }
  if (shopping && session.run) await shop();
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
function reward({ k = 0, note = null, cards: given = null } = {}) {
  const fairy = M.run !== 'descent' || session.n >= M.fairyFrom;
  const run = session.run, cards = (given || rewardsFor(run, rng(`reward:${session.seed}:${session.n}${k ? ':' + k : ''}`), catalog.vetoed, fairy))
    .filter((c) => c.kind !== 'joker' || M.jokers)
    .filter((c) => c.kind !== 'piece' || M.findPool.includes(c.type));
  if (!cards.length) return Promise.resolve();
  const box = $('#offer');
  $('[data-screen=between]').classList.add('offering');
  return new Promise((resolve) => {
    const done = () => { box.hidden = true; $('#pickbox').hidden = true; $('[data-screen=between]').classList.remove('offering'); session.found.clear(); resolve(); };
    const choose = (card) => {
      haptic(14); sfx.gain();
      box.hidden = true;
      const need = card.kind === 'fuse' ? 2 : card.kind === 'suit' || card.kind === 'promote' ? 1 : 0;
      if (!need) { applyReward(run, card, [], catalog.vetoed); if (card.kind === 'piece') { fall?.add(card.type); addToRoster(card.type); } return done(); }
      // Pick the piece (or two) it is for.
      const picked = [];
      $('#pickbox').hidden = false;
      $('#picktext').textContent = card.kind === 'fuse' ? 'Choose two pieces to fuse into one.' : card.kind === 'promote' ? 'Choose a piece to promote.' : `Choose a piece to give ${SUITS[card.suit].name} to.`;
      const paint = () => {
        handRow($('#pickhand'), { picked, pick: (i) => {
          const h = run.hand[i];
          if (card.kind === 'suit' && h.suit) return;
          if ((card.kind === 'fuse' || card.kind === 'promote') && kingLocked(h)) return;
          const at = picked.indexOf(i);
          if (at >= 0) picked.splice(at, 1); else { picked.push(i); if (picked.length > need) picked.shift(); }
          paint();
        } });
        $('#pickdone').disabled = picked.length !== need;
      };
      paint();
      $('#pickdone').onclick = () => { applyReward(run, card, picked, catalog.vetoed); done(); };
    };
    const head = note || (given ? 'A keepsake, from the waystones. Take one.' : run.hand.length < run.maxPieces ? 'Something is down here with you. Take one of them.' : 'Your hand is full. Take an upgrade.');
    box.replaceChildren(el('p', { class: 'center' }, head),
      ...cards.map((c) => {
        const t = cardText(c), cv = el('canvas', { class: 'model', width: 30, height: 36 });
        if (c.kind === 'piece') cv.getContext('2d').drawImage(sprite(c.type, 'you'), 0, 0);
        return el('button', { class: 'offercard', onclick: () => choose(c) },
          el('div', {}, c.kind === 'piece' ? cv : el('div', { style: `font-size:40px;text-align:center;color:${c.suit ? SUITS[c.suit].colour : 'var(--accent)'}` }, c.suit ? SUITS[c.suit].mark : c.kind === 'fuse' ? '✦' : c.kind === 'promote' ? '▲' : '❀')),
          el('div', {}, el('span', { class: 'tag' }, t.tag), el('h3', {}, t.title), el('p', {}, t.text)));
      }),
      el('button', { class: 'quiet', onclick: done }, 'Take nothing'));
    box.hidden = false;
  });
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
        if ((card.kind === 'fuse' || card.kind === 'promote') && kingLocked(run.hand[i])) return;
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
  $('#overeyebrow').textContent = MODE.name;
  $('#overbig').textContent = end.won ? (end.sunk ? `Sunk in ${end.t}` : `Won in ${end.t}`) : outcome(end) === 'dusk' ? 'Out of moves' : 'They took everything';
  $('#overwhy').textContent = par ? `Par ${par}.` : '';
  $('#overbody').replaceChildren(...[summary(level.settings), ...describeMeasure(measured)].map((t) => el('p', { class: 'small dim' }, t)));
  $('#again').textContent = 'Another level';
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
    el('tr', {}, el('th', {}, 'Hole'), el('th', {}, 'Par'), el('th', {}, 'Strokes'), el('th', {}, '')),
    ...session.strokes.map((s) => el('tr', {}, el('td', {}, String(s.hole)), el('td', {}, String(s.par ?? '-')), el('td', {}, String(s.strokes)),
      el('td', {}, !s.sunk ? 'picked up' : s.par ? golf(s.strokes - s.par) : '')))));
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
  newSession();
  show('title');
  $('#modename').textContent = MODE.name;
  $('#modeblurb').textContent = MODE.blurb;
  $('#records').textContent = recordsLine();
  $('#testnote').hidden = !test;
  if (test) $('#testnote').textContent = 'Settings from Chaos: a test run. Nothing is kept.';
  titleHand();
  waystoneList();
  courseList();
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
      (g) => g === 'The mode' || g === 'Difficulty', { show: settingShown, note: settingNote });
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
window.__play = { now: () => (game ? now() : null), level: () => level, board: () => board, session: () => session, settings: () => M, play: (mv) => play(mv), par: () => par };

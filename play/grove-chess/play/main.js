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
  PIECES, descOf, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, HOLE_DESC, movesFor, playerMove, respond, isOver, outcome, initialState,
  allMoves, holeOpen, crumbled, shrunk, apply
} from '../rules.js';
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
import { MODES, modeSettings, saveModeSettings, resetModeSettings, cleanMode, PANEL, levelSettings } from '../modes.js';
import { newRun, rewardsFor, applyReward, cardText, handSettings, afterLevel, pieceOf, SUITS, JOKERS } from '../run.js';
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

function recordsLine() {
  const r = records[modeId];
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
  const start = Array.from({ length: M.startPieces }, () => (pool.length ? pool : M.startPool)[Math.floor(rand() * (pool.length || M.startPool.length))]);
  session = { seed, n: 1, found: new Map(), seen: new Set(), strokes: [], lives: M.lives, wins: 0, caught: [] };
  if (M.run === 'descent' || M.run === 'rounds') session.run = newRun(start, M.maxPieces);
}

/** The level for level number n of this session, found on a background
    thread (and kept, so asking again is free). */
function find(n = session.n) {
  const hand = session.run ? handSettings(session.run) : null;
  const key = `${n}|${JSON.stringify(hand?.hand || null)}|${JSON.stringify(hand?.handMods || null)}|${(session.run?.jokers || []).join(',')}`;
  if (session.found.has(key)) return session.found.get(key);
  const settings = levelSettings(M, { depth: n, hole: n, round: n, hand, veto: catalog.vetoed, invented: catalog.invented },
    rng(`${modeId}:${session.seed}:${n}`));
  if (session.run?.jokers.includes('overtime') && settings.maxMoves) settings.maxMoves += 5;
  const msg = { settings, seed: session.seed + n * 1000, parMin: settings.parMin, parMax: settings.parMax, maxMs: 15000,
    pool: rabbitPool(settings, myRabbits(), Math.max(1, settings.mine)) };
  const p = new Promise((resolve) => {
    const done = (data) => {
      if (data.type === 'progress') return;
      const pick = data.type === 'done' ? data : data.best;
      resolve({ settings, seed: pick ? pick.seed : msg.seed, par: pick?.par ?? null, measure: pick?.measure || null, autoBest: pick?.setup || null,
        setups: pick?.setups ? { wins: pick.wins, tried: pick.setups } : null });
    };
    try {
      const w = new Worker(new URL('../lab-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => { if (data.type !== 'progress') { w.terminate(); done(data); } };
      w.onerror = () => { w.terminate(); searchLayouts({ ...msg, maxMs: 4000 }, done); };
      w.postMessage(msg);
    } catch { setTimeout(() => searchLayouts({ ...msg, maxMs: 4000 }, done), 30); }
  });
  session.found.set(key, p);
  return p;
}

/** Rabbits for autochess: your collection, and the ones caught this run. */
function myRabbits() {
  const out = { ...caughtRabbits() };
  for (const n of session?.caught || []) out[n] = (out[n] || 0) + 1;
  return out;
}

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
    descent: 'Take every piece of theirs to fall to the next level, where you find something. A piece of yours that is taken is gone for good; when they are all gone, so is the descent.',
    course: 'Sink the ball in the hole in as few strokes as you can. Each hole has its own ball; the pieces sheet says how it rolls.',
    rounds: 'Put rabbits in your pieces and let them fight. Win the round to grow your side; a lost round costs a life.',
    single: 'One level. Win it how it says above.'
  }[M.run];
  return { kind: M.run === 'course' ? 'flag' : 'rabbit', side: M.run === 'course' ? 'you' : 'foe', title: MODE.name, text };
}

async function startLevel() {
  const found = await find(session.n);
  level = makeLevel(found.settings, found.seed);
  par = found.par; measured = found.measure; autoBest = found.autoBest; setups = found.setups;
  game = { states: [initialState(level)], moves: [] };
  board = makeBoard($('#board'), level);
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
  $('#controls').hidden = true;
  busy = true;
  await playIntro(board, level, { section: $('[data-screen=play]'), seen: session.seen, goal: goalCard() });
  busy = false;
  if (isAuto()) return setUp();
  $('#controls').hidden = false;
  status(`${levelWord()} ${session.n}. ${GOAL_PILL[level.goalKind] || ''}.`);
  select(null);
}

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info(level.hole ? (holeOpen(now()) ? 'Tap a piece to see where it can go. The hole is open.' : 'Tap a piece to see where it can go. The hole opens once every rabbit is caught.') : 'Tap a piece to light up where it can go.');
  else { const type = now().pieces[i].type; info(`${nameOf({ type })}: ${descOf(type, now().day.rules)}${legal.length ? '' : ' It has nowhere to go right now.'}`); }
  draw();
}

/** Catches this turn: into the run's tally, and (not on a test) your collection. */
function noteCatches(a, b) {
  b.foes.forEach((f, k) => {
    if ((f.type !== 'rabbit' && f.brain !== 'possessed' && !f.mind) || !f.taken || a.foes[k].taken) return;
    if (f.patternName && FUR[f.patternName]) { session.caught.push(f.patternName); if (!test) recordCatch(f.patternName); }
  });
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken && !session.firstCatch) session.firstCatch = f.type; });
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
  if (!b.won) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return levelOver(b);
  status(whatHappened(a, b));
  select(null);
}

$('#board').addEventListener('click', (e) => {
  if (!board || busy || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  if (isAuto()) { if (!$('#setup').hidden) panel?.pickAt(c.x, c.y); return; }
  const { x, y } = c, s = now();
  if (sel != null) { const m = legal.find((m) => m.x === x && m.y === y); if (m) return play({ p: sel, x, y }); }
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.hole && s.hole.x === x && s.hole.y === y) return info(HOLE_DESC);
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
    if (session.n >= M.courseHoles) return courseOver();
    session.n++;
    return between({ note: `Hole ${session.n}`, sub: won ? (par ? `${end.t - par > 0 ? '+' : ''}${end.t - par} on that hole.` : '') : 'Picked up on that one.' });
  }
  if (M.run === 'rounds') {
    if (won) session.wins++; else session.lives--;
    status(won ? 'Round won.' : `Round lost. ${session.lives} ${session.lives === 1 ? 'life' : 'lives'} left.`);
    await sleep(1400);
    if (session.lives <= 0) return runOver('Out of lives.');
    session.n++;
    return between({ note: `Round ${session.n}`, rewards: won && M.rewards });
  }
  // A descent.
  const allGone = end.pieces.every((p) => p.taken);
  afterLevel(session.run, end);
  if (allGone) { status('They took everything.'); await sleep(1600); return runOver('Every piece you had is gone.'); }
  if (!won && M.outOfMoves === 'end') { status('Out of moves.'); await sleep(1600); return runOver('You ran out of moves.'); }
  // Recruiter: the first piece you took joins you, if there is room.
  let recruited = null;
  if (won && session.run.jokers.includes('recruiter') && session.firstCatch && PIECES[session.firstCatch]?.kind !== 'quarry'
    && ['classic', 'fairy'].includes(PIECES[session.firstCatch]?.kind) && session.run.hand.length < session.run.maxPieces) {
    session.run.hand.push({ base: session.firstCatch }); recruited = session.firstCatch;
  }
  session.firstCatch = null;
  session.n++; session.run.depth = session.n;
  if (!test) { const r = mine(); r.best = Math.max(r.best || 0, session.n); saveRecords(); }
  status(won ? 'The floor gives way.' : 'Out of moves: the floor gives way anyway.');
  if (!calm()) { await sleep(400); if (board.collapse) await board.collapse(); }
  return between({ note: `Depth ${session.n}`, sub: (won ? '' : 'Nothing found on the way down this time. ') + (recruited ? `Your first catch, the ${PIECES[recruited].name.toLowerCase()}, comes with you.` : ''), rewards: won && M.rewards, fall: true });
}

// --- Between levels: the fall, and what you find. -------------------------------

let fall = null;

async function between({ note, sub = '', rewards = false, fall: falling = false }) {
  show('between');
  $('#betweennote').textContent = note;
  $('#betweensub').textContent = sub;
  $('#offer').hidden = true; $('#pickbox').hidden = true; $('#betweennext').hidden = true;
  const kinds = session.run ? session.run.hand.map((h) => pieceOf(h, session.run.made).type) : [];
  fall = falling && !calm() && kinds.length ? startFall($('#fallcv'), kinds) : null;
  $('#fallcv').hidden = !fall;
  if (rewards && session.run) await reward();
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
function reward() {
  const run = session.run, cards = rewardsFor(run, rng(`reward:${session.seed}:${session.n}`), catalog.vetoed)
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
      if (!need) { applyReward(run, card, [], catalog.vetoed); if (card.kind === 'piece') fall?.add(card.type); return done(); }
      // Pick the piece (or two) it is for.
      const picked = [];
      $('#pickbox').hidden = false;
      $('#picktext').textContent = card.kind === 'fuse' ? 'Choose two pieces to fuse into one.' : card.kind === 'promote' ? 'Choose a piece to promote.' : `Choose a piece to give ${SUITS[card.suit].name} to.`;
      const paint = () => {
        handRow($('#pickhand'), { picked, pick: (i) => {
          const h = run.hand[i];
          if (card.kind === 'suit' && h.suit) return;
          const at = picked.indexOf(i);
          if (at >= 0) picked.splice(at, 1); else { picked.push(i); if (picked.length > need) picked.shift(); }
          paint();
        } });
        $('#pickdone').disabled = picked.length !== need;
      };
      paint();
      $('#pickdone').onclick = () => { applyReward(run, card, picked, catalog.vetoed); done(); };
    };
    box.replaceChildren(el('p', { class: 'center' }, run.hand.length < run.maxPieces ? 'Something is down here with you. Take one of them.' : 'Your hand is full. Take an upgrade.'),
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
  const r = mine(); r.played++; const vs = total - totalPar; if (r.best == null || vs < r.best) r.best = vs; saveRecords();
  show('over');
  $('#overeyebrow').textContent = 'The course';
  $('#overbig').textContent = `${total} strokes`;
  $('#overwhy').textContent = `${vs > 0 ? '+' : ''}${vs} against par ${totalPar}.`;
  $('#overbody').replaceChildren(el('table', { class: 'score' },
    el('tr', {}, el('th', {}, 'Hole'), el('th', {}, 'Par'), el('th', {}, 'Strokes'), el('th', {}, '')),
    ...session.strokes.map((s) => el('tr', {}, el('td', {}, String(s.hole)), el('td', {}, String(s.par ?? '-')), el('td', {}, String(s.strokes)),
      el('td', {}, !s.sunk ? 'picked up' : s.par ? golf(s.strokes - s.par) : '')))));
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
  handRow($('#titlehand'));
  $('#begin').disabled = true; $('#begin').textContent = 'Finding the first level…';
  const f = await find(1);
  const first = makeLevel(f.settings, f.seed);
  pframe = sceneFrame(first, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(first, initialState(first), furOf);
  $('#begin').disabled = false;
  $('#begin').textContent = { descent: 'Descend', course: 'Tee off', rounds: 'Begin', single: 'Play' }[M.run];
}

let formBuilt = false, updateForm = null;
function openSettings() {
  show('settings');
  $('#settingstitle').textContent = `${MODE.name}: settings`;
  if (!formBuilt) {
    formBuilt = true;
    updateForm = buildForm($('#form'), PANEL, () => M, (k, v) => { M = cleanMode({ ...M, [k]: v }); if (!test) saveModeSettings(modeId, M); updateForm(); },
      (g) => g === 'The mode' || g === 'Difficulty');
  } else updateForm();
}

$('#opensettings').onclick = openSettings;
$('#oversettings').onclick = openSettings;
$('#closesettings').onclick = () => prepareTitle();
$('#resetsettings').onclick = () => { resetModeSettings(modeId); M = modeSettings(modeId); updateForm?.(); };
$('#begin').onclick = () => { haptic(12); startLevel(); };
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
window.__play = { now: () => (game ? now() : null), level: () => level, session: () => session, settings: () => M, play: (mv) => play(mv), par: () => par };

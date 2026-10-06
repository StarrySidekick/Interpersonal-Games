// The Descent's page: a run of levels, each one found by the solver on a
// background thread while you play the one above it. What each depth is made
// of is in ../descent.js; this file plays them and keeps score.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { rng } from '../../../engine/seed.js';
import * as sfx from '../sounds.js';
import {
  PIECES, CRUMBLE_DESC, SHRINK_DESC, movesFor, playerMove, respond, isOver, outcome, initialState, allMoves,
  holeOpen, crumbled, shrunk
} from '../rules.js';
import { Board, scene, sceneFrame, sprite } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { playIntro } from '../intro.js';
import { makeLevel, searchLayouts } from '../lab.js';
import { depthSettings, loadDescent, saveDescent } from '../descent.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch } from '../rabbits.js';

const rec = loadDescent();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };

// --- A run, and the levels it is made of. ---------------------------------

let run = null;

function newRun() {
  run = { seed: 1 + Math.floor(Math.random() * 1e6), depth: 1, caught: [], seen: new Set(), found: new Map() };
}

/** The level for `depth` of this run, found on a background thread. Asked
    for early, so it is usually ready by the time you fall into it. */
function find(depth) {
  if (run.found.has(depth)) return run.found.get(depth);
  const settings = depthSettings(depth, rng(`descent:${run.seed}:${depth}`));
  const msg = { settings, seed: run.seed + depth * 1000, parMin: settings.parMin, parMax: settings.parMax, maxMs: 20000 };
  const p = new Promise((resolve) => {
    const done = (data) => {
      if (data.type === 'progress') return;
      // Nothing passed every check: take the best winnable one it saw.
      const pick = data.type === 'done' ? data : data.best;
      resolve({ settings, seed: pick ? pick.seed : msg.seed, par: pick?.par ?? null });
    };
    try {
      const w = new Worker(new URL('../lab-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => { if (data.type !== 'progress') { w.terminate(); done(data); } };
      w.onerror = () => { w.terminate(); searchLayouts({ ...msg, maxMs: 4000 }, done); };
      w.postMessage(msg);
    } catch { setTimeout(() => searchLayouts({ ...msg, maxMs: 4000 }, done), 30); }
  });
  run.found.set(depth, p);
  return p;
}

// --- Rabbits: you know one by its colour once you have caught one like it. -

let known = caughtRabbits();
const furOf = (f) => (f.type === 'rabbit' && f.brain === 'pattern' && known[f.patternName] ? FUR[f.patternName] : null);

// --- Playing a level. ------------------------------------------------------

let level = null, par = null, board = null, game = null, sel = null, legal = [], busy = false, shown = null, openSheet = null;
const now = () => game.states[game.states.length - 1];
const thinks = (s) => s.foes.some((f) => !f.taken && f.brain === 'ai');
const nameOf = (x) => PIECES[x.type].name;

function draw() {
  board.draw({ state: shown || now(), track: game.states, sel, legal });
}

function hud() {
  $('#movecount').textContent = now().t;
  $('#movemax').textContent = [level.rules.maxMoves ? `of ${level.rules.maxMoves}` : '', par ? `· par ${par}` : ''].join(' ');
}

/** The last card of the opening: the goal on the first level, and the dark
    pieces the first time they turn up. Nothing after that. */
function goalCard() {
  if (!run.seen.has('goal')) {
    run.seen.add('goal');
    return { kind: 'flag', side: 'you', title: 'Rabbits, then the ball',
      text: 'Catch every rabbit. That opens the hole; sink the ball in it and you fall to the next board down. Lose the ball, or run out of moves, and the descent ends.' };
  }
  const dark = level.foes.find((f) => f.type !== 'rabbit');
  if (dark && !run.seen.has('dark')) {
    run.seen.add('dark');
    return { kind: dark.type, side: 'foe', title: 'Dark pieces', text: 'Dark versions of your own pieces. They think for themselves, and they can take yours, the ball included.' };
  }
  return null;
}

async function startLevel() {
  const found = await find(run.depth);
  find(run.depth + 1); // the next one down, found while you play this one
  level = makeLevel(found.settings, found.seed);
  par = found.par;
  known = caughtRabbits();
  game = { states: [initialState(level)], moves: [] };
  board = new Board($('#board'), level);
  board.redraw = draw;
  board.fur = furOf;
  sel = null; legal = []; shown = null;
  $('#sheet-list').replaceChildren();
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, { when: `Depth ${run.depth}`,
    rabbit: 'Each rabbit has its own pattern, and once you have caught a pattern its rabbits wear its colour.' });
  $('#depthpill').textContent = `Depth ${run.depth}`;
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${level.W} × ${level.H}`));
  if (level.rules.crumble) chips.append(el('span', { class: 'pill' }, 'Crumbling'));
  if (level.rules.shrink) chips.append(el('span', { class: 'pill' }, level.rules.shrink === 'spiral' ? 'Shrinking in a spiral' : 'Shrinking'));
  const darkN = level.foes.filter((f) => f.type !== 'rabbit').length;
  if (darkN) chips.append(el('span', { class: 'pill' }, `${darkN} dark piece${darkN > 1 ? 's' : ''}`));
  show('play');
  keepAwake();
  hud();
  busy = true;
  await playIntro(board, level, { section: $('[data-screen=play]'), seen: run.seen, goal: goalCard() });
  busy = false;
  status(`Depth ${run.depth}. Catch ${level.foes.filter((f) => f.target).length > 1 ? 'every rabbit' : 'the rabbit'}, then sink the ball.`);
  select(null);
}

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info(holeOpen(now()) ? 'The hole is open. Roll the ball in.' : 'Tap a piece to light up where it can go. The hole opens once every rabbit is caught.');
  else {
    const P = PIECES[now().pieces[i].type];
    info(`${P.name}: ${P.desc}${legal.length ? '' : ' It has nowhere to go right now.'}`);
  }
  draw();
}

/** Rabbits caught on this move go in the run's tally and your collection. */
function noteCatches(a, b) {
  let first = null;
  b.foes.forEach((f, k) => {
    if (f.type !== 'rabbit' || !f.taken || a.foes[k].taken) return;
    if (f.patternName && FUR[f.patternName]) {
      run.caught.push(f.patternName);
      if (recordCatch(f.patternName)) first = f.patternName;
    }
  });
  known = caughtRabbits();
  return first;
}

function whatHappened(a, b, mv, first) {
  const bits = [];
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken) bits.push(f.type === 'rabbit' ? 'Caught a rabbit.' : `You took their ${nameOf(f)}.`); });
  b.foes.forEach((f) => {
    if (f.ate >= 0 && b.pieces[f.ate].taken && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
  });
  if (first) bits.push(`Your first ${first}: from now on it wears ${FUR_WORD[first]} fur.`);
  if (b.hole && !holeOpen(a) && holeOpen(b)) bits.push('The hole is open.');
  if (b.gone.length > a.gone.length) bits.unshift('The square you left crumbled away.');
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
  if (!bits.length) bits.push(mv.p === -1 ? 'You waited.' : 'Your move.');
  return bits.join(' ');
}

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  const a = now();
  sel = null; legal = [];
  // Show your move straight away, then let them think.
  const mid = playerMove(a, mv);
  shown = mid;
  await board.animate(a, mid, mv);
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await sleep(30); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  shown = null;
  const first = noteCatches(a, b);
  haptic(b.won ? [20, 40, 30] : b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  if (!b.won) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (b.won) return descend();
  if (isOver(b)) return over(b);
  status(whatHappened(a, b, mv, first));
  select(null);
}

$('#board').addEventListener('click', (e) => {
  if (!board || busy || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  const { x, y } = c, s = now();
  if (sel != null) {
    const m = legal.find((m) => m.x === x && m.y === y);
    if (m) return play({ p: sel, x, y });
  }
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.hole && s.hole.x === x && s.hole.y === y) return info(holeOpen(s) ? 'The hole, open. Sink the ball in it.' : 'The hole, shut until every rabbit is caught. For now it is only ground.');
  if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
  if (shrunk(s, x, y)) return info(SHRINK_DESC);
  const f = s.foes.find((f) => !f.taken && f.x === x && f.y === y);
  if (f) info(f.type === 'rabbit' ? `A rabbit${f.patternName && known[f.patternName] ? `, a ${f.patternName}` : ''}. It hops in a pattern; watch its tracks.` : `Their ${nameOf(f)}, thinking for itself. ${PIECES[f.type].desc}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
$('#pieces').onclick = () => openSheet?.();
$('#sheet-close').onclick = () => $('#sheet').close();

// --- Falling, and the end. -------------------------------------------------

/** The ball is in: the board drops away and you fall to the next one. */
async function descend() {
  sfx.fall(0.2);
  run.depth++;
  rec.best = Math.max(rec.best, run.depth);
  saveDescent(rec);
  status('The ball drops, and the board goes with it.');
  if (!calm()) {
    await sleep(500);
    await board.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(110vh)', opacity: 0.5 }],
      { duration: 900, easing: 'cubic-bezier(.55, 0, 1, .45)' }).finished.catch(() => {});
  }
  show('fall');
  $('#fallnote').textContent = `Depth ${run.depth}`;
  $('#fallsub').textContent = '';
  const t0 = performance.now();
  const slow = setTimeout(() => { $('#fallsub').textContent = 'Still falling. The next board is being found.'; }, 1500);
  await find(run.depth);
  clearTimeout(slow);
  await sleep(Math.max(0, 1400 - (performance.now() - t0)));
  board.el.style.transform = '';
  board.el.style.opacity = '';
  startLevel();
}

/** Every rabbit caught on this run, one tile per colour, with counts. */
function rabbitTiles(names) {
  const counts = {};
  for (const n of names) counts[n] = (counts[n] || 0) + 1;
  const row = el('div', { class: 'rabbitrow' });
  for (const n of Object.keys(counts)) {
    const cv = el('canvas', { class: 'pix', width: 30, height: 36, title: `${n}: ${FUR_WORD[n]}` });
    cv.getContext('2d').drawImage(sprite('rabbit', 'foe', FUR[n]), 0, 0);
    row.append(el('div', { class: 'rabbitcell' }, cv, el('span', { class: 'small' }, counts[n] > 1 ? `${n} ×${counts[n]}` : n)));
  }
  return row;
}

async function over(end) {
  const how = outcome(end);
  ({ dusk: () => sfx.dusk(), eaten: () => sfx.lost() })[how]?.();
  status(how === 'dusk' ? 'Out of moves.' : 'They took the ball.');
  rec.runs++;
  rec.best = Math.max(rec.best, run.depth);
  saveDescent(rec);
  await sleep(1600); // a moment to see what happened
  show('over');
  $('#over-depth').textContent = `Depth ${run.depth}`;
  const ball = end.pieces.some((p) => p.type === 'ball' && p.taken);
  $('#over-why').textContent = how === 'dusk' ? 'You ran out of moves.' : ball ? 'They took the ball.' : 'They took everything.';
  $('#over-best').textContent = run.depth >= rec.best ? 'As deep as you have ever been.' : `The deepest you have been is depth ${rec.best}.`;
  const box = $('#over-rabbits');
  box.replaceChildren();
  if (run.caught.length) box.append(el('p', { class: 'small dim', style: 'margin:14px 0 0' }, `Rabbits caught on the way down: ${run.caught.length}`), rabbitTiles(run.caught));
}

// --- The title: the first board, turning. ---------------------------------

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
  newRun();
  $('#deepest').textContent = rec.best ? `The deepest you have been: depth ${rec.best}.` : 'Nobody has been down yet.';
  const f = await find(1);
  const first = makeLevel(f.settings, f.seed);
  pframe = sceneFrame(first, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(first, initialState(first), furOf);
  $('#begin').disabled = false;
  $('#begin').textContent = 'Descend';
}

$('#begin').onclick = () => { haptic(12); startLevel(); };
$('#again').onclick = async () => {
  newRun();
  show('fall');
  $('#fallnote').textContent = 'Depth 1';
  $('#fallsub').textContent = '';
  await find(1);
  startLevel();
};

$('.topbar .pill').before(soundToggle(), themeToggle());
show('title');
prepareTitle();
requestAnimationFrame(previewFrame);

// For automated tests: read-only access to what is on the board.
window.__descent = { now: () => (game ? now() : null), level: () => level, depth: () => run.depth, find: (d) => find(d) };

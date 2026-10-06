// The Descent's page: a run of levels, each one found by the solver on a
// background thread while you play the one above it. What each depth is made
// of is in ../descent.js; this file plays them and keeps score.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { rng } from '../../../engine/seed.js';
import * as sfx from '../sounds.js';
import {
  PIECES, descOf, CRUMBLE_DESC, SHRINK_DESC, movesFor, playerMove, respond, isOver, outcome, initialState, allMoves,
  holeOpen, crumbled, shrunk
} from '../rules.js';
import { Board, scene, sceneFrame, sprite, diagram } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { playIntro } from '../intro.js';
import { makeLevel, searchLayouts } from '../lab.js';
import { depthSettings, loadDescent, saveDescent, START_HAND, HAND_MAX, offersFor } from '../descent.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch } from '../rabbits.js';
import { makeBoard } from '../board3d.js';

const rec = loadDescent();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };

// --- A run, and the levels it is made of. ---------------------------------

let run = null;

function newRun() {
  run = { seed: 1 + Math.floor(Math.random() * 1e6), depth: 1, hand: START_HAND.slice(), caught: [], seen: new Set(), found: new Map() };
}

/** The level for `depth` of this run, for the pieces you are carrying, found
    on a background thread. Asked for early (assuming you keep every piece,
    once for each piece you might pick on the way down), so it is usually
    ready by the time you fall into it; lose a piece and the next level is
    found again for what is left. */
function find(depth, hand = run.hand) {
  const key = `${depth}|${hand.join(',')}`;
  if (run.found.has(key)) return run.found.get(key);
  const settings = depthSettings(depth, rng(`descent:${run.seed}:${depth}`), hand);
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
  run.found.set(key, p);
  return p;
}

/** The two pieces offered on the way down to `depth`, or null when your
    hand is already full. Fixed for the run, whatever you lose. */
const offersAt = (depth, hand = run.hand) => (depth > 1 && hand.length < HAND_MAX ? offersFor(depth, rng(`offer:${run.seed}:${depth}`)) : null);

// --- Rabbits: every kind wears its colour down here, so you can see which
// pieces move alike. (The daily keeps its colours until you have earned them.)

let known = caughtRabbits();
const furOf = (f) => ((f.brain === 'pattern' || f.brain === 'possessed') && FUR[f.patternName]) || null;

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
    return { kind: 'flag', side: 'you', title: 'Catch them, then the ball',
      text: 'Rabbits have got into their pieces. Take every possessed piece and its rabbit is freed; when they are all free the hole opens. Sink the ball in it and you fall to the next board, with every piece you still have. Lose the ball, or run out of moves, and the descent ends.' };
  }
  if (level.rules.foesCapture && !run.seen.has('capture')) {
    run.seen.add('capture');
    const dark = level.foes.find((f) => f.type !== 'rabbit');
    return { kind: dark?.type || 'king', side: 'foe', title: 'Now they bite', text: 'From here down, a possessed piece that lands on one of yours takes it, the ball included. A piece taken does not come down with you.' };
  }
  const kinds = new Set(level.foes.map((f) => f.patternName)).size;
  if (kinds > 1 && !run.seen.has('kinds')) {
    run.seen.add('kinds');
    return { kind: 'rabbit', side: 'foe', title: 'More than one kind', text: 'Down here the pieces are possessed by different kinds of rabbit, each with its own pattern. Watch which pieces move alike.' };
  }
  return null;
}

async function startLevel() {
  const found = await find(run.depth);
  // The next one down, found while you play this one: one for each piece
  // you might pick on the way.
  const next = offersAt(run.depth + 1);
  if (next) next.forEach((k) => find(run.depth + 1, [...run.hand, k])); else find(run.depth + 1);
  level = makeLevel(found.settings, found.seed);
  par = found.par;
  known = caughtRabbits();
  game = { states: [initialState(level)], moves: [] };
  board = makeBoard($('#board'), level);
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
  const held = level.foes.filter((f) => f.brain === 'possessed');
  if (held.length) {
    const kinds = new Set(held.map((f) => f.patternName)).size;
    chips.append(el('span', { class: 'pill' }, `${held.length} possessed · ${kinds} kind${kinds > 1 ? 's' : ''} of rabbit`));
  }
  show('play');
  keepAwake();
  hud();
  busy = true;
  await playIntro(board, level, { section: $('[data-screen=play]'), seen: run.seen, goal: goalCard() });
  busy = false;
  const n = level.foes.filter((f) => f.target).length;
  status(`Depth ${run.depth}. Catch ${n > 1 ? `all ${n}` : 'it'}, then sink the ball.`);
  select(null);
}

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info(holeOpen(now()) ? 'The hole is open. Roll the ball in.' : 'Tap a piece to light up where it can go. The hole opens once every rabbit is caught.');
  else {
    const type = now().pieces[i].type;
    info(`${PIECES[type].name}: ${descOf(type, now().day.rules)}${legal.length ? '' : ' It has nowhere to go right now.'}`);
  }
  draw();
}

/** Rabbits caught on this move, loose or freed from a piece, go in the
    run's tally and your collection. */
function noteCatches(a, b) {
  let first = null;
  b.foes.forEach((f, k) => {
    if ((f.type !== 'rabbit' && f.brain !== 'possessed') || !f.taken || a.foes[k].taken) return;
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
  b.foes.forEach((f, k) => {
    if (f.taken && !a.foes[k].taken) bits.push(f.type === 'rabbit' ? 'Caught a rabbit.' : f.brain === 'possessed' ? `You took their ${nameOf(f)}, and the rabbit inside is yours.` : `You took their ${nameOf(f)}.`);
  });
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

/** The ball is in: the floor gives way, and you and whatever pieces you
    still have fall to the next board. */
async function descend() {
  sfx.fall(0.2);
  run.hand = now().pieces.filter((p) => !p.taken).map((p) => p.type);
  run.hand.sort((a, b) => (a === 'ball' ? -1 : b === 'ball' ? 1 : 0));
  run.depth++;
  rec.best = Math.max(rec.best, run.depth);
  saveDescent(rec);
  status('The ball drops, and the floor goes with it.');
  if (!calm()) {
    await sleep(450);
    // The floor gives way and your pieces fall with the ball (board3d.js);
    // the flat board just drops off the screen.
    if (board.collapse) await board.collapse();
    else await board.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(110vh)', opacity: 0.5 }],
      { duration: 900, easing: 'cubic-bezier(.55, 0, 1, .45)' }).finished.catch(() => {});
  }
  show('fall');
  $('#fallnote').textContent = `Depth ${run.depth}`;
  $('#depthpill').textContent = `Depth ${run.depth}`;
  $('#fallsub').textContent = '';
  // Something down here: take one of two pieces with you.
  const offers = offersAt(run.depth);
  if (offers) {
    offers.forEach((k) => find(run.depth, [...run.hand, k])); // both found while you choose
    run.hand.push(await choose(offers));
  }
  const t0 = performance.now();
  const slow = setTimeout(() => { $('#fallsub').textContent = 'Still falling. The next board is being found.'; }, 1500);
  await find(run.depth);
  clearTimeout(slow);
  await sleep(Math.max(0, 1400 - (performance.now() - t0)));
  board.el.style.transform = '';
  board.el.style.opacity = '';
  startLevel();
}

/** Offer two pieces on the fall screen; resolves with the one you take. */
function choose(offers) {
  const section = $('[data-screen=fall]'), box = $('#offer');
  section.classList.add('offering');
  return new Promise((resolve) => {
    const card = (k) => {
      const P = PIECES[k], cv = el('canvas', { class: 'model', width: 30, height: 36 });
      cv.getContext('2d').drawImage(sprite(k, 'you'), 0, 0);
      return el('button', { class: 'offercard', onclick: () => {
        haptic(14);
        sfx.gain();
        box.hidden = true;
        section.classList.remove('offering');
        $('#fallsub').textContent = `The ${P.name.toLowerCase()} comes down with you.`;
        resolve(k);
      } },
      el('div', {}, cv, diagram(k)),
      el('div', {}, el('span', { class: 'tag' }, P.kind === 'fairy' ? 'Fairy piece' : 'Classic'), el('h3', {}, P.name),
        el('p', {}, P.desc), P.origin ? el('p', { class: 'small dim' }, P.origin) : null));
    };
    box.replaceChildren(el('p', { class: 'center' }, 'Something is down here with you. Take one of them.'), ...offers.map(card));
    box.hidden = false;
  });
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
  box.append(el('p', { class: 'small dim', style: 'margin:14px 0 0' }, `You went down with: ${run.hand.map((k) => PIECES[k].name.toLowerCase()).join(', ')}.`));
  if (run.caught.length) box.append(el('p', { class: 'small dim', style: 'margin:14px 0 0' }, `Rabbits freed on the way down: ${run.caught.length}`), rabbitTiles(run.caught));
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
  $('#deepest').textContent = (rec.best ? `The deepest you have been: depth ${rec.best}. ` : 'Nobody has been down yet. ') +
    `You go down with the ball, a ${START_HAND.slice(1).map((k) => PIECES[k].name.toLowerCase()).join(', a ').replace(/, a ([^,]*)$/, ' and a $1')}; whatever is left when you sink the ball falls with you, and at each new depth you find one more piece.`;
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
window.__descent = { now: () => (game ? now() : null), level: () => level, depth: () => run.depth, find: (d) => find(d), hand: () => run.hand.slice() };

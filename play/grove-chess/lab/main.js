// The lab page (called Chaos on the page since 2026-10-07): edit settings,
// have the solver check the level, see it turn, play it, rate it. In
// autochess you set up your pieces and the game plays itself.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import * as sfx from '../sounds.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { PIECES, descOf, HOLE_DESC, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, movesFor, playerMove, respond, isOver, outcome, initialState, allMoves, replay, crumbled, shrunk, holeOpen } from '../rules.js';
import { setupPanel, setupState, playOut } from '../autosetup.js';
import { FUR, caughtRabbits } from '../rabbits.js';
import { Board, scene, sceneFrame, sprite, patternPicture } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { describeBalance } from '../solve.js';
import { describeMeasure } from '../metrics.js';
import { makeBoard } from '../board3d.js';
import { playIntro } from '../intro.js';
import { describeSteps } from '../day.js';
import {
  SCHEMA, defaults, clean, crazy, makeLevel, summary, encodeLevelWithPar, decodeLevel,
  loadLab, saveLab, searchLayouts, GOAL_PILL, FAIRY,
  rabbitPool, encodeLevel
} from '../lab.js';

const lab = loadLab();
// In the lab every rabbit on a named pattern wears its colour (rabbits.js).
const furOf = (f) => (f.brain === 'pattern' || f.brain === 'possessed' ? FUR[f.patternName] ?? null : null);
const newSeed = () => 1 + Math.floor(Math.random() * 1e9);

// A link wins; then whatever you were last working on; then the defaults.
// `autoBest` is the solver's fastest autochess setup, when it found one.
let settings, seed, par = null, exactPar = false, line = null, balance = null, autoBest = null, measured = null;
const isAuto = () => level.settings.mode === 'auto';
/** The rabbits you can put in your pieces on this level. */
const myPool = () => rabbitPool(settings, caughtRabbits(), Math.max(1, level.pieces.length));
const linked = decodeLevel(location.hash);
if (linked) ({ settings, seed, par } = linked);
else if (lab.current) { settings = clean(lab.current.settings); seed = lab.current.seed; par = lab.current.par ?? null; }
else { settings = defaults(); seed = newSeed(); }
let level = makeLevel(settings, seed);

const levelLink = () => `${location.origin}${location.pathname}#${encodeLevelWithPar(settings, seed, par)}`;

function remember() {
  lab.current = { settings, seed, par };
  saveLab(lab);
  history.replaceState(null, '', `#${encodeLevelWithPar(settings, seed, par)}`);
}

// --- The settings form, built from the schema. ----------------------------

const updaters = [];

function field(f) {
  const label = el('div', { class: 'flabel' }, f.label, f.help ? el('span', { class: 'fhelp' }, f.help) : null);
  let ctrl;
  if (f.type === 'int') {
    const val = el('span', { class: 'fval' });
    const step = (d) => el('button', { class: 'quiet', 'aria-label': d < 0 ? `Less ${f.label}` : `More ${f.label}`, onclick: () => set(f.key, settings[f.key] + d) }, d < 0 ? '−' : '+');
    ctrl = el('div', { class: 'stepper' }, step(-1), val, step(1));
    updaters.push(() => {
      const v = settings[f.key];
      val.textContent = f.key === 'maxMoves' && v === 0 ? 'none' : `${v}${f.unit ? ' ' + f.unit : ''}`;
    });
  } else if (f.type === 'bool') {
    ctrl = el('button', { class: 'quiet tog', onclick: () => set(f.key, !settings[f.key]) });
    updaters.push(() => { ctrl.textContent = settings[f.key] ? 'On' : 'Off'; ctrl.setAttribute('aria-pressed', String(settings[f.key])); });
  } else if (f.type === 'choice') {
    const btns = f.options.map((o) => el('button', { class: 'quiet', onclick: () => set(f.key, o.v) }, o.label));
    ctrl = el('div', { class: 'seg' }, ...btns);
    updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(f.options[i].v === settings[f.key]))));
  } else if (f.type === 'multi') {
    const btns = f.options.map((o) => el('button', { class: 'quiet', onclick: () => {
      const on = settings[f.key].includes(o.v) ? settings[f.key].filter((x) => x !== o.v) : [...settings[f.key], o.v];
      if (on.length) set(f.key, on); // always keep at least one
    } }, o.label));
    ctrl = el('div', { class: 'seg' }, ...btns);
    updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(settings[f.key].includes(f.options[i].v)))));
  } else if (f.type === 'pieces') {
    const kinds = [...(f.rabbit ? ['rabbit'] : []), ...Object.keys(PIECES).filter((k) => k !== 'rabbit')];
    const btns = kinds.map((k) => {
      const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
      cv.getContext('2d').drawImage(sprite(k, f.rabbit ? 'foe' : 'you'), 0, 0);
      return el('button', {
        class: 'quiet chip',
        onclick: () => {
          const pool = settings[f.key].includes(k) ? settings[f.key].filter((x) => x !== k) : [...settings[f.key], k];
          if (pool.length) set(f.key, pool); // always keep at least one
        }
      }, cv, PIECES[k].name);
    });
    ctrl = el('div', { class: 'chips' }, ...btns);
    updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(settings[f.key].includes(kinds[i])))));
  }
  return el('div', { class: `field${f.type === 'pieces' || f.type === 'choice' || f.type === 'multi' ? ' wide' : ''}` }, label, ctrl);
}

function buildForm() {
  const root = $('#settings');
  for (const g of SCHEMA) root.append(el('details', { class: 'group', open: g.group === 'Board' || g.group === 'How you play' }, el('summary', {}, g.group), ...g.fields.map(field)));
}

function set(key, value) {
  settings = clean({ ...settings, [key]: value });
  deal();
}

// --- Dealing a level: settings + seed, checked by the solver if asked. ----

let job = null, autoplay = false;
// What the board shows can run ahead of the game for a moment (your move is
// drawn while they are still thinking), or show the solver's line instead.
let shown = null, watching = null;
const note = (t) => { $('#labnote').textContent = t; };

function stopJob() { if (job) { job.terminate(); job = null; } }

function searching(on) {
  $('#play').disabled = on;
  $('#play').textContent = on ? 'Testing layouts…' : 'Play this level';
}

/**
 * Make the level for the current settings. With the solver on, layouts are
 * tested from the current seed onward until one is winnable inside the
 * range; `fixed` tests only the current seed (for a level opened from a link
 * that does not carry its par).
 */
function deal({ reseed = false, fixed = false } = {}) {
  stopJob();
  watching = null;
  if (reseed) seed = newSeed();
  par = null; exactPar = false; line = null; autoBest = null; showBalance(null);
  level = makeLevel(settings, seed);
  updaters.forEach((u) => u());
  $('#summary').textContent = summary(settings);
  buildPreview();
  if (!settings.solve) { note('The solver is off, so this layout is untested.'); return ready(); }

  searching(true);
  note('Testing layouts…');
  const msg = { settings, seed, parMin: settings.parMin, parMax: settings.parMax, fixed, pool: myPool() };
  try {
    const w = new Worker(new URL('../lab-worker.js', import.meta.url), { type: 'module' });
    job = w;
    w.onmessage = ({ data }) => { if (job === w) result(data); };
    w.onerror = () => { if (job === w) { stopJob(); inline(msg); } };
    w.postMessage(msg);
  } catch { inline(msg); }
}

/** No workers in this browser: search on the page itself, briefly. */
function inline(msg) {
  const t = setTimeout(() => searchLayouts({ ...msg, maxMs: 4000 }, result), 30);
  job = { terminate: () => clearTimeout(t) };
}

/** The balance report (solve.js assess) under the lab's note. */
function showBalance(b, m = null) {
  measured = m;
  balance = b;
  $('#balancebox').hidden = !b;
  $('#balance').replaceChildren(...[...describeMeasure(m), ...describeBalance(b)].map((l) => el('li', {}, l)));
}

/** "the Grasshopper had no job ×3; ..." from the balance rules' throw-outs. */
const thrownText = (thrown) => Object.entries(thrown || {}).map(([w, n]) => (n > 1 ? `${w} ×${n}` : w)).join('; ');

function result(data) {
  if (data.type === 'progress') return note(`Testing layouts… ${data.tried} tried so far.`);
  stopJob();
  const thrown = thrownText(data.thrown);
  const tries = (data.tried > 1 ? ` It tried ${data.tried} layouts to find it.` : '') + (thrown ? ` The balance rules threw some out: ${thrown}.` : '');
  const won = (d) => ` ${d.wins} of the ${d.setups} setups it tried won.`;
  if (data.noRabbits) {
    note('Autochess needs rabbits to put in your pieces, and you have not caught any yet. Catch some in the descent (or the daily), or set "Your rabbits" to every named kind.');
  } else if (data.type === 'done' && data.auto) {
    ({ seed, par } = data);
    autoBest = data.setup;
    note(`Winnable in ${par} turns, the fastest setup the solver found.${won(data)}${tries}`);
  } else if (data.auto && data.best) {
    ({ seed, par } = data.best);
    autoBest = data.best.setup;
    note(`Every layout it tried could be won in under ${settings.parMin} turns. This is the slowest it found: par ${par}.${won(data.best)}`);
  } else if (data.auto) {
    note(`No setup it tried won within ${settings.maxMoves || 40} turns, in ${data.tried} layout${data.tried === 1 ? '' : 's'}. ` +
      'Try more rabbits, more pieces of yours, fewer of theirs, or a looser move limit. You can still play this one.');
  } else if (data.type === 'done') {
    ({ seed, par, line } = data);
    exactPar = data.exact;
    showBalance(data.balance, data.measure);
    note(`Winnable in ${par}. ${exactPar ? 'The solver checked every line, so that is the shortest win there is.' : 'That is the shortest win the solver found; you might beat it.'}${tries}`);
  } else if (data.best) {
    ({ seed, par, line } = data.best);
    exactPar = data.best.exact;
    showBalance(data.best.balance);
    note(data.best.unbalanced
      ? `Every layout that could be won in ${settings.parMin} to ${settings.parMax} broke a balance rule (${thrown}). This one ${data.best.why.join(' and ')}; play it anyway, or turn the rules down.`
      : `Every layout it tried could be won in under ${settings.parMin}. This is the hardest it found: par ${par}. ` +
        'For harder ones: fewer pieces of yours, more of theirs, a bigger board, or a smarter brain.');
  } else {
    note(`It found no win within ${settings.parMax} moves in ${data.tried} layout${data.tried === 1 ? '' : 's'}. ` +
      'For easier ones: more pieces of yours, fewer of theirs, a looser move limit, or a simpler brain. You can still play this one.');
  }
  level = makeLevel(settings, seed);
  buildPreview();
  searching(false);
  ready();
}

function ready() {
  remember();
  if (autoplay) { autoplay = false; startGame(); }
}

// --- The preview: the level as a turning model. ----------------------------

const pv = $('#preview'), pitch = 0.62, pscale = 2;
let pmesh = null, pframe = null, ptarget = null, pyaw = 0.6, plast = 0;

function buildPreview() {
  pframe = sceneFrame(level, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(level, initialState(level), furOf);
}

function previewFrame(ts) {
  if (!$('[data-screen=lab]').hidden) {
    pyaw += plast ? Math.min(0.05, (ts - plast) / 1000) * 0.4 : 0;
    render(ptarget, pmesh, { yaw: pyaw, pitch, scale: pscale, cx: pv.width / 2, cy: pframe.cy });
    pv.getContext('2d').putImageData(ptarget.img, 0, 0);
  }
  plast = ts;
  requestAnimationFrame(previewFrame);
}

// --- The notebook. ---------------------------------------------------------

const RESULT = { caught: 'won', eaten: 'lost', dusk: 'ran out of moves' };

function renderNotebook() {
  const box = $('#notebook');
  box.replaceChildren();
  if (!lab.notes.length) box.append(el('p', { class: 'small dim' }, 'Nothing yet. Play a level and rate it, and it lands here.'));
  for (const n of [...lab.notes].reverse()) {
    box.append(el('div', { class: 'note' },
      el('p', {}, el('b', {}, `${n.rating}/5`),
        ` · ${RESULT[n.outcome] || n.outcome} in ${n.moves}${n.par ? `, par ${n.par}` : ''} · ${new Date(n.at).toLocaleDateString()}`),
      n.note ? el('p', {}, n.note) : null,
      el('p', { class: 'small dim' }, summary(clean(n.settings))),
      el('div', { class: 'row' },
        el('button', { class: 'quiet', onclick: () => load(n) }, 'Load'),
        el('button', { class: 'quiet', onclick: () => { lab.notes = lab.notes.filter((x) => x !== n); saveLab(lab); renderNotebook(); } }, 'Remove'))));
  }
}

function load(n) {
  stopJob();
  settings = clean(n.settings); seed = n.seed; par = n.par ?? null; line = null; exactPar = false; showBalance(n.balance || null, n.measure || null);
  level = makeLevel(settings, seed);
  updaters.forEach((u) => u());
  $('#summary').textContent = summary(settings);
  buildPreview();
  searching(false);
  note(par ? `Loaded. Par ${par}.` : 'Loaded.');
  remember();
  window.scrollTo(0, 0);
}

$('#copynotes').onclick = async () => {
  const base = `${location.origin}${location.pathname}`;
  const text = lab.notes.map((n) => [
    `${n.rating}/5, ${RESULT[n.outcome] || n.outcome} in ${n.moves}${n.par ? ` (par ${n.par})` : ''}`,
    n.note ? `Note: ${n.note}` : null,
    summary(clean(n.settings)),
    ...describeMeasure(n.measure),
    ...describeBalance(n.balance),
    `${base}#${encodeLevelWithPar(n.settings, n.seed, n.par)}`
  ].filter(Boolean).join('\n')).join('\n\n');
  try { await navigator.clipboard.writeText(text || 'The notebook is empty.'); $('#copynote').textContent = 'Copied.'; }
  catch { $('#copynote').textContent = 'Could not reach the clipboard on this browser.'; }
};

// --- Playing. --------------------------------------------------------------

let board = null, game = null, sel = null, legal = [], busy = false, openSheet = null, rating = 0;
const now = () => game.states[game.states.length - 1];
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };
const thinks = (s) => s.foes.some((f) => !f.taken && f.brain === 'ai');

function draw() {
  if (watching) {
    const { states, k, moves } = watching;
    return board.draw({ state: states[k], track: level.tracks ? states.slice(0, k + 1) : null,
      paths: [{ play: { moves, states }, color: '#2f6fc0', upto: k }] });
  }
  board.draw({ state: shown || now(), track: level.tracks ? game.states : null, sel, legal });
}

/** What the goal card at the end of the opening shows. */
function goalCard() {
  const kind = level.goalKind, foes = level.foes;
  if (kind === 'descent') return { kind: 'flag', side: 'you', title: 'Rabbits, then the ball',
    text: `Catch ${foes.filter((f) => f.target).length > 1 ? 'every rabbit' : 'the rabbit'}. That opens the hole; then sink the ball in it. Until then the hole is shut: only ground, and the ball rolls straight over it.` };
  if (kind === 'hole') return { kind: 'flag', side: 'you', title: 'The hole', text: 'Sink the ball in it. It moves by its own hidden pattern after every turn.' };
  if (!foes.length) return null;
  const marked = foes.find((f) => f.target);
  if (kind === 'king') return { kind: 'king', side: 'foe', title: 'Their King', text: 'Take it and you win. It thinks for itself, and it will run.' };
  if (kind === 'rabbit') return { kind: 'rabbit', side: 'foe', title: 'The rabbit',
    text: marked?.brain === 'pattern' ? 'Catch it. It hops in a hidden pattern; its tracks are numbered on the board.' : 'Catch it. It thinks for itself.' };
  if (kind === 'target' && marked) return { kind: marked.type, side: 'foe', title: 'The marked one', text: 'Catch the one with the gold ring under it.' };
  if (kind === 'any') return { kind: foes[0].type, side: 'foe', title: 'Any one of them', text: `Catch any one of their ${foes.length} and you win.` };
  return { kind: foes[0].type, side: 'foe', title: 'All of them', text: `Capture all ${foes.length} of theirs to win.` };
}

async function startGame({ intro = true } = {}) {
  game = { states: [initialState(level)], moves: [] };
  board = makeBoard($('#board'), level);
  board.redraw = draw;
  board.fur = furOf;
  sel = null; legal = []; busy = false; rating = 0; shown = null; watching = null;
  $('#sheet-list').replaceChildren();
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, {
    rabbit: level.foes.some((f) => f.brain === 'pattern') ? 'Each rabbit has its own pattern. Its tracks are numbered in its own colour.' : null,
    when: 'This level'
  });
  show('play');
  keepAwake();
  $('#end').hidden = true;
  $('#controls').hidden = false;
  $('#movemax').textContent = [level.rules.maxMoves ? `of ${level.rules.maxMoves}` : '', par ? `· par ${par}` : ''].join(' ');
  $('#goalpill').textContent = GOAL_PILL[level.goalKind];
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${level.W} × ${level.H}`));
  if (level.rules.crumble) chips.append(el('span', { class: 'pill' }, 'Crumbling'));
  if (level.rules.wrap) chips.append(el('span', { class: 'pill' }, level.rules.wrap === 'all' ? 'Magic: all four sides join' : 'Magic: the sides join'));
  if (level.rules.geared) chips.append(el('span', { class: 'pill' }, 'Geared: turns every turn'));
  if (level.rules.shrink) chips.append(el('span', { class: 'pill' }, level.rules.shrink === 'spiral' ? 'Shrinking in a spiral' : 'Shrinking'));
  if (level.foes.some((f) => f.type === 'rabbit') && level.rules.rabbitsEat) chips.append(el('span', { class: 'pill' }, 'Rabbits eat'));
  if (level.rules.royal) chips.append(el('span', { class: 'pill' }, 'Royal King'));
  if (thinks(now())) chips.append(el('span', { class: 'pill' }, `They think: ${['random', 'greedy', 'two ahead', 'three ahead'][level.ai.skill]}, ${level.ai.style}`));
  hud();
  $('#setup').hidden = true;
  if (intro && !isOver(now())) {
    busy = true;
    await playIntro(board, level, { section: $('[data-screen=play]'), goal: goalCard() });
    busy = false;
  }
  if (isAuto()) return setUp();
  status(level.rules.first === 'them' ? 'They moved first. Your move.' : 'Your move. Tap a piece to see where it can go.');
  select(null);
  if (isOver(now())) finish();
}

function hud() { $('#movecount').textContent = now().t; }

// --- Autochess: the setup, then the game plays itself. --------------------
// The panel and the playing out are shared with the descent (autosetup.js).

let panel = null, setup = null;

/** Into the setup: the last one for this level is kept, if it still fits. */
function setUp() {
  const pool = myPool();
  panel = setupPanel({ tray: $('#tray'), slots: $('#slots'), level, pool, setup: setup?.level === level ? setup.list : null,
    onChange: (list) => {
      setup = { level, list };
      game.states = [setupState(level, list)];
      hud();
      $('#go').disabled = !list.some((u) => u.rabbit);
      draw();
    } });
  $('#controls').hidden = true;
  $('#setup').hidden = false;
  status(Object.keys(pool).length ? 'Set up your line, then let them go.' : 'You have no rabbits yet.');
  info(Object.keys(pool).length ? ''
    : 'Catch rabbits in the descent (or the daily) and they come here, one for every catch. Or set "Your rabbits" to every named kind.');
  panel.paint();
}

/** Play the set-up level out, turn by turn. */
async function runAuto(slow = 1) {
  if (busy) return;
  busy = true;
  $('#setup').hidden = true;
  game = { states: [setupState(level, setup.list)], moves: [] };
  status('Off they go.'); info('');
  draw();
  await playOut({ board, level, states: game.states, moves: game.moves, slow, setShown: (s) => { shown = s; },
    onTurn: (a, b) => {
      hud();
      if (b.won || b.pieces.some((p, i) => p.taken && !a.pieces[i].taken)) haptic(b.won ? [20, 40, 30] : [40, 30, 40]);
      if (!isOver(b)) status(whatHappened(a, b, { p: 0 }));
    } });
  busy = false;
  finish(true);
}

$('#go').onclick = () => runAuto();
$('#clearsetup').onclick = () => panel.clear();
$('#setuppieces').onclick = () => openSheet();
$('#setuprestart').onclick = () => show('lab');

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  // With waiting off, the button only appears when you have no move at all.
  const stuck = allMoves(now()).every((m) => m.p === -1);
  $('#wait').hidden = !(level.rules.wait || stuck);
  $('#wait').textContent = level.rules.wait ? 'Wait a turn' : 'Pass';
  if (i == null) info(stuck && !level.rules.wait
    ? 'None of your pieces can move, so you have to pass.'
    : 'Tap a piece to light up where it can go. Gold rings mark what you have to catch.');
  else {
    const type = now().pieces[i].type;
    info(`${PIECES[type].name}: ${descOf(type, now().day.rules)}${legal.length ? '' : ' It has nowhere to go right now.'}`);
  }
  draw();
}

const nameOf = (x) => PIECES[x.type].name;

/** A sentence about what just happened on their turn. */
function whatHappened(a, b, mv) {
  const bits = [];
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken) bits.push(`You took their ${nameOf(f)}.`); });
  b.foes.forEach((f) => {
    if (f.ate >= 0 && b.pieces[f.ate].taken && !a.pieces[f.ate].taken)
      bits.push(f.type === 'rabbit' ? `A rabbit ate your ${nameOf(b.pieces[f.ate])}.` : `Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
  });
  if (!bits.length) bits.push(isAuto() ? 'Next turn.' : mv.p === -1 ? 'You waited.' : 'Your move.');
  if (b.gone.length === 1 && !a.gone.length) bits.unshift('The square you left crumbled away.');
  if (b.hole && !holeOpen(a) && holeOpen(b)) bits.push('That was the last rabbit: the hole is open.');
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
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
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await new Promise((r) => setTimeout(r, 30)); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  shown = null;
  haptic(b.won ? [20, 40, 30] : b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  if (!b.won) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return finish(true);
  status(whatHappened(a, b, mv));
  select(null);
}

$('#board').addEventListener('click', (e) => {
  if (!board || busy || watching || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  if (isAuto()) {
    // Setting up: tapping one of your pieces picks its place in the line.
    if (!$('#setup').hidden) panel.pickAt(c.x, c.y);
    return;
  }
  const { x, y } = c, s = now();
  if (sel != null) {
    const m = legal.find((m) => m.x === x && m.y === y);
    if (m) return play({ p: sel, x, y });
  }
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.hole && s.hole.x === x && s.hole.y === y) return info(HOLE_DESC);
  if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
  if (shrunk(s, x, y)) return info(SHRINK_DESC);
  if (s.day.stumps.has(y * s.day.W + x)) return info(STUMP_DESC);
  const f = s.foes.find((f) => !f.taken && f.x === x && f.y === y);
  if (f) info(f.brain === 'pattern' ? 'A rabbit on a hidden pattern. Watch its tracks.' : `Their ${nameOf(f)}, thinking for itself. ${PIECES[f.type].desc}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
$('#pieces').onclick = () => openSheet();
$('#sheet-close').onclick = () => $('#sheet').close();
$('#restart').onclick = () => startGame({ intro: false });
$('#tolab').onclick = () => { show('lab'); };

// --- The end: what happened, and was it fun? -------------------------------

function golf(d) {
  if (d <= -3) return 'Albatross';
  return { '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d} over par`;
}

/** `fresh`: the game has just ended here, so it plays its tune. */
function finish(fresh = false) {
  const end = now(), how = outcome(end);
  if (fresh) ({ caught: () => sfx.fanfare(par ? sfx.levelFor(end.t - par) : 2), dusk: () => sfx.dusk(), eaten: () => sfx.lost() })[how]();
  $('#controls').hidden = true;
  $('#end').hidden = false;
  const kingFell = level.rules.royal && end.pieces.some((p) => p.taken && p.type === 'king');
  const ballLost = (level.rules.goal === 'hole' || level.rules.goal === 'descent') && end.pieces.some((p) => p.taken && p.type === 'ball');
  $('#end-score').textContent = {
    caught: end.sunk ? `Sunk in ${end.t}` : `You won in ${end.t}`,
    eaten: kingFell ? 'Your King fell' : ballLost ? 'They took the ball' : 'They took everything',
    dusk: 'Out of moves'
  }[how];
  const caught = end.foes.filter((f) => f.taken).length, lostN = end.pieces.filter((p) => p.taken).length;
  $('#end-detail').textContent = (par ? `Par ${par}${how === 'caught' ? ` · ${golf(end.t - par)}` : ''}. ` : '') +
    (level.rules.goal === 'descent'
      ? `You caught ${end.foes.filter((f) => f.target && f.taken).length} of ${end.foes.filter((f) => f.target).length} rabbit${end.foes.filter((f) => f.target).length === 1 ? '' : 's'}. `
      : end.foes.length ? `You caught ${caught} of ${end.foes.length}. ` : '') + `You lost ${lostN} of ${end.pieces.length}.`;
  $('#solver').hidden = isAuto() ? !autoBest : !settings.solve && !par;
  $('#solver').textContent = isAuto() ? "Watch the solver's setup" : "Watch the solver's win";
  $('#again').textContent = isAuto() ? 'Change the setup' : 'Play it again';
  status(''); info('');
  const pats = $('#end-patterns');
  pats.replaceChildren();
  level.foes.forEach((f, k) => {
    if (f.brain !== 'pattern' || k > 3) return;
    const cv = el('canvas', { class: 'pix' });
    patternPicture(cv, f.pattern, f.mx, f.my);
    pats.append(el('div', { class: 'pat' }, el('p', { class: 'small', style: 'margin:0' },
      `Rabbit ${k + 1}: ${describeSteps(f.pattern, f.mx, f.my)}, ${f.hops > 1 ? `${f.hops} hops a turn, ` : ''}then again.`), cv));
  });
  if (level.hole?.pattern) {
    const h = level.hole, cv = el('canvas', { class: 'pix' });
    patternPicture(cv, h.pattern, h.mx, h.my);
    pats.append(el('div', { class: 'pat' }, el('p', { class: 'small', style: 'margin:0' },
      `The hole: ${describeSteps(h.pattern, h.mx, h.my)}, then again.`), cv));
  }
  const rate = $('#rate');
  rate.replaceChildren(...[1, 2, 3, 4, 5].map((n) => el('button', {
    class: 'quiet', 'aria-pressed': 'false',
    onclick: (e) => { rating = n; rate.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); }
  }, String(n))));
  $('#note').value = '';
  $('#savenote').textContent = '';
  $('#save').disabled = false;
  draw();
}

/** Replay the solver's winning line on the board, move by move. */
async function watchSolver() {
  if (!line) {
    // Opened from a link, so the line was never worked out here. Work it out.
    $('#solver').textContent = 'Working it out…';
    await new Promise((res) => setTimeout(res, 30)); // let the label paint first
    searchLayouts({ settings, seed, parMin: 1, parMax: 15, fixed: true }, (d) => { if (d.type === 'done') line = d.line; });
    $('#solver').textContent = "Watch the solver's win";
    if (!line) { $('#savenote').textContent = 'The solver could not find a win on this one.'; return; }
  }
  // The replay keeps its own copy of the line: dealing a new level clears
  // `line`, and an animation still running must not lose what it is drawing.
  const moves = line, { states } = replay(level, moves);
  const mine = { states, k: 0, moves };
  watching = mine;
  board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  draw();
  await new Promise((r) => setTimeout(r, 350));
  for (let k = 1; k < states.length && watching === mine; k++) {
    mine.k = k;
    await board.animate(states[k - 1], states[k], moves[k - 1], 1.3);
    await new Promise((r) => setTimeout(r, 160));
  }
}

$('#solver').onclick = () => {
  if (isAuto()) {
    // The solver's setup, played out; it stays in place to change after.
    if (!autoBest || busy) return;
    setup = { level, list: autoBest.map((u) => ({ ...u })) };
    $('#end').hidden = true;
    board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return runAuto(1.2);
  }
  if (!watching) watchSolver(); else { watching = null; draw(); }
};

$('#save').onclick = () => {
  if (!rating) { $('#savenote').textContent = 'Pick a number first: 1 is a slog, 5 is great.'; return; }
  const end = now();
  // The measures go in with the rating, so they can be checked against what was fun.
  lab.notes.push({ at: Date.now(), settings, seed, par, outcome: outcome(end), moves: end.t, rating, note: $('#note').value.trim(), balance, measure: measured,
    ...(isAuto() && setup ? { setup: setup.list.map((u) => ({ ...u })) } : {}) });
  saveLab(lab);
  renderNotebook();
  $('#savenote').textContent = 'Saved to the notebook.';
  $('#save').disabled = true;
};

// New layouts from the end screen go back to the lab while the solver tests
// them, then start the game by themselves.
$('#again').onclick = () => startGame({ intro: false });
// (In autochess "again" is "change the setup": startGame goes straight to it.)
$('#next').onclick = () => { show('lab'); autoplay = true; deal({ reseed: true }); };
$('#crazy2').onclick = () => { show('lab'); autoplay = true; settings = crazy(Math.random, crazyPool()); deal({ reseed: true }); };
$('#back').onclick = () => show('lab');

// --- The lab's own buttons. ------------------------------------------------

$('#play').onclick = () => startGame();
// The same settings as a descent: a new layout of them at every depth, your
// pieces carried down (descent/main.js reads them from the link).
$('#asdescent').onclick = () => { location.href = `../descent/#${encodeLevel(settings, seed)}`; };
// Every piece there is, with its patent, to read through.
$('#allpieces').onclick = () => {
  const kinds = Object.keys(PIECES).filter((k) => k !== 'rabbit');
  const all = { pieces: kinds.map((type) => ({ type })), foes: [], rules: {}, hole: null, bramble: [], stumps: new Set() };
  $('#sheet-list').replaceChildren();
  piecesSheet($('#sheet'), $('#sheet-list'), all, { when: 'Every piece' })();
  openSheet = null; // the next game builds its own
};
$('#reroll').onclick = () => deal({ reseed: true });
$('#crazy').onclick = () => { settings = crazy(Math.random, crazyPool()); deal({ reseed: true }); };

// --- Which strange pieces Go crazy may use. --------------------------------
// A lab preference rather than part of a level, so it lives with the
// notebook, not in level links. Classic pieces are always allowed.

const CRAZY_KINDS = [...FAIRY, 'rabbit'];
const crazyPool = () => (Array.isArray(lab.crazyPool) ? lab.crazyPool : CRAZY_KINDS).filter((k) => CRAZY_KINDS.includes(k));

function buildCrazyPool() {
  const btns = CRAZY_KINDS.map((k) => {
    const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(k, k === 'rabbit' ? 'foe' : 'you'), 0, 0);
    return el('button', { class: 'quiet chip', onclick: () => {
      const on = crazyPool();
      lab.crazyPool = on.includes(k) ? on.filter((x) => x !== k) : [...on, k];
      saveLab(lab);
      paint();
    } }, cv, PIECES[k].name);
  });
  const paint = () => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(crazyPool().includes(CRAZY_KINDS[i]))));
  const all = (on) => () => { lab.crazyPool = on ? [...CRAZY_KINDS] : []; saveLab(lab); paint(); };
  $('#settings').append(el('details', { class: 'group' }, el('summary', {}, 'What Go crazy may use'),
    el('p', { class: 'small dim', style: 'margin:4px 0 10px' }, 'Classic pieces are always in. Switch off any fairy piece (or the rabbit) you do not want in random levels.'),
    el('div', { class: 'chips' }, ...btns),
    el('div', { class: 'row', style: 'margin-top:10px' },
      el('button', { class: 'quiet', onclick: all(true) }, 'All on'),
      el('button', { class: 'quiet', onclick: all(false) }, 'All off'))));
  paint();
}
$('#reset').onclick = () => { settings = defaults(); deal(); };
$('#link').onclick = async () => {
  try { await navigator.clipboard.writeText(levelLink()); note('Copied. Anyone who opens it gets exactly this level.'); }
  catch { note(levelLink()); }
};

$('.topbar .pill').before(soundToggle(), themeToggle());
buildForm();
buildCrazyPool();
updaters.forEach((u) => u());
$('#summary').textContent = summary(settings);
buildPreview();
// A level that arrives with its par needs no solving. One without, with the
// solver on, gets this exact layout checked (not replaced).
if (settings.solve && !par) deal({ fixed: !!linked });
else { note(par ? `Par ${par}.` : ''); remember(); }
renderNotebook();
show('lab');
requestAnimationFrame(previewFrame);

// For automated tests: read-only access to what is on the board.
window.__lab = { now: () => (game ? now() : null), level: () => level, par: () => par, line: () => line, play: (mv) => play(mv), board: () => board };

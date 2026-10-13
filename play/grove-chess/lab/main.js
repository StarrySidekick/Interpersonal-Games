// The lab page: the workshop, called Custom from 2026-10-13 (Timothy:
// "combine all the custom chess setting stuff like chaos and piece trials
// into one central just custom mode"). Edit settings, have the solver check
// the level, see it turn, play it, rate it; set both armies square by square,
// simulate the level with bots, or find its most playable layout
// (custom.js). In autochess you set up your pieces and the game plays itself.

import { settingShown, describe, partLine } from '../modes.js';
import { $, el, show, haptic, keepAwake, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import * as sfx from '../sounds.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { PIECES, descOf, HOLE_DESC, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, statueDesc, GHOST_DESC, GATE_DESC, WANDER_DESC, ghostAt, gateUp, cloudOver, hiddenFrom, statueAt, movesFor, playerMove, respond, isOver, outcome, initialState, allMoves, replay, crumbled, shrunk, holeOpen, placeRevived, hopIn, flagAt, carrierOf, sandAt, waterAt, SAND_DESC, WATER_DESC } from '../rules.js';
import { pickMove } from '../choose.js';
import { carriesText } from '../run.js';
import { setupPanel, setupState, playOut } from '../autosetup.js';
import { FUR, caughtRabbits } from '../rabbits.js';
import { Board, scene, sceneFrame, sprite, patternPicture, crispWidth } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { describeBalance } from '../solve.js';
import { describeMeasure } from '../metrics.js';
import { fillMenu } from '../menu.js';
import { buildForm, partsList } from '../form.js';
import { loadCatalog, registerInvented } from '../invented.js';
import { makeBoard } from '../board3d.js';
import { playIntro } from '../intro.js';
import { describeSteps } from '../day.js';
import { mountCustom } from './custom.js';
import {
  SCHEMA, defaults, clean, crazy, makeLevel, summary, encodeLevelWithPar, decodeLevel,
  loadLab, saveLab, searchLayouts, GOAL_PILL, FAIRY,
  rabbitPool, encodeLevel
} from '../lab.js';

const lab = loadLab();
// The pieces catalog: invented pieces are real here, and vetoed ones are
// left out of everything dealt from now on.
const catalog = loadCatalog();
registerInvented(catalog.invented);
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

/** The level in a sentence, and in its eight parts (modes.js describe). */
function showSummary() {
  $('#summary').textContent = summary(settings);
  $('#parts').replaceChildren(partsList(describe(settings)));
}

// --- The settings form, built from the schema (form.js). -------------------

let updaters = [];

function buildFormHere() {
  const update = buildForm($('#settings'), SCHEMA, () => settings, set, (g) => g === 'Board' || g === 'Armies', { show: settingShown, line: partLine });
  updaters = [update];
}

function set(key, value) {
  settings = clean({ ...settings, [key]: value });
  deal();
}

// --- Dealing a level: settings + seed, checked by the solver if asked. ----

let job = null, autoplay = false, custom = null;
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
  if (!fixed) settings = clean({ ...settings, veto: catalog.vetoed, invented: catalog.invented });
  // Both armies square by square, when Custom says so (custom.js).
  if (custom) settings = custom.apply(settings);
  watching = null;
  if (reseed) seed = newSeed();
  par = null; exactPar = false; line = null; autoBest = null; showBalance(null);
  level = makeLevel(settings, seed);
  updaters.forEach((u) => u());
  showSummary();
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
  crispWidth(pv, Math.min(440, pv.parentElement?.clientWidth || 440));
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
  showSummary();
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
  // The hints its settings ask for (until 2026-10-13 they were always on here).
  Object.assign(board, { reach: level.settings.showReach, reachMine: level.settings.showMyReach, guards: level.settings.showGuards,
    safe: level.settings.showSafe, beacons: level.settings.showBeacons, pins: level.settings.showPins });
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
  $('#wait').hidden = !(level.rules.wait || stuck || now().bonus);
  $('#wait').textContent = now().bonus ? 'End turn' : level.rules.wait ? 'Wait a turn' : 'Pass';
  if (i == null) info(stuck && !level.rules.wait
    ? 'None of your pieces can move, so you have to pass.'
    : 'Tap a piece to light up where it can go. Gold rings mark what you have to catch.');
  else {
    const p = now().pieces[i], type = p.type;
    info(`${PIECES[type].name}: ${descOf(type, now().day.rules)}${carriesText(p)}${legal.length || p.stun ? '' : ' It has nowhere to go right now.'}`);
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
  // Suits, weapons and the rabbits (2026-10-13).
  if (b.foeBonus === 'vines') bits.push('Their piece of Vines takes again.');
  if (b.foeBonus === 'stars') bits.push('Their piece of Stars moves twice.');
  b.foes.forEach((f) => { if (f.wounded >= 0) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.wounded])}, but its heart sends it back to your first row.`); });
  if (b.revived?.side === 'foe') bits.push(`Their ${nameOf(b.foes[b.revived.i])} had a heart: it goes back to their first row.`);
  b.pieces.forEach((p, i) => { if (p.stun && !a.pieces[i].stun) bits.push(`Your ${nameOf(p)} is stunned and sits out your next turn.`); });
  b.foes.forEach((f, k) => { if (f.stun && !a.foes[k].stun) bits.push(`Their ${nameOf(f)} is stunned and sits out their next turn.`); });
  const ra = carrierOf(a, 'foe'), rb = carrierOf(b, 'foe');
  if (ra && rb && ra.rides !== rb.rides) bits.push(`The rabbit hops to their ${nameOf(b.foes[rb.rides])}.`);
  const ma = carrierOf(a, 'you'), mb = carrierOf(b, 'you');
  if (ma && mb && ma.rides !== mb.rides) bits.push(`Your rabbit hops to your ${nameOf(b.pieces[mb.rides])}.`);
  const fa = flagAt(a), fb = flagAt(b);
  if (fb && fa && fb.by !== fa.by) bits.push(fb.by === 'you' ? 'You have the rabbit: bring it back to your first row.' : fb.by === 'foe' ? 'They have the rabbit: take the piece carrying it.' : 'The rabbit is loose.');
  if (!bits.length) bits.push(isAuto() ? 'Next turn.' : mv.p === -1 ? 'You waited.' : 'Your move.');
  if (b.gone.length === 1 && !a.gone.length) bits.unshift('The square you left crumbled away.');
  if (b.hole && !holeOpen(a) && holeOpen(b)) bits.push('That was the last rabbit: the hole is open.');
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
  b.pieces.forEach((p, i) => { if (p.splash && p.splash.t !== a.pieces[i].splash?.t) bits.push('Splash: into the water, and back to the tee.'); });
  return bits.join(' ');
}

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  const a = now();
  sel = null; legal = []; placing = null; pendingPlace = null;
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
  if (!b.won && !b.bonus) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return finish(true);
  // A suit left the turn open (Vines, Stars): the same piece goes again.
  if (b.bonus) {
    const name = nameOf(b.pieces[b.bonus.p]);
    status(b.bonus.why === 'vines' ? `Vines: your ${name} can take again. Take one, or end the turn.` : `Stars: your ${name} moves again. Move it, or end the turn.`);
    return select(b.bonus.p);
  }
  status(whatHappened(a, b, mv));
  // Hearts: one of yours is back on your first row; you may put it on
  // another free square there.
  if (b.revived?.side === 'you' && b.revived.options.length > 1) {
    placing = b.revived;
    status(`${whatHappened(a, b, mv)} Tap a lit square to put it somewhere else there, or play on.`);
    sel = null; legal = placing.options.map((q) => ({ x: q % level.W, y: Math.floor(q / level.W), place: q }));
    draw();
    return;
  }
  select(null);
}

/** A piece of yours that came back from a heart (2026-10-13): while set,
    tapping one of the squares it could go to puts it there instead. */
let placing = null, pendingPlace = null;

$('#board').addEventListener('click', async (e) => {
  if (!board || busy || watching || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  if (isAuto()) {
    // Setting up: tapping one of your pieces picks its place in the line.
    if (!$('#setup').hidden) panel.pickAt(c.x, c.y);
    return;
  }
  const { x, y } = c, s = now();
  // Hearts: putting the piece that came back on another square of its row.
  if (placing) {
    const m = legal.find((q) => q.x === x && q.y === y && q.place != null);
    if (m) { game.states[game.states.length - 1] = placeRevived(s, m.place); pendingPlace = m.place; placing = null; legal = []; draw(); return status('There. Your move.'); }
    placing = null; legal = [];
  }
  if (sel != null) {
    // The whole move (a weapon's strikes, pushes, a promotion), and a choice
    // when more than one ends on this square.
    const here = legal.filter((m) => m.x === x && m.y === y);
    const m = here.length > 1 ? await pickMove(here, s.pieces[sel]) : here[0];
    if (here.length) { if (m) return play({ p: sel, ...m, ...(pendingPlace != null ? { place: pendingPlace } : {}) }); return; }
  }
  // A rabbit of yours riding a piece (the rabbit on both sides) never moves
  // by itself: tapping that square picks the piece under it.
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y && p.rides == null);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.hole && s.hole.x === x && s.hole.y === y) return info(HOLE_DESC);
  if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
  if (shrunk(s, x, y)) return info(SHRINK_DESC);
  const sq = y * s.day.W + x;
  if (statueAt(s, sq)) return info(statueDesc(s.day.rules));
  // Neutral pieces (2026-10-13). What is under a cloud stays hidden.
  if (ghostAt(s, sq)) return info(GHOST_DESC.replace('{side}', ghostAt(s, sq) === 'you' ? 'yours' : 'theirs'));
  if (s.day.gates?.has(sq)) return info(`${GATE_DESC} It is ${gateUp(s, sq) ? 'up' : 'down'} now.`);
  if (waterAt(s, sq)) return info(WATER_DESC);
  const hidden = hiddenFrom(s, 'you');
  if (cloudOver(s, sq) && !s.foes.some((f, k) => !f.taken && f.x === x && f.y === y && !hidden.has(k))) return info(WANDER_DESC);
  if (sandAt(s, sq) && !s.foes.some((f) => !f.taken && f.x === x && f.y === y)) return info(SAND_DESC);
  const seen = (f) => !f.taken && f.x === x && f.y === y && !hidden.has(s.foes.indexOf(f));
  const f = s.foes.find((f) => seen(f) && f.rides != null) || s.foes.find(seen);
  if (f?.brain === 'carrier') return info(`The rabbit riding their ${nameOf(s.foes[f.rides])}: take that piece to win. It never moves by itself; ${hopIn(s) === 1 ? 'next turn' : `in ${hopIn(s)} turns`} it hops to another of their pieces.`);
  if (f) info(f.brain === 'pattern' ? 'A rabbit on a hidden pattern. Watch its tracks.' : `Their ${nameOf(f)}, thinking for itself. ${PIECES[f.type].desc}${carriesText(f)}`);
  const fl = flagAt(s);
  if (!f && fl && !fl.by && fl.x === x && fl.y === y) info('The rabbit to capture: take it, and the piece that took it carries it. Bring it back to your first row to win; if they take the piece carrying it, it is theirs to bring home.');
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
// pieces carried down (the runner, play/main.js, reads them from the link).
$('#asdescent').onclick = () => { location.href = `../play/?mode=descent#${encodeLevel(settings, seed)}`; };
// Every piece there is, with its patent, to read through.
$('#allpieces').onclick = () => {
  const kinds = Object.keys(PIECES).filter((k) => k !== 'rabbit' && PIECES[k].kind !== 'neutral');
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
fillMenu($('#modes'), 'custom', '../');
custom = mountCustom({
  lab, catalog, settings: () => settings, seed: () => seed, note,
  use: (S, sd) => { stopJob(); settings = S; seed = sd; deal({ fixed: true }); },
  play: () => { if ($('#play').disabled) autoplay = true; else startGame(); }
});
buildFormHere();
buildCrazyPool();
updaters.forEach((u) => u());
showSummary();
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

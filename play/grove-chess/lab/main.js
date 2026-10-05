// The lab page: edit settings, see the level turn, play it, rate it.

import { $, el, show, haptic, keepAwake } from '../../../engine/ui.js';
import { makeTarget, render } from '../../../engine/lowpoly.js';
import { PIECES, movesFor, playerMove, respond, isOver, outcome, initialState, allMoves, isBramble } from '../rules.js';
import { Board, scene, sceneFrame, sprite, patternPicture } from '../board.js';
import { piecesSheet } from '../sheet.js';
import { describeSteps } from '../day.js';
import { SCHEMA, defaults, clean, crazy, makeLevel, summary, encodeLevel, decodeLevel, loadLab, saveLab } from '../lab.js';

const lab = loadLab();
const newSeed = () => 1 + Math.floor(Math.random() * 1e9);

// A link wins; then whatever you were last working on; then the defaults.
let settings, seed;
const linked = decodeLevel(location.hash);
if (linked) ({ settings, seed } = linked);
else if (lab.current) { settings = clean(lab.current.settings); seed = lab.current.seed; }
else { settings = defaults(); seed = newSeed(); }
let level = makeLevel(settings, seed);

const levelLink = () => `${location.origin}${location.pathname}#${encodeLevel(settings, seed)}`;

function remember() {
  lab.current = { settings, seed };
  saveLab(lab);
  history.replaceState(null, '', `#${encodeLevel(settings, seed)}`);
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
  return el('div', { class: `field${f.type === 'pieces' || f.type === 'choice' ? ' wide' : ''}` }, label, ctrl);
}

function buildForm() {
  const root = $('#settings');
  for (const g of SCHEMA) root.append(el('details', { class: 'group', open: g.group === 'Board' }, el('summary', {}, g.group), ...g.fields.map(field)));
}

function set(key, value) {
  settings = clean({ ...settings, [key]: value });
  refresh();
}

function refresh() {
  level = makeLevel(settings, seed);
  remember();
  updaters.forEach((u) => u());
  $('#summary').textContent = summary(settings);
  $('#labnote').textContent = '';
  buildPreview();
}

// --- The preview: the level as a turning model. ----------------------------

const pv = $('#preview'), pitch = 0.62, pscale = 2;
let pmesh = null, pframe = null, ptarget = null, pyaw = 0.6, plast = 0;

function buildPreview() {
  pframe = sceneFrame(level, pitch, pscale);
  pv.width = pframe.w; pv.height = pframe.h;
  ptarget = makeTarget(pv.width, pv.height);
  pmesh = scene(level, initialState(level));
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

const RESULT = { caught: 'won', eaten: 'lost', dusk: 'ran out of moves', quit: 'gave up' };

function renderNotebook() {
  const box = $('#notebook');
  box.replaceChildren();
  if (!lab.notes.length) box.append(el('p', { class: 'small dim' }, 'Nothing yet. Play a level and rate it, and it lands here.'));
  for (const n of [...lab.notes].reverse()) {
    box.append(el('div', { class: 'note' },
      el('p', {}, el('b', {}, `${n.rating}/5`), ` · ${RESULT[n.outcome] || n.outcome} after ${n.moves} move${n.moves === 1 ? '' : 's'} · ${new Date(n.at).toLocaleDateString()}`),
      n.note ? el('p', {}, n.note) : null,
      el('p', { class: 'small dim' }, summary(clean(n.settings))),
      el('div', { class: 'row' },
        el('button', { class: 'quiet', onclick: () => { settings = clean(n.settings); seed = n.seed; refresh(); window.scrollTo(0, 0); } }, 'Load'),
        el('button', { class: 'quiet', onclick: () => { lab.notes = lab.notes.filter((x) => x !== n); saveLab(lab); renderNotebook(); } }, 'Remove'))));
  }
}

$('#copynotes').onclick = async () => {
  const base = `${location.origin}${location.pathname}`;
  const text = lab.notes.map((n) => [
    `${n.rating}/5, ${RESULT[n.outcome] || n.outcome} after ${n.moves} moves`,
    n.note ? `Note: ${n.note}` : null,
    summary(clean(n.settings)),
    `${base}#${encodeLevel(n.settings, n.seed)}`
  ].filter(Boolean).join('\n')).join('\n\n');
  try { await navigator.clipboard.writeText(text || 'The notebook is empty.'); $('#copynote').textContent = 'Copied.'; }
  catch { $('#copynote').textContent = 'Could not reach the clipboard on this browser.'; }
};

// --- Playing. --------------------------------------------------------------

let board = null, game = null, sel = null, legal = [], busy = false, openSheet = null, rating = 0;
// What the board shows can run ahead of the game for a moment: your move is
// drawn while they are still thinking about theirs.
let shown = null;
const now = () => game.states[game.states.length - 1];
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };
const thinks = (s) => s.foes.some((f) => !f.taken && f.brain === 'ai');

function draw() {
  board.draw({ state: shown || now(), track: level.tracks ? game.states : null, sel, legal });
}

function startGame() {
  game = { states: [initialState(level)], moves: [] };
  board = new Board($('#board'), level);
  board.redraw = draw;
  sel = null; legal = []; busy = false; rating = 0; shown = null;
  $('#sheet-list').replaceChildren();
  openSheet = piecesSheet($('#sheet'), $('#sheet-list'), level, {
    rabbit: level.foes.some((f) => f.brain === 'pattern') ? 'Each rabbit has its own pattern. Its tracks are numbered in its own colour.' : null
  });
  show('play');
  keepAwake();
  $('#end').hidden = true;
  $('#controls').hidden = false;
  $('#movemax').textContent = level.rules.maxMoves ? `of ${level.rules.maxMoves}` : '';
  $('#goalpill').textContent = { all: 'Catch them all', any: 'Catch any one', target: 'Catch the marked one' }[level.rules.goal];
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${level.W} × ${level.H}`));
  if (level.bramble.length) chips.append(el('span', { class: 'pill' }, 'Bramble'));
  if (level.rules.royal) chips.append(el('span', { class: 'pill' }, 'Royal King'));
  if (thinks(now())) chips.append(el('span', { class: 'pill' }, `They think: ${['random', 'greedy', 'two ahead', 'three ahead'][level.ai.skill]}, ${level.ai.style}`));
  hud();
  status(level.rules.first === 'them' ? 'They moved first. Your move.' : 'Your move. Tap a piece to see where it can go.');
  select(null);
  if (isOver(now())) finish();
}

function hud() { $('#movecount').textContent = now().t; }

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  // With waiting off, the button only appears when you have no move at all.
  const stuck = allMoves(now()).every((m) => m.p === -1);
  $('#wait').hidden = !(level.rules.wait || stuck);
  $('#wait').textContent = level.rules.wait ? 'Wait a turn' : 'Pass';
  if (i == null) info(stuck && !level.rules.wait
    ? 'None of your pieces can move, so you have to pass.'
    : 'Tap a piece to light up where it can go.');
  else {
    const P = PIECES[now().pieces[i].type];
    info(`${P.name}: ${P.desc}${legal.length ? '' : ' It has nowhere to go right now.'}`);
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
  if (b.foes.some((f) => !f.taken && isBramble(b, f.x, f.y))) bits.push('Something of theirs is hiding in the bramble.');
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
  if (!mid.won && thinks(mid)) { status('They are thinking…'); await new Promise((r) => setTimeout(r, 30)); }
  const b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  shown = null;
  haptic(b.won ? [20, 40, 30] : b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  if (!b.won) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return finish();
  status(whatHappened(a, b, mv));
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
  const f = s.foes.find((f) => !f.taken && f.x === x && f.y === y);
  if (f) info(f.brain === 'pattern' ? 'A rabbit on a hidden pattern. Watch its tracks.' : `Their ${nameOf(f)}, thinking for itself. ${PIECES[f.type].desc}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
$('#pieces').onclick = () => openSheet();
$('#sheet-close').onclick = () => $('#sheet').close();
$('#restart').onclick = () => startGame();
$('#tolab').onclick = () => { show('lab'); };

// --- The end: what happened, and was it fun? -------------------------------

function finish() {
  const end = now(), how = outcome(end);
  $('#controls').hidden = true;
  $('#end').hidden = false;
  const kingFell = level.rules.royal && end.pieces.some((p) => p.taken && p.type === 'king');
  $('#end-score').textContent = { caught: `You won in ${end.t}`, eaten: kingFell ? 'Your King fell' : 'They took everything', dusk: 'Out of moves' }[how];
  const caught = end.foes.filter((f) => f.taken).length, lostN = end.pieces.filter((p) => p.taken).length;
  $('#end-detail').textContent = `You caught ${caught} of ${end.foes.length}. You lost ${lostN} of ${end.pieces.length}.`;
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

$('#save').onclick = () => {
  if (!rating) { $('#savenote').textContent = 'Pick a number first: 1 is a slog, 5 is great.'; return; }
  const end = now();
  lab.notes.push({ at: Date.now(), settings, seed, outcome: outcome(end), moves: end.t, rating, note: $('#note').value.trim() });
  saveLab(lab);
  renderNotebook();
  $('#savenote').textContent = 'Saved to the notebook.';
  $('#save').disabled = true;
};

$('#again').onclick = () => startGame();
$('#next').onclick = () => { seed = newSeed(); refresh(); startGame(); };
$('#crazy2').onclick = () => { settings = crazy(); seed = newSeed(); refresh(); startGame(); };
$('#back').onclick = () => show('lab');

// --- The lab's own buttons. ------------------------------------------------

$('#play').onclick = () => startGame();
$('#reroll').onclick = () => { seed = newSeed(); refresh(); };
$('#crazy').onclick = () => { settings = crazy(); seed = newSeed(); refresh(); };
$('#reset').onclick = () => { settings = defaults(); refresh(); };
$('#link').onclick = async () => {
  try { await navigator.clipboard.writeText(levelLink()); $('#labnote').textContent = 'Copied. Anyone who opens it gets exactly this level.'; }
  catch { $('#labnote').textContent = levelLink(); }
};

buildForm();
refresh();
renderNotebook();
show('lab');
requestAnimationFrame(previewFrame);

// For automated tests: read-only access to what is on the board.
window.__lab = { now: () => (game ? now() : null), level: () => level };

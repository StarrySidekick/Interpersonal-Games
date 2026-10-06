// The daily game: today's board, the vine of everyone who played it, and the
// test mode (add ?test to the address). Drawing lives in board.js and the
// pieces menu in sheet.js; the lab (lab/) shares both.

import { $, el, show, haptic, keepAwake } from '../../engine/ui.js';
import { logSitting } from '../../engine/record.js';
import { makeTarget, render } from '../../engine/lowpoly.js';
import {
  PIECES, RABBIT_DESC, movesFor, apply, isOver, outcome, isBramble, brambleCount, replay
} from './rules.js';
import { makeDay, todayStr, describePattern, fairyFor } from './day.js';
import {
  load, save, dayEntry, readLink, parseVine, makeLink, encodeMoves, decodeMoves, cleanName
} from './vine.js';
import { Board, patternPicture, scene, sceneFrame } from './board.js';
import { piecesSheet } from './sheet.js';

// --- The day, and what this phone already knows about it. -----------------

const store = load();
const link = readLink();
const date = link.date || todayStr();
const day = makeDay(date);
const N = day.N;
const entry = dayEntry(store, date);

const chunkOf = (p) => encodeURIComponent(cleanName(p.name) || 'Someone') + '.' + encodeMoves(p.moves, N);

// Every game a link brings in is kept. If you have not played yet, the link
// you came in on is your branch: your own link will carry it forward.
const incoming = parseVine(day, link.raw);
for (const p of incoming) {
  const c = chunkOf(p);
  if (!entry.seen.includes(c)) entry.seen.push(c);
}
if (!entry.done && incoming.length) entry.branch = incoming.map(chunkOf).join('~');
save(store);

function newGame(moves = [], practice = false) {
  const { states } = replay(day, moves);
  return { moves: moves.slice(0, states.length - 1), states, practice };
}
const real = newGame(decodeMoves(entry.moves || '', N) || []);
let game = real;
const now = () => game.states[game.states.length - 1];
const rabbitOf = (s) => s.foes[0];

const ME = '#262626';
const COLORS = ['#d0473d', '#2f6fc0', '#8a4bb0', '#de7a1f', '#118a74', '#c2378a', '#5f7a20', '#9a6a0c'];

// --- What the board is showing. --------------------------------------------

const board = new Board($('#board'), day);
let view = { mode: 'play' };
let sel = null, legal = [];

board.redraw = function redraw() {
  const s = now();
  if (view.mode === 'play') {
    const paths = isOver(s) ? [{ play: game, color: ME }] : null;
    board.draw({ state: s, track: game.states, sel, legal, paths });
  } else if (view.mode === 'watch') {
    const st = view.play.states;
    board.draw({ state: st[view.k], track: st.slice(0, view.k + 1), paths: [{ play: view.play, color: view.color, upto: view.k }] });
  } else if (view.mode === 'all') {
    board.draw({ state: game.states[0], track: null, paths: view.paths });
  }
};
const redraw = () => board.redraw();

// --- Playing. --------------------------------------------------------------

let busy = false;
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };

function hud() {
  $('#movecount').textContent = now().t;
  $('#par').textContent = day.par;
}

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info('Numbers mark where the rabbit has been, in order. Tap a piece to light up where it can go.');
  else {
    const P = PIECES[now().pieces[i].type];
    info(`${P.name}: ${P.desc}${legal.length ? '' : ' It has nowhere to go right now.'}`);
  }
  redraw();
}

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  const a = now(), b = apply(a, mv);
  game.moves.push(mv); game.states.push(b);
  if (!game.practice) { entry.moves = encodeMoves(game.moves, N); save(store); }
  sel = null; legal = [];
  const r = rabbitOf(b);
  haptic(b.won ? [20, 40, 30] : r.ate >= 0 ? [40, 30, 40] : 10);
  hud();
  await board.animate(a, b, mv);
  busy = false;

  if (isOver(b)) return finish();
  let msg = r.blocked
    ? 'The rabbit tried to hop, but something was in the way. It waited.'
    : r.ate >= 0
      ? `The rabbit landed on your ${PIECES[b.pieces[r.ate].type].name} and ate it.`
      : 'The rabbit hopped. Your move.';
  if (isBramble(b, r.x, r.y)) msg = 'The rabbit is hiding in the bramble. Nothing can reach it there.';
  if (brambleCount(day, b.t) > brambleCount(day, a.t)) msg += ' The bramble crept.';
  status(msg);
  select(null);
}

board.el.addEventListener('click', (e) => {
  if (busy || view.mode !== 'play' || isOver(now())) return;
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
  if (rabbitOf(s).x === x && rabbitOf(s).y === y) info(`The rabbit. ${RABBIT_DESC}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });

// --- The end, and the vine. -----------------------------------------------

function golf(d) {
  if (d <= -3) return 'Albatross';
  return { '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d} over par`;
}

const RESULT = {
  caught: (n) => `Caught in ${n}`,
  eaten: () => 'It ate everything',
  dusk: () => 'It got away'
};
const shortResult = (p) => ({ caught: `caught in ${p.score}`, eaten: 'all eaten', dusk: 'got away' }[p.outcome]);

function myPlay() {
  const end = real.states[real.states.length - 1];
  if (!isOver(end)) return null;
  return { name: store.name || 'You', moves: real.moves, states: real.states, caught: end.won, score: end.t, outcome: outcome(end) };
}

function others() {
  const mine = myPlay();
  return parseVine(day, entry.seen.join('~')).filter((p) => !(mine && store.name && chunkOf(p) === chunkOf(mine)));
}

function finish() {
  const end = now(), how = outcome(end);
  if (!game.practice && !entry.done) {
    entry.done = true; save(store);
    logSitting({ game: 'grove-chess', data: { date, number: day.number, outcome: how, moves: end.t, par: day.par } });
  }
  $('#controls').hidden = true;
  $('#end').hidden = false;
  $('#end-score').textContent = (game.practice ? 'Practice: ' : '') + RESULT[how](end.t);
  $('#end-par').textContent = `Par ${day.par} · ` + { caught: golf(end.t - day.par), eaten: 'the rabbit won', dusk: 'dusk fell first' }[how];
  $('#end-pattern').textContent = `Its pattern: ${describePattern(day)}, then the same again. Shown the way it started; hitting an edge flips it on that axis.`;
  patternPicture($('#pattern-pic'), day.pattern, day.rabbit.mx, day.rabbit.my);
  $('#share-card').hidden = game.practice;
  $('#name').value = store.name || '';
  status({ caught: 'Caught.', eaten: 'The rabbit ate your last piece.', dusk: 'The rabbit slipped into its burrow at dusk.' }[how]);
  info('');
  renderVine();
  redraw();
}

let watchToken = 0, vineRows = [];

function renderVine() {
  const list = $('#vine-list');
  list.replaceChildren();
  const rows = [];
  const mine = myPlay();
  if (mine) rows.push({ play: mine, color: ME, label: store.name ? `${store.name} (you)` : 'You' });
  others().forEach((p, i) => rows.push({ play: p, color: COLORS[i % COLORS.length], label: p.name }));
  for (const r of rows) {
    const b = el('button', { class: 'vrow', 'aria-pressed': 'false' },
      el('span', { class: 'swatch', style: `background:${r.color}` }),
      el('span', {}, r.label),
      el('span', { class: 'dim small' }, shortResult(r.play)));
    b.onclick = () => watch(r, b);
    list.append(b);
  }
  if (rows.length <= 1) list.append(el('p', { class: 'small dim' },
    'Nobody else yet. Share your link: anyone who plays from it lands here, and so does anyone who plays from theirs.'));
  vineRows = rows;
}

async function watch(r, btn) {
  const token = ++watchToken;
  document.querySelectorAll('.vrow').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (view.mode === 'watch' && view.play === r.play) { view = { mode: 'play' }; return redraw(); }
  btn.setAttribute('aria-pressed', 'true');
  board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  view = { mode: 'watch', play: r.play, color: r.color, k: 0 };
  redraw();
  await new Promise((res) => setTimeout(res, 350));
  for (let k = 1; k < r.play.states.length; k++) {
    if (token !== watchToken) return;
    view.k = k;
    await board.animate(r.play.states[k - 1], r.play.states[k], r.play.moves[k - 1], 1.3);
    await new Promise((res) => setTimeout(res, 160));
  }
}

$('#all-paths').onclick = () => {
  watchToken++;
  document.querySelectorAll('.vrow').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (view.mode === 'all') { view = { mode: 'play' }; return redraw(); }
  view = { mode: 'all', paths: vineRows.map((r) => ({ play: r.play, color: r.color })) };
  board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  redraw();
};

$('#practice').onclick = () => {
  watchToken++;
  game = newGame([], true);
  view = { mode: 'play' };
  $('#end').hidden = true;
  $('#controls').hidden = false;
  hud();
  status('Practice. This game is not saved or shared.');
  select(null);
};

$('#share').onclick = async () => {
  const note = $('#share-note');
  const name = cleanName($('#name').value);
  if (!name) { note.textContent = 'Add a name first, so people know whose game it is.'; $('#name').focus(); return; }
  store.name = name; save(store);
  const mine = myPlay();
  const branch = parseVine(day, entry.branch).filter((p) => chunkOf(p) !== chunkOf(mine));
  const url = makeLink(location.origin + location.pathname, day, [...branch, mine]);
  const head = `Hikari Garden, rabbit #${day.number}\n${RESULT[mine.outcome](mine.score)} (par ${day.par})`;
  renderVine();
  if (navigator.share) {
    try { await navigator.share({ text: head, url }); note.textContent = 'Sent.'; return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${head}\n${url}`);
    note.textContent = 'Copied. Paste it into your chat.';
  } catch {
    note.replaceChildren('Copy this:', el('input', { type: 'text', value: `${head} ${url}`, readonly: true }));
  }
};

// --- The pieces menu. ------------------------------------------------------

const openSheet = piecesSheet($('#sheet'), $('#sheet-list'), day, {
  rabbit: day.pattern.length > 1 ? `Today's rabbit repeats its pattern every ${day.pattern.length} hops.` : 'Today’s rabbit makes the same hop every time.'
});
$('#pieces-title').onclick = openSheet;
$('#pieces-play').onclick = openSheet;
$('#sheet-close').onclick = () => $('#sheet').close();

// --- The title: today's board, turning. ------------------------------------

const dio = $('#diorama');
const pitch = 0.62, dscale = 2, frame = sceneFrame(day, pitch, dscale);
dio.width = frame.w; dio.height = frame.h;
const dctx = dio.getContext('2d'), dt = makeTarget(dio.width, dio.height), dmesh = scene(day);
let yaw = 0.6, last = 0, twirl = null;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function titleFrame(ts) {
  if ($('[data-screen=title]').hidden) return;
  const dtime = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  let lift = 0;
  if (twirl) {
    const k = Math.min(1, (ts - twirl.t0) / 1000);
    yaw = twirl.yaw0 + ease(k) * Math.PI * 4;
    lift = Math.sin(Math.PI * k) * 12;
    if (k >= 1 && !twirl.left) { twirl.left = true; dio.classList.add('leaving'); setTimeout(startPlay, 330); }
  } else yaw += dtime * 0.4;
  render(dt, dmesh, { yaw, pitch, scale: dscale, cx: dio.width / 2, cy: frame.cy - lift });
  dctx.putImageData(dt.img, 0, 0);
  requestAnimationFrame(titleFrame);
}

dio.addEventListener('click', () => {
  if (twirl) return;
  haptic(12);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return startPlay();
  twirl = { t0: performance.now(), yaw0: yaw };
});

function startPlay() {
  show('play');
  keepAwake();
  hud();
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${N} × ${N}`));
  if (day.bramble.length) chips.append(el('span', { class: 'pill' }, 'Bramble creeps'));
  if (day.stumps.size) chips.append(el('span', { class: 'pill' }, `${day.stumps.size} stump${day.stumps.size > 1 ? 's' : ''}`));
  if (isOver(now())) return finish();
  status(game.moves.length ? 'Carrying on where you left off. Your move.' : 'Your move. Tap a piece to see where it can go.');
  select(null);
}

// --- Words on the title. ---------------------------------------------------

{
  const [y, m, d] = date.split('-').map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('#daypill').textContent = `Rabbit #${day.number}`;
  $('#datenote').textContent = date === todayStr() ? `Rabbit #${day.number} · ${when}` : `Rabbit #${day.number} · the board for ${when}`;
  const end = now();
  $('#tapnote').textContent = isOver(end)
    ? 'You have played this one. Tap to see the vine.'
    : real.moves.length ? `You are on move ${end.t}. Tap to carry on.` : 'Tap the board to begin.';
  const bits = incoming.slice(-3).map((p) => ({ caught: `${p.name} caught it in ${p.score}.`, eaten: `The rabbit ate all of ${p.name}'s pieces.`, dusk: `${p.name} lost it at dusk.` }[p.outcome]));
  if (bits.length) $('#vinenote').textContent = bits.join(' ') + (isOver(end) ? '' : ' Your turn.');
}

// --- Test mode: add ?test to the address. ---------------------------------
// Jump between days, clear a board to play it again for real, and peek at
// what the day dealt. Every board is a pure function of its date, so a date
// is all it takes to get any board back.

if (new URLSearchParams(location.search).has('test')) {
  const go = (d) => { location.hash = `d=${d}`; location.reload(); };
  const shift = (n) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  $('#testpanel').hidden = false;
  $('#t-prev').onclick = () => go(shift(-1));
  $('#t-next').onclick = () => go(shift(1));
  $('#t-today').onclick = () => go(todayStr());
  $('#t-random').onclick = () => go(new Date(Date.UTC(2026, 0, 1) + Math.floor(Math.random() * 1826) * 86400000).toISOString().slice(0, 10));
  $('#t-date').value = date;
  $('#t-date').onchange = (e) => { if (e.target.value) go(e.target.value); };
  $('#t-reset').onclick = () => { delete store.days[date]; save(store); location.reload(); };
  $('#t-next-end').hidden = false;
  $('#t-next-end').onclick = () => go(shift(1));
  $('#t-spoil').textContent = `Fairy piece: ${PIECES[fairyFor(date)].name}. Hand: ${day.pieces.map((p) => PIECES[p.type].name).join(', ')}. ` +
    `Pattern: ${day.patternName} (${describePattern(day)}), ${day.pattern.length} hop${day.pattern.length > 1 ? 's' : ''}. ` +
    `Par ${day.par}. Board ${N} × ${N}. Bramble: ${day.bramble.length ? 'yes' : 'no'}. Stumps: ${day.stumps.size}.`;
}

show('title');
requestAnimationFrame(titleFrame);

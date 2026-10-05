import { $, el, show, haptic, keepAwake } from '../../engine/ui.js';
import { logSitting } from '../../engine/record.js';
import { Mesh, makeTarget, render, snapshot } from '../../engine/voxel.js';
import { model } from './models.js';
import {
  PIECES, RABBIT_DESC, BRAMBLE_DESC, STUMP_DESC, MAX_MOVES,
  initialState, movesFor, apply, isOver, isBramble, brambleCount, replay
} from './rules.js';
import { makeDay, todayStr, describePattern } from './day.js';
import {
  load, save, dayEntry, readLink, parseVine, makeLink, encodeMoves, decodeMoves, cleanName
} from './vine.js';

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

const ME = '#262626';
const COLORS = ['#d0473d', '#2f6fc0', '#8a4bb0', '#de7a1f', '#118a74', '#c2378a', '#5f7a20', '#9a6a0c'];

// --- Board drawing. --------------------------------------------------------
// The board is a small canvas drawn pixel by pixel and scaled up. Pieces are
// sprites rendered once from their voxel models.

const C = 28, RIM = 5, TOP = 16;
const boardEl = $('#board');
boardEl.width = N * C + RIM * 2;
boardEl.height = N * C + RIM * 2 + TOP;
const g = boardEl.getContext('2d');
const cellX = (x) => RIM + x * C;
const cellY = (y) => TOP + RIM + (N - 1 - y) * C;

const sprites = {};
const sprite = (k) => sprites[k] || (sprites[k] = snapshot(model(k)));

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

function px(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w, h); }

function num(n, x, y, col) {
  const s = String(n);
  px(x - 1, y - 1, s.length * 4 + 1, 7, 'rgba(247,240,218,.9)');
  [...s].forEach((ch, i) => {
    const bits = DIGITS[+ch];
    for (let b = 0; b < 15; b++) if (bits[b] === '1') px(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1, col);
  });
}

/** A crisp pixel line (Bresenham's algorithm: step along the longer axis and
    decide each pixel on the shorter one by tracking the accumulated error). */
function line(x0, y0, x1, y1, col, w = 2, dash = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  g.fillStyle = col;
  for (;;) {
    if (!dash || n % (dash * 2) < dash) g.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const centre = (x, y) => [cellX(x) + C / 2, cellY(y) + C / 2];

function drawTiles() {
  g.clearRect(0, 0, boardEl.width, boardEl.height);
  px(0, TOP, boardEl.width, boardEl.height - TOP, '#4a3220');
  px(2, TOP + 2, boardEl.width - 4, boardEl.height - TOP - 4, '#6b4a2e');
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const green = (x + y) % 2 === 0;
      px(cellX(x), cellY(y), C, C, green ? '#b9dc9b' : '#f6efd7');
      // A few blades of grass on the green squares, in fixed places.
      if (green) for (let k = 0; k < 3; k++) {
        const h = ((x * 7 + y * 13 + k * 5) * 2654435761) >>> 0;
        px(cellX(x) + 3 + (h % 21), cellY(y) + 3 + ((h >>> 8) % 21), 1, 2, '#9fca7f');
      }
    }
}

function paw(x, y) {
  const [cx, cy] = centre(x, y), col = 'rgba(107,74,44,.5)';
  px(cx + 4, cy + 7, 3, 2, col);
  px(cx + 3, cy + 5, 1, 1, col); px(cx + 5, cy + 4, 1, 1, col); px(cx + 7, cy + 5, 1, 1, col);
}

function drawTracks(track) {
  const P = track.map((s) => [s.rabbit.x, s.rabbit.y]);
  for (let i = 1; i < P.length; i++) {
    if (P[i][0] === P[i - 1][0] && P[i][1] === P[i - 1][1]) continue;
    const [ax, ay] = centre(...P[i - 1]), [bx, by] = centre(...P[i]);
    line(ax, ay, bx, by, 'rgba(120,84,50,.45)', 1, 2);
  }
  const labels = new Map();
  P.forEach(([x, y], i) => {
    if (i < P.length - 1) paw(x, y);
    labels.set(y * N + x, i);
  });
  for (const [sq, i] of labels) num(i, cellX(sq % N) + 3, cellY(Math.floor(sq / N)) + 3, '#6b4a2c');
}

function drawPaths(paths) {
  paths.forEach(({ play, color, upto }, idx) => {
    const off = ((idx % 3) - 1) * 3;
    const last = Math.min(upto ?? play.moves.length, play.moves.length);
    for (let i = 0; i < last; i++) {
      const m = play.moves[i];
      if (m.p < 0) continue;
      const a = play.states[i].pieces[m.p], b = play.states[i + 1].pieces[m.p];
      const [ax, ay] = centre(a.x, a.y), [bx, by] = centre(b.x, b.y);
      line(ax + off, ay + off, bx + off, by + off, color, 2);
      px(bx + off - 2, by + off - 2, 4, 4, color);
      if (play.states[i + 1].caught) {
        line(bx - 9, by - 9, bx + 9, by - 9, color, 2); line(bx + 9, by - 9, bx + 9, by + 9, color, 2);
        line(bx + 9, by + 9, bx - 9, by + 9, color, 2); line(bx - 9, by + 9, bx - 9, by - 9, color, 2);
      }
    }
  });
}

function drawSprite(img, x, y, lift = 0) {
  const cx = Math.round(x + C / 2), base = Math.round(y + C / 2 + 6);
  px(cx - 6, base - 1, 12, 1, 'rgba(40,30,10,.22)');
  px(cx - 9, base, 18, 2, 'rgba(40,30,10,.22)');
  px(cx - 6, base + 2, 12, 1, 'rgba(40,30,10,.22)');
  g.drawImage(img, cx - 15, Math.round(base - 31 - lift));
}

// In-flight animation, if any. Positions in board squares.
let tw = null;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
function tweenPos(t, at) {
  const k = Math.max(0, Math.min(1, (at - t.t0) / t.dur)), e = ease(k);
  return { x: t.from[0] + (t.to[0] - t.from[0]) * e, y: t.from[1] + (t.to[1] - t.from[1]) * e, k };
}

/** Draw one view of the board. */
function drawBoard(v) {
  const s = v.state, at = performance.now();
  drawTiles();

  // The square the bramble will take next, faintly, so it is never a surprise.
  const bc = brambleCount(day, s.t);
  if (v.track && bc < day.bramble.length) {
    const sq = day.bramble[bc], x = cellX(sq % N), y = cellY(Math.floor(sq / N));
    for (const [a, b] of [[6, 8], [16, 6], [10, 17], [20, 18], [7, 21]]) {
      px(x + a, y + b, 3, 1, 'rgba(63,107,44,.55)'); px(x + a + 1, y + b - 1, 1, 3, 'rgba(63,107,44,.55)');
    }
  }
  if (v.track) drawTracks(v.track);
  if (v.paths) drawPaths(v.paths);

  for (const m of v.legal || []) {
    const x = cellX(m.x), y = cellY(m.y);
    if (m.cap) {
      for (const [a, b, w, h] of [[2, 2, C - 4, 2], [2, C - 4, C - 4, 2], [2, 2, 2, C - 4], [C - 4, 2, 2, C - 4]])
        px(x + a, y + b, w, h, '#e0a526');
    } else {
      px(x + C / 2 - 3, y + C / 2 - 2, 6, 4, 'rgba(47,82,33,.5)');
      px(x + C / 2 - 2, y + C / 2 - 3, 4, 6, 'rgba(47,82,33,.5)');
    }
  }
  if (v.sel != null) {
    const p = s.pieces[v.sel], x = cellX(p.x), y = cellY(p.y);
    for (const [a, b, w, h] of [[1, 1, C - 2, 2], [1, C - 3, C - 2, 2], [1, 1, 2, C - 2], [C - 3, 1, 2, C - 2]])
      px(x + a, y + b, w, h, '#f2c14e');
  }

  // Everything that stands up, drawn back to front.
  const things = [];
  for (const sq of day.stumps) things.push({ img: sprite('stump'), x: sq % N, y: Math.floor(sq / N), lift: 0 });
  for (let i = 0; i < bc; i++) {
    const sq = day.bramble[i];
    things.push({ img: sprite('bramble'), x: sq % N, y: Math.floor(sq / N), lift: 0, under: true });
  }
  s.pieces.forEach((p, i) => {
    let x = p.x, y = p.y;
    if (tw?.piece?.i === i) ({ x, y } = tweenPos(tw.piece, at));
    things.push({ img: sprite(p.type), x, y, lift: 0 });
  });
  const showRabbit = !s.caught || (tw && at < tw.hideRabbitAt);
  if (showRabbit) {
    let x = s.rabbit.x, y = s.rabbit.y, lift = 0;
    if (tw?.rabbit) {
      const t = tweenPos(tw.rabbit, at);
      x = t.x; y = t.y; lift = Math.sin(Math.PI * t.k) * (tw.rabbit.blocked ? 3 : 9);
    }
    things.push({ img: sprite('rabbit'), x, y, lift });
  }
  things.sort((a, b) => b.y - a.y || (b.under ? 1 : 0) - (a.under ? 1 : 0));
  for (const t of things) drawSprite(t.img, cellX(0) + t.x * C, cellY(0) - t.y * C, t.lift);

  if (tw?.poof && at >= tw.poof.t0) {
    const k = (at - tw.poof.t0) / tw.poof.dur;
    if (k < 1) {
      const [cx, cy] = centre(tw.poof.x, tw.poof.y);
      for (let a = 0; a < 8; a++) {
        const r = 4 + k * 14, ang = a * Math.PI / 4;
        px(cx + Math.cos(ang) * r - 1, cy - 4 + Math.sin(ang) * r - 1, 2, 2, a % 2 ? '#ffffff' : '#f2c14e');
      }
    }
  }
}

// --- What the board is currently showing. ----------------------------------

let view = { mode: 'play' };
let sel = null, legal = [];

function redraw() {
  const s = now();
  if (view.mode === 'play') {
    const paths = isOver(s) ? [{ play: game, color: ME }] : null;
    drawBoard({ state: s, track: game.states, sel, legal, paths });
  } else if (view.mode === 'watch') {
    const st = view.play.states;
    drawBoard({ state: st[view.k], track: st.slice(0, view.k + 1), paths: [{ play: view.play, color: view.color, upto: view.k }] });
  } else if (view.mode === 'all') {
    drawBoard({ state: game.states[0], track: null, paths: view.paths });
  }
}

let loopUntil = 0;
function runLoop() {
  redraw();
  if (performance.now() < loopUntil) requestAnimationFrame(runLoop);
  else { tw = null; redraw(); }
}

/** Animate the step from `a` to `b`. Resolves when it is done. */
function animate(a, b, mv, slow = 1) {
  let t = performance.now();
  tw = {};
  if (mv.p >= 0) {
    const p0 = a.pieces[mv.p], p1 = b.pieces[mv.p];
    tw.piece = { i: mv.p, from: [p0.x, p0.y], to: [p1.x, p1.y], t0: t, dur: 190 * slow };
    t += 190 * slow;
  }
  if (b.caught) {
    tw.hideRabbitAt = t;
    tw.poof = { x: a.rabbit.x, y: a.rabbit.y, t0: t, dur: 480 };
    t += 480;
  } else {
    tw.rabbit = { from: [a.rabbit.x, a.rabbit.y], to: [b.rabbit.x, b.rabbit.y], t0: t + 70 * slow, dur: 300 * slow, blocked: b.rabbit.blocked };
    t += 370 * slow;
  }
  tw.until = t;
  const startLoop = performance.now() >= loopUntil;
  loopUntil = t;
  if (startLoop) requestAnimationFrame(runLoop);
  return new Promise((res) => setTimeout(res, t - performance.now() + 20));
}

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
  if (i == null) info('Numbers mark where the rabbit has been, in order. Dots show where a piece can go.');
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
  haptic(b.caught ? [20, 40, 30] : 10);
  hud();
  await animate(a, b, mv);
  busy = false;

  if (isOver(b)) return finish();
  let msg = b.rabbit.blocked
    ? 'The rabbit tried to hop, but something was in the way. It waited.'
    : 'The rabbit hopped. Your move.';
  if (isBramble(b, b.rabbit.x, b.rabbit.y)) msg = 'The rabbit is hiding in the bramble. Nothing can reach it there.';
  if (brambleCount(day, b.t) > brambleCount(day, a.t)) msg += ' The bramble crept.';
  status(msg);
  select(null);
}

boardEl.addEventListener('click', (e) => {
  if (busy || view.mode !== 'play' || isOver(now())) return;
  const r = boardEl.getBoundingClientRect();
  const ix = (e.clientX - r.left) * boardEl.width / r.width;
  const iy = (e.clientY - r.top) * boardEl.height / r.height;
  const x = Math.floor((ix - RIM) / C), row = Math.floor((iy - TOP - RIM) / C), y = N - 1 - row;
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const s = now();
  if (sel != null) {
    const m = legal.find((m) => m.x === x && m.y === y);
    if (m) return play({ p: sel, x, y });
  }
  const i = s.pieces.findIndex((p) => p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (s.rabbit.x === x && s.rabbit.y === y) info(`The rabbit. ${RABBIT_DESC}`);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });

// --- The end, and the vine. -----------------------------------------------

function golf(d) {
  if (d <= -3) return 'Albatross';
  return { '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d} over par`;
}

function myPlay() {
  const end = real.states[real.states.length - 1];
  if (!isOver(end)) return null;
  return { name: store.name || 'You', moves: real.moves, states: real.states, caught: end.caught, score: end.t };
}

function others() {
  const mine = myPlay();
  return parseVine(day, entry.seen.join('~')).filter((p) => !(mine && store.name && chunkOf(p) === chunkOf(mine)));
}

function finish() {
  const end = now();
  if (!game.practice && !entry.done) {
    entry.done = true; save(store);
    logSitting({ game: 'grove-chess', data: { date, number: day.number, caught: end.caught, moves: end.t, par: day.par } });
  }
  $('#controls').hidden = true;
  $('#end').hidden = false;
  $('#end-score').textContent = (game.practice ? 'Practice: ' : '') + (end.caught ? `Caught in ${end.t}` : 'It got away');
  $('#end-par').textContent = `Par ${day.par} · ` + (end.caught ? golf(end.t - day.par) : 'dusk fell first');
  $('#end-pattern').textContent = `Its pattern was ${describePattern(day)}, over and over. It bounces off the edges and waits when blocked.`;
  $('#share-card').hidden = game.practice;
  $('#name').value = store.name || '';
  status(end.caught ? 'Caught.' : 'The rabbit slipped into its burrow at dusk.');
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
  if (mine) rows.push({ play: mine, color: ME, label: `${store.name || 'You'} (you)` });
  others().forEach((p, i) => rows.push({ play: p, color: COLORS[i % COLORS.length], label: p.name }));
  for (const r of rows) {
    const b = el('button', { class: 'vrow', 'aria-pressed': 'false' },
      el('span', { class: 'swatch', style: `background:${r.color}` }),
      el('span', {}, r.label),
      el('span', { class: 'dim small' }, r.play.caught ? `caught in ${r.play.score}` : 'got away'));
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
  boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  view = { mode: 'watch', play: r.play, color: r.color, k: 0 };
  redraw();
  await new Promise((res) => setTimeout(res, 350));
  for (let k = 1; k < r.play.states.length; k++) {
    if (token !== watchToken) return;
    view.k = k;
    await animate(r.play.states[k - 1], r.play.states[k], r.play.moves[k - 1], 1.3);
    await new Promise((res) => setTimeout(res, 160));
  }
}

$('#all-paths').onclick = () => {
  watchToken++;
  document.querySelectorAll('.vrow').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (view.mode === 'all') { view = { mode: 'play' }; return redraw(); }
  view = { mode: 'all', paths: vineRows.map((r) => ({ play: r.play, color: r.color })) };
  boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const head = `Hikari Garden, rabbit #${day.number}\n` +
    `${mine.caught ? `Caught in ${mine.score}` : 'It got away'} (par ${day.par})`;
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

// --- The pieces sheet. -----------------------------------------------------

const DEMO = {
  pawn: { rabbit: [4, 4] },
  cannon: { stumps: [[3, 5]], rabbit: [3, 6] },
  grasshopper: { stumps: [[3, 5], [5, 5], [1, 3]] },
  mao: { stumps: [[4, 3]] }
};

/** A 7 x 7 picture of where a piece can go from the middle of an empty board. */
function diagram(type) {
  const D = 7, c = 8, cv = el('canvas', { class: 'diagram pix', width: D * c, height: D * c });
  const ctx = cv.getContext('2d'), demo = DEMO[type] || {};
  const dd = { N: D, stumps: new Set((demo.stumps || []).map(([x, y]) => y * D + x)), bramble: [], brambleAt: new Map(), every: 2, pattern: [[0, 1]] };
  const r = demo.rabbit || [-9, -9];
  const s = { day: dd, t: 0, pieces: [{ type, x: 3, y: 3 }], rabbit: { x: r[0], y: r[1], i: 0, mx: 1, my: 1 }, caught: false };
  const at = (x, y, col, inset = 0) => { ctx.fillStyle = col; ctx.fillRect(x * c + inset, (D - 1 - y) * c + inset, c - inset * 2, c - inset * 2); };
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) at(x, y, (x + y) % 2 ? '#f6efd7' : '#b9dc9b');
  for (const [x, y] of demo.stumps || []) at(x, y, '#6a4a30', 1);
  if (demo.rabbit) at(r[0], r[1], '#ffffff', 1);
  at(3, 3, '#553722', 1);
  for (const m of PIECES[type].moves(s, s.pieces[0])) {
    if (m.cap) { at(m.x, m.y, '#e0a526', 0); at(m.x, m.y, '#ffffff', 2); }
    else at(m.x, m.y, '#3f6b2c', 2);
  }
  return cv;
}

const spinners = [];
function sheetRow(kind, title, tag, lines, withDiagram) {
  const cv = el('canvas', { class: 'model pix', width: 48, height: 56 });
  spinners.push({ cv, ctx: cv.getContext('2d'), t: makeTarget(48, 56), mesh: new Mesh().addVox(model(kind), 0, 0, 0, 1), phase: spinners.length * 0.7 });
  return el('div', { class: 'prow' },
    el('div', {}, cv, withDiagram ? diagram(kind) : null),
    el('div', {}, el('span', { class: 'tag' }, tag), el('h3', {}, title), ...lines.filter(Boolean).map((l, i) => el('p', { class: i ? 'small dim' : '' }, l))));
}

let sheetBuilt = false;
function openSheet() {
  if (!sheetBuilt) {
    sheetBuilt = true;
    const list = $('#sheet-list');
    for (const p of day.pieces) {
      const P = PIECES[p.type];
      list.append(sheetRow(p.type, P.name, P.kind === 'fairy' ? 'Fairy piece' : 'Classic', [P.desc, P.origin], true));
    }
    list.append(sheetRow('rabbit', 'The rabbit', 'Catch it', [RABBIT_DESC, day.pattern.length > 1 ? `Today's rabbit repeats its pattern every ${day.pattern.length} hops.` : 'Today\u2019s rabbit makes the same hop every time.']));
    if (day.bramble.length) list.append(sheetRow('bramble', 'Bramble', 'Today', [BRAMBLE_DESC, 'The faint thorns on the board show where it goes next.']));
    if (day.stumps.size) list.append(sheetRow('stump', 'Stump', 'Today', [STUMP_DESC]));
    list.append(el('p', { class: 'small dim' },
      'Fairy pieces are invented chess pieces, some centuries old. In the diagrams: green squares are moves, gold is a catch, brown is something in the way.'));
  }
  $('#sheet').showModal();
  requestAnimationFrame(spin);
}

function spin(ts) {
  if (!$('#sheet').open) return;
  for (const s of spinners) {
    render(s.t, s.mesh, { yaw: ts / 1400 + s.phase, pitch: 0.4, scale: 3, cx: 24, cy: 49 });
    s.ctx.putImageData(s.t.img, 0, 0);
  }
  requestAnimationFrame(spin);
}

$('#pieces-title').onclick = openSheet;
$('#pieces-play').onclick = openSheet;
$('#sheet-close').onclick = () => $('#sheet').close();

// --- The title: today's board, turning. ------------------------------------

const T = 10;
function scene() {
  const m = new Mesh(), h = (N * T) / 2;
  m.addBox(-h - 3, -4, -h - 3, h + 3, -1, h + 3, '#5a3d26', 0, 1 << 3);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const x0 = (x - N / 2) * T, z0 = (N / 2 - 1 - y) * T;
      // Hide the sides between neighbouring tiles; only the outer ones show.
      const skip = (1 << 3) | (x < N - 1 ? 1 : 0) | (x > 0 ? 2 : 0) | (y > 0 ? 16 : 0) | (y < N - 1 ? 32 : 0);
      m.addBox(x0, -1, z0, x0 + T, 0, z0 + T, (x + y) % 2 === 0 ? '#b9dc9b' : '#f6efd7', 0, skip);
    }
  const at = (kind, x, y, id) => m.addVox(model(kind), (x - N / 2) * T + T / 2, 0, (N / 2 - 1 - y) * T + T / 2, id);
  let id = 1;
  for (const sq of day.stumps) at('stump', sq % N, Math.floor(sq / N), id++);
  if (day.bramble.length) at('bramble', day.bramble[0] % N, Math.floor(day.bramble[0] / N), id++);
  for (const p of day.pieces) at(p.type, p.x, p.y, id++);
  at('rabbit', day.rabbit.x, day.rabbit.y, id++);
  return m;
}

const dio = $('#diorama');
const pitch = 0.62, dscale = 2, hd = ((N * T) / 2 + 3) * Math.SQRT2;
const topPx = Math.ceil((hd * Math.sin(pitch) + 15 * Math.cos(pitch)) * dscale + 10);
const botPx = Math.ceil((hd * Math.sin(pitch) + 4 * Math.cos(pitch)) * dscale + 4);
dio.width = Math.ceil(hd * 2 * dscale) + 8;
dio.height = topPx + botPx;
const dctx = dio.getContext('2d'), dt = makeTarget(dio.width, dio.height), dmesh = scene();
let yaw = 0.6, last = 0, twirl = null;

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
  render(dt, dmesh, { yaw, pitch, scale: dscale, cx: dio.width / 2, cy: topPx - lift });
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
  $('#datenote').textContent = date === todayStr() ? `Rabbit #${day.number} · ${when}` : `Rabbit #${day.number}, an earlier board, from ${when}`;
  const end = now();
  $('#tapnote').textContent = isOver(end)
    ? 'You have played this one. Tap to see the vine.'
    : real.moves.length ? `You are on move ${end.t}. Tap to carry on.` : 'Tap the board to begin.';
  const bits = incoming.slice(-3).map((p) => p.caught ? `${p.name} caught it in ${p.score}.` : `${p.name} lost it at dusk.`);
  if (bits.length) $('#vinenote').textContent = bits.join(' ') + (isOver(end) ? '' : ' Your turn.');
}

show('title');
requestAnimationFrame(titleFrame);

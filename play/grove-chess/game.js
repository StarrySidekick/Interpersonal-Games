import { $, el, show, haptic, keepAwake } from '../../engine/ui.js';
import { logSitting } from '../../engine/record.js';
import { Mesh, makeTarget, render, snapshot } from '../../engine/lowpoly.js';
import { model } from './models.js';
import {
  PIECES, RABBIT_DESC, BRAMBLE_DESC, STUMP_DESC, MAX_MOVES,
  movesFor, apply, isOver, outcome, isBramble, brambleCount, replay
} from './rules.js';
import { makeDay, todayStr, describePattern, fairyFor } from './day.js';
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
// sprites rendered once from their 3D models.

const C = 28, RIM = 5, TOP = 16;
const boardEl = $('#board');
boardEl.width = N * C + RIM * 2;
boardEl.height = N * C + RIM * 2 + TOP;
const cellX = (x) => RIM + x * C;
const cellY = (y) => TOP + RIM + (N - 1 - y) * C;

const sprites = {};
const sprite = (k) => sprites[k] || (sprites[k] = snapshot(model(k)));

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

let g = boardEl.getContext('2d');
const boardCtx = g;
/** Run the pixel helpers below against another canvas for a moment. */
function drawingOn(ctx, fn) { g = ctx; try { fn(); } finally { g = boardCtx; } }

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

  // Where the selected piece can go: the whole square lights up. Gold for a
  // move, coral for a catch.
  const frame = (x, y, w, col) => {
    px(x, y, C, w, col); px(x, y + C - w, C, w, col); px(x, y, w, C, col); px(x + C - w, y, w, C, col);
  };
  for (const m of v.legal || []) {
    const x = cellX(m.x), y = cellY(m.y);
    if (m.cap) { px(x, y, C, C, 'rgba(226,96,62,.5)'); frame(x, y, 2, '#c8462e'); }
    else { px(x, y, C, C, 'rgba(242,193,78,.45)'); frame(x, y, 1, 'rgba(176,128,24,.55)'); }
  }
  if (v.sel != null) {
    const p = s.pieces[v.sel], x = cellX(p.x), y = cellY(p.y);
    px(x, y, C, C, 'rgba(242,193,78,.75)'); frame(x, y, 2, '#c9921a');
  }

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


  // Everything that stands up, drawn back to front.
  const things = [];
  for (const sq of day.stumps) things.push({ img: sprite('stump'), x: sq % N, y: Math.floor(sq / N), lift: 0 });
  for (let i = 0; i < bc; i++) {
    const sq = day.bramble[i];
    things.push({ img: sprite('bramble'), x: sq % N, y: Math.floor(sq / N), lift: 0, under: true });
  }
  s.pieces.forEach((p, i) => {
    // An eaten piece stays on the board until the rabbit lands on it.
    if (p.taken && !(tw?.eat?.i === i && at < tw.eat.at)) return;
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

  for (const pf of [tw?.poof, tw?.eat?.poof]) {
    if (!pf || at < pf.t0) continue;
    const k = (at - pf.t0) / pf.dur;
    if (k >= 1) continue;
    const [cx, cy] = centre(pf.x, pf.y);
    for (let a = 0; a < 8; a++) {
      const r = 4 + k * 14, ang = a * Math.PI / 4;
      px(cx + Math.cos(ang) * r - 1, cy - 4 + Math.sin(ang) * r - 1, 2, 2, a % 2 ? pf.c1 : pf.c2);
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
    tw.poof = { x: a.rabbit.x, y: a.rabbit.y, t0: t, dur: 480, c1: '#ffffff', c2: '#f2c14e' };
    t += 480;
  } else {
    tw.rabbit = { from: [a.rabbit.x, a.rabbit.y], to: [b.rabbit.x, b.rabbit.y], t0: t + 70 * slow, dur: 300 * slow, blocked: b.rabbit.blocked };
    t += 370 * slow;
    if (b.rabbit.ate >= 0) {
      tw.eat = { i: b.rabbit.ate, at: t - 40, poof: { x: b.rabbit.x, y: b.rabbit.y, t0: t - 40, dur: 480, c1: '#7a5133', c2: '#c8462e' } };
      t += 440;
    }
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
  haptic(b.caught ? [20, 40, 30] : b.rabbit.ate >= 0 ? [40, 30, 40] : 10);
  hud();
  await animate(a, b, mv);
  busy = false;

  if (isOver(b)) return finish();
  let msg = b.rabbit.blocked
    ? 'The rabbit tried to hop, but something was in the way. It waited.'
    : b.rabbit.ate >= 0
      ? `The rabbit landed on your ${PIECES[b.pieces[b.rabbit.ate].type].name} and ate it.`
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
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
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
  return { name: store.name || 'You', moves: real.moves, states: real.states, caught: end.caught, score: end.t, outcome: outcome(end) };
}

const RESULT = {
  caught: (n) => `Caught in ${n}`,
  eaten: () => 'It ate everything',
  dusk: () => 'It got away'
};
const shortResult = (p) => ({ caught: `caught in ${p.score}`, eaten: 'all eaten', dusk: 'got away' }[p.outcome]);

function others() {
  const mine = myPlay();
  return parseVine(day, entry.seen.join('~')).filter((p) => !(mine && store.name && chunkOf(p) === chunkOf(mine)));
}

function finish() {
  const end = now();
  if (!game.practice && !entry.done) {
    entry.done = true; save(store);
    logSitting({ game: 'grove-chess', data: { date, number: day.number, outcome: outcome(end), moves: end.t, par: day.par } });
  }
  const how = outcome(end);
  $('#controls').hidden = true;
  $('#end').hidden = false;
  $('#end-score').textContent = (game.practice ? 'Practice: ' : '') + RESULT[how](end.t);
  $('#end-par').textContent = `Par ${day.par} \u00b7 ` + { caught: golf(end.t - day.par), eaten: 'the rabbit won', dusk: 'dusk fell first' }[how];
  $('#end-pattern').textContent = `Its pattern: ${describePattern(day)}, then the same again. Shown the way it started; hitting an edge flips it on that axis.`;
  patternPicture($('#pattern-pic'));
  $('#share-card').hidden = game.practice;
  $('#name').value = store.name || '';
  status({ caught: 'Caught.', eaten: 'The rabbit ate your last piece.', dusk: 'The rabbit slipped into its burrow at dusk.' }[how]);
  info('');
  renderVine();
  redraw();
}

/**
 * The rabbit's pattern as a picture: one full run of it, numbered, then the
 * start of the next run in faint lines so you can see it repeat. Drawn the way
 * it was facing at the start of the day.
 */
function patternPicture(cv) {
  const { mx, my } = day.rabbit;
  const steps = day.pattern.map(([dx, dy]) => [dx * mx, dy * my]);
  const L = steps.length, pts = [[0, 0]];
  for (let r = 0; r < (L === 1 ? 3 : 2); r++)
    for (const [dx, dy] of steps) { const [x, y] = pts[pts.length - 1]; pts.push([x + dx, y + dy]); }
  const span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k])) + 1;
  while (pts.length > L + 1 && (span(0) > 9 || span(1) > 7)) pts.pop();
  const minX = Math.min(...pts.map((p) => p[0])), maxY = Math.max(...pts.map((p) => p[1]));
  const c = 14, W = span(0), H = span(1);
  cv.width = W * c; cv.height = H * c;
  cv.style.width = `${W * c * 2}px`;
  const ctx = cv.getContext('2d');
  const ctr = ([x, y]) => [(x - minX) * c + c / 2, (maxY - y) * c + c / 2];
  drawingOn(ctx, () => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x * c, y * c, c, c, (x + y) % 2 ? '#f6efd7' : '#b9dc9b');
    const [sx, sy] = ctr(pts[0]);
    px(sx - 5, sy - 5, 10, 10, '#f0a3b2'); px(sx - 4, sy - 4, 8, 8, '#ffffff');
    for (let i = pts.length - 1; i >= 1; i--) {
      const faint = i > L, [ax, ay] = ctr(pts[i - 1]), [bx, by] = ctr(pts[i]);
      line(ax, ay, bx, by, faint ? 'rgba(107,74,44,.3)' : '#6b4a2c', faint ? 1 : 2);
      if (!faint) px(bx - 2, by - 2, 4, 4, '#6b4a2c');
    }
    for (let i = 1; i <= L; i++) { const [bx, by] = ctr(pts[i]); num(i, bx + 2, by - 6, '#3a2616'); }
  });
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
    if (m.cap) { at(m.x, m.y, '#e2603e', 0); at(m.x, m.y, '#ffffff', 2); }
    else at(m.x, m.y, '#ecc95a', 0);
  }
  return cv;
}

const spinners = [];
function sheetRow(kind, title, tag, lines, withDiagram) {
  const cv = el('canvas', { class: 'model pix', width: 48, height: 56 });
  spinners.push({ cv, ctx: cv.getContext('2d'), t: makeTarget(48, 56), mesh: new Mesh().add(model(kind), 0, 0, 0, 1), phase: spinners.length * 0.7 });
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
      'Fairy pieces are invented chess pieces, some centuries old. In the diagrams: gold squares are moves, coral is a catch, brown is something in the way.'));
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
  const at = (kind, x, y, id) => m.add(model(kind), (x - N / 2) * T + T / 2, 0, (N / 2 - 1 - y) * T + T / 2, id);
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
  $('#datenote').textContent = date === todayStr() ? `Rabbit #${day.number} \u00b7 ${when}` : `Rabbit #${day.number} \u00b7 the board for ${when}`;
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

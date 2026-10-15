// Changeling, the page: one board a day. You are one piece, every move is a
// capture, and you become whatever you take. Take them all, in as few tries
// as you can. The rules, the solver and the dealer are in rules.js; this
// file draws the board, takes taps, keeps the day in this browser and makes
// the share.
//
// A try ends when you step back. Stepping back costs nothing more however
// far you go, so a try is one guess at the route, the way a row is one
// guess in Wordle. Six tries.

import { deal, solve, targets, moveSet, pathOf, occupancy, aWayToClear, PIECES, SHAPES, SHAPE_ORDER, FAIRIES, dayNumber, feelOf, FIRST_DAY } from './rules.js';
import { $, el, haptic, themeToggle } from '../../engine/ui.js';
import { tone, noise, soundToggle } from '../../engine/sound.js';
import { logSitting } from '../../engine/record.js';
import { releaseLine } from '../../engine/release.js';
import { rng } from '../../engine/seed.js';
import { snapshot } from '../../engine/lowpoly.js';
import { model } from '../grove-chess/models.js';
import { hz } from '../grove-chess/sounds.js';

const TRIES = 6;
const C = 28, RIM = 5, TOP = 18;            // a square, the rim, room above the top row for tall pieces
const LIGHT = '#b9dc9b', DARK = '#f6efd7';  // the Grove's grass and cream
const GOLD = '#f5c13a', PURPLE = '#9a5ad6';
const GLOW = '#f5c13a';                     // your piece's plinth: the changeling inside it
// Squares coloured as on the Grove's boards: the piece you picked up, and
// the pieces it can take.
const SEL = ['#e9b02a', 0.75], CATCH = ['#e2603e', 0.72], PEEK = ['#9a5ad6', 0.3], PEEKED = ['#9a5ad6', 0.6];

// --- The day. ----------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const localDate = (t = new Date()) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
const addDays = (date, k) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
const asDate = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const nice = (date) => asDate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const weekday = (date) => asDate(date).toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const today = localDate();
// The days check.mjs holds steady: every one of them can be played in test
// mode.
const LAST_DAY = addDays(FIRST_DAY, 399);

// A link can carry a day, a name and that person's tries (see makeLink).
function readLink() {
  const h = new URLSearchParams(location.hash.slice(1));
  const d = h.get('d');
  if (!d || !/^\d{4}-\d\d-\d\d$/.test(d) || d < FIRST_DAY || d > addDays(today, 1)) return null;
  return { date: d, name: (h.get('n') || '').slice(0, 16), tries: (h.get('r') || '').split('.').filter(Boolean).slice(0, TRIES) };
}
const link = readLink();
let date = params.get('d') && TEST ? params.get('d') : link?.date || today;
if (!/^\d{4}-\d\d-\d\d$/.test(date) || date < FIRST_DAY) date = FIRST_DAY;

// --- What this browser remembers. -------------------------------------------
// Each day: the route you are on (pieces' indices), which try it is, whether
// you are stepping back, every finished try, and the result. Kept so a
// reload, or coming back hours later, carries on where you were.

// Test mode keeps its own days, so trying out boards ahead of time leaves
// your real days, and your record, as they were.
const KEY = TEST ? 'changeling.test.v1' : 'changeling.v1';
function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return s; } catch { /* blocked or corrupt: start fresh */ }
  return { days: {}, name: '' };
}
const store = loadStore();
const saveStore = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* full or blocked: play on */ } };

let level, solved, N, sqIndex, entry, tune;

function openDay(d) {
  date = d;
  level = deal(date);
  solved = solve(level);
  N = level.pieces.length;
  sqIndex = new Int8Array(level.W * level.H).fill(-1);
  level.pieces.forEach((p, i) => { sqIndex[p.sq] = i; });
  entry = store.days[date] || (store.days[date] = { route: [], tries: 1, back: false, log: [], done: null });
  tune = melody(date, N);
  view.sel = false; view.peek = null;
  view.anim = null; view.parts = []; view.replay = null;
  if (TEST) history.replaceState(null, '', `?test&d=${date}`);
  sizeBoard();
  paintHead();
  paintKinds();
  update();
  // A reload in the middle of the last hop: the move was kept, the ending
  // was not, so finish it now.
  if (!entry.done && !options(entry.route).length && (entry.route.length === N || (entry.tries >= TRIES && !entry.back))) finish(entry.route.length === N);
}

// --- The rules, on the live route. ----------------------------------------------

const full = () => (1 << N) - 1;
const maskOf = (route) => route.reduce((m, j) => m & ~(1 << j), full());
const hostOf = (route) => (route.length ? level.pieces[route[route.length - 1]] : level.start);
const leftOf = (route) => N - route.length;
/** The pieces the host can take: their indices. */
function options(route, mask = maskOf(route), host = hostOf(route)) {
  return targets(level, occupancy(level, mask), host.sq, host.kind).map((s) => sqIndex[s]);
}

// --- Drawing. ------------------------------------------------------------------

const cv = $('#board'), g = cv.getContext('2d');
const view = { sel: false, peek: null, anim: null, parts: [], replay: null };
const sprites = {};
const sprite = (kind, mine) => sprites[kind + mine] || (sprites[kind + mine] = snapshot(model(kind, mine ? 'you' : 'foe', null, mine ? GLOW : null)));

const cellX = (sq) => RIM + (sq % level.W) * C;
const cellY = (sq) => TOP + RIM + ((sq / level.W) | 0) * C;
const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w, h); };

function sizeBoard() {
  cv.width = level.W * C + RIM * 2;
  cv.height = level.H * C + RIM * 2 + TOP;
  crisp();
}
function crisp() {
  // As big as fits, but only by a whole number of screen pixels per pixel,
  // so every pixel is the same size (the Grove's crispWidth).
  const room = Math.min(cv.parentElement.clientWidth, 460), dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.floor((room * dpr) / cv.width));
  cv.style.width = `${(cv.width * k) / dpr}px`;
}
addEventListener('resize', () => { crisp(); });

function ring(sq, col, w = 2, inset = 1) {
  const x = cellX(sq) + inset, y = cellY(sq) + inset, n = C - inset * 2;
  P(x, y, n, w, col); P(x, y + n - w, n, w, col); P(x, y, w, n, col); P(x + n - w, y, w, n, col);
}
/** A small star in a square's top corner: today's stranger. */
function star(sq) {
  const x = cellX(sq) + C - 7, y = cellY(sq) + 2;
  P(x + 2, y, 1, 5, GOLD); P(x, y + 2, 5, 1, GOLD); P(x + 1, y + 1, 3, 3, GOLD); P(x + 2, y + 2, 1, 1, '#fff6d0');
}
/** A ring round a square with a thin dark edge, so it reads on the grass
    and the cream alike (the Grove's rings). */
function band(sq, col, inset) {
  ring(sq, 'rgba(20,14,8,.4)', 1, inset);
  ring(sq, col, 2, inset + 1);
}
/** Colour a moved k of the way to colour b. */
function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((A >> sh) & 255) + ((((B >> sh) & 255) - ((A >> sh) & 255)) * k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function dot(sq, col, r = 2) {
  const cx = cellX(sq) + C / 2, cy = cellY(sq) + C / 2 + 7;
  P(cx - r, cy - r, r * 2, r * 2, col);
}
function drawSprite(img, px, py, lift = 0, shadow = 'rgba(40,30,10,.22)') {
  // (px, py) is the middle of the square the piece stands on.
  const cx = Math.round(px), base = Math.round(py + 6);
  P(cx - 6, base - 1, 12, 1, shadow); P(cx - 9, base, 18, 2, shadow); P(cx - 6, base + 2, 12, 1, shadow);
  g.drawImage(img, cx - 15, Math.round(base - 31 - lift));
}
const mid = (sq) => [cellX(sq) + C / 2, cellY(sq) + C / 2];

/** The board's squares. `tint` colours some of them: square -> [colour, how much]. */
function tiles(tint = new Map()) {
  g.clearRect(0, 0, cv.width, cv.height);
  const { W, H, on } = level;
  for (const pass of [0, 1])
    for (let s = 0; s < W * H; s++) {
      if (!on[s]) continue;
      const i = pass ? RIM - 2 : RIM;
      P(cellX(s) - i, cellY(s) - i, C + i * 2, C + i * 2, pass ? '#6b4a2e' : '#4a3220');
    }
  for (let s = 0; s < W * H; s++) {
    if (!on[s]) continue;
    const x = s % W, y = (s / W) | 0;
    const base = (x + y) % 2 === 0 ? LIGHT : DARK, t = tint.get(s);
    P(cellX(s), cellY(s), C, C, t ? mix(base, t[0], t[1]) : base);
  }
}

/** One frame. `show` is the route on the board (the live one, or a replay's). */
function draw(now = performance.now()) {
  const show = view.replay ? view.replay.route : entry.route;
  const mask = maskOf(show), host = hostOf(show), occ = occupancy(level, mask);
  const live = !view.anim && !view.replay && !entry.done;

  // Coloured squares: the piece you picked up, gold, and what it can take,
  // red, as on the Grove's boards; a piece you tapped to look at, purple,
  // with its moves.
  const tint = new Map();
  if (live && view.peek != null) {
    const p = level.pieces[view.peek];
    for (const s of moveSet(level, occ, p.sq, p.kind)) tint.set(s, PEEK);
    tint.set(p.sq, PEEKED);
  }
  if (live && view.sel) {
    tint.set(host.sq, SEL);
    for (const j of options(show)) tint.set(level.pieces[j].sq, CATCH);
  }
  tiles(tint);

  // Pieces' moves, as rings round the squares, the way the Grove's other
  // modes show them: gold inside the square for yours, purple near its edge
  // for the others. A line stops at the first piece it meets. By default the
  // purple is only for the pieces you can take now, so you can see where
  // each would take you; every piece's at once covers most of the board.
  // You are in no one's way: whoever you take, you leave your square.
  const rings = ringMode();
  if (rings !== 'off' && !entry.done) {
    const whose = rings === 'all' ? [...Array(N).keys()].filter((j) => mask & (1 << j)) : options(show);
    for (const j of whose) {
      const p = level.pieces[j];
      for (const s of moveSet(level, occ, p.sq, p.kind)) band(s, PURPLE, 1);
    }
    for (const s of moveSet(level, occ, host.sq, host.kind)) band(s, GOLD, 5);
  }
  // Today's stranger wears a star.
  for (let j = 0; j < N; j++) if ((mask & (1 << j)) && level.pieces[j].kind === level.fairy) star(level.pieces[j].sq);

  // The pieces, back row first so nearer ones stand in front.
  const a = view.anim;
  const things = [];
  for (let j = 0; j < N; j++) {
    // The piece being taken stays until you land on it; the one you are
    // stepping back off is drawn below, fading in.
    const taking = a && a.type === 'take' && a.j === j && now < a.t0 + a.dur * 0.82;
    if (!(mask & (1 << j)) && !taking) continue;
    if (a && a.type === 'back' && a.j === j) continue;
    const [x, y] = mid(level.pieces[j].sq);
    things.push({ y, img: sprite(level.pieces[j].kind, false), x });
  }
  if (a && a.type === 'back') {
    // The piece you stepped back off fades in where it stood.
    const k = Math.min(1, (now - a.t0) / a.dur);
    const [x, y] = mid(level.pieces[a.j].sq);
    things.push({ y, img: sprite(level.pieces[a.j].kind, false), x, alpha: k });
  }
  // You: on your square, or in the air between two.
  let me;
  if (a) {
    const k = Math.min(1, (now - a.t0) / a.dur), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    const [x0, y0] = mid(a.from), [x1, y1] = mid(a.to);
    const kind = a.type === 'take' ? (k < 0.82 ? a.fromKind : a.toKind) : (k < 0.5 ? a.fromKind : a.toKind);
    me = { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, img: sprite(kind, true), lift: Math.sin(Math.PI * k) * a.arc, mine: true };
  } else {
    const [x, y] = mid(host.sq);
    const shake = view.shake && now < view.shake ? Math.round(Math.sin(now / 22) * 2) : 0;
    me = { x: x + shake, y, img: sprite(host.kind, true), lift: 0, mine: true };
  }
  things.push(me);
  things.sort((p, q) => p.y - q.y);
  for (const t of things) {
    if (t.alpha != null) g.globalAlpha = t.alpha;
    drawSprite(t.img, t.x, t.y, t.lift || 0, t.mine ? 'rgba(245,193,58,.45)' : undefined);
    g.globalAlpha = 1;
  }

  // Leaves and sparks from a piece just taken.
  view.parts = view.parts.filter((q) => now < q.t0 + q.life);
  for (const q of view.parts) {
    const t = (now - q.t0) / 1000;
    if (t < 0) continue;
    P(q.x + q.vx * t, q.y + q.vy * t + 60 * t * t, q.s, q.s, q.col);
  }

  if (a && now >= a.t0 + a.dur) { view.anim = null; a.done?.(); }
  if (view.anim || view.parts.length || (view.shake && now < view.shake)) requestAnimationFrame(draw);
}
const redraw = () => requestAnimationFrame(draw);

function burst(sq, now, cols) {
  const [x, y] = mid(sq);
  const r = rng(`${sq}:${now}`);
  for (let i = 0; i < 18; i++) {
    const ang = r() * Math.PI * 2, sp = 25 + r() * 55;
    view.parts.push({ x: x - 1, y: y - 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, s: r() < 0.3 ? 3 : 2, col: cols[i % cols.length], t0: now, life: 500 + r() * 300 });
  }
}

/** Move the host from one square to another: `type` is 'take' or 'back'. */
function hop(type, from, to, fromKind, toKind, j, done) {
  const d = Math.hypot((to % level.W) - (from % level.W), ((to / level.W) | 0) - ((from / level.W) | 0));
  const leaps = pathOf(level, from, to, type === 'take' ? fromKind : toKind).length === 2;
  const now = performance.now();
  view.anim = { type, from, to, fromKind, toKind, j, t0: now, dur: Math.min(440, 200 + d * 45) * (type === 'back' ? 0.7 : 1), arc: leaps ? 14 + d * 2 : 5, done };
  if (type === 'take') burst(to, now + view.anim.dur * 0.82, ['#6c4795', '#9a5ad6', '#b9dc9b', '#72ad56', '#f6efd7']);
  redraw();
}

// --- Sound. ------------------------------------------------------------------
// Each piece you take plays the next note of the day's tune, so a clear plays
// the whole of it, and a try that stops short leaves it unfinished. The tune
// is the same for everyone on the same day: a walk around the pentatonic
// scale, which is why any run of it sounds fine.

function melody(d, n) {
  const r = rng(`tune:${d}`), out = [];
  let deg = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(r() * 7)];
    deg = Math.max(2, Math.min(12, deg));
    out.push(deg);
  }
  out[n - 1] = 10; // it ends home, an octave up
  return out;
}
const pluck = (deg, at = 0, vol = 1) => {
  const f = hz(deg);
  tone({ f, type: 'triangle', at, dur: 0.42, vol: 0.2 * vol, attack: 0.004 });
  tone({ f: f * 2, type: 'sine', at, dur: 0.18, vol: 0.06 * vol });
};
const SFX = {
  pick: () => tone({ f: 880, f2: 990, type: 'sine', dur: 0.05, vol: 0.06 }),
  peek: () => tone({ f: 520, type: 'sine', dur: 0.05, vol: 0.05 }),
  take: (i, at) => { pluck(tune[i], at); noise({ at, dur: 0.12, vol: 0.06, from: 4000, to: 1500, type: 'bandpass', q: 2 }); },
  leap: () => tone({ f: 300, f2: 520, type: 'triangle', dur: 0.12, vol: 0.06 }),
  stuck: () => { tone({ f: 233, f2: 220, type: 'triangle', dur: 0.3, vol: 0.18 }); tone({ f: 175, f2: 165, type: 'triangle', at: 0.22, dur: 0.45, vol: 0.18 }); },
  back: () => tone({ f: 600, f2: 300, type: 'sine', dur: 0.16, vol: 0.07 }),
  clear: (at) => { [0, 2, 4, 5].forEach((deg, k) => pluck(10 + deg, at + k * 0.09, 0.9)); pluck(15, at + 0.5, 1.1); pluck(10, at + 0.5, 0.6); pluck(12, at + 0.5, 0.6); }
};

// --- Taps. ---------------------------------------------------------------------

function cellAt(e) {
  const r = cv.getBoundingClientRect();
  const ix = ((e.clientX - r.left) * cv.width) / r.width, iy = ((e.clientY - r.top) * cv.height) / r.height;
  const x = Math.floor((ix - RIM) / C), y = Math.floor((iy - TOP - RIM) / C);
  if (x < 0 || y < 0 || x >= level.W || y >= level.H) return null;
  return y * level.W + x;
}

/** Finish the hop in flight at once, so a quick tap is never lost. */
function settle() {
  const a = view.anim;
  if (!a || view.replay) return;
  view.anim = null;
  a.done?.();
}

// As in the Grove's other modes: tap your piece to pick it up, and the
// pieces it can take turn red; tap one to move there and take it. Your piece
// stays picked up after a move, since it is the only one you have. Tap any
// other piece to see how it moves; tap an empty square to put yours down.
cv.addEventListener('click', (e) => {
  settle();
  if (view.anim || view.replay || entry.done) return;
  const sq = cellAt(e), route = entry.route, mask = maskOf(route), host = hostOf(route);
  const j = sq == null ? -1 : sqIndex[sq];
  const piece = j >= 0 && (mask & (1 << j)) ? j : -1;
  if (sq === host.sq) {
    view.sel = !view.sel; view.peek = null;
    if (view.sel) SFX.pick();
  } else if (view.sel && piece >= 0 && options(route).includes(piece)) {
    take(piece);
    return;
  } else if (piece >= 0) {
    view.peek = view.peek === piece ? null : piece;
    SFX.peek();
  } else {
    view.sel = false; view.peek = null;
  }
  paintInfo(); redraw();
});

function take(j) {
  const from = hostOf(entry.route);
  view.peek = null;
  entry.back = false;
  entry.route.push(j);
  const to = level.pieces[j], i = entry.route.length - 1;
  saveStore();
  if (pathOf(level, from.sq, to.sq, from.kind).length === 2) SFX.leap();
  hop('take', from.sq, to.sq, from.kind, to.kind, j, () => {
    SFX.take(i, 0);
    haptic(12);
    if (!maskOf(entry.route)) finish(true);
    else if (!options(entry.route).length) stuck();
    update();
  });
  paintInfo();
}

function stuck() {
  SFX.stuck();
  haptic([20, 40, 20]);
  view.shake = performance.now() + 380;
  redraw();
  if (entry.tries >= TRIES) finish(false);
}

$('#back').onclick = () => {
  settle();
  if (view.anim || view.replay || entry.done || !entry.route.length) return;
  if (!entry.back) {
    if (entry.tries >= TRIES) return;
    // The first step back ends this try.
    entry.log.push(entry.route.slice());
    entry.tries++;
    entry.back = true;
  }
  const j = entry.route.pop(), host = hostOf(entry.route);
  view.peek = null;
  saveStore();
  SFX.back();
  hop('back', level.pieces[j].sq, host.sq, level.pieces[j].kind, host.kind, j, () => update());
  update();
};

$('#giveup').onclick = () => {
  settle();
  if (view.anim || entry.done) return;
  finish(false);
};

function finish(cleared) {
  entry.log.push(entry.route.slice());
  const best = Math.min(...entry.log.map((r) => N - r.length));
  entry.done = { cleared, tries: entry.tries, best };
  saveStore();
  if (!TEST) logSitting({ game: 'changeling', data: { date, number: dayNumber(date) + 1, cleared, tries: entry.tries, best, pieces: N } });
  if (cleared) { SFX.clear(0.35); haptic([30, 50, 30, 50, 60]); burstAll(); }
  update();
  setTimeout(() => $('#end').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 500);
}

function burstAll() {
  const now = performance.now() + 300, [x, y] = mid(hostOf(entry.route).sq);
  const r = rng(`clear:${date}`);
  for (let i = 0; i < 40; i++) {
    const ang = r() * Math.PI * 2, sp = 40 + r() * 90;
    view.parts.push({ x, y: y - 10, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 70, s: 2 + (r() < 0.3 ? 1 : 0), col: [GOLD, '#fff3c4', '#b9dc9b', '#72ad56'][i % 4], t0: now + r() * 200, life: 900 + r() * 500 });
  }
  redraw();
}

// --- Words on the page. -----------------------------------------------------------

const name = (kind) => PIECES[kind].name;
const say = (kind) => PIECES[kind].say;
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function paintHead() {
  const num = dayNumber(date) + 1;
  $('#daypill').textContent = `#${num}`;
  const f = level.fairy;
  $('#dayline').textContent = `${nice(date)} · ${SHAPES[level.shape].name} · ${feelOf(date)}`;
  $('#stranger').replaceChildren('Today\'s stranger: the ', el('b', {}, name(f)), `. ${say(f)}`);
  // The rules stay up until you have finished a day; then they live under
  // "How to play" at the foot.
  $('#rules').hidden = Object.values(store.days).some((e) => e.done) && !TEST;
  const ln = $('#linknote');
  if (link && link.date === date && link.tries.length) {
    ln.hidden = false;
    ln.textContent = `${link.name || 'A friend'} sent you this board${date !== today ? `, from ${nice(date)}` : ''}. Finish it to watch their tries.`;
  } else if (date !== today) {
    ln.hidden = false;
    ln.textContent = `This is the board from ${nice(date)}.`;
  } else ln.hidden = true;
}

function paintInfo() {
  const info = $('#info'), route = entry.route, host = hostOf(route);
  const opts = options(route), left = leftOf(route);
  if (entry.done) {
    info.replaceChildren(entry.done.cleared ? 'Cleared. Every piece taken.' : `Done for today, with ${entry.done.best} left at best.`);
    return;
  }
  if (view.peek != null) {
    const p = level.pieces[view.peek];
    const could = targets(level, occupancy(level, maskOf(route)), p.sq, p.kind).length;
    info.replaceChildren('The ', el('b', {}, name(p.kind)), `: ${lower(say(p.kind))} From where it stands it could take ${could}. `,
      opts.includes(view.peek) ? 'Yours can take it: tap your piece, then this one.' : 'Yours can\'t reach it from here yet.');
    return;
  }
  if (!opts.length) {
    const more = entry.tries < TRIES ? ` Step back to start try ${entry.tries + 1}, as far back as you like.` : '';
    info.replaceChildren(el('b', {}, 'Stuck.'), ` Nothing in reach, ${left} left.${more}`);
    return;
  }
  const newcomer = !Object.values(store.days).some((e) => e.done);
  if (!view.sel) {
    info.replaceChildren('You are the ', el('b', {}, name(host.kind)), `: ${lower(say(host.kind))} Tap it to pick it up.`,
      newcomer && !route.length ? ' Gold rings show where yours can go; purple, where each piece you can take could go next.' : '');
    return;
  }
  info.replaceChildren('You are the ', el('b', {}, name(host.kind)), `: ${lower(say(host.kind))} `,
    `You can take ${opts.length === 1 ? 'one' : opts.length}, in red. Tap one to move there and become it.`);
}

function paintHud() {
  $('#try').textContent = entry.tries;
  $('#left').textContent = leftOf(entry.route);
  $('#trydots').replaceChildren(...Array.from({ length: TRIES }, (_, i) => el('i', { class: i + 1 < entry.tries ? 'used' : i + 1 === entry.tries ? 'now' : '' })));
  const stuckNow = !entry.done && !options(entry.route).length;
  $('#controls').hidden = !!entry.done;
  const back = $('#back');
  back.disabled = !entry.route.length || (!entry.back && entry.tries >= TRIES);
  back.textContent = entry.back || !entry.route.length ? 'Step back' : entry.tries >= TRIES ? 'No tries left' : `Step back (try ${entry.tries + 1})`;
  $('#giveup').hidden = !stuckNow;
  $('#controls').style.gridTemplateColumns = stuckNow ? '1fr 1fr' : '1fr';
}

function paintChain() {
  const row = [level.start.kind, ...entry.route.map((j) => level.pieces[j].kind)];
  $('#chain').replaceChildren(...row.flatMap((kind, i) => {
    const c = el('canvas', { width: 30, height: 36, class: 'pix', title: name(kind) });
    c.getContext('2d').drawImage(sprite(kind, i === row.length - 1), 0, 0);
    return i ? [el('span', { class: 'arrow' }, '›'), c] : [c];
  }));
}

/** The tries as rows: a filled square for every piece taken. */
function gridText(log) {
  return log.map((r) => '■'.repeat(r.length) + '□'.repeat(N - r.length)).join('\n');
}

function paintEnd() {
  const end = $('#end'), d = entry.done;
  end.hidden = !d;
  if (!d) return;
  const score = d.cleared ? `${d.tries}/${TRIES}` : `X/${TRIES}`;
  $('#result').replaceChildren(el('span', { class: `score pop ${d.cleared ? (d.tries === 1 ? 'one' : '') : 'x'}` }, score), ' ',
    d.cleared ? (d.tries === 1 ? 'First try.' : `Cleared on try ${d.tries}.`) : `${d.best} left at best.`);
  const routes = solved.ways, ways = solved.clear;
  $('#result-note').textContent = `${ways === 1 ? 'One route' : `${ways.toLocaleString()} routes`} out of ${routes.toLocaleString()} clear this board.`;
  $('#grid').replaceChildren(...entry.log.flatMap((r, i) => [
    ...(i ? ['\n'] : []), el('span', { class: 't' }, '■'.repeat(r.length)), el('span', { class: 'l' }, '□'.repeat(N - r.length))
  ]));
  $('#name').value = store.name || '';
  const fr = $('#friend');
  fr.hidden = !(link && link.date === date && link.tries.length);
  if (!fr.hidden) fr.textContent = `Watch ${link.name || 'their'}${link.name ? '\'s' : ''} tries`;
  paintRecord();
  const next = addDays(date, 1);
  $('#tomorrow').textContent = date === today ? `A new board tomorrow. ${weekday(next)}s are ${feelOf(next)}.` : '';
}

function paintRecord() {
  // Totals only: days played, never days in a row.
  const days = Object.entries(store.days).filter(([, e]) => e.done);
  const counts = Array(TRIES + 1).fill(0);
  for (const [, e] of days) counts[e.done.cleared ? e.done.tries - 1 : TRIES]++;
  const top = Math.max(1, ...counts);
  const mine = entry.done ? (entry.done.cleared ? entry.done.tries - 1 : TRIES) : -1;
  $('#record').replaceChildren(
    el('div', { class: 'stat' }, el('span', { class: 'dim' }, 'Days played'), el('b', {}, String(days.length))),
    el('div', { class: 'stat' }, el('span', { class: 'dim' }, 'Boards cleared'), el('b', {}, String(days.filter(([, e]) => e.done.cleared).length))),
    el('div', { class: 'hist', style: 'margin-top:10px' }, ...counts.flatMap((n, i) => [
      el('span', {}, i < TRIES ? String(i + 1) : 'X'),
      el('span', {}, el('span', { class: `bar${i === mine ? ' today' : ''}`, style: `display:inline-block;width:${Math.max(8, (n / top) * 100)}%` }, String(n)))
    ]))
  );
}

/** Each kind on today's board, with a little picture of its moves. */
function paintKinds() {
  const kinds = [...new Set([level.start.kind, ...level.pieces.map((p) => p.kind)])];
  kinds.sort((a, b) => (PIECES[b].fairy ? 1 : 0) - (PIECES[a].fairy ? 1 : 0));
  $('#kinds').replaceChildren(...kinds.map((k) => el('div', { class: 'kind' }, diagram(k),
    el('div', {}, el('h3', {}, name(k), PIECES[k].fairy ? el('span', { class: 'tag', style: 'margin-left:8px' }, 'today\'s stranger') : ''), el('p', { class: 'dim' }, say(k))))));
}

function diagram(kind) {
  // A 7 x 7 board with the piece in the middle and a dot on every square it
  // could take if a piece stood there alone. The cannon needs one to jump,
  // so its picture has one.
  const n = 7, s = 10, c = el('canvas', { width: n * s, height: n * s, class: 'pix diagram' }), q = c.getContext('2d');
  const b = { W: n, H: n, on: new Uint8Array(n * n).fill(1) }, mid0 = 24;
  const occ = new Int8Array(n * n).fill(-1);
  const hits = new Set();
  if (kind === 'cannon') {
    for (const sc of [17, 23, 25, 31]) occ[sc] = 0;
    for (let t = 0; t < n * n; t++) { if (occ[t] >= 0) continue; occ[t] = 0; if (targets(b, occ, mid0, kind).includes(t)) hits.add(t); occ[t] = -1; }
  } else {
    for (let t = 0; t < n * n; t++) { occ[t] = 0; if (targets(b, occ, mid0, kind).includes(t)) hits.add(t); occ[t] = -1; }
  }
  for (let t = 0; t < n * n; t++) {
    const x = t % n, y = (t / n) | 0;
    q.fillStyle = (x + y) % 2 === 0 ? LIGHT : DARK;
    q.fillRect(x * s, y * s, s, s);
    if (hits.has(t)) { q.fillStyle = '#c8901a'; q.fillRect(x * s + 3, y * s + 3, 4, 4); }
    if (kind === 'cannon' && occ[t] >= 0) { q.fillStyle = '#8e918c'; q.fillRect(x * s + 2, y * s + 2, 6, 6); }
  }
  q.fillStyle = '#4f8a3b'; q.fillRect(24 % n * s + 1, ((24 / n) | 0) * s + 1, s - 2, s - 2);
  return c;
}

function update() {
  paintHud();
  paintInfo();
  paintChain();
  paintEnd();
  if (TEST) paintTest();
  redraw();
}

// --- Sharing. -------------------------------------------------------------------
// The link carries the day, your name and your tries, each try as the
// pieces you took, one character each. Whoever opens it plays the same
// board and, once they are done, can watch yours.

function makeLink() {
  const h = new URLSearchParams({ d: date });
  if (store.name) h.set('n', store.name);
  h.set('r', entry.log.map((r) => r.map((j) => j.toString(36)).join('')).join('.'));
  return `${location.origin}${location.pathname}#${h.toString()}`;
}

$('#share').onclick = async () => {
  const note = $('#share-note');
  store.name = $('#name').value.replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 16);
  saveStore();
  const d = entry.done, num = dayNumber(date) + 1;
  const head = `Changeling #${num} ${d.cleared ? d.tries : 'X'}/${TRIES}\n${gridText(entry.log)}`;
  const url = makeLink();
  if (navigator.share) {
    try { await navigator.share({ text: head, url }); note.textContent = 'Sent.'; return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${head}\n${url}`); note.textContent = 'Copied. Paste it into your chat.'; }
  catch { note.replaceChildren('Copy this:', el('input', { type: 'text', value: `${head} ${url}`, readonly: true })); }
};

// --- Watching a route: a friend's tries, or a way to clear it. ---------------------

function legal(route) {
  const out = [];
  for (const j of route) { if (!options(out).includes(j)) return null; out.push(j); }
  return out;
}

async function watch(routes, label) {
  if (view.anim || view.replay) return;
  const btns = [$('#friend'), $('#solution')];
  btns.forEach((b) => { b.disabled = true; });
  const was = $('#info').textContent;
  view.replay = { route: [] };
  for (let t = 0; t < routes.length; t++) {
    view.replay.route = [];
    $('#info').textContent = routes.length > 1 ? `${label}: try ${t + 1}` : label;
    redraw();
    await wait(500);
    for (let i = 0; i < routes[t].length; i++) {
      const j = routes[t][i], from = hostOf(view.replay.route), to = level.pieces[j];
      view.replay.route.push(j);
      await new Promise((res) => hop('take', from.sq, to.sq, from.kind, to.kind, j, res));
      SFX.take(i, 0);
      redraw();
      await wait(180);
    }
    if (routes[t].length === N) SFX.clear(0.1);
    await wait(900);
  }
  view.replay = null;
  $('#info').textContent = was;
  btns.forEach((b) => { b.disabled = false; });
  redraw();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

$('#solution').onclick = () => watch([aWayToClear(level, solved).map((sq) => sqIndex[sq])], 'One way to clear it');
$('#friend').onclick = () => {
  const routes = link.tries.map((s) => legal([...s].map((ch) => parseInt(ch, 36)).filter((j) => j >= 0 && j < N))).filter(Boolean);
  if (routes.length) watch(routes, `${link.name || 'Their'}${link.name ? '\'s' : ''} tries`);
};

// --- The rings, on or off. -------------------------------------------------------

// Three settings, in turn: the pieces you can take now (the default), every
// piece, none. Yours always shows unless they are off.
const RINGS = ['next', 'all', 'off'];
const ringMode = () => (RINGS.includes(store.rings) ? store.rings : store.rings === false ? 'off' : 'next');
function paintRingsButton() {
  $('#rings').textContent = { next: 'Rings: yours and what you can take', all: 'Rings: every piece', off: 'Rings: off' }[ringMode()];
}
$('#rings').onclick = () => { store.rings = RINGS[(RINGS.indexOf(ringMode()) + 1) % 3]; saveStore(); paintRingsButton(); redraw(); };
paintRingsButton();

// --- Test mode (?test): any day, a clean slate, the numbers. ------------------------

function paintTest() {
  const p = $('#testpanel');
  p.hidden = false;
  $('#t-stats').textContent = `${date}, dealer v${level.version}, ${N} pieces, start ${level.start.kind}. ` +
    `Routes ${solved.ways}, clearing ${solved.clear}, random player clears ${(solved.p * 100).toFixed(2)}% and leaves ${solved.left.toFixed(1)}. ` +
    `Dealt on candidate ${level.tries}.`;
  paintCalendar();
}

/** Every dealt day, a month at a time, coloured by how it went: tap one to
    play it. Shapes and strangers come round in fixed orders, so the
    calendar can name them without dealing the boards. */
function paintCalendar() {
  const box = $('#t-days'), months = [];
  for (let d = FIRST_DAY; d <= LAST_DAY; d = addDays(d, 1)) {
    const key = d.slice(0, 7);
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, days: [] });
    months[months.length - 1].days.push(d);
  }
  const cyc = (list, i) => list[((i % list.length) + list.length) % list.length];
  box.replaceChildren(...months.map(({ key, days }) => {
    const title = asDate(days[0]).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const lead = asDate(days[0]).getUTCDay();
    return el('div', { class: 'month' }, el('h3', {}, title),
      el('div', { class: 'wk' },
        ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => el('span', {}, w)),
        ...Array.from({ length: lead }, () => el('span', {})),
        ...days.map((d) => {
          const e = store.days[d], n = dayNumber(d);
          const cls = [e?.done ? (e.done.cleared ? 'ok' : 'x') : e?.route?.length || e?.log?.length ? 'on' : '', d === date ? 'cur' : '', d === today ? 'today' : ''].join(' ');
          const what = `#${n + 1}, ${nice(d)}: ${SHAPES[cyc(SHAPE_ORDER, n)].name}, the ${name(cyc(FAIRIES, n))}, ${feelOf(d)}` +
            (e?.done ? (e.done.cleared ? `. Cleared on try ${e.done.tries}.` : '. Not cleared.') : '');
          return el('button', { type: 'button', class: cls, title: what, 'aria-label': what, onclick: () => { openDay(d); scrollTo({ top: 0, behavior: 'smooth' }); } }, String(+d.slice(8)));
        })));
  }));
}
$('#testlink').hidden = TEST;
if (TEST) {
  $('#t-prev').onclick = () => openDay(addDays(date, -1) < FIRST_DAY ? FIRST_DAY : addDays(date, -1));
  $('#t-next').onclick = () => openDay(addDays(date, 1));
  $('#t-today').onclick = () => openDay(today);
  $('#t-reset').onclick = () => { delete store.days[date]; saveStore(); openDay(date); };
  $('#t-resetall').onclick = () => {
    if (!confirm('Clear every test-mode day? Your real days are kept apart and stay as they are.')) return;
    store.days = {}; saveStore(); openDay(date);
  };
}

// --- Start. ---------------------------------------------------------------------

$('.topbar').append(soundToggle(), themeToggle());
$('.wrap').append(releaseLine());
openDay(date);
// For tests and the console: the level and a way to clear it.
window.changeling = { get level() { return level; }, get solved() { return solved; }, get entry() { return entry; }, way: () => aWayToClear(level, solved), squareAt: (sq) => {
  const r = cv.getBoundingClientRect();
  return { x: r.left + ((cellX(sq) + C / 2) * r.width) / cv.width, y: r.top + ((cellY(sq) + C / 2) * r.height) / cv.height };
} };

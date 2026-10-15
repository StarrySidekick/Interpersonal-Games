// Adventure, the page. The rules are in rules.js and the run (levels, par,
// upgrades) in run.js; this draws the board, takes taps, plays the turn out
// in two steps (your move, then the rabbits and their reply), and keeps the
// run in this browser so you can stop and come back.

import { PIECES, SUITS, WEAPONS, STARTERS, movesOf, occOf, play, takenBy, rabbitStep, search, isTheirs } from './rules.js';
import { newRun, makeLevel, verdict, offersFor, takeCard, eligible, settle, cardText, pieceName } from './run.js';
import { $, el, haptic, themeToggle, show } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { logSitting } from '../../../engine/record.js';
import { releaseLine } from '../../../engine/release.js';
import { rng } from '../../../engine/seed.js';
import { snapshot } from '../../../engine/lowpoly.js';
import { model } from '../../grove-chess/models.js';
import * as sfx from '../../grove-chess/sounds.js';

const TEST = new URLSearchParams(location.search).has('test');
const C = 28, RIM = 5, TOP = 18;
const LIGHT = '#b9dc9b', DARK = '#f6efd7';
// Squares coloured as on the Grove's boards: the piece you picked up, where
// it can go, what it can take; and here, where one of theirs could take it.
const SEL = ['#e9b02a', 0.75], MOVE = ['#f2c14e', 0.55], CATCH = ['#e2603e', 0.7], RISK = ['#9a5ad6', 0.45], SWAP = ['#8fa6bd', 0.6];

// --- What this browser keeps. --------------------------------------------------------
// The run, the board in play (its start, for starting over, and now), and
// totals: best depth, runs, boards, boards under par. Totals only; nothing
// here counts days in a row.

const KEY = TEST ? 'adventure.test.v1' : 'adventure.v1';
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch { /* blocked or corrupt */ }
  return {};
}
const store = load();
store.record ||= { best: 0, runs: 0, boards: 0, under: 0 };
const save = () => {
  try {
    const cur = store.cur && { ...store.cur, level: { ...store.cur.level, L: packL(store.cur.level.L), state: null }, start: packS(store.cur.start), state: packS(store.cur.state) };
    localStorage.setItem(KEY, JSON.stringify({ ...store, cur }));
  } catch { /* full or blocked: play on */ }
};
const packL = (L) => ({ ...L, on: [...L.on] });
const packS = (s) => s && ({ ...s, L: null, mid: undefined });
function unpack(cur) {
  if (!cur?.level) return null;
  const L = { ...cur.level.L, on: Uint8Array.from(cur.level.L.on) };
  const fix = (s) => s && { ...s, L };
  return { ...cur, level: { ...cur.level, L }, start: fix(cur.start), state: fix(cur.state) };
}
store.cur = unpack(store.cur);

// --- Building levels, off the page's thread. -------------------------------------------

let worker = null, asks = 0;
const waiting = new Map();
try {
  worker = new Worker(new URL('./level-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }
function ask(kind, payload) {
  const plain = JSON.parse(JSON.stringify(payload, (k, v) => (v instanceof Uint8Array ? [...v] : v)));
  if (plain.state) plain.state.L.on = Uint8Array.from(plain.state.L.on);
  if (!worker) return Promise.resolve(kind === 'level' ? { level: makeLevel(plain.run) } : { found: search(plain.state, { width: 80, cap: 30 }) });
  return new Promise((res) => { const id = ++asks; waiting.set(id, res); worker.postMessage({ kind, id, ...plain }); });
}

// --- Sprites and drawing. ---------------------------------------------------------------

const cv = $('#board'), g = cv.getContext('2d');
const sprites = {};
function sprite(p) {
  const kind = p.side === 'rabbit' ? 'rabbit' : p.kind;
  const glow = p.side === 'you' && p.suit ? SUITS[p.suit].colour : null;
  const key = `${kind}|${p.side}|${glow}`;
  if (sprites[key]) return sprites[key];
  if (p.side === 'rabbit') return (sprites[key] = snapshot(model('rabbit', 'foe', '#e8dcc6')));
  if (p.side === 'stone') return (sprites[key] = stone(snapshot(model(kind, 'foe'))));
  return (sprites[key] = snapshot(model(kind, p.side === 'you' ? 'you' : 'foe', null, glow)));
}
/** A piece turned to grey stone: each pixel's lightness mapped onto the
    statues' stone colours, the dark outline kept dark. */
function stone(c) {
  const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  const lo = [78, 80, 76], hi = [214, 216, 208];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
    if (l < 0.12) { d[i] = d[i + 1] = d[i + 2] = 34; continue; }
    const k = Math.min(1, l * 1.5);
    for (let j = 0; j < 3; j++) d[i + j] = Math.round(lo[j] + (hi[j] - lo[j]) * k);
  }
  x.putImageData(img, 0, 0);
  return c;
}
const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w, h); };
let L = null;
const cellX = (sq) => RIM + (sq % L.W) * C, cellY = (sq) => TOP + RIM + ((sq / L.W) | 0) * C;
const mid = (sq) => [cellX(sq) + C / 2, cellY(sq) + C / 2];
function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((A >> sh) & 255) + ((((B >> sh) & 255) - ((A >> sh) & 255)) * k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function sizeBoard() {
  cv.width = L.W * C + RIM * 2; cv.height = L.H * C + RIM * 2 + TOP;
  const room = Math.min(cv.parentElement.clientWidth, 460), dpr = window.devicePixelRatio || 1;
  cv.style.width = `${(cv.width * Math.max(1, Math.floor((room * dpr) / cv.width))) / dpr}px`;
}
addEventListener('resize', () => { if (L) sizeBoard(), redraw(); });

function tiles(tint) {
  g.clearRect(0, 0, cv.width, cv.height);
  for (const pass of [0, 1])
    for (let s = 0; s < L.W * L.H; s++) {
      if (!L.on[s]) continue;
      const i = pass ? RIM - 2 : RIM;
      P(cellX(s) - i, cellY(s) - i, C + i * 2, C + i * 2, pass ? '#6b4a2e' : '#4a3220');
    }
  for (let s = 0; s < L.W * L.H; s++) {
    if (!L.on[s]) continue;
    const x = s % L.W, y = (s / L.W) | 0, base = (x + y) % 2 === 0 ? LIGHT : DARK, t = tint.get(s);
    P(cellX(s), cellY(s), C, C, t ? mix(base, t[0], t[1]) : base);
  }
}
/** Little marks over a piece: its weapon and level, a heart left, stunned. */
function marks(p, x, y) {
  const ox = Math.round(x) - 13, oy = Math.round(y) - 13;
  if (p.weapon) {
    const c = WEAPONS[p.weapon].colour, d = '#3a2a1a';
    if (p.weapon === 'sword') { P(ox + 2, oy, 1, 6, c); P(ox, oy + 4, 5, 1, d); P(ox + 2, oy + 5, 1, 2, d); }
    if (p.weapon === 'lance') { P(ox + 2, oy, 1, 1, c); P(ox + 1, oy + 1, 3, 1, c); P(ox + 2, oy + 2, 1, 5, d); }
    if (p.weapon === 'mace') { P(ox + 1, oy, 3, 3, c); P(ox + 2, oy + 3, 1, 4, d); }
    for (let i = 0; i < (p.wl || 1); i++) P(ox + 6, oy + 6 - i * 2, 1, 1, '#fff3c4');
  }
  if (p.side === 'you' && (p.lives || 1) > 1) { const hx = Math.round(x) + 8, hy = Math.round(y) - 13; P(hx, hy, 2, 1, '#e0445a'); P(hx + 3, hy, 2, 1, '#e0445a'); P(hx, hy + 1, 5, 1, '#e0445a'); P(hx + 1, hy + 2, 3, 1, '#e0445a'); P(hx + 2, hy + 3, 1, 1, '#e0445a'); }
  if (p.stun) { const sx = Math.round(x), sy = Math.round(y) - 26; P(sx - 5, sy, 2, 2, '#f5c13a'); P(sx, sy - 2, 2, 2, '#f5c13a'); P(sx + 5, sy, 2, 2, '#f5c13a'); }
}
function drawPiece(p, x, y, lift = 0, alpha = 1) {
  const cx = Math.round(x), base = Math.round(y + 6), sh = p.side === 'you' ? 'rgba(245,193,58,.4)' : 'rgba(40,30,10,.22)';
  g.globalAlpha = alpha;
  P(cx - 6, base - 1, 12, 1, sh); P(cx - 9, base, 18, 2, sh); P(cx - 6, base + 2, 12, 1, sh);
  g.drawImage(sprite(p), cx - 15, Math.round(base - 31 - lift));
  marks(p, x, y - lift);
  g.globalAlpha = 1;
}
function footprints(sq) {
  const x = cellX(sq), y = cellY(sq), c = 'rgba(110,80,50,.75)';
  P(x + 8, y + 15, 3, 4, c); P(x + 8, y + 12, 2, 2, c); P(x + 16, y + 9, 3, 4, c); P(x + 16, y + 6, 2, 2, c);
}

// The view: what is picked up, what was tapped, and the animation playing.
const view = { sel: null, look: null, anim: null, parts: [], busy: false };

function draw(now = performance.now()) {
  const cur = store.cur;
  if (!cur) return;
  const s = cur.state, a = view.anim;
  const tint = new Map();
  if (!a && !view.busy && view.sel != null && !s.done) {
    const p = s.ps.find((q) => q.id === view.sel);
    if (p) {
      tint.set(p.sq, SEL);
      for (const m of myMoves(p)) tint.set(m.to, m.swap != null ? SWAP : takes(m) ? CATCH : risky(m) ? RISK : MOVE);
    }
  }
  if (!a && view.look != null) { const q = s.ps.find((r) => r.id === view.look); if (q) tint.set(q.sq, ['#9a5ad6', 0.35]); }
  tiles(tint);
  // Where each rabbit hops next.
  if (!a && !s.done) for (const r of s.ps) if (r.side === 'rabbit') { const st = rabbitStep(s, r); if (st.to >= 0) footprints(st.to); }
  // Pieces, back rows first.
  const list = [];
  if (a) {
    const k = Math.min(1, (now - a.t0) / a.dur), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    const before = new Map(a.from.map((p) => [p.id, p]));
    for (const p of a.to) {
      const b = before.get(p.id);
      const [x1, y1] = mid(p.sq);
      if (b && b.sq !== p.sq) {
        const [x0, y0] = mid(b.sq), dist = Math.hypot((x1 - x0) / C, (y1 - y0) / C);
        list.push({ p, x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, lift: Math.sin(Math.PI * k) * (6 + dist * 3) });
      } else list.push({ p, x: x1, y: y1 });
    }
    for (const b of a.from) if (!a.to.some((p) => p.id === b.id) && k < 0.8) { const [x, y] = mid(b.sq); list.push({ p: b, x, y, alpha: 1 - k }); }
  } else for (const p of s.ps) { const [x, y] = mid(p.sq); list.push({ p, x, y }); }
  list.sort((u, v) => u.y - v.y);
  for (const t of list) drawPiece(t.p, t.x, t.y, t.lift || 0, t.alpha ?? 1);
  // Leaves from pieces taken.
  view.parts = view.parts.filter((q) => now < q.t0 + q.life);
  for (const q of view.parts) { const t = (now - q.t0) / 1000; if (t >= 0) P(q.x + q.vx * t, q.y + q.vy * t + 60 * t * t, q.s, q.s, q.col); }
  if (a && now >= a.t0 + a.dur) { view.anim = null; a.done?.(); }
  if (view.anim || view.parts.length) requestAnimationFrame(draw);
}
const redraw = () => requestAnimationFrame(draw);
function burst(sq, cols, at = performance.now()) {
  const [x, y] = mid(sq), r = rng(`${sq}:${at}`);
  for (let i = 0; i < 16; i++) {
    const ang = r() * Math.PI * 2, sp = 25 + r() * 55;
    view.parts.push({ x, y: y - 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, s: r() < 0.3 ? 3 : 2, col: cols[i % cols.length], t0: at, life: 500 + r() * 300 });
  }
}
/** Animate from one set of pieces to another; resolves when done. */
function animate(from, to, dur = 300) {
  return new Promise((res) => {
    const gone = from.filter((b) => !to.some((p) => p.id === b.id));
    const at = performance.now() + dur * 0.75;
    for (const b of gone) burst(b.sq, b.side === 'stone' ? ['#8e918c', '#b8bab4', '#5d7a45'] : b.side === 'you' ? ['#4f8a3b', '#b9dc9b', '#f5c13a'] : ['#6c4795', '#9a5ad6', '#b9dc9b'], at);
    if (!from.some((b) => { const p = to.find((q) => q.id === b.id); return !p || p.sq !== b.sq; })) { redraw(); return res(); }
    view.anim = { from, to, t0: performance.now(), dur, done: res };
    redraw();
  });
}

// --- The rules, as the page asks them. ------------------------------------------------------

const takes = (m) => takenBy(m).length > 0;
function myMoves(p) {
  const s = store.cur.state;
  if (s.bonus && s.bonus.id !== p.id) return [];
  return movesOf(s, p, occOf(s));
}
/** Could one of their moving pieces take yours on its reply, after this move? */
function risky(m) {
  const s = store.cur.state;
  if (!s.ps.some((p) => p.side === 'foe')) return false;
  const n = { ...s, ps: s.ps.map((p) => (p.id === m.id ? { ...p, sq: m.to } : { ...p })).filter((p) => !takenBy(m).includes(p.id)), bonus: null };
  const occ = occOf(n);
  return n.ps.some((f) => f.side === 'foe' && !f.stun && movesOf(n, f, occ).some((r) => takenBy(r).includes(m.id)));
}

// --- Taps. ---------------------------------------------------------------------------------

function cellAt(e) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor((((e.clientX - r.left) * cv.width) / r.width - RIM) / C), y = Math.floor((((e.clientY - r.top) * cv.height) / r.height - TOP - RIM) / C);
  return x < 0 || y < 0 || x >= L.W || y >= L.H ? null : y * L.W + x;
}

cv.addEventListener('click', async (e) => {
  const cur = store.cur;
  if (!cur || view.busy || view.anim || cur.state.done) return;
  const s = cur.state, sq = cellAt(e);
  const at = sq == null ? null : s.ps.find((p) => p.sq === sq);
  const held = view.sel != null ? s.ps.find((p) => p.id === view.sel) : null;
  if (held) {
    const m = myMoves(held).find((x) => x.to === sq);
    if (m) { await move(m); return; }
  }
  view.look = null;
  if (at?.side === 'you') {
    if (s.bonus && s.bonus.id !== at.id) { info(...bonusText()); return; }
    view.sel = view.sel === at.id && !s.bonus ? null : at.id;
    if (view.sel != null) sfx.tick();
  } else if (at) {
    view.look = at.id;
    if (!s.bonus) view.sel = null;
  } else if (!s.bonus) view.sel = null;
  paintInfo(); paintRoster(); redraw();
});

async function move(m) {
  const cur = store.cur, before = cur.state;
  view.busy = true;
  const after = play(before, m, true);
  const took = takenBy(m).length;
  // Your move...
  const mineDone = after.mid || after.ps;
  m.swap != null ? sfx.slide() : sfx.move();
  await animate(before.ps, mineDone, 260);
  if (took) { sfx.capture(); haptic(14); }
  // ...then the rabbits and their reply.
  if (after.mid) {
    await new Promise((r) => setTimeout(r, 120));
    const theirs = after.reply;
    if (theirs || after.mid.some((p, i) => p.sq !== after.ps.find((q) => q.id === p.id)?.sq)) {
      if (after.ps.some((p) => p.side === 'rabbit')) sfx.hop(0, -1, 0, 0.25, 0.6);
      if (theirs) sfx.slide();
      await animate(after.mid, after.ps, 300);
      if (theirs && takes(theirs)) { sfx.eat(); haptic([20, 40, 20]); }
    }
  }
  cur.state = after;
  view.busy = false;
  if (after.bonus) view.sel = after.bonus.id;
  else if (!after.ps.some((p) => p.id === view.sel)) view.sel = null;
  save();
  paint();
  if (after.done === 'cleared') return cleared();
  if (after.done === 'lost') return runOver();
}

$('#done').onclick = () => { if (store.cur?.state.bonus && !view.busy) move({ wait: true }); };
$('#restart').onclick = () => {
  const cur = store.cur;
  if (!cur || cur.resetUsed || view.busy || cur.state.t === 0 && !cur.state.bonus) return;
  if (!confirm('Start this board over? You can do this once a board.')) return;
  cur.resetUsed = true;
  cur.state = cur.start;
  view.sel = null; view.look = null;
  save(); paint();
};

// --- Words. ------------------------------------------------------------------------------------

const info = (...parts) => $('#info').replaceChildren(...parts);
const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
function bonusText() {
  const s = store.cur.state, p = s.ps.find((q) => q.id === s.bonus.id);
  return s.bonus.why === 'vines' ? [el('b', {}, 'Vines:'), ` your ${PIECES[p.kind].name} may take again. Or tap Done.`] : [el('b', {}, 'Stars:'), ` your ${PIECES[p.kind].name} moves again. Or tap Done.`];
}
function carries(p) {
  const bits = [];
  if (p.suit) bits.push(` ${SUITS[p.suit].mark} ${SUITS[p.suit].name}: ${SUITS[p.suit].desc}${p.suit === 'hearts' && (p.lives || 1) < 2 ? ' (Spent.)' : ''}`);
  if (p.weapon) bits.push(` ${WEAPONS[p.weapon].mark} ${WEAPONS[p.weapon].name} ${p.wl || 1}: ${WEAPONS[p.weapon].desc(p.wl || 1)}`);
  if (p.stun) bits.push(' Stunned: it sits out its next turn.');
  return bits.join('');
}
function paintInfo() {
  const cur = store.cur, s = cur.state;
  if (s.bonus) { info(...bonusText()); return; }
  if (view.look != null) {
    const p = s.ps.find((q) => q.id === view.look);
    if (p?.side === 'stone') return info('A statue of a ', el('b', {}, PIECES[p.kind].name), '. It never moves. Take it.');
    if (p?.side === 'foe') return info('Their ', el('b', {}, PIECES[p.kind].name), `: ${lower(PIECES[p.kind].say)} It moves after you, one of theirs a turn, and takes yours.`, carries(p));
    if (p?.side === 'rabbit') return info(el('b', {}, 'A rabbit.'), ' It belongs to no one: it hops in its own pattern after each of your moves, turning round at an edge, and nobody can take it. The footprints show its next hop.');
  }
  if (view.sel != null) {
    const p = s.ps.find((q) => q.id === view.sel);
    if (p) {
      const ms = myMoves(p), danger = ms.some((m) => !takes(m) && m.swap == null && risky(m));
      return info('Your ', el('b', {}, pieceName(p)), `: ${lower(PIECES[p.kind].say)}`, carries(p), ms.length ? ` Gold: moves. Red: takes.${danger ? ' Purple: one of theirs could take it there.' : ''}${ms.some((m) => m.swap != null) ? ' Blue-grey: swap places.' : ''}` : ' It has no moves.');
    }
  }
  const last = s.reply ? replyText(s) : '';
  info(last, s.t === 0 ? 'Tap one of your pieces to pick it up.' : 'Your move.');
}
function replyText(s) {
  const m = s.reply, p = s.ps.find((q) => q.id === m.id);
  const hit = takenBy(m);
  return hit.length ? `Their ${PIECES[p.kind].name} took one of yours. ` : '';
}
function paintHud() {
  const cur = store.cur, s = cur.state;
  $('#depth').textContent = store.run.depth;
  $('#moves').textContent = s.t;
  $('#par').textContent = cur.level.par;
  const tw = cur.level.twists, bits = [`${tw.board}`, `${tw.statues} ${tw.statues === 1 ? 'statue' : 'statues'}`];
  if (tw.movers) bits.push(`${tw.movers} purple`);
  if (tw.rabbits) bits.push(`${tw.rabbits === 1 ? 'a rabbit' : tw.rabbits + ' rabbits'}`);
  $('#twists').textContent = bits.join(' · ');
  $('#done').hidden = !s.bonus;
  $('#level-controls').style.gridTemplateColumns = s.bonus ? '1fr 1fr' : '1fr';
  const rb = $('#restart');
  rb.disabled = !!cur.resetUsed || (s.t === 0 && !s.bonus);
  rb.textContent = cur.resetUsed ? 'Started over once already' : 'Start this board over';
  if (TEST) {
    $('#testpanel').hidden = false;
    $('#t-stats').textContent = `Seed ${store.run.seed}. The search's route: ${cur.level.best} moves, par ${cur.level.par}.`;
  }
}
function chipSprite(h, big = false) {
  const c = el('canvas', { width: 30, height: 36, class: 'pix' });
  c.getContext('2d').drawImage(sprite({ ...h, side: 'you' }), 0, 0);
  if (big) c.style.width = '60px';
  return c;
}
function paintRoster() {
  const s = store.cur.state;
  const mine = s.ps.filter((p) => p.side === 'you');
  $('#roster').replaceChildren(...mine.map((p) => el('button', {
    class: `quiet chip${view.sel === p.id ? ' on' : ''}`, type: 'button',
    onclick: () => { if (view.busy) return; view.look = null; if (!s.bonus) view.sel = view.sel === p.id ? null : p.id; paintInfo(); paintRoster(); redraw(); }
  }, chipSprite(p), el('span', {}, pieceName(p)))));
}
function paint() { paintHud(); paintInfo(); paintRoster(); redraw(); }

// --- The run: start, boards, rewards, the end. ---------------------------------------------------

async function enterLevel() {
  show('wait');
  $('#wait-text').textContent = store.run.depth === 1 ? 'Into the Grove...' : `Going deeper, to depth ${store.run.depth}...`;
  const { level } = await ask('level', { run: store.run });
  level.L.on = Uint8Array.from(level.L.on);
  const lv = { L: level.L, par: level.par, best: level.best, twists: level.twists };
  const state = { ...level.state, L: level.L };
  store.cur = { level: lv, start: state, state, resetUsed: false };
  save();
  openLevel();
}
function openLevel() {
  L = store.cur.level.L;
  view.sel = null; view.look = null; view.anim = null; view.parts = []; view.busy = false;
  show('level');
  sizeBoard();
  $('#pill').textContent = `Depth ${store.run.depth}`;
  paint();
}

let pending = null; // the cards on offer, while choosing
function cleared() {
  const cur = store.cur, run = store.run, moves = cur.state.t, how = verdict(moves, cur.level.par);
  settle(run, cur.state);
  run.log.push({ depth: run.depth, moves, par: cur.level.par, how });
  store.record.boards++;
  if (how === 'under') store.record.under++;
  store.record.best = Math.max(store.record.best, run.depth);
  sfx.fanfare(sfx.levelFor(moves - cur.level.par));
  haptic([30, 50, 30]);
  pending = { cards: offersFor(run, how), how, moves, par: cur.level.par };
  store.cur = null;
  store.pending = pending;
  save();
  setTimeout(showReward, 650);
}
function showReward() {
  const { cards, how, moves, par } = store.pending;
  show('reward');
  $('#reward-depth').textContent = `Depth ${store.run.depth} cleared`;
  const word = { under: 'Under par', par: 'On par', over: 'Over par' }[how];
  $('#verdict').replaceChildren(el('span', { class: `pill2 pop ${how === 'under' ? 'gold' : how === 'over' ? 'dim' : ''}` }, word));
  $('#verdict-note').textContent = `${moves} ${moves === 1 ? 'move' : 'moves'}, par ${par}. ${how === 'under' ? 'Choose one of three.' : how === 'par' ? 'Choose one of two.' : 'One upgrade; beat par for a choice.'}`;
  $('#cards-head').textContent = cards.length > 1 ? 'Choose one' : 'Yours';
  $('#target').hidden = true;
  $('#cards').replaceChildren(...cards.map((c) => {
    const t = cardText(c), pic = c.kind === 'piece' ? chipSprite({ kind: c.piece }, true) : el('span', { class: 'glyph' }, c.kind === 'suit' ? SUITS[c.suit].mark : c.kind === 'weapon' ? WEAPONS[c.weapon].mark : '⚒');
    return el('button', { class: `quiet card-btn${c.kind === 'piece' ? '' : ' mark'}`, type: 'button', onclick: () => chooseCard(c) }, pic, el('div', {}, el('b', {}, t.title), el('span', {}, t.text)));
  }));
  if (!cards.length) $('#cards').replaceChildren(el('button', { class: 'primary', onclick: next }, 'Go deeper'));
}
function chooseCard(card) {
  const run = store.run, who = eligible(run, card);
  if (card.kind === 'piece' || who.length <= 1) { takeCard(run, card, who[0]?.id); sfx.gain(); return next(); }
  $('#target').hidden = false;
  $('#target-head').textContent = `Give ${cardText(card).title.replace(/^\S+ /, '')} to`;
  $('#targets').replaceChildren(...who.map((h) => el('button', { class: 'quiet card-btn', type: 'button', onclick: () => { takeCard(run, card, h.id); sfx.gain(); next(); } },
    chipSprite(h, true), el('div', {}, el('b', {}, pieceName(h)), el('span', {}, PIECES[h.kind].say)))));
  $('#target').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function next() {
  store.pending = null;
  store.run.depth++;
  save();
  enterLevel();
}
function runOver() {
  const run = store.run;
  store.record.best = Math.max(store.record.best, run.depth - 1);
  if (!TEST) logSitting({ game: 'adventure', data: { seed: run.seed, depth: run.depth, cleared: run.log.length, under: run.log.filter((l) => l.how === 'under').length, start: run.start } });
  sfx.lost();
  setTimeout(() => {
    show('over');
    $('#over-text').textContent = `Your last piece was taken at depth ${run.depth}. You cleared ${run.log.length} ${run.log.length === 1 ? 'board' : 'boards'}, ${run.log.filter((l) => l.how === 'under').length} under par.`;
    paintRecord($('#over-record'));
    store.run = null; store.cur = null; store.pending = null;
    save();
  }, 700);
}
$('#again').onclick = () => openStart();

function paintRecord(box) {
  const r = store.record;
  const row = (k, v) => el('div', { class: 'stat' }, el('span', { class: 'dim' }, k), el('b', {}, String(v)));
  box.replaceChildren(el('h2', {}, 'Your adventures'), row('Deepest', r.best || '-'), row('Runs', r.runs), row('Boards cleared', r.boards), row('Under par', r.under));
}

function openStart() {
  show('start');
  $('#pill').textContent = 'Adventure';
  const live = store.run && !store.run.over;
  $('#continue').hidden = !live;
  if (live) {
    $('#continue-text').textContent = `A run in progress: depth ${store.run.depth}, with ${store.run.roster.map(pieceName).join(', ')}.`;
    $('#choose-head').textContent = 'Or start again with';
  } else $('#choose-head').textContent = 'Choose your first piece';
  $('#starters').replaceChildren(...STARTERS.map((k) => el('button', { class: 'quiet starter', type: 'button', onclick: () => start(k) },
    chipSprite({ kind: k }, true), el('div', {}, el('b', {}, PIECES[k].name), el('span', {}, PIECES[k].say)))));
  paintRecord($('#record'));
}
$('#continue-btn').onclick = () => resume();
function start(kind) {
  if (store.run && !store.run.over && !confirm('Leave the run you are on and start a new one?')) return;
  store.run = { ...newRun(kind), start: kind };
  store.record.runs++;
  store.cur = null; store.pending = null;
  save();
  enterLevel();
}
function resume() {
  if (store.pending) return showReward();
  if (store.cur) return openLevel();
  enterLevel();
}

// --- Test mode (?test). --------------------------------------------------------------------------

if (TEST) {
  $('#t-hint').onclick = async () => {
    const cur = store.cur;
    if (!cur || view.busy) return;
    $('#t-hint').disabled = true;
    const { found } = await ask('hint', { state: cur.state });
    $('#t-hint').disabled = false;
    const m = found?.route?.[0]?.[0];
    if (m) { view.sel = m.id; await move(m); } else info('No route found from here.');
  };
  $('#t-skip').onclick = () => { const cur = store.cur; if (!cur || view.busy) return; cur.state = { ...cur.state, t: cur.level.par, ps: cur.state.ps.filter((p) => !isTheirs(p)), done: 'cleared' }; cleared(); };
  $('#t-go').onclick = () => { const d = parseInt($('#t-depth').value, 10); if (!store.run || !(d >= 1)) return; store.run.depth = d; store.cur = null; store.pending = null; save(); enterLevel(); };
}

// --- Start. -----------------------------------------------------------------------------------------

$('.topbar').append(soundToggle(), themeToggle());
$('.wrap').append(releaseLine());
openStart();
// For tests: the state, and where a square is on the page.
window.adventure = { get store() { return store; }, squareAt: (sq) => { const r = cv.getBoundingClientRect(); return { x: r.left + ((cellX(sq) + C / 2) * r.width) / cv.width, y: r.top + ((cellY(sq) + C / 2) * r.height) / cv.height }; } };

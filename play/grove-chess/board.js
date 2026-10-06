// The board on screen, shared by the daily game and the lab: drawing, the
// animations between moves, and turning a tap into a square.
//
// The board is a small canvas drawn pixel by pixel and scaled up with
// `image-rendering: pixelated`. Pieces are sprites rendered once from their
// 3D models (engine/lowpoly.js).

import { Mesh, Model, snapshot } from '../../engine/lowpoly.js';
import { model } from './models.js';
import { brambleCount, onBoard, movesFor, PIECES } from './rules.js';

export const C = 28, RIM = 5, TOP = 16;

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

// Track colours, one per pattern foe: the first is the daily rabbit's brown.
const TRACK = ['#6b4a2c', '#2f6fc0', '#8a4bb0', '#118a74', '#c2378a', '#de7a1f', '#5f7a20', '#9a6a0c'];

const sprites = {};
export const sprite = (kind, side = 'you') =>
  sprites[kind + side] || (sprites[kind + side] = snapshot(model(kind, side)));

/** Crisp pixel drawing on one canvas. */
export class Pen {
  constructor(ctx) { this.g = ctx; }
  px(x, y, w, h, col) { this.g.fillStyle = col; this.g.fillRect(x | 0, y | 0, w, h); }

  /** A small number in a 3 x 5 pixel font, on a pale backing. */
  num(n, x, y, col) {
    const s = String(n);
    this.px(x - 1, y - 1, s.length * 4 + 1, 7, 'rgba(247,240,218,.9)');
    [...s].forEach((ch, i) => {
      const bits = DIGITS[+ch];
      for (let b = 0; b < 15; b++) if (bits[b] === '1') this.px(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1, col);
    });
  }

  /** A crisp pixel line (Bresenham's algorithm: step along the longer axis
      and decide each pixel on the shorter one by tracking the accumulated
      error). */
  line(x0, y0, x1, y1, col, w = 2, dash = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    this.g.fillStyle = col;
    for (;;) {
      if (!dash || n % (dash * 2) < dash) this.g.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
      n++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
function tweenPos(t, at) {
  const k = Math.max(0, Math.min(1, (at - t.t0) / t.dur)), e = ease(k);
  return { x: t.from[0] + (t.to[0] - t.from[0]) * e, y: t.from[1] + (t.to[1] - t.from[1]) * e, k };
}

export class Board {
  constructor(canvas, day) {
    this.el = canvas;
    this.day = day;
    canvas.width = day.W * C + RIM * 2;
    canvas.height = day.H * C + RIM * 2 + TOP;
    this.pen = new Pen(canvas.getContext('2d'));
    this.tw = null;
    this.loopUntil = 0;
    this.redraw = () => {};
  }

  cellX(x) { return RIM + x * C; }
  cellY(y) { return TOP + RIM + (this.day.H - 1 - y) * C; }
  centre(x, y) { return [this.cellX(x) + C / 2, this.cellY(y) + C / 2]; }

  /** The square under a click or tap, or null. */
  cellAt(e) {
    const r = this.el.getBoundingClientRect();
    const ix = (e.clientX - r.left) * this.el.width / r.width;
    const iy = (e.clientY - r.top) * this.el.height / r.height;
    const x = Math.floor((ix - RIM) / C), y = this.day.H - 1 - Math.floor((iy - TOP - RIM) / C);
    return onBoard(this.day, x, y) ? { x, y } : null;
  }

  tiles() {
    const { pen, day } = this, P = pen.px.bind(pen);
    pen.g.clearRect(0, 0, this.el.width, this.el.height);
    // The rim follows the board's shape: drawn per square, so a board with
    // holes gets a rim around every edge, inside and out.
    for (const pass of [0, 1])
      for (let y = 0; y < day.H; y++)
        for (let x = 0; x < day.W; x++) {
          if (!onBoard(day, x, y)) continue;
          const i = pass ? RIM - 2 : RIM;
          P(this.cellX(x) - i, this.cellY(y) - i, C + i * 2, C + i * 2, pass ? '#6b4a2e' : '#4a3220');
        }
    for (let y = 0; y < day.H; y++)
      for (let x = 0; x < day.W; x++) {
        if (!onBoard(day, x, y)) continue;
        const green = (x + y) % 2 === 0;
        P(this.cellX(x), this.cellY(y), C, C, green ? '#b9dc9b' : '#f6efd7');
        // A few blades of grass on the green squares, in fixed places.
        if (green) for (let k = 0; k < 3; k++) {
          const h = ((x * 7 + y * 13 + k * 5) * 2654435761) >>> 0;
          P(this.cellX(x) + 3 + (h % 21), this.cellY(y) + 3 + ((h >>> 8) % 21), 1, 2, '#9fca7f');
        }
      }
  }

  paw(x, y, col) {
    const [cx, cy] = this.centre(x, y), P = this.pen.px.bind(this.pen);
    P(cx + 4, cy + 7, 3, 2, col);
    P(cx + 3, cy + 5, 1, 1, col); P(cx + 5, cy + 4, 1, 1, col); P(cx + 7, cy + 5, 1, 1, col);
  }

  /** Numbered tracks for every pattern foe: where it has been, in order. */
  tracks(track) {
    const last = track[track.length - 1];
    let n = 0;
    last.foes.forEach((f, k) => {
      if (f.brain !== 'pattern') return;
      const col = TRACK[n++ % TRACK.length];
      const P = [];
      for (const s of track) { const g = s.foes[k]; if (g.taken) break; P.push([g.x, g.y]); }
      for (let i = 1; i < P.length; i++) {
        if (P[i][0] === P[i - 1][0] && P[i][1] === P[i - 1][1]) continue;
        const [ax, ay] = this.centre(...P[i - 1]), [bx, by] = this.centre(...P[i]);
        this.pen.line(ax, ay, bx, by, col + '73', 1, 2);
      }
      const labels = new Map();
      P.forEach(([x, y], i) => { if (i < P.length - 1) this.paw(x, y, col + '80'); labels.set(y * this.day.W + x, i); });
      for (const [sq, i] of labels) this.pen.num(i, this.cellX(sq % this.day.W) + 3, this.cellY(Math.floor(sq / this.day.W)) + 3, col);
    });
    // The hole leaves numbered tracks too, in its own colour.
    if (last.hole?.pattern) {
      const col = '#1d6b6b', P = track.map((s) => [s.hole.x, s.hole.y]);
      for (let i = 1; i < P.length; i++) {
        if (P[i][0] === P[i - 1][0] && P[i][1] === P[i - 1][1]) continue;
        const [ax, ay] = this.centre(...P[i - 1]), [bx, by] = this.centre(...P[i]);
        this.pen.line(ax, ay, bx, by, col + '73', 1, 2);
      }
      const labels = new Map();
      P.forEach(([x, y], i) => labels.set(y * this.day.W + x, i));
      for (const [sq, i] of labels) this.pen.num(i, this.cellX(sq % this.day.W) + C - 8, this.cellY(Math.floor(sq / this.day.W)) + 3, col);
    }
  }

  /** The hole: a dark pit in the grass, drawn flat on the board. */
  pit(x, y) {
    const cx = Math.round(this.cellX(0) + x * C + C / 2), cy = Math.round(this.cellY(0) - y * C + C / 2 + 2);
    const disc = (rx, ry, col, dy = 0) => {
      for (let j = -ry; j <= ry; j++) {
        const w = Math.round(rx * Math.sqrt(1 - (j / (ry + 0.5)) ** 2));
        this.pen.px(cx - w, cy + j + dy, w * 2, 1, col);
      }
    };
    disc(10, 7, '#7a6440');
    disc(9, 6, '#2a1f13');
    disc(6, 4, '#140e08', 1);
  }

  /** Lines showing where each player's pieces went, one colour per player. */
  paths(paths) {
    paths.forEach(({ play, color, upto }, idx) => {
      const off = ((idx % 3) - 1) * 3;
      const last = Math.min(upto ?? play.moves.length, play.moves.length);
      for (let i = 0; i < last; i++) {
        const m = play.moves[i];
        if (m.p < 0) continue;
        const a = play.states[i].pieces[m.p], b = play.states[i + 1].pieces[m.p];
        const [ax, ay] = this.centre(a.x, a.y), [bx, by] = this.centre(b.x, b.y);
        this.pen.line(ax + off, ay + off, bx + off, by + off, color, 2);
        this.pen.px(bx + off - 2, by + off - 2, 4, 4, color);
        if (play.states[i + 1].won) {
          const L = (a, b, c, d) => this.pen.line(a, b, c, d, color, 2);
          L(bx - 9, by - 9, bx + 9, by - 9); L(bx + 9, by - 9, bx + 9, by + 9);
          L(bx + 9, by + 9, bx - 9, by + 9); L(bx - 9, by + 9, bx - 9, by - 9);
        }
      }
    });
  }

  spriteAt(img, x, y, lift = 0, ring = null) {
    const cx = Math.round(this.cellX(0) + x * C + C / 2), base = Math.round(this.cellY(0) - y * C + C / 2 + 6);
    const P = this.pen.px.bind(this.pen), sh = ring || 'rgba(40,30,10,.22)';
    P(cx - 6, base - 1, 12, 1, sh); P(cx - 9, base, 18, 2, sh); P(cx - 6, base + 2, 12, 1, sh);
    this.pen.g.drawImage(img, cx - 15, Math.round(base - 31 - lift));
  }

  /**
   * Draw one view: { state, track, sel, legal, paths }. `track` is the list
   * of states so far (for the numbered tracks); `legal` is where the selected
   * piece can go.
   */
  draw(v) {
    const s = v.state, at = performance.now(), { pen, day } = this, P = pen.px.bind(pen), tw = this.tw;
    this.tiles();

    // Where the selected piece can go: the whole square lights up. Gold for
    // a move, coral for a catch.
    const frame = (x, y, w, col) => { P(x, y, C, w, col); P(x, y + C - w, C, w, col); P(x, y, w, C, col); P(x + C - w, y, w, C, col); };
    for (const m of v.legal || []) {
      const x = this.cellX(m.x), y = this.cellY(m.y);
      if (m.cap || m.sink) { P(x, y, C, C, 'rgba(226,96,62,.5)'); frame(x, y, 2, '#c8462e'); }
      else { P(x, y, C, C, 'rgba(242,193,78,.45)'); frame(x, y, 1, 'rgba(176,128,24,.55)'); }
    }
    if (v.sel != null) {
      const p = s.pieces[v.sel], x = this.cellX(p.x), y = this.cellY(p.y);
      P(x, y, C, C, 'rgba(242,193,78,.75)'); frame(x, y, 2, '#c9921a');
    }

    // The square the bramble will take next, faintly, so it is never a surprise.
    const bc = brambleCount(day, s.t);
    if (v.track && bc < day.bramble.length) {
      const sq = day.bramble[bc], x = this.cellX(sq % day.W), y = this.cellY(Math.floor(sq / day.W));
      for (const [a, b] of [[6, 8], [16, 6], [10, 17], [20, 18], [7, 21]]) {
        P(x + a, y + b, 3, 1, 'rgba(63,107,44,.55)'); P(x + a + 1, y + b - 1, 1, 3, 'rgba(63,107,44,.55)');
      }
    }
    let hole = null;
    if (s.hole) {
      hole = { x: s.hole.x, y: s.hole.y };
      if (tw?.hole) ({ x: hole.x, y: hole.y } = tweenPos(tw.hole, at));
      this.pit(hole.x, hole.y);
    }
    if (v.track) this.tracks(v.track);
    if (v.paths) this.paths(v.paths);

    // Everything that stands up, drawn back to front.
    const things = [];
    for (const sq of day.stumps) things.push({ img: sprite('stump'), x: sq % day.W, y: Math.floor(sq / day.W) });
    for (let i = 0; i < bc; i++) {
      const sq = day.bramble[i];
      things.push({ img: sprite('bramble'), x: sq % day.W, y: Math.floor(sq / day.W), under: true });
    }
    if (hole) things.push({ img: sprite('flag'), x: hole.x + 0.32, y: hole.y + 0.12 });
    s.pieces.forEach((p, i) => {
      // An eaten piece stays on the board until whatever ate it lands.
      if (p.taken && !(tw?.eaten?.has(i) && at < tw.landAt)) return;
      // A sunk ball rolls to the hole, then it is gone.
      if (s.sunk && p.type === 'ball' && !(tw?.sinkAt && at < tw.sinkAt)) return;
      let x = p.x, y = p.y;
      if (tw?.piece?.i === i) ({ x, y } = tweenPos(tw.piece, at));
      things.push({ img: sprite(p.type), x, y });
    });
    const marked = day.rules.goal === 'target' && day.foes.length > 1;
    s.foes.forEach((f, k) => {
      // A caught foe stays until your piece arrives.
      if (f.taken && !(tw?.caught?.has(k) && at < tw.caughtAt)) return;
      let x = f.x, y = f.y, lift = 0;
      const t = tw?.foes?.[k];
      if (t) {
        const q = tweenPos(t, at);
        x = q.x; y = q.y;
        lift = t.hop ? Math.sin(Math.PI * q.k) * (t.blocked ? 3 : 9) : 0;
      }
      things.push({ img: sprite(f.type, 'foe'), x, y, lift, ring: marked && f.target ? 'rgba(227,189,87,.9)' : null });
    });
    things.sort((a, b) => b.y - a.y || (b.under ? 1 : 0) - (a.under ? 1 : 0));
    for (const t of things) this.spriteAt(t.img, t.x, t.y, t.lift || 0, t.ring);

    for (const pf of tw?.poofs || []) {
      if (at < pf.t0) continue;
      const k = (at - pf.t0) / pf.dur;
      if (k >= 1) continue;
      const [cx, cy] = this.centre(pf.x, pf.y);
      for (let a = 0; a < 8; a++) {
        const r = 4 + k * 14, ang = a * Math.PI / 4;
        P(cx + Math.cos(ang) * r - 1, cy - 4 + Math.sin(ang) * r - 1, 2, 2, a % 2 ? pf.c1 : pf.c2);
      }
    }
  }

  /** Animate the step from state `a` to state `b` made by your move `mv`.
      Resolves when it is done. */
  animate(a, b, mv, slow = 1) {
    let t = performance.now();
    const tw = { poofs: [], foes: {} };
    if (mv.p >= 0) {
      const p0 = a.pieces[mv.p], p1 = b.pieces[mv.p];
      tw.piece = { i: mv.p, from: [p0.x, p0.y], to: [p1.x, p1.y], t0: t, dur: 190 * slow };
      t += 190 * slow;
    }
    // Anything you caught vanishes as your piece lands.
    tw.caught = new Set(b.foes.map((f, k) => (f.taken && !a.foes[k].taken ? k : -1)).filter((k) => k >= 0));
    tw.caughtAt = t;
    for (const k of tw.caught) {
      tw.poofs.push({ x: a.foes[k].x, y: a.foes[k].y, t0: t, dur: 480, c1: '#ffffff', c2: '#f2c14e' });
    }
    if (tw.caught.size) t += b.won ? 480 : 200;
    if (b.sunk && !a.sunk) {
      tw.sinkAt = t;
      tw.poofs.push({ x: b.hole.x, y: b.hole.y, t0: t, dur: 520, c1: '#2a1f13', c2: '#f4ecd6' });
      t += 520;
    }

    if (!b.won && b.t !== a.t) {
      // Then their turn, if there was one: every foe that moved (or tried
      // to) goes at once.
      const t0 = t + 70 * slow, dur = 300 * slow;
      let any = false;
      b.foes.forEach((f, k) => {
        const f0 = a.foes[k];
        if (f0.taken || tw.caught.has(k)) return;
        if (f.x !== f0.x || f.y !== f0.y || f.blocked) {
          tw.foes[k] = { from: [f0.x, f0.y], to: [f.x, f.y], t0, dur, hop: f.brain === 'pattern', blocked: f.blocked };
          any = true;
        }
      });
      if (a.hole && b.hole && (a.hole.x !== b.hole.x || a.hole.y !== b.hole.y)) {
        tw.hole = { from: [a.hole.x, a.hole.y], to: [b.hole.x, b.hole.y], t0, dur };
        any = true;
      }
      if (any) t = t0 + dur;
      tw.eaten = new Set(b.pieces.map((p, i) => (p.taken && !a.pieces[i].taken ? i : -1)).filter((i) => i >= 0));
      tw.landAt = t - 40;
      for (const i of tw.eaten) tw.poofs.push({ x: a.pieces[i].x, y: a.pieces[i].y, t0: t - 40, dur: 480, c1: '#7a5133', c2: '#c8462e' });
      if (tw.eaten.size) t += 440;
    }
    this.tw = tw;
    const start = performance.now() >= this.loopUntil;
    this.loopUntil = t;
    if (start) requestAnimationFrame(() => this.loop());
    return new Promise((res) => setTimeout(res, t - performance.now() + 20));
  }

  loop() {
    this.redraw();
    if (performance.now() < this.loopUntil) requestAnimationFrame(() => this.loop());
    else { this.tw = null; this.redraw(); }
  }
}

/**
 * A pattern drawn out: one full run of hops, numbered, then the start of the
 * next run in faint lines so it visibly repeats.
 */
export function patternPicture(cv, steps0, mx = 1, my = 1) {
  const steps = steps0.map(([dx, dy]) => [dx * mx, dy * my]);
  const L = steps.length, pts = [[0, 0]];
  for (let r = 0; r < (L === 1 ? 3 : 2); r++)
    for (const [dx, dy] of steps) { const [x, y] = pts[pts.length - 1]; pts.push([x + dx, y + dy]); }
  const span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k])) + 1;
  while (pts.length > L + 1 && (span(0) > 9 || span(1) > 7)) pts.pop();
  const minX = Math.min(...pts.map((p) => p[0])), maxY = Math.max(...pts.map((p) => p[1]));
  const c = 14, W = span(0), H = span(1);
  cv.width = W * c; cv.height = H * c;
  cv.style.width = `${W * c * 2}px`;
  const pen = new Pen(cv.getContext('2d'));
  const ctr = ([x, y]) => [(x - minX) * c + c / 2, (maxY - y) * c + c / 2];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pen.px(x * c, y * c, c, c, (x + y) % 2 ? '#f6efd7' : '#b9dc9b');
  const [sx, sy] = ctr(pts[0]);
  pen.px(sx - 5, sy - 5, 10, 10, '#f0a3b2'); pen.px(sx - 4, sy - 4, 8, 8, '#ffffff');
  for (let i = pts.length - 1; i >= 1; i--) {
    const faint = i > L, [ax, ay] = ctr(pts[i - 1]), [bx, by] = ctr(pts[i]);
    pen.line(ax, ay, bx, by, faint ? 'rgba(107,74,44,.3)' : '#6b4a2c', faint ? 1 : 2);
    if (!faint) pen.px(bx - 2, by - 2, 4, 4, '#6b4a2c');
  }
  for (let i = 1; i <= L; i++) { const [bx, by] = ctr(pts[i]); pen.num(i, bx + 2, by - 6, '#3a2616'); }
}

// --- The pieces menu's little move diagrams. -------------------------------

const DEMO = {
  pawn: { rabbit: [4, 4] },
  cannon: { stumps: [[3, 5]], rabbit: [3, 6] },
  grasshopper: { stumps: [[3, 5], [5, 5], [1, 3]] },
  mao: { stumps: [[4, 3]] }
};

/** A 7 x 7 picture of where a piece can go from the middle of an empty board. */
export function diagram(type) {
  const D = 7, c = 8, cv = document.createElement('canvas');
  cv.className = 'diagram pix'; cv.width = D * c; cv.height = D * c;
  const ctx = cv.getContext('2d'), demo = DEMO[type] || {};
  const day = { W: D, H: D, holes: new Set(), stumps: new Set((demo.stumps || []).map(([x, y]) => y * D + x)),
    bramble: [], brambleAt: new Map(), every: 2, rules: { foesCapture: true } };
  const r = demo.rabbit;
  const s = { day, t: 0, won: false, pieces: [{ type, x: 3, y: 3 }],
    foes: r ? [{ type: 'rabbit', x: r[0], y: r[1], brain: 'pattern' }] : [] };
  const at = (x, y, col, inset = 0) => { ctx.fillStyle = col; ctx.fillRect(x * c + inset, (D - 1 - y) * c + inset, c - inset * 2, c - inset * 2); };
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) at(x, y, (x + y) % 2 ? '#f6efd7' : '#b9dc9b');
  for (const [x, y] of demo.stumps || []) at(x, y, '#6a4a30', 1);
  if (r) at(r[0], r[1], '#ffffff', 1);
  at(3, 3, '#553722', 1);
  for (const m of movesFor(s, 0)) {
    if (m.cap) { at(m.x, m.y, '#e2603e', 0); at(m.x, m.y, '#ffffff', 2); }
    else at(m.x, m.y, '#ecc95a', 0);
  }
  return cv;
}

// --- The title's turning model of a board. ---------------------------------

const T = 10;
/** The whole board as a 3D scene: tiles, rim, and everything on it. */
export function scene(day, s = null) {
  const m = new Mesh(), W = day.W, H = day.H, hw = (W * T) / 2, hh = (H * T) / 2;
  const x0 = (x) => (x - W / 2) * T, z0 = (y) => (H / 2 - 1 - y) * T;
  if (!day.holes.size) m.addBox(-hw - 3, -4, -hh - 3, hw + 3, -1, hh + 3, '#5a3d26', 0, 1 << 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!onBoard(day, x, y)) continue;
      // An odd-shaped board gets a base under each square instead of one slab.
      if (day.holes.size) m.addBox(x0(x) - 2, -4, z0(y) - 2, x0(x) + T + 2, -1, z0(y) + T + 2, '#5a3d26', 0, 1 << 3);
      // Hide the sides between neighbouring tiles; only the outer ones show.
      const skip = (1 << 3) | (onBoard(day, x + 1, y) ? 1 : 0) | (onBoard(day, x - 1, y) ? 2 : 0) |
        (onBoard(day, x, y - 1) ? 16 : 0) | (onBoard(day, x, y + 1) ? 32 : 0);
      m.addBox(x0(x), -1, z0(y), x0(x) + T, 0, z0(y) + T, (x + y) % 2 === 0 ? '#b9dc9b' : '#f6efd7', 0, skip);
    }
  const at = (kind, side, x, y, id) => m.add(model(kind, side), x0(x) + T / 2, 0, z0(y) + T / 2, id);
  let id = 1;
  for (const sq of day.stumps) at('stump', 'you', sq % W, Math.floor(sq / W), id++);
  const h = (s || day).hole || day.hole;
  if (h) {
    m.add(new Model().lathe([[3.3, 0.02], [3.3, 0.08]], '#1a130b', { seg: 12 }), x0(h.x) + T / 2, 0, z0(h.y) + T / 2, id++);
    m.add(model('flag'), x0(h.x) + T / 2 + 2, 0, z0(h.y) + T / 2 - 1, id++);
  }
  if (day.bramble.length) at('bramble', 'you', day.bramble[0] % W, Math.floor(day.bramble[0] / W), id++);
  for (const p of (s || day).pieces) if (!p.taken) at(p.type, 'you', p.x, p.y, id++);
  for (const f of (s || day).foes) if (!f.taken) at(f.type, 'foe', f.x, f.y, id++);
  return m;
}

/** The size of canvas a board's scene needs, and where its centre goes. */
export function sceneFrame(day, pitch, scale) {
  const hd = (Math.max(day.W, day.H) * T / 2 + 3) * Math.SQRT2;
  const top = Math.ceil((hd * Math.sin(pitch) + 15 * Math.cos(pitch)) * scale + 10);
  const bot = Math.ceil((hd * Math.sin(pitch) + 4 * Math.cos(pitch)) * scale + 4);
  return { w: Math.ceil(hd * 2 * scale) + 8, h: top + bot, cy: top };
}

export { PIECES };

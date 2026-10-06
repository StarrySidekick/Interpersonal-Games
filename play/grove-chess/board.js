// The board on screen, shared by the daily game and the lab: drawing, the
// animations between moves, and turning a tap into a square.
//
// The board is a small canvas drawn pixel by pixel and scaled up with
// `image-rendering: pixelated`. Pieces are sprites rendered once from their
// 3D models (engine/lowpoly.js).

import { Mesh, Model, snapshot } from '../../engine/lowpoly.js';
import { model } from './models.js';
import { brambleCount, onBoard, movesFor, holeOpen, nextShrink, PIECES } from './rules.js';
import * as sfx from './sounds.js';

const GREEN = '#b9dc9b', CREAM = '#f6efd7';

// Each kind of ground has its own look, so you can tell at a glance what the
// board will do: solid is green and cream; crumbling is dry, cracked earth;
// shrinking is pale and misty, as if the edges were already half gone.
const GROUND = {
  solid: { light: GREEN, dark: CREAM },
  crumble: { light: '#cdb98a', dark: '#ecdcb6', crack: 'rgba(92,64,34,.35)' },
  shrink: { light: '#a9c4b8', dark: '#e4ece4' }
};
export const groundOf = (day) => (day.rules?.shrink ? 'shrink' : day.rules?.crumble ? 'crumble' : 'solid');
const tileColour = (day, x, y) => { const g = GROUND[groundOf(day)]; return (x + y) % 2 === 0 ? g.light : g.dark; };
const PIT = '#050302'; // what is left where a square fell away: darkness, nothing else

export const C = 28, RIM = 5, TOP = 16;

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

// Track colours, one per pattern foe: the first is the daily rabbit's brown.
const TRACK = ['#6b4a2c', '#2f6fc0', '#8a4bb0', '#118a74', '#c2378a', '#de7a1f', '#5f7a20', '#9a6a0c'];

const sprites = {};
export const sprite = (kind, side = 'you', fur = null) =>
  sprites[kind + side + (fur || '')] || (sprites[kind + side + (fur || '')] = snapshot(model(kind, side, fur)));

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

/** A colour mixed toward black by k (0 to 1), for things falling into the dark. */
function darker(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * (1 - k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Leaves for a winning catch: a burst thrown up and out, falling back under
// gravity. Random is fine here: it is only how the leaves fly.
const LEAF = ['#8fc46a', '#5f9a45', '#b9dc9b', '#f6efd7', '#f2c14e'];
function leafBurst(x, y, t0) {
  const bits = [];
  for (let i = 0; i < 18; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3, sp = 50 + Math.random() * 80;
    bits.push({ vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, col: LEAF[i % LEAF.length], w: i % 3 ? 2 : 3 });
  }
  return { x, y, t0, dur: 950, bits };
}

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
    // For the opening animation: hide your pieces while the board falls in,
    // then `landing(i, now)` gives each piece's height above its square, or
    // null while it has not appeared yet.
    this.hidePieces = false;
    this.landing = null;
    // A catch that wins the game gets its own moment (a beat, a flash, a
    // tumble, leaves). The opening's little demo boards turn it off.
    this.celebrate = true;
    // The fur colour to draw a foe in (rabbits.js), or null for white. Each
    // page decides: the lab shows every colour, the daily only ones you
    // have earned.
    this.fur = () => null;
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

  /** The squares, and the rim around them. `s` is the state on show, for
      the squares that have crumbled away or fallen off the edge; `at` is the
      time, for one that is going right now. */
  tiles(s = null, at = 0) {
    const { pen, day } = this, P = pen.px.bind(pen), W = day.W;
    pen.g.clearRect(0, 0, this.el.width, this.el.height);
    // A square that fell off a shrinking edge is not part of the board any
    // more, so it loses its rim too (once it has finished going).
    const off = new Set(s?.shrunk || []), vanish = this.tw?.vanish;
    const here = (x, y) => onBoard(day, x, y) && (!off.has(y * W + x) || (vanish?.sq === y * W + x && at < vanish.t0 + vanish.dur));
    // The rim follows the board's shape: drawn per square, so a board with
    // holes gets a rim around every edge, inside and out. A square that
    // crumbled keeps its rim: the frame stays, the ground inside fell.
    for (const pass of [0, 1])
      for (let y = 0; y < day.H; y++)
        for (let x = 0; x < W; x++) {
          if (!here(x, y)) continue;
          const i = pass ? RIM - 2 : RIM;
          P(this.cellX(x) - i, this.cellY(y) - i, C + i * 2, C + i * 2, pass ? '#6b4a2e' : '#4a3220');
        }
    const gone = new Set(s?.gone || []), fall = this.tw?.crumble;
    for (let y = 0; y < day.H; y++)
      for (let x = 0; x < W; x++) {
        if (!here(x, y)) continue;
        const sq = y * W + x, col = tileColour(day, x, y);
        if (vanish?.sq === sq && at >= vanish.t0) this.vanishing(x, y, col, (at - vanish.t0) / vanish.dur);
        else if (fall?.sq === sq && at < fall.t0 + fall.dur) {
          if (at < fall.t0) this.tile(x, y, col);
          else this.crumbling(x, y, col, (at - fall.t0) / fall.dur);
        } else if (gone.has(sq)) this.gap(x, y);
        else this.tile(x, y, col);
      }
  }

  /** One square. On crumbling ground every square shows hairline cracks,
      the same ones every time, so the whole board reads as fragile. */
  tile(x, y, col) {
    const X = this.cellX(x), Y = this.cellY(y);
    this.pen.px(X, Y, C, C, col);
    const crack = GROUND[groundOf(this.day)].crack;
    if (!crack) return;
    const v = (x * 7 + y * 13) % 4, L = (pts) => { for (let i = 1; i < pts.length; i++) this.pen.line(X + pts[i - 1][0], Y + pts[i - 1][1], X + pts[i][0], Y + pts[i][1], crack, 1); };
    if (v === 0) { L([[4, 9], [9, 12], [12, 11]]); L([[18, 20], [22, 23]]); }
    if (v === 1) { L([[17, 4], [15, 9], [19, 12]]); L([[5, 21], [9, 19]]); }
    if (v === 2) { L([[6, 6], [10, 5]]); L([[14, 17], [18, 15], [23, 18]]); }
    if (v === 3) { L([[20, 7], [23, 11]]); L([[7, 15], [6, 19], [10, 22]]); }
  }

  /** A square that has crumbled away: nothing but darkness. */
  gap(x, y) {
    this.pen.px(this.cellX(x), this.cellY(y), C, C, PIT);
  }

  /** A square partway through crumbling: k runs from 0 (whole) to 1 (gone).
      Four chunks shrink away into the pit, as if falling, darkening as they go. */
  crumbling(x, y, col, k) {
    this.gap(x, y);
    const X = this.cellX(x), Y = this.cellY(y), h = C / 2, e = k * k;
    for (const [qx, qy, lag] of [[0, 0, 0.1], [1, 0, 0], [0, 1, 0.25], [1, 1, 0.15]]) {
      const q = Math.max(0, Math.min(1, (e - lag) / (1 - lag)));
      const size = Math.round(h * (1 - q));
      if (size <= 0) continue;
      const cx = X + qx * h + h / 2 + (qx ? -1 : 1) * q * 3, cy = Y + qy * h + h / 2 + q * 5;
      this.pen.px(cx - size / 2, cy - size / 2, size, size, q > 0.5 ? darker(col, 0.3 + q * 0.4) : col);
    }
  }

  /** A square falling off a shrinking edge: it sinks away into the dark,
      shrinking and fading, and its rim goes with it. k runs from 0 to 1. */
  vanishing(x, y, col, k) {
    const X = this.cellX(x), Y = this.cellY(y), e = k * k, size = Math.round(C * (1 - e));
    this.pen.px(X - 2, Y - 2, C + 4, C + 4, `rgba(5,3,2,${0.85 * Math.min(1, k * 2)})`);
    if (size > 0) this.pen.px(X + (C - size) / 2, Y + (C - size) / 2 + e * 6, size, size, darker(col, e * 0.8));
  }

  /** Cracks running in from the corners of a square, on crumbling levels:
      the square a selected piece will leave behind. In from the corners so
      the piece standing in the middle does not hide them. */
  cracks(x, y) {
    const X = this.cellX(x), Y = this.cellY(y), col = '#5a3a1e';
    const L = (pts) => { for (let i = 1; i < pts.length; i++) this.pen.line(X + pts[i - 1][0], Y + pts[i - 1][1], X + pts[i][0], Y + pts[i][1], col, 1); };
    L([[2, 2], [6, 5], [7, 9]]); L([[6, 5], [10, 4]]);
    L([[25, 2], [21, 6], [22, 10]]);
    L([[2, 25], [5, 21], [9, 22]]);
    L([[25, 25], [22, 21], [18, 22]]); L([[22, 21], [23, 17]]);
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

  /** The hole: a dark pit in the grass, drawn flat on the board. `lid` is
      how shut it is, from 1 (covered over with woven twigs, until every
      rabbit is caught) to 0 (open). */
  pit(x, y, lid = 0) {
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
    if (lid <= 0) return;
    // The cover shrinks away from the middle as it opens.
    const rx = Math.round(9 * lid), ry = Math.round(6 * lid);
    if (rx < 1) return;
    disc(rx, ry, '#8a6a3c');
    for (let j = -ry + 1; j < ry; j += 2) this.pen.px(cx - rx + 1, cy + j, rx * 2 - 2, 1, '#6b4f2a');
    this.pen.px(cx - 1, cy - ry, 2, ry * 2, '#5a4022');
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
    this.tiles(s, at);

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
      if (day.rules.crumble) this.cracks(p.x, p.y);
    }

    // The square the bramble will take next, faintly, so it is never a surprise.
    const bc = brambleCount(day, s.t);
    if (v.track && bc < day.bramble.length) {
      const sq = day.bramble[bc], x = this.cellX(sq % day.W), y = this.cellY(Math.floor(sq / day.W));
      for (const [a, b] of [[6, 8], [16, 6], [10, 17], [20, 18], [7, 21]]) {
        P(x + a, y + b, 3, 1, 'rgba(63,107,44,.55)'); P(x + a + 1, y + b - 1, 1, 3, 'rgba(63,107,44,.55)');
      }
    }
    // On shrinking ground, the square that falls after this move (if the
    // edge falls then) is drawn shadowed, so it is never a surprise.
    if (v.track && day.rules.shrink && (s.t + 1) % (day.rules.shrinkEvery || 2) === 0 && !tw) {
      const sq = nextShrink(s);
      if (sq !== null) {
        const x = this.cellX(sq % day.W), y = this.cellY(Math.floor(sq / day.W));
        P(x, y, C, C, 'rgba(5,3,2,.22)');
        for (let i = 0; i < C; i += 4) { P(x + i, y, 2, 1, 'rgba(5,3,2,.5)'); P(x + i, y + C - 1, 2, 1, 'rgba(5,3,2,.5)'); P(x, y + i, 1, 2, 'rgba(5,3,2,.5)'); P(x + C - 1, y + i, 1, 2, 'rgba(5,3,2,.5)'); }
      }
    }
    let hole = null;
    if (s.hole) {
      hole = { x: s.hole.x, y: s.hole.y };
      if (tw?.hole) ({ x: hole.x, y: hole.y } = tweenPos(tw.hole, at));
      let lid = holeOpen(s) ? 0 : 1;
      if (tw?.open && at < tw.open.t0 + tw.open.dur) lid = 1 - Math.max(0, (at - tw.open.t0) / tw.open.dur);
      this.pit(hole.x, hole.y, lid);
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
    if (!this.hidePieces) s.pieces.forEach((p, i) => {
      // An eaten piece stays on the board until whatever ate it lands.
      if (p.taken && !(tw?.eaten?.has(i) && at < tw.landAt)) return;
      // A sunk ball rolls to the hole, then it is gone.
      if (s.sunk && p.type === 'ball' && !(tw?.sinkAt && at < tw.sinkAt)) return;
      let x = p.x, y = p.y;
      if (tw?.piece?.i === i) ({ x, y } = tweenPos(tw.piece, at));
      let lift = 0;
      if (this.landing) { lift = this.landing(i, at); if (lift === null) return; }
      things.push({ img: sprite(p.type), x, y, lift });
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
      things.push({ img: sprite(f.type, 'foe', this.fur(f)), x, y, lift, ring: marked && f.target ? 'rgba(227,189,87,.9)' : null });
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
        P(cx + Math.cos(ang) * r - 1, cy - (pf.low ? 0 : 4) + Math.sin(ang) * r * (pf.low ? 0.6 : 1) - 1, 2, 2, a % 2 ? pf.c1 : pf.c2);
      }
    }

    // A winning catch. Everything holds for a beat while the square flashes,
    // then what you caught pops up, tumbles and shrinks away where it stood
    // (a small arc, so a rabbit on the top row stays on the canvas).
    const g = pen.g;
    for (const tb of tw?.tumbles || []) {
      const e = at - tb.t0;
      if (e < 0 || e > tb.dur) continue;
      const [cx, cy] = this.centre(tb.x, tb.y);
      if (e < tb.hold + 200) P(cx - C / 2, cy - C / 2, C, C, `rgba(255,255,255,${0.65 * (1 - e / (tb.hold + 200))})`);
      let lift = 7, rot = 0, sc = 1;
      if (e > tb.hold) {
        const k = (e - tb.hold) / (tb.dur - tb.hold);
        lift = 7 + Math.sin(Math.PI * Math.min(1, k * 1.4)) * 14; // up and back down
        rot = k * Math.PI * 2.5;
        sc = k > 0.45 ? 1 - (k - 0.45) / 0.55 : 1;
      }
      // Rotate around the sprite's middle: its feet sit 31px down a 36px image.
      g.save();
      g.imageSmoothingEnabled = false;
      g.globalAlpha = Math.max(0, sc);
      g.translate(cx, cy + 6 - 13 - lift);
      g.rotate(rot);
      g.scale(Math.max(0.01, sc), Math.max(0.01, sc));
      g.drawImage(tb.img, -15, -18);
      g.restore();
    }
    for (const lb of tw?.leaves || []) {
      const k = (at - lb.t0) / lb.dur, e = (at - lb.t0) / 1000;
      if (k < 0 || k >= 1) continue;
      const [cx, cy] = this.centre(lb.x, lb.y);
      g.save();
      g.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      for (const b of lb.bits) P(cx + b.vx * e, cy - 4 + b.vy * e + 110 * e * e, b.w, 2, b.col);
      g.restore();
    }
  }

  /** Animate the step from state `a` to state `b` made by your move `mv`.
      Resolves when it is done. */
  animate(a, b, mv, slow = 1) {
    let t = performance.now();
    // Sounds are scheduled now, for the moment their frame will be drawn.
    const start = t, at = (ms) => (ms - start) / 1000;
    const tw = { poofs: [], foes: {}, tumbles: [], leaves: [] };
    if (mv.p >= 0) {
      const p0 = a.pieces[mv.p], p1 = b.pieces[mv.p];
      tw.piece = { i: mv.p, from: [p0.x, p0.y], to: [p1.x, p1.y], t0: t, dur: 190 * slow };
      // On crumbling ground the square it left falls away as it goes.
      if (b.gone?.length > (a.gone?.length || 0)) {
        tw.crumble = { sq: b.gone[b.gone.length - 1], t0: t + 60 * slow, dur: 420 * slow };
        tw.poofs.push({ x: p0.x, y: p0.y, t0: t + 120 * slow, dur: 420, c1: '#7a5133', c2: '#b39a6e', low: true });
        sfx.crumble(at(tw.crumble.t0));
      }
      t += 190 * slow;
      sfx.move(at(t));
    }
    // Anything you caught vanishes as your piece lands. A catch that wins
    // the game is a moment of its own: a held beat, then the tumble.
    tw.caught = new Set(b.foes.map((f, k) => (f.taken && !a.foes[k].taken ? k : -1)).filter((k) => k >= 0));
    tw.caughtAt = t;
    if (tw.caught.size && b.won && this.celebrate) {
      const hold = 150 * slow, dur = 720 * slow;
      for (const k of tw.caught) {
        const f = a.foes[k];
        tw.tumbles.push({ img: sprite(f.type, 'foe', this.fur(f)), x: f.x, y: f.y, t0: t, hold, dur: hold + dur });
        tw.leaves.push(leafBurst(f.x, f.y, t + hold));
      }
      sfx.caught(at(t));
      t += hold + dur;
    } else if (tw.caught.size) {
      for (const k of tw.caught) tw.poofs.push({ x: a.foes[k].x, y: a.foes[k].y, t0: t, dur: 480, c1: '#ffffff', c2: '#f2c14e' });
      sfx.capture(at(t));
      t += b.won ? 480 : 200;
    }
    // The last rabbit caught: the hole's cover opens.
    if (a.hole && !holeOpen(a) && holeOpen(b)) {
      tw.open = { t0: t, dur: 520 * slow };
      sfx.opens(at(t));
      t += 360 * slow;
    }
    if (b.sunk && !a.sunk) {
      tw.sinkAt = t;
      tw.poofs.push({ x: b.hole.x, y: b.hole.y, t0: t, dur: 520, c1: '#2a1f13', c2: '#f4ecd6' });
      sfx.sink(at(t));
      if (b.won && this.celebrate) { tw.leaves.push(leafBurst(b.hole.x, b.hole.y, t + 260)); t += 400; }
      t += 520;
    }

    if (!b.won && b.t !== a.t) {
      // Then their turn, if there was one: every foe that moved (or tried
      // to) goes at once.
      const t0 = t + 70 * slow, dur = 300 * slow;
      let any = false, hops = 0;
      b.foes.forEach((f, k) => {
        const f0 = a.foes[k];
        if (f0.taken || tw.caught.has(k)) return;
        if (f.x !== f0.x || f.y !== f0.y || f.blocked) {
          tw.foes[k] = { from: [f0.x, f0.y], to: [f.x, f.y], t0, dur, hop: f.brain === 'pattern', blocked: f.blocked };
          any = true;
          // Each hop is a note for its direction (sounds.js). A crowd of
          // rabbits plays its first three, so a big level is not a din.
          if (f.x === f0.x && f.y === f0.y) sfx.bump(at(t0 + dur / 2));
          else if (f.brain !== 'pattern') sfx.slide(at(t0 + dur));
          else if (hops++ < 3) sfx.hop(f.x - f0.x, f.y - f0.y, at(t0 + (hops - 1) * 20), at(t0 + dur));
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
      if (tw.eaten.size) { sfx.eat(at(tw.landAt)); t += 440; }
    }
    // Then, on shrinking ground, a square on the edge may fall away.
    if ((b.shrunk?.length || 0) > (a.shrunk?.length || 0)) {
      tw.vanish = { sq: b.shrunk[b.shrunk.length - 1], t0: t + 60 * slow, dur: 560 * slow };
      sfx.shrink(at(tw.vanish.t0));
      t = tw.vanish.t0 + tw.vanish.dur;
    }
    this.tw = tw;
    return this.runUntil(Math.max(t, tw.crumble ? tw.crumble.t0 + tw.crumble.dur : 0));
  }

  /** Keep redrawing every frame until time t. Resolves then. */
  runUntil(t) {
    const start = performance.now() >= this.loopUntil;
    this.loopUntil = Math.max(this.loopUntil, t);
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
 * next run in faint lines so it visibly repeats. `upto` draws only the first
 * that many hops, for revealing it. Returns how many hops there are in all
 * (`segs`) and in one run (`L`).
 */
export function patternPicture(cv, steps0, mx = 1, my = 1, upto = Infinity) {
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pen.px(x * c, y * c, c, c, (x + y) % 2 ? CREAM : GREEN);
  const [sx, sy] = ctr(pts[0]);
  pen.px(sx - 5, sy - 5, 10, 10, '#f0a3b2'); pen.px(sx - 4, sy - 4, 8, 8, '#ffffff');
  for (let i = Math.min(pts.length - 1, upto); i >= 1; i--) {
    const faint = i > L, [ax, ay] = ctr(pts[i - 1]), [bx, by] = ctr(pts[i]);
    pen.line(ax, ay, bx, by, faint ? 'rgba(107,74,44,.3)' : '#6b4a2c', faint ? 1 : 2);
    if (!faint) pen.px(bx - 2, by - 2, 4, 4, '#6b4a2c');
  }
  for (let i = 1; i <= Math.min(L, upto); i++) { const [bx, by] = ctr(pts[i]); pen.num(i, bx + 2, by - 6, '#3a2616'); }
  return { segs: pts.length - 1, L };
}

/** Draw a pattern out hop by hop, playing each hop's note as it lands: the
    rabbit's tune, then its first notes again, softer, as it repeats. */
export async function revealPattern(cv, steps, mx = 1, my = 1, gap = 300) {
  const { segs, L } = patternPicture(cv, steps, mx, my, 0);
  for (let i = 1; i <= segs; i++) {
    await new Promise((r) => setTimeout(r, i === 1 ? 250 : gap));
    patternPicture(cv, steps, mx, my, i);
    const [dx, dy] = steps[(i - 1) % L];
    sfx.note(dx * mx, dy * my, 0, i > L ? 0.45 : 1);
  }
}

// --- The pieces menu's little move diagrams. -------------------------------

// A few pieces only make sense with something on the board: a pawn catches
// diagonally, a cannon needs a screen to jump, a grasshopper needs hurdles,
// a mao can be blocked, a ball needs something to stop against. The things
// in the way are pawns of your own, the way they would be in a game.
const DEMO = {
  pawn: { rabbit: [4, 4] },
  cannon: { walls: [[3, 5]], rabbit: [3, 6] },
  grasshopper: { walls: [[3, 5], [5, 5], [1, 3]] },
  mao: { walls: [[4, 3]] },
  ball: { walls: [[3, 6], [0, 3]] }
};

/** A 7 x 7 practice board with one piece (the first) at `at`, plus whatever
    its demonstration needs. Returns a level and its starting state. */
export function demoBoard(type, { at = [3, 3], rules = {} } = {}) {
  const D = 7, demo = DEMO[type] || {}, r = demo.rabbit;
  const pieces = [{ type, x: at[0], y: at[1] }, ...(demo.walls || []).map(([x, y]) => ({ type: 'pawn', x, y }))];
  const day = { W: D, H: D, holes: new Set(), stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2,
    rules: { goal: 'all', foesCapture: true, maxMoves: 0, wait: true, ...rules },
    pieces, foes: r ? [{ type: 'rabbit', x: r[0], y: r[1], brain: 'pattern' }] : [] };
  const s = { day, t: 0, won: false, hole: null, gone: [], pieces: pieces.map((p) => ({ ...p })), foes: day.foes.map((f) => ({ ...f })) };
  return { day, s };
}

/** A 7 x 7 picture of where a piece can go from the middle of an empty board. */
export function diagram(type) {
  const D = 7, c = 8, cv = document.createElement('canvas');
  cv.className = 'diagram pix'; cv.width = D * c; cv.height = D * c;
  const ctx = cv.getContext('2d'), demo = DEMO[type] || {}, r = demo.rabbit;
  const { s } = demoBoard(type);
  const at = (x, y, col, inset = 0) => { ctx.fillStyle = col; ctx.fillRect(x * c + inset, (D - 1 - y) * c + inset, c - inset * 2, c - inset * 2); };
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) at(x, y, (x + y) % 2 ? CREAM : GREEN);
  for (const [x, y] of demo.walls || []) at(x, y, '#6a4a30', 1);
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
export function scene(day, s = null, fur = () => null) {
  const m = new Mesh(), W = day.W, H = day.H, hw = (W * T) / 2, hh = (H * T) / 2;
  const x0 = (x) => (x - W / 2) * T, z0 = (y) => (H / 2 - 1 - y) * T;
  // A crumbled square has no tile, only darkness where it was. A square that
  // fell off a shrinking edge is not there at all.
  const gone = new Set(s?.gone || []), off = new Set(s?.shrunk || []);
  const here = (x, y) => onBoard(day, x, y) && !off.has(y * W + x), tile = (x, y) => here(x, y) && !gone.has(y * W + x);
  const slab = !day.holes.size && !off.size;
  if (slab) m.addBox(-hw - 3, -4, -hh - 3, hw + 3, -1, hh + 3, '#5a3d26', 0, 1 << 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!here(x, y)) continue;
      // An odd-shaped board gets a base under each square instead of one slab.
      if (!slab) m.addBox(x0(x) - 2, -4, z0(y) - 2, x0(x) + T + 2, -1, z0(y) + T + 2, '#5a3d26', 0, 1 << 3);
      if (!tile(x, y)) { m.addBox(x0(x), -1, z0(y), x0(x) + T, -0.9, z0(y) + T, PIT, 0, 1 << 3); continue; }
      // Hide the sides between neighbouring tiles; only the outer ones show.
      const skip = (1 << 3) | (tile(x + 1, y) ? 1 : 0) | (tile(x - 1, y) ? 2 : 0) |
        (tile(x, y - 1) ? 16 : 0) | (tile(x, y + 1) ? 32 : 0);
      m.addBox(x0(x), -1, z0(y), x0(x) + T, 0, z0(y) + T, tileColour(day, x, y), 0, skip);
    }
  const at = (kind, side, x, y, id) => m.add(model(kind, side), x0(x) + T / 2, 0, z0(y) + T / 2, id);
  let id = 1;
  for (const sq of day.stumps) at('stump', 'you', sq % W, Math.floor(sq / W), id++);
  const h = (s || day).hole || day.hole;
  if (h) {
    // A shut hole (rabbits still loose) has its twig cover on.
    const shut = !holeOpen(s || { day, foes: day.foes });
    m.add(new Model().lathe([[3.3, 0.02], [3.3, 0.08]], shut ? '#8a6a3c' : '#1a130b', { seg: 12 }), x0(h.x) + T / 2, 0, z0(h.y) + T / 2, id++);
    m.add(model('flag'), x0(h.x) + T / 2 + 2, 0, z0(h.y) + T / 2 - 1, id++);
  }
  if (day.bramble.length) at('bramble', 'you', day.bramble[0] % W, Math.floor(day.bramble[0] / W), id++);
  for (const p of (s || day).pieces) if (!p.taken) at(p.type, 'you', p.x, p.y, id++);
  for (const f of (s || day).foes) if (!f.taken) m.add(model(f.type, 'foe', fur(f)), x0(f.x) + T / 2, 0, z0(f.y) + T / 2, id++);
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

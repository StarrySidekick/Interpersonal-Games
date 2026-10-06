// The board in 3D: the same board as board.js, with real models for the
// pieces, in a clearing in a dark, foggy forest. (docs/grove-look.md:
// Nintendo 64, not 16-bit; and an air of mystery.)
//
// The board is seen from straight above, so every square is a true square
// (Timothy, 2026-10-06: the grid has to stay perfectly square). The pieces
// are faked, the way top-down games draw their characters: they are drawn
// from a gentle angle, with a slight turn, and each is placed so that its
// base lands exactly on the middle of its square.
//
// It is a Board (board.js) with its own drawing. What moves when, the
// timings and the sounds all come from Board.animate, so the 3D board and
// the flat one always agree. Add ?flat to a page's address for the flat one.
//
// A frame is drawn in layers:
// 1. The forest floor, the trees and the board's squares, in 3D, from
//    straight above. Squares a selected piece can reach are coloured right
//    into the squares.
// 2. Flat marks on the board's surface, drawn straight onto the picture:
//    the numbered tracks, the lines of a finished game, cracks.
// 3. Everything standing on the board, in 3D again, from the pieces' angle,
//    over the top. Pieces hide each other properly (nearer ones in front),
//    and always stand over the marks.
// 4. Puffs, leaves and flashes; then fog toward the back and darkness all
//    round, the pool of light the board sits in.
//
// It is drawn small and the browser smooths it up, so it comes out soft
// rather than in crisp square pixels.
//
// Taps: the renderer also keeps which object each pixel belongs to, so a tap
// on a piece's head finds the piece. A tap on the board is a square by plain
// arithmetic, since the board is seen straight on.

import { Mesh, Model, makeTarget, render } from '../../engine/lowpoly.js';
import { rng } from '../../engine/seed.js';
import { model } from './models.js';
import { Board, tileColour, PIT, TRACK, tweenPos } from './board.js';
import { onBoard, brambleCount, holeOpen, nextShrink } from './rules.js';
import * as sfx from './sounds.js';

const T = 10;             // one square, in model units
const STAND = 0.6;        // the angle the pieces are seen from, in radians above level
const TURN = -0.35;       // and a slight turn, so they read as solid
const BIG = 1.25;         // pieces stand a little larger here than on the title
const FOG = '#1b2620';    // the forest, far off
const RIM = '#5a3d26';    // the board's wooden base
const PALE = '#e9e4da';   // a possessed piece whose rabbit you do not know
const LIFT = 10 / 28;     // the flat board's pixels of height, in model units

// --- Colours, as the renderer wants them ('#rrggbb'). ----------------------

const hex = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Colour a, moved k of the way to colour b. */
function mix(a, b, k) { const A = hex(a), B = hex(b); return toHex(...A.map((v, i) => v + (B[i] - v) * k)); }
const dim = (c, k) => (k > 0 ? mix(c, '#000000', k) : c);
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

// --- What never changes: the forest, and the hole's parts. ------------------

/** Pines in the fog: a cone or three on a trunk. */
function pine(h, rand) {
  const m = new Model(), g = ['#1d3a26', '#214330', '#1a3322'][Math.floor(rand() * 3)];
  m.lathe([[0.9, 0], [0.7, h * 0.3]], '#3a2a1c', { seg: 5 });
  for (let i = 0; i < 3; i++) m.cone(0, h * (0.22 + i * 0.22), 0, h * (0.32 - i * 0.07), h * 0.42, g, { seg: 6 });
  return m;
}

/** The forest floor and a ring of trees round the clearing, the same every
    time for a given board. Each tree is its own object, so it is outlined.
    The floor has a pit in it exactly under the board: the board sits over
    darkness, and when the floor gives way that is where it falls. */
function forest(day) {
  const W = day.W * T, H = day.H * T, out = [];
  const floor = new Model(), hw = W / 2 + 3, hh = H / 2 + 3, big = W * 3;
  const slab = (x0, z0, x1, z1, col, y = -5, t = 2) => floor.box((x0 + x1) / 2, y - t / 2, (z0 + z1) / 2, x1 - x0, t, z1 - z0, col);
  slab(-big, -H * 3, big, -hh, '#141d16');   // behind the board
  slab(-big, hh, big, H * 2, '#141d16');     // in front
  slab(-big, -hh, -hw, hh, '#141d16');       // left
  slab(hw, -hh, big, hh, '#141d16');         // right
  // The pit's walls, going down into the dark.
  floor.box(0, -25, -hh - 0.5, hw * 2, 40, 1, '#0e140f');
  floor.box(-hw - 0.5, -25, 0, 1, 40, hh * 2, '#0b100c');
  floor.box(hw + 0.5, -25, 0, 1, 40, hh * 2, '#0b100c');
  out.push({ m: floor, id: 1 });
  const rand = rng(`forest:${day.date || day.seed || 0}`);
  let id = 10;
  // A ring of pines all round the clearing; from above, their tops.
  for (let i = 0; i < 18; i++) {
    const side = i % 4, t = (Math.floor(i / 4) + rand()) / 5, out2 = 14 + rand() * 12;
    const [x, z] = side === 0 ? [-W * 0.7 + t * W * 1.4, -hh - out2] : side === 1 ? [-W * 0.7 + t * W * 1.4, hh + out2]
      : side === 2 ? [-hw - out2, -H * 0.6 + t * H * 1.2] : [hw + out2, -H * 0.6 + t * H * 1.2];
    out.push({ m: pine(22 + rand() * 18, rand), at: [x, -5, z], id: id++ });
  }
  // Stones and a ring of pale toadstools: something to notice.
  for (let i = 0; i < 5; i++) {
    const st = new Model(), side = i % 2 ? 1 : -1;
    st.ellipsoid(0, 0.6, 0, 2 + rand() * 1.5, 1.4, 1.8, '#3b4440', { seg: 6, rings: 4 });
    // Beside or behind the pit, never over it.
    const at = i < 3 ? [(rand() - 0.5) * W, -4.8, -hh - 5 - rand() * 4] : [side * (hw + 5 + rand() * 4), -4.8, (rand() - 0.5) * H];
    out.push({ m: st, at, id: id++ });
  }
  return out;
}

const pitModel = (() => {
  const m = new Model();
  m.lathe([[4.2, 0.0], [4.2, 0.03]], '#5a4426', { seg: 14 });
  m.lathe([[3.5, 0.03], [3.5, 0.08]], '#0a0705', { seg: 14 });
  return m;
})();

const lidModel = (() => {
  const m = new Model();
  m.lathe([[3.4, 0], [3.2, 0.5]], '#8a6a3c', { seg: 12 });
  m.box(0, 0.6, 0, 6.2, 0.35, 0.6, '#6b4f2a');
  m.box(0, 0.6, 0, 0.6, 0.35, 6.2, '#6b4f2a');
  return m;
})();

const ringModel = (col) => new Model().lathe([[4.2, 0.1], [4.2, 0.2]], col, { seg: 12, caps: true });
const rings = new Map();
const ring = (col) => rings.get(col) || (rings.set(col, ringModel(col)), rings.get(col));

// --- The board. -------------------------------------------------------------

export class Board3D extends Board {
  constructor(canvas, day) {
    super(canvas, day);
    const W = day.W, H = day.H;
    this.cosS = Math.cos(STAND); this.sinS = Math.sin(STAND);
    // A board about 210 pixels across whatever its size, drawn that small
    // and smoothed up by the browser.
    this.scale = 210 / (Math.max(W, H) * T);
    const s = this.scale;
    const half = (W * T) / 2 + 16;              // the board, and a little forest either side
    const top = 16 * BIG * this.cosS + 14;      // above it: the back row's pieces stand up into this
    const bottom = 14;
    canvas.width = Math.ceil(half * 2 * s);
    canvas.height = Math.ceil((top + H * T + bottom) * s);
    this.cx = canvas.width / 2;
    this.cy = (top + (H * T) / 2) * s;
    this.t3 = makeTarget(canvas.width, canvas.height);
    this.layer = document.createElement('canvas');
    this.layer.width = canvas.width; this.layer.height = canvas.height;
    this.lctx = this.layer.getContext('2d');
    this.g = canvas.getContext('2d');
    canvas.classList.remove('pix');
    canvas.style.imageRendering = 'auto';
    // The forest never changes, so its triangles are placed once.
    this.forest = new Mesh();
    for (const t of forest(day)) t.at ? this.forest.add(t.m, ...t.at, t.id) : this.forest.add(t.m, 0, 0, 0, t.id);
    this.shown = null;      // the state on screen, for taps
    this.lit = [];          // and where the selected piece can go
    this.possessing = null; // the opening's possession, while it plays
    this.fallen = false;    // after the floor has given way
    this.fallAt = 0;        // when it will have
  }

  // --- Where things go. ----------------------------------------------------

  /** Screen position of a point on the board: (px, py) in squares from its
      bottom-left corner, h in model units above the surface (as the pieces'
      angle shows height). */
  pt(px, py, h = 0) {
    const X = (px - this.day.W / 2) * T, Z = (this.day.H / 2 - py) * T;
    return [this.cx + X * this.scale, this.cy + (Z - h * this.cosS) * this.scale];
  }

  /** The middle of square (x, y); fractional while something is moving. */
  mid(x, y, h = 0) { return this.pt(x + 0.5, y + 0.5, h); }

  /** Where to tap to touch square (x, y): a visible pixel of whatever stands
      on it (the one nearest its middle), or the middle of the square. */
  screenOf(x, y) {
    const s = this.shown, w = this.el.width, ids = this.t3.id;
    const i = s ? s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y) : -1;
    const k = s ? s.foes.findIndex((f) => !f.taken && f.x === x && f.y === y) : -1;
    const id = i >= 0 ? 100 + i : k >= 0 ? 200 + k : -1;
    if (id >= 0) {
      const [cx, cy] = this.mid(x, y, 5);
      let best = null, bd = Infinity;
      for (let q = 0; q < ids.length; q++) {
        if (ids[q] !== id) continue;
        const px = q % w, py = (q / w) | 0, d = (px - cx) ** 2 + (py - cy) ** 2;
        if (d < bd) { bd = d; best = [px + 0.5, py + 0.5]; }
      }
      if (best) return this.toClient(...best);
    }
    return this.toClient(...this.mid(x, y));
  }

  /** Scene coordinates of the middle of square (x, y), for the board. */
  spot(x, y) { return [(x + 0.5 - this.day.W / 2) * T, (this.day.H / 2 - y - 0.5) * T]; }

  /** The same for a piece standing there. The pieces are drawn from their
      own angle, so their depth is stretched to make each base land exactly
      where the board, seen from above, has that square. */
  stood(x, y) { const [X, Z] = this.spot(x, y); return [X, Z / this.sinS]; }

  cellAt(e) {
    const r = this.el.getBoundingClientRect(), w = this.el.width, h = this.el.height;
    const ix = Math.floor((e.clientX - r.left) * w / r.width), iy = Math.floor((e.clientY - r.top) * h / r.height);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return null;
    // The square under the tap: the board is seen straight on.
    const px = (ix + 0.5 - this.cx) / this.scale / T + this.day.W / 2;
    const py = this.day.H / 2 - (iy + 0.5 - this.cy) / this.scale / T;
    const x = Math.floor(px), y = Math.floor(py), floor = onBoard(this.day, x, y) ? { x, y } : null;
    // What is standing there, if anything was drawn at that pixel. A tall
    // piece reaches up over the square behind it, so if a piece is selected
    // and the floor under the tap is one of its lit squares, the tap means
    // that square, not the piece in front of it.
    const id = this.t3.id[iy * w + ix], s = this.shown;
    const p = s && id >= 100 && id < 200 ? s.pieces[id - 100] : s && id >= 200 && id < 300 ? s.foes[id - 200] : null;
    const at = p && !p.taken ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
    const lit = (q) => q && this.lit.some((m) => m.x === q.x && m.y === q.y);
    if (lit(at)) return at;        // tapped something you can take
    if (lit(floor)) return floor;  // tapped a square you can go to, even behind something
    return at || floor;
  }

  // --- A frame. ------------------------------------------------------------

  draw(v) {
    const s = v.state, at = performance.now(), w = this.el.width, h = this.el.height, g = this.g;
    this.shown = s;
    this.lit = v.legal || [];
    const board = { pitch: Math.PI / 2, yaw: 0, scale: this.scale, cx: this.cx, cy: this.cy }; // straight down
    const pieces = { ...board, pitch: STAND };
    const fallen = this.fallen || (this.fallAt && at >= this.fallAt);
    // 1. The forest and the squares.
    const m1 = new Mesh();
    m1.tris = this.forest.tris.slice();
    if (!fallen) this.squares(m1, s, v, at);
    render(this.t3, m1, { ...board, outline: '#0a0f0b' });
    this.lctx.putImageData(this.t3.img, 0, 0);
    g.fillStyle = FOG;
    g.fillRect(0, 0, w, h);
    g.drawImage(this.layer, 0, 0);
    if (!fallen) {
      // 2. Marks on the surface (not once the floor starts to go).
      if (!this.tw?.collapse) this.marks(g, v, s);
      // 3. Everything standing up.
      const m2 = new Mesh();
      this.things(m2, s, at);
      render(this.t3, m2, { ...pieces, outline: '#1d150e' });
      this.lctx.putImageData(this.t3.img, 0, 0);
      g.drawImage(this.layer, 0, 0);
      // 4. Puffs and leaves.
      this.effects(g, at);
    }
    this.air(g);
  }

  /** The board's squares, the hole, and the lit squares. */
  squares(m, s, v, at) {
    const day = this.day, W = day.W, H = day.H, tw = this.tw;
    const off = new Set(s.shrunk || []), gone = new Set(s.gone || []);
    const vanish = tw?.vanish, fall = tw?.crumble, collapse = tw?.collapse;
    const here = (x, y) => onBoard(day, x, y) && (!off.has(y * W + x) || (vanish?.sq === y * W + x && at < vanish.t0 + vanish.dur));
    const solid = (x, y) => here(x, y) && !gone.has(y * W + x);
    const lit = new Map();
    for (const mv of v.legal || []) lit.set(mv.y * W + mv.x, mv.cap || mv.sink ? 'catch' : 'move');
    if (v.sel != null && s.pieces[v.sel]) lit.set(s.pieces[v.sel].y * W + s.pieces[v.sel].x, 'sel');
    // On shrinking ground, the square that falls next is shaded.
    let shade = -1;
    if (v.track && day.rules.shrink && !tw && (s.t + 1) % (day.rules.shrinkEvery || 2) === 0) shade = nextShrink(s) ?? -1;
    const slab = !day.holes.size && !off.size && !collapse;
    if (slab) m.addBox((-W * T) / 2 - 3, -4, (-H * T) / 2 - 3, (W * T) / 2 + 3, -1, (H * T) / 2 + 3, RIM, 2, 1 << 3);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!here(x, y)) continue;
        const sq = y * W + x, [X, Z] = this.spot(x, y);
        let drop = 0, dark = 0, size = 1;
        if (vanish?.sq === sq && at >= vanish.t0) {
          const k = Math.min(1, (at - vanish.t0) / vanish.dur);
          drop = k * k * 12; dark = k * 0.85; size = 1 - k * 0.5;
        }
        if (collapse) {
          const k = Math.max(0, Math.min(1, (at - collapse.t0 - collapse.delay(x, y)) / 900));
          drop = k * k * 180; dark = Math.min(0.95, k * 1.2);
        }
        const crumbling = fall?.sq === sq && at < fall.t0 + fall.dur;
        if (crumbling && at >= fall.t0) { const k = (at - fall.t0) / fall.dur; drop = Math.max(drop, k * k * 12); dark = Math.max(dark, k * 0.85); }
        // Seen from above, falling away reads as shrinking into the dark.
        const away = 1 / (1 + drop / 22), r = (T / 2) * size * away, rim = 3 * away;
        if (!slab) m.addBox(X - r - rim, -4 - drop, Z - r - rim, X + r + rim, -1 - drop, Z + r + rim, dim(RIM, dark), 2, 1 << 3);
        if (gone.has(sq) && !crumbling) { m.addBox(X - r, -1.04, Z - r, X + r, -0.98, Z + r, PIT, 2); continue; }
        let col = tileColour(day, x, y);
        const L = lit.get(sq);
        if (L === 'move') col = mix(col, '#f2c14e', 0.55);
        else if (L === 'catch') col = mix(col, '#e2603e', 0.6);
        else if (L === 'sel') col = mix(col, '#e9b02a', 0.75);
        if (sq === shade) col = dim(col, 0.4);
        // Hide the sides between neighbouring squares; only the outer ones show.
        const flat = !drop;
        const skip = (1 << 3) | (flat && solid(x + 1, y) ? 1 : 0) | (flat && solid(x - 1, y) ? 2 : 0) |
          (flat && solid(x, y - 1) ? 16 : 0) | (flat && solid(x, y + 1) ? 32 : 0);
        m.addBox(X - r, -1 - drop, Z - r, X + r, 0 - drop, Z + r, dim(col, dark), 2, skip);
      }
    // The hole: a dark pit, under its twig cover until it opens.
    if (s.hole && !collapse) {
      let hx = s.hole.x, hy = s.hole.y;
      if (tw?.hole) ({ x: hx, y: hy } = tweenPos(tw.hole, at));
      const [X, Z] = this.spot(hx, hy);
      m.add(pitModel, X, 0, Z, 3);
      let lid = holeOpen(s) ? 0 : 1;
      if (tw?.open && at < tw.open.t0 + tw.open.dur) lid = 1 - Math.max(0, (at - tw.open.t0) / tw.open.dur);
      if (lid > 0.02) m.addXf(lidModel, { t: [X, 0.05, Z], s: lid, ry: (1 - lid) * 2 }, 4);
    }
  }

  /** Flat marks on the board's surface, straight onto the picture. */
  marks(g, v, s) {
    const day = this.day, W = day.W;
    const line = (pts, col, width = 1.5, dash = null) => {
      g.save(); g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
      if (dash) g.setLineDash(dash);
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore();
    };
    const quad = (x, y, inset = 0) => [this.pt(x + inset, y + inset), this.pt(x + 1 - inset, y + inset), this.pt(x + 1 - inset, y + 1 - inset), this.pt(x + inset, y + 1 - inset)];
    // In-square points, given the flat board's 28-pixel coordinates.
    const inSq = (x, y, a, b) => this.pt(x + a / 28, y + 1 - b / 28);
    const gone = new Set(s.gone || []), off = new Set(s.shrunk || []);

    // Crumbling ground: hairline cracks on every square, the same each time.
    if (day.rules.crumble)
      for (let y = 0; y < day.H; y++)
        for (let x = 0; x < W; x++) {
          if (!onBoard(day, x, y) || gone.has(y * W + x) || off.has(y * W + x)) continue;
          const k = (x * 7 + y * 13) % 4, c = 'rgba(92,64,34,.4)';
          const C = [[[[4, 9], [9, 12], [12, 11]], [[18, 20], [22, 23]]], [[[17, 4], [15, 9], [19, 12]], [[5, 21], [9, 19]]],
            [[[6, 6], [10, 5]], [[14, 17], [18, 15], [23, 18]]], [[[20, 7], [23, 11]], [[7, 15], [6, 19], [10, 22]]]][k];
          for (const seg of C) line(seg.map(([a, b]) => inSq(x, y, a, b)), c, 1);
        }
    // Cracks on the square a selected piece will leave, on crumbling ground.
    if (day.rules.crumble && v.sel != null && s.pieces[v.sel]) {
      const p = s.pieces[v.sel], c = '#5a3a1e';
      for (const seg of [[[2, 2], [6, 5], [7, 9]], [[25, 2], [21, 6], [22, 10]], [[2, 25], [5, 21], [9, 22]], [[25, 25], [22, 21], [18, 22]]])
        line(seg.map(([a, b]) => inSq(p.x, p.y, a, b)), c, 1.5);
    }
    // The square that falls next, on shrinking ground: a dashed edge.
    if (v.track && day.rules.shrink && !this.tw && (s.t + 1) % (day.rules.shrinkEvery || 2) === 0) {
      const sq = nextShrink(s);
      if (sq !== null) { const q = quad(sq % W, Math.floor(sq / W), 0.04); line([...q, q[0]], 'rgba(5,3,2,.6)', 1.2, [3, 3]); }
    }
    // The bramble's next square (the first two daily boards only).
    const bc = brambleCount(day, s.t);
    if (v.track && bc < day.bramble.length) {
      const sq = day.bramble[bc];
      for (const [a, b] of [[8, 9], [17, 7], [11, 18], [21, 19], [8, 22]]) { const [px, py] = inSq(sq % W, Math.floor(sq / W), a, b); g.fillStyle = 'rgba(63,107,44,.6)'; g.fillRect(px - 1.5, py - 0.5, 3, 1); g.fillRect(px - 0.5, py - 1.5, 1, 3); }
    }
    if (v.track) this.tracks(g, v.track, line, inSq);
    if (v.paths) this.paths(g, v.paths, line, quad);
  }

  /** Numbered tracks for everything that moves by a pattern, and the hole. */
  tracks(g, track, line, inSq) {
    const last = track[track.length - 1], W = this.day.W;
    // Numbers sit in the far left corner of a square, clear of whatever
    // stands on it (a piece's base covers the middle, its body rises from it).
    const number = (n, x, y, col) => {
      const [px, py] = inSq(x, y, 4.5, 5.5);
      g.font = `800 ${Math.round(this.scale * 3.6)}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(247,240,218,.9)'; g.strokeText(String(n), px, py);
      g.fillStyle = col; g.fillText(String(n), px, py);
    };
    let n = 0;
    last.foes.forEach((f, k) => {
      if (f.brain !== 'pattern' && f.brain !== 'possessed') return;
      const col = (f.brain === 'possessed' && this.fur(f)) || TRACK[n % TRACK.length];
      n++;
      const P = [];
      for (const st of track) { const q = st.foes[k]; if (q.taken) break; P.push([q.x, q.y]); }
      for (let i = 1; i < P.length; i++) {
        if (P[i][0] === P[i - 1][0] && P[i][1] === P[i - 1][1]) continue;
        line([this.mid(...P[i - 1]), this.mid(...P[i])], rgba(col, 0.55), 1.3, [2, 3]);
      }
      const labels = new Map();
      P.forEach(([x, y], i) => {
        if (i < P.length - 1) { const [px, py] = inSq(x, y, 23.5, 5.5); g.fillStyle = rgba(col, 0.45); g.fillRect(px - 1.5, py - 1, 3, 2); }
        labels.set(y * W + x, i);
      });
      for (const [sq, i] of labels) number(i, sq % W, Math.floor(sq / W), col);
    });
    if (last.hole?.pattern) {
      const col = '#1d6b6b', P = track.map((st) => [st.hole.x, st.hole.y]);
      for (let i = 1; i < P.length; i++) {
        if (P[i][0] === P[i - 1][0] && P[i][1] === P[i - 1][1]) continue;
        line([this.mid(...P[i - 1]), this.mid(...P[i])], rgba(col, 0.55), 1.3, [2, 3]);
      }
    }
  }

  /** The lines of finished games, one colour per player. */
  paths(g, paths, line, quad) {
    paths.forEach(({ play, color, upto }, idx) => {
      const off = ((idx % 3) - 1) * 0.06, n = Math.min(upto ?? play.moves.length, play.moves.length);
      for (let i = 0; i < n; i++) {
        const mv = play.moves[i];
        if (mv.p < 0) continue;
        const a = play.states[i].pieces[mv.p], b = play.states[i + 1].pieces[mv.p];
        const A = this.mid(a.x + off, a.y + off), B = this.mid(b.x + off, b.y + off);
        line([A, B], color, 2.2);
        g.fillStyle = color; g.fillRect(B[0] - 2, B[1] - 2, 4, 4);
        if (play.states[i + 1].won) { const q = quad(b.x, b.y, 0.08); line([...q, q[0]], color, 2); }
      }
    });
  }

  /** Everything standing up: stumps and bramble, the flag, your pieces, theirs,
      and anything tumbling or possessing. */
  things(m, s, at) {
    const day = this.day, tw = this.tw;
    const stand = (mdl, x, y, h, id, o = {}) => {
      const [X, Z] = this.stood(x, y);
      m.addXf(mdl, { t: [X, h, Z], ...o, ry: (o.ry || 0) + TURN, s: (o.s ?? 1) * BIG }, id);
    };
    for (const sq of day.stumps) stand(model('stump'), sq % day.W, Math.floor(sq / day.W), 0, 400);
    for (let i = 0; i < brambleCount(day, s.t); i++) stand(model('bramble'), day.bramble[i] % day.W, Math.floor(day.bramble[i] / day.W), 0, 401 + i);
    const collapse = tw?.collapse;
    if (s.hole && !collapse) {
      let hx = s.hole.x, hy = s.hole.y;
      if (tw?.hole) ({ x: hx, y: hy } = tweenPos(tw.hole, at));
      stand(model('flag'), hx + 0.3, hy + 0.15, 0, 300);
    }
    // Yours.
    if (!this.hidePieces) s.pieces.forEach((p, i) => {
      if (p.taken && !(tw?.eaten?.has(i) && at < tw.landAt)) return;
      let x = p.x, y = p.y, h = 0, o = {};
      if (s.sunk && p.type === 'ball') {
        // The ball rolls to the hole, then drops into it: from above, it
        // shrinks away into the dark.
        if (collapse) { x = s.hole.x; y = s.hole.y; o = { s: away(at - collapse.t0 - 150) }; }
        else if (!tw?.sinkAt || at >= tw.sinkAt + 420) return;
        else if (at > tw.sinkAt) o = { s: 1 - ((at - tw.sinkAt) / 420) ** 2 };
      }
      if (tw?.piece?.i === i) ({ x, y } = tweenPos(tw.piece, at));
      if (this.landing) { const l = this.landing(i, at); if (l === null) return; h += l * LIFT; }
      if (collapse && !(s.sunk && p.type === 'ball')) {
        // Falling, from above: tipping over and shrinking away.
        const k = at - collapse.t0 - 260 - i * 110;
        if (k > 0) o = { rz: (i % 2 ? 1 : -1) * Math.min(1.2, k / 700), rx: Math.min(0.8, k / 900), s: away(k) };
      }
      stand(model(p.type, 'you'), x, y, h, 100 + i, o);
    });
    // Theirs.
    s.foes.forEach((f, k) => {
      if (f.taken && !(tw?.caught?.has(k) && at < tw.caughtAt)) return;
      let x = f.x, y = f.y, h = 0;
      const t = tw?.foes?.[k];
      if (t) { const q = tweenPos(t, at); x = q.x; y = q.y; h = t.hop ? Math.sin(Math.PI * q.k) * (t.blocked ? 1.2 : 3.5) : 0; }
      const mdl = f.brain === 'possessed' ? model(f.type, 'foe', null, this.glowOf(f, k, at)) : model(f.type, 'foe', this.fur(f));
      stand(mdl, x, y, h, 200 + k, collapse ? { s: away(at - collapse.t0 - collapse.delay(f.x, f.y)) } : {});
      if (day.rules.goal === 'target' && day.foes.length > 1 && f.target) stand(ring('#e3bd57'), x, y, 0, 200 + k);
    });
    // A winning catch: what was caught pops up and tumbles away. A possessed
    // piece lets its rabbit go: the rabbit is what tumbles out.
    for (const tb of tw?.tumbles || []) {
      const e = at - tb.t0;
      if (e < 0 || e > tb.dur) continue;
      let h = 3, rot = 0, sc = 1;
      if (e > tb.hold) {
        const k = (e - tb.hold) / (tb.dur - tb.hold);
        h = 3 + Math.sin(Math.PI * Math.min(1, k * 1.4)) * 9;
        rot = k * Math.PI * 2.5;
        sc = k > 0.45 ? 1 - (k - 0.45) / 0.55 : 1;
      }
      const mdl = tb.possessed ? model('rabbit', 'foe', tb.fur) : model(tb.kind, 'foe', tb.fur);
      stand(mdl, tb.x, tb.y, h, 600, { rz: rot, ry: rot * 0.6, s: Math.max(0.02, sc) });
    }
    // The opening's possession: a rabbit of each piece's colour hops in out of
    // the fog and dives into it.
    for (const ps of this.possessing || []) {
      const k = (at - ps.t0) / ps.dur;
      if (k < 0 || k >= 1) continue;
      let x, y, h, sc = 1;
      if (k < 0.7) {
        const q = k / 0.7, from = [ps.x + ps.dx, this.day.H + 0.6];
        x = from[0] + (ps.x - from[0]) * q; y = from[1] + (ps.y - from[1]) * q;
        h = Math.abs(Math.sin(q * Math.PI * 3)) * 6;
      } else {
        const q = (k - 0.7) / 0.3;
        x = ps.x; y = ps.y; h = 9 * Math.sin(Math.PI * q) + 2; sc = 1 - q * 0.9;
      }
      stand(model('rabbit', 'foe', ps.fur), x, y, h, 700, { s: sc, ry: Math.PI });
    }
  }

  /** The colour a possessed piece's plinth shows: its rabbit's, or pale if
      you do not know that rabbit yet; none at all until the opening's
      rabbit has dived in. */
  glowOf(f, k, at) {
    const ps = this.possessing?.find((p) => p.k === k);
    if (ps && at < ps.t0 + ps.dur * 0.82) return null;
    return this.fur(f) || PALE;
  }

  /** Puffs, leaves, and the flash of a winning catch, flat on top. */
  effects(g, at) {
    const tw = this.tw, u = (this.scale * T) / 28; // the flat board's pixels, here
    for (const pf of tw?.poofs || []) {
      if (at < pf.t0) continue;
      const k = (at - pf.t0) / pf.dur;
      if (k >= 1) continue;
      const [cx, cy] = this.mid(pf.x, pf.y, pf.low ? 0 : 4);
      for (let a = 0; a < 8; a++) {
        const r = (4 + k * 14) * u, ang = (a * Math.PI) / 4;
        g.fillStyle = a % 2 ? pf.c1 : pf.c2;
        g.fillRect(cx + Math.cos(ang) * r - u, cy + Math.sin(ang) * r * (pf.low ? 0.6 : 1) - u, 2 * u, 2 * u);
      }
    }
    for (const tb of tw?.tumbles || []) {
      const e = at - tb.t0;
      if (e < 0 || e > tb.hold + 200) continue;
      const q = [this.pt(tb.x, tb.y), this.pt(tb.x + 1, tb.y), this.pt(tb.x + 1, tb.y + 1), this.pt(tb.x, tb.y + 1)];
      g.fillStyle = `rgba(255,255,255,${0.65 * (1 - e / (tb.hold + 200))})`;
      g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill();
    }
    for (const lb of tw?.leaves || []) {
      const k = (at - lb.t0) / lb.dur, e = (at - lb.t0) / 1000;
      if (k < 0 || k >= 1) continue;
      const [cx, cy] = this.mid(lb.x, lb.y, 3);
      g.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      for (const b of lb.bits) { g.fillStyle = b.col; g.fillRect(cx + b.vx * e * u, cy + (b.vy * e + 110 * e * e) * u, b.w * u, 2 * u); }
      g.globalAlpha = 1;
    }
    // A ring of the rabbit's colour as it dives into a piece.
    for (const ps of this.possessing || []) {
      const k = (at - ps.t0) / ps.dur;
      if (k < 0.78 || k > 1) continue;
      const q = (k - 0.78) / 0.22, [cx, cy] = this.mid(ps.x, ps.y, 1);
      g.strokeStyle = rgba(ps.fur, 1 - q); g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(cx, cy, (6 + q * 22) * u, (6 + q * 22) * u, 0, 0, Math.PI * 2); g.stroke();
    }
  }

  /** Fog toward the back, and darkness all round: the pool of light. */
  air(g) {
    const w = this.el.width, h = this.el.height, top = this.pt(0, this.day.H)[1];
    const f = g.createLinearGradient(0, 0, 0, top + 6);
    f.addColorStop(0, 'rgba(27,38,32,.92)'); f.addColorStop(1, 'rgba(27,38,32,0)');
    g.fillStyle = f; g.fillRect(0, 0, w, top + 6);
    const r = g.createRadialGradient(w / 2, h * 0.58, Math.min(w, h) * 0.32, w / 2, h * 0.58, Math.max(w, h) * 0.78);
    r.addColorStop(0, 'rgba(5,9,7,0)'); r.addColorStop(1, 'rgba(5,9,7,.78)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }

  // --- Moments of their own. -------------------------------------------------

  /** The opening's possession: a rabbit of each possessed piece's colour hops
      in from the fog at the back and dives into its piece, which lights up
      in that colour. `stop()` ends it early. */
  async possess(stop = () => false) {
    const s = this.shown, t0 = performance.now(), list = [];
    s?.foes.forEach((f, k) => {
      if (f.brain !== 'possessed' || f.taken) return;
      list.push({ k, x: f.x, y: f.y, dx: (list.length % 2 ? 1 : -1) * 0.6, fur: this.fur(f) || PALE, t0: t0 + list.length * 380, dur: 1000 });
    });
    if (!list.length) return;
    this.possessing = list;
    const start = performance.now();
    list.forEach((ps) => sfx.possess((ps.t0 - start) / 1000 + 0.7));
    const end = list[list.length - 1].t0 + list[list.length - 1].dur;
    const tick = () => (stop() ? Promise.resolve() : new Promise((r) => setTimeout(r, 100)));
    this.runUntil(end);
    while (performance.now() < end && !stop()) await tick();
    this.possessing = null;
    this.redraw();
  }

  /** The floor gives way: the squares drop into the dark in a ripple out
      from the hole, and your pieces and the ball fall with them. Resolves
      when they are gone. */
  async collapse() {
    const s = this.shown, hx = s?.hole?.x ?? this.day.W / 2, hy = s?.hole?.y ?? this.day.H / 2;
    const t0 = performance.now(), rand = rng(`collapse:${t0}`), jitter = new Map();
    const delay = (x, y) => {
      const sq = y * this.day.W + x;
      if (!jitter.has(sq)) jitter.set(sq, rand() * 140);
      return Math.hypot(x - hx, y - hy) * 90 + jitter.get(sq);
    };
    this.tw = { poofs: [], foes: {}, tumbles: [], leaves: [], collapse: { t0, delay } };
    this.fallAt = t0 + 2050;
    sfx.collapse();
    await this.runUntil(t0 + 2100);
    this.fallen = true;
    this.redraw();
  }
}

/** How big something still looks, ms into a fall away from you (seen from
    above, falling is shrinking): 1 at the start, nearly 0 a second in. */
const away = (ms) => (ms <= 0 ? 1 : Math.max(0.02, 1 / (1 + ((ms / 1000) ** 2) * 24)));

/** The board for a page: 3D, unless the address says ?flat. */
export function makeBoard(canvas, day) {
  return new URLSearchParams(location.search).has('flat') ? new Board(canvas, day) : new Board3D(canvas, day);
}

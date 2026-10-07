// The fall between depths of the descent (Timothy, 2026-10-07): "a screen
// that shows an animation of the pieces falling vertically, then landing on
// a new table."
//
// Seen from the side and a little above: your pieces fall through the dark
// in a row, turning slowly, while motes stream up past them and a faint
// spiral turns behind (the motif from docs/grove-look.md). When the next
// board is ready, it rises out of the dark beneath them, and each piece
// comes down on the square it starts the next level on.
//
// The camera never moves. The renderer is orthographic, so falling is the
// world streaming up, and landing is the table rising into the frame.

import { Mesh, makeTarget, render } from '../../engine/lowpoly.js';
import { model } from './models.js';
import { scene } from './board.js';

const T = 10;           // a square, in world units (board.js scene)
const PITCH = 0.42;     // the camera looks down a little
const SCALE = 2.6;

/** Every triangle of `mesh` moved down by dy, into `out`. */
function shifted(out, mesh, dy) {
  for (const t of mesh.tris) out.tris.push({ ...t, p: t.p.map((q) => [q[0], q[1] - dy, q[2]]) });
  return out;
}

/**
 * Start the fall on `canvas` with `kinds` (your pieces, the ball first).
 * Returns { add(kind), land(level, state), stop() }: add drops another
 * piece in from above (the one you picked on the way down); land brings the
 * next table up and resolves once everything has landed.
 */
export function startFall(canvas, kinds) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, target = makeTarget(w, h);
  const cx = w / 2, cy = h * 0.45;
  const t0 = performance.now();
  const motes = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97.3) % w, y: (i * 53.1) % h, v: 60 + ((i * 37) % 90), l: 4 + (i % 5) * 3 }));
  const fallers = kinds.map((kind, i) => ({ kind, t0, i }));
  let landing = null, stopped = false, frame = 0;

  // Where faller i hangs while falling: a row across the middle.
  const rowX = (i, n) => (i - (n - 1) / 2) * 11;

  function draw(now) {
    if (stopped) return;
    const e = (now - t0) / 1000;
    // The dark, and a spiral turning slowly behind everything.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05080a'); g.addColorStop(1, '#0d1612');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-e * 0.35);
    ctx.strokeStyle = 'rgba(169, 217, 139, .10)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 9; a += 0.08) { const r = 3 + a * 7; a ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); }
    ctx.stroke();
    ctx.restore();
    // Motes streaming upward: the world going past as you fall. They slow
    // as the table comes up.
    const pace = landing ? Math.max(0, 1 - (now - landing.t0) / landing.dur) : 1;
    ctx.fillStyle = 'rgba(233, 244, 220, .5)';
    for (const m of motes) {
      m.y -= (m.v * pace * 16) / 1000 * 3;
      if (m.y < -m.l) { m.y = h + m.l; m.x = (m.x + 131) % w; }
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, Math.round(m.l * (0.3 + pace)));
    }

    const mesh = new Mesh(), n = fallers.length;
    let tableTop = 0;
    if (landing) {
      const k = Math.min(1, (now - landing.t0) / landing.dur);
      tableTop = -landing.D * (1 - (1 - (1 - k) ** 3)); // eases up from below
      shifted(mesh, landing.table, -tableTop);
    }
    fallers.forEach((f, i) => {
      const age = (now - f.t0) / 1000;
      // Falling: a slow turn, a gentle bob, and a late arrival drops in from above.
      let x = rowX(i, n), y = Math.sin(age * 2.1 + i) * 1.6 + Math.max(0, 1 - age * 1.6) * 90, z = 0;
      let ry = age * 1.3 + i, rz = Math.sin(age * 1.7 + i * 2) * 0.25, s = 1;
      if (landing) {
        const L = landing.spots[i], k = Math.min(1, (now - landing.t0) / landing.dur);
        const m = k * k * (3 - 2 * k);
        if (L) { x = x + (L.X - x) * m; z = L.Z * m; }
        ry = ry * (1 - m) + landing.turn * m; rz *= 1 - m;
        // Height above the table: falls the last of the way as it arrives,
        // then one small bounce.
        const settle = (now - landing.t0 - landing.dur) / 260;
        const above = k < 1 ? landing.D * (1 - k) ** 2 : settle < 1 ? Math.sin(Math.PI * settle) * 3 * (1 - settle) : 0;
        y = tableTop + above;
        if (!L) s = Math.max(0.01, 1 - k); // nothing to land on (should not happen)
      }
      mesh.addXf(model(f.kind, 'you'), { t: [x, y, z], ry, rz, s }, 100 + i);
    });
    render(target, mesh, { yaw: 0, pitch: PITCH, scale: SCALE, cx, cy, outline: '#05080a' });
    // The picture goes over the backdrop, keeping the backdrop where it is empty.
    const layer = canvas._layer || (canvas._layer = Object.assign(document.createElement('canvas'), { width: w, height: h }));
    layer.getContext('2d').putImageData(target.img, 0, 0);
    ctx.drawImage(layer, 0, 0);
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);

  return {
    add(kind) { fallers.push({ kind, t0: performance.now(), i: fallers.length }); },
    /** The next table comes up and the pieces land on their squares. */
    land(level, state) {
      // The table without your pieces on it: they are the ones landing.
      const bare = { ...state, pieces: [] };
      const table = scene(level, bare);
      const W = level.W, H = level.H;
      const used = new Set();
      const spots = fallers.map((f) => {
        const p = state.pieces.find((q, j) => !used.has(j) && q.type === f.kind && used.add(j));
        return p ? { X: (p.x - W / 2) * T + T / 2, Z: (H / 2 - 1 - p.y) * T + T / 2 } : null;
      });
      const dur = 1300;
      landing = { t0: performance.now(), dur, table, spots, D: 120, turn: 0 };
      return new Promise((resolve) => setTimeout(resolve, dur + 520));
    },
    stop() { stopped = true; cancelAnimationFrame(frame); }
  };
}

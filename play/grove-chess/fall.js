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
  // Each is a kind, or { kind, side, weapon } for a piece with a look (and
  // a weapon) of its own.
  const fallers = kinds.map((k, i) => ({ kind: k.kind || k, side: k.side || 'you', weapon: k.weapon || null, t0, i }));
  // Moments on the way down (2026-10-16): a piece taking on a suit spins and
  // swells in a burst of the suit's colour, and comes out of it wearing the
  // suit; a weapon drops in from above, spinning, into a piece's hand.
  const moments = [];
  const screenOf = (X, Y) => [cx + X * SCALE, cy - Y * Math.cos(PITCH) * SCALE];
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
      // The picture has no perspective, so the table lower down is the same
      // picture lower down: it is drawn once (land, below) and slid up.
      ctx.drawImage(landing.tableLayer, 0, Math.round(-tableTop * Math.cos(PITCH) * SCALE));
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
      // A suit taking hold: a fast spin and a swell, the new look from halfway.
      const tr = f.morph && now - f.morph.t0 < f.morph.dur ? (now - f.morph.t0) / f.morph.dur : -1;
      if (tr >= 0) { ry += tr * tr * Math.PI * 4; s *= 1 + Math.sin(Math.PI * tr) * 0.3; }
      const side = tr >= 0 && tr < 0.5 ? f.morph.was : f.side || 'you';
      mesh.addXf(model(f.kind, side), { t: [x, y, z], ry, rz, s }, 100 + i);
      f.at = [x, y + 6];
      // Its weapon, on its right, turning with it; a new one drops in.
      if (f.weapon) {
        const eq = f.arming && now - f.arming.t0 < f.arming.dur ? (now - f.arming.t0) / f.arming.dur : 1;
        const fallIn = (1 - eq) ** 2 * 70, spin = (1 - eq) * Math.PI * 6;
        mesh.addXf(model({ sword: 'wSword', lance: 'wLance', mace: 'wMace', net: 'wNet', shield: 'wShield' }[f.weapon] || 'wSword', 'you'),
          { t: [x + Math.cos(ry) * 3, y + 1 + fallIn, z - Math.sin(ry) * 3], ry: ry + spin, rz: rz - 0.18, s }, 200 + i);
      }
    });
    render(target, mesh, { yaw: 0, pitch: PITCH, scale: SCALE, cx, cy, outline: '#05080a' });
    // The picture goes over the backdrop, keeping the backdrop where it is empty.
    // A fresh layer each frame (WebKit bug 256151; see board3d.js).
    const layer = canvas._layer || (canvas._layer = document.createElement('canvas'));
    layer.width = w; layer.height = h;
    layer.getContext('2d').putImageData(target.img, 0, 0);
    ctx.drawImage(layer, 0, 0);
    // The bursts, over the picture.
    for (const m of moments) {
      const k = (now - m.t0) / m.dur, f = fallers[m.i];
      if (k < 0 || k >= 1 || !f.at) continue;
      const [sx, sy] = screenOf(...f.at);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (m.kind === 'suit' && k < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k / 0.25)})`; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = m.col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, 4 + k * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = m.col;
      for (let a = 0; a < 14; a++) {
        const ang = a * Math.PI / 7 + m.i, r = 6 + k * (m.kind === 'suit' ? 40 : 20) * (a % 2 ? 0.75 : 1);
        ctx.fillRect(Math.round(sx + Math.cos(ang) * r) - 1, Math.round(sy + Math.sin(ang) * r) - 1, 3, 3);
      }
      ctx.restore();
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);

  return {
    add(kind) { fallers.push({ kind, t0: performance.now(), i: fallers.length }); },
    /** Piece i takes on a look (a suit), in a burst of `col`. */
    restyle(i, side, col = '#f2c14e') {
      const f = fallers[i];
      if (!f) return;
      const t = performance.now();
      f.morph = { t0: t, dur: 900, was: f.side || 'you' };
      f.side = side;
      moments.push({ i, kind: 'suit', col, t0: t + 380, dur: 760 });
    },
    /** Piece i takes up a weapon: it drops in, spinning, and clicks into place. */
    arm(i, weapon, col = '#f2c14e') {
      const f = fallers[i];
      if (!f) return;
      const t = performance.now();
      f.weapon = weapon;
      f.arming = { t0: t, dur: 650 };
      moments.push({ i, kind: 'weapon', col, t0: t + 600, dur: 520 });
    },
    /** The next table comes up and the pieces land on their squares. */
    land(level, state) {
      // The table without your pieces on it: they are the ones landing.
      const bare = { ...state, pieces: [] };
      const table = scene(level, bare);
      render(target, table, { yaw: 0, pitch: PITCH, scale: SCALE, cx, cy, outline: '#05080a' });
      const tableLayer = Object.assign(document.createElement('canvas'), { width: w, height: h });
      tableLayer.getContext('2d').putImageData(target.img, 0, 0);
      const W = level.W, H = level.H;
      const used = new Set();
      const spots = fallers.map((f) => {
        const p = state.pieces.find((q, j) => !used.has(j) && q.type === f.kind && used.add(j));
        return p ? { X: (p.x - W / 2) * T + T / 2, Z: (H / 2 - 1 - p.y) * T + T / 2 } : null;
      });
      const dur = 1300;
      landing = { t0: performance.now(), dur, tableLayer, spots, D: 120, turn: 0 };
      return new Promise((resolve) => setTimeout(resolve, dur + 520));
    },
    stop() { stopped = true; cancelAnimationFrame(frame); }
  };
}

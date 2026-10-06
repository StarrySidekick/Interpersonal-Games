// The low-poly renderer.
//
// A small software rasterizer for simple polygon models, so the pieces can be
// little 3D objects without a 3D library or a build step. It draws into a
// low-resolution image that the page scales up with
// `image-rendering: pixelated`. Few polygons, smooth shading and not many
// pixels is most of what made Nintendo 64 games look the way they did.
//
// How a frame is drawn:
// 1. A model is a list of triangles, built from a few shapes: boxes, spheres
//    and "lathes" (a side profile spun around the vertical axis, the way a
//    chess piece is turned on a real lathe).
// 2. Every corner is rotated (yaw, then a downward tilt) and projected
//    straight onto the screen. Orthographic, no perspective.
// 3. Triangles facing away are skipped. The rest are filled pixel by pixel,
//    keeping a depth per pixel (a z-buffer) so nearer surfaces win.
// 4. Shading is worked out at each corner and blended across the triangle
//    (Gouraud shading, the N64's standard), so round things look round even
//    with only eight sides.
// 5. A last pass draws a dark one-pixel edge wherever one object sits in front
//    of another, which keeps small pieces readable.

// --- A little matrix maths: 3x3 rotation plus a translation. ---------------

const I = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

function mul(a, b) {
  const m = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return m;
}
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/** Rotate z first, then x, then y, then move to t. Angles in radians. */
function xf({ t = [0, 0, 0], rx = 0, ry = 0, rz = 0 } = {}) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return { m: mul(Y, mul(X, Z)), t };
}
function compose(a, b) {
  const bt = app(a.m, b.t);
  return { m: mul(a.m, b.m), t: [bt[0] + a.t[0], bt[1] + a.t[1], bt[2] + a.t[2]] };
}
function norm(v) { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

// --- Building models. ------------------------------------------------------

/** A model: triangles in its own space, base centred on (0, 0, 0), +z toward
    you, y up. Shapes take an optional { rx, ry, rz } rotation. */
export class Model {
  constructor() { this.tris = []; this.stack = [I]; }

  /** Build inside a moved and rotated frame. */
  group(o, fn) {
    this.stack.push(compose(this.stack[this.stack.length - 1], xf(o)));
    fn(this);
    this.stack.pop();
    return this;
  }

  /** One triangle. `vn` is three corner normals for smooth shading; without
      it the triangle is shaded flat. */
  tri(a, b, c, col, vn = null) {
    const T = this.stack[this.stack.length - 1];
    const P = [a, b, c].map((p) => { const q = app(T.m, p); return [q[0] + T.t[0], q[1] + T.t[1], q[2] + T.t[2]]; });
    const N = vn ? vn.map((n) => norm(app(T.m, n))) : null;
    const raw = cross(sub(P[1], P[0]), sub(P[2], P[0]));
    if (Math.hypot(...raw) < 1e-9) return this; // a sliver with no area
    let fn = norm(raw);
    // Point the face normal outward: agree with the corner normals if there
    // are any, otherwise trust the winding the caller gave.
    if (N) {
      const avg = [N[0][0] + N[1][0] + N[2][0], N[0][1] + N[1][1] + N[2][1], N[0][2] + N[1][2] + N[2][2]];
      if (fn[0] * avg[0] + fn[1] * avg[1] + fn[2] * avg[2] < 0) fn = fn.map((x) => -x);
    }
    this.tris.push({ p: P, n: fn, vn: N, c: rgb(col) });
    return this;
  }

  box(cx, cy, cz, sx, sy, sz, col, rot = {}) {
    return this.group({ t: [cx, cy, cz], ...rot }, () => {
      const x = sx / 2, y = sy / 2, z = sz / 2;
      const f = (a, b, c, d, n) => {
        // Wind so the cross product points along n.
        const fnm = cross(sub(b, a), sub(c, a));
        if (fnm[0] * n[0] + fnm[1] * n[1] + fnm[2] * n[2] < 0) { this.tri(a, c, b, col); this.tri(a, d, c, col); }
        else { this.tri(a, b, c, col); this.tri(a, c, d, col); }
      };
      f([x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z], [1, 0, 0]);
      f([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]);
      f([-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], [0, 1, 0]);
      f([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
      f([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]);
      f([-x, -y, -z], [-x, y, -z], [x, y, -z], [x, -y, -z], [0, 0, -1]);
    });
  }

  /** Spin a side profile, [[radius, height], ...] from the bottom up, around
      the vertical axis. `col` is one colour, or one per band. Shading is
      smooth around the axis and crisp between bands, so rims stay sharp. */
  lathe(profile, col, { seg = 8, at = [0, 0, 0], rot = {}, caps = true, offset = 0.5 } = {}) {
    return this.group({ t: at, ...rot }, () => {
      const bandCol = (i) => (Array.isArray(col) ? col[Math.min(i, col.length - 1)] : col);
      const ring = (r, y) => Array.from({ length: seg }, (_, k) => {
        const a = ((k + offset) / seg) * Math.PI * 2;
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      });
      for (let i = 0; i < profile.length - 1; i++) {
        const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
        const A = ring(r0, y0), B = ring(r1, y1);
        // The band's outward slope, as (radial, up).
        const pn = norm([y1 - y0, r0 - r1, 0]);
        const nrm = (k) => {
          const a = ((k + offset) / seg) * Math.PI * 2;
          return [Math.cos(a) * pn[0], pn[1], Math.sin(a) * pn[0]];
        };
        for (let k = 0; k < seg; k++) {
          const k2 = (k + 1) % seg, c = bandCol(i);
          if (r0 > 0) this.tri(A[k], A[k2], B[k2], c, [nrm(k), nrm(k2), nrm(k2)]);
          if (r1 > 0) this.tri(A[k], B[k2], B[k], c, [nrm(k), nrm(k2), nrm(k)]);
        }
      }
      if (caps) {
        const [rb, yb] = profile[0], [rt, yt] = profile[profile.length - 1];
        const cap = (r, y, up, c) => {
          const R = ring(r, y), mid = [0, y, 0], n = [0, up, 0];
          for (let k = 0; k < seg; k++) this.tri(mid, R[k], R[(k + 1) % seg], c, [n, n, n]);
        };
        if (rb > 0) cap(rb, yb, -1, bandCol(0));
        if (rt > 0) cap(rt, yt, 1, bandCol(profile.length - 2));
      }
    });
  }

  ellipsoid(cx, cy, cz, rx, ry, rz, col, { seg = 8, rings = 6, rot = {} } = {}) {
    return this.group({ t: [cx, cy, cz], ...rot }, () => {
      const pt = (i, k) => {
        const v = (i / rings) * Math.PI, u = (k / seg) * Math.PI * 2;
        return [Math.sin(v) * Math.cos(u), -Math.cos(v), Math.sin(v) * Math.sin(u)];
      };
      const P = (s) => [s[0] * rx, s[1] * ry, s[2] * rz];
      const N = (s) => norm([s[0] / rx, s[1] / ry, s[2] / rz]);
      for (let i = 0; i < rings; i++)
        for (let k = 0; k < seg; k++) {
          const a = pt(i, k), b = pt(i, k + 1), c = pt(i + 1, k + 1), d = pt(i + 1, k);
          if (i > 0) this.tri(P(a), P(b), P(c), col, [N(a), N(b), N(c)]);
          if (i < rings - 1) this.tri(P(a), P(c), P(d), col, [N(a), N(c), N(d)]);
        }
    });
  }

  ball(cx, cy, cz, r, col, o) { return this.ellipsoid(cx, cy, cz, r, r, r, col, o); }

  cone(cx, cy, cz, r, h, col, { seg = 6, rot = {} } = {}) {
    return this.lathe([[r, 0], [0, h]], col, { seg, at: [cx, cy, cz], rot });
  }
}

// --- A scene, and drawing it. ----------------------------------------------

export class Mesh {
  constructor() { this.tris = []; }

  /** Place a model with its base centre at (ox, oy, oz). */
  add(model, ox = 0, oy = 0, oz = 0, id = 0) {
    for (const t of model.tris)
      this.tris.push({ p: t.p.map((q) => [q[0] + ox, q[1] + oy, q[2] + oz]), n: t.n, vn: t.vn, c: t.c, id });
    return this;
  }

  /** Place a model turned and scaled: { t: [x, y, z], rx, ry, rz, s }.
      Turns happen around the model's own base centre, then it is moved. */
  addXf(model, { t = [0, 0, 0], rx = 0, ry = 0, rz = 0, s = 1 } = {}, id = 0) {
    const T = xf({ rx, ry, rz });
    for (const tr of model.tris) {
      const p = tr.p.map((q) => { const r = app(T.m, q); return [r[0] * s + t[0], r[1] * s + t[1], r[2] * s + t[2]]; });
      this.tris.push({ p, n: app(T.m, tr.n), vn: tr.vn ? tr.vn.map((n) => app(T.m, n)) : null, c: tr.c, id });
    }
    return this;
  }

  /** An axis-aligned box in scene space. `skip` is a bit per face (+x, -x,
      +y, -y, +z, -z) to leave out, for faces nobody can see. */
  addBox(x0, y0, z0, x1, y1, z1, col, id = 0, skip = 0) {
    const m = new Model();
    m.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col);
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    m.tris = m.tris.filter((t) => !dirs.some((d, i) => (skip & (1 << i)) && t.n[0] === d[0] && t.n[1] === d[1] && t.n[2] === d[2]));
    return this.add(m, 0, 0, 0, id);
  }
}

export function makeTarget(w, h) {
  return { w, h, img: new ImageData(w, h), z: new Float32Array(w * h), id: new Int16Array(w * h) };
}

// Light from the upper left and a little in front, fixed to the screen, so it
// stays put while a model turns under it.
const L = norm([-0.45, 0.85, 0.5]);

/**
 * Draw `mesh` into target `t`. Options: yaw and pitch (the camera), scale
 * and the screen centre, and the outline colour (or null for none).
 * `keep: true` draws over what is already there: the colour image starts
 * empty again (so the new layer can be laid on top of anything drawn in
 * between) but the depths stay, so the new things still hide behind, or in
 * front of, the old. With `outlineFrom`, only edges against objects whose id
 * is at least that number are outlined. With `bg`, the image starts filled
 * with that colour instead of empty, so it can go straight onto a canvas.
 */
export function render(t, mesh, o = {}) {
  const { yaw = 0, pitch = 0.5, scale = 2, cx = t.w / 2, cy = t.h / 2, outline = '#2a2118', keep = false, outlineFrom = -1, bg = null } = o;
  const W = t.w, H = t.h, data = t.img.data, zb = t.z, ids = t.id;
  if (bg) {
    // One pixel's four bytes read as a single 32-bit number, so the whole
    // image fills in one call; reading them through the same kind of view
    // keeps the bytes in the right order on any machine.
    const c = rgb(bg), px = new Uint32Array(new Uint8Array([c[0], c[1], c[2], 255]).buffer)[0];
    new Uint32Array(data.buffer, data.byteOffset, data.length / 4).fill(px);
  } else data.fill(0);
  if (!keep) { zb.fill(-1e9); ids.fill(-1); }
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const view = (v) => {
    const x1 = v[0] * cyw + v[2] * syw, z1 = -v[0] * syw + v[2] * cyw;
    return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp];
  };
  const shade = (n) => {
    const v = view(n);
    return 0.6 + 0.5 * Math.max(0, v[0] * L[0] + v[1] * L[1] + v[2] * L[2]);
  };
  const sx = [0, 0, 0], sy = [0, 0, 0], sz = [0, 0, 0], sb = [0, 0, 0];

  for (const f of mesh.tris) {
    if (view(f.n)[2] <= 1e-3) continue; // facing away
    for (let k = 0; k < 3; k++) {
      const q = view(f.p[k]);
      sx[k] = cx + q[0] * scale; sy[k] = cy - q[1] * scale; sz[k] = q[2];
      sb[k] = shade(f.vn ? f.vn[k] : f.n);
    }
    const ax = sx[0], ay = sy[0], bx = sx[1], by = sy[1], qx = sx[2], qy = sy[2];
    const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
    const [cr, cg, cb] = f.c;
    for (let py = y0; py <= y1; py++) {
      const yy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const xx = px + 0.5;
        // Barycentric weights: how much of each corner this pixel is.
        const w0 = ((bx - xx) * (qy - yy) - (by - yy) * (qx - xx)) / area;
        const w1 = ((qx - xx) * (ay - yy) - (qy - yy) * (ax - xx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2];
        const i = py * W + px;
        if (z <= zb[i]) continue;
        zb[i] = z; ids[i] = f.id;
        // A few steps of brightness rather than a smooth ramp: the colour
        // depth of an old console, roughly.
        const b = Math.round((w0 * sb[0] + w1 * sb[1] + w2 * sb[2]) * 14) / 14;
        const j = i * 4;
        data[j] = Math.min(255, cr * b); data[j + 1] = Math.min(255, cg * b); data[j + 2] = Math.min(255, cb * b); data[j + 3] = 255;
      }
    }
  }

  if (outline) {
    // A pixel is outlined when a neighbour belongs to a different object and
    // is nearer the viewer. Empty background counts as farthest of all.
    const oc = rgb(outline), mark = [];
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const i = py * W + px, me = ids[i], z = zb[i];
        const near = (j) => ids[j] !== me && ids[j] !== -1 && ids[j] >= outlineFrom && zb[j] > z + 0.5;
        if ((px > 0 && near(i - 1)) || (px < W - 1 && near(i + 1)) || (py > 0 && near(i - W)) || (py < H - 1 && near(i + W))) mark.push(i);
      }
    for (const i of mark) { const j = i * 4; data[j] = oc[0]; data[j + 1] = oc[1]; data[j + 2] = oc[2]; data[j + 3] = 255; }
  }
  return t;
}

/** Render one model once to a small canvas, for a sprite. */
export function snapshot(model, { w = 30, h = 36, cx = 15, cy = 31, yaw = -0.45, pitch = 0.35, scale = 2 } = {}) {
  const t = makeTarget(w, h);
  render(t, new Mesh().add(model, 0, 0, 0, 1), { yaw, pitch, scale, cx, cy });
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(t.img, 0, 0);
  return c;
}

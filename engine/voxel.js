// The voxel renderer.
//
// A small software rasterizer, so the pieces can be chunky little 3D models
// without pulling in a 3D library or adding a build step. It draws into a
// low-resolution ImageData, which the page then scales up with
// `image-rendering: pixelated`. The pixel look is not a filter on top: the
// models really are drawn at that resolution.
//
// How it works, in four steps:
// 1. A model is a 3D grid of coloured cubes (a Vox). Only the cube faces that
//    touch empty space are kept, since the rest can never be seen.
// 2. Each frame, every face's corners are rotated (yaw, then a downward tilt)
//    and projected straight onto the screen. No perspective: orthographic, the
//    way pixel-art games draw 3D.
// 3. Faces pointing away from the viewer are skipped. The rest are split into
//    two triangles and filled pixel by pixel, keeping a depth value per pixel
//    (a z-buffer) so nearer faces win regardless of drawing order.
// 4. A last pass draws a one-pixel dark outline wherever one object sits in
//    front of another, which is what makes it read as pixel art.

/** A 3D grid of colours. x is right, y is up, z is toward the viewer. */
export class Vox {
  constructor(w = 8, h = 14, d = 8) {
    this.w = w; this.h = h; this.d = d;
    this.c = new Array(w * h * d).fill(null);
  }
  in(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }
  set(x, y, z, col) {
    if (this.in(x, y, z)) this.c[(y * this.d + z) * this.w + x] = col;
    return this;
  }
  get(x, y, z) {
    return this.in(x, y, z) ? this.c[(y * this.d + z) * this.w + x] : null;
  }
  box(x0, y0, z0, x1, y1, z1, col) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, col);
    return this;
  }
  /** A filled circle in one horizontal layer. Radii worth knowing on an
      8-wide grid: 0.8 is 2 across, 1.6 a rounded 4, 2.2 a square 4,
      2.6 a rounded 6, 3.0 a fuller 6, 3.6 a rounded 8. */
  disc(y, r, col, cx = (this.w - 1) / 2, cz = (this.d - 1) / 2) {
    for (let z = 0; z < this.d; z++)
      for (let x = 0; x < this.w; x++)
        if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) this.set(x, y, z, col);
    return this;
  }
  /** Stacked discs, one radius per layer, the way a chess piece is turned on
      a lathe. `col` may be one colour or one per layer. */
  lathe(y0, radii, col) {
    radii.forEach((r, i) => this.disc(y0 + i, r, Array.isArray(col) ? col[i] : col));
    return this;
  }
  ball(cx, cy, cz, r, col) {
    for (let y = 0; y < this.h; y++)
      for (let z = 0; z < this.d; z++)
        for (let x = 0; x < this.w; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) this.set(x, y, z, col);
    return this;
  }
  each(fn) {
    for (let y = 0; y < this.h; y++)
      for (let z = 0; z < this.d; z++)
        for (let x = 0; x < this.w; x++) {
          const col = this.get(x, y, z);
          if (col) fn(x, y, z, col);
        }
  }
}

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

// The six faces of a box, each as its outward normal and four corners in
// order around the edge. The corners are picks from [x0|x1, y0|y1, z0|z1].
const FACES = [
  { n: [1, 0, 0], k: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], k: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], k: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], k: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], k: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], k: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];

/** Everything to be drawn in one frame, as a flat list of faces. */
export class Mesh {
  constructor() { this.faces = []; }

  addBox(x0, y0, z0, x1, y1, z1, col, id = 0, skip = 0) {
    const lo = [x0, y0, z0], hi = [x1, y1, z1], c = rgb(col);
    FACES.forEach((f, i) => {
      if (skip & (1 << i)) return;
      const v = [];
      for (const k of f.k) v.push(k[0] ? hi[0] : lo[0], k[1] ? hi[1] : lo[1], k[2] ? hi[2] : lo[2]);
      this.faces.push({ v, n: f.n, c, id });
    });
    return this;
  }

  /** Place a model with the centre of its base at (ox, oy, oz). */
  addVox(vox, ox = 0, oy = 0, oz = 0, id = 0) {
    const bx = ox - vox.w / 2, bz = oz - vox.d / 2;
    vox.each((x, y, z, col) => {
      // Skip faces that touch another cube: they can never be seen.
      let skip = 0;
      FACES.forEach((f, i) => {
        if (vox.get(x + f.n[0], y + f.n[1], z + f.n[2])) skip |= 1 << i;
      });
      if (skip === 63) return;
      this.addBox(bx + x, oy + y, bz + z, bx + x + 1, oy + y + 1, bz + z + 1, col, id, skip);
    });
    return this;
  }
}

/** A drawing surface: pixels, plus a depth and an object id per pixel. */
export function makeTarget(w, h) {
  return {
    w, h,
    img: new ImageData(w, h),
    z: new Float32Array(w * h),
    id: new Int16Array(w * h)
  };
}

// Light comes from the upper left and slightly in front, in screen space, so
// it stays put while a model turns under it.
const L = (() => {
  const v = [-0.45, 0.85, 0.5], m = Math.hypot(...v);
  return v.map((x) => x / m);
})();

export function render(t, mesh, o = {}) {
  const {
    yaw = 0, pitch = 0.5, scale = 2,
    cx = t.w / 2, cy = t.h / 2, outline = '#2a2118'
  } = o;
  const W = t.w, H = t.h, data = t.img.data, zb = t.z, ids = t.id;
  data.fill(0); zb.fill(-1e9); ids.fill(-1);

  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const sx = [0, 0, 0, 0], sy = [0, 0, 0, 0], sz = [0, 0, 0, 0];

  for (const f of mesh.faces) {
    const [nx, ny, nz] = f.n;
    const nx1 = nx * cyw + nz * syw, nz1 = -nx * syw + nz * cyw;
    const ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
    if (nz2 <= 1e-3) continue; // facing away

    // Shade in a few flat steps rather than smoothly: pixel art has bands.
    let b = 0.64 + 0.46 * Math.max(0, nx1 * L[0] + ny2 * L[1] + nz2 * L[2]);
    b = Math.round(b * 8) / 8;
    const r = Math.min(255, f.c[0] * b), g = Math.min(255, f.c[1] * b), bl = Math.min(255, f.c[2] * b);

    const v = f.v;
    for (let k = 0; k < 4; k++) {
      const x = v[k * 3], y = v[k * 3 + 1], z = v[k * 3 + 2];
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      sx[k] = cx + x1 * scale;
      sy[k] = cy - (y * cp - z1 * sp) * scale;
      sz[k] = y * sp + z1 * cp;
    }
    tri(0, 1, 2); tri(0, 2, 3);

    function tri(a, bI, c) {
      const ax = sx[a], ay = sy[a], bx = sx[bI], by = sy[bI], qx = sx[c], qy = sy[c];
      const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      if (Math.abs(area) < 1e-9) return;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
      const za = sz[a], zbv = sz[bI], zc = sz[c];
      for (let py = y0; py <= y1; py++) {
        const yy = py + 0.5;
        for (let px = x0; px <= x1; px++) {
          const xx = px + 0.5;
          // Barycentric weights: how much of each corner this pixel is.
          const w0 = ((bx - xx) * (qy - yy) - (by - yy) * (qx - xx)) / area;
          const w1 = ((qx - xx) * (ay - yy) - (qy - yy) * (ax - xx)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const z = w0 * za + w1 * zbv + w2 * zc;
          const i = py * W + px;
          if (z <= zb[i]) continue;
          zb[i] = z; ids[i] = f.id;
          const j = i * 4;
          data[j] = r; data[j + 1] = g; data[j + 2] = bl; data[j + 3] = 255;
        }
      }
    }
  }

  if (outline) {
    // A pixel gets outlined when a neighbour belongs to a different object
    // and is nearer the viewer. Background counts as the farthest object, so
    // every silhouette gets an edge too.
    const oc = rgb(outline), mark = [];
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const i = py * W + px, me = ids[i], z = zb[i];
        const near = (j) => ids[j] !== me && ids[j] !== -1 && zb[j] > z + 0.5;
        if ((px > 0 && near(i - 1)) || (px < W - 1 && near(i + 1)) ||
            (py > 0 && near(i - W)) || (py < H - 1 && near(i + W))) mark.push(i);
      }
    for (const i of mark) {
      const j = i * 4;
      data[j] = oc[0]; data[j + 1] = oc[1]; data[j + 2] = oc[2]; data[j + 3] = 255;
    }
  }
  return t;
}

/** Render one model, once, to a small canvas. For sprites. */
export function snapshot(vox, { w = 30, h = 36, cx = 15, cy = 31, yaw = -0.45, pitch = 0.35, scale = 2 } = {}) {
  const t = makeTarget(w, h);
  render(t, new Mesh().addVox(vox, 0, 0, 0, 1), { yaw, pitch, scale, cx, cy });
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(t.img, 0, 0);
  return c;
}

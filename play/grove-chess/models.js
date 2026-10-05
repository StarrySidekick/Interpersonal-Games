// The little voxel models. Every piece is built on an 8 x 8 footprint, facing
// +z (toward you), standing on y = 0. See engine/voxel.js for what a Vox is.

import { Vox } from '../../engine/voxel.js';

const P = {
  wood: '#7a5133', woodLight: '#9a6a43', woodDark: '#553722',
  moss: '#6f9f46', leaf: '#8cc155', gold: '#e3bd57', cream: '#f4ecd6',
  eye: '#231a16', pink: '#f0a3b2'
};

/** Every one of your pieces stands on the same mossy plinth, so a strange
    animal still reads as one of yours. */
function plinth(v, ring = P.moss) {
  v.disc(0, 3.6, P.woodDark);
  v.disc(1, 3.0, ring);
  return v;
}

// --- The classic six. Turned shapes, walnut with a moss collar. -----------

function pawn() {
  const v = plinth(new Vox(8, 11, 8));
  v.lathe(2, [2.2, 1.6, 1.6, 2.6], [P.wood, P.wood, P.wood, P.moss]);
  v.ball(3.5, 7.6, 3.5, 2.3, P.wood);
  return v;
}

function rook() {
  const v = plinth(new Vox(8, 11, 8));
  v.lathe(2, [2.6, 2.2, 2.2, 2.2, 2.2, 2.6, 3.0], P.wood);
  v.disc(4, 2.2, P.moss);
  v.disc(8, 1.6, P.woodDark); // the hollow top
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, z - 3.5);
      const sector = Math.floor((Math.atan2(z - 3.5, x - 3.5) + Math.PI) / (Math.PI / 4));
      if (d <= 3.0 && d > 1.6 && sector % 2 === 0) v.set(x, 9, z, P.wood);
    }
  return v;
}

function horse(body, mane, { eye = P.eye, muzzle = P.woodDark } = {}) {
  const v = plinth(new Vox(8, 13, 8));
  v.box(2, 2, 2, 5, 6, 5, body);       // chest and neck
  v.box(2, 6, 3, 5, 9, 7, body);       // head, snout forward
  for (let x = 2; x <= 5; x++) { v.set(x, 9, 7, null); v.set(x, 6, 7, null); }
  v.box(2, 7, 7, 5, 7, 7, muzzle);
  v.box(3, 3, 1, 4, 9, 1, mane);       // mane down the back
  v.box(3, 10, 3, 4, 10, 4, mane);
  v.set(2, 10, 4, body); v.set(5, 10, 4, body); // ears
  v.set(2, 8, 5, eye); v.set(5, 8, 5, eye);
  return v;
}

function bishopShape(body, accent, extra) {
  const v = plinth(new Vox(8, 13, 8));
  v.lathe(2, [2.2, 1.6, 1.6, 1.6, 2.2, 2.6], [P.wood, body, body, body, body, accent]);
  v.lathe(8, [2.2, 2.6, 2.2, 1.6], body);
  v.each((x, y, z) => { if (y >= 9 && y <= 10 && x - z === 0) v.set(x, y, z, accent); });
  v.disc(12, 0.8, P.woodLight);
  if (extra) extra(v);
  return v;
}

function queenShape(top) {
  const v = plinth(new Vox(8, 14, 8));
  v.lathe(2, [2.2, 1.6, 1.6, 1.6, 1.6, 2.2, 2.6], [P.wood, P.wood, P.wood, P.wood, P.wood, P.wood, P.moss]);
  v.disc(9, 2.6, P.wood);
  top(v);
  return v;
}

const MODELS = {
  pawn,
  rook,
  knight: () => horse(P.wood, P.moss),
  bishop: () => bishopShape(P.wood, P.moss),
  queen: () => queenShape((v) => {
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        const d = Math.hypot(x - 3.5, z - 3.5);
        const sector = Math.floor((Math.atan2(z - 3.5, x - 3.5) + Math.PI) / (Math.PI / 4));
        if (d <= 2.6 && d > 1.6 && sector % 2 === 0) v.set(x, 10, z, P.leaf);
      }
    v.disc(10, 0.8, P.gold); v.disc(11, 0.8, P.gold);
  }),
  king: () => queenShape((v) => {
    v.disc(10, 1.6, P.wood);
    v.box(3, 11, 3, 4, 13, 4, P.gold);
    v.box(2, 12, 3, 5, 12, 4, P.gold);
  }),

  // --- The fairy pieces. Most are named for animals, so they get to be one.

  grasshopper() {
    const v = plinth(new Vox(8, 10, 8)), g = '#5fae3e', dk = '#3f7d2a', lt = '#9bd36a';
    v.box(3, 2, 1, 4, 3, 5, g);           // body
    v.box(3, 4, 2, 4, 4, 5, dk);          // folded wings
    v.box(2, 2, 6, 5, 4, 7, lt);          // head
    v.set(2, 4, 7, P.eye); v.set(5, 4, 7, P.eye);
    for (const x of [1, 6]) {             // the big hind legs
      v.set(x, 2, 5, dk); v.set(x, 3, 4, dk); v.set(x, 4, 3, dk); v.set(x, 5, 3, dk);
      v.set(x, 4, 2, dk); v.set(x, 3, 1, dk); v.set(x, 2, 1, dk);
    }
    v.set(2, 5, 7, dk); v.set(2, 6, 6, dk); v.set(2, 7, 6, dk);  // antennae
    v.set(5, 5, 7, dk); v.set(5, 6, 6, dk); v.set(5, 7, 6, dk);
    return v;
  },

  nightrider() {
    const v = horse('#3d4a7a', '#232c4f', { muzzle: '#2a3358', eye: P.gold });
    v.set(3, 11, 4, P.gold); v.set(3, 12, 4, P.gold); v.set(4, 12, 4, P.gold); // a crescent
    v.set(2, 12, 4, P.gold); v.set(2, 11, 4, null);
    return v;
  },

  camel() {
    const v = plinth(new Vox(8, 12, 8)), c = '#c9a26b', dk = '#9c7a4c';
    for (const [x, z] of [[2, 1], [5, 1], [2, 4], [5, 4]]) v.box(x, 2, z, x, 3, z, dk);
    v.box(2, 4, 1, 5, 6, 5, c);           // body
    v.box(3, 7, 1, 4, 7, 2, c); v.box(3, 8, 1, 4, 8, 1, c);  // humps
    v.box(3, 7, 4, 4, 7, 4, c); v.box(3, 8, 4, 4, 8, 4, c);
    v.box(3, 5, 6, 4, 8, 6, c);           // neck
    v.box(3, 8, 6, 4, 9, 7, c);           // head
    v.set(3, 9, 7, P.eye);
    return v;
  },

  zebra() {
    const v = horse('#f1efe6', '#1f1f1f', { muzzle: '#2b2b2b' });
    v.each((x, y, z, col) => { if (col === '#f1efe6' && y % 2 === 0 && y >= 2) v.set(x, y, z, '#1f1f1f'); });
    return v;
  },

  alfil() { // al-fil, "the elephant"
    const v = plinth(new Vox(8, 11, 8)), g = '#9aa3ad', dk = '#7c858f';
    for (const [x, z] of [[1, 1], [5, 1], [1, 4], [5, 4]]) v.box(x, 2, z, x + 1, 3, z + 1, dk);
    v.box(1, 4, 1, 6, 7, 5, g);           // body
    v.box(2, 5, 6, 5, 8, 7, g);           // head
    v.box(0, 5, 5, 0, 8, 6, '#c7a5a8');   // ears
    v.box(7, 5, 5, 7, 8, 6, '#c7a5a8');
    v.box(3, 2, 7, 4, 5, 7, dk);          // trunk
    v.set(2, 5, 7, P.cream); v.set(5, 5, 7, P.cream); // tusks
    v.set(2, 7, 7, P.eye); v.set(5, 7, 7, P.eye);
    return v;
  },

  ferz() { // drawn as an acorn
    const v = plinth(new Vox(8, 11, 8));
    v.lathe(2, [1.6, 2.2, 2.6, 2.6, 2.2], '#c98b45');
    v.lathe(7, [3.0, 2.6, 1.6], '#6b4a2c');
    v.each((x, y, z, col) => { if (col === '#6b4a2c' && (x + y + z) % 2 === 0) v.set(x, y, z, '#5a3d24'); });
    v.disc(10, 0.8, '#5a3d24');
    return v;
  },

  wazir() { // drawn as a toadstool
    const v = plinth(new Vox(8, 10, 8));
    v.lathe(2, [1.6, 1.6, 1.6, 1.6], P.cream);
    v.lathe(6, [3.6, 3.0, 2.2], '#d2473b');
    for (const [x, y, z] of [[2, 7, 1], [5, 7, 6], [1, 6, 4], [6, 6, 2], [3, 8, 4], [4, 7, 6], [6, 6, 5]])
      if (v.get(x, y, z)) v.set(x, y, z, P.cream);
    return v;
  },

  cannon() {
    const v = plinth(new Vox(8, 9, 8)), iron = '#4b4f57';
    v.box(2, 2, 1, 5, 3, 6, P.wood);      // carriage
    for (const x of [1, 6])               // wheels
      for (let z = 0; z < 8; z++)
        for (let y = 2; y < 7; y++)
          if ((z - 3.5) ** 2 + (y - 4) ** 2 <= 2.4 * 2.4) v.set(x, y, z, P.woodDark);
    for (let z = 1; z < 8; z++)           // barrel
      for (let y = 3; y < 8; y++)
        for (let x = 2; x < 6; x++)
          if ((x - 3.5) ** 2 + (y - 5.2) ** 2 <= 2.0 * 2.0) v.set(x, y, z, z === 7 ? '#6b707a' : iron);
    v.set(3, 5, 7, '#1b1c20'); v.set(4, 5, 7, '#1b1c20');
    return v;
  },

  mao() { // the horse of xiangqi, in red lacquer on a cream disc
    const v = horse('#b5372f', P.gold, { muzzle: '#7d211b', eye: P.cream });
    v.disc(0, 3.6, P.cream); v.disc(1, 3.0, '#b5372f');
    return v;
  },

  squirrel() {
    const v = plinth(new Vox(8, 12, 8)), o = '#c56a2c', lt = '#e08f4f';
    v.box(2, 2, 3, 5, 5, 5, o);           // body
    v.box(3, 2, 6, 4, 4, 6, P.cream);     // belly
    v.box(2, 5, 5, 5, 7, 7, o);           // head
    v.set(2, 8, 6, o); v.set(5, 8, 6, o); // ears
    v.set(2, 6, 7, P.eye); v.set(5, 6, 7, P.eye);
    v.box(2, 2, 1, 5, 4, 2, lt);          // the tail, curling up and over
    v.box(2, 4, 0, 5, 9, 1, lt);
    v.box(2, 9, 1, 5, 10, 2, lt);
    v.box(3, 10, 3, 4, 10, 3, lt);
    return v;
  },

  rose() {
    const v = plinth(new Vox(8, 13, 8)), red = '#c8324a', deep = '#962238';
    v.box(3, 2, 3, 4, 7, 4, '#4f8a35');   // stem
    v.box(1, 4, 3, 2, 4, 4, P.leaf); v.box(5, 5, 3, 6, 5, 4, P.leaf);
    v.ball(3.5, 9.5, 3.5, 2.6, red);
    v.each((x, y, z, col) => { if (col === red && (x * 3 + y + z * 2) % 4 === 0) v.set(x, y, z, deep); });
    return v;
  },

  archbishop: () => bishopShape('#6a4a8c', P.gold, (v) => {
    v.set(2, 11, 4, '#6a4a8c'); v.set(5, 11, 4, '#6a4a8c'); // horse ears
  })
};

// --- Not yours. ------------------------------------------------------------

MODELS.rabbit = () => {
  const v = new Vox(8, 12, 8), w = '#f6f2ea', sh = '#ddd4c4';
  v.ball(3.5, 2.6, 3.0, 2.7, w);          // body
  v.ball(3.5, 5.6, 5.0, 2.1, w);          // head
  v.box(2, 7, 4, 2, 11, 4, w); v.box(5, 7, 4, 5, 11, 4, w);       // ears
  v.box(2, 8, 5, 2, 10, 5, P.pink); v.box(5, 8, 5, 5, 10, 5, P.pink);
  v.ball(3.5, 2.5, 0.2, 1.1, '#ffffff');  // tail
  v.set(2, 6, 6, P.eye); v.set(5, 6, 6, P.eye);
  v.set(3, 5, 7, P.pink); v.set(4, 5, 7, P.pink);
  v.box(2, 0, 5, 2, 0, 6, sh); v.box(5, 0, 5, 5, 0, 6, sh);       // front paws
  return v;
};

MODELS.bramble = () => {
  const v = new Vox(8, 7, 8);
  // A fixed hash rather than the day's random numbers, so every bramble on
  // every day is the same bramble.
  const h = (x, y, z) => {
    let n = x * 374761393 + y * 668265263 + z * 2147483647;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) % 100;
  };
  for (let y = 0; y < 7; y++)
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        const r = h(x, y, z), edge = Math.hypot(x - 3.5, z - 3.5);
        if (edge > 3.8 - y * 0.3) continue;
        if (r < 46 - y * 6) v.set(x, y, z, r < 6 ? '#3a1d3f' : r < 12 ? '#6d4a2a' : r % 3 ? '#3f6b2c' : '#557f36');
      }
  return v;
};

MODELS.stump = () => {
  const v = new Vox(8, 6, 8);
  v.lathe(0, [3.6, 3.0, 3.0, 3.0], '#6a4a30');
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, z - 3.5);
      if (d <= 3.0) v.set(x, 3, z, Math.round(d) % 2 ? '#d8b98a' : '#bf9b68');
    }
  v.set(6, 4, 5, '#d2473b'); v.set(6, 5, 5, '#d2473b'); // a toadstool friend
  return v;
};

const cache = new Map();
/** One shared Vox per kind. Treat it as read-only. */
export function model(kind) {
  if (!cache.has(kind)) cache.set(kind, MODELS[kind]());
  return cache.get(kind);
}

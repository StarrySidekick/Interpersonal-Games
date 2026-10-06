// The models: simple polygon shapes, N64 style. Every piece fits in a circle
// of radius about 3.7, stands on y = 0 and faces +z (toward you). See
// engine/lowpoly.js for the shapes and how they are drawn.

import { Model } from '../../engine/lowpoly.js';

const P = {
  wood: '#86593a', woodLight: '#a8774d', woodDark: '#563823',
  moss: '#6f9f46', leaf: '#8cc155', gold: '#e3bd57', cream: '#f4ecd6',
  eye: '#231a16', pink: '#f0a3b2'
};

/** Every one of your pieces stands on the same mossy plinth, so a strange
    animal still reads as one of yours. */
function plinth(m, ring = P.moss, base = P.woodDark) {
  m.lathe([[3.7, 0], [3.7, 0.8]], base, { seg: 10 });
  m.lathe([[3.3, 0.8], [3.3, 1.5]], ring, { seg: 10 });
  return m;
}

// --- The classic six: turned shapes in walnut. -----------------------------

function pawn() {
  const m = plinth(new Model());
  m.lathe([[2.5, 1.5], [1.6, 3.2], [1.1, 5.6], [2.2, 6.0], [2.2, 6.5], [1.0, 6.9]], [P.wood, P.wood, P.moss, P.moss, P.wood]);
  m.ball(0, 8.4, 0, 2.0, P.wood);
  return m;
}

function rook() {
  const m = plinth(new Model());
  m.lathe([[2.8, 1.5], [2.2, 3.0], [2.1, 4.2], [2.1, 4.8], [2.1, 7.6], [3.0, 8.3], [3.0, 9.6]], [P.wood, P.wood, P.moss, P.wood, P.wood, P.wood]);
  m.lathe([[2.2, 9.6], [2.2, 9.66]], P.woodDark);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    m.box(Math.cos(a) * 2.3, 10.3, Math.sin(a) * 2.3, 1.6, 1.4, 1.6, P.wood, { ry: -a });
  }
  return m;
}

function horse(body, mane, { eye = P.eye, muzzle = P.woodDark, stripes = null } = {}) {
  const m = plinth(new Model());
  m.group({ t: [0, 4.3, -0.4], rx: -0.12 }, () => {
    m.box(0, 0, 0, 3.0, 5.4, 3.4, body);                   // neck and chest
    if (stripes) for (const y of [-1.8, -0.4, 1.0, 2.4]) m.box(0, y, 0, 3.1, 0.5, 3.5, stripes);
    m.box(0, 1.8, -1.9, 0.9, 5.4, 0.8, mane);              // mane
  });
  m.group({ t: [0, 8.0, 1.0], rx: 0.4 }, () => {
    m.box(0, 0, 0, 2.6, 2.4, 4.8, body);                   // head, snout down
    if (stripes) for (const z of [-1.2, 0.2]) m.box(0, 0, z, 2.7, 2.5, 0.5, stripes);
    m.box(0, -0.2, 2.2, 2.3, 1.9, 0.9, muzzle);            // muzzle
    m.box(1.32, 0.5, 0.2, 0.15, 0.6, 0.6, eye);            // eyes
    m.box(-1.32, 0.5, 0.2, 0.15, 0.6, 0.6, eye);
  });
  m.box(0.8, 9.9, -0.4, 0.6, 1.3, 0.6, body, { rx: -0.2 }); // ears
  m.box(-0.8, 9.9, -0.4, 0.6, 1.3, 0.6, body, { rx: -0.2 });
  return m;
}

function bishopShape(body, accent, extra) {
  const m = plinth(new Model());
  m.lathe([[2.4, 1.5], [1.5, 3.0], [1.1, 6.6], [2.2, 7.1], [2.2, 7.5], [1.3, 7.9]], [body, body, accent, accent, body]);
  m.ellipsoid(0, 9.7, 0, 1.8, 2.4, 1.8, body);
  m.box(0.45, 10.2, 0, 0.35, 1.9, 4.0, accent, { rz: -0.6 }); // the mitre's slit
  m.ball(0, 12.2, 0, 0.6, P.woodLight, { seg: 6, rings: 4 });
  if (extra) extra(m);
  return m;
}

function queenShape(top) {
  const m = plinth(new Model());
  m.lathe([[2.4, 1.5], [1.5, 3.2], [1.0, 7.8], [2.0, 8.3], [2.0, 8.7], [1.5, 9.1], [2.3, 10.2]], [P.wood, P.wood, P.moss, P.moss, P.wood, P.wood]);
  top(m);
  return m;
}

const MODELS = {
  pawn, rook,
  knight: () => horse(P.wood, P.moss),
  bishop: () => bishopShape(P.wood, P.moss),
  queen: () => queenShape((m) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      m.cone(Math.cos(a) * 1.9, 10.1, Math.sin(a) * 1.9, 0.6, 1.4, P.leaf, { seg: 5 });
    }
    m.ball(0, 10.9, 0, 0.9, P.gold, { seg: 6, rings: 4 });
  }),
  king: () => queenShape((m) => {
    m.lathe([[2.3, 10.2], [1.3, 10.7]], P.wood);
    m.box(0, 12.0, 0, 0.7, 2.6, 0.7, P.gold);
    m.box(0, 12.3, 0, 2.2, 0.7, 0.7, P.gold);
  }),

  // --- The fairy pieces. Most are named for animals, so they get to be one.

  grasshopper() {
    const m = plinth(new Model()), g = '#5fae3e', dk = '#3f7d2a', lt = '#9bd36a';
    m.ellipsoid(0, 3.2, -0.2, 1.2, 1.1, 2.8, g);             // body
    m.box(0, 4.1, -0.6, 1.6, 0.3, 3.6, dk, { rx: 0.12 });     // folded wings
    m.ellipsoid(0, 3.9, 2.6, 1.15, 1.25, 1.2, lt);          // head
    m.ball(0.85, 4.3, 3.0, 0.42, P.eye, { seg: 6, rings: 4 });
    m.ball(-0.85, 4.3, 3.0, 0.42, P.eye, { seg: 6, rings: 4 });
    for (const s of [1, -1]) {                                // the big hind legs
      m.box(s * 1.5, 4.4, -0.9, 0.55, 0.7, 3.6, dk, { rx: 0.75 });
      m.box(s * 1.55, 2.7, -2.1, 0.45, 2.8, 0.45, dk, { rx: -0.25 });
      m.box(s * 0.5, 5.6, 3.5, 0.14, 0.14, 2.6, dk, { rx: -0.9 }); // antennae
    }
    return m;
  },

  nightrider() {
    const m = horse('#3d4a7a', '#232c4f', { muzzle: '#2a3358', eye: P.gold });
    for (const [x, y] of [[-0.9, 11.0], [-0.4, 11.6], [0.3, 11.8], [0.9, 11.5]]) m.box(x, y, -0.2, 0.6, 0.6, 0.6, P.gold);
    return m;
  },

  camel() {
    const m = plinth(new Model()), c = '#c9a26b', dk = '#9c7a4c';
    for (const [x, z] of [[1.2, 1.5], [-1.2, 1.5], [1.2, -1.5], [-1.2, -1.5]]) m.box(x, 3.2, z, 0.75, 3.4, 0.75, dk);
    m.ellipsoid(0, 5.6, 0, 1.95, 1.5, 2.9, c);              // body
    m.ellipsoid(0, 7.0, -1.1, 1.15, 1.35, 1.05, c);         // humps
    m.ellipsoid(0, 7.0, 1.0, 1.15, 1.35, 1.05, c);
    m.box(0, 7.4, 2.8, 1.05, 3.2, 1.05, c, { rx: 0.35 });   // neck
    m.ellipsoid(0, 8.9, 3.3, 0.85, 0.75, 1.35, c);          // head
    m.ball(0.65, 9.1, 3.7, 0.24, P.eye, { seg: 5, rings: 3 });
    m.ball(-0.65, 9.1, 3.7, 0.24, P.eye, { seg: 5, rings: 3 });
    return m;
  },

  zebra: () => horse('#f1efe6', '#1f1f1f', { muzzle: '#2b2b2b', stripes: '#1f1f1f' }),

  alfil() { // al-fil, "the elephant"
    const m = plinth(new Model()), g = '#9aa3ad', dk = '#7c858f';
    for (const [x, z] of [[1.4, 1.3], [-1.4, 1.3], [1.4, -1.5], [-1.4, -1.5]]) m.lathe([[0.8, 1.5], [0.8, 4.0]], dk, { seg: 6, at: [x, 0, z] });
    m.ellipsoid(0, 5.5, -0.3, 2.6, 2.2, 2.9, g);            // body
    m.ellipsoid(0, 6.8, 2.3, 1.8, 1.7, 1.5, g);             // head
    m.ellipsoid(2.0, 6.9, 1.6, 0.3, 1.7, 1.5, '#c7a5a8');   // ears
    m.ellipsoid(-2.0, 6.9, 1.6, 0.3, 1.7, 1.5, '#c7a5a8');
    m.box(0, 5.3, 3.6, 0.95, 2.1, 0.95, dk, { rx: 0.2 });   // trunk
    m.box(0, 3.9, 4.0, 0.7, 1.4, 0.7, dk, { rx: 0.5 });
    m.cone(0.8, 5.6, 3.4, 0.28, 1.5, P.cream, { rot: { rx: 1.9 } }); // tusks
    m.cone(-0.8, 5.6, 3.4, 0.28, 1.5, P.cream, { rot: { rx: 1.9 } });
    m.ball(1.05, 7.4, 3.4, 0.25, P.eye, { seg: 5, rings: 3 });
    m.ball(-1.05, 7.4, 3.4, 0.25, P.eye, { seg: 5, rings: 3 });
    return m;
  },

  ferz() { // drawn as an acorn
    const m = plinth(new Model());
    m.lathe([[0.6, 1.5], [1.8, 2.3], [2.3, 3.9], [2.2, 5.5], [1.9, 6.2]], '#c98b45', { seg: 10 });
    m.lathe([[2.5, 5.9], [2.7, 6.8], [2.1, 7.8], [0.7, 8.3]], ['#6b4a2c', '#5a3d24', '#6b4a2c'], { seg: 10 });
    m.lathe([[0.35, 8.2], [0.3, 9.4]], '#5a3d24', { seg: 5 });
    return m;
  },

  wazir() { // drawn as a toadstool
    const m = plinth(new Model());
    m.lathe([[1.3, 1.5], [1.1, 4.5], [1.25, 5.5]], P.cream, { seg: 8 });
    m.lathe([[3.7, 5.3], [3.6, 6.0], [2.8, 7.3], [1.2, 8.2], [0, 8.4]], '#d2473b', { seg: 10 });
    for (const [x, y, z] of [[1.8, 7.2, 1.2], [-1.5, 7.3, -1.4], [0.2, 8.15, 0.3], [-2.5, 6.4, 1.3], [2.5, 6.4, -1.4], [0.4, 6.7, 2.7]])
      m.ellipsoid(x, y, z, 0.5, 0.25, 0.5, P.cream, { seg: 6, rings: 3 });
    return m;
  },

  cannon() {
    const m = plinth(new Model()), iron = '#5f6570';
    m.box(0, 2.9, 0, 2.6, 1.8, 4.4, P.wood);                // carriage
    for (const s of [1, -1])                                  // wheels
      m.lathe([[2.2, -0.4], [2.2, 0.4]], P.woodDark, { seg: 8, at: [s * 1.9, 3.4, -0.3], rot: { rz: Math.PI / 2 } });
    const aim = { at: [0, 5.2, 0], rot: { rx: Math.PI / 2 - 0.45 } };
    m.lathe([[1.7, -3.0], [1.55, 0], [1.25, 3.0], [1.5, 3.2], [1.5, 3.8]], iron, { seg: 8, ...aim });
    m.lathe([[0.85, 3.81], [0.85, 3.86]], '#16171a', { seg: 8, ...aim });
    return m;
  },

  mao() { // the horse of xiangqi, red lacquer on a cream disc
    const m = horse('#b5372f', P.gold, { muzzle: '#7d211b', eye: P.cream });
    m.lathe([[3.75, 0], [3.75, 0.82]], P.cream, { seg: 10 });
    return m;
  },

  squirrel() {
    const m = plinth(new Model()), o = '#c56a2c', lt = '#e08f4f';
    m.ellipsoid(0, 3.7, 0.5, 1.5, 2.0, 1.4, o);             // body
    m.ellipsoid(0, 3.4, 1.4, 1.0, 1.4, 0.7, P.cream);       // belly
    m.ellipsoid(0, 6.3, 1.1, 1.3, 1.2, 1.3, o);             // head
    m.cone(0.7, 7.2, 0.8, 0.4, 1.0, o, { seg: 5 });          // ears
    m.cone(-0.7, 7.2, 0.8, 0.4, 1.0, o, { seg: 5 });
    m.ball(0.65, 6.6, 2.15, 0.22, P.eye, { seg: 5, rings: 3 });
    m.ball(-0.65, 6.6, 2.15, 0.22, P.eye, { seg: 5, rings: 3 });
    for (const [y, z, r] of [[3.0, -1.7, 1.1], [5.0, -2.4, 1.35], [7.3, -2.3, 1.35], [9.0, -1.3, 1.1]]) // the tail
      m.ellipsoid(0, y, z, r, r * 1.1, r * 0.85, lt);
    return m;
  },

  rose() {
    const m = plinth(new Model()), red = '#c8324a', deep = '#962238';
    m.lathe([[0.35, 1.5], [0.3, 7.4]], '#4f8a35', { seg: 5 });
    m.ellipsoid(1.2, 4.0, 0, 1.2, 0.25, 0.6, P.leaf, { rot: { rz: 0.5 } });
    m.ellipsoid(-1.1, 5.3, 0, 1.2, 0.25, 0.6, P.leaf, { rot: { rz: -0.5 } });
    m.lathe([[0.6, 7.0], [1.9, 8.0], [2.4, 9.4], [2.1, 10.3]], red, { seg: 8 });
    m.ellipsoid(0, 10.0, 0, 1.6, 1.0, 1.6, deep);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      m.ellipsoid(Math.cos(a) * 1.0, 10.4, Math.sin(a) * 1.0, 1.0, 0.8, 0.45, red, { rot: { ry: -a + Math.PI / 2 }, seg: 6, rings: 4 });
    }
    return m;
  },

  archbishop: () => bishopShape('#6a4a8c', P.gold, (m) => {
    m.box(1.0, 11.6, -0.3, 0.5, 1.2, 0.5, '#6a4a8c', { rz: -0.3 }); // horse ears
    m.box(-1.0, 11.6, -0.3, 0.5, 1.2, 0.5, '#6a4a8c', { rz: 0.3 });
  })
};

// --- Not yours. ------------------------------------------------------------

MODELS.rabbit = () => {
  const m = new Model(), w = '#f6f2ea', sh = '#ddd4c4';
  m.ellipsoid(0, 2.5, -0.3, 2.2, 2.3, 2.6, w);             // body
  m.ellipsoid(0, 5.4, 1.5, 1.6, 1.5, 1.6, w);             // head
  for (const s of [1, -1]) {
    m.ellipsoid(s * 0.7, 8.1, 1.0, 0.5, 2.0, 0.35, w, { rot: { rz: -s * 0.15 } });      // ears
    m.ellipsoid(s * 0.7, 8.0, 1.3, 0.3, 1.5, 0.15, P.pink, { rot: { rz: -s * 0.15 } });
    m.ball(s * 1.05, 5.8, 2.55, 0.3, P.eye, { seg: 6, rings: 4 });
    m.ellipsoid(s * 0.8, 0.5, 1.9, 0.5, 0.45, 0.8, sh);     // front paws
  }
  m.ball(0, 5.0, 3.1, 0.3, P.pink, { seg: 6, rings: 4 }); // nose
  m.ball(0, 2.4, -2.9, 0.9, '#ffffff', { seg: 6, rings: 4 }); // tail
  return m;
};

// The ball rolls rather than stands, so it has no plinth: a cream ball with a
// moss band, so it still reads as yours.
MODELS.ball = () => {
  const m = new Model();
  m.ball(0, 2.7, 0, 2.6, P.cream, { seg: 10, rings: 8 });
  m.lathe([[2.66, 2.4], [2.66, 3.0]], P.moss, { seg: 10 });
  return m;
};

// The hole's flag, so a moving hole can be seen from across the board.
MODELS.flag = () => {
  const m = new Model();
  m.lathe([[0.25, 0], [0.25, 9.5]], '#4a3220', { seg: 5 });
  m.box(1.35, 8.4, 0, 2.5, 1.7, 0.2, '#d2473b');
  return m;
};

MODELS.bramble = () => {
  const m = new Model();
  for (const [x, y, z, r, c] of [[-1.4, 1.3, -0.8, 1.7, '#3f6b2c'], [1.4, 1.2, 0.2, 1.6, '#4a7a33'], [0, 2.4, 0.4, 1.7, '#557f36'],
    [-0.4, 1.1, 1.6, 1.3, '#3f6b2c'], [1.0, 2.6, -1.2, 1.2, '#3a5f28']])
    m.ellipsoid(x * 1.15, y * 1.2, z * 1.15, r * 1.2, r * 1.05, r * 1.2, c, { seg: 6, rings: 4 });
  for (const [x, y, z, rx, rz] of [[-2.5, 1.8, -0.6, 0, 1.2], [2.6, 1.5, 0.6, 0, -1.2], [0.4, 3.9, 0.4, 0.2, 0.1], [-0.6, 2.0, 2.7, 1.1, 0], [1.4, 3.4, -1.9, -0.9, -0.3]])
    m.cone(x * 1.2, y * 1.2, z * 1.2, 0.35, 1.3, '#6d4a2a', { seg: 4, rot: { rx, rz } });
  for (const [x, y, z] of [[1.6, 2.6, 1.3], [-1.2, 2.9, 0.6], [0.2, 1.4, 2.6], [-2.4, 1.6, 0.5]])
    m.ball(x * 1.2, y * 1.2, z * 1.2, 0.5, '#5a2a63', { seg: 5, rings: 3 });
  return m;
};

MODELS.stump = () => {
  const m = new Model();
  m.lathe([[3.5, 0], [3.0, 0.6], [2.9, 3.0]], '#6a4a30', { seg: 9 });
  m.lathe([[2.75, 3.0], [2.75, 3.04]], '#d8b98a', { seg: 9 });
  m.lathe([[1.8, 3.04], [1.8, 3.08]], '#bf9b68', { seg: 9 });
  m.lathe([[0.8, 3.08], [0.8, 3.12]], '#d8b98a', { seg: 9 });
  m.lathe([[0.3, 2.4], [0.3, 4.0]], P.cream, { seg: 5, at: [2.4, 0, 1.6] });  // a toadstool friend
  m.lathe([[0.9, 3.9], [0.7, 4.4], [0, 4.6]], '#d2473b', { seg: 7, at: [2.4, 0, 1.6] });
  return m;
};

// Crumbling ground, for the pieces menu and the opening: a square of grass
// breaking into chunks, the far ones still level, the near ones tipping
// away into the dark.
MODELS.crumble = () => {
  const m = new Model();
  const chunk = (x, y, z, w, d, grass, rot = {}) => m.group({ t: [x, y, z], ...rot }, () => {
    m.box(0, 0, 0, w, 1.6, d, '#6b4a2e');          // earth
    m.box(0, 1.1, 0, w, 0.6, d, grass);            // grass on top
  });
  chunk(-1.6, 4.2, -1.6, 3.0, 3.0, '#b9dc9b');
  chunk(1.6, 3.6, -1.6, 2.9, 2.9, '#f6efd7', { rz: -0.3 });
  chunk(-1.7, 2.6, 1.7, 2.8, 2.7, '#f6efd7', { rx: 0.45 });
  chunk(1.8, 1.4, 2.0, 2.2, 2.2, '#b9dc9b', { rx: 0.7, rz: -0.6 });
  for (const [x, y, z, r] of [[0.2, 0.6, 1.0, 0.45], [2.8, 0.4, 0.2, 0.35], [-0.6, 0.3, 3.0, 0.4], [0.9, 1.6, 0.0, 0.3]])
    m.box(x, y, z, r * 2, r * 2, r * 2, '#4a3220', { rx: x, ry: z });
  return m;
};

// Their pieces: the same shapes in dark plum wood on a berry-red plinth, so a
// bishop of theirs never looks like a bishop of yours. The builders read the
// palette when they run, so swapping it for the length of one build is enough.
const FOE = { wood: '#4f3c58', woodLight: '#6f5880', woodDark: '#2c2131', moss: '#b8435a', leaf: '#de6f82' };

function withPalette(over, build) {
  const saved = { ...P };
  Object.assign(P, over);
  try { return build(); } finally { Object.assign(P, saved); }
}

const cache = new Map();
/** One shared Model per kind and side ('you' or 'foe'). Treat it as read-only. */
export function model(kind, side = 'you') {
  const key = side === 'foe' && kind !== 'rabbit' ? kind + ':foe' : kind;
  if (!cache.has(key)) cache.set(key, key.endsWith(':foe') ? withPalette(FOE, MODELS[kind]) : MODELS[kind]());
  return cache.get(key);
}

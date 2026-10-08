// The models: simple polygon shapes, N64 style. Every piece fits in a circle
// of radius about 3.7, stands on y = 0 and faces +z (toward you). See
// engine/lowpoly.js for the shapes and how they are drawn.

import { Model } from '../../engine/lowpoly.js';

// The palette every model is built from. Since 2026-10-07 (Timothy: "enemy
// pieces should be purple, and friendly pieces should be green for now,
// just clearly distinguish them") the body colours are the side's: green
// for yours (YOU, below), purple for theirs (FOE). The plinth is the
// rabbit's: a piece with a rabbit inside stands on a base of its colour;
// one without stands on plain stone.
const P = {
  wood: '#4f8a3b', woodLight: '#72ad56', woodDark: '#2d5523',   // the body
  moss: '#d6e8b4', leaf: '#eef6d8',                               // pale trim on the body
  band: '#c9c1ae', base: '#8d8577',                               // the plinth: stone, or the rabbit's colour
  gold: '#e3bd57', cream: '#f4ecd6', iron: '#5f6570',
  eye: '#231a16', pink: '#f0a3b2'
};
const YOU = { ...P };

/** Every piece stands on a plinth, so a strange animal still reads as a
    piece. Its colour is the rabbit's inside it, or stone. */
function plinth(m, ring = P.band, base = P.base) {
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

  // --- The fairy pieces. Each looks like what its name meant when it was
  // invented (docs/grove-pieces.md), not like the forest: an animal where
  // the name is an animal, a person or a machine where it was one. The body
  // is the side's colour, as every piece's is.

  grasshopper() { // T. R. Dawson's grasshopper, 1912: named for how it hops
    const m = plinth(new Model());
    m.ellipsoid(0, 3.2, -0.2, 1.2, 1.1, 2.8, P.wood);           // body
    m.box(0, 4.1, -0.6, 1.6, 0.3, 3.6, P.woodDark, { rx: 0.12 }); // folded wings
    m.ellipsoid(0, 3.9, 2.6, 1.15, 1.25, 1.2, P.woodLight);     // head
    m.ball(0.85, 4.3, 3.0, 0.42, P.eye, { seg: 6, rings: 4 });
    m.ball(-0.85, 4.3, 3.0, 0.42, P.eye, { seg: 6, rings: 4 });
    for (const s of [1, -1]) {                                    // the big hind legs
      m.box(s * 1.5, 4.4, -0.9, 0.55, 0.7, 3.6, P.woodDark, { rx: 0.75 });
      m.box(s * 1.55, 2.7, -2.1, 0.45, 2.8, 0.45, P.woodDark, { rx: -0.25 });
      m.box(s * 0.5, 5.6, 3.5, 0.14, 0.14, 2.6, P.woodDark, { rx: -0.9 }); // antennae
    }
    return m;
  },

  nightrider() { // a knight that rides on (Dawson, 1925); the stars for its name
    const m = horse(P.woodDark, P.wood, { muzzle: P.woodDark, eye: P.gold });
    for (const [x, y] of [[-0.9, 11.0], [-0.4, 11.6], [0.3, 11.8], [0.9, 11.5]]) m.box(x, y, -0.2, 0.6, 0.6, 0.6, P.gold);
    return m;
  },

  camel() { // the camel of Tamerlane chess
    const m = plinth(new Model()), c = P.woodLight, dk = P.woodDark;
    for (const [x, z] of [[1.2, 1.5], [-1.2, 1.5], [1.2, -1.5], [-1.2, -1.5]]) m.box(x, 3.2, z, 0.75, 3.4, 0.75, dk);
    m.ellipsoid(0, 5.6, 0, 1.95, 1.5, 2.9, c);              // body
    m.ellipsoid(0, 7.0, -1.1, 1.15, 1.35, 1.05, P.wood);    // humps
    m.ellipsoid(0, 7.0, 1.0, 1.15, 1.35, 1.05, P.wood);
    m.box(0, 7.4, 2.8, 1.05, 3.2, 1.05, c, { rx: 0.35 });   // neck
    m.ellipsoid(0, 8.9, 3.3, 0.85, 0.75, 1.35, c);          // head
    m.ball(0.65, 9.1, 3.7, 0.24, P.eye, { seg: 5, rings: 3 });
    m.ball(-0.65, 9.1, 3.7, 0.24, P.eye, { seg: 5, rings: 3 });
    return m;
  },

  zebra: () => horse(P.woodLight, P.woodDark, { muzzle: P.woodDark, stripes: P.woodDark }),

  alfil() { // al-fil, "the elephant", of shatranj
    const m = plinth(new Model()), g = P.wood, dk = P.woodDark;
    for (const [x, z] of [[1.4, 1.3], [-1.4, 1.3], [1.4, -1.5], [-1.4, -1.5]]) m.lathe([[0.8, 1.5], [0.8, 4.0]], dk, { seg: 6, at: [x, 0, z] });
    m.ellipsoid(0, 5.5, -0.3, 2.6, 2.2, 2.9, g);            // body
    m.ellipsoid(0, 6.8, 2.3, 1.8, 1.7, 1.5, g);             // head
    m.ellipsoid(2.0, 6.9, 1.6, 0.3, 1.7, 1.5, P.woodLight); // ears
    m.ellipsoid(-2.0, 6.9, 1.6, 0.3, 1.7, 1.5, P.woodLight);
    m.box(0, 5.3, 3.6, 0.95, 2.1, 0.95, dk, { rx: 0.2 });   // trunk
    m.box(0, 3.9, 4.0, 0.7, 1.4, 0.7, dk, { rx: 0.5 });
    m.cone(0.8, 5.6, 3.4, 0.28, 1.5, P.cream, { rot: { rx: 1.9 } }); // tusks
    m.cone(-0.8, 5.6, 3.4, 0.28, 1.5, P.cream, { rot: { rx: 1.9 } });
    m.ball(1.05, 7.4, 3.4, 0.25, P.eye, { seg: 5, rings: 3 });
    m.ball(-1.05, 7.4, 3.4, 0.25, P.eye, { seg: 5, rings: 3 });
    return m;
  },

  ferz() {
    // The fers, firzan, the shah's counsellor in shatranj, and the piece the
    // queen grew out of. Early Islamic sets made their pieces abstract: the
    // counsellor was a smaller turned drum than the shah's, with a dome.
    const m = plinth(new Model());
    m.lathe([[2.5, 1.5], [2.1, 2.4], [1.7, 4.6], [2.1, 5.2], [2.1, 5.6]], [P.wood, P.wood, P.moss, P.wood]);
    m.lathe([[2.1, 5.6], [1.9, 6.6], [1.2, 7.6], [0.0, 8.0]], P.woodLight, { seg: 10 });
    m.ball(0, 8.4, 0, 0.55, P.gold, { seg: 6, rings: 4 });
    return m;
  },

  wazir() {
    // The vizier: wazir is the Arabic word, and Tamerlane chess had a vizier
    // that moved one square straight. A turned body under a wound turban.
    const m = plinth(new Model());
    m.lathe([[2.4, 1.5], [1.6, 3.0], [1.3, 5.6], [1.7, 6.1]], [P.wood, P.wood, P.wood]);
    m.ellipsoid(0, 6.6, 0.45, 1.0, 0.9, 0.9, P.woodLight);                 // face, under the turban
    m.ellipsoid(0, 8.0, 0, 2.1, 1.0, 2.1, P.cream, { seg: 10 });          // the turban's wrap
    m.ellipsoid(0, 8.8, 0, 1.6, 0.9, 1.6, P.cream, { seg: 10 });
    m.ellipsoid(0, 9.5, 0, 0.9, 0.7, 0.9, P.moss, { seg: 8 });
    m.ball(0, 8.4, 1.95, 0.35, P.gold, { seg: 5, rings: 3 });            // the jewel
    return m;
  },

  cannon() { // pao, the cannon of xiangqi (once a catapult), on a xiangqi disc
    const m = plinth(new Model());
    m.lathe([[3.75, 0], [3.75, 0.82]], P.cream, { seg: 10 });
    m.box(0, 2.9, 0, 2.6, 1.8, 4.4, P.wood);                // carriage
    for (const s of [1, -1])                                  // wheels
      m.lathe([[2.2, -0.4], [2.2, 0.4]], P.woodDark, { seg: 8, at: [s * 1.9, 3.4, -0.3], rot: { rz: Math.PI / 2 } });
    const aim = { at: [0, 5.2, 0], rot: { rx: Math.PI / 2 - 0.45 } };
    m.lathe([[1.7, -3.0], [1.55, 0], [1.25, 3.0], [1.5, 3.2], [1.5, 3.8]], P.iron, { seg: 8, ...aim });
    m.lathe([[0.85, 3.81], [0.85, 3.86]], '#16171a', { seg: 8, ...aim });
    return m;
  },

  mao() { // the horse of xiangqi, on a xiangqi disc
    const m = horse(P.wood, P.gold, { muzzle: P.woodDark, eye: P.cream });
    m.lathe([[3.75, 0], [3.75, 0.82]], P.cream, { seg: 10 });
    return m;
  },

  squirrel() { // a modern leaper, named for an animal as leapers are
    const m = plinth(new Model()), o = P.wood, lt = P.woodLight;
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

  rose() { // named for the flower its circling path draws
    const m = plinth(new Model()), red = P.woodLight, deep = P.woodDark;
    m.lathe([[0.35, 1.5], [0.3, 7.4]], P.woodDark, { seg: 5 });
    m.ellipsoid(1.2, 4.0, 0, 1.2, 0.25, 0.6, P.wood, { rot: { rz: 0.5 } });
    m.ellipsoid(-1.1, 5.3, 0, 1.2, 0.25, 0.6, P.wood, { rot: { rz: -0.5 } });
    m.lathe([[0.6, 7.0], [1.9, 8.0], [2.4, 9.4], [2.1, 10.3]], red, { seg: 8 });
    m.ellipsoid(0, 10.0, 0, 1.6, 1.0, 1.6, deep);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      m.ellipsoid(Math.cos(a) * 1.0, 10.4, Math.sin(a) * 1.0, 1.0, 0.8, 0.45, red, { rot: { ry: -a + Math.PI / 2 }, seg: 6, rings: 4 });
    }
    return m;
  },

  archbishop: () => bishopShape(P.woodDark, P.gold, (m) => { // Capablanca's bishop-knight
    m.box(1.0, 11.6, -0.3, 0.5, 1.2, 0.5, P.woodDark, { rz: -0.3 }); // horse ears
    m.box(-1.0, 11.6, -0.3, 0.5, 1.2, 0.5, P.woodDark, { rz: 0.3 });
  }),

  // --- Added 2026-10-07. --------------------------------------------------

  chancellor() { // Capablanca's rook-knight: a tower with a horse's head
    const m = plinth(new Model());
    m.lathe([[2.8, 1.5], [2.2, 3.0], [2.1, 4.2], [2.1, 4.8], [2.1, 7.0], [2.8, 7.6], [2.8, 8.4]], [P.wood, P.wood, P.moss, P.wood, P.wood, P.wood]);
    m.group({ t: [0, 9.6, 0.3], rx: 0.3 }, () => {
      m.box(0, 0, 0, 2.2, 2.0, 3.6, P.woodLight);              // head
      m.box(0, -0.2, 1.7, 1.9, 1.5, 0.7, P.woodDark);          // muzzle
      m.box(0, 1.1, -1.5, 0.7, 2.0, 0.7, P.woodDark);          // mane
    });
    m.box(0.7, 11.3, -0.2, 0.5, 1.0, 0.5, P.woodLight);        // ears
    m.box(-0.7, 11.3, -0.2, 0.5, 1.0, 0.5, P.woodLight);
    return m;
  },

  amazon: () => queenShape((m) => { // the queen with a knight's jump: crowned, and horse-headed
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      m.cone(Math.cos(a) * 1.9, 10.1, Math.sin(a) * 1.9, 0.6, 1.4, P.leaf, { seg: 5 });
    }
    m.group({ t: [0, 12.0, 0.4], rx: 0.35 }, () => {
      m.box(0, 0, 0, 2.0, 1.9, 3.2, P.woodLight);
      m.box(0, -0.2, 1.5, 1.7, 1.4, 0.6, P.woodDark);
    });
    m.box(0.6, 13.4, -0.1, 0.45, 0.9, 0.45, P.gold);
    m.box(-0.6, 13.4, -0.1, 0.45, 0.9, 0.45, P.gold);
  }),

  dabbaba() { // the dabbaba, a covered siege engine: a shed on wheels with a ram
    const m = plinth(new Model());
    for (const [x, z] of [[1.9, 1.6], [-1.9, 1.6], [1.9, -1.6], [-1.9, -1.6]])
      m.lathe([[1.0, -0.3], [1.0, 0.3]], P.woodDark, { seg: 8, at: [x, 2.5, z], rot: { rz: Math.PI / 2 } });
    m.box(0, 4.2, 0, 3.4, 2.4, 4.6, P.wood);                   // the shed
    m.box(0.95, 6.3, 0, 1.4, 0.4, 4.8, P.woodLight, { rz: -0.6 }); // its pitched roof
    m.box(-0.95, 6.3, 0, 1.4, 0.4, 4.8, P.woodLight, { rz: 0.6 });
    m.lathe([[0.55, 0], [0.55, 3.6]], P.woodDark, { seg: 6, at: [0, 4.0, 1.4], rot: { rx: Math.PI / 2 } }); // the ram
    m.box(0, 4.0, 5.1, 1.3, 1.3, 0.5, P.iron);
    return m;
  },

  silver: () => shogi((m) => { // a silver general: a wedge with a silver mark
    m.box(0, 5.2, 0.75, 1.3, 1.3, 0.12, '#c9ccd2', { rz: Math.PI / 4 });
    m.box(0, 3.4, 0.75, 1.9, 0.35, 0.12, '#c9ccd2');
  }),

  lance: () => shogi((m) => { // a lance, the incense chariot: a wedge marked with a spear
    m.box(0, 4.0, 0.75, 0.3, 4.4, 0.12, P.cream);
    m.box(0, 6.5, 0.75, 0.9, 0.9, 0.12, P.cream, { rz: Math.PI / 4 });
  })
};

/** A shogi piece: a five-sided wooden wedge that leans back, its point
    toward the enemy. `mark` paints its face. */
function shogi(mark) {
  const m = plinth(new Model());
  m.group({ t: [0, 1.5, 0], rx: -0.12 }, () => {
    m.box(0, 3.2, 0, 4.0, 5.6, 1.4, P.woodLight);             // the body
    m.box(0, 6.5, 0, 2.9, 2.9, 1.4, P.woodLight, { rz: Math.PI / 4 }); // the point
    m.box(0, 3.2, -0.05, 4.1, 5.6, 1.3, P.woodDark);          // its back
    mark(m);
  });
  return m;
}

// --- Not yours. ------------------------------------------------------------

/** A rabbit, white by default or in the fur of its pattern (rabbits.js).
    The tail and the insides of the ears stay pale either way. */
MODELS.rabbit = (fur = null) => {
  const m = new Model(), w = fur || '#f6f2ea', sh = fur ? shade(fur, 0.82) : '#ddd4c4';
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

// Shrinking ground, for the pieces menu and the opening: a slab of misty
// squares whose corners have already gone, and one more on its way down.
MODELS.shrink = () => {
  const m = new Model(), light = '#a9c4b8', dark = '#e4ece4', s = 2.6;
  for (let gy = -1; gy <= 1; gy++)
    for (let gx = -1; gx <= 1; gx++) {
      if (Math.abs(gx) === 1 && Math.abs(gy) === 1 && !(gx === 1 && gy === 1)) continue; // three corners gone
      const col = (gx + gy) % 2 === 0 ? light : dark;
      if (gx === 1 && gy === 1) {
        m.group({ t: [gx * s, 1.2, gy * s], rx: 0.5, rz: -0.4 }, () => { m.box(0, 0, 0, 2.3, 0.8, 2.3, '#3a4a44'); m.box(0, 0.5, 0, 2.3, 0.3, 2.3, col); });
        continue;
      }
      m.box(gx * s, 3.0, gy * s, 2.5, 0.8, 2.5, '#4a3220');
      m.box(gx * s, 3.55, gy * s, 2.5, 0.3, 2.5, col);
    }
  return m;
};

// Their pieces: the same shapes in purple, so nothing of theirs looks like
// anything of yours. The builders read the palette when they run, so
// swapping it for the length of one build is enough.
const FOE = { wood: '#6c4795', woodLight: '#9170bd', woodDark: '#3b2558', moss: '#e3d3f2', leaf: '#f1e7fa' };

// Statues: any piece's shape in weathered grey stone, on a stone plinth,
// with no colour of either side (2026-10-07; they were stumps before).
const STONE = { wood: '#8e918c', woodLight: '#adb0aa', woodDark: '#62665f', moss: '#a3a69f', leaf: '#b8bbb4',
  band: '#7b7f78', base: '#555a53', gold: '#9da09a', cream: '#c4c6bf' };

function withPalette(over, build) {
  const saved = { ...P };
  Object.assign(P, over);
  try { return build(); } finally { Object.assign(P, saved); }
}

/** A colour scaled toward black by k (1 leaves it as it is). */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

const cache = new Map();

// An invented piece (invented.js) borrows the look of an existing one.
const LOOKS = new Map();
export function setLook(kind, base) { if (MODELS[base]) { LOOKS.set(kind, base); for (const k of [...cache.keys()]) if (k.startsWith(kind + ':')) cache.delete(k); } }
/** One shared Model per kind and side ('you' or 'foe'), and for rabbits per
    fur colour. `glow` is for a piece possessed by a rabbit (theirs, or
    yours in autochess): its plinth band takes the rabbit's colour. Treat it
    as read-only. */
export function model(kind, side = 'you', fur = null, glow = null) {
  if (kind === 'rabbit') {
    const key = 'rabbit' + (fur || '');
    if (!cache.has(key)) cache.set(key, MODELS.rabbit(fur));
    return cache.get(key);
  }
  const key = `${kind}:${side}:${glow || ''}`;
  if (!cache.has(key)) {
    // The rabbit inside colours the whole plinth: its fur on the band, a
    // darker shade of it underneath.
    const plinthOf = glow ? { band: glow, base: shade(glow, 0.62) } : {};
    const build = MODELS[kind] || MODELS[LOOKS.get(kind)] || MODELS.pawn;
    cache.set(key, withPalette({ ...(side === 'foe' ? FOE : side === 'stone' ? STONE : YOU), ...plinthOf }, build));
  }
  return cache.get(key);
}

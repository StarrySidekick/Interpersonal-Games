// The models: simple polygon shapes, N64 style. Every piece fits in a circle
// of radius about 3.7, stands on y = 0 and faces +z (toward you). See
// engine/lowpoly.js for the shapes and how they are drawn.

import { Model } from '../../engine/lowpoly.js';
import { LOOK, LOOK_DEFAULTS } from './config.js';

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
/** Colour a moved k of the way to colour b. */
function blend(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (n, sh) => Math.round(((n >> sh) & 255) + ((((B >> sh) & 255) - ((n >> sh) & 255)) * k)).toString(16).padStart(2, '0');
  return `#${ch(A, 16)}${ch(A, 8)}${ch(A, 0)}`;
}
/** A body colour and its light and dark, for a colour set in config.js. */
const body = (c) => ({ wood: c, woodLight: blend(c, '#ffffff', 0.22), woodDark: blend(c, '#000000', 0.42) });

const YOU = { ...P, ...(LOOK.you !== LOOK_DEFAULTS.you ? body(LOOK.you) : {}) };

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

  changeling() {
    // A fairy child left in a human one's place, in the folklore the Grove's
    // forest comes from: a small cloaked figure with a borrowed pale face,
    // leaf ears, and a pointed hood that curls back to a gold tip. Invented
    // here, 2026-10-15, in place of the Changeling daily.
    const m = plinth(new Model());
    m.lathe([[2.5, 1.5], [2.1, 2.6], [1.5, 4.8], [1.0, 6.0]], [P.wood, P.wood, P.woodLight]); // cloak
    m.lathe([[1.3, 5.6], [1.5, 6.0], [1.0, 6.4]], P.moss, { seg: 8 });                     // collar of leaves
    m.ball(0, 7.4, 0.25, 1.5, P.cream, { seg: 8, rings: 6 });                              // the borrowed face
    m.ball(0.55, 7.6, 1.55, 0.32, P.eye, { seg: 5, rings: 3 });                            // eyes, too large
    m.ball(-0.55, 7.6, 1.55, 0.32, P.eye, { seg: 5, rings: 3 });
    m.ellipsoid(1.75, 7.7, -0.1, 0.22, 0.45, 1.15, P.moss, { rot: { rz: -0.7 } });          // leaf ears
    m.ellipsoid(-1.75, 7.7, -0.1, 0.22, 0.45, 1.15, P.moss, { rot: { rz: 0.7 } });
    m.cone(0, 8.0, -0.2, 1.75, 3.6, P.woodDark, { seg: 8, rot: { rx: -0.45 } });           // the hood
    m.ball(0, 11.0, -1.75, 0.42, P.gold, { seg: 6, rings: 4 });                            // its tip
    return m;
  },

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
  }),

  // --- Added 2026-10-10: smaller and stranger move sets. The shogi and chu
  // shogi generals and beasts are wedges like the silver general's, each
  // with its own mark; the rest are named for what they are.
  gold: () => shogi((m) => { // the gold general: a gold diamond over a bar
    m.box(0, 5.2, 0.75, 1.4, 1.4, 0.12, P.gold, { rz: Math.PI / 4 });
    m.box(0, 3.4, 0.75, 2.2, 0.4, 0.12, P.gold);
  }),
  copper: () => shogi((m) => { // the copper general: a copper chevron and post
    m.box(0, 3.8, 0.75, 0.35, 2.6, 0.12, '#c47a45');
    m.box(-0.55, 5.6, 0.75, 0.35, 1.5, 0.12, '#c47a45', { rz: -0.7 });
    m.box(0.55, 5.6, 0.75, 0.35, 1.5, 0.12, '#c47a45', { rz: 0.7 });
  }),
  leopard: () => shogi((m) => { // the ferocious leopard: spots
    for (const [x, y] of [[-0.8, 3.0], [0.7, 3.6], [-0.3, 4.8], [0.6, 5.9], [-0.7, 6.3]]) m.box(x, y, 0.75, 0.55, 0.55, 0.12, P.gold, { rz: 0.4 });
  }),
  tiger: () => shogi((m) => { // the blind tiger: stripes
    for (const y of [2.8, 4.0, 5.2]) m.box(0, y, 0.75, 2.6, 0.35, 0.12, '#d9822b', { rz: 0.25 });
  }),
  kirin() { // the kirin of chu shogi: a wedge with a horn
    const m = shogi((q) => { q.box(0, 4.2, 0.75, 1.6, 1.6, 0.12, P.cream, { rz: Math.PI / 4 }); });
    m.cone(0, 9.8, 0.1, 0.45, 2.0, P.gold, { seg: 5 });
    return m;
  },
  phoenix: () => shogi((m) => { // the phoenix of chu shogi: a flame
    m.box(0, 4.6, 0.75, 1.0, 2.6, 0.12, '#e0603a', { rz: Math.PI / 4 });
    m.box(0, 5.6, 0.8, 0.6, 1.6, 0.12, P.gold, { rz: Math.PI / 4 });
  }),
  elephant() { // the elephant (ferz and alfil) of modern variants: an elephant with a howdah
    const m = MODELS.alfil();
    m.box(0, 8.0, -0.6, 2.4, 1.3, 2.4, P.gold);
    m.box(0, 8.9, -0.6, 3.0, 0.3, 3.0, P.woodDark);
    return m;
  },
  woody() { // the woody rook: a short wooden tower
    const m = plinth(new Model());
    m.lathe([[2.7, 1.5], [2.3, 2.6], [2.3, 5.6], [2.9, 6.2], [2.9, 7.0]], [P.wood, P.woodLight, P.wood, P.wood]);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      m.box(Math.cos(a) * 2.1, 7.6, Math.sin(a) * 2.1, 1.3, 1.2, 1.3, P.woodDark, { ry: -a });
    }
    return m;
  },
  alibaba() { // the alibaba: a great jar, lid on
    const m = plinth(new Model());
    m.lathe([[1.8, 1.5], [2.9, 3.4], [3.0, 5.2], [2.2, 7.0], [1.3, 7.6], [1.6, 8.0]], [P.wood, P.wood, P.woodLight, P.wood, P.wood]);
    m.lathe([[1.7, 8.0], [1.2, 8.6], [0, 8.8]], P.gold, { seg: 8 });
    m.lathe([[3.05, 4.4], [3.05, 4.8]], P.moss, { seg: 10 });
    return m;
  },
  threeleaper() { // the threeleaper: a post with three rings, three squares at a leap
    const m = plinth(new Model());
    m.lathe([[0.6, 1.5], [0.6, 9.5]], P.woodDark, { seg: 6 });
    for (const y of [3.4, 5.6, 7.8]) m.lathe([[2.0, y], [2.0, y + 0.7]], P.wood, { seg: 10 });
    m.ball(0, 10.0, 0, 0.8, P.gold, { seg: 6, rings: 4 });
    return m;
  },
  tripper() { // the tripper: the same, its rings tipped, as it leaps on the diagonal
    const m = plinth(new Model());
    m.lathe([[0.6, 1.5], [0.6, 9.5]], P.woodDark, { seg: 6 });
    for (const y of [3.4, 5.6, 7.8]) m.lathe([[2.0, -0.35], [2.0, 0.35]], P.wood, { seg: 10, at: [0, y, 0], rot: { rz: 0.5, rx: 0.3 } });
    m.ball(0, 10.0, 0, 0.8, P.gold, { seg: 6, rings: 4 });
    return m;
  },
  frog() { // the frog: a frog
    const m = plinth(new Model());
    m.ellipsoid(0, 3.4, -0.2, 2.6, 1.8, 2.8, P.wood);        // body
    m.ellipsoid(0, 4.6, 1.6, 1.9, 1.3, 1.6, P.woodLight);    // head
    for (const sx of [1, -1]) {
      m.ball(sx * 1.1, 5.9, 1.9, 0.75, P.cream, { seg: 6, rings: 4 }); // eyes
      m.ball(sx * 1.25, 6.0, 2.5, 0.35, P.eye, { seg: 5, rings: 3 });
      m.ellipsoid(sx * 2.4, 2.2, -1.4, 0.9, 0.7, 1.8, P.woodDark); // back legs
      m.ellipsoid(sx * 1.6, 2.0, 2.2, 0.5, 0.6, 0.7, P.woodDark);  // front feet
    }
    return m;
  },
  vao() { // the vao: the cannon's diagonal twin, a cross on its carriage
    const m = MODELS.cannon();
    m.box(0, 3.9, 2.25, 2.4, 0.3, 0.12, P.gold, { rz: Math.PI / 4 });
    m.box(0, 3.9, 2.25, 2.4, 0.3, 0.12, P.gold, { rz: -Math.PI / 4 });
    return m;
  },
  // Timothy's two rooks (2026-10-13). The shape says the way each slides:
  // the tall rook is a tall, thin tower with a slit running up it; the
  // short rook is squat and wide, with a band running round it.
  tallrook() {
    const m = plinth(new Model());
    m.lathe([[2.4, 1.5], [1.7, 3.0], [1.6, 4.0], [1.6, 11.0], [2.3, 11.6], [2.3, 12.6]], [P.wood, P.moss, P.wood, P.wood, P.wood]);
    m.box(0, 7.4, 1.55, 0.4, 5.6, 0.16, P.woodDark);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      m.box(Math.cos(a) * 1.75, 13.2, Math.sin(a) * 1.75, 1.1, 1.2, 1.1, P.wood, { ry: -a });
    }
    return m;
  },
  shortrook() {
    const m = plinth(new Model());
    m.lathe([[3.3, 1.5], [3.0, 2.3], [3.0, 5.0], [3.5, 5.5], [3.5, 6.3]], [P.wood, P.wood, P.wood, P.wood]);
    m.lathe([[3.08, 3.3], [3.08, 3.9]], P.woodDark, { seg: 10 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      m.box(Math.cos(a) * 2.9, 6.9, Math.sin(a) * 2.9, 1.3, 1.2, 1.3, P.wood, { ry: -a });
    }
    return m;
  }
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
MODELS.rabbit = (fur = null) => rabbitShape(new Model(), fur);

/** The rabbit's shape, built into m, `lift` units up. */
function rabbitShape(m, fur = null, lift = 0) {
  const w = fur || '#f6f2ea', sh = fur ? shade(fur, 0.82) : '#ddd4c4', y = (v) => v + lift;
  m.ellipsoid(0, y(2.5), -0.3, 2.2, 2.3, 2.6, w);             // body
  m.ellipsoid(0, y(5.4), 1.5, 1.6, 1.5, 1.6, w);             // head
  for (const s of [1, -1]) {
    m.ellipsoid(s * 0.7, y(8.1), 1.0, 0.5, 2.0, 0.35, w, { rot: { rz: -s * 0.15 } });      // ears
    m.ellipsoid(s * 0.7, y(8.0), 1.3, 0.3, 1.5, 0.15, P.pink, { rot: { rz: -s * 0.15 } });
    m.ball(s * 1.05, y(5.8), 2.55, 0.3, P.eye, { seg: 6, rings: 4 });
    m.ellipsoid(s * 0.8, y(0.5), 1.9, 0.5, 0.45, 0.8, sh);     // front paws
  }
  m.ball(0, y(5.0), 3.1, 0.3, P.pink, { seg: 6, rings: 4 }); // nose
  m.ball(0, y(2.4), -2.9, 0.9, '#ffffff', { seg: 6, rings: 4 }); // tail
  return m;
}

// The rabbit as a chess piece (2026-10-11): the same rabbit, in its side's
// colour, on a plinth so it reads as a piece.
MODELS.bunny = () => rabbitShape(plinth(new Model()), P.woodLight, 1.4);

// The ball rolls rather than stands, so it has no plinth: a cream ball with a
// moss band, so it still reads as yours.
MODELS.ball = () => {
  const m = new Model();
  m.ball(0, 2.7, 0, 2.6, P.cream, { seg: 10, rings: 8 });
  m.lathe([[2.66, 2.4], [2.66, 3.0]], P.moss, { seg: 10 });
  return m;
};

// The first-turn cloud (2026-10-10): a low bank of white puffs over a
// square of the second row, gone once both sides have moved.
MODELS.cloud = () => {
  const m = new Model();
  for (const [x, y, z, r] of [[-2.2, 1.4, -1.0, 2.0], [1.9, 1.5, -1.3, 2.1], [0, 2.2, 0.4, 2.4], [-1.5, 1.2, 2.0, 1.7], [2.0, 1.1, 1.8, 1.6]])
    m.ellipsoid(x, y, z, r * 1.15, r * 0.7, r * 1.05, '#f4f6f8', { seg: 7, rings: 4 });
  m.ellipsoid(0.4, 3.2, -0.4, 1.4, 0.9, 1.3, '#ffffff', { seg: 6, rings: 4 });
  return m;
};

// A shield (2026-10-11), standing in front of a guarded piece: a heater
// shield, its face toward you. Silver when one piece guards it, gold when
// two or more do (2026-10-11, later).
const shieldModel = (face, rim) => {
  const m = new Model();
  m.box(0, 2.3, 0, 3.0, 2.4, 0.35, face);                       // the upper part
  m.box(0, 1.15, 0, 2.1, 2.1, 0.35, face, { rz: Math.PI / 4 });  // the point
  m.box(0, 3.55, 0.03, 3.3, 0.32, 0.42, rim);                    // rim: top
  for (const sx of [1, -1]) m.box(sx * 1.55, 2.35, 0.03, 0.32, 2.5, 0.42, rim);
  m.box(0, 2.2, 0.22, 0.42, 2.2, 0.08, rim);                     // the cross
  m.box(0, 2.75, 0.22, 1.7, 0.42, 0.08, rim);
  return m;
};
MODELS.shield = () => shieldModel('#cfd3da', '#8e96a3');
MODELS.shieldGold = () => shieldModel('#e8c048', '#fff0b0');

// A sewing needle (2026-10-13), driven down through a piece pinned to its
// King: bright steel, its point at the foot (y = 0), its eye up top with a
// red thread through it, so it reads at a glance among green and purple.
MODELS.needle = () => {
  const m = new Model(), steel = '#d3d9e0', light = '#f4f7fa', dark = '#7f8995';
  m.lathe([[0, 0], [0.34, 2.2], [0.34, 17.4], [0.5, 18.0], [0.5, 20.2], [0, 20.8]], [light, steel, steel, steel, light], { seg: 5 });
  m.box(0, 19.1, 0, 0.62, 1.5, 0.3, dark);                         // the eye
  m.box(0.9, 18.8, 0, 1.9, 0.26, 0.26, '#c8362e', { rz: -0.35 });   // the thread
  m.box(1.95, 17.6, 0, 0.26, 2.2, 0.26, '#c8362e', { rz: 0.25 });
  return m;
};

// Weapons (2026-10-13), held upright beside the piece that carries one: a
// sword, a lance (a long pole with a point), a mace (a spiked head on a
// handle). Gold pips at its foot count its level. Their foot is at y = 0.
MODELS.wSword = () => {
  const m = new Model(), steel = '#dfe5ec', edge = '#9aa6b3';
  m.box(0, 5.6, 0, 0.62, 6.4, 0.24, steel); m.box(0.18, 5.6, 0.05, 0.16, 6.4, 0.26, edge); // the blade
  m.cone(0, 8.8, 0, 0.36, 0.9, steel, { seg: 4 });                                       // its point
  m.box(0, 2.25, 0, 2.5, 0.42, 0.5, '#e3b84a');                                           // the guard
  m.box(0, 1.2, 0, 0.42, 1.7, 0.42, '#6b4628');                                           // the grip
  m.ball(0, 0.25, 0, 0.42, '#e3b84a', { seg: 6, rings: 4 });                              // the pommel
  return m;
};
MODELS.wLance = () => {
  const m = new Model();
  m.lathe([[0.26, 0], [0.3, 9.5]], '#9c6b3e', { seg: 5 });                                 // the pole
  m.lathe([[0.3, 9.5], [0.62, 10.0], [0, 12.6]], ['#e3e8ee', '#c5ccd5'], { seg: 5 });       // the point
  m.lathe([[0.25, 3.0], [1.2, 3.7], [0.3, 4.6]], ['#d9b25a', '#b08a3a'], { seg: 6 });       // the hand guard
  return m;
};
MODELS.wMace = () => {
  const m = new Model(), iron = '#6f747c';
  m.lathe([[0.28, 0], [0.3, 4.6]], '#6b4628', { seg: 5 });                                 // the handle
  m.ball(0, 5.6, 0, 1.15, iron, { seg: 7, rings: 5 });                                    // the head
  for (const [x, y, z] of [[1.2, 0, 0], [-1.2, 0, 0], [0, 1.2, 0], [0, 0, 1.2], [0, 0, -1.2], [0.85, 0.85, 0], [-0.85, 0.85, 0]])
    m.cone(x, 5.6 + y, z, 0.32, 0.8, '#b9bec5', { seg: 4, rot: { rz: -Math.atan2(x, y || 0.001), rx: Math.atan2(z, y || 1) } });
  return m;
};
// The net (Adventure, 2026-10-15): a bug net, a hoop strung with mesh on a
// wooden handle, its bag hanging behind.
MODELS.wNet = () => {
  const m = new Model(), wood = '#9c6b3e', hoop = '#c9a24a', mesh = '#f1ead8', inside = '#c9bfa6', R = 1.5, cy = 6.4;
  m.lathe([[0.26, 0], [0.28, cy]], wood, { seg: 5 });                                     // the handle
  // The hoop, tipped toward you, its rim on the handle's tip; the bag hangs
  // from it, with its inside showing through the mesh.
  m.group({ t: [0, cy, 0], rx: -0.6 }, () => {
    m.group({ t: [0, 0, R] }, () => {
      m.lathe([[R - 0.14, -0.13], [R + 0.14, -0.13], [R + 0.14, 0.13], [R - 0.14, 0.13], [R - 0.14, -0.13]], hoop, { seg: 14, caps: false });
      m.lathe([[R * 0.97, -0.05], [R * 0.8, -1.2], [R * 0.4, -2.2], [0.05, -2.6]], mesh, { seg: 10, caps: false });
      m.lathe([[0.05, -2.5], [R * 0.38, -2.1], [R * 0.77, -1.15], [R * 0.93, -0.06]], inside, { seg: 10, caps: false });
      for (const c of [-0.75, 0, 0.75]) {
        const half = Math.sqrt(R * R - c * c);
        m.box(c, 0, 0, 0.08, 0.08, half * 2, mesh);
        m.box(0, 0, c, half * 2, 0.08, 0.08, mesh);
      }
    });
  });
  return m;
};
MODELS.wPip = () => { const m = new Model(); m.box(0, 0.5, 0, 0.75, 0.75, 0.75, '#ffd75a', { rz: Math.PI / 4 }); return m; };
// Stunned (a mace, 2026-10-13): little stars in a ring over its head.
MODELS.stunStars = () => {
  const m = new Model(), gold = '#ffe066';
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, x = Math.cos(a) * 2.2, z = Math.sin(a) * 2.2;
    m.box(x, 0, z, 1.1, 0.34, 0.34, gold); m.box(x, 0, z, 0.34, 1.1, 0.34, gold);
    m.box(x, 0, z, 0.8, 0.8, 0.3, '#fff3b0', { rz: Math.PI / 4 });
  }
  return m;
};

// Neutral pieces (2026-10-13). A ghost: a sheet with a ragged hem and two
// dark eyes, pale in its side's colour (the trim of the side's palette), so
// you can tell whose wall it is.
MODELS.ghost = () => {
  // Kept low (it stands in front of the back row) and with a scalloped hem,
  // points of the sheet hanging down, so it does not read as a cloud.
  const m = new Model(), sheet = P.leaf, shadow = P.moss;
  m.lathe([[2.4, 1.0], [2.3, 2.4], [1.95, 4.4], [1.5, 5.6], [0.8, 6.5], [0, 6.8]], [shadow, sheet, sheet, sheet, sheet], { seg: 8 });
  for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * Math.PI * 2; m.ellipsoid(Math.cos(a) * 2.15, 0.7, Math.sin(a) * 2.15, 0.6, 0.55, 0.5, shadow, { seg: 5, rings: 3 }); }
  for (const sx of [1, -1]) m.ellipsoid(sx * 0.62, 4.9, 1.72, 0.34, 0.5, 0.18, P.eye, { seg: 6, rings: 3 });
  m.ellipsoid(0, 3.9, 1.95, 0.28, 0.36, 0.14, P.eye, { seg: 5, rings: 3 }); // a small round mouth
  return m;
};

// The shade a wandering cloud casts on the square under it (2026-10-13),
// so you can tell which square it covers from straight above.
MODELS.cloudShade = () => new Model().lathe([[3.6, 0.04], [3.6, 0.1]], '#8f9c93', { seg: 12 });

// A gate across its square (2026-10-13): two stone posts and an iron
// portcullis, raised as a wall when it is up, lying flat as a grating when
// it is down.
const gateModel = (up) => {
  const m = new Model(), post = '#7d7a72', iron = '#3e4249', rust = '#6b4b33';
  for (const sx of [1, -1]) { m.box(sx * 3.5, 4.2, 0, 1.1, 8.4, 1.1, post); m.box(sx * 3.5, 8.6, 0, 1.4, 0.5, 1.4, '#9a968c'); }
  if (up) {
    for (let i = -2; i <= 2; i++) m.box(i * 1.3, 4.0, 0, 0.35, 7.6, 0.35, iron);
    for (const y of [1.2, 4.0, 6.8]) m.box(0, y, 0, 6.2, 0.35, 0.4, iron);
    m.box(0, 0.25, 0, 6.2, 0.5, 0.5, rust);
  } else {
    for (let i = -2; i <= 2; i++) m.box(i * 1.3, 0.15, 0, 0.35, 0.25, 6.2, iron);
    for (const z of [-2.4, 0, 2.4]) m.box(0, 0.15, z, 6.2, 0.25, 0.35, iron);
  }
  return m;
};
MODELS.gateUp = () => gateModel(true);
MODELS.gateDown = () => gateModel(false);
MODELS.gate = MODELS.gateUp;

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
const FOE = { wood: '#6c4795', woodLight: '#9170bd', woodDark: '#3b2558', moss: '#e3d3f2', leaf: '#f1e7fa',
  ...(LOOK.foe !== LOOK_DEFAULTS.foe ? body(LOOK.foe) : {}) };
// Grey (2026-10-15): a piece in grey stone, for Adventure's pieces that never
// move (Timothy: "enemy pieces don't move, and they are gray like
// statues"). They are pieces to take, so they keep their piece's shape;
// the Grove's statues proper are standing stones of their own (below).
// A shade darker than the statue colour since 2026-10-15; a plain piece of
// yours in Adventure is this grey too, on your own plinth.
const GREY = { ...body(blend(LOOK.statue, '#000000', 0.16)), moss: '#c9ccc4', leaf: '#e2e4de', band: '#979a93', base: '#5f625c' };

// Statues (2026-10-07; they were stumps before) were any classic piece's
// shape in grey stone. Timothy, 2026-10-10: "statues should be a unique
// model, not like a gray version of another model." So a statue is now a
// standing stone of its own: no plinth (it is not a piece), a spiral cut in
// its face (the grove's motif), moss at its foot. The kind a level gave it
// (rules.js statueKind) picks one of three shapes, so a board's stones are
// not all alike.
const STONE = { stone: LOOK.statue, stoneLight: blend(LOOK.statue, '#ffffff', 0.18), stoneDark: blend(LOOK.statue, '#000000', 0.32),
  cut: blend(LOOK.statue, '#000000', 0.55), moss: '#5d7a45', mossLight: '#7c9a5a' };
const STATUE_SHAPE = { pawn: 0, king: 0, rook: 1, queen: 1, knight: 2, bishop: 2 };

function statue(kind) {
  const m = new Model(), S = STONE, v = STATUE_SHAPE[kind] ?? 0;
  // Rough footing: a few low rocks, half sunk.
  m.ellipsoid(0, 0.4, 0, 3.6, 0.9, 3.2, S.stoneDark, { seg: 7, rings: 3 });
  m.ellipsoid(-2.4, 0.5, 1.6, 1.1, 0.8, 1.0, S.stoneDark, { seg: 5, rings: 3 });
  // The stone itself, leaning a little, its top worn round.
  const [w, h, d, lean] = [[3.6, 9.0, 2.2, 0.08], [4.4, 6.4, 2.8, -0.05], [2.8, 10.6, 2.0, 0.12]][v];
  m.group({ t: [0, 0.6, 0], rz: lean }, () => {
    m.box(0, h / 2, 0, w, h, d, S.stone);
    m.box(0, h / 2, -d * 0.18, w * 1.04, h * 0.96, d * 0.7, S.stoneDark); // its weathered back
    m.ellipsoid(0, h, 0, w / 2, 1.2, d / 2, S.stoneLight, { seg: 8, rings: 3 });
    if (v === 1) m.box(w * 0.18, h * 0.62, 0, 0.25, h * 0.5, d * 1.02, S.cut, { rz: 0.5 }); // a crack
    // The spiral, cut into the face that looks at you.
    const cx = 0, cy = h * 0.58, turns = 2.2, n = 22, r0 = Math.min(w, h) * 0.34;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = t * turns * Math.PI * 2, r = 0.25 + t * r0;
      m.box(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d / 2 + 0.02, 0.42, 0.42, 0.12, S.cut);
    }
  });
  // Moss at its foot, on the side away from the light.
  m.ellipsoid(1.4, 1.0, 1.0, 1.4, 0.7, 1.0, S.moss, { seg: 6, rings: 3 });
  m.ellipsoid(-1.0, 0.9, 1.3, 0.9, 0.5, 0.7, S.mossLight, { seg: 5, rings: 3 });
  return m;
}

// For the catalog: a statue, as it stands on the board.
MODELS.statue = () => statue('rook');

// Looks by suit (Adventure, 2026-10-15). Timothy first asked for vines and
// suit colours, then for plain grey pieces with each suit's motif built into
// the model, then (the same day) "the new models for suits are a bit much,
// maybe start from scratch there. more tasteful this time". So a piece with
// no suit is plain pale grey, and each suit is the piece's own shape in its
// colours with one thing of the suit at its collar (see LOOK_BUILD).

/** The body colours of each look (moss and leaf are the pale trim the
    builders use for collars and bands). */
const SUIT_BODY = {
  // Plain: the grey of their statues (Timothy, 2026-10-15: "default pieces
  // should just be gray, not the white we have now. they can be the same
  // color as the statues"). Your plinth and gold finial stay yours.
  plain: { wood: GREY.wood, woodLight: GREY.woodLight, woodDark: GREY.woodDark, moss: GREY.moss, leaf: GREY.leaf },
  vines: { wood: P.wood, woodLight: P.woodLight, woodDark: P.woodDark, moss: P.moss, leaf: P.leaf },
  hearts: { wood: '#b52a43', woodLight: '#dc5a70', woodDark: '#6e1626', moss: '#f7c9d1', leaf: '#ffe3e8' },
  // Blue steel, so it is never taken for one of their grey statues.
  gears: { wood: '#6f7d92', woodLight: '#9fadc1', woodDark: '#3a4352', moss: '#cfd8e4', leaf: '#eef2f7' },
  spirals: { wood: '#e0782a', woodLight: '#f5a560', woodDark: '#8a4412', moss: '#fde0bf', leaf: '#fff0de' },
  stars: { wood: '#c9971e', woodLight: '#ecc552', woodDark: '#7a5a0c', moss: '#fff1b0', leaf: '#fff8d8' },
  // Stone (2026-10-15): sandstone, warm, never one of the greys.
  stone: { wood: '#c9a36b', woodLight: '#e3c18d', woodDark: '#86683c', moss: '#ead6b0', leaf: '#f4e7cc' },
  // A stone it left behind: the same, weathered darker.
  cairn: { wood: '#a3804f', woodLight: '#bf9c69', woodDark: '#664c2a', moss: '#cbb38a', leaf: '#ddc9a4' }
};

/** How far out the model's surface is at height y, toward angle a (from the
    corners near there), or null if nothing is near. */
function surface(pts, a, y) {
  let best = null;
  for (const p of pts) {
    if (Math.abs(p[1] - y) > 0.7) continue;
    const r = Math.hypot(p[0], p[2]);
    if (r < 0.2) continue;
    let d = Math.atan2(p[2], p[0]) - a;
    d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    if (d > 0.7) continue;
    const reach = r * Math.cos(d);
    if (best === null || reach > best) best = reach;
  }
  return best;
}

/** The model's corners, its top, and how far out it is all round at height
    y (the farthest corner near that height). */
function shapeOf(m) {
  const pts = m.tris.flatMap((t) => t.p), top = Math.max(...pts.map((p) => p[1]));
  const ring = (y) => Math.max(0.6, ...pts.filter((p) => Math.abs(p[1] - y) < 0.5).map((p) => Math.hypot(p[0], p[2])));
  return { pts, top, ring };
}

/** A leaf: a flat diamond from `at`, pointing out along angle a and up by
    `lift`, seen from both sides. */
function leaf(m, at, a, lift, size, col) {
  const out = [Math.cos(a), 0, Math.sin(a)], side = [-Math.sin(a), 0, Math.cos(a)];
  const tip = [at[0] + out[0] * size, at[1] + lift * size, at[2] + out[2] * size];
  const mid = [at[0] + out[0] * size * 0.5, at[1] + lift * size * 0.5, at[2] + out[2] * size * 0.5];
  const l = [mid[0] + side[0] * size * 0.32, mid[1] + 0.12, mid[2] + side[2] * size * 0.32];
  const r = [mid[0] - side[0] * size * 0.32, mid[1] + 0.12, mid[2] - side[2] * size * 0.32];
  m.tri(at, l, tip, col); m.tri(at, tip, l, col);
  m.tri(at, tip, r, col); m.tri(at, r, tip, col);
}

/** A hex colour as the renderer keeps it, [r, g, b]. */
const rgb3 = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const sameCol = (c, d) => c[0] === d[0] && c[1] === d[1] && c[2] === d[2];
// The trim and the gold of a piece, built in colours no piece uses, so a
// look can find its collar and its finial afterwards and make them its own.
const MARK_TRIM = '#010203', MARK_GOLD = '#030201';

/** Recolour every face of colour `from` to `to`. Mutates. */
function recolour(m, from, to) {
  const f = rgb3(from), t = rgb3(to);
  for (const tri of m.tris) if (sameCol(tri.c, f)) tri.c = t;
}

/** Where the piece's collar is (its trim band, or for a knight its mane):
    the height of it and how far out it reaches there. */
function collarOf(m) {
  const mark = rgb3(MARK_TRIM), pts = m.tris.filter((t) => sameCol(t.c, mark)).flatMap((t) => t.p);
  const { top, ring } = shapeOf(m);
  if (!pts.length) { const y = 1.5 + (top - 1.5) * 0.55; return { y, r: ring(y), front: ring(y) }; }
  const y = pts.reduce((a, p) => a + p[1], 0) / pts.length, all = shapeOf(m).pts;
  return { y, r: Math.max(...pts.map((p) => Math.hypot(p[0], p[2]))), front: surface(all, Math.PI / 2, y) ?? ring(y) };
}

/** Build a piece in a look's colours, with its trim and gold marked. */
function marked(build, body, plinthOf) {
  return withPalette({ ...YOU, ...body, moss: MARK_TRIM, gold: MARK_GOLD, ...plinthOf }, build);
}
/** Give the marked trim and gold their colours. Mutates; returns m. */
function finish(m, trim, gold) { recolour(m, MARK_TRIM, trim); recolour(m, MARK_GOLD, gold); return m; }

/** A heart in the round: two lobes over a cone pointing down, centred on
    `at`, size s. */
function heart3d(m, [x, y, z], s, col) {
  for (const sx of [-1, 1]) m.ball(x + sx * 0.42 * s, y + 0.22 * s, z, 0.55 * s, col, { seg: 8, rings: 5 });
  m.cone(x, y + 0.2 * s, z, 0.95 * s, 1.2 * s, col, { seg: 8, rot: { rz: Math.PI } });
}

/** A little star: six points from its middle. */
function sparkle(m, c, r, col) {
  for (const rot of [{}, { rz: Math.PI }, { rz: -Math.PI / 2 }, { rz: Math.PI / 2 }, { rx: Math.PI / 2 }, { rx: -Math.PI / 2 }])
    m.cone(c[0], c[1], c[2], r * 0.3, r, col, { seg: 4, rot });
}

/** Turn the model about its axis by k radians for every unit of height
    above the plinth: a twist. Mutates. */
function twist(m, k) {
  const turn = ([x, y, z], at) => { const a = k * Math.max(0, at - 1.6), c = Math.cos(a), s = Math.sin(a); return [x * c - z * s, y, x * s + z * c]; };
  for (const t of m.tris) {
    const was = t.n;
    t.p = t.p.map((p) => turn(p, p[1]));
    if (t.vn) t.vn = t.vn.map((n, i) => turn(n, t.p[i][1]));
    const u = [t.p[1][0] - t.p[0][0], t.p[1][1] - t.p[0][1], t.p[1][2] - t.p[0][2]], v = [t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1;
    n = n.map((q) => q / l);
    const mid = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3, w = turn(was, mid);
    t.n = n[0] * w[0] + n[1] * w[1] + n[2] * w[2] < 0 ? n.map((q) => -q) : n;
  }
  return m;
}

// Each look (2026-10-15, second go: Timothy, "the new models for suits are
// a bit much, maybe start from scratch there. more tasteful this time while
// integrating the idea of the suit into the model"): the piece's own shape
// in the suit's colours, and one thing of the suit made part of it, at its
// collar, where the trim already is: a wreath of leaves, a heart locket, a
// geared collar, a twist through the whole piece, a star brooch, carved
// bands. Its trim and its gold take the suit's accent.
const LOOK_BUILD = {
  plain: (m) => finish(m, GREY.moss, '#e3bd57'),
  vines: (m) => {
    const c = collarOf(m);
    finish(m, '#a8d77a', '#bfeb85');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      leaf(m, [Math.cos(a) * (c.r + 0.02), c.y + 0.15, Math.sin(a) * (c.r + 0.02)], a, -0.3, 1.35, k % 2 ? '#9ad85e' : '#c3ec8a');
    }
    return m;
  },
  hearts: (m) => {
    const c = collarOf(m);
    finish(m, '#f7c9d1', '#f2a7b5');
    heart3d(m, [0, c.y - 0.7, c.front + 0.3], 0.85, '#ffe4ea');
    return m;
  },
  gears: (m) => {
    const c = collarOf(m), brass = '#c9a24a';
    finish(m, brass, brass);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m.box(Math.cos(a) * (c.r + 0.16), c.y, Math.sin(a) * (c.r + 0.16), 0.34, 0.42, 0.3, brass, { ry: -a });
    }
    return m;
  },
  spirals: (m) => twist(finish(m, '#fff1dc', '#fff1dc'), 0.19),
  stars: (m) => {
    const c = collarOf(m);
    finish(m, '#fff3b8', '#fff8d8');
    sparkle(m, [0, c.y - 0.7, c.front + 0.45], 0.85, '#fffbe0');
    return m;
  },
  sandstone: (m) => finish(carved(m, 0), '#86683c', '#e3c18d'),
  cairn: (m) => finish(carved(m, 8), '#664c2a', '#bf9c69')
};

/** Stone: carved bands round it, and pebbles at its foot (a stone left on
    the board has them; a piece of Stone does not). */
function carved(m, pebbles = 5) {
  const { top, ring } = shapeOf(m), cut = '#6e5532';
  for (const f of [0.3, 0.6]) { const y = 1.5 + (top - 1.5) * f; m.lathe([[ring(y) + 0.06, y - 0.1], [ring(y) + 0.06, y + 0.1]], cut, { seg: 10, caps: false }); }
  for (let k = 0; k < pebbles; k++) {
    const a = k * 1.7 + 0.4, r = 3.1 + (k % 2) * 0.35;
    m.ellipsoid(Math.cos(a) * r, 1.7, Math.sin(a) * r, 0.42, 0.28, 0.36, k % 2 ? '#b8956a' : '#9c7b52', { seg: 6, rings: 3 });
  }
  return m;
}

/** The looks, and how each is made: built in its colours, then its motif. */
const SUIT_LOOK = Object.fromEntries(Object.entries(LOOK_BUILD).map(([k, fn]) => [k, (build, plinthOf) =>
  fn(marked(build, SUIT_BODY[k === 'sandstone' ? 'stone' : k], k === 'cairn' ? { band: '#bfa77e', base: '#7d6644' } : plinthOf))]));

// Theirs, with tactics (2026-10-15): their leader is purple, crowned in
// gold. (Sentries were statues with a red eye until Timothy made them a
// kind of rabbit, the same day: now a red rabbit lights a purple piece.)
const THEIR_LOOK = {
  crowned: (build) => {
    const m = withPalette({ ...YOU, ...FOE, band: '#f5c13a', base: '#8c6a12' }, build), { top } = shapeOf(m), gold = '#f5c13a';
    m.lathe([[1.1, top + 0.1], [1.1, top + 0.55]], gold, { seg: 10 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.cone(Math.cos(a) * 1.0, top + 0.55, Math.sin(a) * 1.0, 0.28, 0.75, gold, { seg: 4 }); m.ball(Math.cos(a) * 1.0, top + 1.35, Math.sin(a) * 1.0, 0.14, '#fff2b0', { seg: 4, rings: 3 }); }
    return m;
  }
};

/** The look for a piece of yours with this suit (or none): for
    model(kind, look). */
export const suitLook = (suit) => (suit === 'stone' ? 'sandstone' : SUIT_LOOK[suit] ? suit : 'plain');

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
  if (side === 'stone') { if (!cache.has(key)) cache.set(key, statue(kind)); return cache.get(key); }
  // Their sentries and leader (Adventure's tactics).
  if (THEIR_LOOK[side]) {
    if (!cache.has(key)) cache.set(key, THEIR_LOOK[side](MODELS[kind] || MODELS[LOOKS.get(kind)] || MODELS.pawn));
    return cache.get(key);
  }
  // A suit's look (Adventure): a piece of yours, in its suit's colours.
  if (SUIT_LOOK[side]) {
    if (!cache.has(key)) {
      const build = MODELS[kind] || MODELS[LOOKS.get(kind)] || MODELS.pawn;
      cache.set(key, SUIT_LOOK[side](build, glow ? { band: glow, base: shade(glow, 0.62) } : {}));
    }
    return cache.get(key);
  }
  if (!cache.has(key)) {
    // The rabbit inside colours the whole plinth: its fur on the band, a
    // darker shade of it underneath.
    const plinthOf = glow ? { band: glow, base: shade(glow, 0.62) } : {};
    const build = MODELS[kind] || MODELS[LOOKS.get(kind)] || MODELS.pawn;
    cache.set(key, withPalette({ ...(side === 'foe' ? FOE : side === 'grey' ? GREY : YOU), ...plinthOf }, build));
  }
  return cache.get(key);
}

// Tile Chess (Timothy, 2026-10-14): "every round you and your opponent pick
// a tile to reveal around the board, expanding its size. every tile also
// contains an icon with a suit or weapon upgrade on it, when flipped you
// get it ... the side that won the round gets the first pick of tile to
// flip. when the board reaches a new threshold of cell amount,
// corresponding to the amount that would be equal to a board size higher,
// each side is given a random new piece, both the same for each side."
//
// The board of a run, kept between rounds. Squares are in the first
// board's own coordinates (x across, y up from your home row), so a tile
// turned over below your row or left of the first file is at a negative
// x or y. Each round's level is the box round every open square, the rest
// of the box gaps (layout, below; lab.js makeLevel reads it as `tiles`).

import { SUITS, WEAPON_ORDER } from './run.js';

const key = (x, y) => `${x},${y}`;
const unkey = (k) => k.split(',').map(Number);
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Board sizes, one up from the last: the cell counts that bring a new
    piece to each side. Five by six is where a descent starts. */
export const SIZES = [[5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]];

/** A run's board to start from: w by h, every square open. */
export function newTiles(w, h) {
  const open = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) open.push(key(x, y));
  return { w, h, open, offers: {} };
}

/** The squares that could be turned over next: beside an open one, on
    one of its four sides, not open yet. */
export function frontier(t) {
  const open = new Set(t.open), out = new Set();
  for (const k of t.open) {
    const [x, y] = unkey(k);
    for (const [dx, dy] of SIDES) { const n = key(x + dx, y + dy); if (!open.has(n)) out.add(n); }
  }
  return [...out];
}

/** A tile's upgrade: a suit or a weapon, half and half. */
function draw(rand) {
  const suits = Object.keys(SUITS);
  return rand() < 0.5 ? { kind: 'suit', suit: suits[Math.floor(rand() * suits.length)] } : { kind: 'weapon', weapon: WEAPON_ORDER[Math.floor(rand() * WEAPON_ORDER.length)] };
}

/** Give every square that could be turned over its upgrade, once: what a
    tile holds is fixed from when it first shows. Mutates. */
export function fillOffers(t, rand) {
  for (const k of frontier(t)) if (!t.offers[k]) t.offers[k] = draw(rand);
}

/** Turn tile k over: it becomes board. Returns its upgrade. Mutates. */
export function flip(t, k) {
  const card = t.offers[k];
  t.open.push(k);
  delete t.offers[k];
  return card;
}

/** How many sizes up the board is: 0 at five by six, 1 once it has as many
    squares as six by seven (42), and so on. */
export function tier(n) {
  let k = 0;
  for (let i = 1; i < SIZES.length; i++) if (n >= SIZES[i][0] * SIZES[i][1]) k = i;
  return k;
}

/** The box round everything open, with room for what could be turned
    over (`margin` 1, for drawing the choice), or without (0, for a level). */
export function bounds(t, margin = 0) {
  const pts = [...t.open, ...(margin ? frontier(t) : [])].map(unkey);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** This round's board, for the level settings (lab.js `tiles`): the box
    round the open squares, which of its squares are open, the two home
    rows (where the first board's first and last rows are now), and the
    file the lines centre on. */
export function layout(t) {
  const { x0, y0, x1, y1 } = bounds(t), w = x1 - x0 + 1, h = y1 - y0 + 1;
  const open = t.open.map(unkey).map(([x, y]) => (y - y0) * w + (x - x0));
  return { w, h, open, home: [0 - y0, t.h - 1 - y0], cx: Math.floor((t.w - 1) / 2) - x0 };
}

/** Which tile their side turns over: one whose upgrade some piece of
    theirs can use, nearest their own side of the board; or any. */
export function foePick(t, canUse, rand) {
  const ks = Object.keys(t.offers);
  if (!ks.length) return null;
  const good = ks.filter((k) => canUse(t.offers[k]));
  const pool = good.length ? good : ks;
  // Nearer their home row (the first board's last row) first, then at random.
  const score = new Map(pool.map((k) => [k, Math.abs(unkey(k)[1] - (t.h - 1)) + rand()]));
  return pool.sort((a, b) => score.get(a) - score.get(b))[0];
}

export { key as tileKey, unkey as tileXY };

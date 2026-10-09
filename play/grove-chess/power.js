// How strong a piece is where it actually plays (Timothy, 2026-10-09:
// "pieces need to be ranked in their power based on the context of the mode
// that they're actually in"). Each piece's own strength (rules.js) is an
// estimate on an empty 8 by 8 board, where a cannon looks as good as a rook.
// It is not: a cannon can only take by hopping over something, and on a
// small board with few pieces there is seldom anything in the way.
//
// So here each piece is measured by its own move code, on the board it will
// play on, crowded the way levels are: from many spots, among a few pieces of
// each side and a statue or two. Two numbers come out of that:
// - reach: squares it can move to, on average;
// - threat: pieces of theirs it could take, on average.
// Power is threat counted four times over reach, scaled so the queen is 9 on
// that board, the way chess counts a queen as nine pawns. Captures weigh
// most because a level is won by a capture (their King).
//
// A piece that can never take anything without something to hop over
// (cannon, and kin) is "needs a screen": those are off by default, until a
// mode gives them a use.

import { PIECES, OFF, EMPTY, OWN, ENEMY, STUMP } from './rules.js';
import { rng } from '../../engine/seed.js';

const cache = new Map();

/** A piece's moves from (x, y) on a board described by `at(x, y)`. */
function movesAt(type, at, x, y, W, H) {
  const day = { W, H, rules: {}, stumps: new Set(), holes: new Set(), brambleAt: new Map() };
  try { return PIECES[type].moves(at, { x, y, type }, 1, day) || []; } catch { return []; }
}

/** Can it ever take a lone piece with nothing else on the board? */
function capturesAlone(type, W, H) {
  for (let px = 0; px < W; px++) for (let py = 0; py < H; py++) for (let ex = 0; ex < W; ex++) for (let ey = 0; ey < H; ey++) {
    if (px === ex && py === ey) continue;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? OFF : x === ex && y === ey ? ENEMY : EMPTY);
    if (movesAt(type, at, px, py, W, H).some((m) => m.cap && m.x === ex && m.y === ey)) return true;
  }
  return false;
}

/** Raw reach and threat of one piece on a W by H board, crowded. */
function sample(type, W, H, n = 240) {
  const rand = rng(`power:${type}:${W}x${H}`);
  let reach = 0, threat = 0;
  const crowd = Math.max(4, Math.round(W * H * 0.22)); // about a level's worth of pieces
  for (let k = 0; k < n; k++) {
    const grid = new Map(), put = (v) => { for (;;) { const c = Math.floor(rand() * W * H); if (!grid.has(c)) { grid.set(c, v); return c; } } };
    const me = put(OWN);
    for (let i = 0; i < crowd; i++) put(i < 2 ? STUMP : i % 2 ? ENEMY : OWN);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? OFF : grid.get(y * W + x) ?? EMPTY);
    for (const m of movesAt(type, at, me % W, Math.floor(me / W), W, H)) { if (m.cap) threat++; else reach++; }
  }
  return { reach: reach / n, threat: threat / n };
}

/**
 * Every playable piece's power on a W by H board: { type: { power, reach,
 * threat, screen } }, power scaled so the queen is 9.
 */
export function powers(W = 6, H = 6) {
  const key = `${W}x${H}`;
  if (cache.has(key)) return cache.get(key);
  const out = {};
  for (const k of Object.keys(PIECES)) {
    const P = PIECES[k];
    if (!P.moves || k === 'rabbit' || k === 'ball' || !['classic', 'fairy'].includes(P.kind) && !P.invented) continue;
    const { reach, threat } = sample(k, W, H);
    out[k] = { reach, threat, raw: reach + 4 * threat, screen: !capturesAlone(k, W, H) };
  }
  const q = out.queen?.raw || 1;
  for (const k of Object.keys(out)) out[k].power = Math.round((out[k].raw / q) * 9 * 4) / 4;
  cache.set(key, out);
  return out;
}

/** One piece's power on a W by H board (its 8 by 8 strength if unmeasured). */
export const powerOf = (type, W = 6, H = 6) => powers(W, H)[type]?.power ?? PIECES[type]?.strength ?? 3;

/** Pieces that cannot take anything without something to hop over. */
export const needsScreen = (W = 6, H = 6) => Object.keys(powers(W, H)).filter((k) => powers(W, H)[k].screen);

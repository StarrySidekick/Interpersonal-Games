// One board a day, the same on every phone.
//
// The date is fed to the shared seed (engine/seed.js), so every phone deals
// the identical board without asking anyone. Then a solver plays the board to
// find par, and a board that is too easy or too hard is thrown away and the
// next one is dealt. Because the random numbers come in the same order on
// every phone, they all throw away the same boards and land on the same one.
//
// WARNING: that also means any change to dealing, solving, the patterns or
// the piece list re-deals every board, past days included, and every old
// link then replays its moves on the wrong board. Once this is in people's
// chats, change it only behind a version (say, boards dealt before a cutover
// date use the old code).

import { rng } from '../../engine/seed.js';
import { PIECES, initialState, allMoves, apply, stateKey, MAX_MOVES } from './rules.js';

/** The rabbit's habits. Each is a list of hops that repeats. */
export const PATTERNS = [
  { name: 'Hopscotch', steps: [[0, 1], [0, 1], [1, 0]] },
  { name: 'Zigzag', steps: [[1, 1], [-1, 1]] },
  { name: 'Wobble', steps: [[-1, 0], [1, 0], [-1, 0], [1, 0], [0, 1]] },
  { name: 'Sidestep', steps: [[-1, 0], [1, 1]] },
  { name: 'Knight’s jig', steps: [[1, 2], [2, -1]] },
  { name: 'Long leap', steps: [[2, 0], [0, 2]] },
  { name: 'Corner run', steps: [[1, 1]] },
  { name: 'Box step', steps: [[1, 0], [0, 1], [-1, 0], [0, -1]] },
  { name: 'Spiral', steps: [[1, 0], [0, 1], [-1, 0], [-1, 0], [0, -1], [0, -1], [1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]] },
  { name: 'Two up, one back', steps: [[0, 2], [0, -1]] },
  { name: 'Skip', steps: [[2, 1], [-1, 1], [0, -1]] },
  { name: 'Drift', steps: [[1, 0], [1, 0], [0, 1], [-1, -1]] }
];

const CLASSIC = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'classic');
const FAIRY = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'fairy');

export const EPOCH = '2026-10-05';

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isDateStr(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

/** Rabbit #1 is the day this was built. */
export function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  const [ey, em, ed] = EPOCH.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
}

function pick(rand, list) { return list[Math.floor(rand() * list.length)]; }

/** The hand: at least one fairy piece, at most one strong piece, no repeats. */
function dealHand(rand) {
  const N = rand() < 0.5 ? 5 : 6;
  const count = N === 5 ? 3 : (rand() < 0.5 ? 3 : 4);
  const hand = [pick(rand, FAIRY)];
  let guard = 0;
  while (hand.length < count && guard++ < 100) {
    const k = pick(rand, rand() < 0.6 ? FAIRY : CLASSIC);
    if (hand.includes(k)) continue;
    if (PIECES[k].tier === 2 && hand.some((h) => PIECES[h].tier === 2)) continue;
    hand.push(k);
  }
  return { N, hand };
}

/** Where everything starts, for a given hand. */
function deal(rand, { N, hand }) {
  const taken = new Set();
  const free = (x, y) => !taken.has(y * N + x);
  const place = (rows) => {
    for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(rand() * N), y = pick(rand, rows);
      if (free(x, y)) { taken.add(y * N + x); return { x, y }; }
    }
    return null;
  };

  const pieces = hand.map((type) => ({ type, ...place([0, 1]) }));
  const top = []; for (let y = Math.ceil(N / 2); y < N; y++) top.push(y);
  const pat = pick(rand, PATTERNS);
  const rabbit = { ...place(top), mx: rand() < 0.5 ? 1 : -1, my: rand() < 0.75 ? 1 : -1 };

  const middle = []; for (let y = 1; y < N - 1; y++) middle.push(y);
  const stumps = new Set();
  if (rand() < 0.4) {
    const k = rand() < 0.5 ? 1 : 2;
    for (let i = 0; i < k; i++) { const s = place(middle); if (s) stumps.add(s.y * N + s.x); }
  }

  // The bramble: a seed square, then the order it will creep in. Fixed in
  // advance, so where it is depends only on how many moves have been made.
  const bramble = [];
  if (rand() < 0.5) {
    const seed = place(middle);
    if (seed) {
      bramble.push(seed.y * N + seed.x);
      const isIn = new Set(bramble);
      while (bramble.length < N) {
        const frontier = [];
        for (const sq of bramble) {
          const x = sq % N, y = Math.floor(sq / N);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, k = ny * N + nx;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N || isIn.has(k) || taken.has(k)) continue;
            if (!frontier.includes(k)) frontier.push(k);
          }
        }
        if (!frontier.length) break;
        const k = pick(rand, frontier);
        bramble.push(k); isIn.add(k);
      }
    }
  }

  return {
    N, pieces, rabbit,
    pattern: pat.steps, patternName: pat.name,
    stumps, bramble, brambleAt: new Map(bramble.map((sq, i) => [sq, i])), every: 2
  };
}

/**
 * Par: the fewest moves that catch the rabbit.
 *
 * Up to three moves deep it searches everything, every piece, so short
 * puzzles get an exact par. Past that, the full search grows too fast for a
 * phone (each extra move multiplies the positions by about twenty), so it
 * searches each piece on its own, with the others standing still. That is
 * always achievable, so par is never a lie. A cleverer line that moves two
 * pieces can sometimes beat it, which is called a birdie.
 */
export function solve(day) {
  const s0 = initialState(day);
  let layer = [s0];
  for (let depth = 1; depth <= 3; depth++) {
    const next = [], seen = new Set();
    for (const s of layer)
      for (const mv of allMoves(s)) {
        const n = apply(s, mv);
        if (n.caught) return depth;
        const k = stateKey(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    layer = next;
  }
  let best = Infinity;
  for (let i = 0; i < s0.pieces.length; i++) best = Math.min(best, solo(s0, i, Math.min(MAX_MOVES, best - 1)));
  return best === Infinity ? null : best;
}

function solo(s0, i, limit) {
  let layer = [s0];
  for (let depth = 1; depth <= limit; depth++) {
    const next = [], seen = new Set();
    for (const s of layer)
      for (const mv of allMoves(s)) {
        if (mv.p !== -1 && mv.p !== i) continue;
        const n = apply(s, mv);
        if (n.caught) return depth;
        const k = stateKey(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    layer = next;
  }
  return Infinity;
}

const days = new Map();

export function makeDay(date) {
  if (days.has(date)) return days.get(date);
  const rand = rng('grove:' + date);
  let day = null, fallback = null;
  // The hand is dealt first and then given many layouts to find a good one.
  // Dealing everything at once would quietly favour weak pieces, because
  // strong ones make most layouts too easy and get thrown away.
  for (let h = 0; h < 30 && !day; h++) {
    const hand = dealHand(rand);
    for (let attempt = 0; attempt < 80 && !day; attempt++) {
      const d = deal(rand, hand);
      if (d.pieces.some((p) => p.x === undefined) || d.rabbit.x === undefined) continue;
      const par = solve(d);
      if (par !== null && par >= 4 && par <= 7) day = { ...d, par };
      else if (par !== null && (!fallback || par > fallback.par)) fallback = { ...d, par };
    }
  }
  day = day || fallback;
  day.date = date;
  day.number = dayNumber(date);
  days.set(date, day);
  return day;
}

/** "up, up, right" for a list of hops, already turned the way it starts. */
export function describePattern(day) {
  const { mx, my } = day.rabbit;
  const word = (dx, dy) => {
    const parts = [];
    if (dy) parts.push((dy > 0 ? 'up' : 'down') + (Math.abs(dy) > 1 ? ' ' + Math.abs(dy) : ''));
    if (dx) parts.push((dx > 0 ? 'right' : 'left') + (Math.abs(dx) > 1 ? ' ' + Math.abs(dx) : ''));
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && dx && dy) return parts.join('-');
    return parts.join(' and ');
  };
  return day.pattern.map(([dx, dy]) => word(dx * mx, dy * my)).join(', ');
}

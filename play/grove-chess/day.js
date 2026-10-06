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
// link then replays its moves on the wrong board. So the dealer is
// versioned: each date is dealt by the version that was live when it came
// round, and a shipped version never changes. check-daily.mjs holds a
// fingerprint per version to prove it.
//
//   Version 1, 2026-10-05 and 06: stumps and bramble on some days.
//   Version 2, from 2026-10-07: neither. Some days the ground crumbles
//   instead: every square you move off falls away. (Superseded by version 3
//   before it dealt a single day; kept, and guarded, all the same.)
//   Version 3, from 2026-10-07: what the lab learned. Rabbits do not eat.
//   The ground is solid, crumbling, shrinking or shrinking in a spiral. And
//   a board must pass the lab's balance rules (solve.js).

import { rng, shuffled } from '../../engine/seed.js';
import { PIECES, initialState, allMoves, apply, stateKey, MAX_MOVES, DAILY_RULES } from './rules.js';
import { solveLevel, assess, unbalanced } from './solve.js';

/** The first date each dealer version deals. */
export const VERSIONS = [{ v: 1, from: '2026-10-05' }, { v: 2, from: '2026-10-07' }, { v: 3, from: '2026-10-07' }];
export const dealerFor = (date) => VERSIONS.filter((x) => date >= x.from).pop()?.v ?? 1;

/** Version 2: the share of days whose ground crumbles. */
const CRUMBLE_ODDS = 1 / 3;
const CRUMBLE_RULES = { ...DAILY_RULES, crumble: true };

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

/**
 * The day's fairy piece. Each block of twelve days shows all twelve once, in
 * a shuffled order, so none of them can quietly stop appearing. (Picking at
 * random let the strong ones vanish: they make most boards too easy, so their
 * boards kept getting thrown away.)
 */
export function fairyFor(date) {
  const n = dayNumber(date) - 1, block = Math.floor(n / 12);
  return shuffled(FAIRY, rng('fairy-block:' + block))[((n % 12) + 12) % 12];
}

/** The hand: the day's one fairy piece, the rest classic, at most one strong
    piece, no repeats. One strange piece a day is enough to learn. */
function dealHand(rand, fairy) {
  const N = rand() < 0.5 ? 5 : 6;
  const count = N === 5 ? 3 : (rand() < 0.5 ? 3 : 4);
  const hand = [fairy];
  let guard = 0;
  while (hand.length < count && guard++ < 100) {
    const k = pick(rand, CLASSIC);
    if (hand.includes(k)) continue;
    if (PIECES[k].tier === 2 && hand.some((h) => PIECES[h].tier === 2)) continue;
    hand.push(k);
  }
  return { N, hand };
}

/** Where your pieces and the rabbit start, and the rabbit's pattern. Both
    versions deal these the same way, drawing the same random numbers. */
function dealSides(rand, N, hand) {
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
  const level = {
    N, W: N, H: N, holes: new Set(), pieces, rabbit,
    // The same rabbit, in the shape the rules engine wants: one foe, marked
    // as the one to catch, moving by its pattern.
    foes: [{ type: 'rabbit', x: rabbit.x, y: rabbit.y, brain: 'pattern', pattern: pat.steps, mx: rabbit.mx, my: rabbit.my, target: true }],
    pattern: pat.steps, patternName: pat.name,
    stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2,
    rules: DAILY_RULES, ai: { skill: 0, style: 'balanced' }
  };
  return { level, taken, place };
}

/** Version 1: sometimes stumps, sometimes a creeping bramble. */
function dealV1(rand, { N, hand }) {
  const { level, taken, place } = dealSides(rand, N, hand);
  const middle = []; for (let y = 1; y < N - 1; y++) middle.push(y);
  const stumps = new Set();
  if (rand() < 0.4) {
    const k = rand() < 0.5 ? 1 : 2;
    for (let i = 0; i < k; i++) { const s = place(middle); if (s) stumps.add(s.y * N + s.x); }
  }

  // The bramble: a seed square, then the order it will creep in. Fixed in
  // advance, so where it is depends only on how many moves have been made.
  const bramble = [];
  if (rand() < 0.3) { // low on purpose: bramble boards pass the par filter more often
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

  return Object.assign(level, { stumps, bramble, brambleAt: new Map(bramble.map((sq, i) => [sq, i])) });
}

/** Version 2: a clear board, crumbling or not as the day says. */
function dealV2(rand, { N, hand }, crumble) {
  const { level } = dealSides(rand, N, hand);
  if (crumble) level.rules = CRUMBLE_RULES;
  return level;
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
        if (n.won) return depth;
        const k = stateKey(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    layer = next;
  }
  let best = Infinity;
  for (let i = 0; i < s0.pieces.length; i++) best = Math.min(best, solo(s0, i, Math.min(MAX_MOVES, best - 1)));
  return best === Infinity ? null : best;
}

function solo(s0, i, limit, cap = Infinity) {
  let layer = [s0];
  for (let depth = 1; depth <= limit; depth++) {
    const next = [], seen = new Set();
    fill: for (const s of layer)
      for (const mv of allMoves(s)) {
        if (mv.p !== -1 && mv.p !== i) continue;
        const n = apply(s, mv);
        if (n.won) return depth;
        const k = stateKey(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
        if (next.length >= cap) break fill;
      }
    layer = next;
  }
  return Infinity;
}

/**
 * Par for version 2. The same search as solve(), with two limits so it
 * always finishes quickly on a phone. On crumbling ground no two lines of
 * play leave the same squares behind, so positions stop repeating and the
 * search can no longer merge them; left alone it grows without end (one
 * board took 22 seconds). So each move's layer is cut off at SOLO_CAP
 * positions, always the same ones, and the search stops at 7 moves, the
 * most par is allowed to be. A cut-off search can miss the best line, never
 * invent one, so par stays a real, playable win.
 */
const SOLO_CAP = 3000;
function solveV2(day) {
  const s0 = initialState(day);
  let layer = [s0];
  for (let depth = 1; depth <= 3; depth++) {
    const next = [], seen = new Set();
    for (const s of layer)
      for (const mv of allMoves(s)) {
        const n = apply(s, mv);
        if (n.won) return depth;
        const k = stateKey(n);
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    layer = next;
  }
  let best = Infinity;
  for (let i = 0; i < s0.pieces.length; i++) best = Math.min(best, solo(s0, i, Math.min(7, best - 1), SOLO_CAP));
  return best === Infinity ? null : best;
}

const days = new Map();

/** The board for a date. `version` is for the guard, which deals every date
    with every version; the game always uses the one live on that date. */
export function makeDay(date, version = dealerFor(date)) {
  const key = version + ':' + date;
  if (days.has(key)) return days.get(key);
  const day = version === 1 ? dayV1(date) : version === 2 ? dayV2(date) : dayV3(date);
  day.date = date;
  day.number = dayNumber(date);
  day.version = version;
  days.set(key, day);
  return day;
}

/** Version 2: up to 20 hands of 60 layouts each, keeping the first with par
    4 to 7. Without stumps or bramble in the way most layouts can be won in
    3 or fewer, and with the strongest fairy pieces (squirrel, archbishop,
    nightrider, rose) nearly all of them can; on those days none passes and
    the hardest one found stands. It keeps dealing past 20 hands only if it
    has found nothing winnable at all. */
function dayV2(date) {
  const rand = rng('grove:' + date), fairy = fairyFor(date);
  // Whether the ground crumbles is decided for the day before anything is
  // dealt, so throwing layouts away cannot make it more or less common.
  const crumble = rng('crumble:' + date)() < CRUMBLE_ODDS;
  let day = null, fallback = null;
  for (let h = 0; !day && (h < 20 || !fallback); h++) {
    const hand = dealHand(rand, fairy);
    for (let attempt = 0; attempt < 60 && !day; attempt++) {
      const d = dealV2(rand, hand, crumble);
      if (d.pieces.some((p) => p.x === undefined) || d.rabbit.x === undefined) continue;
      const par = solveV2(d);
      if (par !== null && par >= 4 && par <= 7) day = { ...d, par };
      else if (par !== null && (!fallback || par > fallback.par)) fallback = { ...d, par };
    }
  }
  return day || fallback;
}

/** Version 3: the ground for the day (solid, crumbling, shrinking at
    random, or shrinking in a spiral), decided before anything is dealt. */
const GROUNDS = [['solid', 0.45], ['crumble', 0.2], ['shrink', 0.2], ['spiral', 0.15]];
function groundFor(date) {
  const r = rng('ground:' + date)();
  let acc = 0;
  for (const [g, p] of GROUNDS) { acc += p; if (r < acc) return g; }
  return 'solid';
}

/** Version 3: like version 2, plus the lab's developments. Rabbits do not
    eat: one that would land on your piece waits instead. The day's ground.
    And a board with par 4 to 7 must also pass the balance rules: every piece
    can move at the start, and the fairy piece has a job (it makes the catch
    in the solver's win, or the board is worse without it). The fast par
    search filters first; only boards that pass it get the slower check, and
    at most BALANCE_CHECKS of them: after that the first board with the right
    par stands, balanced or not. (Counted, not timed, so every phone stops at
    the same board. The cannon, which can only catch by jumping a screen, is
    the piece that most often runs out the count.) */
const BALANCE_CHECKS = 12;
// Note: this runs the lab's solver (solve.js), so changing that solver can
// change these boards. check-daily.mjs will say so; freeze a copy for
// version 3 at that point rather than let past days re-deal.
function dayV3(date) {
  const rand = rng('grove:' + date), fairy = fairyFor(date), ground = groundFor(date);
  const rules = { ...DAILY_RULES, rabbitsEat: false, crumble: ground === 'crumble',
    shrink: ground === 'shrink' ? 'random' : ground === 'spiral' ? 'spiral' : null, shrinkEvery: 2 };
  let day = null, fallback = null, checks = 0;
  for (let h = 0; !day && (h < 20 || !fallback); h++) {
    const hand = dealHand(rand, fairy);
    for (let attempt = 0; attempt < 60 && !day; attempt++) {
      const { level: d } = dealSides(rand, hand.N, hand.hand);
      if (d.pieces.some((p) => p.x === undefined) || d.rabbit.x === undefined) continue;
      Object.assign(d, { rules, shrinkKey: date, ground });
      const par = solveV2(d);
      if (par === null) continue;
      if (par >= 4 && par <= 7) {
        if (checks >= BALANCE_CHECKS) { day = { ...d, par }; break; }
        checks++;
        const res = solveLevel(d, { maxDepth: par + 1, budget: 8000 });
        const balanced = res.par && !unbalanced(assess(d, res, { budget: 4000 }), 'on').length;
        if (balanced) day = { ...d, par };
        else if (!fallback || fallback.par < 4) fallback = { ...d, par };
      } else if (!fallback || (fallback.par < 4 && par > fallback.par)) fallback = { ...d, par };
    }
  }
  return day || fallback;
}

/** Version 1, exactly as it shipped. */
function dayV1(date) {
  const rand = rng('grove:' + date);
  let day = null, fallback = null;
  // The hand is dealt first and then given many layouts to find a good one.
  // Dealing everything at once would quietly favour weak pieces, because
  // strong ones make most layouts too easy and get thrown away.
  const fairy = fairyFor(date);
  for (let h = 0; h < 30 && !day; h++) {
    const hand = dealHand(rand, fairy);
    for (let attempt = 0; attempt < 80 && !day; attempt++) {
      const d = dealV1(rand, hand);
      if (d.pieces.some((p) => p.x === undefined) || d.rabbit.x === undefined) continue;
      const par = solve(d);
      if (par !== null && par >= 4 && par <= 7) day = { ...d, par };
      else if (par !== null && (!fallback || par > fallback.par)) fallback = { ...d, par };
    }
  }
  return day || fallback;
}

/** "up, up, right" for the daily rabbit's hops, turned the way it starts. */
export function describePattern(day) {
  return describeSteps(day.pattern, day.rabbit.mx, day.rabbit.my);
}

/** "up, up, right" for any list of hops, turned by (mx, my). */
export function describeSteps(steps, mx = 1, my = 1) {
  const word = (dx, dy) => {
    const parts = [];
    if (dy) parts.push((dy > 0 ? 'up' : 'down') + (Math.abs(dy) > 1 ? ' ' + Math.abs(dy) : ''));
    if (dx) parts.push((dx > 0 ? 'right' : 'left') + (Math.abs(dx) > 1 ? ' ' + Math.abs(dx) : ''));
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && dx && dy) return parts.join('-');
    return parts.join(' and ');
  };
  return steps.map(([dx, dy]) => word(dx * mx, dy * my)).join(', ');
}

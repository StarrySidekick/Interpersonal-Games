// Adventure's boards, as rules (Timothy, 2026-10-17: "levels should be built
// based on a set of rules, not be the same every run. like hades or rogue
// legacy or balatro ... i want there to be a way for levels to be generated,
// you know, without Claude, just like using like a set of parameters like
// you would in a rogue like").
//
// Every board is made in the browser from these tables, the run's seed and
// the depth; none is made by hand. levelSettings (modes.js) reads them,
// makeLevel (lab.js) lays the board out, and the solver (solve.js) wins it
// before it is played. The method behind them is the level-design skill
// (.claude/skills/level-design/), and what they mean in play is
// docs/adventure-levels.md. In short:
//
// - Acts of five boards: an intro (lighter), two normal boards, an elite
//   (heavier) and a boss (one named rule, said before the board starts).
//   The next act opens below the last one's peak: a sawtooth, not a ramp
//   (Left 4 Dead's pacing, Balatro's antes).
// - A threat budget for each board, rising with depth. Each kind of rabbit
//   costs something; the board's pieces start as robots and are bought up
//   into dearer kinds with what is left (Dead Cells' monster budget).
// - Depth gates: a kind never turns up before its depth, and the first board
//   it can is its debut, where it is met beside sentries and traps only
//   (introduce, then develop: Nintendo's kishotenketsu).
// - Par stays Adventure's own (adventurePar, by depth), and every board is
//   still vetted by the solver.
// - Past the tables the budget keeps climbing and the dark comes sooner, so
//   a run always ends ("the game should get progressively harder until you
//   lose").

import { rng, shuffled } from '../../engine/seed.js';

/** Boards to an act, and what each place in an act is. */
export const ACT = 5;
export const SLOTS = ['intro', 'normal', 'normal', 'elite', 'boss'];
export const slotOf = (d) => SLOTS[(Math.max(1, d) - 1) % ACT];
export const actOf = (d) => Math.floor((Math.max(1, d) - 1) / ACT) + 1;

/** The rabbits of theirs. `cost` against a board's budget (a robot is the
    plain one, 1), `from` the first depth it can turn up, `max` the most on
    a board, `weight` how likely it is bought when it can be. Sentries and
    traps weigh most (Timothy, 2026-10-17: "we need sentry and trap rabbit
    early and more"); a scared rabbit is held to one, since a chase is a
    dead turn (Into the Breach). */
export const RABBIT_RULES = {
  robot: { cost: 1, from: 1 },
  sentry: { cost: 1.6, from: 1, weight: 3 },
  trap: { cost: 1.6, from: 2, weight: 3 },
  scared: { cost: 1.2, from: 3, weight: 1, max: 1 },
  simple: { cost: 1.6, from: 4, weight: 1.5 },
  sentient: { cost: 2.6, from: 10, weight: 1, max: 2 }
};

/** Suits their rabbits may carry, from these depths. (Hearts is dealt by
    count, as a second hit, from SUIT_FROM.hearts.) Each suit costs this
    much of what is left of the budget. */
export const SUIT_FROM = { hearts: 4, vines: 5, stars: 6, spirals: 8, gears: 10 };
export const SUIT_COST = 0.6;

/** Sizes to pick from, by depth ([from depth, sizes]). Small boards first
    (Timothy, 2026-10-17: "boards can start smaller that 5x5, down to 3x3"). */
export const SIZES = [[1, [3, 4]], [2, [3, 4, 4]], [3, [4, 4, 5]], [5, [4, 5, 5]], [6, [4, 5, 6]], [8, [5, 6, 6, 7]], [13, [6, 6, 7]], [18, [6, 7, 7]]];

/** Hedges ([from depth, fewest, most]), never more than an eighth of the
    squares (a quarter on the Hedge Maze). */
export const HEDGES = [[1, 0, 0], [2, 0, 1], [4, 1, 2], [8, 1, 3]];

/** The loops their robots may walk, from these depths. */
export const ROUTES_FROM = { Shuttle: 1, 'Box step': 3, Pace: 6 };

/** A board's threat budget: rising with depth, shaped by where it falls in
    its act. An intro is lighter, an elite heavier. */
export const SLOT_MULT = { intro: 0.75, normal: 1, elite: 1.3, boss: 1.15 };
export const budgetOf = (d) => (3.6 + 0.6 * (Math.max(1, d) - 1)) * SLOT_MULT[slotOf(d)];

/** How many moves past par the dark comes: a double bogey, then sooner, so
    that deep down a run cannot go on for ever. */
export const darkAfter = (d) => (d < 16 ? 2 : d < 26 ? 1 : 0);

/** Boss boards: the last of each act, each one rule, said before the board
    (Balatro's boss blinds). `from` the first depth it can come; each run
    draws them from a bag, none twice until all have come. `apply` changes
    the board's recipe. A boss board pays one card more. */
export const BOSSES = [
  { id: 'maze', name: 'The Hedge Maze', line: 'Twice the hedges.', from: 5, apply: (r) => { r.hedgeShare = 4; r.hedges = Math.max(2, r.hedges * 2); } },
  { id: 'wall', name: 'The Sentry Wall', line: 'Every piece of theirs is a sentry or a trap.', from: 5, apply: (r) => { r.walls = true; } },
  { id: 'court', name: 'The Court of Hearts', line: 'Every piece of theirs has two lives.', from: 5, apply: (r) => { r.allHearts = true; } },
  { id: 'thimble', name: 'The Thimble', line: 'A board a size smaller, as many of theirs.', from: 5, apply: (r) => { r.size = Math.max(3, r.size - 1); } },
  { id: 'hurry', name: 'The Hurry', line: 'The dark comes at par.', from: 5, apply: (r) => { r.darkAfter = 0; } },
  { id: 'stars', name: 'The Star Chamber', line: 'Every piece of theirs has Stars: walkers take two steps a turn.', from: 10, apply: (r) => { r.starWalkers = true; } }
];

/** The boss of board d in the run with this seed, or null (not a boss board,
    or no run seed, as for the daily). */
export function bossFor(d, runSeed) {
  if (runSeed == null || slotOf(d) !== 'boss') return null;
  const order = shuffled(BOSSES, rng(`boss:${runSeed}`)), used = [];
  let pick = null;
  for (let b = ACT; b <= d; b += ACT) {
    // A fresh bag once every boss that can come has come.
    const can = order.filter((x) => x.from <= b);
    if (can.every((x) => used.includes(x.id))) used.length = 0;
    pick = can.find((x) => !used.includes(x.id)) || can[0];
    used.push(pick.id);
  }
  return pick;
}

const at = (table, d) => { let v = table[0]; for (const row of table) if (d >= row[0]) v = row; return v; };

/**
 * The recipe for board d: everything levelSettings needs to make it, before
 * the pieces are counted. `rand` rolls; `theirs` is how many pieces of theirs
 * the board's par asks for (levelSettings works that out from par).
 * Returns { slot, act, boss, size, hedges, hedgeShare, routes, darkAfter,
 * kinds: { robot, sentry, ... }, suitKinds, suitChance, walls, allHearts,
 * starWalkers }.
 */
export function recipe(d, rand, { runSeed = null, size: given = null } = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const [, lo, hi] = at(HEDGES, d);
  const r = {
    slot: slotOf(d), act: actOf(d), boss: bossFor(d, runSeed), budget: budgetOf(d),
    size: given ?? pick(at(SIZES, d)[1]), hedges: int(lo, hi), hedgeShare: 8,
    routes: Object.keys(ROUTES_FROM).filter((k) => ROUTES_FROM[k] <= d), darkAfter: darkAfter(d),
    suitKinds: Object.keys(SUIT_FROM).filter((k) => k !== 'hearts' && SUIT_FROM[k] <= d)
  };
  r.boss?.apply(r);
  return r;
}

/**
 * Spend a board's budget on its `theirs` pieces: all robots to begin with,
 * then bought up, one at a time, into a dearer kind the depth allows, by
 * weight, while the budget lasts. One at least stays a robot, unless the
 * boss says every one is a sentry or a trap. A kind on its debut (the depth
 * it can first come) is bought first, and met only beside sentries and traps. What is
 * left of the budget buys suits. Returns { kinds, suitChance }.
 */
export function spend(r, d, theirs, rand) {
  const kinds = { robot: theirs, sentry: 0, trap: 0, scared: 0, simple: 0, sentient: 0 };
  if (r.walls) {
    kinds.robot = 0; kinds.sentry = Math.ceil(theirs / 2); kinds.trap = theirs - kinds.sentry;
    if (d < RABBIT_RULES.trap.from) { kinds.sentry = theirs; kinds.trap = 0; }
    return { kinds, suitChance: 0 };
  }
  let left = r.budget - theirs * RABBIT_RULES.robot.cost;
  const open = Object.keys(RABBIT_RULES).filter((k) => k !== 'robot' && RABBIT_RULES[k].from <= d);
  const debut = open.filter((k) => RABBIT_RULES[k].from === d);
  const buy = (k) => { const c = RABBIT_RULES[k].cost - RABBIT_RULES.robot.cost; kinds[k]++; kinds.robot--; left -= c; };
  const can = (k) => kinds.robot > 1 && kinds[k] < (RABBIT_RULES[k].max ?? 99) && RABBIT_RULES[k].cost - RABBIT_RULES.robot.cost <= left + 0.001;
  // The debut first, even a little over budget: a new kind must be met.
  for (const k of debut) if (kinds.robot > 1) buy(k);
  const pool = debut.length ? [...new Set([...debut, 'sentry', 'trap'])].filter((k) => open.includes(k)) : open;
  for (;;) {
    const ok = pool.filter(can);
    if (!ok.length) break;
    const total = ok.reduce((t, k) => t + (RABBIT_RULES[k].weight || 1), 0);
    let roll = rand() * total, k = ok[0];
    for (const c of ok) { roll -= RABBIT_RULES[c].weight || 1; if (roll <= 0) { k = c; break; } }
    buy(k);
  }
  // Suits with what is left, as a chance each piece carries one.
  const suitChance = r.suitKinds.length ? Math.max(0, Math.min(70, Math.round((100 * Math.max(0, left)) / (SUIT_COST * Math.max(1, theirs))))) : 0;
  return { kinds, suitChance };
}

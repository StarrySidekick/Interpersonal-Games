// Piece trials (Timothy, 2026-10-13): "i want to be able to test pieces and
// see what they do to games when added or shuffled ... choose what chess
// pieces are in, choose the size of the board, then you calculate the board
// layout that would make the games balanced and then test to see if the game
// would be "fun" and engaging to any extent and if there even is an
// orientation of pieces that is playable with that selection of pieces."
//
// Since the second pass the same day, the games are the real game: every
// layout is made into a level (lab.js makeLevel, square by square) and played
// by the one bot of sim.js, on rules.js, so any rule, suit or neutral piece a
// level can have is in the trial too. (The first pass had a small engine of
// its own; one set of rules is better than two that can disagree.)
//
// How a trial goes:
//
// 1. Layouts. Every distinct way to stand the army on its back row (two rows
//    if it needs them). Pieces that can never move back (a pawn) stand in
//    front, as in chess; two or more of a piece that keeps to one colour of
//    square (a bishop) stand on both colours, as Chess960 insists. The King is
//    on the back row. A layout and its mirror image are one game. Their side
//    is the same army, mirrored (each piece opposite its twin), turned (read
//    the other way), or in any order of its own.
// 2. Checks, cheap ones first: can anything be taken on the very first move
//    (the balance rule since 2026-10-07)? Can you, moving first, take their
//    King by force within three moves?
// 3. A screen: a few quick games of each, between quick bots.
// 4. A climb. The best few are improved step by step: two pieces swap
//    places, and a swap that screens better is kept. This is hill climbing,
//    the plainest local search; it finds good layouts among millions without
//    trying them all. (The first pass drew layouts at random, and among the
//    65 million ways to stand a chess army it never once drew chess.)
// 5. Judging: more games between equal bots, and some between a bot that
//    looks further ahead and one that does not, scored by the measures below.
//
// The measures are Cameron Browne's idea: his program Ludi (2008) invented
// board games and judged them by self-play against measures like these, and
// one game it invented, Yavalath, is published and still played. They are a
// bot's guesses, not truths: play the layouts that look good.
//
// The work is split into jobs (`runJob`) a pool of workers can run side by
// side (sim-worker.js); the trial itself is a coordinator that hands them
// out and waits (`runTrial`, `runWeave`), on the page or in node.

import { PIECES, OFF, EMPTY, initialState, firstCaptures } from './rules.js';
import { makeLevel, defaults } from './lab.js';
import { playGame, forcedWin } from './sim.js';
import { rng, shuffled } from '../../engine/seed.js';

/** Pieces that can stand in a trial: every chess and fairy piece with moves
    of its own, invented ones too. Not the rabbit (it rides heads), the ball,
    the loose rabbit, or the neutral pieces (they belong to nobody). */
export const trialPiece = (k) => !!PIECES[k] && !!PIECES[k].moves && (['classic', 'fairy'].includes(PIECES[k].kind) || PIECES[k].invented) && k !== 'bunny';

// --- What kind of piece it is, from its moves on an empty board. -----------

const N = 7, EMPTY_BOARD = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? OFF : EMPTY), DAY = { W: N, H: N, rules: {} };
const movesFrom = (t, x, y) => PIECES[t].moves(EMPTY_BOARD, { x, y, type: t }, 1, DAY);
const memo = (f) => { const m = new Map(); return (k) => (m.has(k) ? m.get(k) : (m.set(k, f(k)), m.get(k))); };

/** Can it ever move back toward its own side? A pawn cannot. */
export const retreats = memo((t) => movesFrom(t, 3, 3).some((m) => m.y < 3));
/** Does it keep to one colour of square, as a bishop does? */
export const colourBound = memo((t) => { const ms = movesFrom(t, 3, 3); return ms.length > 0 && ms.every((m) => (m.x + m.y) % 2 === 0); });
/** Does it move the same way mirrored left to right? */
const symmetric = memo((t) => [[3, 3], [1, 2], [5, 4]].every(([x, y]) => {
  const a = new Set(movesFrom(t, x, y).map((m) => `${N - 1 - m.x},${m.y}`)), b = movesFrom(t, N - 1 - x, y).map((m) => `${m.x},${m.y}`);
  return a.size === b.length && b.every((q) => a.has(q));
}));

// --- Armies and layouts. -----------------------------------------------------
// An army is a list of { t, suit }. Two pieces are alike only when they are
// the same kind with the same suit.

const keyOf = (a) => (a ? a.t + (a.suit ? `:${a.suit}` : '') : '.');
const asItem = (k) => (k === '.' ? null : { t: k.split(':')[0], ...(k.includes(':') ? { suit: k.split(':')[1] } : {}) });

/** How many distinct orderings of these keys there are. */
function arrangements(keys) {
  const count = {};
  for (const k of keys) count[k] = (count[k] || 0) + 1;
  let n = 1;
  for (let i = 2; i <= keys.length; i++) n *= i;
  for (const c of Object.values(count)) for (let i = 2; i <= c; i++) n /= i;
  return n;
}

/** Every distinct ordering of a list with repeats, in dictionary order
    (Narayana Pandita's next-permutation, 14th century). */
function* permutations(keys) {
  const a = keys.slice().sort();
  yield a.slice();
  for (;;) {
    let i = a.length - 2;
    while (i >= 0 && a[i] >= a[i + 1]) i--;
    if (i < 0) return;
    let j = a.length - 1;
    while (a[j] <= a[i]) j--;
    [a[i], a[j]] = [a[j], a[i]];
    a.splice(i + 1, a.length - i - 1, ...a.slice(i + 1).reverse());
    yield a.slice();
  }
}

/** Which row each piece of the army goes in: the back row first. With
    `pawnsFront`, pieces that can never move back go in front. Returns
    [back keys, front keys] (front empty for one row). */
function rowsOf(army, W, rows, pawnsFront) {
  if (rows === 1) return [army.map(keyOf), []];
  const fwd = pawnsFront ? army.filter((a) => !retreats(a.t)) : [], rest = army.filter((a) => !fwd.includes(a));
  // The King, and whatever else retreats, at the back; overflow either way.
  let back = rest.slice(), front = fwd.slice();
  while (back.length > W) front.push(back.splice(back.findIndex((a) => a.t !== 'king'), 1)[0]);
  while (front.length > W) back.push(front.pop());
  return [back.map(keyOf), front.map(keyOf)];
}

const pad = (keys, W) => [...keys, ...Array(Math.max(0, W - keys.length)).fill('.')];

/** Do the copies of each colour-bound piece stand on both colours? */
function coloursSpread(cells, W, side, H) {
  const by = {};
  cells.forEach((k, i) => {
    if (k === '.' || !colourBound(k.split(':')[0])) return;
    const x = i % W, r = Math.floor(i / W), y = side === 'you' ? r : H - 1 - r;
    (by[k] = by[k] || new Set()).add((x + y) % 2);
  });
  return Object.entries(by).every(([k, set]) => cells.filter((c) => c === k).length < 2 || set.size === 2);
}

/**
 * The layouts of an army: arrays of W * rows keys (the back row first,
 * '.' an empty square). The King stands on the back row; a layout and its
 * reflection count once (when every piece is symmetric). Up to `cap`, drawn
 * evenly from all of them when there are more.
 */
export function layouts(army, W, H, rows, { cap = 60, seed = 1, pawnsFront = true, spread = true } = {}) {
  const [back, front] = rowsOf(army, W, rows, pawnsFront);
  if (back.length > W || front.length > W) return { list: [], total: 0 };
  const B = pad(back, W), F = rows > 1 ? pad(front, W) : [];
  const sym = army.every((a) => symmetric(a.t)), rand = rng(`trials:layouts:${seed}`);
  const mirror = (c) => c.map((_, i) => c[Math.floor(i / W) * W + (W - 1 - (i % W))]);
  const seen = new Set(), list = [];
  const add = (c) => {
    if (army.some((a) => a.t === 'king') && !c.slice(0, W).some((k) => k.startsWith('king'))) return;
    if (spread && !coloursSpread(c, W, 'you', H)) return;
    const k = c.join(), m = sym ? mirror(c).join() : k, id = k < m ? k : m;
    if (seen.has(id)) return;
    seen.add(id); list.push(c);
  };
  const nB = arrangements(B), nF = rows > 1 ? arrangements(F) : 1, n = nB * nF;
  if (n <= 20000) {
    const fronts = rows > 1 ? [...permutations(F)] : [[]];
    for (const b of permutations(B)) for (const f of fronts) add([...b, ...f]);
  } else for (let k = 0; k < cap * 40 && list.length < cap * 4; k++) add([...shuffled(B, rand), ...(rows > 1 ? shuffled(F, rand) : [])]);
  return { list: list.length > cap ? shuffled(list, rand).slice(0, cap) : list, total: n <= 20000 ? list.length : null, n };
}

/** The army in the order given, centred row by row, with the same row rule
    as the layouts (so pawns given anywhere still stand in front). */
export function givenCells(army, W, rows, pawnsFront = true) {
  const [back, front] = rowsOf(army, W, rows, pawnsFront), out = Array(W * rows).fill('.');
  // Each row keeps the order the army was given in.
  const order = (keys) => army.map(keyOf).filter((k, i, a) => keys.includes(k) && a.slice(0, i).filter((q) => q === k).length < keys.filter((q) => q === k).length);
  const put = (keys, r) => { const at = Math.floor((W - keys.length) / 2); keys.forEach((k, i) => { out[r * W + at + i] = k; }); };
  put(order(back), 0);
  if (rows > 1) put(order(front), 1);
  return out;
}

/** Their cells, from yours: mirrored (the same files) or turned (each row
    read the other way). */
export const facingCells = (cells, W, facing) => (facing === 'turned' ? cells.map((_, i) => cells[Math.floor(i / W) * W + (W - 1 - (i % W))]) : cells.slice());

/** Both sides' cells as level settings: cells, cellMods, foeCells, foeCellMods. */
export function cellSettings(cells, foeCells) {
  const types = (c) => c.map((k) => (k === '.' ? null : k.split(':')[0]));
  const mods = (c) => c.map((k) => { const it = asItem(k); return it?.suit ? { suit: it.suit, ...(it.suit === 'hearts' ? { lives: 2 } : {}) } : {}; });
  return { cells: types(cells), cellMods: mods(cells), foeCells: types(foeCells), foeCellMods: mods(foeCells) };
}

/** A trial's level settings for a layout: the rules asked for, both sides
    square by square, their side thinking, take their King. */
export function settingsFor(spec, cells, foeCells) {
  return {
    ...defaults(), ...(spec.rules || {}),
    w: spec.W, h: spec.H, ...cellSettings(cells, foeCells),
    darkBrain: 'think', goal: 'king', royal: true, dealKing: false, fullRow: false, arrange: false, solve: false, mode: 'hand', variant: 'none',
    // The level's own move limit, as the rules asked; with none, room enough to finish.
    maxMoves: spec.maxMoves || spec.rules?.maxMoves || Math.max(30, Math.round(spec.W * spec.H * 1.5)),
    ...(spec.invented?.length ? { invented: spec.invented } : {})
  };
}

// --- Jobs: the work a worker does. --------------------------------------------

/** One job: { type: 'check', settings } -> { opening, forced }, or
    { type: 'games', settings, seeds, bots, keepLine } -> game records. Each
    game is played on the level made with its own seed, so what a level
    draws at random (the order statues open, where clouds drift) differs
    from game to game. */
export function runJob(job) {
  if (job.type === 'check') {
    const L = makeLevel(job.settings, job.levelSeed ?? 1), o = firstCaptures(initialState(L));
    return { opening: { first: o.yours.length, second: o.theirs.length }, forced: forcedWin(L, 3, job.forcedNodes || 40000) };
  }
  return job.seeds.map((seed) => {
    // A level dealt from its settings keeps one layout (levelSeed); a trial's
    // layout is fixed square by square, and each game draws its own extras.
    const L = makeLevel(job.settings, job.levelSeed ?? seed);
    const g = playGame(L, job.bots, { seed, maxPlies: job.maxPlies || 2 * (L.rules.maxMoves || 60) + 4 });
    return job.keepLine ? { ...g, seed } : { ...g, seed, line: g.line.slice(0, 6) };
  });
}

// --- Measures. --------------------------------------------------------------------

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** 1 inside [lo, hi], falling off to 0 at half lo and twice hi. */
const band = (x, lo, hi) => (x < lo ? clamp((x - lo / 2) / (lo / 2)) : x > hi ? clamp(1 - (x - hi) / hi) : 1);
const useKey = (u) => u.t + (u.suit ? `:${u.suit}` : '');
const stepKey = (st) => (st.you ? `y${st.you.p},${st.you.x},${st.you.y}` : st.foe ? `f${st.foe.k},${st.foe.x},${st.foe.y}` : 'f-');

/**
 * How a layout plays, from its games: `games` between equal bots, `skill`
 * games between a stronger and a weaker bot (each { game, strong }), and
 * the checks. Every measure is 0 to 100; `fun` puts them together;
 * `verdict` is 'playable', 'shaky' or 'broken', with `why` in plain words.
 */
export function judge({ W, H }, games, skill = [], { forced = 'no', opening = null } = {}) {
  const n = games.length, first = games.filter((g) => g.winner === 0).length, second = games.filter((g) => g.winner === 1).length, decided = first + second;
  // A few games prove little: two wins out of two is luck as often as not.
  // So the first side's share is taken by Laplace's rule of succession (one
  // more win for each side than was seen), which pulls a small sample toward
  // even: 2 of 2 reads as 3 in 4, 8 of 8 as 9 in 10.
  const share = (first + 1) / (decided + 2);
  const balance = 100 * (1 - 2 * Math.abs(share - 0.5));
  const decisive = 100 * (n ? decided / n : 0);
  const won = games.filter((g) => g.winner !== null);
  const avgPlies = won.length ? won.reduce((a, g) => a + g.plies, 0) / won.length : games.reduce((a, g) => a + g.plies, 0) / Math.max(1, n);
  const cells = W * H;
  const length = 100 * band(avgPlies, Math.max(10, cells * 0.5), Math.max(24, cells * 1.8));
  // Drama: how often the lead (by at least a pawn) changes hands in a game,
  // and how often the winner was behind at some point (a comeback).
  let swaps = 0, comebacks = 0, late = 0;
  for (const g of games) {
    let side = 0;
    for (const v of g.lead) { const now = v >= 1 ? 1 : v <= -1 ? -1 : 0; if (now && side && now !== side) swaps++; if (now) side = now; }
    if (g.winner !== null) {
      const sign = g.winner === 0 ? 1 : -1;
      if (g.lead.some((v) => sign * v <= -1)) comebacks++;
      // Uncertainty: when the winner went ahead for good, as a share of the game.
      let k = g.lead.length;
      while (k > 0 && sign * g.lead[k - 1] >= 1) k--;
      late += g.lead.length ? k / g.lead.length : 0;
    }
  }
  const drama = 100 * clamp(0.6 * (swaps / Math.max(1, n)) / 1.2 + 0.4 * (comebacks / Math.max(1, decided)) / 0.35);
  const uncertainty = 100 * (decided ? clamp((late / decided) / 0.7) : 0);
  // Skill: does the stronger bot win? A game the better player usually wins
  // rewards getting better at it (the mastery path).
  const sk = skill.length ? skill.reduce((a, x) => a + (x.game.winner === x.strong ? 1 : x.game.winner === null ? 0.5 : 0), 0) / skill.length : null;
  const skillScore = sk === null ? null : 100 * clamp((sk - 0.5) / 0.4);
  // Every piece has a part: the share of games in which each kind moved.
  const kinds = {};
  for (const g of games) for (const u of g.use) {
    const k = useKey(u), b = (kinds[k] = kinds[k] || { moved: 0, n: 0, took: 0, lost: 0, moves: 0 });
    b.n++; if (u.moved) b.moved++; b.took += u.took; if (u.lost) b.lost++; b.moves += u.moved;
  }
  // Per piece of that kind, per game: the share that moved at all, captures, the share taken, moves made.
  const pieceUse = Object.fromEntries(Object.entries(kinds).map(([k, b]) => [k, { moved: b.moved / b.n, took: b.took / b.n, lost: b.lost / b.n, moves: b.moves / b.n }]));
  const nonKing = Object.entries(pieceUse).filter(([k]) => !k.startsWith('king'));
  const parts = 100 * (nonKing.length ? nonKing.reduce((a, [, u]) => a + clamp(u.moved / 0.75), 0) / nonKing.length : 1);
  // Variety: how many different openings (the first four moves) the games had.
  const openings = new Set(games.map((g) => g.line.slice(0, 4).map(stepKey).join('|'))).size;
  const variety = 100 * clamp((openings - 1) / Math.max(1, n * 0.6));

  const fun = Math.round(0.2 * balance + 0.15 * decisive + 0.1 * length + 0.15 * drama + 0.1 * uncertainty + 0.15 * (skillScore ?? 50) + 0.1 * parts + 0.05 * variety);
  const why = [];
  const ahead = first > second ? 'first' : 'second';
  if (forced === 'yes') why.push('the side that moves first can take the King by force within three moves');
  if (decided >= 6 && Math.abs(share - 0.5) >= 0.35) why.push(`the ${ahead} side wins ${Math.max(first, second)} of ${decided} decided games`);
  if (decisive < 15) why.push(`${n - decided} of ${n} games ended with no King taken`);
  const shaky = [];
  if (!why.length) {
    if (decided >= 4 && balance < 55) shaky.push(`lopsided: the ${ahead} side wins ${Math.max(first, second)} of ${decided}`);
    if (decisive < 40) shaky.push('drawish: many games end with no King taken');
    if (skillScore !== null && skill.length >= 8 && skillScore < 30) shaky.push('luck more than skill: the stronger bot barely wins more often');
    if (length < 45) shaky.push(avgPlies < cells * 0.5 ? 'over very fast' : 'drags on');
    for (const [k, u] of nonKing) if (u.moved < 0.3) shaky.push(`the ${pieceName(k).toLowerCase()} hardly ever moves`);
    if (opening && (opening.first || opening.second)) shaky.push('something can be taken on the very first move');
  }
  const verdict = why.length ? 'broken' : (fun >= 60 && !shaky.length) || (fun >= 68 && shaky.length <= 1) ? 'playable' : 'shaky';
  const ends = {};
  for (const g of games) { const e = g.winner === null ? g.end : 'won'; ends[e] = (ends[e] || 0) + 1; }
  return {
    fun, verdict, why: why.length ? why : shaky,
    measures: { balance: Math.round(balance), decisive: Math.round(decisive), length: Math.round(length), drama: Math.round(drama), uncertainty: Math.round(uncertainty), skill: skillScore === null ? null : Math.round(skillScore), parts: Math.round(parts), variety: Math.round(variety) },
    record: { games: n, first, second, draws: n - decided, avgPlies: Math.round(avgPlies * 10) / 10, skillShare: sk, openings, forced, ends },
    pieceUse
  };
}

/** A piece's name, with its suit: "Rook of Swords". */
export function pieceName(k) {
  const [t, suit] = k.split(':'), name = PIECES[t]?.name || t;
  return suit ? `${name} of ${suit[0].toUpperCase()}${suit.slice(1)}` : name;
}

/** The measures in words, one line each, for the page and for copying out. */
export const MEASURE_WORDS = {
  balance: ['Balance', 'Whether the first and second side win about as often (chess is about 55 to 45).'],
  decisive: ['Decisive', 'How often a game ends with a King taken, not out of moves or going round in circles.'],
  length: ['Length', 'Whether a decided game is a sensible length for the board: not over in a flash, not a slog.'],
  drama: ['Drama', 'How often the lead changes hands, and how often the winner came back from behind.'],
  uncertainty: ['Uncertainty', 'How late in the game the winner pulls ahead for good: later is more exciting.'],
  skill: ['Skill', 'How often a bot that thinks further ahead beats one that does not: does getting better pay?'],
  parts: ['Every piece plays', 'How often each kind of piece gets moved at all.'],
  variety: ['Variety', 'How many different openings the games had.']
};

// --- A whole trial. ------------------------------------------------------------------

/** How hard to look: layouts tried, quick games each, how many climb, the
    climb's rounds, how many are judged, and their games. A big board
    (more than 36 squares) plays half as many games: each one is longer. */
export const EFFORT = {
  quick: { cap: 30, screen: 4, climbers: 2, rounds: 2, tries: 4, finalists: 4, games: 10, skill: 4 },
  thorough: { cap: 80, screen: 6, climbers: 4, rounds: 4, tries: 6, finalists: 8, games: 20, skill: 8 }
};
const BOTS = { quick: { depth: 1, noise: 0.35, maxNodes: 3000 }, equal: { depth: 2, noise: 0.25, maxNodes: 12000 }, weak: { depth: 1, noise: 0.9, maxNodes: 2000 } };

/**
 * Try an army on a board. `spec`: { army: [{ t, suit }], W, H, rows (1 or
 * 2), facing ('mirror', 'turned', 'any', 'both' (mirror and turned) or
 * 'all'), rules (level settings: ghosts, statues, clouds...), firstCapture
 * (throw out layouts where something can be taken on the first move),
 * pawnsFront, spread, mine (always judge the order given), effort, seed,
 * invented }. `run(job)` runs a job (runJob, here or on a worker) and
 * returns a promise; `post` hears progress ({ stage, done, total }).
 * Resolves to { results (best first), tried, considered, total, thrown,
 * relaxed, climbed }.
 */
export async function runTrial(spec, run = async (j) => runJob(j), post = () => {}) {
  const E = EFFORT[spec.effort] || EFFORT.quick, { W, H } = spec, seed = spec.seed || 1, big = W * H > 36;
  const army = spec.army.map((a) => (typeof a === 'string' ? { t: a } : a));
  const rows = army.length > W ? 2 : spec.rows || 1;
  const facings = spec.facing === 'both' ? ['mirror', 'turned'] : spec.facing === 'all' ? ['mirror', 'turned', 'any'] : [spec.facing || 'mirror'];
  const opts = { pawnsFront: spec.pawnsFront !== false, spread: spec.spread !== false };
  const found = layouts(army, W, H, rows, { cap: Math.max(8, Math.ceil(E.cap / facings.length)), seed, ...opts });
  const given = spec.mine ? givenCells(army, W, rows, opts.pawnsFront) : null;
  const list = given ? [given, ...found.list.filter((c) => c.join() !== given.join())] : found.list;
  const rand = rng(`trials:${seed}`);
  const pickOther = () => found.list[Math.floor(rand() * found.list.length)] || given;
  const thrown = {}, throwOut = (why) => { thrown[why] = (thrown[why] || 0) + 1; };
  const quickGames = big ? Math.max(2, E.screen >> 1) : E.screen;

  // Every candidate: yours and theirs, square by square.
  const seen = new Set(), cands = [];
  const candidate = (cells, facing, foe = null, mine = false) => {
    const foeCells = facing === 'any' ? (foe || pickOther()) : facingCells(cells, W, facing);
    const id = `${cells.join()}|${foeCells.join()}`;
    if (seen.has(id)) return null;
    seen.add(id);
    return { cells, foeCells, facing, id, mine, settings: settingsFor({ ...spec, W, H }, cells, foeCells) };
  };
  for (const cells of list) for (const facing of facings) { const c = candidate(cells, facing, null, cells === given); if (c) cands.push(c); }

  /** Check, then screen, a batch of candidates; keep those that pass. */
  let checked = 0;
  const assess = async (batch, stage) => {
    const total = batch.length;
    let done = 0;
    await Promise.all(batch.map(async (c) => {
      const r = await run({ type: 'check', settings: c.settings });
      Object.assign(c, r);
      post({ type: 'progress', stage, done: ++done, total });
    }));
    checked += batch.length;
    const ok = [], early = [];
    for (const c of batch) {
      if (c.forced === 'yes' && !c.mine) { throwOut('you could take their King by force'); continue; }
      if (spec.firstCapture !== false && !c.mine && (c.opening.first || c.opening.second)) { throwOut('something could be taken on the first move'); early.push(c); continue; }
      ok.push(c);
    }
    done = 0;
    await Promise.all(ok.map(async (c) => {
      c.screen = await run({ type: 'games', settings: c.settings, seeds: Array.from({ length: quickGames }, (_, g) => g + 1), bots: [BOTS.quick, BOTS.quick] });
      const j = judge({ W, H }, c.screen, [], c);
      c.quick = j.measures.balance * 0.35 + j.measures.decisive * 0.3 + j.measures.drama * 0.15 + j.measures.parts * 0.15 + j.measures.length * 0.05;
      post({ type: 'progress', stage: 'screen', done: ++done, total: ok.length });
    }));
    return { ok, early };
  };

  let { ok: pool, early } = await assess(cands, 'check');
  // If the first-move rule threw out every layout, they are judged anyway,
  // marked, so the answer says whether anything would play without it.
  const relaxed = !pool.some((c) => !c.mine) && early.length > 0;
  if (relaxed) {
    for (const c of early) {
      c.screen = await run({ type: 'games', settings: c.settings, seeds: Array.from({ length: quickGames }, (_, g) => g + 1), bots: [BOTS.quick, BOTS.quick] });
      const j = judge({ W, H }, c.screen, [], c);
      c.quick = j.measures.balance * 0.35 + j.measures.decisive * 0.3 + j.measures.drama * 0.15 + j.measures.parts * 0.15 + j.measures.length * 0.05;
    }
    pool = [...pool, ...early];
  }

  // The climb: from the best few, swap two pieces at a time (in your rows,
  // and theirs too when their order is their own), keeping what screens better.
  let climbed = 0;
  const swapIn = (c, a, b) => { const out = c.slice(); [out[a], out[b]] = [out[b], out[a]]; return out; };
  const sameRow = (a, b) => Math.floor(a / W) === Math.floor(b / W);
  const legal = (cells) => (!army.some((a) => a.t === 'king') || cells.slice(0, W).some((k) => k.startsWith('king'))) && (!opts.spread || coloursSpread(cells, W, 'you', H));
  let climbers = pool.filter((c) => !c.mine).sort((a, b) => b.quick - a.quick).slice(0, E.climbers);
  for (let round = 0; round < E.rounds && climbers.length; round++) {
    const next = [];
    for (const c of climbers) {
      const tries = [];
      for (let k = 0; k < E.tries * 6 && tries.length < E.tries; k++) {
        const theirs = c.facing === 'any' && rand() < 0.4;
        const from = theirs ? c.foeCells : c.cells;
        const a = Math.floor(rand() * from.length), b = Math.floor(rand() * from.length);
        if (a === b || from[a] === from[b] || !sameRow(a, b)) continue;
        const cells = theirs ? c.cells : swapIn(c.cells, a, b), foe = theirs ? swapIn(c.foeCells, a, b) : null;
        if (!legal(cells)) continue;
        const t = candidate(cells, c.facing, c.facing === 'any' ? (foe || c.foeCells) : null);
        if (t) tries.push(t);
      }
      next.push(...tries);
    }
    if (!next.length) break;
    const { ok } = await assess(next, `climb ${round + 1}`);
    climbed += next.length;
    pool.push(...ok);
    climbers = pool.filter((c) => !c.mine).sort((a, b) => b.quick - a.quick).slice(0, E.climbers);
  }

  // Judging: the best of everything screened, and the order given.
  const finalists = pool.filter((c) => !c.mine).sort((a, b) => b.quick - a.quick).slice(0, E.finalists);
  for (const c of pool) if (c.mine) finalists.unshift(c);
  const games = big ? Math.max(4, E.games >> 1) : E.games, skillGames = big ? Math.max(2, E.skill >> 1) : E.skill;
  let done = 0;
  const results = await Promise.all(finalists.map(async (c) => {
    const [eq, s0, s1] = await Promise.all([
      run({ type: 'games', settings: c.settings, seeds: Array.from({ length: games }, (_, g) => 100 + g), bots: [BOTS.equal, BOTS.equal], keepLine: true }),
      run({ type: 'games', settings: c.settings, seeds: Array.from({ length: skillGames >> 1 }, (_, g) => 200 + g), bots: [BOTS.equal, BOTS.weak] }),
      run({ type: 'games', settings: c.settings, seeds: Array.from({ length: skillGames - (skillGames >> 1) }, (_, g) => 300 + g), bots: [BOTS.weak, BOTS.equal] })
    ]);
    const skill = [...s0.map((game) => ({ strong: 0, game })), ...s1.map((game) => ({ strong: 1, game }))];
    const j = judge({ W, H }, eq, skill, c);
    const sample = eq.find((g) => g.winner !== null) || eq[0];
    post({ type: 'progress', stage: 'judge', done: ++done, total: finalists.length });
    return { cells: c.cells, foeCells: c.foeCells, facing: c.facing, W, H, rows, mine: !!c.mine, settings: c.settings, ...j,
      sample: { line: sample.line, winner: sample.winner, end: sample.end, seed: sample.seed, levelSeed: sample.seed } };
  }));
  results.sort((a, b) => (a.verdict === 'broken') - (b.verdict === 'broken') || b.fun - a.fun);
  return { army, W, H, rows, results, tried: pool.length, considered: checked, total: found.total, n: found.n, thrown, relaxed, climbed };
}

/**
 * Weave a piece into an army: each kind of piece in it but the King swapped,
 * one at a time, for the new one, and the new one added if there is room.
 * Each army gets a quick trial; the best layout of each comes back, the best
 * army first. `weave` is { t, suit }.
 */
export async function runWeave(spec, run, post = () => {}) {
  const army = spec.army.map((a) => (typeof a === 'string' ? { t: a } : a)), weave = typeof spec.weave === 'string' ? { t: spec.weave } : spec.weave;
  const rows = army.length > spec.W ? 2 : spec.rows || 1;
  const kinds = [...new Set(army.filter((a) => a.t !== 'king' && keyOf(a) !== keyOf(weave)).map(keyOf))];
  const options = kinds.map((k) => {
    const a = army.slice();
    a[a.findIndex((x) => keyOf(x) === k)] = weave;
    return { army: a, change: `the ${pieceName(k).toLowerCase()} swapped for the ${pieceName(keyOf(weave)).toLowerCase()}` };
  });
  if (army.length < spec.W * Math.max(rows, 1) || army.length < spec.W * 2) options.push({ army: [...army, weave], change: `the ${pieceName(keyOf(weave)).toLowerCase()} added` });
  const out = [];
  for (const [i, o] of options.entries()) {
    const r = await runTrial({ ...spec, army: o.army, effort: 'quick', mine: false }, run, (p) => post({ ...p, army: i + 1, armies: options.length }));
    out.push({ army: o.army, change: o.change, best: r.results[0] || null, results: r.results, tried: r.tried, thrown: r.thrown, playable: r.results.filter((x) => x.verdict === 'playable').length });
  }
  out.sort((a, b) => (b.best?.verdict === 'playable') - (a.best?.verdict === 'playable') || (b.best?.fun ?? -1) - (a.best?.fun ?? -1));
  return { weave, armies: out };
}

/** Simulate one level as it stands (any level, any rules): games between
    equal bots and between a stronger and a weaker one, judged. For the
    Custom page's "Simulate". */
export async function simulate(settings, seed, { games = 12, skill = 6 } = {}, run = async (j) => runJob(j), post = () => {}) {
  const L = makeLevel(settings, seed);
  const seeds = (base, n) => Array.from({ length: n }, (_, g) => base + g);
  // A level dealt from its settings keeps its own layout: every game on it.
  const levelSeed = settings.cells ? undefined : seed;
  post({ type: 'progress', stage: 'simulate', done: 0, total: 1 });
  const check = await run({ type: 'check', settings, ...(levelSeed ? { levelSeed } : {}) });
  const [eq, s0, s1] = await Promise.all([
    run({ type: 'games', settings, levelSeed, seeds: seeds(100, games), bots: [BOTS.equal, BOTS.equal], keepLine: true }),
    run({ type: 'games', settings, levelSeed, seeds: seeds(200, skill >> 1), bots: [BOTS.equal, BOTS.weak] }),
    run({ type: 'games', settings, levelSeed, seeds: seeds(300, skill - (skill >> 1)), bots: [BOTS.weak, BOTS.equal] })
  ]);
  const j = judge({ W: L.W, H: L.H }, eq, [...s0.map((game) => ({ strong: 0, game })), ...s1.map((game) => ({ strong: 1, game }))], check);
  const sample = eq.find((g) => g.winner !== null) || eq[0];
  return { ...j, W: L.W, H: L.H, settings, seed, sample: { line: sample.line, winner: sample.winner, end: sample.end, seed: sample.seed, levelSeed: levelSeed ?? sample.seed } };
}

/**
 * The most playable layouts of a level dealt from its settings (no armies
 * set square by square): its dice rolls are the layouts. Each seed is
 * checked, screened, and the best judged, as in a trial. For the Custom
 * page's "Find the most playable layout" on a dealt level.
 */
export async function runSeeds(settings, { effort = 'quick', firstCapture = true, from = 1 } = {}, run = async (j) => runJob(j), post = () => {}) {
  const E = EFFORT[effort] || EFFORT.quick, L0 = makeLevel(settings, from), big = L0.W * L0.H > 36;
  const seeds = Array.from({ length: E.cap }, (_, i) => from + i), thrown = {}, throwOut = (w) => { thrown[w] = (thrown[w] || 0) + 1; };
  let done = 0;
  const cands = await Promise.all(seeds.map(async (levelSeed) => {
    const r = await run({ type: 'check', settings, levelSeed });
    post({ type: 'progress', stage: 'check', done: ++done, total: seeds.length });
    return { levelSeed, ...r };
  }));
  let pool = cands.filter((c) => {
    if (c.forced === 'yes') { throwOut('you could take their King by force'); return false; }
    if (firstCapture && (c.opening.first || c.opening.second)) { throwOut('something could be taken on the first move'); return false; }
    return true;
  });
  const relaxed = !pool.length;
  if (relaxed) pool = cands.filter((c) => c.forced !== 'yes');
  done = 0;
  const quickGames = big ? Math.max(2, E.screen >> 1) : E.screen;
  await Promise.all(pool.map(async (c) => {
    c.screen = await run({ type: 'games', settings, levelSeed: c.levelSeed, seeds: Array.from({ length: quickGames }, (_, g) => g + 1), bots: [BOTS.quick, BOTS.quick] });
    const j = judge(L0, c.screen, [], c);
    c.quick = j.measures.balance * 0.35 + j.measures.decisive * 0.3 + j.measures.drama * 0.15 + j.measures.parts * 0.15 + j.measures.length * 0.05;
    post({ type: 'progress', stage: 'screen', done: ++done, total: pool.length });
  }));
  const finalists = pool.sort((a, b) => b.quick - a.quick).slice(0, E.finalists);
  done = 0;
  const games = big ? Math.max(4, E.games >> 1) : E.games, skillGames = big ? Math.max(2, E.skill >> 1) : E.skill;
  const results = await Promise.all(finalists.map(async (c) => {
    const [eq, s0, s1] = await Promise.all([
      run({ type: 'games', settings, levelSeed: c.levelSeed, seeds: Array.from({ length: games }, (_, g) => 100 + g), bots: [BOTS.equal, BOTS.equal], keepLine: true }),
      run({ type: 'games', settings, levelSeed: c.levelSeed, seeds: Array.from({ length: skillGames >> 1 }, (_, g) => 200 + g), bots: [BOTS.equal, BOTS.weak] }),
      run({ type: 'games', settings, levelSeed: c.levelSeed, seeds: Array.from({ length: skillGames - (skillGames >> 1) }, (_, g) => 300 + g), bots: [BOTS.weak, BOTS.equal] })
    ]);
    const j = judge(L0, eq, [...s0.map((game) => ({ strong: 0, game })), ...s1.map((game) => ({ strong: 1, game }))], c);
    const sample = eq.find((g) => g.winner !== null) || eq[0];
    post({ type: 'progress', stage: 'judge', done: ++done, total: finalists.length });
    return { ...j, W: L0.W, H: L0.H, settings, seed: c.levelSeed, levelSeed: c.levelSeed, sample: { line: sample.line, winner: sample.winner, end: sample.end, seed: c.levelSeed, levelSeed: c.levelSeed } };
  }));
  results.sort((a, b) => (a.verdict === 'broken') - (b.verdict === 'broken') || b.fun - a.fun);
  return { results, considered: seeds.length, tried: pool.length, thrown, relaxed, dealt: true };
}

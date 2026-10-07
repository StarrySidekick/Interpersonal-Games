// The lab: make any level you like from a pile of settings, play it, and
// write down whether it was fun.
//
// A level is settings + a seed. The settings say what kind of level it is;
// the seed is the dice roll that places everything. Same settings and same
// seed give the same level on any phone, which is what makes a level
// shareable as a link. New layout = same settings, new seed.
//
// The standard board (2026-10-06, Timothy's framing): a kind of ground, a
// shape and a size, a hole, and pieces of theirs possessed by rabbits. The
// rabbit inside decides which way a piece goes; the piece decides how.
// Catch every possessed piece, which opens the hole, then sink the ball.
//
// Settings carry a version. Version 3 (possession) is the current one;
// anything saved earlier (links, the notebook) is read against the defaults
// of its own version, so it still builds exactly the level it was.

import { rng, shuffled } from '../../engine/seed.js';
import { PIECES, onBoard, initialState, autoApply, isOver } from './rules.js';
import { PATTERNS } from './day.js';
import { EXTRA_PATTERNS } from './rabbits.js';

/** Every named pattern: the daily's twelve, then the ones with pauses. */
const ALL_PATTERNS = [...PATTERNS, ...EXTRA_PATTERNS];
import { solveLevel, assess, unbalanced } from './solve.js';

export const CLASSIC = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'classic');
export const FAIRY = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'fairy');
export const ALL = [...CLASSIC, ...FAIRY];

const opts = (...pairs) => pairs.map(([v, label]) => ({ v, label }));

/** Every setting: its group, label, kind and range. The page is built from this. */
export const SCHEMA = [
  { group: 'How you play', fields: [
    { key: 'mode', label: 'Who moves your pieces', type: 'choice', def: 'hand', options: opts(['hand', 'You do'], ['auto', 'Rabbits (autochess)']),
      help: 'Autochess: before the game you put rabbits you have caught into your pieces, choose which way each faces and the order of your line. Then it plays itself: each rabbit picks the way, its piece picks how, the same as theirs.' },
    { key: 'autoPool', label: 'Your rabbits', type: 'choice', def: 'caught', options: opts(['caught', 'The ones you have caught'], ['all', 'Every named kind']),
      help: 'For autochess. Caught: one rabbit for every time you caught its kind, in the descent or the daily.' }
  ] },
  { group: 'Board', fields: [
    { key: 'w', label: 'Width', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'h', label: 'Height', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'shape', label: 'Shape', type: 'choice', def: 'rect', options: opts(
      ['rect', 'Rectangle'], ['diamond', 'Diamond'], ['round', 'Round'], ['cross', 'Cross'], ['ring', 'Ring'],
      ['hourglass', 'Hourglass'], ['L', 'L'], ['stairs', 'Stairs'], ['islands', 'Two islands'], ['cheese', 'Swiss cheese']) },
    { key: 'holes', label: 'Extra holes', type: 'int', min: 0, max: 15, def: 0 },
    { key: 'ground', label: 'Ground', type: 'choice', def: 'solid', options: opts(
      ['solid', 'Solid'], ['crumble', 'Crumbling'], ['shrink', 'Shrinking'], ['spiral', 'Shrinking in a spiral']),
      help: 'Crumbling: every square you move a piece off falls away. Shrinking: every few moves a square on the edge drops into the dark and the board closes in, at random or round in a spiral.' },
    { key: 'shrinkEvery', label: 'The edge falls every', type: 'int', min: 1, max: 5, def: 2, unit: 'moves', help: 'Only for shrinking ground.' }
  ] },
  { group: 'Your side', fields: [
    { key: 'mine', label: 'Pieces', type: 'int', min: 1, max: 8, def: 4 },
    { key: 'minePool', label: 'Dealt from', type: 'pieces', def: ['queen', 'knight', 'bishop', 'rook', 'grasshopper'] },
    { key: 'mineDupes', label: 'Repeats allowed', type: 'bool', def: false },
    { key: 'lineup', label: 'Line up like chess', type: 'bool', def: true,
      help: 'Your pieces start in a line along the bottom edge, theirs along the top. Off: scattered within the rows below.' },
    { key: 'mineRows', label: 'Start within the bottom', type: 'int', min: 1, max: 5, def: 2, unit: 'rows', help: 'When not lined up.' },
    { key: 'royal', label: 'Your King is royal', type: 'bool', def: false, help: 'Lose the King, lose the game.' },
    { key: 'wait', label: 'Waiting allowed', type: 'bool', def: true }
  ] },
  { group: 'Rabbits', fields: [
    { key: 'rabbits', label: 'Free rabbits', type: 'int', min: 0, max: 4, def: 0,
      help: 'Rabbits loose on the board, on top of the ones inside their pieces.' },
    { key: 'rabbitBrain', label: 'Rabbits move by', type: 'choice', def: 'pattern', options: opts(['pattern', 'Hidden pattern'], ['ai', 'Thinking']) },
    { key: 'patterns', label: 'Rabbit patterns', type: 'choice', def: 'all', options: opts(
      ['all', 'Every named kind'], ['daily', 'The daily set'], ['short', 'Random, 2 hops'], ['mid', 'Random, 3 to 4'], ['long', 'Random, 5 to 8'], ['wild', 'Random, big jumps']),
      help: 'For free rabbits and the ones inside pieces. Every named kind has its own colour; "every named kind" adds three that pause.' },
    { key: 'hops', label: 'Rabbit hops per turn', type: 'int', min: 1, max: 3, def: 1 },
    { key: 'tracks', label: 'Show rabbit tracks', type: 'bool', def: true },
    { key: 'rabbitsEat', label: 'Rabbits eat your pieces', type: 'bool', def: false,
      help: 'Off: a rabbit that would land on one of your pieces waits instead.' }
  ] },
  { group: 'Their pieces', fields: [
    { key: 'foes', label: 'Pieces', type: 'int', min: 0, max: 8, def: 3, help: 'Dark versions of chess and fairy pieces.' },
    { key: 'darkBrain', label: 'Moved by', type: 'choice', def: 'possessed', options: opts(['possessed', 'A rabbit inside'], ['think', 'Thinking']),
      help: 'A rabbit inside: each piece is possessed by a rabbit, whose pattern decides which way it goes each turn (left, up, a pause); the piece\u2019s own moves decide how.' },
    { key: 'kinds', label: 'Kinds of rabbit inside', type: 'int', min: 1, max: 4, def: 1,
      help: 'One kind: every piece moves to the same pattern, so you can see it. More: each piece may have its own.' },
    { key: 'foePool', label: 'Dealt from', type: 'pieces', rabbit: true, def: ['king', 'knight', 'bishop', 'rook'] },
    { key: 'foeDupes', label: 'Repeats allowed', type: 'bool', def: true },
    { key: 'mirror', label: 'Mirror your pieces instead', type: 'bool', def: false, help: 'They get a copy of your hand, facing you, like chess.' },
    { key: 'foeRows', label: 'Start within the top', type: 'int', min: 1, max: 5, def: 3, unit: 'rows', help: 'Loose rabbits and the hole start up there too, lined up or not.' },
    { key: 'skill', label: 'Thinking skill', type: 'choice', def: '2', options: opts(
      ['0', 'Random'], ['1', 'Greedy'], ['2', 'Two ahead'], ['3', 'Three ahead']), help: 'For pieces of theirs that think, and thinking rabbits.' },
    { key: 'style', label: 'Mood', type: 'choice', def: 'balanced', options: opts(['flee', 'Flee'], ['balanced', 'Balanced'], ['hunt', 'Hunt']) },
    { key: 'foesCapture', label: 'They can take your pieces', type: 'bool', def: true }
  ] },
  { group: 'Winning', fields: [
    { key: 'goal', label: 'How you win', type: 'choice', def: 'descent', options: opts(
      ['descent', 'Catch them, then the ball'], ['all', 'Capture them all'], ['king', 'Take their King'], ['rabbit', 'Catch the rabbit'],
      ['any', 'Catch any one'], ['target', 'A marked one'], ['hole', 'Sink the ball'], ['mix', 'Mix it up']),
      help: 'Catch them, then the ball: the hole stays shut until every possessed piece and loose rabbit is caught, then sink the ball in it. King and rabbit make sure they have one. Sink the ball gives you a ball and a moving hole. Mix picks capture, King or rabbit per layout.' },
    { key: 'holeMoves', label: 'The hole moves by', type: 'choice', def: 'daily', options: opts(
      ['still', 'Staying put'], ['daily', 'The daily set'], ['short', 'Random, 2 hops'], ['mid', 'Random, 3 to 4'], ['long', 'Random, 5 to 8']),
      help: 'Only when there is a hole. A hidden pattern, like a rabbit\u2019s.' },
    { key: 'ballMove', label: 'The ball moves', type: 'choice', def: 'putt', options: opts(
      ['ice', 'On ice'], ['putt', 'Like a putt'], ['bounce', 'Like a billiard ball'], ['hit', 'Hit by the pieces']),
      help: 'On ice: up, down, left or right, and it rolls until something stops it. Like a putt: up, down, left or right, as far as you like. Like a billiard ball: diagonally, as far as you like, bouncing off the edges (the reflecting bishop from Billiards Chess). It never takes anything. Hit by the pieces: it never moves by itself; any piece, yours or theirs, that moves into it knocks it on along the line of that move, as many steps as the piece travelled.' },
    { key: 'ballStops', label: 'Ball must stop on the hole', type: 'bool', def: false,
      help: 'Off: it drops in when it rolls over the hole. On: it has to come to rest there.' },
    { key: 'maxMoves', label: 'Move limit', type: 'int', min: 0, max: 60, def: 20, help: '0 means no limit.' },
    { key: 'first', label: 'First move', type: 'choice', def: 'you', options: opts(['you', 'You'], ['them', 'Them']) },
    { key: 'solve', label: 'Only deal winnable levels', type: 'bool', def: true,
      help: 'The solver plays each layout first and throws out any it cannot win in time. It also sets par.' },
    { key: 'parMax', label: 'Winnable within', type: 'int', min: 2, max: 15, def: 10, unit: 'moves' },
    { key: 'parMin', label: 'But not in fewer than', type: 'int', min: 1, max: 12, def: 3, unit: 'moves' },
    { key: 'balance', label: 'Balance rules', type: 'choice', def: 'on', options: opts(['off', 'Off'], ['on', 'On'], ['strict', 'Strict']),
      help: 'On: every piece of yours can move at the start, and every strange piece (fairy pieces, and the grasshopper-like ones that need the right circumstances) has a job: it makes a catch in the winning line, or the level is worse without it. Strict: every piece has a job. Needs the solver.' }
  ] }
];

const FIELDS = SCHEMA.flatMap((g) => g.fields);
export const SETTINGS_VERSION = 5;
export const defaults = () => ({ ...Object.fromEntries(FIELDS.map((f) => [f.key, Array.isArray(f.def) ? [...f.def] : f.def])), v: SETTINGS_VERSION });

/** How each earlier version's defaults differ from today's. Settings saved
    then (links and notebook entries) only stored what differed from their
    own defaults, so they are read against them. */
const BEFORE = {
  4: { lineup: false },
  3: { ballMove: 'ice', lineup: false },
  2: { lineup: false, rabbits: 1, foes: 2, patterns: 'daily', darkBrain: 'think', kinds: 1, foePool: ['king', 'knight', 'bishop', 'pawn'], ballMove: 'ice' },
  1: { lineup: false, rabbits: 0, foes: 3, patterns: 'daily', darkBrain: 'think', kinds: 1, foePool: ['king', 'knight', 'bishop', 'pawn'],
    ground: 'solid', goal: 'king', balance: 'off', ballMove: 'ice' }
};
const defaultsFor = (v) => ({ ...defaults(), ...JSON.parse(JSON.stringify(BEFORE[v] || {})) });

/** Keep settings inside their ranges, whatever a link or a bug hands us.
    Anything without `v: 2` was made before version 2 and keeps its old
    meaning: crumbling was a switch, there was no separate rabbit count, and
    rabbits ate whenever their side could take your pieces. */
export function clean(raw) {
  const v = [2, 3, 4, 5].includes(raw?.v) ? raw.v : 1, legacy = v === 1;
  const s = defaultsFor(v);
  for (const f of FIELDS) {
    const v = raw?.[f.key];
    if (v === undefined) continue;
    if (f.type === 'int' && Number.isFinite(+v)) s[f.key] = Math.max(f.min, Math.min(f.max, Math.round(+v)));
    if (f.type === 'bool') s[f.key] = !!v;
    if (f.type === 'choice' && f.options.some((o) => o.v === String(v))) s[f.key] = String(v);
    if (f.type === 'pieces' && Array.isArray(v)) {
      const ok = v.filter((k) => PIECES[k] && (k !== 'rabbit' || f.rabbit));
      if (ok.length) s[f.key] = [...new Set(ok)];
    }
  }
  if (legacy) {
    if (raw?.crumble && raw.ground === undefined) s.ground = 'crumble';
    if (raw?.rabbitsEat === undefined) s.rabbitsEat = s.foesCapture;
  }
  if (s.parMin > s.parMax) s.parMin = s.parMax;
  const ballGoal = s.goal === 'hole' || s.goal === 'descent';
  if (s.foes + s.rabbits < 1 && !ballGoal) s.foes = 1; // nothing to catch otherwise
  if (s.goal === 'king' && s.foes < 1) s.foes = 1;    // something has to be the King
  if (ballGoal && !legacy && s.mine < 2) s.mine = 2;  // the ball, and something to stop it
  if (s.kinds > Math.max(1, s.foes)) s.kinds = Math.max(1, s.foes);
  // A hand given outright (the descent: the pieces you carry down), not
  // dealt. Not a setting on the page.
  if (Array.isArray(raw?.hand) && raw.hand.length) {
    s.hand = raw.hand.filter((k) => PIECES[k]);
    s.mine = s.hand.length;
  }
  s.v = SETTINGS_VERSION;
  return s;
}

// --- Going crazy. ----------------------------------------------------------

/** Random settings. Not uniformly random: weighted toward things that are
    likely to be playable, with a long tail of strange. `allowed` is which
    fairy pieces (and whether the rabbit) it may use; classic pieces always. */
export function crazy(rand = Math.random, allowed = [...FAIRY, 'rabbit']) {
  const fairy = FAIRY.filter((k) => allowed.includes(k)), rabbitOk = allowed.includes('rabbit');
  const ALL = [...CLASSIC, ...fairy];
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const some = (pool, a, b) => shuffled(pool, rand).slice(0, int(a, b));
  const w = int(4, 9), h = int(4, 9);
  const mine = int(2, 5);
  const brain = rand() < 0.5 ? 'pattern' : 'ai';
  const out = clean({
    v: SETTINGS_VERSION, w, h,
    shape: rand() < 0.35 ? 'rect' : pick(['diamond', 'round', 'cross', 'ring', 'hourglass', 'L', 'stairs', 'islands', 'cheese']),
    holes: rand() < 0.6 ? 0 : int(1, 6),
    ground: pick(['solid', 'solid', 'solid', 'crumble', 'shrink', 'spiral']), shrinkEvery: int(1, 3),
    rabbits: rabbitOk ? int(0, 2) : 0, rabbitsEat: rand() < 0.2,
    darkBrain: rand() < 0.65 ? 'possessed' : 'think', kinds: int(1, 3),
    mine, minePool: some(ALL, 2, 6), mineDupes: rand() < 0.3, mineRows: int(1, 2), lineup: rand() < 0.8,
    mode: rand() < 0.15 ? 'auto' : 'hand', autoPool: 'all',
    royal: rand() < 0.2, wait: rand() < 0.8,
    foes: int(1, 4),
    foePool: rabbitOk && rand() < 0.4 ? ['rabbit'] : some(rabbitOk ? ['rabbit', ...ALL] : ALL, 1, 4),
    foeDupes: rand() < 0.6, mirror: rand() < 0.12, foeRows: int(1, 3),
    rabbitBrain: brain, patterns: pick(['all', 'all', 'daily', 'short', 'mid', 'long', 'wild']),
    hops: rand() < 0.8 ? 1 : int(2, 3), tracks: rand() < 0.85,
    skill: pick(['0', '1', '2', '2', '3']), style: pick(['flee', 'balanced', 'hunt']),
    foesCapture: rand() < 0.85,
    goal: pick(['all', 'king', 'king', 'any', 'mix', 'hole', 'hole', ...(rabbitOk ? ['rabbit', 'rabbit', 'descent', 'descent', 'descent'] : [])]),
    maxMoves: pick([0, 15, 20, 25, 30]), first: rand() < 0.8 ? 'you' : 'them',
    holeMoves: pick(['still', 'daily', 'daily', 'short', 'mid']), ballStops: rand() < 0.3, ballMove: pick(['putt', 'putt', 'ice', 'bounce', 'hit', 'hit']),
    solve: true, parMax: int(6, 12), parMin: int(2, 3)
  });
  // Ball levels are often best with few or no pieces against you.
  if (out.goal === 'hole') out.foes = int(0, 2);
  if (out.goal === 'descent') { out.foes = int(1, 4); if (out.darkBrain !== 'possessed') out.rabbits = Math.max(1, out.rabbits); }
  return out;
}

// --- Board shapes. ---------------------------------------------------------

/** Which squares a shape leaves out. */
function shapeHoles(shape, W, H, rand) {
  const holes = new Set(), cx = (W - 1) / 2, cy = (H - 1) / 2;
  const drop = (x, y) => holes.add(y * W + x);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / (W / 2), ny = (y - cy) / (H / 2);
      const out = {
        diamond: () => Math.abs(nx) + Math.abs(ny) > 1.05,
        round: () => nx * nx + ny * ny > 1.1,
        cross: () => Math.abs(x - cx) > Math.max(0.5, W / 6) && Math.abs(y - cy) > Math.max(0.5, H / 6),
        ring: () => W >= 5 && H >= 5 && Math.abs(x - cx) < W / 4 && Math.abs(y - cy) < H / 4,
        hourglass: () => Math.abs(nx) > Math.abs(ny) + 0.3,
        L: () => x >= Math.ceil(W / 2) && y >= Math.ceil(H / 2),
        stairs: () => Math.abs((x / (W - 1)) - (y / (H - 1))) > 0.55,
        cheese: () => rand() < 0.2
      }[shape];
      if (out && out()) drop(x, y);
    }
  if (shape === 'islands' && H >= 5) {
    const mid = Math.floor(H / 2), bridge = Math.floor(rand() * W);
    for (let x = 0; x < W; x++) if (x !== bridge) drop(x, mid);
  }
  return holes;
}

/** Keep only the biggest connected piece of board, so nothing is stranded. */
function keepLargest(W, H, holes) {
  const seen = new Set();
  let best = [];
  for (let sq = 0; sq < W * H; sq++) {
    if (holes.has(sq) || seen.has(sq)) continue;
    const part = [], stack = [sq];
    seen.add(sq);
    while (stack.length) {
      const q = stack.pop(), x = q % W, y = Math.floor(q / W);
      part.push(q);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || holes.has(k) || seen.has(k)) continue;
        seen.add(k); stack.push(k);
      }
    }
    if (part.length > best.length) best = part;
  }
  const keep = new Set(best), out = new Set();
  for (let sq = 0; sq < W * H; sq++) if (!keep.has(sq)) out.add(sq);
  return out;
}

// --- Rabbit patterns. ------------------------------------------------------

function randomPattern(kind, rand) {
  const small = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const big = [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 1], [1, 2], [-1, 2], [-2, 1], [2, 2], [-2, 2], [3, 0], [0, 3]];
  const len = { short: 2, mid: 3 + Math.floor(rand() * 2), long: 5 + Math.floor(rand() * 4), wild: 2 + Math.floor(rand() * 3) }[kind];
  const pool = kind === 'wild' ? big : small;
  for (;;) {
    const steps = Array.from({ length: len }, () => pool[Math.floor(rand() * pool.length)]);
    const dx = steps.reduce((n, s) => n + s[0], 0), dy = steps.reduce((n, s) => n + s[1], 0);
    if (dx || dy) return { name: 'Random', steps }; // a pattern that goes nowhere is no fun to find
  }
}

// --- Making a level. -------------------------------------------------------

/** Settings + seed -> a level the rules engine can play. */
export function makeLevel(settings, seed) {
  const S = clean(settings), rand = rng(`lab:${seed}`);
  const W = S.w, H = S.h;
  const need = S.mine + (S.mirror ? S.mine : S.foes) + S.rabbits + 2;

  let holes = shapeHoles(S.shape, W, H, rand);
  for (let i = 0; i < S.holes; i++) holes.add(Math.floor(rand() * W * H));
  holes = keepLargest(W, H, holes);
  if (W * H - holes.size < need) holes = new Set(); // too little board left: fall back to the rectangle

  // Stumps and bramble are out for now; the rules engine still expects the
  // fields (the first two daily boards use them), so they stay, empty.
  const day = { W, H, holes, stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2 };
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (onBoard(day, x, y)) cells.push([x, y]);
  const rows = [...new Set(cells.map((c) => c[1]))].sort((a, b) => a - b);
  const taken = new Set();
  const free = ([x, y]) => !taken.has(y * W + x);
  /** A random free square in the given rows, or anywhere free if those are full. */
  const place = (rowList) => {
    let pool = cells.filter((c) => rowList.includes(c[1]) && free(c));
    if (!pool.length) pool = cells.filter(free);
    if (!pool.length) return {};
    const c = pool[Math.floor(rand() * pool.length)];
    taken.add(c[1] * W + c[0]);
    return { x: c[0], y: c[1] };
  };
  /** n piece types from a pool: drawn without repeats until the pool runs
      out (or with repeats from the start, if allowed). */
  const deal = (pool, n, dupes) => {
    const out = [];
    let bag = [];
    for (let i = 0; i < n; i++) {
      if (dupes) { out.push(pool[Math.floor(rand() * pool.length)]); continue; }
      if (!bag.length) bag = shuffled(pool, rand);
      out.push(bag.shift());
    }
    return out;
  };

  /** Lined up like chess (version 5): n squares side by side along the
      first of `rowList` (its edge row first), a run of them at a random
      place along it, spilling onto the next row if the shape is too narrow. */
  const lineUp = (rowList, n) => {
    const out = [];
    for (const y of rowList) {
      if (out.length >= n) break;
      const row = cells.filter((c) => c[1] === y && free(c)).sort((p, q) => p[0] - q[0]);
      const k = Math.min(n - out.length, row.length), at = Math.floor(rand() * (row.length - k + 1));
      for (const [x] of row.slice(at, at + k)) { taken.add(y * W + x); out.push({ x, y }); }
    }
    while (out.length < n) out.push(place(rowList));
    return shuffled(out, rand); // which piece stands where is part of the dice roll
  };

  const bottom = rows.slice(0, S.mineRows), top = rows.slice(-S.foeRows);
  const myTypes = S.hand ? S.hand.slice() : deal(S.minePool, S.mine, S.mineDupes);
  const mySpots = S.lineup ? lineUp(rows, myTypes.length) : null;
  const pieces = myTypes.map((type, i) => ({ type, ...(S.lineup ? mySpots[i] : place(bottom)) }));

  let foes;
  if (S.mirror) {
    foes = pieces.map((p) => {
      const my = H - 1 - p.y, sq = my * W + p.x;
      const spot = onBoard(day, p.x, my) && !taken.has(sq) ? (taken.add(sq), { x: p.x, y: my }) : place(top);
      return { type: p.type, ...spot };
    });
  } else if (S.lineup) {
    const types = deal(S.foePool, S.foes, S.foeDupes), spots = lineUp(rows.slice().reverse(), types.length);
    foes = types.map((type, i) => ({ type, ...spots[i] }));
  } else foes = deal(S.foePool, S.foes, S.foeDupes).map((type) => ({ type, ...place(top) }));
  // Rabbits of their own, on top of the dark pieces. (Only drawn when there
  // are some, so levels from before version 2 come out exactly as they did.)
  for (let i = 0; i < S.rabbits; i++) foes.push({ type: 'rabbit', ...place(top) });

  // The goal. King and rabbit goals make sure the thing to catch exists, and
  // mark it; the rules engine only knows "catch every marked one".
  const goal = S.goal === 'mix' ? ['all', 'king', 'rabbit'][Math.floor(rand() * 3)] : S.goal;
  if (goal === 'king' && foes.length) {
    const kings = foes.filter((f) => f.type === 'king');
    if (!kings.length) foes[0].type = 'king';
    else kings.slice(1).forEach((f) => { f.type = 'pawn'; });
    foes.find((f) => f.type === 'king').target = true;
  }
  if (goal === 'rabbit' && foes.length) {
    if (!foes.some((f) => f.type === 'rabbit')) foes[0].type = 'rabbit';
    foes.forEach((f) => { if (f.type === 'rabbit') f.target = true; });
  }
  if (goal === 'target' && foes.length) (foes.find((f) => f.type === 'rabbit') || foes[0]).target = true;
  // Rabbits, then the ball: every rabbit is marked, and the hole stays shut
  // until they are all caught.
  if (goal === 'descent') foes.forEach((f) => { if (f.type === 'rabbit' || S.darkBrain === 'possessed') f.target = true; });

  // Sink the ball: your first piece becomes the ball, and the hole starts on
  // their side of the board. (This draws its random numbers only on ball
  // levels, so every other level stays exactly as it was.)
  let hole = null;
  if (goal === 'hole' || goal === 'descent') {
    if (pieces.length) pieces[0].type = 'ball';
    const spot = place(top);
    if (spot.x !== undefined) {
      hole = { x: spot.x, y: spot.y, mx: rand() < 0.5 ? 1 : -1, my: rand() < 0.5 ? 1 : -1 };
      if (S.holeMoves !== 'still') {
        const p = S.holeMoves === 'daily' ? PATTERNS[Math.floor(rand() * PATTERNS.length)] : randomPattern(S.holeMoves, rand);
        hole.pattern = p.steps; hole.patternName = p.name;
      }
    }
  }

  // Brains and patterns. A possessed piece gets one of `kinds` patterns,
  // chosen first, in turn, so with one kind every piece moves alike.
  // (Possession draws its numbers only when there is some, so levels from
  // before version 3 come out exactly as they did.)
  const pickPattern = () => (S.patterns === 'daily' ? PATTERNS[Math.floor(rand() * PATTERNS.length)]
    : S.patterns === 'all' ? ALL_PATTERNS[Math.floor(rand() * ALL_PATTERNS.length)] : randomPattern(S.patterns, rand));
  const possessed = S.darkBrain === 'possessed' ? foes.filter((f) => f.type !== 'rabbit') : [];
  const kindPats = possessed.length ? Array.from({ length: Math.min(S.kinds, possessed.length) }, pickPattern) : [];
  foes.forEach((f) => {
    if (possessed.includes(f)) {
      const p = kindPats[possessed.indexOf(f) % kindPats.length];
      f.brain = 'possessed'; f.pattern = p.steps; f.patternName = p.name;
      f.mx = rand() < 0.5 ? 1 : -1; f.my = rand() < 0.5 ? 1 : -1;
      return;
    }
    f.brain = f.type === 'rabbit' && S.rabbitBrain === 'pattern' ? 'pattern' : 'ai';
    if (f.brain === 'pattern') {
      const p = pickPattern();
      f.pattern = p.steps; f.patternName = p.name;
      f.mx = rand() < 0.5 ? 1 : -1; f.my = rand() < 0.5 ? 1 : -1; f.hops = S.hops;
    }
  });

  return Object.assign(day, {
    seed, settings: S, shrinkKey: seed,
    pieces: pieces.filter((p) => p.x !== undefined),
    foes: foes.filter((f) => f.x !== undefined),
    goalKind: goal, hole,
    rules: { goal: ['king', 'rabbit', 'target'].includes(goal) ? 'target' : goal, maxMoves: S.maxMoves, wait: S.wait,
      foesCapture: S.foesCapture, rabbitsEat: S.rabbitsEat, royal: S.royal, first: S.first, ballStops: S.ballStops, ballMove: S.ballMove,
      crumble: S.ground === 'crumble', shrink: S.ground === 'shrink' ? 'random' : S.ground === 'spiral' ? 'spiral' : null,
      shrinkEvery: S.shrinkEvery },
    ai: { skill: +S.skill, style: S.style },
    tracks: S.tracks
  });
}

export const GOAL_TEXT = {
  descent: 'catching every possessed piece and loose rabbit, then sinking the ball', all: 'capturing them all', king: 'taking their King', rabbit: 'catching the rabbit',
  any: 'catching any one', target: 'catching the marked one', mix: 'a goal that changes with each layout',
  hole: 'sinking the ball in the hole'
};
export const GOAL_PILL = {
  descent: 'Catch them, then the ball', all: 'Capture them all', king: 'Take their King', rabbit: 'Catch the rabbit', any: 'Catch any one', target: 'Catch the marked one',
  hole: 'Sink the ball'
};

/** One line saying what a level is. */
export function summary(S) {
  const name = (k) => PIECES[k].name;
  const pool = (a) => (a.length > 4 ? `${a.slice(0, 4).map(name).join(', ')} and ${a.length - 4} more` : a.map(name).join(', '));
  const shape = S.shape === 'L' ? 'L-shaped board' : FIELDS.find((f) => f.key === 'shape').options.find((o) => o.v === S.shape).label.toLowerCase();
  const hand = S.mirror ? S.minePool : S.foePool;
  const made = S.goal === 'king' && !hand.includes('king') ? ', one of them made a King'
    : S.goal === 'rabbit' && !hand.includes('rabbit') ? ', one of them made a rabbit' : '';
  const ground = { solid: '', crumble: ', crumbling', shrink: `, shrinking every ${S.shrinkEvery}`, spiral: `, shrinking in a spiral every ${S.shrinkEvery}` }[S.ground];
  const rabbitsHere = S.rabbits > 0 || (S.foePool.includes('rabbit') && !S.mirror);
  const dark = S.darkBrain === 'possessed' ? `possessed by ${S.kinds} kind${S.kinds > 1 ? 's' : ''} of rabbit` : 'thinking';
  const auto = S.mode === 'auto' ? `Autochess, with ${S.autoPool === 'all' ? 'every named kind of rabbit' : 'the rabbits you have caught'}. ` : '';
  return `${auto}${S.w} × ${S.h} ${shape}${ground}${S.lineup ? ', lined up' : ''}. You: ${S.hand ? S.hand.map(name).join(', ') : `${S.mine} from ${pool(S.minePool)}`}. ` +
    `Them: ${S.rabbits ? `${S.rabbits} rabbit${S.rabbits > 1 ? 's' : ''}, ` : ''}` +
    `${S.mirror ? 'a mirror of you' : S.foes ? `${S.foes} from ${pool(S.foePool)}, ${dark}` : 'no pieces'}${made}` +
    `${rabbitsHere ? `, rabbits ${S.rabbitBrain === 'pattern' ? 'on patterns' : 'thinking'}${S.rabbitsEat ? ' that eat' : ''}` : ''}. ` +
    `Win by ${GOAL_TEXT[S.goal]}` +
    `${S.maxMoves ? ` in ${S.maxMoves} moves` : ''}.` +
    `${!S.solve ? '' : S.mode === 'auto' ? ` Checked: some setup wins in ${S.maxMoves || 40} turns.` : ` Checked winnable in ${S.parMin} to ${S.parMax}.`}`;
}

// --- Links. ----------------------------------------------------------------
// Only what differs from the defaults goes in, to keep links short.

export function encodeLevel(settings, seed) {
  const S = clean(settings), d = defaults(), diff = {};
  for (const k of Object.keys(S)) if (JSON.stringify(S[k]) !== JSON.stringify(d[k])) diff[k] = S[k];
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `lab=${b64}&v=${SETTINGS_VERSION}&seed=${seed}`;
}

/** A level link with its par attached, so opening it needs no solving. */
export function encodeLevelWithPar(settings, seed, par) {
  return encodeLevel(settings, seed) + (par ? `&par=${par}` : '');
}

export function decodeLevel(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('lab')) return null;
  try {
    const json = decodeURIComponent(escape(atob(p.get('lab').replace(/-/g, '+').replace(/_/g, '/'))));
    const par = parseInt(p.get('par'), 10);
    const diff = JSON.parse(json || '{}');
    // A link is read against the defaults of the version it was made in
    // (no v at all: before version 2).
    const v = +p.get('v');
    if ([2, 3, 4, 5].includes(v)) diff.v = v; else delete diff.v;
    return { settings: clean(diff), seed: Math.abs(parseInt(p.get('seed'), 10)) || 1, par: par > 0 ? par : null };
  } catch { return null; }
}

// --- The notebook: what you played and whether it was fun. ----------------

const NOTE_KEY = 'ig.grove.lab.v1';

export function loadLab() {
  try {
    const s = JSON.parse(localStorage.getItem(NOTE_KEY));
    if (s && s.version === 1) return s;
  } catch { /* storage blocked: start fresh */ }
  return { version: 1, current: null, notes: [] };
}

export function saveLab(lab) {
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(lab)); } catch { /* never lose a game over storage */ }
}

// --- Autochess. ------------------------------------------------------------
// Rabbits you have caught possess your pieces, and the game plays itself
// (rules.js, autoMove). A level is the same board as ever; what you bring
// to it is a setup: for each place in your line, which piece stands there,
// which rabbit is inside it (or none: it stands still), and which way the
// rabbit faces.

/** A pattern by its name, or null. */
export const patternNamed = (name) => ALL_PATTERNS.find((p) => p.name === name) || null;

/** The rabbits you can use, { name: how many }. 'caught': one for every
    time you caught that kind (`caught` is rabbits.js caughtRabbits()).
    'all': every named kind, enough of each for every piece. */
export function rabbitPool(S, caught = {}, pieces = 8) {
  const out = {};
  for (const p of ALL_PATTERNS) {
    const n = S.autoPool === 'all' ? pieces : caught[p.name] || 0;
    if (n > 0) out[p.name] = n;
  }
  return out;
}

/** A fresh setup for a level: every piece where it was dealt, no rabbits. */
export const emptySetup = (level) => level.pieces.map((p) => ({ type: p.type, rabbit: null, mx: 1 }));

/** Does a setup use no more of each rabbit than the pool has? */
export function setupFits(setup, pool) {
  const used = {};
  for (const u of setup) if (u.rabbit) used[u.rabbit] = (used[u.rabbit] || 0) + 1;
  return Object.entries(used).every(([k, n]) => (pool[k] || 0) >= n);
}

/** The level with a setup applied: the pieces in their places, possessed. */
export function withSetup(level, setup) {
  return Object.assign(Object.create(Object.getPrototypeOf(level)), level, {
    pieces: level.pieces.map((p, i) => {
      const u = setup[i], pat = u?.rabbit && patternNamed(u.rabbit);
      const out = { x: p.x, y: p.y, type: u?.type || p.type };
      if (pat) Object.assign(out, { brain: 'possessed', pattern: pat.steps, patternName: pat.name, mx: u.mx || 1, my: 1, i: 0 });
      return out;
    })
  });
}

/** Play a set-up level to the end. Returns the last state. */
export function runAuto(day) {
  const cap = day.rules.maxMoves || 40;
  let s = initialState(day);
  while (!isOver(s) && s.t < cap) s = autoApply(s);
  return s;
}

/**
 * Try setups at random (and every one, when there are few) and keep the
 * fastest win. Autochess has no moves to search, only setups, and a setup
 * plays out the same way every time, so this is enough to say whether a
 * level can be won and roughly how fast. Returns { par, setup, tried, wins }.
 */
export function searchAuto(level, pool, { deadline = Date.now() + 1500, maxTries = 4000 } = {}) {
  const rand = rng(`auto:${level.seed}`), names = Object.keys(pool);
  const types = level.pieces.map((p) => p.type);
  let best = null, tried = 0, wins = 0;
  if (!names.length) return { par: null, setup: null, tried, wins };
  for (; tried < maxTries && Date.now() < deadline; tried++) {
    const left = { ...pool }, order = tried === 0 ? types : shuffled(types, rand);
    const setup = order.map((type) => {
      const have = names.filter((k) => left[k] > 0);
      const rabbit = have.length && rand() < 0.92 ? have[Math.floor(rand() * have.length)] : null;
      if (rabbit) left[rabbit]--;
      return { type, rabbit, mx: rand() < 0.5 ? 1 : -1 };
    });
    const end = runAuto(withSetup(level, setup));
    if (!end.won) continue;
    wins++;
    if (!best || end.t < best.par) best = { par: end.t, setup };
  }
  return { par: best?.par ?? null, setup: best?.setup ?? null, tried, wins };
}

// --- Testing layouts. ------------------------------------------------------

/**
 * Try seed, seed + 1, seed + 2... until the solver wins one with par inside
 * [parMin, parMax], reporting through `post` as it goes. With `fixed` it
 * solves exactly the seed given. Used by lab-worker.js on a background
 * thread, and directly by the page when workers are not available.
 */
export function searchLayouts({ settings, seed, parMin, parMax, maxTries = 400, maxMs = 15000, fixed = false, pool }, post) {
  if (clean(settings).mode === 'auto') return searchAutoLayouts({ settings, seed, parMin, maxMs, fixed, pool }, post);
  const t0 = Date.now(), rules = clean(settings).balance;
  let best = null, tried = 0;
  const thrown = {}; // why layouts were thrown out by the balance rules, with counts
  for (let i = 0; i < (fixed ? 1 : maxTries); i++) {
    const sd = seed + i, level = makeLevel(settings, sd);
    const r = solveLevel(level, { maxDepth: parMax, deadline: t0 + maxMs });
    tried = i + 1;
    if (r.par && (fixed || r.par >= parMin)) {
      // Winnable at the right length. Now: is it balanced?
      const balance = assess(level, r, { deadline: t0 + maxMs });
      const why = unbalanced(balance, rules);
      if (fixed || !why.length) return post({ type: 'done', seed: sd, par: r.par, exact: r.exact, line: r.line, tried, balance, why, thrown });
      for (const w of why) thrown[w] = (thrown[w] || 0) + 1;
      if (!best || !best.unbalanced) best = { seed: sd, par: r.par, exact: r.exact, line: r.line, balance, why, unbalanced: true };
    } else if (r.par && (!best || (!best.unbalanced && r.par > best.par))) {
      // Winnable but too easy: keep the hardest of those, in case nothing passes.
      best = { seed: sd, par: r.par, exact: r.exact, line: r.line };
    }
    post({ type: 'progress', tried });
    if (Date.now() - t0 > maxMs) break;
  }
  if (best && !best.balance) best.balance = assess(makeLevel(settings, best.seed), best, { deadline: Date.now() + 3000 });
  post({ type: 'failed', tried, best, thrown });
}

/** searchLayouts for autochess: try seed after seed until some setup, from
    the rabbits in `pool`, wins within the move limit and in no fewer than
    parMin turns. Par is the fastest win found. */
function searchAutoLayouts({ settings, seed, parMin, maxMs = 15000, fixed = false, pool = {} }, post) {
  const t0 = Date.now();
  let best = null, tried = 0;
  if (!Object.keys(pool).length) return post({ type: 'failed', tried: 0, best: null, noRabbits: true });
  for (let i = 0; i < (fixed ? 1 : 60); i++) {
    const sd = seed + i, level = makeLevel(settings, sd);
    const r = searchAuto(level, pool, { deadline: Math.min(t0 + maxMs, Date.now() + 1200) });
    tried = i + 1;
    const found = { seed: sd, par: r.par, setup: r.setup, setups: r.tried, wins: r.wins, auto: true };
    if (r.par && (fixed || r.par >= parMin)) return post({ type: 'done', ...found, tried });
    if (r.par && (!best || r.par > best.par)) best = found;
    post({ type: 'progress', tried });
    if (Date.now() - t0 > maxMs) break;
  }
  post({ type: 'failed', tried, best });
}

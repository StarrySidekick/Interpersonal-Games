// The lab: make any level you like from a pile of settings, play it, and
// write down whether it was fun.
//
// A level is settings + a seed. The settings say what kind of level it is;
// the seed is the dice roll that places everything. Same settings and same
// seed give the same level on any phone, which is what makes a level
// shareable as a link. New layout = same settings, new seed.

import { rng, shuffled } from '../../engine/seed.js';
import { PIECES, onBoard } from './rules.js';
import { PATTERNS } from './day.js';

export const CLASSIC = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'classic');
export const FAIRY = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'fairy');
export const ALL = [...CLASSIC, ...FAIRY];

const opts = (...pairs) => pairs.map(([v, label]) => ({ v, label }));

/** Every setting: its group, label, kind and range. The page is built from this. */
export const SCHEMA = [
  { group: 'Board', fields: [
    { key: 'w', label: 'Width', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'h', label: 'Height', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'shape', label: 'Shape', type: 'choice', def: 'rect', options: opts(
      ['rect', 'Rectangle'], ['diamond', 'Diamond'], ['round', 'Round'], ['cross', 'Cross'], ['ring', 'Ring'],
      ['hourglass', 'Hourglass'], ['L', 'L'], ['stairs', 'Stairs'], ['islands', 'Two islands'], ['cheese', 'Swiss cheese']) },
    { key: 'holes', label: 'Extra holes', type: 'int', min: 0, max: 15, def: 0 },
    { key: 'stumps', label: 'Stumps', type: 'int', min: 0, max: 12, def: 0 },
    { key: 'bramble', label: 'Bramble', type: 'bool', def: false },
    { key: 'brambleEvery', label: 'Bramble grows every', type: 'int', min: 1, max: 6, def: 2, unit: 'moves' },
    { key: 'brambleMax', label: 'Bramble stops at', type: 'int', min: 1, max: 24, def: 6, unit: 'squares' }
  ] },
  { group: 'Your side', fields: [
    { key: 'mine', label: 'Pieces', type: 'int', min: 1, max: 8, def: 3 },
    { key: 'minePool', label: 'Dealt from', type: 'pieces', def: ['knight', 'bishop', 'rook', 'grasshopper'] },
    { key: 'mineDupes', label: 'Repeats allowed', type: 'bool', def: false },
    { key: 'mineRows', label: 'Start within the bottom', type: 'int', min: 1, max: 5, def: 2, unit: 'rows' },
    { key: 'royal', label: 'Your King is royal', type: 'bool', def: false, help: 'Lose the King, lose the game.' },
    { key: 'wait', label: 'Waiting allowed', type: 'bool', def: true }
  ] },
  { group: 'Their side', fields: [
    { key: 'foes', label: 'Pieces', type: 'int', min: 1, max: 8, def: 1 },
    { key: 'foePool', label: 'Dealt from', type: 'pieces', rabbit: true, def: ['rabbit'] },
    { key: 'foeDupes', label: 'Repeats allowed', type: 'bool', def: true },
    { key: 'mirror', label: 'Mirror your pieces instead', type: 'bool', def: false, help: 'They get a copy of your hand, facing you, like chess.' },
    { key: 'foeRows', label: 'Start within the top', type: 'int', min: 1, max: 5, def: 3, unit: 'rows' },
    { key: 'rabbitBrain', label: 'Rabbits move by', type: 'choice', def: 'pattern', options: opts(['pattern', 'Hidden pattern'], ['ai', 'Thinking']) },
    { key: 'patterns', label: 'Rabbit patterns', type: 'choice', def: 'daily', options: opts(
      ['daily', 'The daily set'], ['short', 'Random, 2 hops'], ['mid', 'Random, 3 to 4'], ['long', 'Random, 5 to 8'], ['wild', 'Random, big jumps']) },
    { key: 'hops', label: 'Rabbit hops per turn', type: 'int', min: 1, max: 3, def: 1 },
    { key: 'tracks', label: 'Show rabbit tracks', type: 'bool', def: true },
    { key: 'skill', label: 'Thinking skill', type: 'choice', def: '2', options: opts(
      ['0', 'Random'], ['1', 'Greedy'], ['2', 'Two ahead'], ['3', 'Three ahead']), help: 'For everything of theirs that thinks.' },
    { key: 'style', label: 'Mood', type: 'choice', def: 'balanced', options: opts(['flee', 'Flee'], ['balanced', 'Balanced'], ['hunt', 'Hunt']) },
    { key: 'foesCapture', label: 'They can take your pieces', type: 'bool', def: true }
  ] },
  { group: 'Winning', fields: [
    { key: 'goal', label: 'You win by catching', type: 'choice', def: 'all', options: opts(['all', 'All of them'], ['any', 'Any one'], ['target', 'The marked one']) },
    { key: 'maxMoves', label: 'Move limit', type: 'int', min: 0, max: 60, def: 20, help: '0 means no limit.' },
    { key: 'first', label: 'First move', type: 'choice', def: 'you', options: opts(['you', 'You'], ['them', 'Them']) }
  ] }
];

const FIELDS = SCHEMA.flatMap((g) => g.fields);
export const defaults = () => Object.fromEntries(FIELDS.map((f) => [f.key, Array.isArray(f.def) ? [...f.def] : f.def]));

/** Keep settings inside their ranges, whatever a link or a bug hands us. */
export function clean(raw) {
  const s = defaults();
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
  return s;
}

// --- Going crazy. ----------------------------------------------------------

/** Random settings. Not uniformly random: weighted toward things that are
    likely to be playable, with a long tail of strange. */
export function crazy(rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const some = (pool, a, b) => shuffled(pool, rand).slice(0, int(a, b));
  const w = int(4, 9), h = int(4, 9);
  const mine = int(2, 5);
  const brain = rand() < 0.5 ? 'pattern' : 'ai';
  return clean({
    w, h,
    shape: rand() < 0.35 ? 'rect' : pick(['diamond', 'round', 'cross', 'ring', 'hourglass', 'L', 'stairs', 'islands', 'cheese']),
    holes: rand() < 0.6 ? 0 : int(1, 6),
    stumps: int(0, 4),
    bramble: rand() < 0.4, brambleEvery: int(1, 4), brambleMax: int(3, 12),
    mine, minePool: some(ALL, 2, 6), mineDupes: rand() < 0.3, mineRows: int(1, 2),
    royal: rand() < 0.2, wait: rand() < 0.8,
    foes: int(1, 4),
    foePool: rand() < 0.4 ? ['rabbit'] : some(['rabbit', ...ALL], 1, 4),
    foeDupes: rand() < 0.6, mirror: rand() < 0.12, foeRows: int(1, 3),
    rabbitBrain: brain, patterns: pick(['daily', 'daily', 'short', 'mid', 'long', 'wild']),
    hops: rand() < 0.8 ? 1 : int(2, 3), tracks: rand() < 0.85,
    skill: pick(['0', '1', '2', '2', '3']), style: pick(['flee', 'balanced', 'hunt']),
    foesCapture: rand() < 0.85,
    goal: pick(['all', 'all', 'any', 'target']), maxMoves: pick([0, 12, 15, 20, 25, 30]), first: rand() < 0.8 ? 'you' : 'them'
  });
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
  const need = S.mine + (S.mirror ? S.mine : S.foes) + 2;

  let holes = shapeHoles(S.shape, W, H, rand);
  for (let i = 0; i < S.holes; i++) holes.add(Math.floor(rand() * W * H));
  holes = keepLargest(W, H, holes);
  if (W * H - holes.size < need) holes = new Set(); // too little board left: fall back to the rectangle

  const day = { W, H, holes, stumps: new Set(), bramble: [], brambleAt: new Map(), every: S.brambleEvery };
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

  const bottom = rows.slice(0, S.mineRows), top = rows.slice(-S.foeRows);
  const pieces = deal(S.minePool, S.mine, S.mineDupes).map((type) => ({ type, ...place(bottom) }));

  let foes;
  if (S.mirror) {
    foes = pieces.map((p) => {
      const my = H - 1 - p.y, sq = my * W + p.x;
      const spot = onBoard(day, p.x, my) && !taken.has(sq) ? (taken.add(sq), { x: p.x, y: my }) : place(top);
      return { type: p.type, ...spot };
    });
  } else foes = deal(S.foePool, S.foes, S.foeDupes).map((type) => ({ type, ...place(top) }));

  // Brains, patterns, and which one is marked.
  foes.forEach((f) => {
    f.brain = f.type === 'rabbit' && S.rabbitBrain === 'pattern' ? 'pattern' : 'ai';
    if (f.brain === 'pattern') {
      const p = S.patterns === 'daily' ? PATTERNS[Math.floor(rand() * PATTERNS.length)] : randomPattern(S.patterns, rand);
      f.pattern = p.steps; f.patternName = p.name;
      f.mx = rand() < 0.5 ? 1 : -1; f.my = rand() < 0.5 ? 1 : -1; f.hops = S.hops;
    }
  });
  const mark = foes.find((f) => f.type === 'rabbit') || foes[0];
  if (mark && S.goal === 'target') mark.target = true;

  const middle = rows.slice(S.mineRows, rows.length - S.foeRows);
  for (let i = 0; i < S.stumps; i++) { const c = place(middle.length ? middle : rows); if (c) day.stumps.add(c.y * W + c.x); }

  if (S.bramble) {
    const seedSq = place(middle.length ? middle : rows);
    if (seedSq) {
      day.bramble.push(seedSq.y * W + seedSq.x);
      const isIn = new Set(day.bramble);
      while (day.bramble.length < S.brambleMax) {
        const frontier = [];
        for (const sq of day.bramble) {
          const x = sq % W, y = Math.floor(sq / W);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, k = ny * W + nx;
            if (!onBoard(day, nx, ny) || isIn.has(k) || taken.has(k) || day.stumps.has(k)) continue;
            if (!frontier.includes(k)) frontier.push(k);
          }
        }
        if (!frontier.length) break;
        const k = frontier[Math.floor(rand() * frontier.length)];
        day.bramble.push(k); isIn.add(k);
      }
      day.brambleAt = new Map(day.bramble.map((sq, i) => [sq, i]));
    }
  }

  return Object.assign(day, {
    seed, settings: S,
    pieces: pieces.filter((p) => p.x !== undefined),
    foes: foes.filter((f) => f.x !== undefined),
    rules: { goal: S.goal, maxMoves: S.maxMoves, wait: S.wait, foesCapture: S.foesCapture, royal: S.royal, first: S.first },
    ai: { skill: +S.skill, style: S.style },
    tracks: S.tracks
  });
}

/** One line saying what a level is. */
export function summary(S) {
  const name = (k) => PIECES[k].name;
  const pool = (a) => (a.length > 4 ? `${a.slice(0, 4).map(name).join(', ')} and ${a.length - 4} more` : a.map(name).join(', '));
  const shape = SCHEMA[0].fields.find((f) => f.key === 'shape').options.find((o) => o.v === S.shape).label;
  return `${S.w} × ${S.h} ${shape.toLowerCase()}. You: ${S.mine} from ${pool(S.minePool)}. ` +
    `Them: ${S.mirror ? 'a mirror of you' : `${S.foes} from ${pool(S.foePool)}`}` +
    `${S.foePool.includes('rabbit') && !S.mirror ? `, rabbits ${S.rabbitBrain === 'pattern' ? 'on patterns' : 'thinking'}` : ''}. ` +
    `Win by catching ${{ all: 'all', any: 'any one', target: 'the marked one' }[S.goal]}` +
    `${S.maxMoves ? ` in ${S.maxMoves} moves` : ''}.`;
}

// --- Links. ----------------------------------------------------------------
// Only what differs from the defaults goes in, to keep links short.

export function encodeLevel(settings, seed) {
  const S = clean(settings), d = defaults(), diff = {};
  for (const k of Object.keys(S)) if (JSON.stringify(S[k]) !== JSON.stringify(d[k])) diff[k] = S[k];
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `lab=${b64}&seed=${seed}`;
}

export function decodeLevel(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('lab')) return null;
  try {
    const json = decodeURIComponent(escape(atob(p.get('lab').replace(/-/g, '+').replace(/_/g, '/'))));
    return { settings: clean(JSON.parse(json || '{}')), seed: Math.abs(parseInt(p.get('seed'), 10)) || 1 };
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

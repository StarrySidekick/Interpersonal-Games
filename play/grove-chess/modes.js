// Modes (Timothy, 2026-10-08): "a mode is a collection of settings. this
// means every aspect of a mode should be composed of settings. with this in
// mind we can make some new modes easily."
//
// A mode is one flat set of settings in two layers:
// - Run settings (RUN_SCHEMA, below): what a session is (one level, a
//   descent, a golf course, autochess rounds), the hand you carry, rewards,
//   jokers, lives, how fast it gets harder, and how each level is chosen
//   (from these settings, rolled at random like Chaos, or rolled like the
//   daily).
// - Level settings: everything a single level is made of (lab.js SCHEMA:
//   board, your side, rabbits, their pieces, winning, difficulty).
//
// The modes below are presets of both. Each mode's settings panel shows
// them all, and a player's changes are kept per mode. A new mode is a new
// preset. `levelSettings` turns a mode, and where a run has got to, into the
// settings for its next level.

import { clean, defaults as levelDefaults, crazy, SCHEMA, FAIRY } from './lab.js';
import { PIECES } from './rules.js';

const opts = (...pairs) => pairs.map(([v, label]) => ({ v, label }));

export const BALLS = opts(['ice', 'On ice'], ['putt', 'Putting'], ['bounce', 'Billiard'], ['hit', 'Hit by the pieces'], ['sticky', 'Sticky'], ['ghost', 'Ghost']);

export const RUN_SCHEMA = [
  { group: 'The mode', fields: [
    { key: 'run', label: 'A session is', type: 'choice', def: 'single', options: opts(
      ['single', 'One level'], ['descent', 'A descent'], ['course', 'A golf course'], ['rounds', 'Autochess rounds']),
      help: 'One level: play it, then another. A descent: level after level, harder each time down, until every piece you have is gone. A golf course: hole after hole, strokes against par. Autochess rounds: set up, watch, and keep going while you have lives.' },
    { key: 'roll', label: 'Each level', type: 'choice', def: 'fixed', options: opts(['fixed', 'Is made from these settings'], ['chaos', 'Rolls everything at random'], ['daily', 'Rolls like the daily']),
      help: 'Rolling at random keeps only the difficulty, the pieces you allow, and the rule that it must be winnable and balanced. Rolling like the daily also insists on a high skill ceiling.' },
    { key: 'startPieces', label: 'Pieces to start with', type: 'int', min: 1, max: 8, def: 4, help: 'For a descent and autochess rounds.' },
    { key: 'maxPieces', label: 'Most pieces you can carry', type: 'int', min: 1, max: 8, def: 6 },
    { key: 'startPool', label: 'You start with', type: 'pieces', def: ['knight', 'bishop', 'rook', 'king'], help: 'Dealt from these.' },
    { key: 'rewards', label: 'Finishing a level finds you something', type: 'bool', def: true,
      help: 'A new piece while you have room; once your hand is full, an upgrade: a suit, fusing two pieces, a promotion, or a joker.' },
    { key: 'jokers', label: 'Jokers can turn up', type: 'bool', def: true, help: 'Rules for the rest of a run: Double Time, Foresight, Recruiter, Lazy Rabbits, Overtime.' },
    { key: 'findPool', label: 'Pieces you can find', type: 'pieces', def: ['king', 'knight', 'bishop', 'rook', 'queen', 'wazir', 'ferz', 'alfil', 'dabbaba', 'mao', 'zebra', 'camel', 'grasshopper', 'cannon', 'silver', 'lance', 'squirrel', 'rose', 'nightrider', 'archbishop', 'chancellor'],
      help: 'What a run offers when it finds a piece. Pieces vetoed in the catalog are left out anyway.' },
    { key: 'ramp', label: 'It gets harder', type: 'choice', def: 'steady', options: opts(['gentle', 'Gently'], ['steady', 'Steadily'], ['steep', 'Steeply']),
      help: 'Each level down, or each round: more pieces of theirs, sharper rabbits, bigger boards.' },
    { key: 'outOfMoves', label: 'Out of moves', type: 'choice', def: 'fall', options: opts(['fall', 'Fall on, with nothing found'], ['end', 'Ends the run']),
      help: 'For a descent. Losing every piece always ends it.' },
    { key: 'courseHoles', label: 'Holes on a course', type: 'int', min: 3, max: 18, def: 9 },
    { key: 'balls', label: 'Balls on a course', type: 'multi', def: BALLS.map((b) => b.v), options: BALLS,
      help: 'Each hole uses one, in turn. Sticky stops beside the first thing it passes; a ghost rolls straight through pieces.' },
    { key: 'lives', label: 'Lives', type: 'int', min: 1, max: 5, def: 3, help: 'For autochess rounds: a lost round costs one.' }
  ] }
];

const RUN_FIELDS = RUN_SCHEMA.flatMap((g) => g.fields);
const runDefaults = () => Object.fromEntries(RUN_FIELDS.map((f) => [f.key, Array.isArray(f.def) ? [...f.def] : f.def]));

/** Every setting of a mode, run and level, kept in range. */
export function cleanMode(raw = {}) {
  const run = runDefaults();
  for (const f of RUN_FIELDS) {
    const v = raw[f.key];
    if (v === undefined) continue;
    if (f.type === 'int' && Number.isFinite(+v)) run[f.key] = Math.max(f.min, Math.min(f.max, Math.round(+v)));
    if (f.type === 'bool') run[f.key] = !!v;
    if (f.type === 'choice' && f.options.some((o) => o.v === String(v))) run[f.key] = String(v);
    if ((f.type === 'multi' || f.type === 'pieces') && Array.isArray(v)) {
      const ok = v.filter((k) => (f.type === 'pieces' ? !!PIECES[k] : f.options.some((o) => o.v === k)));
      if (ok.length) run[f.key] = [...new Set(ok)];
    }
  }
  if (run.maxPieces < run.startPieces) run.maxPieces = run.startPieces;
  return { ...clean(raw), ...run };
}

// --- The modes. ------------------------------------------------------------

export const MODES = {
  daily: {
    name: 'The daily', blurb: 'One board a day, the same for everyone: easy to win in a lot of moves, hard to win in a few.',
    settings: { run: 'single', roll: 'daily', difficulty: 'normal', minEngage: 50, goal: 'all', maxMoves: 20 }
  },
  descent: {
    name: 'The descent', blurb: 'Four pieces, down and down. Each level you finish finds you another, up to six; then upgrades. A piece taken is gone for good, and the descent ends when they are all gone.',
    settings: {
      run: 'descent', roll: 'fixed', startPieces: 4, maxPieces: 6, rewards: true, jokers: true, ramp: 'steady', outOfMoves: 'fall',
      goal: 'all', w: 6, h: 6, foes: 2, foePool: ['king', 'wazir', 'ferz', 'knight'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 3, kinds: 1,
      foesCapture: true, statues: 1, maxMoves: 20, lineup: true, parMin: 3, parMax: 10, difficulty: 'any'
    }
  },
  chaos: {
    name: 'Chaos', blurb: 'A single level from a completely random mix of every rule and setting. It is always winnable and balanced, and as hard as you ask.',
    settings: { run: 'single', roll: 'chaos', difficulty: 'normal' }
  },
  golf: {
    name: 'Golf', blurb: 'A course of holes. Your pieces are the walls, the ramps and, with some balls, the clubs; sink the ball in as few strokes as you can.',
    settings: {
      run: 'course', roll: 'fixed', courseHoles: 9, goal: 'hole', foes: 0, rabbits: 1, rabbitsEat: false, rabbitMind: 'mind', traits: ['messy', 'shy', 'guard'], iq: 4,
      mine: 3, minePool: ['rook', 'bishop', 'knight', 'king', 'wazir', 'ferz', 'grasshopper'], statues: 2, ballCaptures: false, holeMoves: 'still',
      maxMoves: 15, parMin: 3, parMax: 9, w: 6, h: 6, lineup: false, mineRows: 2, foeRows: 3, difficulty: 'any'
    }
  },
  autochess: {
    name: 'Autochess', blurb: 'Put rabbits in your pieces and let them fight. Win rounds to grow your side; lose three and it is over.',
    settings: {
      run: 'rounds', roll: 'fixed', mode: 'auto', autoPool: 'all', lives: 3, startPieces: 3, maxPieces: 6, rewards: true, jokers: false,
      goal: 'all', foes: 2, foePool: ['king', 'knight', 'bishop', 'wazir'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 4, kinds: 2,
      maxMoves: 20, lineup: true, statues: 1, difficulty: 'any'
    }
  }
};

/** A mode's preset, as full settings. */
export const modeDefaults = (id) => cleanMode({ ...levelDefaults(), ...(MODES[id]?.settings || {}) });

// --- A player's changes, kept per mode. -------------------------------------

const KEY = 'ig.grove.modes.v1';
function loadAll() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.version === 1 ? s : { version: 1 }; } catch { return { version: 1 }; } }

/** A mode's settings: its preset with the player's changes on top. */
export function modeSettings(id) {
  const mine = loadAll()[id];
  return cleanMode({ ...modeDefaults(id), ...(mine || {}) });
}

/** Keep a mode's settings (only what differs from its preset). */
export function saveModeSettings(id, settings) {
  const d = modeDefaults(id), diff = {};
  for (const k of Object.keys(settings)) if (JSON.stringify(settings[k]) !== JSON.stringify(d[k])) diff[k] = settings[k];
  const all = loadAll();
  all[id] = diff;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}

export function resetModeSettings(id) { const all = loadAll(); delete all[id]; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage blocked */ } }

/** Every setting a mode's panel shows: the run's, then the level's. */
export const PANEL = [...RUN_SCHEMA, ...SCHEMA];

// --- The settings for the next level. ---------------------------------------

const RAMP = { gentle: 0.6, steady: 1, steep: 1.6 };

/**
 * A level's settings, from a mode's settings `M` and where the run is: `at`
 * is { depth } for a descent, { hole } for a course, { round } for rounds;
 * `hand` is what the run carries (run.js handSettings); `veto` the
 * catalog's vetoes. `rand` rolls anything random.
 */
export function levelSettings(M, { depth = 1, hole = 1, round = 1, hand = null, veto = [], invented = [] } = {}, rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  let S = { ...M };

  // Rolled at random: everything but the difficulty and the pieces allowed.
  if (M.roll === 'chaos' || M.roll === 'daily') {
    const fairy = FAIRY.filter((k) => !veto.includes(k));
    S = { ...crazy(rand, [...fairy, 'rabbit']), difficulty: M.difficulty, minEngage: M.minEngage, balance: 'on', solve: true };
    S.mode = 'hand'; // autochess is its own mode
    if (M.roll === 'daily') Object.assign(S, { maxMoves: Math.max(S.maxMoves || 20, 18), parMin: 4, parMax: 10, minCeiling: 6 });
  }

  const k = RAMP[M.ramp] || 1;
  if (M.run === 'descent') {
    const d = depth - 1;
    Object.assign(S, {
      w: Math.min(8, M.w + Math.floor(d * k / 3)), h: Math.min(8, M.h + Math.floor(d * k / 3)),
      foes: Math.min(7, M.foes + Math.floor(d * k / 2)), iq: Math.min(10, M.iq + Math.floor(d * k * 0.7)),
      kinds: Math.min(4, M.kinds + Math.floor(d * k / 3)),
      foePool: d * k < 2 ? M.foePool : d * k < 4 ? [...M.foePool, 'knight', 'bishop'] : d * k < 7 ? [...M.foePool, 'knight', 'bishop', 'rook', 'camel'] : [...M.foePool, 'rook', 'bishop', 'knight', 'queen', 'archbishop', 'cannon'],
      ground: d * k < 2 ? M.ground : pick([M.ground, M.ground, 'crumble', 'shrink', 'spiral']),
      shape: d * k < 3 ? M.shape : pick([M.shape, M.shape, 'diamond', 'round', 'cross', 'cheese']),
      statues: Math.min(4, M.statues + Math.floor(d * k / 3)),
      parMin: Math.min(8, M.parMin + Math.floor(d * k / 3)), parMax: Math.min(14, M.parMax + Math.floor(d * k / 3)),
      traits: d * k < 2 ? ['aggressive', 'messy'] : M.traits
    });
  }
  if (M.run === 'rounds') {
    const r = round - 1;
    Object.assign(S, { foes: Math.min(6, M.foes + Math.floor(r * k / 2)), iq: Math.min(10, M.iq + Math.floor(r * k * 0.6)), kinds: Math.min(4, M.kinds + Math.floor(r * k / 3)) });
  }
  if (M.run === 'course') {
    // Each hole its own ball, in turn, and a little more going on as the
    // course goes round: statues, a moving hole, then magic edges or a
    // board that turns.
    const balls = M.balls.length ? M.balls : ['putt'];
    const h = hole - 1;
    Object.assign(S, {
      goal: 'hole', ballMove: balls[h % balls.length], holeMoves: h < 2 ? 'still' : pick(['still', 'daily', 'short']),
      statues: Math.min(5, M.statues + Math.floor(h / 2)), shape: h < 3 ? M.shape : pick(['rect', 'L', 'cross', 'diamond', 'round', 'hourglass']),
      magic: h >= 5 && rand() < 0.3 ? 'sides' : 'none', geared: h >= 6 && rand() < 0.2, rabbits: h < 2 ? 0 : M.rabbits
    });
  }
  if (hand) Object.assign(S, hand);
  if (veto.length) S.veto = veto;
  if (invented.length) S.invented = [...(S.invented || []), ...invented];
  return clean({ ...S, solve: true });
}

/** Plain words: what this mode is. */
export function modeLine(id) { return MODES[id]?.blurb || ''; }

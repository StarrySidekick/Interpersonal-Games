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

// --- Golf courses (2026-10-08). ------------------------------------------
// Golf "needs to be fun somehow" (Timothy): a first answer is that each
// course is a place with its own character, the way a real course is. A
// course says its balls, its ground and what turns up as it goes round;
// `hole(h, pick)` gives what changes on hole h (0-based). Finishing one
// course, at any score, opens the next on the title screen. "Mixed" is the
// old course: every ball in turn, a little more each hole.

export const COURSES = {
  meadow: { name: 'The Meadow', blurb: 'Six gentle holes on open grass. Putts and sticky balls, nothing in the way to begin with.', holes: 6,
    balls: ['putt', 'sticky'], base: { statues: 1, w: 6, h: 6, rabbits: 0, iq: 3 },
    hole: (h) => ({ holeMoves: 'still', shape: h < 3 ? 'rect' : 'L', statues: 1 + Math.floor(h / 3), rabbits: h >= 4 ? 1 : 0 }) },
  pond: { name: 'The Frozen Pond', blurb: 'Nine holes on ice. The ball slides until something stops it, and from the third hole the sides of the pond join.', holes: 9,
    balls: ['ice', 'ice', 'sticky'], base: { statues: 2, w: 6, h: 6 },
    hole: (h, pick) => ({ shape: h < 2 ? 'round' : pick(['round', 'diamond', 'rect']), magic: h >= 2 ? 'sides' : 'none', statues: 2 + Math.floor(h / 3), holeMoves: 'still' }) },
  hall: { name: 'The Billiard Hall', blurb: 'Nine holes on the cloth. Diagonal shots that bank off the cushions, and balls your pieces strike.', holes: 9,
    balls: ['bounce', 'hit', 'bounce'], base: { statues: 3, w: 7, h: 6, rabbits: 0 },
    hole: (h) => ({ shape: 'rect', statues: 3 + Math.floor(h / 3), holeMoves: h >= 5 ? 'short' : 'still' }) },
  clock: { name: 'The Clockwork Links', blurb: 'Nine holes on gears. The board turns, the hole wanders, and the edges join late on.', holes: 9,
    balls: ['putt', 'bounce', 'ice'], base: { statues: 2, w: 6, h: 6 },
    hole: (h, pick) => ({ geared: h >= 1, holeMoves: h < 3 ? 'short' : pick(['short', 'mid']), magic: h >= 6 ? 'sides' : 'none', shape: pick(['rect', 'cross', 'diamond']) }) },
  hollow: { name: 'The Haunted Hollow', blurb: 'Nine holes after dark. Ghost balls pass through anything, rabbits wander the fairways, and the ground gives way.', holes: 9,
    balls: ['ghost', 'sticky', 'ghost'], base: { statues: 2, w: 7, h: 7, rabbits: 1, iq: 5 },
    hole: (h, pick) => ({ shape: pick(['hourglass', 'cross', 'L', 'cheese']), rabbits: Math.min(3, 1 + Math.floor(h / 3)), ground: h >= 4 ? pick(['solid', 'crumble']) : 'solid', holeMoves: h >= 3 ? 'short' : 'still' }) }
};
export const COURSE_ORDER = Object.keys(COURSES);

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
      help: 'A new piece while you have room; once your hand is full, an upgrade: a suit, fusing two pieces, or a joker. Pieces of theirs you take are claimed, and can be combined with yours after the level.' },
    { key: 'jokers', label: 'Jokers can turn up', type: 'bool', def: true, help: 'Rules for the rest of a run: Double Time, Foresight, Recruiter, Lazy Rabbits, Overtime.' },
    { key: 'findPool', label: 'Pieces you can find', type: 'pieces', def: ['king', 'knight', 'bishop', 'rook', 'queen', 'wazir', 'ferz', 'alfil', 'dabbaba', 'mao', 'zebra', 'camel', 'grasshopper', 'cannon', 'silver', 'lance', 'squirrel', 'rose', 'nightrider', 'archbishop', 'chancellor'],
      help: 'What a run offers when it finds a piece. Pieces vetoed in the catalog are left out anyway.' },
    { key: 'startDifficulty', label: 'First level\u2019s difficulty', type: 'int', min: 1, max: 10, def: 1, unit: 'of 10',
      help: 'For a descent. The first level is found at this difficulty (measured: a novice bot plays it two dozen times), and every level after aims a little higher, as fast as "It gets harder" says.' },
    { key: 'ramp', label: 'It gets harder', type: 'choice', def: 'steady', options: opts(['gentle', 'Gently'], ['steady', 'Steadily'], ['steep', 'Steeply']),
      help: 'Each level down, or each round: a higher difficulty aimed at (gently 0.35 a level, steadily 0.6, steeply 1), more pieces of theirs and sharper rabbits.' },
    { key: 'boardGrows', label: 'The board grows', type: 'bool', def: false,
      help: 'For a descent. Off: every level is the board size set below (6 by 6). On: a row and a column more every few levels, up to 8 by 8.' },
    { key: 'carry', label: 'What you find carries over', type: 'bool', def: true,
      help: 'For a descent. Every piece you find joins your roster, and you can start a later descent with any of them. Going deeper lights waystones for good: at depth 4 every descent starts with an upgrade, at depth 7 with one more piece, at depth 10 with two upgrades.' },
    { key: 'shop', label: 'Spend acorns in a shop', type: 'bool', def: false,
      help: 'For autochess rounds. Each round earns acorns (three for a win, one for a loss, one per piece of theirs taken), spent between rounds on pieces and upgrades in place of a free pick.' },
    { key: 'outOfMoves', label: 'Out of moves', type: 'choice', def: 'fall', options: opts(['fall', 'Fall on, with nothing found'], ['end', 'Ends the run']),
      help: 'For a descent. Losing every piece always ends it.' },
    { key: 'courseName', label: 'Course', type: 'choice', def: 'meadow', options: opts(...COURSE_ORDER.map((k) => [k, COURSES[k].name]), ['mixed', 'Mixed: every ball in turn']),
      help: 'Each course has its own holes, balls and ground. The title screen offers the ones you have opened: finishing a course opens the next.' },
    { key: 'courseHoles', label: 'Holes on a mixed course', type: 'int', min: 3, max: 18, def: 9 },
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
    settings: { run: 'single', roll: 'daily', difficulty: 'normal', aim: 4, minEngage: 50, goal: 'all', royal: false, showdown: false, maxMoves: 20 }
  },
  descent: {
    name: 'The descent', blurb: 'Four pieces, your King among them, down and down. Take their King to fall to the next level, where you find another piece, up to six; then upgrades. A piece taken is gone for good, and if they take your King the descent is over.',
    settings: {
      run: 'descent', roll: 'fixed', startPieces: 4, maxPieces: 6, rewards: true, jokers: true, ramp: 'steady', outOfMoves: 'fall',
      goal: 'king', royal: true, showdown: true, w: 6, h: 6, foes: 2, foePool: ['king', 'wazir', 'ferz', 'knight'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 3, kinds: 1,
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
      run: 'course', roll: 'fixed', courseName: 'meadow', courseHoles: 9, goal: 'hole', royal: false, showdown: false, foes: 0, rabbits: 1, rabbitsEat: false, rabbitMind: 'mind', traits: ['messy', 'shy', 'guard'], iq: 4,
      mine: 3, minePool: ['rook', 'bishop', 'knight', 'king', 'wazir', 'ferz', 'grasshopper'], statues: 2, ballCaptures: false, holeMoves: 'still',
      maxMoves: 15, parMin: 3, parMax: 9, w: 6, h: 6, lineup: false, mineRows: 2, foeRows: 3, difficulty: 'any'
    }
  },
  autochess: {
    name: 'Autochess', blurb: 'Put rabbits in your pieces and let them fight. Win rounds to grow your side; lose three and it is over.',
    settings: {
      run: 'rounds', roll: 'fixed', mode: 'auto', autoPool: 'all', lives: 3, startPieces: 3, maxPieces: 6, rewards: true, shop: true, jokers: false,
      goal: 'all', royal: false, showdown: false, foes: 2, foePool: ['king', 'knight', 'bishop', 'wazir'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 4, kinds: 2,
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

// --- Which settings a mode's panel shows (2026-10-09). -----------------------
// Timothy: "settings for each mode should be relevant to that mode, with some
// sort of nesting philosophy... there shouldn't be autochess options in the
// descent mode." The mode is `run`; each rule says when a setting matters.

const runIs = (...r) => (S) => r.includes(S.run);
const hasBall = (S) => ['hole', 'descent', 'mix'].includes(S.goal);
const SHOWN = {
  // The session.
  startPieces: runIs('descent', 'rounds'), maxPieces: runIs('descent', 'rounds'), startPool: runIs('descent', 'rounds'),
  rewards: runIs('descent', 'rounds'), jokers: runIs('descent', 'rounds'), findPool: runIs('descent', 'rounds'), ramp: runIs('descent', 'rounds'),
  carry: runIs('descent'), startDifficulty: runIs('descent'), boardGrows: runIs('descent'), outOfMoves: runIs('descent'),
  shop: runIs('rounds'), lives: runIs('rounds'),
  courseName: runIs('course'), courseHoles: (S) => S.run === 'course' && S.courseName === 'mixed', balls: (S) => S.run === 'course' && S.courseName === 'mixed',
  // How you play: autochess's own.
  mode: runIs('rounds'), autoPool: runIs('rounds'),
  // Difficulty: the descent aims for its own, level by level.
  difficulty: (S) => S.run !== 'descent', aim: (S) => S.run !== 'descent',
  // Your side: a run brings its own hand.
  mine: (S) => !['descent', 'rounds'].includes(S.run), minePool: (S) => !['descent', 'rounds'].includes(S.run), mineDupes: (S) => !['descent', 'rounds'].includes(S.run),
  royal: (S) => S.run !== 'course',
  // Pieces can always take pieces: a setting for the workshop only.
  foesCapture: (S) => S.run == null, dealKing: (S) => S.run !== 'course' && S.royal, showdown: (S) => S.run !== 'course',
  // Settings that only matter when another one is on.
  shrinkEvery: (S) => S.ground === 'shrink' || S.ground === 'spiral',
  iq: (S) => S.rabbitMind === 'mind', traits: (S) => S.rabbitMind === 'mind',
  kinds: (S) => S.darkBrain === 'possessed', skill: (S) => S.darkBrain === 'think', style: (S) => S.darkBrain === 'think',
  goal: (S) => S.run !== 'course',
  holeMoves: hasBall, ballMove: (S) => hasBall(S) && !(S.run === 'course' && S.courseName !== 'mixed'), ballCaptures: hasBall, ballStops: hasBall
};

/** Does this setting matter for these settings (the mode included)? */
// With no mode (the workshop), only the rules between settings apply.
const DEPENDS = ['shrinkEvery', 'iq', 'traits', 'kinds', 'skill', 'style', 'holeMoves', 'ballMove', 'ballCaptures', 'ballStops', 'dealKing'];
export const settingShown = (key, S) => (!SHOWN[key] ? true : S.run == null && !DEPENDS.includes(key) ? true : SHOWN[key](S));

/** Settings the descent raises level by level: their value is the first level's. */
const CLIMBS = ['foes', 'iq', 'kinds', 'statues', 'foePool', 'parMin', 'parMax', 'traits', 'w', 'h'];
export const settingNote = (key, S) => (S.run === 'descent' && CLIMBS.includes(key) && (key !== 'w' && key !== 'h' || S.boardGrows) ? ' (first level, then climbs)' : '');

/** Every setting a mode's panel shows: the run's, then the level's. */
export const PANEL = [...RUN_SCHEMA, ...SCHEMA];

// --- The settings for the next level. ---------------------------------------

const RAMP = { gentle: 0.6, steady: 1, steep: 1.6 };
/** How much higher each descent level aims, in difficulty points. */
const AIM_STEP = { gentle: 0.35, steady: 0.6, steep: 1 };

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
    S = { ...crazy(rand, [...fairy, 'rabbit']), difficulty: M.difficulty, aim: M.aim, minEngage: M.minEngage, balance: 'on', solve: true };
    S.mode = 'hand'; // autochess is its own mode
    // Pieces can always take pieces (Timothy, 2026-10-09): never rolled off.
    S.foesCapture = true;
    // Chaos rolls everything but how you win: that is the mode's own
    // (by default, take their King and keep yours, with the showdown).
    if (M.roll === 'chaos') Object.assign(S, { goal: M.goal, royal: M.royal, showdown: M.showdown, w: M.w, h: M.h });
    if (M.roll === 'daily') Object.assign(S, { maxMoves: Math.max(S.maxMoves || 20, 18), parMin: 4, parMax: 10, minCeiling: 6 });
  }

  const k = RAMP[M.ramp] || 1;
  if (M.run === 'descent') {
    const d = depth - 1;
    Object.assign(S, {
      // How hard a level is, measured, is the thing that climbs (2026-10-09):
      // the first level is very easy, then each aims a little higher. The
      // settings below climb with it, more slowly, so boards near the aim
      // turn up often enough for the tester to find one.
      aim: Math.min(10, Math.round(M.startDifficulty + d * AIM_STEP[M.ramp])),
      w: M.boardGrows ? Math.min(8, M.w + Math.floor(d * k / 3)) : M.w, h: M.boardGrows ? Math.min(8, M.h + Math.floor(d * k / 3)) : M.h,
      foes: Math.min(7, M.foes + Math.floor(d * k / 4)), iq: Math.min(10, M.iq + Math.floor(d * k * 0.35)),
      kinds: Math.min(4, M.kinds + Math.floor(d * k / 3)),
      foePool: d * k < 3 ? M.foePool : d * k < 7 ? [...M.foePool, 'knight', 'bishop'] : d * k < 11 ? [...M.foePool, 'knight', 'bishop', 'rook', 'camel'] : [...M.foePool, 'rook', 'bishop', 'knight', 'queen', 'archbishop'],
      ground: d * k < 2 ? M.ground : pick([M.ground, M.ground, 'crumble', 'shrink', 'spiral']),
      shape: d * k < 3 ? M.shape : pick([M.shape, M.shape, 'diamond', 'round', 'cross', 'cheese']),
      statues: Math.min(4, M.statues + Math.floor(d * k / 3)),
      parMin: Math.min(8, M.parMin + Math.floor(d * k / 6)), parMax: Math.min(14, M.parMax + Math.floor(d * k / 3)),
      // The first levels' rabbits are clumsy, not aggressive: that, not
      // switching their captures off, is what makes the start easy.
      traits: d * k < 2 ? ['messy'] : M.traits
    });
  }
  if (M.run === 'rounds') {
    const r = round - 1;
    Object.assign(S, { foes: Math.min(6, M.foes + Math.floor(r * k / 2)), iq: Math.min(10, M.iq + Math.floor(r * k * 0.6)), kinds: Math.min(4, M.kinds + Math.floor(r * k / 3)) });
  }
  if (M.run === 'course' && COURSES[M.courseName]) {
    // A named course: its own balls, ground and turns, hole by hole.
    const C = COURSES[M.courseName], h = hole - 1;
    Object.assign(S, C.base, { goal: 'hole', ballMove: C.balls[h % C.balls.length], magic: 'none', geared: false, ground: 'solid' }, C.hole(h, pick));
  } else if (M.run === 'course') {
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

/** How many holes this course is. */
export const holesOf = (M) => COURSES[M.courseName]?.holes ?? M.courseHoles;

/** Plain words: what this mode is. */
export function modeLine(id) { return MODES[id]?.blurb || ''; }

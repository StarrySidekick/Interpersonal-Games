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
// - Level settings: everything a single level is made of (lab.js SCHEMA).
//
// Both are grouped by the eight parts of a mode (lab.js PARTS, 2026-10-13):
// format, board, armies, control, goal, growth, difficulty, information.
// `describe` (below) says a mode in eight lines, one for each.
//
// The modes below are presets of both. Each mode's settings panel shows
// them all, and a player's changes are kept per mode. A new mode is a new
// preset. `levelSettings` turns a mode, and where a run has got to, into the
// settings for its next level.

import { clean, defaults as levelDefaults, crazy, SCHEMA, FAIRY, PARTS, part, GOAL_PILL } from './lab.js';
import { VARIANTS, readFen } from './variants.js';
import { PIECES } from './rules.js';
import { CONFIG } from './config.js';

const opts = (...pairs) => pairs.map(([v, label]) => ({ v, label }));

// "There's no such thing as a sticky ball" (Timothy, 2026-10-13): gone from
// the list; a link that names it still reads (lab.js).
export const BALLS = opts(['ice', 'On ice'], ['putt', 'Putting'], ['bounce', 'Billiard'], ['hit', 'Hit by the pieces'], ['ghost', 'Ghost']);

// --- Golf courses (2026-10-08). ------------------------------------------
// Golf "needs to be fun somehow" (Timothy): a first answer is that each
// course is a place with its own character, the way a real course is. A
// course says its ground and what turns up as it goes round; `hole(h,
// pick)` gives what changes on hole h (0-based). Finishing one course, at
// any score, opens the next on the title screen. "Mixed" is a course of
// every hazard in turn.
//
// Reworked 2026-10-13 (Timothy): "The only pieces in the game should be
// sliders, as leapers don't really make any sense. sliders move the ball,
// the ball doesn't move on its own. There's no such thing as a sticky ball.
// the win condition is reaching par or better ... there can be obstacles
// like gates and clouds". So every ball is hit by your sliders and slides
// on until something stops it, and each course is told apart by its
// hazards: sand stops the ball, water sends it back to the tee, gates rise
// and fall, clouds drift and stop it.

export const COURSES = {
  meadow: { name: 'The Meadow', blurb: 'Six gentle holes on open grass. A statue or two, then sand that stops the ball dead.', holes: 6,
    balls: ['hit'], base: { statues: 1, w: 6, h: 6 },
    hole: (h) => ({ holeMoves: 'still', shape: h < 3 ? 'rect' : 'L', statues: 1 + Math.floor(h / 3), sand: h < 1 ? 0 : Math.min(4, 1 + Math.floor(h / 2)) }) },
  pond: { name: 'The Lily Pond', blurb: 'Nine holes round the water. Your pieces cannot cross it, and a ball that rolls in goes back to the tee. From the third hole the sides of the pond join.', holes: 9,
    balls: ['hit'], base: { statues: 1, w: 6, h: 6 },
    hole: (h, pick) => ({ shape: h < 2 ? 'round' : pick(['round', 'diamond', 'rect']), magic: h >= 2 ? 'sides' : 'none', statues: 1 + Math.floor(h / 4), water: Math.min(5, 1 + Math.floor(h / 2)), holeMoves: 'still' }) },
  hall: { name: 'The Gatehouse', blurb: 'Nine holes through the gates. They rise and fall every turn, so a shot has to be timed; late on, the hole wanders.', holes: 9,
    balls: ['hit'], base: { statues: 2, w: 7, h: 6 },
    hole: (h) => ({ shape: 'rect', gates: Math.min(5, 1 + Math.floor(h / 2)), statues: 2 + Math.floor(h / 4), holeMoves: h >= 5 ? 'short' : 'still' }) },
  clock: { name: 'The Clockwork Links', blurb: 'Nine holes on gears. The board turns, the hole wanders, bunkers appear, and the edges join late on.', holes: 9,
    balls: ['hit'], base: { statues: 2, w: 6, h: 6 },
    hole: (h, pick) => ({ geared: h >= 1, holeMoves: h < 3 ? 'short' : pick(['short', 'mid']), magic: h >= 6 ? 'sides' : 'none', shape: pick(['rect', 'cross', 'diamond']), sand: Math.floor(h / 3) }) },
  hollow: { name: 'The Haunted Hollow', blurb: 'Nine holes after dark. Clouds drift over the fairways and stop the ball, the ground gives way, and late on there is water.', holes: 9,
    balls: ['hit'], base: { statues: 2, w: 7, h: 7 },
    hole: (h, pick) => ({ shape: pick(['hourglass', 'cross', 'L', 'cheese']), clouds: Math.min(3, 1 + Math.floor(h / 3)), ground: h >= 4 ? pick(['solid', 'crumble']) : 'solid', holeMoves: h >= 3 ? 'short' : 'still', water: h >= 6 ? 2 : 0 }) }
};
// Golf's own pieces: sliders only, since a leaper would hop the ball.
export const GOLF_POOL = ['rook', 'bishop', 'queen', 'shortrook', 'tallrook'];
export const COURSE_ORDER = Object.keys(COURSES);

export const RUN_SCHEMA = [
  { ...part('format'), fields: [
    { key: 'run', label: 'A session is', type: 'choice', def: 'single', options: opts(
      ['single', 'One level'], ['descent', 'A descent'], ['course', 'A golf course'], ['rounds', 'Autochess rounds']),
      help: 'One level: play it, then another. A descent: level after level, harder each time down, until every piece you have is gone. A golf course: hole after hole, strokes against par. Autochess rounds: set up, watch, and keep going while you have lives.' },
    { key: 'roll', label: 'Each level', type: 'choice', def: 'fixed', options: opts(['fixed', 'Is made from these settings'], ['chaos', 'Rolls everything at random'], ['daily', 'Rolls like the daily']),
      help: 'Rolling at random keeps only the difficulty, the pieces you allow, and the rule that it must be winnable and balanced. Rolling like the daily also insists on a high skill ceiling.' },
    { key: 'outOfMoves', label: 'Out of moves', type: 'choice', def: 'fall', options: opts(['fall', 'Fall on, with nothing found'], ['end', 'Ends the run']),
      help: 'For a descent. Losing every piece always ends it.' },
    { key: 'lives', label: 'Lives', type: 'int', min: 1, max: 5, def: 3, help: 'For autochess rounds: a lost round costs one.' },
    { key: 'courseName', label: 'Course', type: 'choice', def: 'meadow', options: opts(...COURSE_ORDER.map((k) => [k, COURSES[k].name]), ['mixed', 'Mixed: every ball in turn']),
      help: 'Each course has its own holes, balls and ground. The title screen offers the ones you have opened: finishing a course opens the next.' },
    { key: 'courseHoles', label: 'Holes on a mixed course', type: 'int', min: 3, max: 18, def: 9 }
  ] },
  { ...part('armies'), fields: [
    { key: 'startPieces', sub: 'yours', label: 'Pieces to start with', type: 'int', min: 1, max: 8, def: 4, help: 'For a descent and autochess rounds.' },
    { key: 'startPool', sub: 'yours', label: 'You start with', type: 'pieces', def: ['knight', 'bishop', 'rook', 'king'], help: 'Dealt from these.' },
    { key: 'foeLine', sub: 'theirs', label: 'Their line', type: 'choice', def: 'mirror', options: opts(['mirror', 'The same files as yours, like Microchess'], ['turned', 'Yours reversed, as if turned round the board']),
      help: 'For a descent with one upgrade a board, where both sides start with "You start with". The same files: their first piece stands opposite your first, like Microchess. Reversed (Timothy, 2026-10-13): their line is yours read the other way, so each side, looking from its own end, has the same piece on its left.' },
    { key: 'balls', sub: 'ball', label: 'Balls on a course', type: 'multi', def: BALLS.map((b) => b.v), options: BALLS,
      help: 'Each hole uses one, in turn. Sticky stops beside the first thing it passes; a ghost rolls straight through pieces.' }
  ] },
  { ...part('growth'), fields: [
    { key: 'maxPieces', label: 'Most pieces you can carry', type: 'int', min: 1, max: 8, def: 6 },
    { key: 'rewards', label: 'Finishing a level finds you something', type: 'bool', def: true,
      help: 'A new piece while you have room; once your hand is full, an upgrade: a suit, fusing two pieces, or a joker. Pieces of theirs you take are claimed, and can be combined with yours after the level.' },
    { key: 'upgrades', label: 'Between levels', type: 'choice', def: 'finds', options: opts(['finds', 'Find pieces, then upgrades'], ['each', 'One upgrade a board, each side']),
      help: 'Find pieces, then upgrades: a new piece while you have room, then suits, fusing and jokers; pieces of theirs you take can be combined with yours. One upgrade a board, each side (Timothy, 2026-10-12): every new board you choose one of two, a piece to combine with one of yours or a suit for one, and they get one at random. They carry a lineup down as you do, and a Rabbit with it.' },
    { key: 'findPool', label: 'Pieces you can find', type: 'pieces', def: ['king', 'knight', 'bishop', 'rook', 'queen', 'wazir', 'ferz', 'alfil', 'dabbaba', 'mao', 'zebra', 'camel', 'grasshopper', 'cannon', 'silver', 'lance', 'squirrel', 'rose', 'nightrider', 'archbishop', 'chancellor',
      'gold', 'copper', 'leopard', 'tiger', 'kirin', 'phoenix', 'elephant', 'woody', 'alibaba', 'threeleaper', 'tripper', 'frog', 'vao', 'bunny', 'shortrook', 'tallrook'],
      help: 'What a run offers when it finds a piece. Pieces vetoed in the catalog are left out anyway.' },
    { key: 'jokers', label: 'Jokers can turn up', type: 'bool', def: true, help: 'Rules for the rest of a run: Double Time, Foresight, Recruiter, Lazy Rabbits, Overtime.' },
    { key: 'shop', label: 'Spend acorns in a shop', type: 'bool', def: false,
      help: 'For autochess rounds. Each round earns acorns (three for a win, one for a loss, one per piece of theirs taken), spent between rounds on pieces and upgrades in place of a free pick.' },
    { key: 'carry', label: 'What you find carries over', type: 'bool', def: true,
      help: 'For a descent. Every piece you find joins your roster, and you can start a later descent with any of them. Going deeper lights waystones for good: at depth 4 every descent starts with an upgrade, at depth 7 with one more piece, at depth 10 with two upgrades.' },
    { key: 'keepsakes', label: 'Waystones give upgrades at the start', type: 'bool', def: false,
      help: 'For a descent. Off (Timothy, 2026-10-10: "decent mode should give no upgrade when starting"): every descent starts with only its pieces. On: the waystones at depth 4 and 10 each give an upgrade of your choice before the first level.' },
    { key: 'fairyFrom', label: 'Fairy pieces from depth', type: 'int', min: 1, max: 20, def: 4,
      help: 'For a descent. Above this depth only classic pieces turn up, on either side and among what you find, so a new player first meets pieces whose moves they know (Timothy, 2026-10-10). 1: fairy pieces from the start.' },
    { key: 'growAt', label: 'The board is 7 by 7 from depth', type: 'int', min: 0, max: 30, def: 0,
      help: 'For a descent with one upgrade a board. 0: never. From this depth the board is 7 by 7, and each side gets two more pieces to fill its row.' },
    { key: 'boardGrows', label: 'The board grows', type: 'bool', def: false,
      help: 'For a descent. Off: every level is the board size set under Board (6 by 6). On: a row and a column more every few levels, up to 8 by 8.' }
  ] },
  { ...part('difficulty'), fields: [
    { key: 'startDifficulty', label: 'First level\u2019s difficulty', type: 'int', min: 1, max: 10, def: 1, unit: 'of 10',
      help: 'For a descent. The first level is found at this difficulty (measured: a novice bot plays it two dozen times), and every level after aims a little higher, as fast as "It gets harder" says.' },
    { key: 'ramp', label: 'It gets harder', type: 'choice', def: 'steady', options: opts(['gentle', 'Gently'], ['steady', 'Steadily'], ['steep', 'Steeply']),
      help: 'Each level down, or each round: a higher difficulty aimed at (gently 0.35 a level, steadily 0.6, steeply 1), more pieces of theirs and sharper rabbits.' }
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
      const ok = v.filter((k) => (f.type === 'pieces' ? !!PIECES[k] && PIECES[k].kind !== 'neutral' : f.options.some((o) => o.v === k)));
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
    // 2026-10-12 and 13 (Timothy): a five by five board, a middle row of
    // statues that opens one a turn, one Rabbit leading their side, one
    // upgrade a board for each side, nothing lost for good, no layout step,
    // no clouds, no balancing search; seven by seven from depth 6. The line
    // (later on 2026-10-13): "tall rook, bishop, king, knight, short rook.
    // the enemy side is the same but reversed" (and later still mirrored
    // instead, on the same files like chess: "descent by default should
    // have mirrors pieces, not reversed"). Then (later the same day)
    // five by six, with a row of ghosts in front of each side in place of
    // the statues and the clouds: "decent games also now start on a 5x6
    // board to allow a bit more room". Then (later still) rook, bishop,
    // King, knight, pawn, mirrored; a rabbit riding their pieces, hopping
    // from one to another every three turns, whose piece is the one to take;
    // pawns that become a copy of another of yours; and a draft of suits and
    // weapons only.
    name: 'The descent', blurb: 'Rook, bishop, King, knight and pawn each, a full row on a five by six board; theirs stand opposite, each facing its twin, as in chess. In front of each side stands a row of ghosts: yours let your pieces through and vanish as they pass, theirs stop you. A rabbit rides their pieces; moving it to another of their pieces costs them their turn. Take the piece it is on to fall to the next board, where you choose a suit or a weapon, one of two, and they get one too. A pawn that reaches the far row becomes a copy of another of yours. From depth 6 the board is seven by seven. If they take your King the descent is over.',
    settings: {
      run: 'descent', roll: 'fixed', startPieces: 5, maxPieces: 7, startPool: ['rook', 'bishop', 'king', 'knight', 'pawn'], foeLine: 'mirror', rewards: true, jokers: false, ramp: 'steady', outOfMoves: 'fall', upgrades: 'each', growAt: 6, carry: false,
      goal: 'carrier', rabbitMove: 'choose', rabbitHop: 3, rabbitSides: 'theirs', promote: 'copy', royal: true, showdown: true, w: 5, h: 6, foes: 4, foePool: ['knight', 'bishop', 'rook'], darkBrain: 'think', skill: '1', style: 'balanced', rabbitMind: 'mind', iq: 3, kinds: 1,
      foesCapture: true, statues: 0, statueRow: false, ghosts: true, maxMoves: 20, lineup: true, inOrder: true, arrange: false, cloud: false, parMin: 3, parMax: 10, difficulty: 'any'
    }
  },
  kungfu: {
    name: 'Kung fu descent', blurb: 'The descent with no turns, after Kung-Fu Chess. Move any piece whenever it is ready, and so do they; moves take time to travel, and a piece that moved must rest. Take their King to fall to the next level.',
    settings: {
      run: 'descent', roll: 'fixed', realtime: true, startPieces: 6, maxPieces: 8, rewards: true, jokers: true, ramp: 'steady', outOfMoves: 'fall',
      goal: 'king', royal: true, showdown: false, cloud: false, w: 6, h: 6, foes: 2, foePool: ['king', 'pawn', 'knight', 'bishop'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 3, kinds: 1,
      foesCapture: true, statues: 1, maxMoves: 0, lineup: true, parMin: 3, parMax: 10, difficulty: 'any'
    }
  },
  chaos: {
    name: 'Chaos', blurb: 'A single level from a completely random mix of every rule and setting. It is always winnable and balanced, and as hard as you ask.',
    settings: { run: 'single', roll: 'chaos', difficulty: 'normal', fullRow: false }
  },
  golf: {
    name: 'Golf', blurb: 'A course of holes. Your sliders are the clubs: move one into the ball and it slides on the same way until something stops it. Sink it at par or better to play the next hole; over par, play the hole again.',
    settings: {
      run: 'course', roll: 'fixed', courseName: 'meadow', courseHoles: 9, goal: 'hole', royal: false, showdown: false, fullRow: false, cloud: false, foes: 0, rabbits: 0, rabbitsEat: false, rabbitMind: 'mind', traits: ['messy', 'shy', 'guard'], iq: 4,
      mine: 3, minePool: GOLF_POOL, statues: 2, statuesTake: false, ballCaptures: false, ballMove: 'hit', holeMoves: 'still',
      maxMoves: 15, parMin: 3, parMax: 9, w: 6, h: 6, lineup: false, mineRows: 2, foeRows: 3, difficulty: 'any'
    }
  },
  variants: {
    name: 'Chess variants', blurb: 'Real chess variants, small and strange, from their own starting positions, against a side that thinks. Pick one below.',
    settings: { run: 'single', roll: 'fixed', variant: 'gardner', darkBrain: 'think', skill: '2', style: 'balanced', maxMoves: 0, showReach: true, solve: false }
  },
  trials: {
    // A layout found in the piece trials (trials/), played against a side
    // that thinks. The position comes with the link; on its own this mode
    // plays the descent's lineup on an open five by six board.
    name: 'Piece trials', blurb: 'A layout from the piece trials: the same army on each side, theirs thinking. Take their King and keep yours.',
    settings: { run: 'single', roll: 'fixed', position: '[shortrook]nkb[tallrook]/5/5/5/5/[Tallrook]BKN[Shortrook]', darkBrain: 'think', skill: '2', style: 'balanced', maxMoves: 0, showReach: true, solve: false, cloud: false, showdown: false }
  },
  autochess: {
    name: 'Autochess', blurb: 'Put rabbits in your pieces and let them fight. Win rounds to grow your side; lose three and it is over.',
    settings: {
      run: 'rounds', roll: 'fixed', mode: 'auto', autoPool: 'all', oneMove: false, fullRow: false, cloud: false, lives: 3, startPieces: 3, maxPieces: 6, rewards: true, shop: true, jokers: false,
      goal: 'all', royal: false, showdown: false, foes: 2, foePool: ['king', 'knight', 'bishop', 'wazir'], darkBrain: 'possessed', rabbitMind: 'mind', iq: 4, kinds: 2,
      maxMoves: 20, lineup: true, statues: 1, difficulty: 'any'
    }
  }
};

// Timothy's changes to the presets, from config.js (the settings console).
for (const [id, over] of Object.entries(CONFIG.modes || {})) if (MODES[id] && over) Object.assign(MODES[id].settings, over);

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
  upgrades: runIs('descent'), growAt: (S) => S.run === 'descent' && S.upgrades === 'each', foeLine: (S) => S.run === 'descent' && S.upgrades === 'each',
  carry: runIs('descent'), keepsakes: (S) => S.run === 'descent' && S.carry, fairyFrom: runIs('descent'), startDifficulty: runIs('descent'), boardGrows: runIs('descent'), outOfMoves: runIs('descent'),
  shop: runIs('rounds'), lives: runIs('rounds'),
  courseName: runIs('course'), courseHoles: (S) => S.run === 'course' && S.courseName === 'mixed', balls: () => false, // every golf ball is hit (2026-10-13)
  // How you play: autochess's own.
  mode: runIs('rounds'), autoPool: runIs('rounds'),
  // Difficulty: the descent aims for its own, level by level.
  difficulty: (S) => S.run !== 'descent', aim: (S) => S.run !== 'descent',
  // Your side: a run brings its own hand.
  arrange: (S) => S.run !== 'rounds',
  variant: runIs('single'),
  fullRow: (S) => S.run !== 'course', foes: (S) => !S.fullRow, cloudOwn: (S) => S.cloud,
  kfStep: (S) => S.realtime, kfCool: (S) => S.realtime, kfFoeCool: (S) => S.realtime, kfFoeGap: (S) => S.realtime,
  mine: (S) => !['descent', 'rounds'].includes(S.run) && !S.fullRow, minePool: (S) => !['descent', 'rounds'].includes(S.run), mineDupes: (S) => !['descent', 'rounds'].includes(S.run),
  royal: (S) => S.run !== 'course',
  // Pieces can always take pieces: a setting for the workshop only.
  foesCapture: (S) => S.run == null, dealKing: (S) => S.run !== 'course' && S.royal, showdown: (S) => S.run !== 'course',
  // Settings that only matter when another one is on.
  shrinkEvery: (S) => S.ground === 'shrink' || S.ground === 'spiral',
  iq: (S) => S.rabbitMind === 'mind', traits: (S) => S.rabbitMind === 'mind',
  kinds: (S) => S.darkBrain === 'possessed', skill: (S) => S.darkBrain === 'think', style: (S) => S.darkBrain === 'think',
  goal: (S) => S.run !== 'course',
  captureN: (S) => S.goal === 'capture', rabbitMove: (S) => S.goal === 'carrier', rabbitHop: (S) => S.goal === 'carrier' && S.rabbitMove === 'random', rabbitSides: (S) => S.goal === 'carrier',
  holeMoves: hasBall, ballMove: (S) => hasBall(S) && S.run !== 'course', ballCaptures: hasBall, ballStops: hasBall, sand: hasBall, water: hasBall
};

/** Does this setting matter for these settings (the mode included)? */
// With no mode (the workshop), only the rules between settings apply.
const DEPENDS = ['kfStep', 'kfCool', 'kfFoeCool', 'kfFoeGap', 'cloudOwn', 'shrinkEvery', 'iq', 'traits', 'kinds', 'skill', 'style', 'holeMoves', 'ballMove', 'ballCaptures', 'ballStops', 'dealKing', 'captureN', 'rabbitMove', 'rabbitHop', 'rabbitSides'];
const VARIANT_KEYS = ['variant', 'skill', 'style', 'maxMoves', 'showReach', 'showMyReach', 'showGuards', 'showSafe', 'showBeacons', 'showPins', 'realtime', 'kfStep', 'kfCool', 'kfFoeCool', 'kfFoeGap', 'iq'];
export const settingShown = (key, S) => {
  // A chess variant brings its own board, pieces and rules: only how they
  // think, the move limit and the reach glow still matter.
  if (S.variant && S.variant !== 'none' && S.run != null) return VARIANT_KEYS.includes(key);
  // So does a position from the piece trials, and its row of statues.
  if (S.position && S.run != null) return VARIANT_KEYS.includes(key) || key === 'statueRow';
  return !SHOWN[key] ? true : S.run == null && !DEPENDS.includes(key) ? true : SHOWN[key](S);
};

/** Settings the descent raises level by level: their value is the first level's. */
const CLIMBS = ['foes', 'iq', 'kinds', 'statues', 'foePool', 'parMin', 'parMax', 'traits', 'w', 'h'];
export const settingNote = (key, S) => (S.run === 'descent' && CLIMBS.includes(key) && (key !== 'w' && key !== 'h' || S.boardGrows) ? ' (first level, then climbs)' : '');

/** Every setting a mode's panel shows, part by part: the run's and the
    level's together, each part's sub-headings in order. */
export const PANEL = PARTS.map((p) => {
  const at = (f) => (f.sub ? 1 + (p.subs || []).findIndex(([id]) => id === f.sub) : 0);
  const fields = [...RUN_SCHEMA, ...SCHEMA].filter((g) => g.part === p.id).flatMap((g) => g.fields);
  return { ...part(p.id), fields: fields.sort((a, b) => at(a) - at(b)) }; // sort is stable: the given order within a heading
}).filter((g) => g.fields.length);

// --- A mode in eight lines (2026-10-13). ------------------------------------
// One line for each part (PARTS): the mode's answer to that part's question,
// said from its settings, so it can never fall out of date.

const FIELD = Object.fromEntries([...RUN_SCHEMA, ...SCHEMA].flatMap((g) => g.fields).map((f) => [f.key, f]));
const label = (key, v) => FIELD[key]?.options?.find((o) => o.v === v)?.label ?? String(v);
const named = (k) => (k === 'rabbit' ? 'Rabbit' : PIECES[k]?.name || k);
const few = (a, n = 5) => (a.length > n ? `${a.slice(0, n).map(named).join(', ')} and ${a.length - n} more` : a.map(named).join(', '));
const count = (n, one, many = `${one}s`) => `${n === 1 ? 'one' : n} ${n === 1 ? one : many}`;
const and = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** An army as words: the King, then the kinds strongest first, with how many of each. */
function army(types) {
  const n = {};
  for (const t of types) n[t] = (n[t] || 0) + 1;
  const order = Object.keys(n).sort((a, b) => (b === 'king') - (a === 'king') || (PIECES[b]?.strength ?? 0) - (PIECES[a]?.strength ?? 0));
  return and(order.map((t) => (n[t] > 1 ? `${n[t]} ${named(t)}s` : named(t))));
}

/**
 * A mode, or a level's settings, in eight lines: [{ id, name, ask, text }],
 * one for each part, in order. `S` is a mode's settings (modeSettings), or a
 * level's alone (the workshop: no `run`).
 */
export function describe(S) {
  const V = S.variant && S.variant !== 'none' && S.run !== 'descent' ? VARIANTS[S.variant] : null;
  const run = S.run || 'single', rolled = S.roll === 'chaos' || S.roll === 'daily';
  const course = run === 'course' ? (S.courseName === 'mixed' ? null : COURSES[S.courseName]) : undefined;
  const full = S.fullRow && run !== 'course';
  const theirsThink = { 0: 'at random', 1: 'greedily', 2: 'two moves ahead', 3: 'three moves ahead' }[S.skill] || 'ahead';
  const L = {};

  // Format.
  L.format = run === 'descent' ? `A descent: board after board, deeper each time, until ${S.royal ? 'they take your King' : 'every piece of yours is gone'}. ${S.outOfMoves === 'end' ? 'Running out of moves ends it too.' : 'Running out of moves drops you to the next board, with nothing found.'}`
    : run === 'course' ? `A golf course: ${course ? `${course.name}, ${course.holes} holes` : `${S.courseHoles} mixed holes`}, strokes against par. Over par, the hole is played again.`
    : run === 'rounds' ? `Autochess rounds, until you have lost ${S.lives === 1 ? 'your one life' : `${S.lives} lives`}.`
    : V ? `One game of ${V.name}, from its own starting position.`
    : S.position ? 'One game, from a set position.'
    : S.run == null ? 'One game, made from these settings and a dice roll.'
    : `One game at a time, ${S.roll === 'chaos' ? 'each rolled completely at random' : S.roll === 'daily' ? 'each rolled the way the daily is' : 'made from these settings'}.`;

  // Board.
  const shape = S.shape === 'L' ? 'L-shaped board' : S.shape === 'rect' ? (S.w === S.h ? 'square' : 'rectangle') : label('shape', S.shape).toLowerCase();
  const on = [
    S.ground === 'crumble' ? 'ground that crumbles behind you' : S.ground === 'shrink' ? `an edge that falls every ${S.shrinkEvery} moves` : S.ground === 'spiral' ? 'an edge that falls in a spiral' : '',
    S.holes ? count(S.holes, 'square', 'squares') + ' missing' : '',
    S.magic === 'sides' ? 'the sides joined' : S.magic === 'all' ? 'all four edges joined' : '',
    S.geared ? 'a quarter turn after every turn' : '',
    S.statueRow ? 'a middle row of statues that opens one a turn' : S.statues ? `${count(S.statues, 'statue')}${S.statuesTake ? ' either side can take' : ''}` : '',
    S.ghosts ? 'a row of ghosts in front of each side' : '',
    S.gates ? count(S.gates, 'gate') : '',
    S.clouds ? count(S.clouds, 'wandering cloud') : '',
    S.sand ? count(S.sand, 'square') + ' of sand' : '', S.water ? count(S.water, 'square') + ' of water' : '',
    S.cloud ? 'a cloud over each second row for the first turn' : ''
  ].filter(Boolean);
  L.board = V ? `${V.size}, the variant’s own board.`
    : S.position ? 'The position’s own board.'
    : course ? `Each hole its own, ${course.base.w} × ${course.base.h} to start, changing as the course goes round.`
    : S.roll === 'daily' ? 'Rolled: its size, its shape and everything on it.'
    : S.roll === 'chaos' ? `${S.w} × ${S.h}; its shape and everything on it rolled.`
    : `${S.w} × ${S.h} ${shape}${on.length ? `, with ${and(on)}` : ''}.`;

  // Armies.
  if (V) {
    const F = readFen(V.fen), yours = army(F.pieces.map((p) => p.type)), theirs = army(F.foes.map((f) => f.type));
    L.armies = `Yours: ${yours}. Theirs: ${theirs === yours ? 'the same' : theirs}. As the variant stands them.`;
  } else if (S.position) L.armies = 'As the position stands them.';
  else if (S.cells) {
    const line = (c, mods) => c.map((t, i) => (t ? `${named(t)}${mods?.[i]?.suit || mods?.[i]?.weapon ? ` (${[mods[i].suit, mods[i].weapon && `${mods[i].weapon} ${mods[i].wl || 1}`].filter(Boolean).join(', ')})` : ''}` : null)).filter(Boolean).join(', ');
    const turned = S.cells.map((_, i) => S.cells[Math.floor(i / S.w) * S.w + (S.w - 1 - (i % S.w))]);
    L.armies = `Yours, square by square: ${line(S.cells, S.cellMods)}. Theirs: ${S.foeCells.join() === S.cells.join() ? 'the same, mirrored' : S.foeCells.join() === turned.join() ? 'the same, turned' : line(S.foeCells, S.foeCellMods)}.`;
  } else if (rolled) L.armies = `Rolled with the board${full ? ', a full row each' : ''}${S.lineup ? ', lined up like chess' : ''}.`;
  else {
    const given = run === 'descent' || run === 'rounds';
    const n = full ? S.w : run === 'course' ? S.mine : S.mine;
    const yours = given ? (S.inOrder && S.startPool.length === S.startPieces ? `${few(S.startPool, 8)}, in that order` : `${S.startPieces} from ${few(S.startPool)}`)
      : `${full ? 'a full row' : n} from ${few(S.minePool)}`;
    const theirs = given && S.upgrades === 'each' ? (S.foeLine === 'turned' ? 'the same, reversed' : 'the same, mirrored, each piece facing its twin')
      : S.mirror ? 'a copy of yours' : S.foes || full ? `${full ? 'a full row' : S.foes} from ${few(S.foePool)}` : 'none';
    const loose = S.rabbits ? `${theirs === 'none' ? ';' : ', and'} ${count(S.rabbits, 'loose rabbit')}` : '';
    const ball = run === 'course' ? ', all sliders, and a ball they hit'
      : ['hole', 'descent'].includes(S.goal) ? `, and a ball (${label('ballMove', S.ballMove).toLowerCase()})` : '';
    const where = S.lineup ? 'lined up like chess' : `scattered in the first ${count(S.mineRows, 'row')}`;
    L.armies = `Yours: ${cap(yours)}${ball}. Theirs: ${theirs}${loose}. ${cap(where)}${S.arrange && run !== 'rounds' ? '; you lay yours out first' : ''}.${S.promote === 'copy' ? ' A pawn on the far row becomes a copy of another of its side.' : ''}`;
  }

  // Control.
  const mind = (many) => (S.rabbitMind === 'mind' ? `${many ? 'their own minds' : 'its own mind'} (intelligence ${S.iq})` : `${many ? 'hidden patterns' : 'a hidden pattern'}`);
  const theirs = S.roll === 'daily' ? 'one rabbit leads theirs: their pieces think, and its mind (intelligence 3 to 5) sets their mood'
    : S.roll === 'chaos' ? 'how theirs move is rolled'
    : V ? `they think ${theirsThink}`
    : S.darkBrain === 'think' ? `they think ${theirsThink}${S.style === 'hunt' ? ', hunting' : S.style === 'flee' ? ', fleeing' : ''}`
    : S.darkBrain === 'rabbit' ? `one rabbit leads them: their pieces think, and its mind (intelligence ${S.iq}) sets their mood`
    : `a rabbit inside each of theirs picks its way, by ${mind(false)}`;
  const when = S.realtime || V?.rules?.realtime ? 'No turns: any piece moves when it is ready, and theirs too.'
    : `Turns, ${S.first === 'them' ? 'theirs first' : 'yours first'}${V?.rules?.movesPerTurn ? `; you move ${V.rules.movesPerTurn} times a turn`
      : rolled ? '' : S.mode === 'auto' ? `; every piece of yours moves, then ${S.oneMove ? 'one of theirs' : 'every piece of theirs'}`
      : S.oneMove || V ? '; one piece a side each turn' : '; one piece of yours, then every piece of theirs'}.`;
  L.control = `${S.mode === 'auto' ? 'Rabbits move yours, once you have set them up' : 'You move yours'}; ${!V && !S.foes && !full && !S.mirror ? (S.rabbits ? `${S.rabbits > 1 ? 'loose rabbits hop' : 'a loose rabbit hops'} by ${mind(S.rabbits > 1)}` : 'nobody moves theirs') : theirs}. ${when}`;

  // Goal.
  const win = V?.rules?.race ? 'Race your King to the far row' : V?.rules?.hill ? 'Take their King, or bring yours to the middle'
    : V ? 'Take their King' : run === 'course' ? 'Sink the ball in no more strokes than par'
    : S.goal === 'capture' ? (S.captureN ? `Capture ${S.captureN === 1 ? 'any one' : `${S.captureN}`} of theirs` : 'Capture every one of theirs')
    : S.goal === 'carrier' ? `Take the piece their rabbit rides; ${S.rabbitMove === 'random' ? `it hops to another of theirs at random every ${S.rabbitHop === 1 ? 'turn' : `${S.rabbitHop} turns`}` : 'they can move it to another of theirs, as their turn'}${S.rabbitSides === 'both' ? `, and one rides yours${S.rabbitMove === 'random' ? '' : ' (moving it is your turn)'}: lose that piece and you lose` : ''}`
    : S.goal === 'flag' ? 'Take the rabbit from the middle and carry it back to your first row; take the piece carrying it and it rides yours'
    : GOAL_PILL[S.goal] || 'A goal that changes with each board';
  const lose = !V && S.royal && run !== 'course' ? '; lose your King and you lose' : '';
  const stall = [S.roll === 'chaos' ? 'the move limit is rolled' : course !== undefined ? 'par is the fewest strokes the solver finds, plus two on the first two holes and one after; over par, the hole is played again' : S.maxMoves ? `a limit of ${S.maxMoves} moves` : 'no move limit',
    !V && S.showdown && run !== 'course' ? 'with one piece left each, the board closes in' : ''].filter(Boolean);
  L.goal = S.roll === 'daily' ? 'Rolled with the board, with at least 18 moves.' : `${win}${lose}. ${cap(stall.join('; '))}.`;

  // Growth.
  if (run === 'descent') {
    const finds = S.upgrades === 'each' ? 'Each new board, both sides get an upgrade: you choose one of two (a suit or a weapon), they get one at random'
      : S.rewards ? `Finishing a board finds you a piece, up to ${S.maxPieces}, then upgrades${S.jokers ? ' and jokers' : ''}` : 'Nothing is found';
    const more = [S.upgrades === 'each' && S.growAt ? `the board is 7 × 7 from depth ${S.growAt}` : '', S.boardGrows ? 'the board grows' : '',
      S.fairyFrom > 1 ? `fairy pieces from depth ${S.fairyFrom}` : '', S.carry ? 'what you find carries over to later descents' : ''].filter(Boolean);
    L.growth = `${finds}${more.length ? `; ${and(more)}` : ''}.`;
  } else if (run === 'rounds') L.growth = `${S.rewards ? `Win rounds to grow your side, up to ${S.maxPieces}` : 'Nothing is found'}${S.shop ? ', buying pieces and upgrades with acorns' : ''}${S.jokers ? '; jokers' : ''}.`;
  else if (run === 'course') L.growth = 'Nothing between holes; the course itself changes as it goes round.';
  else L.growth = 'None: each game stands alone.';

  // Difficulty.
  const band = S.aim ? `aims at ${S.aim} of 10` : S.difficulty === 'any' ? 'any difficulty' : label('difficulty', S.difficulty).toLowerCase();
  const pass = rolled ? [S.roll === 'daily' ? 'winnable in 4 to 10 moves' : 'winnable', 'balanced', ...(S.minEngage ? [`engaging (at least ${S.minEngage} of 100)`] : []), ...(S.roll === 'daily' ? ['with a high skill ceiling'] : [])]
    : [S.solve ? (S.mode === 'auto' ? `won by some setup within ${S.maxMoves || 40} turns` : `winnable in ${S.parMin} to ${S.parMax} ${run === 'course' ? 'strokes' : 'moves'}`) : '', S.solve && S.balance !== 'off' ? (S.balance === 'strict' ? 'strictly balanced' : 'balanced') : '',
      S.minEngage ? `engaging (at least ${S.minEngage} of 100)` : '', S.minCeiling ? 'with a high skill ceiling' : ''].filter(Boolean);
  L.difficulty = V || S.position ? 'Not measured: it plays as it stands.'
    // One upgrade a board takes each board as dealt (play/main.js findOnce):
    // nothing is searched, and their rabbit's mind is what sharpens.
    : run === 'descent' && S.upgrades === 'each' ? `Not searched: each board is the two lines as they stand. What climbs is ${S.darkBrain === 'think' ? `how far ahead they look, from ${theirsThink}, a step more every three boards` : `their rabbit’s intelligence, from ${S.iq}, ${label('ramp', S.ramp).toLowerCase()}`}, and the upgrades they get.`
    : run === 'descent' ? `Starts at ${S.startDifficulty} of 10 and climbs ${label('ramp', S.ramp).toLowerCase()}${S.realtime ? ', their pieces resting less each board' : ''}${pass.length ? `; each board searched to be ${and(pass)}` : ''}.`
    : `${cap(band)}${run === 'rounds' ? `, climbing ${label('ramp', S.ramp).toLowerCase()}` : ''}${pass.length ? `; each ${run === 'course' ? 'hole' : 'board'} searched to be ${and(pass)}` : ''}.`;

  // Information.
  const hints = [S.showReach ? 'where theirs can go' : '', S.showMyReach ? 'where yours can go' : '', S.showGuards ? 'shields on guarded pieces' : '', S.showSafe && S.showReach ? 'shields on squares you guard' : '',
    S.showBeacons ? 'beacons on what can be taken' : '', S.showPins ? 'needles through pinned pieces' : '',
    S.tracks && (S.rabbits || S.darkBrain === 'possessed') && S.rabbitMind === 'pattern' ? 'rabbit tracks' : ''].filter(Boolean);
  L.information = `${!V && S.clouds ? 'Each side sees all but what the clouds hide' : 'Both sides see the whole board'}. ${hints.length ? `Hints: ${and(hints)}.` : 'No hints.'}`;

  return PARTS.map((p) => ({ id: p.id, name: p.name, ask: p.ask, text: L[p.id] }));
}

/** One part's line, for the settings form: described once per settings. */
let lastS = null, lastLines = null;
export function partLine(id, S) {
  if (S !== lastS) { lastS = S; lastLines = describe(S); }
  return lastLines.find((l) => l.id === id)?.text || '';
}

// --- The settings for the next level. ---------------------------------------

const RAMP = { gentle: 0.6, steady: 1, steep: 1.6 };

/** A foe pool with no fairy pieces while `early`; otherwise with `more`
    added. Never empty: the King stays. */
function classicUntil(early, pool, more = []) {
  const all = [...new Set(early ? pool : [...pool, ...more])];
  const out = early ? all.filter((k) => PIECES[k]?.kind !== 'fairy') : all;
  return out.length ? out : ['king'];
}
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
    S = { ...crazy(rand, M.roll === 'daily' ? fairy : [...fairy, 'rabbit']), difficulty: M.difficulty, aim: M.aim, minEngage: M.minEngage, balance: 'on', solve: true };
    // The daily from 2026-10-14 (Timothy, 2026-10-13: "the rabbit inhabiting
    // each piece is no longer a thing in decent or daily and its just that
    // one rabbit"): one Rabbit on their King leads them; no rabbits inside
    // their pieces, none loose.
    // Its intelligence 3 to 5, so their side looks one move ahead: the solver
    // and the measures play it through thousands of times, and two moves
    // ahead made that too slow to deal a board (measured 2026-10-13).
    if (M.roll === 'daily') Object.assign(S, { darkBrain: 'rabbit', rabbits: 0, iq: 3 + (S.iq % 3), ...(S.goal === 'mix' ? { goal: 'all' } : {}) });
    S.mode = 'hand'; // autochess is its own mode
    // Pieces can always take pieces (Timothy, 2026-10-09): never rolled off.
    S.foesCapture = true;
    // Chaos rolls everything but how you win: that is the mode's own
    // (by default, take their King and keep yours, with the showdown).
    if (M.roll === 'chaos') Object.assign(S, { goal: M.goal, royal: M.royal, showdown: M.showdown, w: M.w, h: M.h });
    // Where pieces start is the mode's too, in Chaos and the daily practice:
    // lined up or not, within how many rows, and who moves first.
    Object.assign(S, { lineup: M.lineup, mineRows: M.mineRows, foeRows: M.foeRows, first: M.first });
    // So are a full row each, the first-turn cloud, and showing reach.
    Object.assign(S, { fullRow: M.fullRow, cloud: M.cloud, cloudOwn: M.cloudOwn, showReach: M.showReach, showMyReach: M.showMyReach, showGuards: M.showGuards, showSafe: M.showSafe, showBeacons: M.showBeacons, showPins: M.showPins });
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
      // Fairy pieces only from "Fairy pieces from depth" on: before it,
      // theirs are all classic (2026-10-10). After it, the small ones
      // that used to start the descent (wazir, ferz) come back in.
      foePool: classicUntil(depth < M.fairyFrom, d * k < 3 ? M.foePool : d * k < 7 ? [...M.foePool, 'knight', 'bishop'] : d * k < 11 ? [...M.foePool, 'knight', 'bishop', 'rook', 'camel'] : [...M.foePool, 'rook', 'bishop', 'knight', 'queen', 'archbishop'],
        ['wazir', 'ferz', 'bunny']),
      ground: d * k < 2 ? M.ground : pick([M.ground, M.ground, 'crumble', 'shrink', 'spiral']),
      shape: d * k < 3 ? M.shape : pick([M.shape, M.shape, 'diamond', 'round', 'cross', 'cheese']),
      statues: Math.min(4, M.statues + Math.floor(d * k / 3)),
      parMin: Math.min(8, M.parMin + Math.floor(d * k / 6)), parMax: Math.min(14, M.parMax + Math.floor(d * k / 3)),
      // The first levels' rabbits are clumsy, not aggressive: that, not
      // switching their captures off, is what makes the start easy.
      traits: d * k < 2 ? ['messy'] : M.traits
    });
  }
  if (M.run === 'descent' && M.upgrades === 'each') {
    // One upgrade a board (2026-10-12): the board is the board, five by five
    // and then seven by seven, rectangular and solid, with its row of
    // statues. Both lineups are carried (hand); what climbs is how hard the
    // level is aimed and how sharp their rabbits are.
    const big = M.growAt > 0 && depth >= M.growAt;
    Object.assign(S, { w: big ? 7 : M.w, h: big ? 7 : M.h, shape: M.shape, ground: M.ground, statues: M.statues, foePool: M.foePool, kinds: M.kinds });
    // A side that thinks (2026-10-13, with no rabbit leading it) looks
    // further ahead as it goes down: one step more every three boards.
    if (M.darkBrain === 'think') S.skill = String(Math.min(3, +M.skill + Math.floor(((depth - 1) * k) / 3)));
  }
  if (M.run === 'descent' && M.realtime) {
    // Kung fu: their pieces rest less each level down; the ground stays
    // solid (crumbling and shrinking count turns, and there are none).
    // (Gentler from 2026-10-11: 0.3 seconds less rest a level, not under
    // 1.5; their pace 0.1 seconds quicker a level, not under 0.6.)
    Object.assign(S, { kfFoeCool: Math.max(15, M.kfFoeCool - Math.round((depth - 1) * 3 * k)), kfFoeGap: Math.max(6, M.kfFoeGap - Math.round((depth - 1) * k)),
      ground: 'solid', cloud: false, showdown: false });
  }
  if (M.run === 'rounds') {
    const r = round - 1;
    Object.assign(S, { foes: Math.min(6, M.foes + Math.floor(r * k / 2)), iq: Math.min(10, M.iq + Math.floor(r * k * 0.6)), kinds: Math.min(4, M.kinds + Math.floor(r * k / 3)) });
  }
  if (M.run === 'course' && COURSES[M.courseName]) {
    // A named course: its own balls, ground and turns, hole by hole.
    const C = COURSES[M.courseName], h = hole - 1;
    Object.assign(S, C.base, { goal: 'hole', ballMove: 'hit', magic: 'none', geared: false, ground: 'solid', rabbits: 0, sand: 0, water: 0, gates: 0, clouds: 0 }, C.hole(h, pick));
  } else if (M.run === 'course') {
    // Mixed: each hole a hazard in turn (sand, water, gates, clouds), more
    // of it as the course goes round, with statues, a moving hole, then
    // magic edges or a board that turns.
    const h = hole - 1, hazard = ['sand', 'water', 'gates', 'clouds'][(h + 3) % 4];
    Object.assign(S, {
      goal: 'hole', ballMove: 'hit', holeMoves: h < 2 ? 'still' : pick(['still', 'daily', 'short']),
      statues: Math.min(5, M.statues + Math.floor(h / 2)), shape: h < 3 ? M.shape : pick(['rect', 'L', 'cross', 'diamond', 'round', 'hourglass']),
      magic: h >= 5 && rand() < 0.3 ? 'sides' : 'none', geared: h >= 6 && rand() < 0.2, rabbits: 0, sand: 0, water: 0, gates: 0, clouds: 0,
      ...(h > 0 ? { [hazard]: Math.min(4, 1 + Math.floor(h / 4)) } : {})
    });
  }
  // Golf is played with sliders only (2026-10-13).
  if (M.run === 'course') S.minePool = (S.minePool || []).filter((t) => GOLF_POOL.includes(t)).length ? S.minePool.filter((t) => GOLF_POOL.includes(t)) : GOLF_POOL.slice();
  if (hand) Object.assign(S, hand);
  if (veto.length) S.veto = veto;
  if (invented.length) S.invented = [...(S.invented || []), ...invented];
  return clean({ ...S, solve: true });
}

/** How many holes this course is. */
export const holesOf = (M) => COURSES[M.courseName]?.holes ?? M.courseHoles;

/** Plain words: what this mode is. */
export function modeLine(id) { return MODES[id]?.blurb || ''; }

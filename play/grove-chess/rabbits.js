// The rabbits. Every pattern in the daily set has its own colour of fur, so a
// rabbit you have met before can be known on sight: colour is the visual
// name of a pattern. Random patterns from the lab have no colour and stay
// white.
//
// Rabbits you catch in the daily are kept in this browser, only ever added
// to, for the garden to come (docs/grove-long-game.md). In the daily a
// rabbit shows its colour once you have caught that pattern before, so
// colours are something you earn rather than a spoiler on day one.

/** Patterns beyond the daily's twelve, for the lab and the descent. These
    have pauses in them, (0, 0): a rabbit that stops for a moment, which
    reads clearly when the rabbit is inside a piece. (They live here, not in
    day.js, because adding to the daily's list would re-deal every board.) */
export const EXTRA_PATTERNS = [
  { name: 'Doze', steps: [[0, 0], [1, 0], [0, 0], [-1, 0]] },
  { name: 'Lurk', steps: [[0, 0], [0, 0], [0, -1]] },
  { name: 'Pace', steps: [[-1, 0], [-1, 0], [0, 0], [1, 0], [1, 0], [0, 0]] }
];

export const FUR = {
  'Doze': '#78c3dc', 'Lurk': '#5c6b7c', 'Pace': '#c8435f',
  // Adventure's routes (lab.js ROUTES): Doze, Box step and Pace walk the
  // shapes of the patterns of those names; the shuttle is new.
  'Shuttle': '#ef8d32',
  // Adventure's three kinds of rabbit (2026-10-15, Timothy: "rabbits that
  // flee, rabbits that move to attack if you enter their highlighted reach,
  // and ones that move a set loop of moves, tracing shapes ... scared,
  // sentry, and robot rabbits"). Robots wear their route's colour (above).
  'Scared': '#f4f1ea', 'Sentry': '#d94a3d',
  'Hopscotch': '#e8a33d', 'Zigzag': '#3fae9f', 'Wobble': '#e07a9a', 'Sidestep': '#8f7fd1',
  'Knight’s jig': '#4f86d6', 'Long leap': '#c45a3c', 'Corner run': '#e3cc3c', 'Box step': '#6f9a48',
  'Spiral': '#a855c4', 'Two up, one back': '#8b6a4f', 'Skip': '#e2865a', 'Drift': '#93aec4',
  // Rabbits with minds wear their trait's colour (rules.js TRAITS).
  'Aggressive': '#d23c2a', 'Hunter': '#e8742a', 'Shy': '#bfe3f0', 'Guard': '#3f6e4a', 'Messy': '#f0a8d0', 'Habit': '#d9b25b'
};

/** A word for each fur, for sentences. */
export const FUR_WORD = {
  'Doze': 'sky blue', 'Lurk': 'slate', 'Pace': 'crimson', 'Shuttle': 'tangerine', 'Scared': 'snow white', 'Sentry': 'red',
  'Hopscotch': 'amber', 'Zigzag': 'teal', 'Wobble': 'pink', 'Sidestep': 'lavender',
  'Knight’s jig': 'blue', 'Long leap': 'rust', 'Corner run': 'yellow', 'Box step': 'moss green',
  'Spiral': 'violet', 'Two up, one back': 'brown', 'Skip': 'orange', 'Drift': 'mist blue',
  'Aggressive': 'red', 'Hunter': 'burnt orange', 'Shy': 'pale blue', 'Guard': 'deep green', 'Messy': 'candy pink', 'Habit': 'gold'
};

/** Adventure's routes in words (lab.js ROUTES), for a piece that walks one. */
export const ROUTE_SAY = {
  'Shuttle': 'there and back, a move every turn',
  'Doze': 'a rest, a move there, a rest, a move back',
  'Box step': 'round a square, a move every turn',
  'Pace': 'two moves there, two moves back'
};

/** "A tangerine rabbit inside walks it there and back, ..." */
export const routeText = (f) => (f.suit
  // Rabbits are suits (Adventure, 2026-10-16): the rabbit is said by the
  // page; this is the loop it walks.
  ? `Its loop is a ${f.patternName.toLowerCase()}: it walks it ${ROUTE_SAY[f.patternName] || 'round and round'}, and takes you if you stand where it steps next. The whole loop is drawn on the board, its next step boldest.`
  : `A robot rabbit (${FUR_WORD[f.patternName] || ''}, ${f.patternName}) walks it ${ROUTE_SAY[f.patternName] || 'on a route'}, tracing its shape over and over, and it takes you if you stand where it steps next. Its whole route is dashed on the board, and its next step drawn solid.`);

const KEY = 'ig.grove.rabbits.v1';

/** Every pattern you have caught, with how many times: { name: count }. */
export function caughtRabbits() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1 && s.caught) return s.caught;
  } catch { /* storage blocked: nothing kept */ }
  return {};
}

/** Note a catch. Returns true if it is the first of its pattern. */
export function recordCatch(name) {
  if (!FUR[name]) return false;
  const caught = caughtRabbits(), first = !caught[name];
  caught[name] = (caught[name] || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, caught })); } catch { /* never end a game over storage */ }
  return first;
}

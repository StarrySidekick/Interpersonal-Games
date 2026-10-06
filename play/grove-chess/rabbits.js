// The rabbits. Every pattern in the daily set has its own colour of fur, so a
// rabbit you have met before can be known on sight: colour is the visual
// name of a pattern. Random patterns from the lab have no colour and stay
// white.
//
// Rabbits you catch in the daily are kept in this browser, only ever added
// to, for the garden to come (docs/grove-long-game.md). In the daily a
// rabbit shows its colour once you have caught that pattern before, so
// colours are something you earn rather than a spoiler on day one.

export const FUR = {
  'Hopscotch': '#e8a33d', 'Zigzag': '#3fae9f', 'Wobble': '#e07a9a', 'Sidestep': '#8f7fd1',
  'Knight’s jig': '#4f86d6', 'Long leap': '#c45a3c', 'Corner run': '#e3cc3c', 'Box step': '#6f9a48',
  'Spiral': '#a855c4', 'Two up, one back': '#8b6a4f', 'Skip': '#e2865a', 'Drift': '#93aec4'
};

/** A word for each fur, for sentences. */
export const FUR_WORD = {
  'Hopscotch': 'amber', 'Zigzag': 'teal', 'Wobble': 'pink', 'Sidestep': 'lavender',
  'Knight’s jig': 'blue', 'Long leap': 'rust', 'Corner run': 'yellow', 'Box step': 'moss green',
  'Spiral': 'violet', 'Two up, one back': 'brown', 'Skip': 'orange', 'Drift': 'mist blue'
};

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

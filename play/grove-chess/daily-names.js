// Names and looks for the daily boards from version 4 on (2026-10-09).
//
// Timothy, 2026-10-08: "each daily board has mysterious nonsensical name
// and potentially some light theming". A name is made from word lists by a
// seeded roll on the date, then written into the stored board (dailies/),
// so changing these lists later renames nothing that has shipped.
//
// A theme is light on purpose: the squares' two colours on solid ground,
// and one line under the name. Crumbling and shrinking ground keep their
// own colours, because those colours say what the ground will do.

export const THEMES = [
  { id: 'grove', light: '#b9dc9b', dark: '#f6efd7', line: 'An ordinary clearing. Suspiciously ordinary.' },
  { id: 'moth', light: '#c7c0dc', dark: '#ece8f2', line: 'Everything here is dusty and fond of lamps.' },
  { id: 'tea', light: '#d8c39a', dark: '#f3e6c8', line: 'The board has been left in the pot too long.' },
  { id: 'frost', light: '#bcd7e3', dark: '#eef5f7', line: 'A cold morning. The squares creak.' },
  { id: 'rust', light: '#d9a88a', dark: '#f2dccb', line: 'Old iron, warm from a sun nobody saw.' },
  { id: 'mint', light: '#a8dcc4', dark: '#eaf7ef', line: 'It smells of toothpaste and wet leaves.' },
  { id: 'plum', light: '#d2b0cc', dark: '#f3e5ef', line: 'Somebody spilled jam here, long ago.' },
  { id: 'honey', light: '#e6cf7a', dark: '#faf0c8', line: 'Sticky underfoot. The bees left early.' },
  { id: 'ash', light: '#c4c4bc', dark: '#ecebe6', line: 'A grey day, politely quiet.' },
  { id: 'coral', light: '#eab3a3', dark: '#fbe8e1', line: 'The tide went out and forgot to come back.' },
  { id: 'lichen', light: '#c9d48f', dark: '#f1f3dc', line: 'Slow things grow on every square.' },
  { id: 'dusk', light: '#b7b4d8', dark: '#e9e8f6', line: 'The light is leaving, unhurried.' }
];

const ADJ = ['Unwilling', 'Second-hand', 'Velvet', 'Sleepless', 'Borrowed', 'Crooked', 'Polite', 'Lukewarm', 'Inside-out', 'Patient',
  'Whispering', 'Upholstered', 'Overdue', 'Damp', 'Glass', 'Forgetful', 'Ninefold', 'Woollen', 'Hollow', 'Tidy', 'Seldom', 'Brass',
  'Reluctant', 'Midweek', 'Pocket-sized', 'Uninvited', 'Gentle', 'Backwards', 'Sugared', 'Lopsided'];
const NOUN = ['Teaspoon', 'Parliament', 'Marrow', 'Lantern', 'Umbrella', 'Weather', 'Thimble', 'Kettle', 'Almanac', 'Doorknob',
  'Turnip', 'Choir', 'Hatstand', 'Pudding', 'Ladder', 'Compass', 'Gravy', 'Meadow', 'Spindle', 'Barometer', 'Eel', 'Cupboard',
  'Orchard', 'Mitten', 'Lighthouse', 'Biscuit', 'Wheelbarrow', 'Sundial', 'Accordion', 'Pocket'];
const PLURAL = ['Spoons', 'Buttons', 'Herons', 'Doors', 'Clocks', 'Pears', 'Hats', 'Moths', 'Keys', 'Candles', 'Puddles', 'Owls', 'Socks', 'Bells', 'Radishes'];
const NUMBER = ['Two', 'Three', 'Five', 'Seven', 'Nine', 'Eleven', 'Twelve', 'Forty', 'a Hundred'];
const WHO = ['Mrs Odgerly', 'Uncle Fen', 'the Bishop of Nowhere', 'Old Pim', 'Aunt Wobble', 'the Mayor', 'Captain Thistle', 'Nobody', 'the Lodger', 'Dr Fumble'];
const VERB = ['Hums', 'Waits', 'Forgets', 'Sulks', 'Listens', 'Counts', 'Hides', 'Leans', 'Dozes', 'Argues'];

const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/** A mysterious, nonsensical name. */
export function dailyName(rand) {
  const n = nameOnce(rand);
  return n[0].toUpperCase() + n.slice(1);
}

function nameOnce(rand) {
  const t = Math.floor(rand() * 5);
  if (t === 0) return `The ${pick(rand, ADJ)} ${pick(rand, NOUN)}`;
  if (t === 1) return `${pick(rand, NOUN)} of ${pick(rand, NUMBER)} ${pick(rand, PLURAL)}`;
  if (t === 2) return `${pick(rand, WHO)}’s ${pick(rand, NOUN)}`;
  if (t === 3) return `Where the ${pick(rand, NOUN)} ${pick(rand, VERB)}`;
  const adj = pick(rand, ADJ);
  return `${/^[AEIOU]/.test(adj) ? 'An' : 'A'} ${adj} Matter of ${pick(rand, PLURAL)}`;
}

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

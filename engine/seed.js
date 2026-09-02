// Engine A — the shared seed.
//
// Both phones type the same room code and generate the same game. There is no
// network between them: the call is the network. Everything here has to be
// deterministic, or the two screens quietly disagree and the game is broken in
// a way nobody can see.

// cyrb128 -> mulberry32. Small, fast, and stable across engines, which is the
// only property that actually matters here.
function seedFrom(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/** A seeded random function. Same string in, same sequence out, on any phone. */
export function rng(str) {
  let a = seedFrom(String(str));
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates against a seeded rand. Returns a new array. */
export function shuffled(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Words chosen to survive being said out loud on a bad phone line: two
// syllables or fewer, no rhyming pairs, nothing that sounds like a letter.
const WORDS = [
  'otter', 'lamp', 'birch', 'cobalt', 'plum', 'anchor', 'moth', 'cedar',
  'pepper', 'harbor', 'thistle', 'walnut', 'ferry', 'meadow', 'copper',
  'lantern', 'sparrow', 'pebble', 'quilt', 'marble', 'juniper', 'kettle',
  'saffron', 'willow', 'basalt', 'clover', 'domino', 'ember', 'fennel',
  'gravel', 'hazel', 'indigo'
];

/** A code you can say once and have the other person get it right. */
export function newRoomCode(rand = Math.random) {
  const a = WORDS[Math.floor(rand() * WORDS.length)];
  let b = WORDS[Math.floor(rand() * WORDS.length)];
  while (b === a) b = WORDS[Math.floor(rand() * WORDS.length)];
  const n = 10 + Math.floor(rand() * 90);
  return `${a}-${b}-${n}`;
}

/** Forgiving: spaces, capitals and stray punctuation all mean the same code. */
export function normalizeCode(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

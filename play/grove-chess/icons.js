// Drawn icons for Adventure's suits and rabbits (Timothy, 2026-10-16: "would
// also like good drawn icons for each suit, that look like card suits").
// Each is one solid shape, the way a playing card's pips are, in a 100 by
// 100 box: a heart, an ivy leaf on a curling stem for Vines, a star, a
// spiral, a cog. Plain SVG, made here, with nothing to load.

const star = (() => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 19 : 46;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(54 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

const cog = (() => {
  // Eight teeth round a wheel, with a hole in the middle (evenodd).
  const out = [], teeth = 8, R = 44, r = 34;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth;
    for (const [ang, rad] of [[a - w * 0.62, r], [a - w * 0.42, R], [a + w * 0.42, R], [a + w * 0.62, r]])
      out.push(`${(50 + Math.cos(ang) * rad).toFixed(1)} ${(50 + Math.sin(ang) * rad).toFixed(1)}`);
  }
  return `M${out.join(' L')} Z M50 36 A14 14 0 1 0 50.01 36 Z`;
})();

const spiral = (() => {
  // An Archimedean spiral, two and a half turns, drawn as a thick stroke.
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90, a = t * Math.PI * 5 + Math.PI / 2, r = 4 + t * 36;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
})();

/** Each suit's shape: `d` filled (or stroked, for the spiral), and a vein
    or tendril drawn over it in `line`. */
const SHAPES = {
  hearts: { d: 'M50 90 C22 68 6 50 6 32 C6 17 18 8 31 8 C40 8 47 13 50 21 C53 13 60 8 69 8 C82 8 94 17 94 32 C94 50 78 68 50 90 Z' },
  vines: { d: 'M50 6 C58 20 66 24 82 22 C77 35 79 45 93 53 C78 58 67 66 62 80 C58 74 54 72 50 74 C46 72 42 74 38 80 C33 66 22 58 7 53 C21 45 23 35 18 22 C34 24 42 20 50 6 Z',
    line: 'M50 74 C50 84 46 90 38 93 C32 95 28 90 32 86', vein: 'M50 70 L50 22 M50 50 L32 36 M50 50 L68 36' },
  stars: { d: star },
  spirals: { d: spiral, stroke: 13 },
  gears: { d: cog, evenodd: true }
};

const NS = 'http://www.w3.org/2000/svg';

/** An SVG icon for a suit, `size` pixels square, in `colour` (its own by
    default, from the caller). */
export function suitSvg(suit, colour, size = 24) {
  const S = SHAPES[suit];
  if (!S) return '';
  const body = S.stroke
    ? `<path d="${S.d}" fill="none" stroke="${colour}" stroke-width="${S.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${S.d}" fill="${colour}"${S.evenodd ? ' fill-rule="evenodd"' : ''}/>`;
  const extra = (S.vein ? `<path d="${S.vein}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3.2" stroke-linecap="round"/>` : '')
    + (S.line ? `<path d="${S.line}" fill="none" stroke="${colour}" stroke-width="6" stroke-linecap="round"/>` : '');
  return `<svg xmlns="${NS}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${body}${extra}</svg>`;
}

/** The same, as an element to put in the page. */
export function suitIcon(suit, colour, size = 24, cls = 'sicon') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = suitSvg(suit, colour, size);
  return span;
}

/** A rabbit's head, for a rabbit card and a rabbit's line in a tooltip:
    two long ears over a round head, in its kind's colour. */
export function rabbitSvg(colour, size = 24) {
  return `<svg xmlns="${NS}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="M36 50 C26 34 24 12 32 6 C40 2 46 20 46 44 Z M64 50 C74 34 76 12 68 6 C60 2 54 20 54 44 Z" fill="${colour}"/>`
    + `<ellipse cx="50" cy="66" rx="30" ry="26" fill="${colour}"/>`
    + `<circle cx="39" cy="62" r="4.5" fill="#1d1712"/><circle cx="61" cy="62" r="4.5" fill="#1d1712"/>`
    + `<path d="M46 74 L50 78 L54 74 Z" fill="#f0a3b2"/></svg>`;
}

export function rabbitIcon(colour, size = 24, cls = 'sicon') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = rabbitSvg(colour, size);
  return span;
}

/** The weapons the same way, for their cards: a sword, a lance, a mace, a
    bug net and a kite shield, each one dark shape. */
const WEAPON_SHAPES = {
  sword: '<path d="M46 8 L54 8 L56 62 L50 70 L44 62 Z"/><rect x="28" y="62" width="44" height="8" rx="3"/><rect x="45" y="70" width="10" height="16"/><circle cx="50" cy="91" r="6"/>',
  lance: '<path d="M50 4 L57 30 L52 32 L52 94 L48 94 L48 32 L43 30 Z"/><path d="M36 66 L64 66 L54 76 L46 76 Z"/>',
  mace: '<rect x="46" y="44" width="8" height="52" rx="3"/><circle cx="50" cy="30" r="17"/><path d="M50 4 L55 15 L45 15 Z M50 56 L55 45 L45 45 Z M24 30 L35 25 L35 35 Z M76 30 L65 25 L65 35 Z M31 11 L41 18 L35 23 Z M69 11 L59 18 L65 23 Z M31 49 L35 37 L41 42 Z M69 49 L65 37 L59 42 Z"/>',
  net: '<rect x="47" y="50" width="6" height="46" rx="3"/><circle cx="50" cy="30" r="22" fill="none" stroke-width="6"/><path d="M33 22 L67 22 M30 32 L70 32 M34 42 L66 42 M40 11 L40 49 M50 8 L50 52 M60 11 L60 49" fill="none" stroke-width="2.5"/>',
  shield: '<path d="M50 6 C62 12 76 14 88 14 C88 50 76 76 50 94 C24 76 12 50 12 14 C24 14 38 12 50 6 Z"/><circle cx="50" cy="42" r="9" fill="#e3b84a"/>'
};
export const WEAPON_INK = { sword: '#6f8094', lance: '#9c6b3e', mace: '#5d5550', net: '#8c6f45', shield: '#5f7a96' };

export function weaponSvg(w, size = 24, colour = WEAPON_INK[w] || '#555') {
  const S = WEAPON_SHAPES[w];
  if (!S) return '';
  return `<svg xmlns="${NS}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" fill="${colour}" stroke="${colour}" stroke-width="0">${S}</svg>`;
}
export function weaponIcon(w, size = 24, cls = 'sicon') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = weaponSvg(w, size);
  return span;
}

// The place, drawn — pure SVG built from a growth state (engine/growth.js).
//
// No canvas, no images, no per-visit randomness: every position below is a
// fixed literal, so the clearing you left is the clearing you come back to,
// only further along. What changes between stages is which of these fixed
// things are revealed and how many of them, never where they sit — a garden
// that rearranged itself between visits wouldn't read as the same garden.
//
// Kept separate from growth.js on purpose: this is the only file that knows
// what a stage *looks* like, so the picture can be reworked without touching
// what makes a stage happen, and the numbers can be tuned without a redraw.

// Revealed-count tables, indexed by stageIndex (0..5). Monotonic by
// construction — each row is >= the one before it — which is the same
// invariant growth.js keeps, kept here in the one other place it matters.
const GRASS_SHOWN = [0, 0, 4, 8, 10, 12];
const STAR_SHOWN = [0, 0, 0, 4, 7, 10];
const FIREFLY_SHOWN = [0, 0, 0, 0, 3, 6];
const FLOWER_SHOWN = [0, 0, 0, 0, 4, 7];

const GRASS = [
  [40, 196], [58, 200], [80, 198], [104, 202], [130, 197], [150, 200],
  [255, 199], [278, 202], [300, 197], [322, 200], [345, 198], [365, 201]
];
const STARS = [
  [30, 22, 1.1], [66, 14, 0.9], [110, 28, 1.3], [150, 12, 0.8],
  [200, 20, 1.0], [240, 10, 0.9], [280, 24, 1.2], [320, 16, 0.8],
  [355, 30, 1.1], [18, 44, 0.7]
];
const FIREFLIES = [
  [96, 168, 0], [270, 150, 0.7], [200, 178, 1.4], [140, 158, 2.1],
  [230, 190, 0.4], [310, 172, 1.8]
];
const FLOWERS = [
  [70, 200, '#e8b661'], [118, 203, '#e2796f'], [286, 201, '#e8b661'],
  [332, 204, '#86d9a8'], [190, 205, '#e2796f'], [220, 202, '#86d9a8'],
  [50, 205, '#e2796f']
];

const blade = (x, y) =>
  `<path d="M${x} ${y} q-2 -9 -4 -13 M${x + 3} ${y} q2 -7 5 -11" ` +
  'stroke="#5c8a5f" stroke-width="1.4" stroke-linecap="round" fill="none"/>';

const star = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe6f2" opacity=".85"/>`;

const flower = (x, y, c) =>
  `<circle cx="${x}" cy="${y}" r="2.1" fill="${c}"/>` +
  `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 6}" stroke="#3f6b46" stroke-width="1"/>`;

const firefly = (x, y, delay) => `
  <circle cx="${x}" cy="${y}" r="1.6" fill="#d9f5c8">
    <animate attributeName="opacity" values="0.15;1;0.15" dur="2.6s"
      begin="${delay}s" repeatCount="indefinite"/>
  </circle>`;

/** `growth` is `growthFor()`'s return value. Renders the whole picture as one
    inline `<svg>` string, ready to drop into innerHTML. */
export function placeSVG(growth) {
  const i = growth.stageIndex;
  const grass = GRASS.slice(0, GRASS_SHOWN[i]).map((p) => blade(...p)).join('');
  const stars = STARS.slice(0, STAR_SHOWN[i]).map((p) => star(...p)).join('');
  const fireflies = FIREFLIES.slice(0, FIREFLY_SHOWN[i]).map((p) => firefly(...p)).join('');
  const flowers = FLOWERS.slice(0, FLOWER_SHOWN[i]).map((p) => flower(...p)).join('');

  const fogOpacity = i === 0 ? 0.55 : i === 1 ? 0.22 : 0;
  const petAwake = i >= 1;
  const mossy = i >= 2;
  const sapling = i >= 3;
  const fullSapling = i >= 4;
  const canopy = i >= 5;
  const stream = i >= 5;
  const bonded = growth.bonded;

  return `
<svg viewBox="0 0 400 220" role="img" aria-label="${escapeAttr(growth.line)}"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ig-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0c12"/>
      <stop offset="1" stop-color="#161b26"/>
    </linearGradient>
    <linearGradient id="ig-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#20261f"/>
      <stop offset="1" stop-color="#12150f"/>
    </linearGradient>
    <radialGradient id="ig-pet-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#86d9a8" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#86d9a8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ig-moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#eef1f7"/>
      <stop offset="1" stop-color="#c9d0e0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="220" fill="url(#ig-sky)"/>
  <circle cx="342" cy="34" r="15" fill="url(#ig-moon)" opacity=".9"/>
  ${stars}

  <path d="M0 165 Q120 140 200 158 T400 150 V220 H0 Z" fill="url(#ig-ground)"/>
  ${stream ? `
  <path d="M0 196 Q140 186 220 198 T400 192 V220 H0 Z" fill="#233a4a" opacity=".75"/>
  <path d="M0 196 Q140 186 220 198 T400 192" fill="none" stroke="#4d7a92"
    stroke-width="1" opacity=".5"/>` : ''}
  ${grass}
  ${flowers}

  <!-- The dead tree. It never leaves — moss and a neighbor grow around it,
       nothing replaces it, the way nothing here is ever taken away. -->
  <g stroke="#3a3226" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M56 200 L60 140"/>
    <path d="M60 140 L38 112"/>
    <path d="M60 140 L82 118"/>
    <path d="M60 155 L34 148"/>
  </g>
  ${mossy ? `
  <circle cx="52" cy="128" r="7" fill="#4c7a4f" opacity=".8"/>
  <circle cx="76" cy="120" r="5" fill="#4c7a4f" opacity=".7"/>
  <circle cx="44" cy="152" r="4" fill="#4c7a4f" opacity=".6"/>` : ''}
  ${canopy ? `
  <!-- The same tree from stage 0, leaved again rather than replaced. -->
  <circle cx="38" cy="106" r="17" fill="#3f6b3f"/>
  <circle cx="82" cy="112" r="15" fill="#3a6238"/>
  <circle cx="58" cy="96" r="15" fill="#4c7a4c"/>` : ''}

  ${sapling ? `
  <path d="M330 200 L330 ${fullSapling ? 150 : 168}" stroke="#4a3c28"
    stroke-width="3" stroke-linecap="round"/>
  <circle cx="330" cy="${fullSapling ? 146 : 165}" r="${fullSapling ? 22 : 13}"
    fill="#3f6b3f"/>
  ${fullSapling ? '<circle cx="316" cy="158" r="13" fill="#4c7a4c"/>' +
    '<circle cx="345" cy="158" r="12" fill="#3a6238"/>' : ''}` : ''}

  ${bonded ? `
  <g opacity=".9">
    <circle cx="18" cy="204" r="3" fill="#e8b661"/>
    <circle cx="382" cy="204" r="3" fill="#e8b661"/>
    <path d="M18 204 Q100 190 190 202" fill="none" stroke="#e8b661"
      stroke-width="1" stroke-dasharray="1 5" opacity=".55"/>
    <path d="M382 204 Q300 190 210 202" fill="none" stroke="#e8b661"
      stroke-width="1" stroke-dasharray="1 5" opacity=".55"/>
  </g>` : ''}

  <!-- The PET. Dull and still until the first sitting; after that it never
       goes dark again, whatever the gap between visits. -->
  ${petAwake ? '<circle cx="200" cy="182" r="26" fill="url(#ig-pet-glow)">' +
    '<animate attributeName="r" values="24;28;24" dur="3.4s" repeatCount="indefinite"/>' +
    '</circle>' : ''}
  <ellipse cx="200" cy="188" rx="13" ry="11"
    fill="${petAwake ? '#a9e8c0' : '#3c4450'}"/>
  <ellipse cx="200" cy="188" rx="13" ry="11" fill="none"
    stroke="${petAwake ? '#e7fff0' : '#565f6e'}" stroke-width="1.2"/>
  <circle cx="195" cy="186" r="1.6" fill="${petAwake ? '#0c2417' : '#20242b'}"/>
  <circle cx="205" cy="186" r="1.6" fill="${petAwake ? '#0c2417' : '#20242b'}"/>

  ${fireflies}
  ${fogOpacity > 0 ? `<rect width="400" height="220" fill="#0d0f13" opacity="${fogOpacity}"/>` : ''}
</svg>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

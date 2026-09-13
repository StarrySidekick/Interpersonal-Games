// The scene — a rendered picture of the place, built from nothing but a
// growth state (engine/growth.js). Pure DOM construction and nothing else:
// no state of its own, so the same state always draws the same picture and
// any page can just ask for one whenever it loads.

import { continuousLevel } from './growth.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 400, H = 200;
const GROUND_Y = 152;

function svg(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid) node.append(kid);
  return node;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Cheap deterministic "randomness" for scattering flowers and fireflies — the
// same state must always draw the same picture, so this can't use
// Math.random(). Not shared with engine/seed.js on purpose: that one seeds
// gameplay from a room code two phones agree on, this one only ever decides
// where a dot lands on a drawing nobody needs to agree about.
function hash(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const TREE_X = [24, 68, 112, 158, 246, 292, 336, 378];

function tree(i, cx, foliage) {
  const h = 34 + Math.round(hash(i, 1) * 14);
  const topY = GROUND_Y - h;
  const kids = [svg('rect', {
    x: cx - 2, y: topY + h * 0.35, width: 4, height: h * 0.65,
    fill: '#3a2d22', opacity: 0.9
  })];

  if (foliage > 0.02) {
    // Three stacked triangles, narrowing as they rise — read as a pine from
    // across a clearing, not a botanical claim.
    for (let t = 0; t < 3; t++) {
      const w = (26 - t * 7) * (0.55 + foliage * 0.45);
      const y = topY + t * (h * 0.24);
      kids.push(svg('path', {
        d: `M${cx} ${y} L${cx - w / 2} ${y + h * 0.34} L${cx + w / 2} ${y + h * 0.34} Z`,
        fill: '#274d3b', opacity: 0.5 + foliage * 0.5
      }));
    }
  } else {
    // Bare — a couple of dead branches, not a canopy waiting to appear.
    kids.push(svg('path', {
      d: `M${cx} ${topY + h * 0.35} l-9 -9 M${cx} ${topY + h * 0.45} l8 -8`,
      stroke: '#4b4136', 'stroke-width': 1.4, fill: 'none', opacity: 0.55
    }));
  }
  return svg('g', {}, kids);
}

function flowerAt(i, level) {
  const x = 14 + hash(i, 2) * (W - 28);
  const y = GROUND_Y + 8 + hash(i, 3) * (H - GROUND_Y - 16);
  const hue = 90 + Math.round(hash(i, 4) * 60);
  const r = 2 + hash(i, 5) * 1.6;
  return svg('circle', {
    cx: x, cy: y, r, fill: `hsl(${hue} 45% ${55 + level * 3}%)`, opacity: 0.85
  });
}

function fireflyAt(i) {
  const x = 20 + hash(i, 6) * (W - 40);
  const y = 40 + hash(i, 7) * 90;
  const dot = svg('circle', { cx: x, cy: y, r: 1.6, fill: '#e8d98a', class: 'ig-firefly' });
  dot.style.animationDelay = `${(hash(i, 8) * 4).toFixed(2)}s`;
  return dot;
}

function pet(awake) {
  const cx = 200, cy = 158;
  const fill = awake ? 'var(--accent)' : '#3a3f4b';
  const ears = svg('g', {},
    svg('path', { d: `M${cx - 12} ${cy - 9} l-4 -10 l9 4 Z`, fill }),
    svg('path', { d: `M${cx + 12} ${cy - 9} l4 -10 l-9 4 Z`, fill }));
  const body = svg('ellipse', { cx, cy, rx: 17, ry: 13, fill });
  const eyes = awake
    ? svg('g', {},
        svg('circle', { cx: cx - 6, cy: cy - 2, r: 1.6, fill: '#0d0f13' }),
        svg('circle', { cx: cx + 6, cy: cy - 2, r: 1.6, fill: '#0d0f13' }))
    : svg('g', {},
        svg('path', { d: `M${cx - 9} ${cy - 2} q4 3 8 0`, stroke: '#0d0f13', 'stroke-width': 1.3, fill: 'none' }),
        svg('path', { d: `M${cx + 9} ${cy - 2} q-4 3 -8 0`, stroke: '#0d0f13', 'stroke-width': 1.3, fill: 'none' }));
  return svg('g', { class: `ig-pet${awake ? ' ig-pet-awake' : ''}` }, ears, body, eyes);
}

function gradient(id, from, to) {
  return svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': from }),
    svg('stop', { offset: '100%', 'stop-color': to }));
}

/** Build the whole scene as an <svg>, from a growth state (engine/growth.js) alone. */
export function renderScene(state) {
  const level = continuousLevel(state); // 0 .. STAGES.length - 1, continuous
  const awake = level >= 1;

  const defs = svg('defs', {},
    gradient('igSky', '#05060a', '#171a2e'),
    gradient('igGround', '#1b2a1f', '#0f1712'));

  const sky = svg('rect', { x: 0, y: 0, width: W, height: GROUND_Y + 2, fill: 'url(#igSky)' });
  const trees = TREE_X.map((cx, i) => tree(i, cx, clamp(level - i * 0.62, 0, 1)));
  const ground = svg('path', {
    d: `M0 ${GROUND_Y} Q${W / 2} ${GROUND_Y - 14} ${W} ${GROUND_Y} L${W} ${H} L0 ${H} Z`,
    fill: 'url(#igGround)'
  });

  const flowerCount = clamp(Math.round(level * 4), 0, 22);
  const flowers = Array.from({ length: flowerCount }, (_, i) => flowerAt(i, level));

  const fireflyCount = level >= 4 ? clamp(Math.round((level - 4) * 8), 0, 10) : 0;
  const fireflies = Array.from({ length: fireflyCount }, (_, i) => fireflyAt(i));

  return svg('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'scene-art', role: 'img',
    'aria-label': `${state.stage.name} — ${state.stage.line}`
  }, defs, sky, trees, ground, flowers, pet(awake), fireflies);
}

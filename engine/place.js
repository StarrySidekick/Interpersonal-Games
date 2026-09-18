// The place.
//
// INTENT.md, priority 1: "Render the environment the games take place in."
// A PET found in an abandoned, forested clearing, waking up and growing a
// garden as the two of you play. Nothing here is a game — it is a read of
// engine/record.js's own numbers, drawn as a scene instead of a stat table.
//
// Growth rule, carried straight from docs/scope.md rule 2: things accrue,
// nothing decays. Every number this file reads off the record only ever goes
// up (sittings played, rounds+questions logged), so the scene can never get
// less full than it was last time you looked. There is no "it's been three
// weeks" penalty anywhere in here — see relativeDay() in ui.js for the one
// place a gap is even mentioned, and it's informational, not a scold.
//
// Layout is deterministic, not random-per-load: every tree, flower and
// firefly draws its position from a fixed seed keyed to its own index, all
// the way up to the maximum this scene will ever show. So a scene at three
// sittings is a strict subset of the scene at thirty — nothing already
// grown ever jumps to a new spot when something new appears beside it.

import { rng } from './seed.js';
import { relativeDay } from './ui.js';

const MAX_TREES = 7;
const MAX_FLOWERS = 12;
const MAX_FIREFLIES = 16;

const rand = rng('interpersonal-games/the-place');
// Drawn once, in this fixed order, so element N's numbers never depend on how
// many elements are currently showing.
const treeSeed = Array.from({ length: MAX_TREES }, () => ({
  x: 22 + rand() * 356, lean: (rand() - 0.5) * 10, scale: 0.78 + rand() * 0.5
}));
const flowerSeed = Array.from({ length: MAX_FLOWERS }, () => ({
  x: rand(), y: rand(), hue: rand()
}));
const fireflySeed = Array.from({ length: MAX_FIREFLIES }, () => ({
  x: 20 + rand() * 360, y: 30 + rand() * 95, delay: rand() * 6, dur: 3.2 + rand() * 2.6
}));

/** Read the record into the numbers the scene is drawn from. Never mutates. */
export function placeState(record) {
  const sittings = record.sittings || [];
  const rounds = sittings.reduce((n, s) => {
    const d = s.data || {};
    if (s.game === 'blind-agreement') return n + (d.rounds ? d.rounds.length : 0);
    if (s.game === 'twenty-twenty') return n + (d.asked || 0);
    return n;
  }, 0);
  const starts = sittings.map((s) => s.startedAt).filter(Boolean);
  const ends = sittings.map((s) => s.endedAt).filter(Boolean);

  return {
    sittings: sittings.length,
    rounds,
    firstPlayed: starts.length ? Math.min(...starts) : null,
    lastPlayed: ends.length ? Math.max(...ends) : null
  };
}

// --- growth, derived from the state -----------------------------------------

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

function growth(state) {
  const s = state.sittings;
  return {
    awake: s >= 1,
    // A bare clearing starts with two dead branches, not nothing — an empty
    // scene reads as broken, an unwoken one reads as a place.
    treeCount: s <= 0 ? 2 : Math.min(MAX_TREES, 2 + Math.floor(s / 2)),
    canopy: clamp01(s / 10),
    gardenBed: s >= 4,
    flowerCount: s >= 4 ? Math.min(MAX_FLOWERS, s - 3) : 0,
    fireflyCount: s >= 1 ? Math.min(MAX_FIREFLIES, 2 + Math.floor(state.rounds / 3)) : 0,
    warmth: clamp01(s / 12)
  };
}

const TIERS = [
  { at: 0, line: 'Nothing has happened here yet. The PET is curled up asleep, and the clearing around it is bare — a couple of dead branches, no undergrowth. It wakes the first time you play something.' },
  { at: 1, line: 'The PET is awake. There is a single shoot by its feet where there was nothing before — the first sitting did that.' },
  { at: 3, line: 'A few more shoots, and the ground has gone from bare dirt to something with texture underfoot.' },
  { at: 5, line: 'There is a garden bed now, and it is not empty — roughly a flower a sitting. The trees round it have gone from sticks to something with canopy.' },
  { at: 8, line: 'The clearing is filling in. Fireflies show up after dark here now, which they did not at the start.' },
  { at: 12, line: 'This has been going for a while. Full canopy, a garden that is actually a garden, and enough light in the evenings that you do not need a torch to find your way back.' }
];

function tierLine(sittings) {
  let line = TIERS[0].line;
  for (const t of TIERS) if (sittings >= t.at) line = t.line;
  return line;
}

/** Prose under the scene, in the repo's own voice — plain, specific, unexcited. */
export function placeCaption(state) {
  const lines = [tierLine(state.sittings)];
  const bits = [];
  if (state.sittings) {
    bits.push(`${state.sittings} sitting${state.sittings === 1 ? '' : 's'}`);
  }
  if (state.rounds) {
    bits.push(`${state.rounds} round${state.rounds === 1 ? '' : 's'} and questions between you`);
  }
  const when = relativeDay(state.lastPlayed);
  if (when) bits.push(`last here ${when}`);
  if (bits.length) lines.push(`${bits.join(' · ')}.`);
  return lines;
}

// --- colour -------------------------------------------------------------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * clamp01(t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const FLOWER_HUES = ['#e8b661', '#e2796f', '#86d9a8', '#e9ecf1', '#c98fd6'];

// --- the scene, as an SVG fragment ---------------------------------------

function treeSVG(seed, i, g) {
  if (i >= g.treeCount) return '';
  const baseY = 152 + (i % 2) * 3;
  const h = 34 * seed.scale;
  const trunkColor = '#4b3a2c';
  const twigTop = `${seed.x + seed.lean},${baseY - h}`;
  // Bare: a forked twig. Grown: the same twig, plus a canopy blob riding it.
  let out = `<path d="M${seed.x},${baseY} L${twigTop}" stroke="${trunkColor}" stroke-width="${2.4 * seed.scale}" stroke-linecap="round" fill="none"/>`;
  if (g.canopy > 0.04) {
    const r = 15 * seed.scale * Math.min(1, g.canopy * 1.35 + 0.15);
    const canopyColor = mix('#3b4a3b', '#4f8a5f', g.canopy);
    const cx = seed.x + seed.lean * 0.6, cy = baseY - h - r * 0.5;
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.8}" fill="${canopyColor}"/>`;
    out += `<ellipse cx="${cx - r * 0.5}" cy="${cy + r * 0.25}" rx="${r * 0.65}" ry="${r * 0.5}" fill="${canopyColor}"/>`;
    out += `<ellipse cx="${cx + r * 0.55}" cy="${cy + r * 0.2}" rx="${r * 0.6}" ry="${r * 0.48}" fill="${canopyColor}"/>`;
  } else {
    out += `<path d="M${seed.x},${baseY - h * 0.6} l${5 * seed.scale},${-5 * seed.scale}" stroke="${trunkColor}" stroke-width="1.6" stroke-linecap="round"/>`;
    out += `<path d="M${seed.x},${baseY - h * 0.75} l${-4 * seed.scale},${-5 * seed.scale}" stroke="${trunkColor}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return out;
}

function flowerSVG(seed, i, g, bedX, bedW, bedY) {
  if (i >= g.flowerCount) return '';
  const x = bedX + seed.x * bedW;
  const y = bedY - seed.y * 7;
  const color = FLOWER_HUES[Math.floor(seed.hue * FLOWER_HUES.length)];
  return `<g>` +
    `<path d="M${x},${bedY - 1} L${x},${y}" stroke="#3a5a40" stroke-width="1.3"/>` +
    `<circle cx="${x}" cy="${y}" r="2.6" fill="${color}"/>` +
    `</g>`;
}

function fireflySVG(seed, i, g) {
  if (i >= g.fireflyCount) return '';
  return `<circle class="firefly" cx="${seed.x}" cy="${seed.y}" r="1.8" fill="#e8b661" ` +
    `style="animation-delay:${seed.delay.toFixed(2)}s;animation-duration:${seed.dur.toFixed(2)}s"/>`;
}

function petSVG(g) {
  const cx = 200, cy = 150;
  if (!g.awake) {
    return `<g>` +
      `<ellipse cx="${cx}" cy="${cy + 8}" rx="20" ry="5" fill="#000" opacity=".18"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="14" ry="11" fill="#454b54"/>` +
      `<path d="M${cx - 6},${cy - 1} q6,3 12,0" stroke="#2c3038" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
      `</g>`;
  }
  const body = mix('#5c8f72', '#86d9a8', g.warmth);
  return `<g class="pet">` +
    `<ellipse cx="${cx}" cy="${cy + 10}" rx="20" ry="5" fill="#000" opacity=".22"/>` +
    `<circle cx="${cx}" cy="${cy}" r="16" fill="${body}"/>` +
    `<circle cx="${cx - 6.5}" cy="${cy - 6}" r="6" fill="${body}" opacity=".55"/>` +
    `<circle cx="${cx - 5}" cy="${cy - 3}" r="1.8" fill="#0d1b12"/>` +
    `<circle cx="${cx + 5}" cy="${cy - 3}" r="1.8" fill="#0d1b12"/>` +
    `</g>`;
}

/** Returns the SVG child markup for a 0 0 400 200 viewBox. Pure string build. */
export function placeSceneSVG(state) {
  const g = growth(state);
  const sky = `<rect width="400" height="200" fill="url(#ig-sky)"/>`;
  const grad = `<defs><linearGradient id="ig-sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${mix('#11141a', '#1b2b3a', g.warmth)}"/>` +
    `<stop offset="1" stop-color="${mix('#1c2027', '#4a3826', g.warmth)}"/>` +
    `</linearGradient></defs>`;
  const ground = `<path d="M0,158 Q100,146 200,155 T400,150 V200 H0 Z" ` +
    `fill="${mix('#23271f', '#24402c', g.warmth)}"/>`;

  const trees = treeSeed.map((seed, i) => treeSVG(seed, i, g)).join('');

  let garden = '';
  if (g.gardenBed) {
    const bedX = 240, bedW = 130, bedY = 168;
    garden = `<ellipse cx="${bedX + bedW / 2}" cy="${bedY + 6}" rx="${bedW / 2 + 6}" ry="10" fill="#2c2116"/>` +
      flowerSeed.map((seed, i) => flowerSVG(seed, i, g, bedX, bedW, bedY)).join('');
  }

  const fireflies = fireflySeed.map((seed, i) => fireflySVG(seed, i, g)).join('');
  const pet = petSVG(g);

  return grad + sky + ground + trees + garden + pet + `<g class="fireflies">${fireflies}</g>`;
}

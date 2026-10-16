// What Grove Chess sounds like, built from engine/sound.js's two primitives.
// Every function takes `at`, seconds from now, so an animation can schedule
// its sounds the moment it starts and they land exactly on the frames.
//
// The rabbit's hops are notes. Each direction has its own pitch, so a
// pattern that repeats is a tune that repeats: you can hear it as well as
// see it. When the rabbit bounces off an edge its pattern flips, and so does
// the tune, the way a melody turned upside down is an inversion in music.

import { tone, noise } from '../../engine/sound.js';

// The major pentatonic scale: five notes with no semitone between any two,
// which is why any of them sound fine together. Degree 0 is G3.
const SCALE = [0, 2, 4, 7, 9];
export function hz(deg) {
  const o = Math.floor(deg / 5), s = SCALE[((deg % 5) + 5) % 5];
  return 196 * 2 ** ((o * 12 + s) / 12);
}

/** The scale degree for a hop: up is two steps higher, right one, and so on,
    around the middle of the range. */
export const hopDegree = (dx, dy) => Math.max(0, Math.min(14, 7 + dy * 2 + dx));

/** Your piece setting down: a short wooden knock. */
export function move(at = 0, vol = 1) {
  tone({ f: 230, f2: 150, type: 'triangle', at, dur: 0.08, vol: 0.28 * vol });
  noise({ at, dur: 0.035, vol: 0.12 * vol, from: 1800, type: 'bandpass', q: 3 });
}

/** One of their thinking pieces moving: a lower knock. */
export function slide(at = 0) {
  tone({ f: 160, f2: 105, type: 'triangle', at, dur: 0.09, vol: 0.24 });
  noise({ at, dur: 0.04, vol: 0.1, from: 1200, type: 'bandpass', q: 3 });
}

/** A rabbit hop: a springy note at the pitch for its direction, and a soft
    thump where it lands. */
export function hop(dx, dy, at = 0, land = at + 0.3, vol = 1) {
  const f = hz(hopDegree(dx, dy));
  tone({ f: f * 0.72, f2: f, type: 'triangle', at, dur: 0.16, vol: 0.22 * vol, attack: 0.01 });
  noise({ at: land, dur: 0.05, vol: 0.08 * vol, from: 500, type: 'lowpass' });
}

/** A hop that could not land: a dull bump. */
export function bump(at = 0) {
  tone({ f: 120, f2: 80, at, dur: 0.14, vol: 0.25 });
}

/** A square falling away: a crumble of earth and a low drop, then pebbles. */
export function crumble(at = 0) {
  noise({ at, dur: 0.45, vol: 0.3, from: 1400, to: 140, type: 'lowpass' });
  tone({ f: 90, f2: 45, at: at + 0.05, dur: 0.3, vol: 0.22 });
  for (const d of [0.18, 0.27, 0.39]) noise({ at: at + d, dur: 0.03, vol: 0.06, from: 2600, type: 'bandpass', q: 6 });
}

/** The rabbit eating one of your pieces. Munch, munch, munch. */
export function eat(at = 0) {
  for (const d of [0, 0.1, 0.2]) noise({ at: at + d, dur: 0.06, vol: 0.2, from: 900, type: 'bandpass', q: 2 });
  tone({ f: 140, f2: 90, type: 'square', at, dur: 0.09, vol: 0.05 });
}

/** Catching something when the game goes on. */
export function capture(at = 0) {
  tone({ f: 520, f2: 900, at, dur: 0.09, vol: 0.22 });
  noise({ at, dur: 0.05, vol: 0.06, from: 3000, type: 'highpass' });
}

/** The catch that wins: a bright pop and a sparkle running up the scale. */
export function caught(at = 0) {
  tone({ f: 600, f2: 1250, at, dur: 0.11, vol: 0.26 });
  noise({ at, dur: 0.06, vol: 0.08, from: 3500, type: 'highpass' });
  [11, 12, 14].forEach((d, i) => tone({ f: hz(d), type: 'triangle', at: at + 0.16 + i * 0.06, dur: 0.18, vol: 0.12 }));
}

/** The ball dropping into the hole: a plunk, then a rattle. */
export function sink(at = 0) {
  tone({ f: 320, f2: 90, at, dur: 0.26, vol: 0.28 });
  noise({ at: at + 0.06, dur: 0.3, vol: 0.12, from: 700, to: 120, type: 'lowpass' });
}

/** The board slamming down in the opening. */
export function slam(at = 0) {
  tone({ f: 110, f2: 38, at, dur: 0.5, vol: 0.45 });
  noise({ at, dur: 0.45, vol: 0.3, from: 900, to: 80, type: 'lowpass' });
}

/** Piece i landing in the opening: a knock that steps up the scale. */
export function drop(i, at = 0) {
  tone({ f: hz(5 + i) * 0.6, f2: hz(5 + i) * 0.42, type: 'triangle', at, dur: 0.09, vol: 0.24 });
  noise({ at, dur: 0.03, vol: 0.08, from: 1800, type: 'bandpass', q: 3 });
}

/** One note of the rabbit's tune, for drawing its pattern out. */
export function note(dx, dy, at = 0, vol = 1) {
  tone({ f: hz(hopDegree(dx, dy)), type: 'triangle', at, dur: 0.28, vol: 0.2 * vol, attack: 0.01 });
}

/** A soft tick, for a line being drawn. */
export function tick(at = 0) {
  tone({ f: 1400, f2: 1100, at, dur: 0.03, vol: 0.05 });
}

/**
 * The tune for a win. `level` is how good it was, from 0 (caught, but well
 * over par) to 4 (eagle or better). Each level is one note longer and ends
 * higher, so you can hear how well you did before you read it.
 */
export function fanfare(level, at = 0.1) {
  const notes = [5, 7, 9, 10, 12, 14, 15].slice(0, 3 + level);
  const gap = 0.11;
  notes.forEach((d, i) => {
    const last = i === notes.length - 1, t = at + i * gap;
    tone({ f: hz(d), type: 'triangle', at: t, dur: last ? 0.7 : 0.16, vol: last ? 0.26 : 0.2, attack: 0.008 });
    if (last) tone({ f: hz(d) * 2, at: t, dur: 0.6, vol: 0.06 });
  });
  if (level >= 4) {
    // Eagle: a trill on top.
    const t = at + notes.length * gap + 0.1;
    for (let i = 0; i < 6; i++) tone({ f: hz(i % 2 ? 15 : 14), type: 'triangle', at: t + i * 0.055, dur: 0.07, vol: 0.1 });
  }
}

/** Dusk falls and the rabbit gets away: an owl, twice. */
export function dusk(at = 0.15) {
  tone({ f: 330, f2: 300, at, dur: 0.38, vol: 0.22, attack: 0.05 });
  tone({ f: 300, f2: 270, at: at + 0.48, dur: 0.6, vol: 0.2, attack: 0.05 });
}

/** The rabbit ate everything: a sliding-down wah. */
export function lost(at = 0.15) {
  tone({ f: 420, f2: 130, type: 'triangle', at, dur: 0.8, vol: 0.2, attack: 0.02 });
}

/** Map a result to a fanfare level: 4 eagle or better, 3 birdie, 2 par,
    1 bogey, 0 anything worse. */
export const levelFor = (overPar) => (overPar <= -2 ? 4 : overPar === -1 ? 3 : overPar === 0 ? 2 : overPar === 1 ? 1 : 0);

/** A square falling off a shrinking edge: a soft, deep sinking, like
    something dropping a long way into fog. */
export function shrink(at = 0) {
  tone({ f: 220, f2: 55, at, dur: 0.6, vol: 0.2, attack: 0.03 });
  noise({ at, dur: 0.5, vol: 0.12, from: 700, to: 60, type: 'lowpass' });
}

/** The hole's cover opening once the last rabbit is caught: a wooden clunk,
    then two notes rising. */
export function opens(at = 0) {
  tone({ f: 180, f2: 120, type: 'triangle', at, dur: 0.1, vol: 0.25 });
  noise({ at, dur: 0.05, vol: 0.1, from: 1200, type: 'bandpass', q: 3 });
  tone({ f: hz(9), type: 'triangle', at: at + 0.12, dur: 0.2, vol: 0.16 });
  tone({ f: hz(12), type: 'triangle', at: at + 0.24, dur: 0.4, vol: 0.16 });
}

/** Falling through the hole to the next level down: a long whistle
    dropping away, then a landing thump. */
export function fall(at = 0) {
  tone({ f: 1100, f2: 160, at, dur: 1.1, vol: 0.14, attack: 0.05 });
  noise({ at, dur: 1.0, vol: 0.06, from: 3000, to: 400, type: 'bandpass', q: 1 });
  tone({ f: 110, f2: 40, at: at + 1.15, dur: 0.4, vol: 0.4 });
}

/** A rabbit diving into a piece to possess it: a soft rising swoop and a
    glassy ring. */
export function possess(at = 0) {
  tone({ f: 300, f2: 900, at, dur: 0.22, vol: 0.12, attack: 0.02 });
  tone({ f: hz(12), type: 'triangle', at: at + 0.18, dur: 0.5, vol: 0.09 });
  tone({ f: hz(12) * 1.5, at: at + 0.18, dur: 0.4, vol: 0.04 });
}

/** The floor giving way under you: a deep crumbling roar that drops off. */
export function collapse(at = 0) {
  noise({ at, dur: 1.4, vol: 0.32, from: 900, to: 60, type: 'lowpass' });
  tone({ f: 90, f2: 30, at, dur: 1.3, vol: 0.32, attack: 0.05 });
  for (const d of [0.15, 0.35, 0.5, 0.8, 1.0]) noise({ at: at + d, dur: 0.06, vol: 0.08, from: 2200, type: 'bandpass', q: 5 });
}

/** Your set taking its turn (Adventure): a soft grind of stone as one piece
    sinks into its plinth, then two notes rising as the next comes up. */
export function turn(at = 0) {
  noise({ at, dur: 0.24, vol: 0.06, from: 700, to: 160, type: 'lowpass' });
  tone({ f: hz(5), type: 'triangle', at: at + 0.24, dur: 0.12, vol: 0.1, attack: 0.01 });
  tone({ f: hz(9), type: 'triangle', at: at + 0.34, dur: 0.32, vol: 0.1, attack: 0.01 });
}

/** Taking a new piece on the way down: a knock as it joins your hand, then
    three notes climbing. */
export function gain(at = 0) {
  tone({ f: 230, f2: 150, type: 'triangle', at, dur: 0.08, vol: 0.26 });
  [7, 9, 12].forEach((d, i) => tone({ f: hz(d), type: 'triangle', at: at + 0.1 + i * 0.09, dur: i === 2 ? 0.45 : 0.14, vol: 0.16, attack: 0.008 }));
}

/** A shield dropping into place in front of a guarded piece: a bright metal
    clink and a short ring. A gold one (two guards) rings on, a note higher. */
export function shield(at = 0, gold = false) {
  tone({ f: 1320, f2: 1250, type: 'triangle', at, dur: 0.22, vol: 0.14 });
  tone({ f: 1980, f2: 1900, type: 'sine', at: at + 0.01, dur: 0.3, vol: 0.07 });
  noise({ at, dur: 0.03, vol: 0.08, from: 4200, type: 'bandpass', q: 5 });
  if (gold) tone({ f: 2640, type: 'sine', at: at + 0.09, dur: 0.5, vol: 0.06, attack: 0.01 });
}

/** A needle driven through a pinned piece (2026-10-13): a thin steel
    whistle as it drops, then a sharp, dry stab. */
export function pin(at = 0) {
  tone({ f: 2400, f2: 3400, type: 'sine', at: Math.max(0, at - 0.18), dur: 0.16, vol: 0.035 });
  noise({ at, dur: 0.025, vol: 0.12, from: 6000, type: 'highpass', q: 1 });
  tone({ f: 520, f2: 180, type: 'square', at, dur: 0.06, vol: 0.06 });
  tone({ f: 3100, f2: 2900, type: 'triangle', at: at + 0.01, dur: 0.12, vol: 0.05 });
}

/** A ghost gone (2026-10-13): a soft breath, falling away. */
export function ghost(at = 0) {
  noise({ at, dur: 0.45, vol: 0.07, from: 1600, to: 300, type: 'bandpass', q: 2 });
  tone({ f: 620, f2: 260, type: 'sine', at, dur: 0.5, vol: 0.05, attack: 0.05 });
}

/** Gates swapping: a low iron clank and the rattle of a chain. */
export function gate(at = 0) {
  tone({ f: 140, f2: 95, type: 'square', at, dur: 0.12, vol: 0.05 });
  noise({ at: at + 0.02, dur: 0.18, vol: 0.06, from: 2600, type: 'bandpass', q: 6 });
}

/** A statue taken: a crack of stone and a falling rattle. */
export function smash(at = 0) {
  noise({ at, dur: 0.07, vol: 0.18, from: 900, type: 'lowpass', q: 1 });
  tone({ f: 110, f2: 55, type: 'triangle', at, dur: 0.2, vol: 0.12 });
  noise({ at: at + 0.06, dur: 0.3, vol: 0.06, from: 3000, to: 1200, type: 'bandpass', q: 3 });
}


/** A weapon at work (2026-10-16): a sword's swish, a lance's longer rush,
    a mace's heavy thud, a net's soft swoop and a snap as it closes. */
export function weapon(kind, at = 0) {
  if (kind === 'mace') {
    tone({ f: 95, f2: 48, type: 'triangle', at, dur: 0.3, vol: 0.32 });
    noise({ at, dur: 0.2, vol: 0.2, from: 700, type: 'lowpass' });
    return;
  }
  // The shield (2026-10-16): a dull clang of steel on wood, and a scrape.
  if (kind === 'shield') {
    tone({ f: 260, f2: 180, type: 'square', at, dur: 0.16, vol: 0.08 });
    noise({ at: at + 0.04, dur: 0.22, vol: 0.09, from: 1200, to: 400, type: 'bandpass', q: 1.2 });
    return;
  }
  if (kind === 'net') {
    noise({ at, dur: 0.34, vol: 0.08, from: 500, to: 2200, type: 'bandpass', q: 1.5 });
    tone({ f: 330, f2: 660, type: 'sine', at: at + 0.22, dur: 0.12, vol: 0.07 });
    return;
  }
  noise({ at, dur: kind === 'lance' ? 0.3 : 0.16, vol: 0.14, from: 2400, to: 6000, type: 'bandpass', q: 2 });
  tone({ f: 2200, f2: 1700, type: 'triangle', at: at + 0.04, dur: 0.12, vol: 0.05 });
}

/** A piece taking on a suit: a shimmer running up the scale. */
export function transform(at = 0) {
  [0, 2, 4, 5, 7, 9].forEach((d, i) => tone({ f: hz(d + 5), type: 'sine', at: at + i * 0.06, dur: 0.24, vol: 0.07, attack: 0.01 }));
  noise({ at, dur: 0.45, vol: 0.04, from: 5000, type: 'highpass' });
}

/** A weapon taken up: it drops into the piece's hand with a clink. */
export function equip(at = 0) {
  tone({ f: 990, f2: 940, type: 'triangle', at, dur: 0.18, vol: 0.13 });
  noise({ at, dur: 0.03, vol: 0.08, from: 3800, type: 'bandpass', q: 5 });
  tone({ f: 1480, type: 'sine', at: at + 0.08, dur: 0.35, vol: 0.05, attack: 0.01 });
}

/** A heart spent (Adventure, 2026-10-16): a soft crack, the hit piece
    staying put, and the taker thrown back. */
export function heartBreak(at = 0) {
  tone({ f: 660, f2: 330, type: 'triangle', at, dur: 0.22, vol: 0.1 });
  noise({ at, dur: 0.12, vol: 0.06, from: 2500, type: 'bandpass', q: 3 });
}

/** A piece with a rabbit stays where it is (2026-10-16): a little rising chirp. */
export function stayBehind(at = 0) {
  tone({ f: 520, f2: 880, type: 'sine', at, dur: 0.14, vol: 0.07, attack: 0.01 });
  tone({ f: 780, f2: 1170, type: 'sine', at: at + 0.09, dur: 0.12, vol: 0.05, attack: 0.01 });
}

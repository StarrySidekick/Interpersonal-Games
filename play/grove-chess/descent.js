// The descent: a run of levels, each one a little deeper and harder. Catch
// every rabbit to open the hole, sink the ball, and fall through to the next
// level down. Lose, and the run is over; how deep you got is the score.
// (Timothy, 2026-10-06: "once you get the ball into the hole it falls down
// into another level that's harder ... see how far you can go.")
//
// Every level is a standard board (lab.js): a ground, a shape and a size,
// rabbits, a hole, and dark pieces. Depth decides the settings, and each
// depth adds at most one new thing, so something new is introduced alone
// before it is combined with the rest. The solver checks every level is
// winnable and balanced before you see it.

import { clean, FAIRY } from './lab.js';

/** Settings for depth d (1 is the top), with `rand` for the dice. */
export function depthSettings(d, rand) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const size = Math.min(8, 5 + Math.floor((d - 1) / 3));          // 5, 5, 5, 6, 6, 6, 7 ...
  const hand = ['rook', 'knight', 'bishop'];
  if (d >= 5) hand.push(pick(FAIRY));                              // one strange piece a level, from depth 5
  const grounds = d < 3 ? ['solid'] : d < 4 ? ['solid', 'crumble'] : d < 6 ? ['solid', 'crumble', 'shrink'] : ['solid', 'crumble', 'shrink', 'spiral'];
  const parMin = Math.min(6, 3 + Math.floor((d - 1) / 3));
  return clean({
    v: 2,
    w: size, h: size,
    shape: d < 4 ? 'rect' : pick(['rect', 'rect', 'diamond', 'round', 'cross', 'hourglass', 'cheese']),
    holes: 0,
    ground: pick(grounds), shrinkEvery: d < 7 ? 2 : 1,
    mine: hand.length + 1, minePool: hand, mineDupes: false, mineRows: 2, royal: false, wait: true,
    rabbits: d < 5 ? 1 : 2, rabbitBrain: 'pattern', patterns: d < 8 ? 'daily' : pick(['daily', 'mid']), hops: 1, tracks: true, rabbitsEat: false,
    foes: d === 1 ? 0 : d < 4 ? 1 : 2,
    foePool: d < 4 ? ['pawn', 'king'] : d < 7 ? ['pawn', 'king', 'knight', 'bishop'] : ['pawn', 'king', 'knight', 'bishop', 'rook'],
    foeDupes: true, mirror: false, foeRows: d < 4 ? 2 : 3,
    skill: d < 3 ? '1' : '2', style: d < 5 ? 'balanced' : 'hunt', foesCapture: true,
    goal: 'descent', holeMoves: d < 2 ? 'still' : 'daily', ballStops: false,
    maxMoves: Math.min(24, 14 + 2 * Math.floor(d / 2)), first: 'you',
    solve: true, parMin, parMax: parMin + 6, balance: 'on'
  });
}

// --- The record: how deep you have been. Only ever goes up. ----------------

const KEY = 'ig.grove.descent.v1';

export function loadDescent() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1) return s;
  } catch { /* storage blocked: start fresh */ }
  return { version: 1, best: 0, runs: 0 };
}

export function saveDescent(rec) {
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* never end a run over storage */ }
}

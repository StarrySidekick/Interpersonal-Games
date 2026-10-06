// The descent: a run of levels, each one a little deeper and harder. Catch
// every rabbit to open the hole, sink the ball, and fall through to the next
// level down. Lose, and the run is over; how deep you got is the score.
// (Timothy, 2026-10-06: "once you get the ball into the hole it falls down
// into another level that's harder ... see how far you can go.")
//
// Every level is a standard board (lab.js): a ground, a shape and a size, a
// hole, and pieces of theirs possessed by rabbits. Early on every piece has
// the same kind of rabbit inside, so you can see the pattern; deeper down
// there are more kinds. Depth adds at most one new thing at a time.
//
// Your pieces go down with you (Timothy, 2026-10-06). The run starts with
// the ball and three pieces; whatever is left when you sink the ball falls
// with it to the next board, and a piece taken stays gone. On the way down
// you find one more piece (offersFor, below). Each level is found by the
// solver for exactly the pieces you are carrying.

import { clean } from './lab.js';

/** What every descent starts with: the ball, then three pieces. */
export const START_HAND = ['ball', 'rook', 'knight', 'bishop'];

/** Settings for depth d (1 is the top), with `rand` for the dice and
    `hand` for the pieces you are carrying (the ball first). */
export function depthSettings(d, rand, hand = START_HAND) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const size = Math.min(8, 5 + Math.floor((d - 1) / 3));          // 5, 5, 5, 6, 6, 6, 7 ...
  const grounds = d < 3 ? ['solid'] : d < 4 ? ['solid', 'crumble'] : d < 6 ? ['solid', 'crumble', 'shrink'] : ['solid', 'crumble', 'shrink', 'spiral'];
  // What the rabbits possess: short steppers first, so the pattern is easy
  // to see, then jumpers, then sliders and stranger pieces.
  const pool = d < 3 ? ['king', 'wazir', 'ferz'] : d < 5 ? ['king', 'wazir', 'ferz', 'knight']
    : d < 7 ? ['king', 'knight', 'bishop', 'rook', 'ferz'] : ['king', 'knight', 'bishop', 'rook', 'camel', 'alfil', 'mao'];
  // About three to face, never more than you have pieces to catch them with.
  const count = Math.min(d < 7 ? 3 : 4, Math.max(1, hand.length - 1));
  const parMin = Math.min(7, 4 + Math.floor((d - 1) / 3));
  return clean({
    v: 3,
    w: size, h: size,
    shape: d < 4 ? 'rect' : pick(['rect', 'rect', 'diamond', 'round', 'cross', 'hourglass', 'cheese']),
    holes: 0,
    ground: pick(grounds), shrinkEvery: d < 7 ? 2 : 1,
    hand, mineRows: 2, royal: false, wait: true,
    rabbits: 0, rabbitBrain: 'pattern', patterns: 'all', hops: 1, tracks: true, rabbitsEat: false,
    foes: count, darkBrain: 'possessed', kinds: d < 4 ? 1 : d < 7 ? 2 : 3,
    foePool: pool, foeDupes: true, mirror: false, foeRows: d < 4 ? 2 : 3,
    skill: '2', style: 'balanced', foesCapture: d >= 3,              // from depth 3 they can take your pieces
    goal: 'descent', holeMoves: d < 2 ? 'still' : 'daily', ballStops: false, ballMove: 'putt',
    maxMoves: Math.min(28, 16 + 2 * Math.floor(d / 2)), first: 'you',
    solve: true, parMin, parMax: parMin + 7, balance: 'on'
  });
}

// --- A new piece on the way down. -------------------------------------------
// (Timothy, 2026-10-06.) Falling to each new depth, you are offered two
// pieces and take one: always one classic piece and one fairy piece, the
// known thing or the strange one, and the fairy pieces get stranger the
// deeper you go. The solver finds each level for the hand you carry, and
// only takes one as long as that depth asks for, so more pieces do not make
// it easy.

/** How many pieces you can carry, the ball included. */
export const HAND_MAX = 6;

/** The two pieces offered on the way down to depth d (2 and deeper). */
export function offersFor(d, rand) {
  const classic = ['king', 'knight', 'bishop', 'rook', ...(d >= 6 ? ['queen'] : [])];
  const fairy = ['wazir', 'ferz', 'alfil', 'mao', 'zebra', 'camel', 'grasshopper', 'cannon',
    ...(d >= 5 ? ['squirrel', 'rose'] : []), ...(d >= 8 ? ['nightrider', 'archbishop'] : [])];
  const pick = (a) => a[Math.floor(rand() * a.length)];
  return [pick(classic), pick(fairy)];
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

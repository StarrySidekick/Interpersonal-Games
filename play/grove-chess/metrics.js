// How a level plays, in numbers: how hard it is, how high its skill ceiling
// is, and how engaging it might be (Timothy, 2026-10-08: "we need a way to
// define how difficult a board/level is", and "find a way to rank if a
// board is like engaging").
//
// Par (solve.js) only says how fast an expert can win. To say how hard a
// level is, you also need to know how a beginner does. So a novice bot
// plays it many times: it takes a win it can see, usually grabs a capture,
// and otherwise picks among its few best-looking moves with some luck. Its
// luck comes from a seed, so the numbers come out the same every time.
//
// - Difficulty, 1 to 10: mostly how often the novice loses, plus how long
//   par is against the move limit.
// - Skill ceiling: how much longer the novice takes to win than par. High
//   means hard to win fast but easy to win slowly: the daily's shape.
// - Engagement, 0 to 100: four guesses at what makes a board interesting,
//   averaged (choices that matter, pieces used, pieces threatening each
//   other, comebacks). A first version: the Chaos notebook keeps these next
//   to Timothy's ratings so they can be checked against what was fun.

import { initialState, allMoves, playerMove, apply, isOver, movesFor, foeMovesFor, PIECES, replay } from './rules.js';
import { score } from './solve.js';
import { rng } from '../../engine/seed.js';

/** One novice game. Returns { won, t, lostPieces, threats, captures, turns, moved }. */
export function noviceGame(level, seed) {
  const rand = rng(`novice:${level.seed ?? 0}:${seed}`);
  let s = initialState(level);
  let threats = 0, captures = 0, turns = 0;
  const moved = new Set();
  const cap = level.rules.maxMoves || 40;
  while (!isOver(s) && s.t < cap) {
    const moves = allMoves(s);
    let pick = null;
    // A win it can see.
    for (const mv of moves) if (mv.p >= 0 && playerMove(s, mv).won) { if (rand() < 0.9) pick = mv; break; }
    // Usually grabs a capture.
    if (!pick) {
      const caps = moves.filter((m) => m.cap && s.foes.some((f) => !f.taken && f.x === m.x && f.y === m.y));
      if (caps.length && rand() < 0.7) pick = caps[Math.floor(rand() * caps.length)];
    }
    // Otherwise one of its three best-looking moves.
    if (!pick) {
      const scored = moves.map((mv) => ({ mv, v: score(playerMove(s, mv)) + rand() * 6 })).sort((a, b) => a.v - b.v);
      pick = scored[Math.floor(rand() * Math.min(3, scored.length))].mv;
    }
    if (pick.p >= 0) moved.add(pick.p);
    const before = s.foes.filter((f) => f.taken).length;
    s = apply(s, pick);
    captures += s.foes.filter((f) => f.taken).length - before;
    // Tension: pieces of each side in reach of the other.
    const hit = new Set();
    s.foes.forEach((f, k) => { if (!f.taken) for (const m of foeMovesFor(s, k)) if (m.cap) hit.add(m.y * level.W + m.x); });
    threats += s.pieces.filter((p) => !p.taken && hit.has(p.y * level.W + p.x)).length;
    s.pieces.forEach((p, i) => { if (!p.taken) for (const m of movesFor(s, i)) if (m.cap) threats += 0.5; });
    turns++;
  }
  return { won: s.won, t: s.t, lostPieces: s.pieces.filter((p) => p.taken).length, threats, captures, turns, moved: moved.size };
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/**
 * Measure a level. `res` is the solver's result ({ par, line }), if there
 * is one. Returns { difficulty, ceiling, engagement, novice: { winRate,
 * winLen }, parts }.
 */
export function measure(level, res = null, { games = 24 } = {}) {
  const limit = level.rules.maxMoves || 40, par = res?.par ?? null;
  const runs = Array.from({ length: games }, (_, i) => noviceGame(level, i));
  const wins = runs.filter((r) => r.won);
  const winRate = wins.length / runs.length;
  const winLen = wins.length ? wins.reduce((a, r) => a + r.t, 0) / wins.length : null;

  // Difficulty: the novice's losses, and how long the shortest win is.
  const parLoad = par ? clamp((par - 2) / (limit * 0.6)) : 1;
  const difficulty = Math.round(1 + 9 * clamp(0.65 * (1 - winRate) + 0.35 * parLoad));

  // Skill ceiling: how much faster an expert wins than a novice.
  const ceiling = par && winLen ? Math.max(0, (winLen - par) / par) : null;

  // Engagement. (a) Choices that matter: on the solver's line, the share of
  // moves that improve the position; best when some do and most do not.
  let choice = 0.5;
  if (res?.line?.length) {
    const { states } = replay(level, res.line);
    let sum = 0, n = 0;
    for (const st of states.slice(0, -1)) {
      const moves = allMoves(st), here = score(st);
      if (moves.length < 2) continue;
      const better = moves.filter((mv) => score(playerMove(st, mv)) < here).length / moves.length;
      sum += 1 - Math.abs(better - 0.25) / 0.75; n++;
    }
    if (n) choice = clamp(sum / n);
  }
  // (b) Pieces used, by the novice. (c) Tension: threats and captures per
  // turn. (d) Comebacks: wins that cost a piece.
  const pieces = level.pieces.length || 1;
  const used = clamp(runs.reduce((a, r) => a + r.moved, 0) / runs.length / pieces);
  const tension = clamp(runs.reduce((a, r) => a + (r.threats + r.captures * 2) / Math.max(1, r.turns), 0) / runs.length / 2.5);
  const comeback = wins.length ? clamp(wins.filter((r) => r.lostPieces > 0).length / wins.length / 0.5) : 0;
  const engagement = Math.round(100 * (0.3 * choice + 0.25 * used + 0.25 * tension + 0.2 * comeback));
  return { difficulty, ceiling, engagement, novice: { winRate, winLen }, parts: { choice, used, tension, comeback } };
}

/** Difficulty bands, for settings that ask for one. */
export const BANDS = { any: [1, 10], easy: [1, 3], normal: [4, 6], hard: [7, 8], brutal: [9, 10] };

/** Plain words for a measure, for pages and the notebook. */
export function describeMeasure(m) {
  if (!m) return [];
  const lines = [`Difficulty ${m.difficulty} of 10: a novice wins ${Math.round(m.novice.winRate * 100)}% of the time${m.novice.winLen ? `, in ${m.novice.winLen.toFixed(1)} moves on average` : ''}.`];
  if (m.ceiling != null) lines.push(`Skill ceiling ${m.ceiling.toFixed(2)}: ${m.ceiling >= 0.8 ? 'high' : m.ceiling >= 0.35 ? 'middling' : 'low'} (an expert wins ${(1 + m.ceiling).toFixed(1)} times faster than a novice).`);
  lines.push(`Engagement ${m.engagement} of 100 (choices ${Math.round(m.parts.choice * 100)}, pieces used ${Math.round(m.parts.used * 100)}, tension ${Math.round(m.parts.tension * 100)}, comebacks ${Math.round(m.parts.comeback * 100)}). A first guess, to check against ratings.`);
  return lines;
}

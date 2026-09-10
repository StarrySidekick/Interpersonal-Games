// The place's growth — read off the record, never stored on its own.
//
// There is one shared place, and it isn't fed by one game. Whatever the two
// of you finish, together, moves it forward: engine/record.js already logs
// one entry per sitting regardless of which game it was, so that's the one
// number this counts. A practice sitting (see engine/ui.js practiceInfo())
// never reaches logSitting() at all, which is exactly right here too — the
// workbench must not grow the real place.
//
// Deliberately monotonic. docs/scope.md rule 2 is "things accrue; nothing
// decays" — a stage, once reached, can never be computed lower, because
// nothing below reads a clock or a gap. Reopening this after three weeks
// away must show the same place you left, or further on, never less.

import { load } from './record.js';

/**
 * Six stages, each a whole sitting apart in the sense that matters: what you
 * see is what the *count* says, not what game made it or when. `line` is
 * spoken as the place, not about it — no numbers, no "3/7 sittings", because
 * the place doesn't know it's being measured.
 */
export const STAGES = [
  { at: 0, key: 'found', line: "You found it. It hasn’t moved in a long time." },
  { at: 1, key: 'waking', line: "It’s warm now. Something is listening." },
  { at: 3, key: 'ground', line: 'The ground has stopped being only dirt.' },
  { at: 7, key: 'green', line: 'A first, real green.' },
  { at: 15, key: 'living', line: 'Something out there is alive at night, too.' },
  { at: 30, key: 'forest', line: 'This used to be a forest. It’s trying again.' }
];

/**
 * `record` defaults to the real one; a caller passes its own only to preview
 * a stage or to test this without touching localStorage.
 */
export function growthFor(record = load()) {
  const sittings = record.sittings.length;
  const games = new Set(record.sittings.map((s) => s.game));

  let stage = STAGES[0], stageIndex = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (sittings >= STAGES[i].at) { stage = STAGES[i]; stageIndex = i; }
  }
  const next = STAGES[stageIndex + 1] || null;

  return {
    sittings,
    distinctGames: games.size,
    // Both of you have finished *something*, at least once. Independent of
    // stage and, like everything else here, one-way: once true, forever true.
    bonded: games.size >= 2,
    stage: stage.key,
    stageIndex,
    line: stage.line,
    next: next ? { at: next.at, remaining: next.at - sittings } : null
  };
}

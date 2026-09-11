// The place.
//
// Turns the record (engine/record.js) into what the clearing looks like.
// Nothing here writes anything — it only reads what has already accrued,
// which is what makes rule 2 ("things accrue; nothing decays") automatic
// instead of something every caller has to remember. The numbers behind it
// only ever go up, because record.js never removes a sitting.
//
// Deliberately coarse. This is not the record's stats page (that's what
// blindAgreementStats/twentyTwentyStats are for) — it's one shape a garden
// can grow by, built from whatever any game logged, without this file
// needing to know a single game's schema. A new game's sittings count here
// automatically, the day it starts calling logSitting.

import { load } from './record.js';

const STAGES = [
  { min: 0, key: 'dormant',
    line: 'You found it here, asleep in the dark. Nothing has grown back yet.' },
  { min: 1, key: 'waking',
    line: 'The first light since you found this place.' },
  { min: 3, key: 'growing',
    line: 'The clearing is coming back, a little at a time.' },
  { min: 8, key: 'thriving',
    line: 'This has become a real garden.' },
  { min: 20, key: 'grown',
    line: 'The forest remembers you both.' }
];

/** How full the garden bed reads, capped so it never gets absurd or crowded
    enough to look like a stats bar wearing a leaf costume. */
const MAX_PLANTS = 12;

export function placeState() {
  const record = load();
  const sittings = record.sittings || [];
  const games = new Set(sittings.map((s) => s.game));

  let started = null, last = null, depth = 0;
  for (const s of sittings) {
    if (started === null || s.startedAt < started) started = s.startedAt;
    if (last === null || s.endedAt > last) last = s.endedAt;
    const d = s.data || {};
    // A rough "how much happened" count: rounds played, questions asked,
    // lies called — whatever a game's own record carries. Not meant to be
    // precise, only ever-increasing.
    depth += (d.rounds ? d.rounds.length : 0) + (d.asked || 0) + (d.calls || 0);
  }

  let stage = STAGES[0];
  for (const s of STAGES) if (sittings.length >= s.min) stage = s;

  return {
    sittings: sittings.length,
    games: games.size,
    depth,
    started,
    last,
    stage
  };
}

export function gardenCount(state) {
  return Math.max(0, Math.min(MAX_PLANTS, state.sittings));
}

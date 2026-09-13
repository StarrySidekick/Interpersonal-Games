// The place's growth — how far the clearing has come, derived from the record
// and nothing else. Pure and stateless: hand it a loaded record, get back a
// stage. No clock lives in here, no "days since anything" — rule 2 from
// docs/scope.md ("things accrue, nothing decays") applies to this file more
// than any other, so a growth score can only ever go up, never wilt, and
// never notice a gap.
//
// This is deliberately generic across games rather than keyed to Blind
// Agreement or Twenty-Twenty by name: INTENT.md's priority 3 is "long-term
// growth of elements" that everything eventually feeds, and a rule about a
// game's own name here would stop working the day a new one ships.

/**
 * How much one finished sitting is worth, beyond the point every sitting is
 * worth just by having happened. Recognises the shapes the two games already
 * log (`rounds`, an array; `asked`, a count) and falls back to nothing rather
 * than guessing at a shape it doesn't know — a sitting from a future game
 * still counts, it just counts for one.
 */
export function activityOf(sitting) {
  const d = (sitting && sitting.data) || {};
  if (Array.isArray(d.rounds)) return d.rounds.length;
  if (typeof d.asked === 'number') return d.asked;
  return 0;
}

/**
 * One base point per finished sitting, plus up to five more for how much
 * happened in it — capped, so one long night can't do the work ten short
 * ones would have. That cap is what keeps "a sitting" the unit that matters,
 * not "a round".
 */
export function growthPoints(record) {
  const sittings = (record && record.sittings) || [];
  return sittings.reduce((n, s) => n + 1 + Math.min(activityOf(s), 20) / 4, 0);
}

/**
 * The stages the clearing passes through. `at` is the growth-points
 * threshold that opens it. Add a stage here and the scene, the front page and
 * the stage line all pick it up on their own — nothing else needs to know the
 * thresholds exist.
 */
export const STAGES = [
  {
    key: 'dormant', at: 0, name: 'The clearing',
    line: 'An abandoned, forested place. Somewhere in it, something small and unlit.'
  },
  {
    key: 'waking', at: 1, name: 'Waking',
    line: 'It stirred the first time you played, and it has not gone back to sleep.'
  },
  {
    key: 'sprouting', at: 6, name: 'First sprouts',
    line: 'Something small has pushed up through last year’s leaves.'
  },
  {
    key: 'garden', at: 16, name: 'A garden',
    line: 'Enough has grown here now to call it that.'
  },
  {
    key: 'returning', at: 32, name: 'The forest, returning',
    line: 'Trees are coming back in at the edge of the clearing.'
  },
  {
    key: 'restored', at: 60, name: 'Restored',
    line: 'This was abandoned once. Nothing about it says so now.'
  }
];

export function stageFor(points) {
  let s = STAGES[0];
  for (const st of STAGES) if (points >= st.at) s = st;
  return s;
}

/** The next stage up, and how many points off it is. Null once you're past the last one. */
export function nextStage(points) {
  const cur = stageFor(points);
  const next = STAGES[STAGES.indexOf(cur) + 1];
  return next ? { stage: next, remaining: Math.max(0, next.at - points) } : null;
}

/**
 * A continuous 0..STAGES.length-1 reading of how grown-in the place is, for
 * anything drawing it (more trees in leaf, more underfoot) rather than
 * naming it. Interpolates between the current stage and the next one, so the
 * scene fills in gradually instead of jumping the moment a threshold is
 * crossed — growth, not an unlock.
 */
export function continuousLevel(state) {
  const { stage, stageIndex, upNext, points } = state;
  if (!upNext) return stageIndex;
  const span = upNext.stage.at - stage.at;
  const into = span > 0 ? (points - stage.at) / span : 1;
  return stageIndex + Math.max(0, Math.min(1, into));
}

/** Everything a scene or a page needs to describe the place right now. */
export function growthState(record) {
  const sittings = (record && record.sittings) || [];
  const points = growthPoints(record);
  const stage = stageFor(points);
  const upNext = nextStage(points);
  return {
    points,
    stage,
    stageIndex: STAGES.indexOf(stage),
    stageCount: STAGES.length,
    upNext,
    sittings: sittings.length,
    firstPlayedAt: sittings.length ? sittings[0].startedAt : null,
    lastPlayedAt: sittings.length ? sittings[sittings.length - 1].endedAt : null
  };
}

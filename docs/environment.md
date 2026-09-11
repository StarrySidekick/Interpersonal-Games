# The environment — what's built and what's still his call

**2026-09-11.** INTENT.md's #1 priority was "render the environment the games
take place in" — there was no place yet, and the place is now the point. This
is a first pass at that, plus a note on what was deliberately left open.

## What exists now

`index.html` opens on a scene (`.scene` in `engine/app.css`) instead of
straight into the games grid: a dark tree line, a clearing, the PET, and a
garden bed. `engine/place.js` turns the record (`engine/record.js`) into what
it looks like:

- **The PET is always there and always awake.** What changes is the *place*
  around it — the forest was abandoned, not the PET.
- **A stage** (`dormant → waking → growing → thriving → grown`), by total
  sittings across every game. Each stage has one line of caption text and
  widens the PET's glow a little. Thresholds are in `STAGES` in
  `engine/place.js` — 0 / 1 / 3 / 8 / 20 sittings.
- **The garden bed** grows one blade per sitting, capped at twelve
  (`gardenCount()`), positioned by a formula (not `Math.random()`) so the bed
  doesn't reshuffle on every visit — it only ever fills in further.
- **Nothing decays and nothing moves.** No animation, on purpose — see the
  "glanceable" rule in `docs/scope.md`, which is written for the game screens
  but reads as a whole-app rule and this doesn't need to be the exception. The
  only thing that changes between visits is how much has grown, never in
  motion while you're looking at it.
- **No art assets exist**, so this is SVG shapes and CSS gradients standing in
  for the real thing — the PET is an abstract blob with two ears and two eye
  states, the garden is tapered CSS blades, the trees are coloured bars. It's
  built to be replaced wholesale once there's real art, without the logic in
  `place.js` needing to change: swap what `#pet`, `#garden` and `.treeline`
  render, keep what decides *how much* to render.

## What's genuinely his to decide, not mine

This shipped as a real default rather than a set of options nobody chose,
because "there is no place yet" was blocking real priorities. But the actual
look of it — beyond "dark, restrained, matches the app's own palette" — is a
design call, not an engineering one, and this file is where to leave that
rather than deciding it by default forever:

- **Does the PET have a face beyond eyes, a name, a personality that shows?**
  Right now it's a glowing blob. *Mega Man Battle Network*'s NetNavis have a
  lot more character than that, and how much of that this PET should borrow
  is worth a real answer rather than an engineering guess.
- **Is the garden literally plants**, or is that too literal a read of
  "gardens grow" — could it be something else that accrues visually (a
  constellation, a row of lit windows in the treeline, stones on a path)?
- **Should different games grow different things** — Blind Agreement feeds
  the garden, Twenty-Twenty feeds something else the way each game might one
  day "pay out" in a different kind of growth per INTENT's #3 priority — or
  is one shared place actually the point, so it should stay one bed everyone
  contributes to regardless of which game?
- **The stage thresholds (1/3/8/20) are a guess** at what "the tenth night is
  different from the first" should feel like in numbers. They might be too
  fast, too slow, or too coarse at five stages.
- **Whether the caption should ever say more** — right now it's one
  atmospheric line. It could eventually reference *what* you've played
  ("since the night you called the lie about the octopus"), which is closer
  to what rule 5 ("the record is a first-class feature") is actually asking
  for, once there's enough play logged to make specific callbacks feel earned
  rather than random.

None of these block anything — the place renders and grows either way. They're
here so a future session (or Timothy directly, editing this file) can settle
them deliberately instead of the defaults quietly becoming permanent.

## Solo testing

The other #1-priority item, "a way to play and test solo," shipped alongside
this — see `practice.html` and the `?practice=1` handling in each game's
`game.js`. Not covered here because it's a testing tool, not part of the
place; see the top of `practice.html` and the comments in each `game.js` for
how it works.

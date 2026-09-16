# Scoping the environment

INTENT.md's top priority: **render the place the games take place in and are
fed by.** Nothing here is built yet — this is the scoping pass, so the next
session (or Timothy) can start building instead of re-deciding what "the
place" even is.

**This document decides nothing about how it looks.** That's Timothy's — see
`CLAUDE.md`'s note that naming and visual-design calls stay his. What follows
is the technical shape and the open questions, so a real answer to those
questions is the only thing standing between here and a first build.

## What already exists to build on

The record (`engine/record.js`) already holds everything a growing place
would read from, and needed no new schema to get there:

- `sittingsFor(game)` — every finished sitting, per game, with `startedAt`/
  `endedAt` and whatever the game chose to log.
- `blindAgreementStats()` / `twentyTwentyStats()` — the per-game numbers
  that mean something over months (average passes, lie-detection rate).
- Nothing decays and nothing is timestamped as "due" — the record is
  append-only by design (see `docs/scope.md`'s rule 2), which is exactly the
  property a garden that never wilts needs underneath it.

So the environment can be **a pure function of the record**: feed it
`load()`'s output, get back what the place looks like right now. It needs no
new engine, no new storage, and no change to either game to get a first
version running — it's presentation work, reading data that's already there.

## The open questions

**1. One place, or one per game?** The framing (`INTENT.md`) describes a
single forest that both games feed — "your gardens grow" (plural, but one
scene). Does Blind Agreement grow a different bed than Twenty-Twenty, or do
both games' numbers feed the same trees? This decides whether the renderer
takes the whole record or is called once per game.

**2. What maps to what?** Candidates, not a spec:
   - total sittings -> how much of the place is "awake" at all
   - total rounds/questions -> density (more trees, more plants)
   - Blind Agreement's average-passes-to-match -> some quality of the
     garden specifically (tended, coordinated)
   - Twenty-Twenty's lie-detection rate -> something about knowing the
     place, or each other, inside the fiction
   - time since the record began, vs. time since last played, matters here:
     the second one must **never** drive decay (rule 2). The first one is
     fair game — "how long you've had this place" is not a guilt mechanic.

**3. What is it made of, visually?** Options that all fit "no build step, no
dependencies, dark by default, one-handed, glanceable":
   - inline SVG, procedurally arranged from the numbers — cheapest, scales
     cleanly, easiest to keep in the no-asset-pipeline spirit of this repo
   - a small tile/sprite set Timothy draws — more the *Bureau* /
     *Composer's Key* approach of real authored art, costs an asset pipeline
     this repo doesn't have yet
   - CSS-only shapes (gradients, clip-paths, layered divs) — cheap, but
     reads flatter and ages worse than either of the above

**4. Where does it live?** A screen of its own (`place/` or similar,
linked from the front page the way `play/<game>/` is), or woven into
`index.html` itself so opening the app *is* opening the place? The former
keeps the front page as it is; the latter is closer to the pitch in
`README.md` ("You find a PET... wake it and it bonds") — the place might
be what you land on, not something you navigate to.

**5. Does the walkie-talkie live here too?** `INTENT.md` says "the
walkie-talkie is part of the fiction, not just the phone call you happen to
be on." If the environment is a screen, does it carry any of that framing
(a PET you address, a way the two games are introduced as things the PET
"remembers"), or is that a separate, later concern?

## A cheap way to find out which answers are right

Before committing to art direction: a **throwaway numeric sketch** — an inline
SVG that reads `load()` and draws, say, one shape per sitting logged, sized or
coloured by which game and how it went — would answer question 1 and 2
empirically (does looking at the two games' numbers together actually suggest
one place or two?) without spending any of the art budget. Cheap to build,
cheap to throw away, and it turns "what should this look like" into "here's
what the current handful of sittings actually looks like, does that suggest
anything."

## What this is not

Not a roadmap for *new* games, and not a reason to build one — see INTENT.md's
"deliberately not next." The environment is owed to the two games that already
exist before either gets company.

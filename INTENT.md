# Intent

What this is for, and what to build next. Recorded **2026-09-06** from Timothy's
own answers to a direct set of questions, so this is *stated* intent rather than
intent inferred from the code.

**Read this before choosing what to build.** Where it disagrees with the rest of
the docs about **direction**, this file is newer and wins. Where it disagrees
about **mechanics** — how the code works, what was decided deliberately, the
invariants — the other docs win, always.

When something here is done, or turns out to be wrong, **edit it**. A stale
intent file is worse than no intent file.

## The framing changed, and most of this repo predates it

**2026-09-06.** This is no longer a collection of games. It is a place, and the
games are what tends it.

> You find a **PET** — in the sense of *Mega Man Battle Network* — in an
> abandoned, forested area. You wake it up, and it forms a **soul bond with
> exactly one other person**. Through it, the two of you talk to each other like
> a walkie-talkie and play *It Takes Two* / Mario Party style minigames, and
> **playing grows your gardens and reawakens the abandoned place**.

Read the rest of the docs with that in mind. `README.md` and `docs/scope.md`
were written before it and are still right about the *session shape*, the rules
that make a two-person game work, and the no-server constraint. They are out of
date about what the thing is.

### What the reframing keeps

Everything in `docs/scope.md` under "The session shape" survives intact, and
some of it is now load-bearing rather than merely wise:

- **Rule 4 — "the tenth session isn't the first session again"** was already
  called the hard part. The garden and the reawakening *are* the answer to it.
- **Rule 2 — things accrue; nothing decays.** A garden that wilts when you have
  not called in three weeks is exactly the guilt mechanic this repo bans. A
  place you left is a place that waits.
- **Rule 5 — the record is a first-class feature.** The place is the record now.

### What the reframing changes

- **The games are not the product.** They are the reason to be in the place
  together, and what they pay out in is growth.
- **Strictly two people, bonded.** Closer to *It Takes Two* or *Split Fiction*
  than to a party game. It started as something for Timothy and his partner and
  is now aimed a little wider, but it never becomes a game for a group.
- **The walkie-talkie is part of the fiction**, not just the phone call you
  happen to be on.

## What is next, in priority order

**1. Render the environment the games take place in — a first slice landed
2026-09-10.** The front page now opens on the place itself: `engine/growth.js`
reads the record and turns the sittings you've finished (either game, summed —
the place doesn't belong to one game) into one of six stages, and
`engine/scene.js` draws it as a fixed, deterministic SVG clearing — the same
dead tree, the same ground, nothing rearranged between visits, only more of it
revealed as the count goes up. Zero sittings is a dim PET half-lit in fog next
to a bare tree; by thirty it's fireflies, a stream, flowers, and the same tree
leaved out. Playing *both* games at least once lights a footpath between two
lanterns at the board's edges — the bond, independent of stage, never undone.
Both files are pure and stage-indexed (no clock, no "haven't played in"), which
is what keeps this honest against rule 2.

This is a first slice, not the ceiling: six stages is a start, the picture is
flat SVG rather than anything a garden really grows *in* (individual plants
per game, a season, weather), and there's no dedicated `/place` page yet — it
only lives on the front door. That's the next real step here, not new stages
tacked onto this table.

**2. A way to play and test solo — done, 2026-09-08.** Both playable games'
setup screens now link to a `solo.html` that runs two synced panes (two roles
for Twenty-Twenty, two phones for Blind Agreement) in one page, driven by one
person, writing nothing to the real record. See "How two phones share a game
with no server" in the README. Any future game gets this for free by reading
`practiceInfo()` in `engine/ui.js` the same way rather than inventing its own
convention.

**3. Long-term growth of elements.** Very important, in his words. Weight
anything that accrues across months over anything that entertains once. The
six stages above are the first cut of this, not the finished thing — the table
in `engine/growth.js` is short on purpose, waiting for real play to say what
should come next rather than guessing thirty stages ahead of any data.

## Deliberately not next

- **New games.** He wants to think hard before each one, and there are fourteen
  on the shelf already with two playable. Depth, not breadth.

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

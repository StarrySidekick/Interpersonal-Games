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

**Build note, 2026-09-15 — not Timothy's words, just keeping this file from
going stale: 1 and 2 below have a first pass now. Read before assuming either
is still undone.**

- **The environment renders.** The front page now draws the clearing as an
  SVG scene — `engine/place.js` — and it is a genuine read of
  `engine/record.js`'s numbers, not a mockup: a sleeping PET and two dead
  branches at zero sittings, waking, shoots, a garden bed, canopy and
  fireflies as real sittings accrue, capped so it never gets cluttered.
  Growth only ever goes up, per rule 2. **What is still coarse**: only two
  games' data feeds it (a new game's sittings still count toward the
  clearing filling in, but not toward the finer "rounds and questions"
  number, until someone teaches `placeState()` its shape); the PET has no
  name and nothing to interact with directly yet; there's no view of the
  arc over time, only where it stands right now. Next real step here is
  probably **naming the PET** — that's Timothy's call, not a rendering one.
- **Solo testing works**, on both games, clearly marked "Practice" and
  never touching the record — see the "Practice solo" button on each
  game's setup screen, and the comments at `startSoloSitting()` in each
  `game.js` for why they're shaped differently (Blind Agreement's core
  loop is two independent choices, which one person can't fake, so it
  deals a real second, seeded, weighted-to-eventually-match choice;
  Twenty-Twenty already tracked only your own side, so practice mode
  mostly just removes the code-and-side ceremony and shows you the other
  side's card so a dealing bug can't hide).

**3. Long-term growth of elements.** Still the standing priority, and now has
somewhere to render into. Weight anything that accrues across months over
anything that entertains once.

## Build note, 2026-09-18 — a repo-maintenance session, not Timothy's words

This same brief (priorities 1 and 2 above) had already been built five
times over, independently, on five different unmerged branches going back
to 2026-09-08 — each one a fresh overnight session starting from a `main`
that had never absorbed the last attempt. What's committed here is the
newest and most complete of those five (`claude/brave-johnson-87ulcd`,
2026-09-15), carried forward onto this branch and independently
re-verified rather than rebuilt from scratch. **If you are a future session
reading this because the same hint sent you here again: check `main` and
the open branches first.** This is very likely already done, on a branch
somewhere, waiting for Timothy to review and merge it.

## Deliberately not next

- **New games.** He wants to think hard before each one, and there are fourteen
  on the shelf already with two playable. Depth, not breadth.

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

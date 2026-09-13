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

**1. Render the environment the games take place in.** This outranks new games.
There is no place yet, and the place is now the point.

**2. A way to play and test solo.** Timothy has not been able to properly
playtest, because playtesting currently requires getting Alyssa on the phone.
This unblocks him personally and it is worth building even though the finished
thing is strictly two-player.

**3. Long-term growth of elements.** Very important, in his words. Weight
anything that accrues across months over anything that entertains once.

## Deliberately not next

- **New games.** He wants to think hard before each one, and there are fourteen
  on the shelf already with two playable. Depth, not breadth.

## Status, from the code — 2026-09-13

**Priority 1 has a first real version, not a stub.** `engine/growth.js` turns
the record into a growth score and a named stage (dormant → waking → first
sprouts → a garden → the forest returning → restored) with no clock in it, so
a gap of any length reads exactly like no gap; `engine/scene.js` draws
whichever stage that is as an SVG clearing — the PET asleep or awake, trees
bare or in leaf, flowers and fireflies at the higher stages. The front page is
that scene now, not a list of games with a card of stats bolted on. It reads
only `engine/record.js`, so a future game feeds the same place just by logging
a sitting — nothing about it names Blind Agreement or Twenty-Twenty.

What it is not yet: there is **one** shared clearing, not the gardens
(plural) the framing above describes, and nothing in the scene is
interactive — it is a picture of where the two of you are, not a place you do
anything inside. Priority 1 still outranks new games until that gap closes
further. **Priority 2 (solo testing) is untouched and still fully open** —
this session built priority 1 because the order says to, not because 2 turned
out to be done.

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

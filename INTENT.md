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
There is no place yet, and the place is now the point. **Still open** —
`docs/environment.md` (2026-09-16) scopes it: what the record already gives a
renderer for free, and the open questions (one place or one per game, what
maps to what, what it's drawn out of) that are Timothy's to answer before
anyone builds it. Not started in code.

**2. A way to play and test solo.** Timothy has not been able to properly
playtest, because playtesting currently requires getting Alyssa on the phone.
This unblocks him personally and it is worth building even though the finished
thing is strictly two-player. **Done, 2026-09-16.** Both playable games have a
"testing alone" toggle on their setup screen: Blind Agreement simulates a
partner's pick so a full round resolves without a second phone; Twenty-Twenty
shows both secrets a room code deals and lets you play the left all the way
through, then the right, with the same deck. Neither writes to the record —
see the comment above each `logSitting` call — because a solo pass isn't a
sitting the two of you had.

**3. Long-term growth of elements.** Very important, in his words. Weight
anything that accrues across months over anything that entertains once. Still
open; `docs/environment.md` is where 1 and 3 meet, since the growth has
nowhere to be seen until the environment exists.

## Deliberately not next

- **New games.** He wants to think hard before each one, and there are fourteen
  on the shelf already with two playable. Depth, not breadth.

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

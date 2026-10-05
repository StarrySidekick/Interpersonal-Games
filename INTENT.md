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

## 2026-10-05: the front door is asynchronous, and it is a group

Recorded from Timothy's own description. **Where this section disagrees with
the 2026-09-06 section below, this one wins.** The working name for the place
is **Hikari Garden**.

### What he is reacting to

Daily share-a-score games (Wordle, Pinstinct, Krillian and others) are working
in his friends' group chats. The share text is the score, and the score is also
the link to play. What they lack: the only interaction is comparing numbers.
Nobody's reply *does* anything, and day 40 is the same as day 1.

### What changed

- **A website first, not an app.** The genre lives on links in a chat, and a
  browser handles that fine. The iPhone app is no longer the near-term target.
- **Asynchronous first.** The live, on-a-call games (Blind Agreement,
  Twenty-Twenty, the PET bond) are **tabled, not cut**. They stay in the repo
  and the two-person PET framing below still describes that track.
- **A group, not a pair.** This reverses "it never becomes a game for a group"
  for the async track only.
- **Replying pulls you in.** Answering someone's score should enter you into
  their game, so the people in a chat end up tending one shared thing instead
  of each solving the same puzzle alone.
- **Ease people into interacting.** Start as low-commitment as a Wordle share
  and ask for a little more interaction over time, never all at once.
- **Long-term progression belongs to the group.** Rule 4 ("the tenth session
  isn't the first") now applies to a chat of people, not a couple.

### What survives

Nothing decays, nags, or keeps a streak you can break. The forest is still the
setting. The record still matters, and it now has a group-shaped version.

### The first prototype

**Forest chess**: a small board, fantastical woodland pieces, played
asynchronously, scores shareable, and eventually games that overlap between
players. Design sketch in [`docs/grove-chess.md`](docs/grove-chess.md).

### Decisions still open, and they are his

1. **Server or no server.** A group world everyone sees the same way is much
   easier with a small backend. The no-server rule was justified by intimate
   two-person answers, which this track does not have. Leaning: links only for
   the prototype, revisit once the loop is proven.
2. **What a reply actually does** to the original poster's game.
3. **Puzzle or opponent.** Same daily position for everyone (Wordle-shaped) or
   real matches between players (correspondence-chess-shaped). Leaning: daily
   puzzle first, matches later.

## 2026-09-06: the framing changed, and most of this repo predates it

*Now the tabled live track. Still accurate for it.*

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

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

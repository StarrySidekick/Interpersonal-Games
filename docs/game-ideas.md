# Game ideas

Candidates, with the honest version of what each costs. Read
[scope.md](scope.md) first — the engines (A: shared seed, B: link-passing,
C: the record) and the session shape are defined there.

Every entry has a **long arc** line, because a game that's identical on the
tenth night doesn't survive the way these are meant to be played.

---

## Live games — Engine A

Both on a call, both on the same room code. The screen holds a secret or a
board; the call does the rest.

### The Dial ★
*You can see exactly where the target is. All you can do is describe it.*
**Sitting:** 10–20 min · **Round:** 90 sec · **Effort:** M

Both phones show the same spectrum — *overrated ↔ underrated*, *a snack ↔ a
meal*, *would call in sick for ↔ would go in for*. Your phone also shows a
narrow target band on that line. Theirs doesn't. You give one clue. They drag
the dial. Score by distance. Swap.

The screen is doing something a conversation can't: holding a precise hidden
value on a line you both see. Everything else — the clue, the argument about
whether a bagel is a snack or a meal — is the conversation, which is the
actual game.

**Long arc:** a running *calibration* number — how close you land, averaged
over every session ever. It goes up. It is the single most legible "we know
each other better than we did in March" number in this whole list. Plus
spectrum packs that open up as you play, and eventually spectrums built out
of your own past rounds.

Descended from *Wavelength* (Wolfgang Warsch / CMYK) — credit it on the
page, and write our own pairs. The good ones are about the two of you anyway.

### Talk Me Through It
*You have the map. They're the one in the building.*
**Sitting:** 15–25 min · **Effort:** M–L

One phone shows the layout and the hazards. The other shows only where they
are and which way they're facing. You talk them out. Co-op, no score, and it
falls apart hilariously the moment you say "left" and mean your left.

The purest version of *the call is the network* — the entire game is the
bandwidth between two people trying to be clear.

**Long arc:** the best structural fit for intermittent play in the list. A
campaign you chip at: two or three floors a sitting, ten minutes each,
picked up whenever. New mechanics introduced slowly (doors, then darkness,
then a second floor you can't both see).

Biggest build risk here — level design, a renderer, and a real difficulty
curve. Worth it, but not first.

### Impostor Word
*Five words each. One of yours is different. Find it by talking around it.*
**Sitting:** 10 min · **Round:** 3 min · **Effort:** S–M

You get the same five words except one, swapped for something a little off
(*ocean* / *sea*) or a lot. Take turns saying something true about your list
without naming anything on it. Then both guess which was swapped.

Cheap to build, endlessly replayable, and it reliably produces the specific
pleasure of realising you've been talking past each other for four minutes.

**Long arc:** difficulty that tracks you — the swaps get subtler the better
you get. Modest, but real.

### Blind Agreement
*Same question, both answer in secret, reveal on three.*
**Round:** 30 sec · **Effort:** S

Both phones show the same prompt and the same twelve options — *which of
these would we actually cook this week*, *which of these is the vacation*.
Pick without telling. Reveal together.

**Long arc:** this is the accrual game. The match rate is cumulative across
every session you've ever played, and the app remembers the specific ones
you missed. "We have never once agreed about breakfast" is a better output
than any score.

The quiet one that probably gets played most, because it's thirty seconds
long and slots into any gap in a call.

---

## Slow games — Engine B

A turn, a link, your thread. For the weeks you can't get on a call — which,
given how this is meant to be played, is most weeks.

### How Well Do You Know Me ★
*You answer. They guess what you answered. Two scores, and the gap is the
interesting part.*
**Turn:** 2 min · **Effort:** M

You answer a question about yourself, and predict their answer to the same
one. Send the link. They do the same, and opening it reveals both sides.
Score tracks two separate numbers — how well you know them, how well they
know you — which are rarely equal, and the difference is a conversation.

**Long arc:** the strongest in the collection. The question deck deepens as
you go, it re-asks old questions months later to show what changed, and the
"you were wrong about this" list is the best raw material for an actual
phone call that any of these produce.

### The Map ★
*Every session you play puts something on a map only the two of you have.*
**Effort:** M (as a layer over other games)

Not a game on its own — a place the others feed. Finish a sitting and you
name what happened; it becomes a location. A street named after the round
where neither of you could describe "sturdy." Over months it becomes a
readable object: the record made visible, in a form that isn't a stats page.

**Long arc:** it *is* the long arc. Build it as the front page of the record
and let every game write to it.

### Set and Solve
*One of you builds a small puzzle. The other has a few days to crack it.*
**Turn:** 5 min to set, 5 to solve · **Effort:** M

Asymmetric daily-puzzle shape, but *you* are the setter, not an algorithm.
Build a word ladder, a hidden rule, a five-clue thing. Send it. They solve
whenever. Then you swap.

**Long arc:** naturally intermittent, and the setter's skill grows visibly.
The archive of puzzles you built for each other is worth keeping.

### Exquisite Corpse
*One line each, and you only see the last one.*
**Effort:** S

The parlour game, in a link. Write a line, everything but your final
sentence is hidden, send it on. After twelve turns the whole thing unrolls.
Cheapest thing in the list that produces a keepable object.

**Long arc:** the archive of finished ones. Little else — and that's fine
for something this cheap.

### Draw This Back
*You draw. They title it. You draw the title.*
**Effort:** M

The drift is the joke. Watch payload size — a drawing likely has to move
through the record and the share sheet rather than a URL.

**Long arc:** the gallery, which is genuinely funny in bulk.

---

## Small things worth building early

Low risk, high ratio, and useful for shaking out the shell.

- **The Clock** — shot clock and category picker for fast word games. Audible
  tick, so the person not holding it can hear the pressure. (S)
- **The Keeper** — Twenty Questions where the app knows the object, so
  neither of you has to invent one while tired. Engine A, roles. (S)
- **The Challenger** — settles whether a word can still be built in Ghost,
  which is the argument that stalls that game every time. (S)
- **The Decks** — good prompts for the conversation games, never repeating
  to the same pair. The repo's own docs say the first prompt is the real
  barrier; this is that, solved. (S)

---

## The recommended path

**Phase 1, build one thing properly: The Dial.** It's the clearest
demonstration of why a screen belongs in a phone call, it's the one you'll
actually play the most, and its calibration score forces us to build the
record correctly on the first game rather than bolting it on later.

**Phase 2, add two:**

- **How Well Do You Know Me** — proves Engine B, and does the thing this
  whole collection is for.
- **Blind Agreement** — cheap, and it makes the record visibly accumulate
  from the very first sitting.

**Then The Map**, once there are three games feeding it something worth
drawing.

That's one live game, one async game, one thirty-second game, and the
record they all write to — nothing about the architecture left theoretical.

---

## Considered, and why not yet

- **A Codenames Duet-alike.** Excellent two-player game, but it's a product
  with an author and a box, and the good version is close enough to be a
  copy.
- **Anything realtime-twitchy.** You can't talk while reacting, and the
  talking is the point.
- **Trivia.** Someone wins, nobody's closer, and the internet is full of it.
- **Streaks, daily quotas, decay.** See rule 2 of the session shape — the app
  never gets to be a third party nagging one of you.
- **Anything needing accounts or a server.** Ruled out on privacy before
  it's ruled out on hosting.

# Game ideas

Candidates for the screen track, with the honest version of what each one
costs to build. Read [scope.md](scope.md) first — the engines (A: shared
seed, B: link-passing, C: ledger) are named there.

Every entry has a **fallback** line, because of the rule that keeps this
repo itself: if the phone dies, the game has to keep going.

---

## Phase 1 — referee tools

Not new games. Small screens that remove the one annoying part of a game
that already works. Cheap to build, impossible to get wrong, and they prove
out the site shell.

### The Challenger
*Ghost's dictionary, settled without an argument.*
**Engine:** none (static word list) · **Effort:** S

Type the string, it tells you whether a word can still be built and shows
the shortest one. Ends the "is that even a word" stall that kills Ghost's
back half. Only the challenged player looks — that's the whole design.

**Fallback:** you argue about it, which is how Ghost has always worked.

### The Clock
*A shot clock for Category Ping-Pong.*
**Engine:** none · **Effort:** S

Tap to pass, five seconds a turn, audible tick so the person not holding it
can hear the pressure. Also picks the category, which is the actual barrier
every time.

**Fallback:** count out loud. Worse, but fine.

### The Keeper
*Twenty Questions where neither of you has to think of the thing.*
**Engine:** A (seed + role) · **Effort:** S

Both open the same code. One phone shows the object, the other shows the
question count. Removes the worst part of Twenty Questions — being the one
who has to invent something interesting under pressure — and makes it
playable when you're both too tired to be clever.

**Fallback:** think of something yourself, like a person from history.

### The Decks
*Prompt decks for the games that live or die on their first prompt.*
**Engine:** C (remembers what you've used) · **Effort:** S

Would You Rather, The First Time I…, Two Truths and a Hope. Forty good
prompts each, never repeated to the same pair. The repo's own docs already
say the first prompt is the real barrier — this is that, solved.

**Fallback:** the prompts are printed on the game's own page.

---

## Phase 2 — live screen games (Engine A)

Both on a call, both on the same room code. The screen keeps a secret or
holds a board; the call does everything else.

### The Dial ★
*You know where the target is. All you can do is describe it.*
**Engine:** A · **Time:** 10–30 min · **Effort:** M

Both phones show the same spectrum — *overrated ↔ underrated*, *a snack ↔
a meal*, *would call in sick for ↔ would go in for*. Your phone also shows
a narrow target band on that line; theirs doesn't. You give one clue. They
drag the dial. Score by how close. Swap.

Why the screen earns it: the target has to be hidden and precise, and it has
to be the *same* line for both of you. Voice can't do that. Everything else
— the clue, the argument about whether "a bagel" is a snack or a meal, which
is the actual game — is pure conversation.

Descended from *Wavelength* (Wolfgang Warsch / CMYK). Credit it on the page,
and write our own spectrum pairs; the good ones are the ones about the two
of you anyway.

**Fallback:** "pick a number 1 to 10 and give me a clue." Genuinely playable.

### Talk Me Through It
*You have the map. They're the one in the building.*
**Engine:** A · **Time:** 10–20 min · **Effort:** M–L

One phone shows a small grid with the layout and the hazards. The other
shows only where they are and which way they're facing. You talk them out.
Co-op, no score, and it fails hilariously when you say "left" and mean your
left.

Why the screen earns it: it's the purest expression of *the call is the
network*. The entire game is the bandwidth between two people trying to be
clear.

Biggest build risk here — needs a level generator, a renderer, and a real
difficulty curve. Don't make it the first one.

**Fallback:** none, honestly. This is the one game that needs the screen.
Flag it as the exception rather than pretend otherwise.

### Impostor Word
*Five words each. One of yours is different. Find it by talking around it.*
**Engine:** A · **Time:** 5–15 min · **Effort:** S–M

You both get the same five words except one, which differs by a little
(*ocean* / *sea*) or a lot. You take turns saying something true about your
list without naming anything. Then you both guess which one was swapped.

Cheap to build, endlessly replayable, and it produces the specific pleasure
of realizing you've been talking past each other for four minutes.

**Fallback:** works with two written lists on paper.

### Blind Agreement
*Same question, both answer secretly, reveal on three.*
**Engine:** A + C · **Time:** 5 min a round, forever · **Effort:** S

Both phones show the same twelve options and the same prompt — *which of
these would we actually cook this week*, *which of these is the vacation*.
Pick without telling. Reveal together. Score is how often you match, and
the score is cumulative across every session you've ever played.

This is the quiet one that turns out to be the most-played, because it's
thirty seconds long and the number goes up over months.

**Fallback:** count to three and say it out loud.

---

## Phase 3 — slow games (Engine B)

Turn, link, thread, three days later. For the weeks you can't get on a call.

### How Well Do You Know Me ★
*You answer. They guess what you answered. Both scores go up.*
**Engine:** B + C · **Time:** 2 min a turn · **Effort:** M

You answer a question about yourself and predict their answer to the same
one. Send the link. They do the same, and opening theirs reveals both. Score
tracks two separate things: how well you know them, and how well they know
you — which are different numbers, and the gap is the interesting part.

This is the strongest "you end up closer" candidate in the whole list, and
it works entirely async.

**Fallback:** ask the question on the phone. That's just a conversation,
which is the point.

### Exquisite Corpse
*One line each, and you can only see the last one.*
**Engine:** B · **Effort:** S

The parlour game, in a link. Write a line, the page hides everything but
your last sentence, send it on. After twelve turns the whole thing unrolls.
Archive the finished ones — the archive is the reason to play.

**Fallback:** it's a folk game with paper. That's where it came from.

### Draw This Back
*You draw, they title it, you draw the title.*
**Engine:** B (or C + share sheet) · **Effort:** M

Canvas in, canvas out. The drift is the joke. Watch the URL size — a drawing
may need to go through the ledger and the share sheet rather than a link.

**Fallback:** send the drawing in the thread yourself.

### Photo Tennis, kept
*The game that's already in this repo, with the year-end print built.*
**Engine:** C · **Effort:** M

Don't rebuild the game — it works fine in a text thread. Build the archive:
drop the pair in, it lays out the year in order. The repo's own page already
says the annual print is the real reason to play.

**Fallback:** it *is* the fallback. The game never needed us.

---

## The layer over all of it (Engine C)

### The Season
Not a game. A running record — what you played, when, the streak, the
running Blind Agreement score, the Exquisite Corpse you finished in March.
Every twelve weeks it offers a recap page you can send.

This is the difference between a site you use twice and a thing that's part
of how two people talk. Build it early enough that games can write to it
from day one, and make export a prompt at the end of a good session, not a
setting nobody finds.

---

## The recommended first three

After Phase 1's four small tools:

1. **The Dial** — the demo. Shows immediately why a screen belongs in a
   phone call, and it's the one you'll play the most.
2. **Blind Agreement** — cheapest to build, and the first game to write to
   The Season, which proves the ledger.
3. **How Well Do You Know Me** — the async one, and the one that does the
   thing this collection is actually for.

That's one live game, one repeat-session hook, one slow game — one of each
engine, so nothing about the architecture stays theoretical.

---

## Considered, and why not yet

- **A Codenames Duet-alike.** Great two-player game, but it's a product with
  an author and a box, and the good version is close enough to be a copy.
- **Anything realtime-competitive** (racing, reflex). The call is the whole
  point, and you can't talk while twitching.
- **Trivia.** Somebody wins, nobody's closer, and the internet is full of it.
- **Anything needing accounts or a server.** Rules it out on privacy before
  it's ruled out on hosting.

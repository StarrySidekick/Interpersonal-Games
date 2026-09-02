# Game ideas

The working list. Read [scope.md](scope.md) first — the engines (A: shared
seed, B: link-passing, C: the record) and the session shape are there.

Names marked *(working)* are placeholders. Everything here is a direction,
not a spec.

---

## Correspondence
*You each have half the truth, and you don't use the same words for it.*
**Engine:** A · **Sitting:** 15–25 min · **Effort:** M–L

Co-op, asymmetric. You each see part of the same thing — a map, a floor, a
machine, a route — and have to reconstruct it together out loud.

The iteration that makes this its own game rather than a walkthrough: **your
legends disagree.** The same object is labelled differently on each of your
screens. Your map says *the well*; theirs says *the grey circle*. Neither
of you is wrong, neither of you knows you're describing the same thing, and
the game is the moment you work out that you are.

That takes the accidental best part of a talk-me-through-it game — "left,
your left, no *my* left" — and makes it the actual mechanic instead of a
bug. It's also why the name fits: you're not giving instructions, you're
translating between two private languages.

**Long arc:** the glossary. Once you've established that *the well* and *the
grey circle* are the same thing, the game keeps it, and later puzzles use
the words you settled on. Over months you accumulate a vocabulary that only
works for the two of you, which is a real thing that happens to people who
talk a lot and is unusually satisfying to see written down.

**Open:** what the shared object is. A map is the obvious answer and might
be the boring one — a recipe, a machine to repair, or a sequence of events
to put in order might all work better and are cheaper to build.

---

## The Shortlist *(working)*
*Five things. You both rank them. You're not trying to agree.*
**Engine:** A or B · **Round:** 3–5 min · **Effort:** S–M

Five things — five ways to spend a Saturday, five terrible superpowers, five
things in your kitchen. You each rank them 1–5, privately, then reveal side
by side.

You're not supposed to match. The divergence is the content. What makes it a
game rather than a survey is the second thing you do before revealing:
**you also predict their ranking.** Scoring is on the prediction, never on
agreement — so being different is free, and only being *surprised* costs
anything. That's the inversion that separates this from every "did you
match" game.

Then, optionally, the part that produces something: **negotiate a single
joint ranking** and the app keeps it. Your official list. Revisitable later.

**Long arc:** the shelf of joint rankings you've settled, and the app
re-serving an old set a year later to see if you'd still defend it.

**Open:** whether the negotiation step is core or a bonus round. It's the
part most likely to produce a real conversation and the part most likely to
be skipped when you're tired.

---

## Blind Agreement
*Same twelve options. You have to land on the same one.*
**Engine:** A · **Round:** 30–90 sec · **Effort:** S

Pure coordination — you both have to pick the *same* thing, with no
agreement beforehand about which. Not "how similar are we," but "can we find
the same idea from the inside."

The mechanic that gives it a shape: **you keep going until you match.** Miss
on the first pass, and both of your picks are removed from the board; go
again with what's left. Score is how many passes it took. A round that ends
in two is a small triumph. A round that grinds down to the last two options
is funnier.

The tension is that you're on the phone the whole time and technically
allowed to say anything. How much you hint is a thing you negotiate
yourselves, and different pairs settle it differently.

**Long arc:** average passes-to-match, over months. One number, goes down
slowly, means something.

**Open:** a wordless variant with no board — you each say a word, then each
try to say the word that sits between your two, repeating until you both say
the same word. Same game, no UI at all. Might be the better version.

---

## Dead Drop *(working)*
*You build the lock. They have to pick it. The message inside is real.*
**Engine:** B · **Effort:** M

You write a short message to them, then encode it — the app gives you a
small kit of transformations to stack (a substitution, a keyword shift, a
grid, a key drawn from something only the two of you would know). Send the
ciphertext. They crack it whenever they get to it.

Two design problems, and the answers are what make this work:

1. **You shouldn't need to know cryptography.** You compose the lock from
   pieces; the app guarantees it's solvable and shows you an honest
   difficulty read before you send.
2. **Griefing has to cost you.** They get a hint budget, and *your* score
   depends on how many hints they spent. Uncrackable scores nothing.
   Trivially easy scores nothing. You're aiming at a sweet spot, which makes
   setting the puzzle the interesting half of the game.

The part that makes it belong in this repo rather than a puzzle app: **the
payload is a real message.** A memory, a question, something you wouldn't
say plainly. The reward for cracking it is that.

**Long arc:** personal keys. Once you've both used a key drawn from
something shared — a date, a phrase, a place — it stays available, and later
drops can lean on it. The cipher gets more private the longer you play.

---

## Telepaint
*You draw. They title it. You draw the title.*
**Engine:** B (or C plus the share sheet) · **Effort:** M

The drift is the joke, and it's the cheapest thing on this list that leaves
behind an object worth keeping.

**Long arc:** the gallery, which is genuinely funny in bulk. Possible: the
app re-serves one of your old drawings months later for a fresh title.

**Watch:** payload size. A drawing probably can't ride in a URL — likely
goes through the record and the system share sheet instead.

---

## Commons *(working)*
*Tiles, one shared landscape, and neither of you can see the other's hand.*
**Engine:** A live, B async · **Sitting:** 15–25 min · **Effort:** L

A small collaborative tile-layer. You alternate placing tiles onto one
shared board; the score is joint; completing things together is the point.

The adaptation that makes it a game for two people on a phone rather than a
solitaire with extra steps: **hidden hands.** You each hold a few tiles the
other can't see, so planning two moves ahead requires describing what you're
holding, and getting it wrong is the failure mode. The board is shared and
visible; the future is only in the conversation.

Board stays small and bounded so it reads on a phone.

**Long arc:** a region that persists across sittings. You're not finishing a
game in one night, you're adding to one place over months, and it's a
picture of how long you've been playing. (This is board state, not a
scrapbook — different thing from what got cut.)

In the tile-laying tradition of *Carcassonne* (Klaus-Jürgen Wrede) — an
original design in that family, credited, not a port.

**Note:** the most expensive thing on the list. Tile art, placement rules,
scoring, and an async path. Worth it, but not first.

---

## Twenty-Twenty *(working)*
*You're both guessing. And one of you is allowed to lie.*
**Engine:** A · **Sitting:** 10–15 min · **Effort:** M

The two things that stop this being twenty questions:

1. **It's simultaneous.** You each hold a secret and you're each trying to
   guess theirs. You alternate — one question each — so every turn you're
   choosing between learning more and spending your turn on a guess. A wrong
   guess hands them a free question. That's a real decision, every turn.
2. **You each get one lie.** Exactly one, any time, and it doesn't have to
   be used. So the guesser isn't just narrowing a category — they're reading
   a person they know well, wondering whether that hesitation was thinking
   or lying. Calling a lie correctly wins you back the turn; calling it
   wrong costs you one.

That second rule turns a deduction game into a game about knowing somebody's
tells over a phone line, which is the version worth building.

**Long arc:** your lie-detection rate against theirs. Two numbers, and
whichever is higher is insufferable in a way that's good for a relationship.

---

## Still open: the meta space

There will be a layer that records progress and shows it back. What it looks
like isn't decided, and nothing above depends on a particular form of it.

The one thing to settle early is the *shape of what games write to it*, so
every game can log from its first commit and the presentation can be figured
out later:

- a sitting happened, when, which game, how long
- a per-game number or two that means something over months
- artifacts — a drawing, a joint ranking, a cracked drop, a glossary entry

Constraint from [scope.md](scope.md#the-session-shape) that holds regardless
of form: things accrue, nothing decays, no streaks, no nagging.

---

## Also open

- **The Dial** hasn't gone away, but it stays cut until it's not Wavelength.
  The most promising iteration: **you can't give a word as your clue — the
  only clue you can give is another thing, placed on the same line.** "It's
  a little further along than a bagel." That makes it a game about shared
  reference points rather than adjectives, which is a different game. A
  second axis is the other option, and the weaker one. Possibly The
  Shortlist covers this territory well enough that The Dial isn't needed.
- **Async coverage is thin.** Only Dead Drop and Telepaint work when you
  can't get on a call, and given how this is meant to be played, that may
  need to be more than two.

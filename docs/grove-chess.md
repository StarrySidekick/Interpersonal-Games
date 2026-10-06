# Grove Chess

The first asynchronous game for Hikari Garden. Playable at
[`play/grove-chess/`](../play/grove-chess/). Direction is in
[`../INTENT.md`](../INTENT.md), 2026-10-05.

## The game

One board a day, the same for everyone. A 5x5 or 6x6 board in light green and
cream, three or four of your pieces, and one rabbit. **Catch the rabbit** by
moving a piece onto its square.

- **You move, then the rabbit hops.** It follows a pattern that repeats (for
  example *up, up, right*). The pattern is hidden; its tracks are numbered on
  the board so you can work it out.
- **It bounces.** A hop that would leave the board flips the pattern on that
  axis from then on, the way a ball stays turned around after it hits a wall.
- **It eats.** If a hop lands on one of your pieces, the piece is gone. Lose
  them all and the rabbit wins.
- **It waits** if a stump or bramble is in the way.
- **Waiting is allowed** and costs a move.
- **Fifteen moves** before dusk, then it gets away.
- **After the game** the pattern is drawn out: one full run, numbered, then
  the start of the next run in faint lines.
- **Par** is set by a solver that already knows the pattern, so par is hard on
  purpose. Moving two pieces together can sometimes beat it.

### Day variables

- **Board size:** 5x5 or 6x6.
- **Bramble** (about half of days): starts as one square and creeps one more
  every two moves, along a path fixed for the day. Nothing enters it and
  nothing slides through it. A rabbit that ends up inside is safe until it
  hops out. The next square it will take is drawn faintly, so it is never a
  surprise.
- **Stumps** (some days): block sliders; leapers jump them.

### The pieces

Every hand is **one fairy chess piece** plus classic pieces. Fairy pieces are
pieces invented for chess variants and problems, some of them centuries old;
one strange piece a day is enough to learn. The fairy piece rotates: each
block of twelve days shows all twelve once, in a shuffled order. At most one
strong piece per hand.

| Piece | Moves | Notes |
|---|---|---|
| Grasshopper | along any line, hopping the first thing in its way, landing just past it | T. R. Dawson, 1912 |
| Nightrider | repeats a knight's jump in a straight line | T. R. Dawson, 1925 |
| Camel | leaps (3, 1) | Tamerlane chess |
| Zebra | leaps (3, 2) | |
| Alfil | leaps exactly two diagonally | shatranj's elephant, ancestor of the bishop |
| Ferz | one step diagonally | shatranj's counsellor, ancestor of the queen |
| Wazir | one step orthogonally | |
| Cannon | slides like a rook; catches only by jumping exactly one thing | xiangqi |
| Mao | a knight that can be blocked on its first straight step | xiangqi's horse |
| Squirrel | leaps to any square exactly two away | |
| Rose | knight jumps that curve around a circle | |
| Archbishop | bishop plus knight | Capablanca chess |

Each has a low-poly model and a short description in the in-game pieces menu,
with a small diagram of where it can move.

### The opening

`intro.js`. A fresh game opens with the board falling from above the screen,
slamming down and shaking; then a card for each kind of piece you hold (the
model turning, what it does, and a little board where the squares it can
reach light up one by one before it makes a move, taking something where that
is how the piece works); then a card for the goal; then your pieces drop onto
their squares and play starts. Tap a card to move on; Skip ends it at any
point. It does not play when you carry on a game, practise, or restart a lab
level, and phones set to reduce motion skip it.

## The social layer: the vine

No server. The group chat is the database.

- Your share link carries your whole game in the URL fragment (everything after
  the `#`), which browsers never send to a server. Every phone deals the same
  board for a date, so a list of moves replays anyone's game exactly.
- Playing from someone's link puts you on their **branch**. Your link carries
  their game and yours, so replies grow down the chat like a vine.
- Each browser keeps every game it has been shown for a day and only ever adds
  to that list (a *grow-only set*), so two links merge by putting them together.
- **Before you play**, a link shows only names and scores: no spoilers.
  **After you finish**, every game on your vine can be watched move by move or
  overlaid on the board all at once, in its own colour.
- Every game in a link is replayed and checked for legal moves before it is
  shown, so a hand-edited link cannot fake a score.

Known limits: you only see games whose links reached your phone, so two people
in one chat can have different vines. Two people answering the same post fork
the vine. Both are fine for a prototype.

## How it is built

No build step, no libraries, same as the rest of the repo.

| File | What it does |
|---|---|
| `play/grove-chess/rules.js` | the rules for any level: a board (any size, holes allowed), your pieces, theirs. No page code, so the solver, replays, the AI and the tests all use the same rules |
| `play/grove-chess/ai.js` | the brain for their pieces in the lab (below) |
| `play/grove-chess/day.js` | deals the day's board from the date, and the solver that sets par |
| `play/grove-chess/vine.js` | link format, replay-checking, what the browser remembers |
| `play/grove-chess/board.js` | drawing the board, animating moves, turning taps into squares; shared by both pages |
| `play/grove-chess/sheet.js` | the pieces menu; shared by both pages |
| `play/grove-chess/models.js` | the models, built from simple shapes, with a plum-and-berry version for their side |
| `play/grove-chess/game.js` | the daily page: title, play, the vine, test mode |
| `play/grove-chess/lab.js`, `lab/` | the lab: settings, level generator, notebook, and its page |
| `play/grove-chess/check-daily.mjs` | the guard that proves the daily boards have not changed |
| `engine/lowpoly.js` | a small software rasterizer: low-poly models, smooth (Gouraud) shading, drawn at low resolution so they come out pixelated, N64 style |

**Testing.** Add `?test` to the address for a panel on the title screen:
previous, next, random or any date, clear your game on a board to replay it
for real, and spoilers for the board.

**Dealing a board.** The date seeds the shared random generator
(`engine/seed.js`). The hand is dealt first and then given up to 80 layouts;
each layout is solved, and anything with par outside 4 to 7 is thrown away.
Every phone throws away the same layouts in the same order, so they all land on
the same board.

**Do not casually change the dealer.** Any change to dealing, the solver, the
patterns, the piece list or the rules re-deals every board, past days
included, and old links then replay on the wrong board. Once real people are
sharing links, change it behind a version.

**The guard.** `node play/grove-chess/check-daily.mjs` deals 150 boards, plays
600 seeded random games on them and compares a fingerprint (a SHA-256 hash)
against the one recorded before the lab refactor. Run it after touching
anything under `play/grove-chess/`. It passing is how we know the lab's
rewrite of the rules engine left the daily game exactly as it was.

**The solver.** It searches every combination of moves for three moves, which
gives an exact par for short puzzles. Past that the search grows about twenty
times per move, too much for a phone, so it searches each piece alone with the
others standing still. That line is always playable, so par is never
impossible; cleverer two-piece lines are birdies.

## The lab

`play/grove-chess/lab/`. For finding out what is fun. Every setting the
engine supports, on one page; tap Play to try it, rate it 1 to 5 with a note,
and it goes in a notebook you can copy out.

- **Board:** width and height (3 to 10), shape (rectangle, diamond, round,
  cross, ring, hourglass, L, stairs, two islands, Swiss cheese), extra holes,
  stumps, bramble with its growth rate and size.
- **Your side:** how many pieces, which kinds they are dealt from, repeats,
  how far up they start, a royal King (lose it, lose), waiting on or off.
- **Their side:** how many, which kinds (rabbit or any chess or fairy piece),
  or a mirror of your hand like chess. Rabbits move by a hidden pattern (the
  daily set, or random ones up to big jumps, 1 to 3 hops a turn) or think.
  Everything else of theirs thinks.
- **The AI:** skill (random, greedy, two or three moves ahead) and mood
  (flee, balanced, hunt). See the comment at the top of `ai.js` for how it
  works: minimax search with alpha-beta pruning, to a fixed budget of
  positions so the same position gets the same move on every phone.
- **Winning:** capture them all, take their King (it makes sure they have
  exactly one), catch the rabbit (it makes sure there is one), catch any one,
  a marked one, or mix it up (a different goal per layout); a move limit or
  none; who moves first.
- **Only deal winnable levels** (on by default): the solver plays each new
  layout before you see it and keeps the first one it can win in between a
  minimum and a maximum number of moves (3 and 10 by default). That number is
  the level's par. After a game, "Watch the solver's win" replays its line.
- **Sink the ball:** your first piece becomes a ball that rolls up, down,
  left or right until something stops it (your other pieces make good
  walls). A hole moves by its own hidden pattern each turn, like a rabbit,
  and you win by getting the ball into it. It drops in when it rolls over
  the hole, or, with "Ball must stop on the hole", only when it comes to rest
  there. Their side can be empty for these.
- **Go crazy** rolls every setting at once, goal included. "What Go crazy may
  use" switches individual fairy pieces (and the rabbit) on or off for it;
  classic pieces are always in.

### The solver

`solve.js`. Their side is deterministic (a pattern always hops the same way;
the AI always answers the same position the same way), so from your side a
level is a puzzle where each move leads to exactly one next position. The
solver searches your moves alone:

1. **Exhaustive while it is small.** Every move, every reply, positions
   already seen merged. A win found here is the shortest possible, and the lab
   says so.
2. **Beam search after that.** At each move it keeps only the most promising
   positions (closest to catching what has to be caught), which finishes fast
   but can miss the very best line. Par then means "the solver found a win
   this short", and beating it is a birdie.

It works to a budget and a deadline, and `lab-worker.js` runs it on a
background thread so the page stays smooth. Every line it reports is a real
win: a fuzz test replays each one through the rules and checks it ends in a
win on exactly par.

A level is its settings plus a seed (the dice roll that places everything), so
a level link rebuilds exactly the same level anywhere.

## Open

- **What a reply does to the poster's game**, beyond joining their vine. The
  question from INTENT, still unanswered.
- **Overlap**: a relay (tomorrow's board starts where the group left the
  bramble), a shared board everyone places one piece on, or challenges (your
  line becomes a puzzle a friend has to beat). These need everyone to agree on
  one state, which is probably where a small server stops being optional.
- **Long-term progression for a group.** Nothing accrues across days yet
  beyond each phone's own record.
- **The share text.** Plain words and a link for now. Wordle's grid is the bar.
- **Difficulty tuning.** Par 4 to 7 with a hidden pattern has not been played
  by anyone yet.

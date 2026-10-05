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
| `play/grove-chess/rules.js` | pieces, the rabbit, bramble, moves. No page code, so the solver and replays use the same rules |
| `play/grove-chess/day.js` | deals the day's board from the date, and the solver that sets par |
| `play/grove-chess/vine.js` | link format, replay-checking, what the browser remembers |
| `play/grove-chess/models.js` | the models, built from simple shapes |
| `play/grove-chess/game.js` | the page: title, board, menus, the vine |
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
patterns or the piece list re-deals every board, past days included, and old
links then replay on the wrong board. Once real people are sharing links,
change it behind a version.

**The solver.** It searches every combination of moves for three moves, which
gives an exact par for short puzzles. Past that the search grows about twenty
times per move, too much for a phone, so it searches each piece alone with the
others standing still. That line is always playable, so par is never
impossible; cleverer two-piece lines are birdies.

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

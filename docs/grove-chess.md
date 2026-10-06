# Grove Chess

The first asynchronous game for Hikari Garden. Playable at
[`play/grove-chess/`](../play/grove-chess/). Direction is in
[`../INTENT.md`](../INTENT.md), 2026-10-05.

Three ways to play, linked from each other's pages and sharing one engine:
**the daily** (below), **the descent** (a roguelike run of levels, see "The
descent") and **the lab** (build any level, see "The lab"). The daily keeps
its own design goals (one board a day, the same for everyone) but takes the
lab's developments through new dealer versions. Balancing is in
[`grove-balance.md`](grove-balance.md); the look and tone in
[`grove-look.md`](grove-look.md).

## The game

One board a day, the same for everyone. A 5x5 or 6x6 board in light green and
cream, three or four of your pieces, and one rabbit. **Catch the rabbit** by
moving a piece onto its square.

- **You move, then the rabbit hops.** It follows a pattern that repeats (for
  example *up, up, right*). The pattern is hidden; its tracks are numbered on
  the board so you can work it out.
- **It bounces.** A hop that would leave the board flips the pattern on that
  axis from then on, the way a ball stays turned around after it hits a wall.
- **It does not eat** (from 2026-10-07, version 3). If a hop would land on
  one of your pieces, it waits instead, so your pieces can block it. On the
  first two boards it ate whatever it landed on; lose them all and the
  rabbit won.
- **It waits** if it cannot land where it is hopping: a crumbled or fallen
  square, say.
- **Its colour is its pattern.** Each of the twelve patterns has its own fur
  (`rabbits.js`). A rabbit is white until you have caught one of its kind;
  from then on that kind wears its colour, so you can know it on sight.
  Catches are kept in the browser, only ever added to, for the garden to
  come, and the end screen shows the rabbits you have caught.
- **Waiting is allowed** and costs a move.
- **Fifteen moves** before dusk, then it gets away.
- **After the game** the pattern is drawn out: one full run, numbered, then
  the start of the next run in faint lines. Just after a game ends it draws
  itself hop by hop, playing the rabbit's tune (below), once it is on
  screen.
- **Par** is set by a solver that already knows the pattern, so par is hard on
  purpose. Moving two pieces together can sometimes beat it.

### Day variables

- **Board size:** 5x5 or 6x6.
- **The ground** (version 3): solid on about 45% of days, crumbling 20%,
  shrinking 20%, shrinking in a spiral 15%. Each looks different: green and
  cream, dry cracked earth, or pale mist.
- **Shrinking ground**: every two moves a square on the board's edge drops
  into the dark for good, and the rim closes in around what is left. It
  never takes a square anything stands on, never cuts the board in two, and
  stops at half the board. Which square goes follows an order fixed for the
  board (shuffled, or a spiral clockwise from the top-left corner inward),
  and the next one is shadowed. This is the "decaying board" Timothy meant.
- **Crumbling ground** (about a third of days in version 2): every square
  you move a piece off falls away behind it, and nothing can stand there
  again. Sliders stop at a gap, leapers can still jump it, the rabbit waits
  rather than hop into one. Selecting a piece puts cracks on the square it
  would leave. Waiting crumbles nothing. What is left is nothing but
  darkness. Chosen over "decaying", which reads like the house rule that
  nothing in the game decays over time.
- **Stumps and bramble** are out for now (2026-10-06). Only the first two
  boards, 2026-10-05 and 06, have them, kept so links to those days still
  replay. The bramble started as one square and crept one more every two
  moves; stumps blocked sliders. The rules and drawing for both are still in
  the code.

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
point. A crumbling board adds a card of its own before the goal: a rook slides
across, the square it left falls away, and its slide back stops at the gap.
It does not play when you carry on a game, practise, or restart a lab level,
and phones set to reduce motion skip it.

### The catch

A catch that wins is a moment of its own (`board.js`, `celebrate`): the
board holds for a beat while the square flashes, the rabbit pops up,
tumbles and shrinks away, and leaves burst. Then the result pops in with the
golf word as a badge coloured for how good it was, your chase draws itself
back onto the board a move at a time, and the pattern plays. A catch that
does not end the game (lab levels with several foes) keeps the small poof.
The opening's demo boards turn the celebration off.

### Sound

Made in the browser as it plays (`engine/sound.js`: oscillators and filtered
noise from the Web Audio API, no audio files). The game's sounds are in
`sounds.js`: a wooden knock when a piece sets down, a crumble, a munch when
the rabbit eats, a pop and a sparkle for a catch, a slam and rising knocks
in the opening, an owl at dusk.

- **The rabbit's hops are notes.** Each direction has its own pitch on a
  pentatonic scale (five notes, no two a semitone apart, so nothing clashes),
  so a pattern that repeats is a tune that repeats, and you can hear it as
  well as see the tracks. A bounce flips the pattern and turns the tune
  upside down.
- **A win plays a fanfare** one note longer, ending one step higher, for
  each step better than bogey, with a trill on top for an eagle. You hear how
  well you did before you read it.
- **On by default**, with a speaker button beside the theme button. The
  choice is kept in the browser. An iPhone's silent switch mutes it.

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
| `play/grove-chess/rabbits.js` | the fur colour for each pattern, the patterns with pauses, and the rabbits you have caught |
| `play/grove-chess/board3d.js` | the 3D board: drawing, taps, possession and the collapse; `?flat` for the old one |
| `play/grove-chess/sounds.js` | the game's sounds, built on `engine/sound.js` |
| `play/grove-chess/descent.js`, `descent/` | the descent: what each depth is made of, the record, and its page |
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
(`engine/seed.js`). The hand is dealt first and then given a run of layouts;
each layout is solved, and anything with par outside 4 to 7 is thrown away.
Every phone throws away the same layouts in the same order, so they all land on
the same board.

**The dealer is versioned.** Any change to dealing, the solver, the patterns,
the piece list or the rules would re-deal every board, past days included,
and old links would then replay on the wrong board. So each version deals
from a cutover date onward and never changes once shipped (`VERSIONS` in
`day.js`):

| Version | Deals | What it does |
|---|---|---|
| 1 | 2026-10-05 and 06 | stumps and bramble on some days; up to 30 hands of 80 layouts |
| 2 | (none) | no stumps or bramble; a third of days crumble; up to 20 hands of 60 layouts, with a bounded par search. Superseded by version 3 before it dealt a day |
| 3 | from 2026-10-07 | rabbits do not eat; the day's ground (solid, crumbling, shrinking, spiral); boards with par 4 to 7 must pass the balance rules (`grove-balance.md`), checking at most 12 per day, counted, not timed, so every phone lands on the same board |

To change the daily game: add a version with a cutover date after today,
leave the old ones alone, and add its fingerprint to the guard. Version 3
runs the lab's solver (`solve.js`) for its balance check, so a change to
that solver can re-deal version 3 too; the guard will say so, and the fix is
to freeze a copy of the old solver for version 3.

Dealing time for version 3, on a laptop: median 0.14 s, 9 days in 10 under
0.4 s, worst 0.8 s over 40 days. Shrinking boards were the slow ones until
the falling edge was made cheap to compute (`shrinkStep` in `rules.js`).

**The guard.** `node play/grove-chess/check-daily.mjs` deals 150 boards with
each version, plays 600 seeded random games on them, and compares each
version's fingerprint (a SHA-256 hash) with the one recorded when it shipped.
Run it after touching anything under `play/grove-chess/`. Version 1's
fingerprint is the one recorded before the lab refactor, so it passing proves
the first two boards, and every link to them, are exactly as they were.

**The solver.** It searches every combination of moves for three moves, which
gives an exact par for short puzzles. Past that the search grows about twenty
times per move, too much for a phone, so it searches each piece alone with the
others standing still. That line is always playable, so par is never
impossible; cleverer two-piece lines are birdies. Version 2 adds two limits.
On crumbling ground no two lines leave the same squares behind, so positions
never repeat, the search cannot merge them, and it grows without end (one
board took 22 seconds). So it stops at 7 moves and keeps at most 3,000
positions per move. A cut search can miss the best line but never invents
one, so par stays a real win. Version 2 deals a board in about 70 ms on a
laptop, 340 ms at worst.

**Difficulty without obstacles.** With nothing in the way, a random layout
almost never needs more than three moves for a solver that knows the
pattern: for most hands 0 to 5% of layouts pass the par 4 to 7 filter, and
for the strongest fairy pieces (squirrel, archbishop, nightrider, rose) none
do. Measured over 150 version 2 boards: par 3 on 35%, par 4 on 61%, par 5 or
6 on 4%. Version 1, with stumps and bramble, was par 3 on 12%. Whether par 3
is too easy is for playing to decide.

## The lab

`play/grove-chess/lab/`. For finding out what is fun. Every setting the
engine supports, on one page; tap Play to try it, rate it 1 to 5 with a note,
and it goes in a notebook you can copy out.

Since 2026-10-06 the default is **the standard board**, Timothy's framing:
a ground, a shape and a size, a hole, and three pieces possessed by one
kind of rabbit; catch them, then sink the ball. Settings carry a version
(now 4, with the putting ball; 3 brought possession; 2 the standard board;
links without one are older). Each is read against its own version's
defaults, so every old link and notebook entry still builds exactly the
level it was, ice ball and all; a test checks 400 levels from versions 1
and 2 and 300 from version 3.

**Is there a fairy piece that moves like the ball?** Timothy asked, to try
it in the ball's place. Not exactly: the ball must roll as far as it can
and never captures. The nearest real thing is a rook under the
"maximummer" condition from chess problems (a side must always make its
geometrically longest move), but that rook still captures. Real riders
(rook, bishop, nightrider) can all stop anywhere along their line.

**The ball got stuck** (Timothy, 2026-10-06). On ice the only places to
stop are against something, so walls and corners trap it. The ball now has
three ways to move (`ballMove`), measured on 40 descent levels (depths 1 to
5) over about 6,400 positions each, in random games:

| The ball moves | Cannot move | Cannot reach the hole by itself | Squares it can reach |
|---|---|---|---|
| On ice (the first ball; still the daily's) | 8% | 36% | 4.7 |
| Like a putt: a rook that never takes | 6% | 14% | 9.9 |
| Like a billiard ball: the reflecting bishop of Billiards Chess (Jacques Berthoumeau, 1950s), bouncing off the edges | 13% | 50% | 5.7 |

The billiard ball is the real fairy piece, and the most thematic, but like
any bishop it keeps to its colour, so half the time the hole is on squares
it can never reach. The putt cuts being stranded by more than half, so it
is the ball in the descent and the lab's default. The other two stay in
the lab to try. "Cannot reach the hole by itself" means with everything
else frozen; other pieces moving, and the hole moving, free it again.

- **Board:** width and height (3 to 10), shape (rectangle, diamond, round,
  cross, ring, hourglass, L, stairs, two islands, Swiss cheese), extra holes,
  and the ground: solid, crumbling, shrinking, or shrinking in a spiral, with
  how often the edge falls. (Stumps and bramble were here until 2026-10-06; a
  saved level that had them loads without them, everything else in place.)
- **Your side:** how many pieces, which kinds they are dealt from, repeats,
  how far up they start, a royal King (lose it, lose), waiting on or off.
- **Rabbits:** how many (0 to 4), whether they move by a hidden pattern (the
  daily set, or random ones up to big jumps, 1 to 3 hops a turn) or think,
  tracks on or off, and whether they eat your pieces (off by default).
- **Dark pieces:** how many, which kinds (any chess or fairy piece, in dark
  plum wood), or a mirror of your hand like chess. They think, and they can
  take your pieces (a switch).
- **The AI:** skill (random, greedy, two or three moves ahead) and mood
  (flee, balanced, hunt). See the comment at the top of `ai.js` for how it
  works: minimax search with alpha-beta pruning, to a fixed budget of
  positions so the same position gets the same move on every phone.
- **Winning:** rabbits, then the ball (the hole stays shut, covered in
  twigs, until every rabbit is caught; then sink the ball), capture them all,
  take their King (it makes sure they have exactly one), catch the rabbit (it
  makes sure there is one), catch any one, a marked one, sink the ball, or
  mix it up (a different goal per layout); a move limit or none; who moves
  first.
- **Balance rules:** off, on (the default) or strict. Each level the solver
  finds is also measured, and the report shows under "How this level
  plays" and is saved with your rating. See
  [`grove-balance.md`](grove-balance.md).
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

## Possession

Timothy, 2026-10-06: "the rabbits are possessing the other pieces." In the
lab's standard board and the descent, the pieces against you are dark
pieces with a rabbit inside (`possessedStep` in `rules.js`):

- **The rabbit says which way, the piece says how.** Each turn the piece
  takes its rabbit's next step as a direction: right, up-left, or a pause
  (some patterns have pauses, `EXTRA_PATTERNS` in `rabbits.js`). Of the
  piece's own legal moves that head that way, it takes the one landing
  closest to where the step points; ties go to the shorter move, then the
  one nearer you, then the one further left. If none heads that way, it
  waits. A step that would leave the board flips the pattern on that axis,
  as a rabbit's does.
- **The colour is the rabbit's.** A possessed piece's plinth band shows its
  rabbit's fur. One kind of rabbit means every piece moves to the same
  pattern, which is how a level teaches it; more kinds come deeper down.
- **Taking one frees its rabbit.** The rabbit tumbles out of the piece and
  joins your collection.
- **In the opening**, on the 3D board, a rabbit of each colour hops in out
  of the fog and dives into its piece, which lights up.

The thinking dark pieces are still there in the lab ("Moved by: Thinking").

## The descent

`play/grove-chess/descent/`, with the depths in `descent.js`. Timothy,
2026-10-06: "once you get the ball into the hole it falls down into another
level that's harder ... see how far you can go."

- Every level is a standard board: about three possessed pieces and a hole.
  Take every possessed piece and the hole opens; sink the ball, and the
  floor gives way. On the 3D board the squares fall away into the pit in a
  ripple out from the hole (seen from above: shrinking into the dark) and
  your pieces tumble after the ball. Lose
  the ball, or run out of moves, and the run ends. How deep you got is the
  score; the deepest you have ever been is kept, and only goes up.
- **Your pieces go down with you** (Timothy's call). A run starts with the
  ball, a rook, a knight and a bishop; whatever is left when you sink the
  ball comes down too, and a piece taken stays gone.
- **And you find one more on the way** (Timothy, later the same day: "is
  the picking a new piece thing in the descent yet, if not let's do it").
  Falling to each new depth you are offered two pieces and take one:
  always one classic piece (king, knight, bishop, rook; the queen from
  depth 6) and one fairy piece (wazir, ferz, alfil, mao, zebra, camel,
  grasshopper, cannon; the squirrel and the rose from depth 5; the
  nightrider and the archbishop from depth 8). Up to six pieces, the ball
  included. The two are fixed for the run, so both possible next levels are
  found while you play the one above. Each level is found for exactly the
  hand you carry, and only kept if it takes as many moves as that depth
  asks for, so more pieces do not make it easy. The new piece's card plays
  in the next opening, the first time it turns up in a run.
- **Depth adds one thing at a time** (`depthSettings`): one kind of rabbit
  in short-stepping pieces first (king, wazir, ferz), then a moving hole,
  then pieces that can take yours (depth 3), knights, a second kind of
  rabbit and a bigger board, sliders, a third kind, stranger pieces. The
  opening shows a card the first time something new turns up in a run.
- **Every level is found by the solver**, winnable and balanced, on a
  background thread. The next depth is found while you play the current
  one, so the fall usually does not wait.
- Rabbits caught on the way down join your collection, the same one the
  daily keeps.

Next for it: the Shepard-tone fall from [`grove-look.md`](grove-look.md),
and something to find on the way down besides rabbits.

## Open

Read against the design philosophy ([`grove-chess-paths.md`](grove-chess-paths.md)),
the daily's curve across days should be social; long-term progression for
one player belongs to the long game ([`grove-long-game.md`](grove-long-game.md)).

- **What a reply does to the poster's game**, beyond joining their vine. The
  question from INTENT, still unanswered.
- **Overlap**: a relay (tomorrow's board starts where the group left the
  board), a shared board everyone places one piece on, or challenges (your
  line becomes a puzzle a friend has to beat). These need everyone to agree on
  one state, which is probably where a small server stops being optional.
- **Long-term progression for a group.** Nothing accrues across days yet
  beyond each phone's own record.
- **The share text.** Plain words and a link for now. Wordle's grid is the bar.
- **Difficulty tuning.** Par 4 to 7 with a hidden pattern has not been played
  by anyone yet, and without obstacles a third of boards fall back to par 3
  (above). Levers if that is too easy: harder rabbits on strong-fairy days,
  fewer pieces, or something back in the way.

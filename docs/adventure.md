# Adventure

A Grove Chess mode, `play/grove-chess/play/?mode=adventure`. First built
2026-10-15 as its own page on Changeling's boards, then the same day, at
Timothy's word ("adventure should be rebuilt as a grove mode, shelve
changeling mode for now. everything should be in the grove"), rebuilt on
the Grove's rules, board, runner, suits and weapons. The old address now
sends you here. The name is his working name.

## What he asked for

**First (2026-10-15):** pieces are not forced to capture and do not change
into what they take. You start with a rook, bishop or knight. Their pieces
do not move and are grey, like statues; later levels have purple pieces
that do move. You start with one piece and discover more. Suits and
weapons. Levels can have moving neutral pieces. Capture every piece in as
few moves as possible. Over par you get one upgrade, on par a choice of
two, under par a choice of three. Levels get harder in some random way,
every run is different, and par should be reasonable for how deep you are.

**Then (the same day, later):**

- "i want rabbits possessing the pieces again, it makes the game a bit more
  dynamic. also, after the level is completed, a hole opens up and you jump
  into it to go to the next level"
- "when you get another piece, it now enters your set, and every turn you
  cycle through your piece set. so there is still always just one piece on
  the board"
- "enemy pieces possessed by rabbits still move each turn, each one of
  them. rabbits have colors like before representing what set pattern that
  move in. the pattern should generally be short, super predictable, and
  not land the piece in a stuck position."
- "when you collect more than 5 pieces ... you now shuffle out of your
  total randomly each level as to which ones land in your set five piece
  cycle for that round"
- "you earn pieces by capturing them within the game. you have to capture
  three of a piece to get a copy of it, so capturing gives you a rabbit of
  that piece, and three rabbits combine into one piece that enters your set"

## The game now

You start with a rook, always (Timothy, 2026-10-15: "you always start with
the rook, no choice"). Take every piece of theirs in as few moves as you
can; then a hole opens and your piece jumps in.

- **One piece on the board.** Your set (everything you have collected, up
  to five) takes turns: after every move of yours the piece on the board becomes the
  next of the set, on the same square, in the order you got them, and then
  the first again. The row under the board shows the order: Now, Next, In
  2... Each piece keeps its own suit and weapon while it waits.
  Right under the board, a strip shows the piece that comes on **next**
  (outlined) and the one after (faded); it pops when it changes. When the
  turn ends, the piece on the board spins down into its plinth and the next
  spins up out of it, with a burst of leaves and a soft grind of stone
  (Timothy, 2026-10-15: "a quick animation for when the pieces cycle on the
  board ... a clear little icon thing underneath the board to show what
  piece comes up next").
- **Suits and weapons, redone for one piece taking turns** (Timothy,
  2026-10-15):
  - **Gears** ("should allow you to skip the piece in the cycle"): when
    your piece of Gears comes up, a button lets it step aside: the next
    piece of the set comes on straight away and moves this turn instead.
    It costs no move, and works once a turn (the piece that comes on cannot
    skip again, nor pass unless it has no move). In rules: a `skip` move in
    `movesFor`, which `playerMove` turns into `nextInSet` and a turn left
    open (`bonus.why = 'gears'`), like Stars and Vines.
  - **Sword** ("should be based on the direction you move, not just the
    space above"): with `swordAims` (a lab setting, on in Adventure) it
    strikes the square past where it lands, in the direction it moved, to
    the nearest of the eight directions (a knight's L counts as diagonal);
    level 2 adds the squares to either side of that, level 3 the two
    between (`swordAim` in `rules.js`). Elsewhere it still strikes toward
    the other side.
  - Their words follow (`suitDesc`, `weaponDesc` in `run.js`), on cards and
    when you tap the piece. Hearts, Spirals, Stars, Vines, the lance and
    the mace are as they were.
- **Theirs.** Grey statues never move and never take. The rest have a
  rabbit inside and **walk a route every turn, all of them**. A route is
  made of the piece's own moves, so it is easy to read: a rook's route is
  one square at a time, a knight's is L by L. Four kinds, each with its
  rabbit's colour (the plinth under the piece):

  | Route | Colour | Steps | From depth |
  |---|---|---|---|
  | Shuttle | tangerine | there, back | 1 |
  | Doze | sky blue | rest, there, rest, back | 2 |
  | Box step | moss green | round a square: there, across, back, across | 4 |
  | Pace | crimson | there, there, rest, back, back, rest | 6 |

  On the board each walker's whole route is dashed in its colour, and its
  next step is drawn solid to a frame on the square it moves to next turn.
  The lines go square by square with right-angle turns, not as the crow
  flies (Timothy, 2026-10-15): a diagonal as a staircase, a leap along its
  long side and then its short one, the way a knight's L is drawn;
  a rest is a dashed frame on its own square. **Stand on that square and it
  takes you.** It threatens nothing else, so the purple reach shows only
  that square for it.
- **The hole.** Taking the last of theirs wins the board: a hole opens on
  the free square nearest your piece, and your piece hops into it by itself
  (Timothy, 2026-10-15: "the hole should just be like an animation where the
  piece jumping in, it's boring to have to move it yourself"). There is no
  hole on the board before then, and no flag (that is golf's). Par is the
  moves to clear the board. In rules: goal `'clear'` is won when every one
  of theirs is taken, and `exitSpot` places the hole; the board's
  `intoHole` plays the hop.
- **No pawns** (Timothy, 2026-10-15: "pawns kind of can't be a thing in
  this mode due to them moving in one direction"): none among theirs, so
  no pawn rabbits and never a pawn in your set.
- **Rabbits.** Every piece of theirs you take leaves its rabbit with you,
  statues included. Three rabbits of a kind become that piece, which joins
  your set after the board. The row under the board counts them (Knight:
  2/3); the turn's caption says so when you take one.
- **More than five.** Past five pieces, each board draws five of them at
  random (in the order you got them) and the rest rest; the row shows how
  many are resting.
- **Taken.** If they take the piece on the board, that piece is gone for
  good and the board ends (the floor gives way: one card, as for not
  clearing it). With no pieces left, the adventure is over.
- **Between boards:** over par (or not cleared), one card; on par, a
  choice of two; under par, three. Cards are suits and weapons only now:
  new pieces come from rabbits.

## The look of your pieces

In Adventure each piece of yours wears its suit (Timothy, 2026-10-15, in
three steps: "the vine look should be for the vine suit, we should have
custom looks for the others that are colored like the suit"; then "your
pieces should start at gray with no special visual, then the green we have
should be the green for the vine one. gears should be more prominent ...
hearts seems not to have a real motif. you can mess with the actual 3d
model of the piece itself"). Each look is the piece's own shape in its
colours, built round or reshaped with its motif (`SUIT_LOOK` in
`models.js`, `model(kind, look)`):

| Suit | Body | Motif |
|---|---|---|
| none | plain pale grey | none |
| Vines | the Grove's green | two woody vines climbing it, with bright leaves |
| Hearts | rose red | crowned with a big red heart, a pale heart on its chest, a ring of little hearts round its plinth |
| Gears | blue steel | its plinth toothed into a gear, two gears round its body, a cog crowning it and one on its chest |
| Spirals | amber | the piece itself twisted about its axis (`twist`), with a cream stripe wound up it, curled at the top |
| Stars | gold | a star on its head and four small ones round it |

Their statues were made a shade darker the same day, so a plain piece of
yours (pale grey) is never taken for one of theirs.

How the ornaments sit on the piece: `surface` finds how far out the piece
is at a height and angle (the farthest corner near there), and each vine,
stripe, heart or star is placed just outside that. Vines and stripes are
thin boxes laid end to end (`strand`); leaves are flat diamonds seen from
both sides (`leaf`); a heart in the round is two balls over a cone
pointing down (`heart3d`); a gear is a short wide drum with boxes for
teeth (`cog`). `twist` turns every corner about the axis by an angle that
grows with its height, and recomputes each face's facing so the renderer
still culls the right side.

The board (`board.lookOf`), the set row, the next-up strip, the intro's
cards and the fall between boards all use the look.

## How it is built, in Grove terms

It is a descent (`run: 'descent'`) with its own way between levels,
`upgrades: 'par'`. New engine parts are general settings, so the lab can
use them too.

- **The preset** is `MODES.adventure` in `modes.js`: one piece to start,
  a set of five (`maxPieces`), goal `'clear'`, `darkBrain: 'possessed'`
  with `patterns: 'routes'`, `oneMove: false` (all of theirs move every
  turn), and `cycle: true`.
- **Goal `'clear'`** (`rules.js`): every piece of theirs is marked, and
  `goalMet` is true once they are all taken. At the end of that move
  `playerMove` puts the hole on the free square nearest your piece
  (`exitSpot`); the board animates it opening (`animate`, a hole where
  there was none) and the runner plays the hop in (`intoHole`).
  `EXIT_DESC` says it in words. (Until release 69 you had to move onto the
  hole yourself, and par counted that move.)
- **Routes** (`lab.js`, `ROUTES` and `dealRoutes`): dealt last, on the
  finished level. For each piece of theirs, in random order, a route kind
  the depth allows (`routeKinds`) and a move `v` (and `w` for Box step)
  from its own shortest moves. `routeSquares` (`rules.js`) walks it once
  round with the real move code and keeps it only if it is never blocked,
  never bounces off an edge, and ends home facing the same way. No two
  routes share a square, none crosses your square or the hole, and each
  touches a square your set can reach. A piece with no route (any pawn,
  which never steps back) is a statue; a level dealt all pawns turns one
  into another of the pool so someone walks. In play a walker that finds
  you on its next square takes you, or if it cannot (a cannon next to
  you), waits and tries the same step again (`f.route` in
  `possessedStep`), so it never falls out of step.
- **Reach** (`setReach`): the squares your whole set can get to from where
  you start on the empty board. A lone bishop keeps to its colour, so
  statues and the hole are moved onto its colour. Without this, a bishop's
  board could be unwinnable.
- **The set** (`cycle`, `rules.js`): `makeLevel` keeps only the first
  piece on the board and the whole set as `day.cycle`; the state carries
  `s.set` and `s.ci`. At the end of every turn (`nextInSet`, called in
  `apply`, `respond` and `respondWith`) the board piece's own fields go
  back to `s.set[s.ci]` and the next entry comes out, keeping the square
  (`PLACE` lists what stays). `stateKey` includes `ci`, so the solver
  treats the same square as a different position for a different piece.
  `setOrder` gives the order from the board piece on, for the row.
- **The run** (`run.js`): `adventureSet` picks the board's set (all, or
  five at random from a seed of the run, the depth and the collection's
  size, so finding and playing agree); `handSettings(run, pick)` deals only
  those; `afterAdventure` removes the piece taken on the board and keeps
  hearts spent; `takeRabbits` counts rabbits by kind (`run.rabbits`) and
  turns every three into a piece; `adventureCards` deals suits and weapons
  only.
- **Par** is the Grove's solver (`searchLayouts` with `quick`), which now
  searches wider (it skips the balance report, so it can) and gives each
  layout at most 2.5 seconds. Measured in node: every depth from 1 to 15
  finds a board on the first layout, mostly in under a second, worst seen
  4.2 seconds; early boards' par is exact. Par is that plus 1 to depth 5,
  plus 2 to depth 11, plus 3 after (`adventureSlack`).

| Depth | Board | Theirs | Walking | Routes | Clouds |
|---|---|---|---|---|---|
| 1 | 5 x 5 | 3-4 | 1-2 | Shuttle | none |
| 2-3 | 5 x 5, odd shapes from 3 | 4-5 | 2-3 | + Doze | none |
| 4-5 | 5 x 5 or 6 x 6 | 5-7 | 2-3 | + Box step | some, from 5 |
| 6+ | 6 x 6 or 7 x 7 from 8, crumbling from 6 | up to 9 | 3-5 | + Pace | some, sometimes 2 |

Harder from the start since 2026-10-15 (Timothy: "early levels should be a
bit harder"): one more of theirs and one more walking at every depth, the
longer routes a depth or two sooner, and par no longer pays for the jump.

[`adventure-check.mjs`](../play/grove-chess/adventure-check.mjs) proves the
statues, the Changeling, the routes (72 dealt boards, 24 turns each: never
stuck, home after every round, no shared squares, pawns still), a walker
taking you, the hole (shut, open, sink, no sliding over), the set taking
turns and keeping suits, five of seven, rabbits, losing a piece, dealing
with a par that clears the board and opens the hole at five depths, no pawns among theirs, and the cards.

## The Changeling piece

The consolation for shelving the Changeling daily: a Grove fairy piece. It
steps like a king until it takes something, then moves like the last piece
it took, and changes again with every capture (`reshape` in `rules.js`,
for either side). Its shape is drawn as that piece on a plinth of fairy
silver, says so when tapped, and lasts the board. It cannot be fused. Its
model is a hooded fairy child with a borrowed face. Three Changeling
rabbits make you one.

## Paths

| Path | In? | Within one board | Within a run | Across runs | Notated by |
|---|---|---|---|---|---|
| Mastery | in, the core | the route through moving walkers and a changing piece; beating par | planning around the set's order | knowing each route and each set | written (par, the verdict), visual (routes, next steps, the set row), audial (the fanfare climbs with how far under par) |
| Collection | in, new | rabbits by kind, three to a piece | a growing set, then a bench of more than five | none yet | visual (the set row, rabbit counts), written (captions) |
| Power | in, a run's curve | suits and weapons change your moves | one piece to five, then more to draw from | resets each run | visual (suit colours, weapons), written |
| Customization | light | none | which upgrade, on which piece | your first piece | written |
| Narrative | thin | adventure: down through the Grove, into the hole | what you picked up, what you lost | none | visual (the hole, the fall) |
| Social, world, competitive | out | | | | |

**Tensions to watch:** a big set dilutes the cycle (more pawns means more
turns as a pawn); power from upgrades against a challenge that grows only
by count and board size; wandering clouds hiding a walker, against "super
predictable".

**Gaps, and ideas (not built):** choosing which rabbits combine or setting
the set's order (customization); something that lasts between runs (the
descent's roster could carry); a walker's colour learned across runs like
the daily's rabbits.

## Tactics: chess technique with one piece at a time

Timothy, 2026-10-15: "i want to find a way to still have opportunities for
pinning and other chess technique even though we are working with one
piece at a time"; then, of seven ideas, "let's do everything but 6. also 5
should be a new suit called stone that lets you leave a sentry behind of
your piece." Chess technique needs pieces that defend, lines through
pieces, an opponent who can answer only one thing at a time, and something
precious. Each of these adds one of them back. All in `rules.js`
(`tacticsTurn`, with `rules.tactics`), dealt by `lab.js` (`dealRoutes`).

**First, the turn order changed.** Your piece now becomes the next of your
set at the end of your move (`nextInSet` in `playerMove`), before they
answer, so a threat, a pin or a check is made by the piece that will move
next turn and can follow it up. On screen nothing looks different.

Their turn, in order:

1. **Pins.** A line from your piece, or a stone of yours, through one of
   theirs to another of theirs behind it pins the front one for the turn:
   it cannot step, strike, run or block (`tacticalPins`). Only sliding
   pieces have lines. Pinned pieces wear the Grove's pin needle.
2. **Check.** Their **leader** is a crowned King (gold plinth, a gold
   crown). If you attack it they answer: a piece of theirs takes the
   attacker if one can (the King itself only where nothing else of yours
   guards that square); else one steps into the line to block, and stands
   guard there from then on as a sentry; else the King runs to a square you
   do not attack; else it is **checkmate**: every piece of theirs falls and
   the board is yours. Attacked twice at once (double check, say your piece
   and a stone), only running will do. A red ring marks a leader in check.
3. **Flight.** A piece with a **skittish** rabbit (a white plinth) runs to
   a square you do not attack when you attack it, but only one runs a turn,
   the most valuable that can. Attack two at once (a fork) and the other is
   left; pinned, it cannot run. A gold ring marks one that could not run.
4. **Walkers** take their steps, except the pinned, which hold.
5. **Sentries** (grey, a red eye and a red plinth) never walk, but each
   takes anything of yours standing where it attacks, your piece first,
   then a stone, moving onto it. Their reach is shaded purple.
6. **Your stones** each take one of theirs that moved this turn into where
   they attack, moving onto it: a trap, not a turret, so a stone never takes
   a statue that only stands on its line.

**The Stone suit** (◆, sandstone, Adventure's own, so it never turns up in
the other modes): once a board, a piece of Stone may leave a stone copy of
itself on the square it moves off (the "◆ Leave a stone" button, then the
move). The stone stays, is yours, strikes as above, pins and gives check
along its lines, and their pieces can break it. Your Stone piece is
sandstone with carved bands; a stone left behind is darker, on pebbles.

**Arrival, one at a time:** a sentry from depth 2, a skittish piece from 4,
their leader from 6 (half the boards; most from 9). Pins work from the
first board.

**Checkmate is a shortcut**, since it topples the board, so leader boards
are dealt with care: the King starts with at least three open squares
round it and two or more from you, the sentries are the statues nearest
it (its bodyguards), par must be at least 4 plus a third of the depth, and
an exact search (as far as a budget lets) throws out any board that falls
to a mate sooner than that.

**In words:** the turn's caption says what happened: "Your rook pins
their knight: it holds", "Check! Their bishop steps in to block", "Double
check! Their leader runs", "Checkmate!", "Fork! Their bishop could not run
as well", "Your stone takes their camel". Tapping a sentry, a skittish
piece, the leader or a stone says what it does; the pieces sheet lists them.

**Not built:** idea 6, skewer chains (a free move to take the piece behind
the one you take).

**The solver** now counts a win on their turn (checkmate, or a stone
taking the last of them) as a win (`solve.js`); before, it was thrown away
as game over.

## Open, and Timothy's

- What happens when they take your piece: now it is gone and the board
  ends. Alternatives: the next piece of the set comes in on the same square
  and the board goes on.
- Whether statues give rabbits (now: yes, every piece taken does).
- Whether a new piece should join mid-board rather than after it.
- The route kinds and their colours, and when each arrives.
- Wandering clouds, which can hide a walker.
- Endless, with no final depth.
- Tactics: whether checkmate should topple the whole board or only take
  the leader; whether stones should be traps (as now) or strike anything in
  reach; how strong the leader's bodyguards should be.

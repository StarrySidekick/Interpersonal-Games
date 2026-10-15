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

Take every piece of theirs, then jump into the hole, in as few moves as you
can.

- **One piece on the board.** Your set (everything you have collected, up
  to five) takes turns: after every turn the piece on the board becomes the
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
  | Doze | sky blue | rest, there, rest, back | 3 |
  | Box step | moss green | round a square: there, across, back, across | 5 |
  | Pace | crimson | there, there, rest, back, back, rest | 8 |

  On the board each walker's whole route is dashed in its colour, and its
  next step is drawn solid to a frame on the square it moves to next turn;
  a rest is a dashed frame on its own square. **Stand on that square and it
  takes you.** It threatens nothing else, so the purple reach shows only
  that square for it.
- **The hole** is on the board from the start, shut under a twig cover. No
  flag: that is golf's (Timothy, 2026-10-15: "the hole shouldn't have the
  flag in this mode"). When the last of theirs is taken it opens. A move onto
  it jumps in. A slide cannot pass over the open hole (it would fall in); a
  leap can. Take the last of theirs while standing on the shut hole and you
  drop straight in. Par counts the jump.
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

Timothy, 2026-10-15: "can you make your pieces look like they are wrapped
in 3d vines ... more like crumbled stone, with green vines. just want to
see if it looks cool." In Adventure only, for now, your pieces are their
own shapes in weathered stone, wrapped in two climbing vines with leaves:
`model(kind, 'vine')` in `models.js`. How it is made:

- The piece is built as usual from a stone palette (`VINE_STONE`).
- `crumble` wears it: every corner above the plinth is nudged in or out a
  little, now and then bitten deeper, by a hash of where it is, so the same
  corner always moves the same way and the surface never splits; faces are
  mottled lighter and darker, a few chipped dark, a few gone to moss.
- `vines` climbs it: two spirals, a turn and a bit each, from the plinth to
  four fifths of its height. At each step `surface` finds how far out the
  piece is at that height and angle (the farthest corner nearby) and the
  vine sits just outside it, as thin boxes laid end to end (`strand`), with
  diamond leaves (`leaf`, two triangles, drawn from both sides) along it,
  at its end, and at its foot.

The board (`board.mine`), the set row, the intro's cards and the fall
between boards all use it. Your pieces were green to tell them from
theirs; in stone, the vines carry that.

## How it is built, in Grove terms

It is a descent (`run: 'descent'`) with its own way between levels,
`upgrades: 'par'`. New engine parts are general settings, so the lab can
use them too.

- **The preset** is `MODES.adventure` in `modes.js`: one piece to start,
  a set of five (`maxPieces`), goal `'clear'`, `darkBrain: 'possessed'`
  with `patterns: 'routes'`, `oneMove: false` (all of theirs move every
  turn), and `cycle: true`.
- **Goal `'clear'`** (`rules.js`): every piece of theirs is marked; the
  hole (placed in `makeLevel`, no ball) stays shut until they are all
  taken (`holeOpen`); then `exitMoves` marks a move onto it as `sink` and
  drops slides that would cross it, and landing there wins (`n.won =
  n.sunk = true`). The solver's score counts distance to the hole once
  they are all taken. `EXIT_DESC` says it in words.
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
| 1-2 | 5 x 5 | 2-4 | 1 (2 sometimes) | Shuttle | none |
| 3-4 | 5 x 5 or 6 x 6, odd shapes | 3-5 | 2-3 | + Doze | none |
| 5-7 | 5 x 5 or 6 x 6, crumbling from 6 | 5-7 | 2-4 | + Box step | some |
| 8+ | 6 x 6 or 7 x 7 | up to 9 | 3-5 | + Pace | some, sometimes 2 |

[`adventure-check.mjs`](../play/grove-chess/adventure-check.mjs) proves the
statues, the Changeling, the routes (72 dealt boards, 24 turns each: never
stuck, home after every round, no shared squares, pawns still), a walker
taking you, the hole (shut, open, sink, no sliding over), the set taking
turns and keeping suits, five of seven, rabbits, losing a piece, dealing
with a par that ends in the hole at five depths, and the cards.

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

## Open, and Timothy's

- What happens when they take your piece: now it is gone and the board
  ends. Alternatives: the next piece of the set comes in on the same square
  and the board goes on.
- Whether statues give rabbits (now: yes, every piece taken does).
- Whether a new piece should join mid-board rather than after it.
- Pawns joining your set (a pawn turn is a step up or a pass).
- The route kinds and their colours, and when each arrives.
- Wandering clouds, which can hide a walker.
- Endless, with no final depth.

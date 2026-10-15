# Adventure

A roguelite built on Changeling's boards, 2026-10-15, at
[`play/changeling/adventure/`](../play/changeling/adventure/). The name is
Timothy's working name.

## What he asked for

Pieces are not forced to capture and do not change into what they take. You
start with a rook, bishop or knight. Their pieces do not move and are grey,
like statues; later levels have purple pieces that do move. You start with
one piece and discover more, up to four. Suits and weapons. Levels can have
moving neutral pieces. The goal is to capture every piece in as few moves as
possible. Over par you get one upgrade, on par a choice of two, under par a
choice of three. Levels get harder in some random way, every run is
different, and par should be reasonable for how deep you are.

## How it works

- **A run** has its own seed. Choose your first piece; each board is dealt
  from the seed, the depth and the pieces you have, so a run is
  reproducible (test mode shows the seed).
- **Moving** is the Grove's: tap your piece, gold squares are moves, red
  ones captures, purple ones where one of theirs could take it next, blue-grey
  a Gears swap. Tap a square to go.
- **Their pieces.** Grey statues never move. From depth 4, purple pieces
  that move: after each of your turns, one of them moves (the most useful
  move it has: take your most valuable piece, save one of its own, or come
  at you without stepping where you could take it). It is deterministic, so
  the same position always gets the same reply.
- **Rabbits** are the neutral movers (from depth 3, about half the boards):
  each hops a short pattern after your move, turns round at an edge, waits
  if something is in the way, blocks lines, and cannot be taken. Footprints
  show the next hop.
- **Losing.** A piece of yours that is taken is gone for the run (Hearts
  brings it back to your first row once). Lose them all and the run is over.
- **Suits and weapons** are the Grove's, same rules and words
  (`play/grove-chess/run.js`): Hearts, Spirals, Gears, Stars, Vines; Sword,
  Lance, Mace at levels 1 to 3. Front, for a sword or a mace, is up the board.
- **New pieces** come as an upgrade card: always offered (first, so even a
  single card brings it) after depths 2, 4 and 7 while you have fewer than
  four, and sometimes otherwise. Which pieces widen with depth: classic
  first, then fairy pieces, the queen only from depth 9.
- **Starting over**: once per board.

## Harder in a random way

`makeLevel` in `run.js`. Each depth unlocks more, and each board draws at
random from what is unlocked:

| Depth | Boards | Statues | Purple movers | Rabbits |
|---|---|---|---|---|
| 1-2 | 5 x 5 | 2-4 | none | none |
| 3-4 | 5 x 5 with holes, 6 x 6 | 4-5 | from 4, often 1 | about half the boards |
| 5-7 | the daily's 6 x 6 and 7 x 6 shapes, or the hollow | 5-7 | 1-2 | about half |
| 8+ | every daily shape, to 7 x 8 | up to 10 | up to 4, rooks, then fairy pieces and queens | sometimes 2 |

Statues are only placed where your pieces, weapons included, could take
them: a lance needs room beyond, a sword a square beside.

## Par

Par is a beam search over whole turns (`search` in `rules.js`): it plays the
board out, their replies and the rabbits included, and keeps the most
promising positions each turn, avoiding losing your pieces. It is not
always the shortest route, but it is always a real one. Par is its length
plus 1 to depth 5, plus 2 to depth 11, plus 3 after, since deeper boards
are harder to read. So under par is always possible. Because par is worked
out with your pieces and upgrades, it tightens as you get stronger.

Measured over 30 random runs to depth 12 (360 boards): every board dealt,
the search's route is 4 to 8 moves (median) from depth 1 to 12, and a
board takes 2 ms (median, depth 1) to 240 ms (depth 12) to build, worst 1.2
s in node, off the page's thread in a worker.
[`check.mjs`](../play/changeling/adventure/check.mjs) proves every suit and
weapon rule and plays three runs of ten boards on their routes.

## Paths

| Path | In? | Within one board | Within a run | Across runs | Notated by |
|---|---|---|---|---|---|
| Mastery | in, the core | beating par: planning a route, reading their reply | combining suits, weapons and pieces | knowing what each upgrade is worth | written (par, verdict), visual (verdict colour), audial (the fanfare climbs with how far under par) |
| Power | in, a run's curve | your verbs change with weapons and suits | one piece to four, upgrades every board | resets each run, as a roguelite does | visual (suit colours on the plinth, weapon marks), written (names), audial (a chime on an upgrade) |
| Customization | light | none | which upgrades, on which piece | your first piece | written |
| Collection | thin | none | none | totals: deepest, runs, boards, under par | written |
| Narrative | thin | adventure: going down through the Grove | the run's story is what you picked up | none | written |
| Competitive | small | par | depth | your own deepest | written |
| Social, world | out | | | | |

**Social is out on purpose** in this mode: Changeling's daily carries it.
A seed can be shared later if wanted.

**Gaps, and ideas (not built):**

1. **Something that lasts between runs** (collection, customization): the
   Grove's descent carried a roster and waystones. Here, a codex of every
   piece, suit and weapon you have used, or starters unlocked by depth.
2. **Their pieces with suits and weapons** at depth (mastery): the descent
   gives theirs suits; here only yours have them for now.
3. **Watch power against challenge.** Vines on a king beside a cluster of
   statues can clear a board in a few turns; par follows your power, so
   under par stays hard, but boards may want more statues as you grow.

## Open, and Timothy's

- Choosing the first piece, rather than it being dealt.
- One of theirs moves each turn, not all of them.
- Rabbits as the neutral movers; clouds or others could join.
- Starting a board over once, and the new-piece depths (2, 4, 7).
- Endless, with no final depth.

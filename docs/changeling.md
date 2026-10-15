# Changeling

A daily chess puzzle, built 2026-10-15 at [`play/changeling/`](../play/changeling/).
What Timothy asked for, in short: a daily chess game as simple and as
much fun as Wordle or Pinstinct; playable by someone mediocre at chess;
five minutes or less; a skill ceiling that keeps rising out of reach; a
little different every day; and, if it fits, something whimsical, with new
pieces or new board shapes. The name is a working name and his to change.

## The game

> **You are the glowing piece. Every move takes a piece, and you become the
> piece you take. Take them all.**

- One board a day, the same for everyone, dealt from the date.
- Every move is a capture. Land on a piece and you turn into it: take a
  knight and you move as a knight; take a pawn and you can only go up.
- When nothing is in reach, you are stuck. Step back as far as you like:
  the first step back starts your next try. **Six tries.** Your score is the
  try you clear the board on (`2/6`), or `X/6` and the fewest pieces you
  left.
- Holes in the board stop sliding pieces; jumping pieces fly over them.
- Each day has one **stranger**, a real fairy piece from the history of
  chess (camel, ferz, cannon, zebra, wazir, nightrider, alfil, archbishop,
  squirrel, dabbaba, chancellor), marked with a star. A clear takes every
  piece, so every clear uses it, and the dealer makes sure you get to move
  as it at least once.
- Tap a gold-ringed piece to aim: gold corners show what you could take
  next, as it. Tap it again to take it. Tap any other piece to see its moves
  in purple.

## Why this shape

**Why "you become what you take."** It is the one rule a non-player can
hold in their head, and it makes chess's real skill, seeing ahead, the
whole game. Knowing how the pieces move matters, but the board shows it, so
the floor is low. What separates players is how far ahead you can see: if I
take the bishop, then I am a bishop, and the only thing a bishop can reach
from there is the pawn, and a pawn can only go up...

It also lands on Timothy's own philosophy: "the best power progression
changes your verbs, not only your numbers." Within one board your verbs
change on every move.

**Why tries, and stepping back.** Wordle's shape. A dead end is not the end
of the game, it is a wrong guess that taught you something, and stepping
back keeps what you learned on the board instead of making you replay the
start. A misplaced tap on a phone costs one try, not the day.

**Why the skill ceiling keeps rising.** Two things hold the top end out of
reach. The week climbs like a newspaper crossword: Monday has 7 pieces and
about a dozen routes; Sunday has 12 or 13 pieces and a few hundred routes,
of which usually two clear. Clearing a Sunday on the first try means seeing
the whole route before you move, which is the "Wordle in one" of this game.
And the strangers rotate through eleven pieces against a seven-day week, so
each one meets every difficulty over eleven weeks.

**Why it is whimsical.** Named board shapes (the meadow, the heart, the
well, the crossroads, the round stone, the mushroom, the pond, the rabbit,
the stepping stones, the diamond), a stranger a day, the Grove's pixel
pieces and colours, and a tune: each piece you take plays the next note of
the day's melody, so a clear plays all of it, and a try that stops short
leaves it unfinished.

## The dealer, and how hard each day is

`rules.js`, `deal(date)`. Version 1 from 2026-10-15.

Candidates are built by walking a route: from the start, drop a piece on a
square the current piece could reach, become it, repeat. A later piece can
block an earlier slide, so the solver checks every finished candidate and
only keeps one that some route clears.

The solver (`solve()`) counts every route at once by treating "where you
stand, and which pieces are left" as one state, so thirteen pieces is at
most 14 x 8192 states and takes milliseconds. For each board it knows the
number of routes, the number that clear, and **the chance that someone
choosing at random clears it**. That chance is the ruler for difficulty:
everyone plays better than random, but it compares boards fairly. Each
weekday has a band for it, a range of piece counts and a fewest number of
routes. Over the first 400 days:

| Day | Pieces | Routes (median) | Random player clears | Routes that clear (median) |
|---|---|---|---|---|
| Monday | 7 | 12 | 1 in 5 | 2 |
| Tuesday | 9 | 28 | 1 in 9 | 3 |
| Wednesday | 10 | 44 | 1 in 18 | 3 |
| Thursday | 11 | 82 | 1 in 26 | 3 |
| Friday | 11 | 89 | 1 in 44 | 3 |
| Saturday | 12 | 176 | 1 in 60 | 3 |
| Sunday | 13 | 324 | 1 in 150 | 2 |

Every day deals within its band, in under 100 ms in node. Boards are dealt
in the page, not stored, and [`check.mjs`](../play/changeling/check.mjs)
proves the first 400 days still deal exactly as stored in `boards.txt`.
**A shipped board never changes:** a change to dealing, pieces or rules is
a new version in `VERSIONS` with a future start date.

## Paths

Run with the `game-design` skill, against
[`design-philosophy.md`](design-philosophy.md).

| Path | In? | Within one play | First week | Third month | V / H | Notated by |
|---|---|---|---|---|---|---|
| Mastery | in, the core | seeing ahead; learning from a dead try | the week's climb, Monday to Sunday | the strangers rotating; first-try Sundays | vertical (tries), horizontal (pieces) | written (score), visual (rings, the row of shapes you have been, the grid), audial (the day's tune) |
| Social | in, an ensemble | none | the share text and link; watching a friend's tries on the same board | **resets daily** | muddy | written, visual (their route played back) |
| Power | within one play only | your verbs change every move | none | none | horizontal | visual (you turn into the piece) |
| Collection | thin | none | "Your days": totals and a tries histogram | the same | vertical | visual, written |
| Narrative | thin | mystery (the route), wonder (the stranger) | none | none | none | written |
| Competitive | small, in the chat | none | scores side by side | none | vertical | written |

**Out on purpose:** power across days (the board has to be the same for
everyone), customization, world, clocks (it gets played in bed), streaks,
free undo (it would make every board solvable by trial), and hints beyond
the one-move preview.

**Gaps, and ideas for them (not built):**

1. **A field guide of strangers** (collection, narrative). Each fairy piece
   you have cleared a board with gets a page, its history from
   `play/grove-chess/history.js`. Eleven to find, none missable, since each
   comes back every eleven days.
2. **The group's curve** (social). The share resets daily, like Wordle's.
   Something that accrues across a chat's days needs either a server or a
   longer link; the same open question as Grove Chess.
3. **Choosing your first piece** on the hardest days (mastery). Start from
   any piece on the board: a bigger puzzle with one more decision.

## Open, and Timothy's

- The name.
- Whether six tries is the right number.
- Whether Grove Chess's modes stay on the home page beside it.

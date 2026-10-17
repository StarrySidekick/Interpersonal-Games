# Adventure's boards, as rules

Timothy, 2026-10-17: "levels should be built based on a set of rules, not be
the same every run. like hades or rogue legacy or balatro ... i want there to
be a way for levels to be generated, you know, without Claude, just like
using like a set of parameters like you would in a rogue like".

Every Adventure board (and Adventure Tactics, and each day of the daily) is
made in the browser from three things: **the rules** (tables in
[`play/grove-chess/adventure-levels.js`](../play/grove-chess/adventure-levels.js)),
**the run's seed** and **the depth**. Then the solver plays it, and only a
board it has won is ever shown. Nobody, Claude included, places a board by
hand. To change the boards, change a table.

The method behind the tables, and the games they borrow from, is the
`level-design` skill ([`.claude/skills/level-design/`](../.claude/skills/level-design/SKILL.md),
with its research in `research.md`). This page says what the rules are, in
plain words, and what they make.

## The rules, in plain words

**Acts of five.** Boards come in fives: an intro, two normal boards, an
elite and a boss. Each place has a multiplier on the board's threat budget:
intro 0.75, normal 1, elite 1.3, boss 1.15. So a run is a sawtooth, not a
ramp: the next act's intro is easier than the last act's elite, a breather
after the peak (Left 4 Dead's "pacing, not difficulty"; Balatro's antes).

**A threat budget.** Each board has a budget: 3.6 at depth 1, rising 0.6 a
depth, times the multiplier above. How many pieces of theirs a board has is
set by par (more pieces, more moves); the budget decides *what kind* they
are. Every piece starts as a robot (cost 1); what is left of the budget buys
pieces up into dearer kinds, one at a time, by weight. What is left after
that buys suits for their pieces. (Dead Cells spends a monster budget the
same way.)

**Their rabbits** (`RABBIT_RULES`):

| Kind | Cost | From depth | Weight | Most on a board |
|---|---|---|---|---|
| Robot | 1 | 1 | (the rest) | |
| Sentry | 1.6 | 1 | 3 | |
| Trap | 1.6 | 2 | 3 | |
| Scared | 1.2 | 3 | 1 | 1 (a chase is a dead turn) |
| Simple | 1.6 | 4 | 1.5 | |
| Sentient | 2.6 | 10 | 1 | 2 |

Sentries and traps weigh most (Timothy: "we need sentry and trap rabbit
early and more"). One piece always stays a robot, so something walks, except
on the Sentry Wall. Robots walk every turn, and always did ("robot rabbits
also should move every turn ... (if they don't already)": they did).

**Debuts.** No kind turns up before its depth. On the board where it first
can, it is bought first, even a little over budget, and only sentries and
traps stand beside it: meet it, then see it mixed in (introduce, develop:
Nintendo's kishotenketsu).

**Suits on theirs** from: Hearts 4 (dealt as a count, a second hit), Vines 5,
Stars 6, Spirals 8, Gears 10.

**Sizes** (`SIZES`): depth 1, three or four squares a side; 2, three or four
(four likelier); 3 and 4, four or five; 5, four or five; 6 and 7, four to
six; 8 to 12, five to seven; 13 to 17, six or seven; 18 on, six or seven
(seven likelier).

**Hedges** (`HEDGES`): none at depth 1; up to one from 2; one or two from 4;
one to three from 8; never more than an eighth of the squares, and never next
to where a piece of yours starts (on a narrow board one there could wall you
in).

**Loops** robots walk: the shuttle from 1, the box step from 3, the pace
from 6. When no piece of a board finds a loop (a diamond or a cross board,
or pieces whose moves fit none), one becomes another piece of the pool that
can walk one, so something always walks.

**Bosses** (`BOSSES`): the fifth board of each act. Each is one rule, said
on a card before the board starts, and pays one card more. A run draws them
from a shuffled bag: none comes twice until all that can come have come
(Balatro's boss blinds).

| Boss | Its rule | From |
|---|---|---|
| The Hedge Maze | Twice the hedges (up to a quarter of the squares) | 5 |
| The Sentry Wall | Every piece of theirs a sentry or a trap | 5 |
| The Court of Hearts | Every piece of theirs has two lives (half as many) | 5 |
| The Thimble | A board a size smaller, as many of theirs | 5 |
| The Hurry | The dark comes at par | 5 |
| The Star Chamber | Every piece of theirs has Stars | 10 |

**The dark** (`darkAfter`): from par plus two (a double bogey), a piece of
yours is taken every turn. From depth 16 it comes at par plus one; from 26,
at par. So "the game should get progressively harder until you lose": past
the tables, the budget keeps climbing and the dark keeps closing in.

**Par** is Adventure's own (`adventurePar` in `modes.js`: 5 for depths 1 to 3,
one more every three depths), and the deal asks for a best line two
under it, so an eagle is always there. The first three boards take exactly
that line.

## What the rules make

`node play/grove-chess/level-report.mjs 1 30 6` (2026-10-17: six runs a
depth, dealt as the page deals them, a plain hand; a cat, a bishop from 2, a
knight from 4):

| Depths | Sizes | Theirs | Kinds met | Best lines | A deal takes (middle) |
|---|---|---|---|---|---|
| 1 to 3 | 3 to 5 | 3 | sentry 1, trap 2, scared 3 | 3 (par 5) | 0.02 to 0.1 s |
| 4 to 5 | 4 and 5 | 3 to 3.5 | simple 4; hearts, suits | 4 (par 6) | 0.06 to 0.09 s |
| 6 to 9 | 4 to 7 | about 3 | all but sentient | 4 to 5 (par 6 to 7) | 0.1 to 0.25 s |
| 10 to 14 | 5 to 7 | 3 to 5 | sentient 10 | 5 to 7 (par 8 to 9) | 0.15 to 1.3 s; boss 10, 3.5 s |
| 15 to 20 | 6 and 7 | 4 to 6 | everything | 7 to 9 (par 9 to 11) | 1.8 to 4.5 s; bosses 7 to 8.5 s |
| 21 to 30 | 6 and 7 | 6 to 7.5 | everything | 8 to 12 (par 11 to 14) | 1.7 to 14 s |

No deal failed at any depth. **The open cost:** from about depth 20 a deal
takes several seconds (over ten at some), while you watch the fall; it
cannot start before you have chosen your card, since what your pieces carry
changes the board. The next thing to tune, measured with the report: fewer
of theirs per budget deep down, or a looser best line there.

## Changing the rules

The skill's procedure, in short: say the principle; change a table, not a
board; keep the shipped daily still (a rule that would move a stored board
goes behind a setting whose default is the old way); run the report before
and after; play it on a phone's size; write it here and in `adventure.md`.

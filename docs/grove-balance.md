# Balancing Grove Chess

Started 2026-10-06, after Timothy asked for "general balancing rules in
place besides just amount of moves to win, in order to start to make
iterations of the game better", and pointed at pieces that only work in the
right circumstances: "the grasshopper or the cannon can only capture by
skipping ... the grasshopper needs something to hop off of."

## The idea

Par says how short the best win is. It says nothing about whether a level
is any good. So every level the solver checks is now also **measured**, a
few simple **rules** throw out the clearly bad ones, and the lab notebook
keeps the measurements next to your rating. Over time that shows which
numbers go with the levels you rate 5 and which with the ones you rate 1,
and those become the next rules. Rules come from ratings, not guesses.

## What is measured

`assess()` in `play/grove-chess/solve.js`, for a level and the solver's win:

| Measure | What it is | Why it matters |
|---|---|---|
| Moves at the start | how many moves each of your pieces has before anything happens | a piece with none is asleep: a grasshopper with nothing to hop, a cannon with no screen |
| Moves in the win | how often each piece moves in the solver's line | a piece that never moves may be a red herring, or dead weight |
| Makes a catch | whether it makes a capture or sinks the ball in that line | the piece's strength was used |
| Needed | the level re-solved with that piece frozen: is par worse, or is there no win at all? | the piece's job, measured directly |
| Readability | how many times the rabbit hops before it has to be caught, against the length of its pattern | can you see the whole pattern before you need it? The daily's whole mystery rests on this |
| Danger | how many of your pieces can be taken on their first turn; how many the win gives up | how tense the level is |

The lab shows these under "How this level plays" and saves them with each
rating; "Copy the whole notebook" includes them.

## The rules

`unbalanced()` in `solve.js`. In the lab, "Balance rules" under Winning.

- **Off.**
- **On** (the default, and what the daily and the Descent use): every one
  of your pieces can move at the start, and every *strange* piece has a
  job. Strange means a fairy piece, or one of the circumstantial pieces
  (grasshopper, cannon, pawn, mao) whose moves only work in the right
  circumstances. Having a job means it makes a catch in the solver's win,
  or the level is worse without it.
- **Strict**: every piece has a job, classic ones too.

A piece that is not needed is not always a flaw: a red herring is a real
puzzle device. That is why "On" only insists for the strange pieces, where
a dead piece is more likely to feel like a broken promise.

## What it has found so far

Measured 2026-10-06, rabbit-only levels:

- With a **grasshopper** in the hand, most layouts that had the right par
  were thrown out (31 thrown, 3 kept, over six searches): 13 because the
  grasshopper could not move at all, 15 because it had no job, 3 because
  another piece was stuck.
- With a **cannon**, 27 thrown and 4 kept, and 26 of the 27 were the cannon
  having no job. It is the piece that most often runs out the daily's count
  of balance checks.
- **Readability is often short.** At par 3 a rabbit with a four-hop pattern
  is caught before you have seen its whole pattern. On the daily that is
  guessing, not deducing.
- **Par 3 is common.** In version 3 of the daily, 15 boards in 40 fall back
  to par 3. Rabbits that do not eat, and that wait when one of your pieces
  is in the way, make boards easier.

## Next

1. **Rate levels in the lab** with the rules on. The measurements are being
   saved; they need ratings next to them.
2. **Readability as a rule**, probably for the daily first: the rabbit must
   hop at least as many times as its pattern is long, or close to it.
3. **Props for circumstantial pieces.** Instead of only throwing out levels
   where the grasshopper has nothing to hop, place something for it: a
   stump in its line, a piece of yours as a screen for the cannon.
4. **Forgiveness**: how many first moves still lead to a win within par
   plus two. One right first move is a riddle; ten is a sandbox.
5. **The daily's difficulty**, using the levers already listed in
   `grove-chess.md`.

---
name: level-design
description: How Grove Chess builds its boards (Adventure, Adventure Tactics, the daily) from rules rather than by hand, and the level-design principles behind those rules, drawn from Spelunky, Into the Breach, Slay the Spire, Balatro, Dead Cells, Hades and Left 4 Dead. Use whenever adding or changing a kind of enemy, obstacle, suit, weapon or board rule, tuning difficulty or pacing, adding a boss, judging whether boards are fun or fair, or when asked to design or generate levels.
---

# Level design: boards from rules

Timothy, 2026-10-17: "levels should be built based on a set of rules, not be
the same every run. like hades or rogue legacy or balatro ... i want there to
be a way for levels to be generated, you know, without Claude, just like using
like a set of parameters like you would in a rogue like".

So no board is made by hand, by Claude or anyone. A board is made in the
browser from **rules** (tables of numbers and gates), a **seed** and the
**depth**, and a **solver** proves it can be won before anyone sees it. To
change the boards, change the rules; never hand-place a level.

The principles and their sources are in [`research.md`](research.md). The
game-design skill still decides *what* is worth building (which paths a change
moves); this one decides how boards are put together.

## Where the rules live

| What | Where |
|---|---|
| The rules: acts, slots, budgets, rabbit costs and depth gates, sizes, hedges, loops, bosses, when the dark comes | `play/grove-chess/adventure-levels.js` |
| Turning a recipe into level settings (how many of theirs par asks for, spending the budget) | `levelSettings` in `play/grove-chess/modes.js`, Adventure branch |
| Laying the board out from settings and a seed; routes and rabbits | `makeLevel`, `dealRoutes` in `play/grove-chess/lab.js` |
| Vetting: is it winnable, and how short | `searchLayouts` in `lab.js`, `solveLevel` in `solve.js` |
| Dealing again when nothing is won (`relax`) or it comes in short (`press`) | `find` in `play/grove-chess/play/main.js` |
| What the generator makes, depth by depth | `node play/grove-chess/level-report.mjs` |
| What each rule means in play | `docs/adventure-levels.md` |
| What carries between runs: lanterns (by deepest depth), vows, the field guide | `play/grove-chess/adventure-meta.js` |

## The shape of a run

- **Acts of five**: intro, normal, normal, elite, boss. Budget multipliers
  0.75, 1, 1, 1.3, 1.15: a sawtooth, not a ramp. The next act's intro sits
  below the last act's elite.
- **A threat budget** per board, rising 0.6 a depth. Every piece of theirs
  starts as a robot (cost 1) and is bought up into a dearer kind with what is
  left. Sentries and traps weigh most. One always stays a robot so something
  walks, except on the Sentry Wall boss.
- **Depth gates and debuts**: no kind turns up before its depth. On the board
  where it first can (its debut) it is bought first, and only sentries and
  traps stand beside it.
- **Bosses**: the fifth board of each act, one rule from a per-run bag (none
  twice until all have come), said before the board, paying one card more.
- **Par** is Adventure's own (by depth, 5 to 15), and the deal asks for a best
  line two under it, so an eagle is always there.
- **No end**: past the tables the budget keeps rising and the dark comes
  sooner (at par plus 2, then 1, then 0), so a run always ends. Meta
  progression, not an ending, carries a player from run to run.

## When changing the boards

1. **Say the principle.** Which of [`research.md`](research.md)'s principles
   does this serve, and which might it break? Most often: introduce one thing
   at a time (9), telegraph everything (7), headroom against the
   unsolvable cliff (6), kill dead turns (15), sawtooth pacing (12).
2. **Change a table, not a board.** A new rabbit is a row in `RABBIT_RULES`
   (cost, from, weight, max). A new obstacle is a setting plus a row in a
   table. A new boss is an entry in `BOSSES` with an `apply` that changes the
   recipe. Keep each enemy to **one rule** (principle 8): a stronger version
   changes a number, never the behaviour.
3. **Keep the shipped daily still.** A rule that changes how a stored board
   deals or plays goes behind a setting whose default is the old behaviour,
   so `check-daily5.mjs` stays green; future days are dealt again with it on.
4. **Measure, don't guess.** Run `level-report.mjs` before and after, at least
   depths 1 to 20. Look for: deals that fail (`NOT WON`), deal times over a
   few seconds in the middle, depths where every board looks the same, a kind
   that never turns up, best lines far from par minus two.
5. **Play it.** Chromium is in cloud sessions; play the first boards and a
   boss board, at a phone's size. A rule nobody can read on the board is not
   finished.
6. **Write it down** in `docs/adventure-levels.md` and `docs/adventure.md`,
   with Timothy's words where he set the rule, and every call made without him
   marked as such.

## Guardrails

- Every board is won by the solver before it is played. Never ship an
  unsolved board; when nothing is won, deal again with less (`relax`).
- Their behaviour is deterministic from the position, so the solver, a
  replay and a friend's link all see the same board.
- Nothing decays, nags or keeps a streak. A run that ends is not a loss of
  anything kept.
- Meta progression adds options (new pieces, kinds, looks, entries in the
  field guide), not raw power, so the early boards stay worth thinking about.

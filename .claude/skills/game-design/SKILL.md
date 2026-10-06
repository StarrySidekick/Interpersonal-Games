---
name: game-design
description: Timothy's game design philosophy (progression paths, prescribed progression, flow, the player story) as a working method. Use whenever designing, scoping, reviewing or changing a game or game feature in this repo, choosing between features, deciding what to build next, or writing a design doc. Run a path audit before proposing or building, and say which paths every change moves.
---

# Game design: paths and the player story

The philosophy itself is [`docs/design-philosophy.md`](../../../docs/design-philosophy.md).
Read it in full the first time this skill is used in a session; this file is
the method for applying it, not a replacement. Direction (what to build) is
in `INTENT.md`; this decides how to judge it.

## The model, in brief

- **Paths:** mastery, customization/identity, collection, power, social,
  world, narrative, competitive. Each is a progression curve a player moves
  along over time. Together they tell the **player story**.
- **Where a path lives** separates look-alikes: mastery lives in the player,
  power lives in the save.
- **Vertical** progression climbs a ladder; **horizontal** widens the options.
- **Flow:** challenge matched to rising skill. Matters most for mastery.
- **Prescribed progression** (notation): written (weakest), visual, audial.
  Milestones that matter use more than one; touch (haptics) counts on a phone.
- **Narrative** uses elemental genre (wonder, idea, adventure, horror,
  mystery, thriller, humor, relationship, drama, issue, ensemble), and in a
  game the player co-authors it.

## When designing, scoping or reviewing

1. Read `INTENT.md` and the game's own doc in `docs/`.
2. **Pick the paths:** in, out, and why. Out is a decision; missing is a gap.
3. **Audit each path that is in:**

   | Path | Within one play | First week | Third month | Vertical / horizontal | Notated by (W/V/A) |
   |---|---|---|---|---|---|

4. **Find the gaps:** flat rows (the same on day 40 as day 1); rows notated
   only in words; curves that plateau together; paths fighting each other
   (power trivializing mastery); house-rule breaks.
5. **Propose changes.** For each: the paths it moves, the register it adds,
   the cost, the risk. Prefer one change that moves two paths over two that
   move one. Rank them and give a suggested order.
6. Say what is **out on purpose**, so it is not proposed again by accident.

The worked example to imitate is
[`docs/grove-chess-paths.md`](../../../docs/grove-chess-paths.md).

## When building

- Notate every milestone in at least two registers. A result that only
  arrives as text is unfinished.
- Introduce a mechanic alone, then develop it, then combine it.
- Do not let power outrun challenge; scale the challenge to the power.
- Log what the player did from the first commit, so collection, narrative
  and the record can use it later (`docs/scope.md`, rule 5).

## Guardrails specific to this repo

- **Nothing decays, nags, or keeps a streak.** Counts total days played,
  never consecutive ones. No missable collectibles and no numbered holes for
  missed days.
- **Competition stays small** (house rule 4). No ladders.
- **Social is never optional for a game as a whole.** Name the scale (two
  people or an ensemble) and what progresses between the people. One mode
  may leave it out when another carries it (Grove Chess: the daily is
  social, the long game single-player).
- **No server** unless it has been decided. Flag any path that needs shared
  state everyone agrees on.
- **Grove Chess's shipped dealers never change.** Anything that changes
  dealing, the solver, patterns, pieces or rules is a new dealer version with
  a future cutover date (`VERSIONS` in `day.js`), and `check-daily.mjs` must
  stay green. Count that cost in any proposal that touches the daily.
- **The categories are Timothy's.** Do not rename, merge or add paths in
  `docs/design-philosophy.md` on your own; put proposals under its "Open"
  section and ask.

# Grove Chess modes: every mode is a collection of settings

Timothy, 2026-10-08: "a mode is a collection of settings. this means every
aspect of a mode should be composed of settings. with this in mind we can
make some new modes easily."

## How it is built

- **Two layers of settings, one flat set.** Run settings (`RUN_SCHEMA` in
  `modes.js`): what a session is (one level, a descent, a golf course,
  autochess rounds), how each level is chosen (from the settings, rolled
  like Chaos, rolled like the daily), the hand you start with and can
  carry, rewards, jokers, how fast it gets harder, what running out of
  moves does, the course's holes and balls, lives. Level settings
  (`SCHEMA` in `lab.js`): everything one level is made of, as before.
  The two layers share no keys (a check found `holes` in both once, and it
  was renamed `courseHoles`).
- **A mode is a preset** (`MODES` in `modes.js`): a name, a line, and the
  settings it changes from the defaults. Daily, Descent, Chaos, Golf and
  Autochess are presets; a new mode is a new entry.
- **One runner** (`play/?mode=...`) plays every mode but the shared daily,
  and **one settings panel** (`form.js`, also used by the workshop) shows
  every setting of the mode. Changes are kept per mode on the phone
  (`ig.grove.modes.v1`), with "Back to the mode's own".
- `levelSettings(mode, where)` turns a mode, and where a run has got to
  (depth, hole, round, the hand), into one level's settings; the solver
  then finds a layout that is winnable, balanced, and as hard as asked.
- **Global piece settings** live in the catalog (`docs/grove-pieces.md`):
  vetoes apply to every mode. Individual pieces are toggled per mode in
  the panel (the pools you are dealt from, theirs, and what a run can
  find).
- The old lab is now **the workshop**: one level, every setting, the
  notebook of ratings. "Play as a descent" runs its settings in the
  runner as a test that keeps nothing.

## The modes

**The daily.** One board a day, the same for everyone. Its own page and
dealer (`day.js`), because it must be the same on every phone. Its
settings in the runner (`?mode=daily`) make practice boards the same way:
any rules at all, as long as the level is balanced and has a high skill
ceiling (easy to win in many moves, hard in few; the "Skill ceiling, at
least" setting). From 2026-10-09 the daily itself is made that way, ahead
of time, with a name and a light theme (`docs/grove-chess.md`, version 4).

**The descent.** A roguelite. Four pieces, dealt from "You start with".
Each level: take every piece of theirs. Finishing finds you a piece (a
classic and a fairy one of about the same strength) until you carry six;
then upgrades (`run.js`):

| Upgrade | What it does | Name |
|---|---|---|
| ♥ Hearts | a second life: the first capture costs the heart, and the attacker bounces off | Knight of Hearts |
| ♠ Swords | one more step in any direction (Betza `+K`) | Knight of Swords (the old centaur) |
| ★ Stars | its leaps keep going (a knight becomes a nightrider); a slider gains a knight's jump | Knight of Stars |
| ♦ Diamonds | only a piece at least as strong can take it | Bishop of Diamonds |
| @ Spirals | its leaps curl on round a circle, the rose's way (Betza `q`); a piece with no leaps gains the rose's whole move | Knight of Spirals (moves as a rose), Rook of Spirals (rook and rose) |
| Fuse | two pieces become one with both move sets; it frees a slot | rook + knight = Chancellor, bishop + knight = Archbishop, rook + bishop = Queen |
| Promotion | a piece becomes the next piece up in strength | |
| Jokers | rules for the rest of the run: Double Time (two moves to their one), Foresight (see where every rabbit goes next), Recruiter (your first catch each level joins you), Lazy Rabbits (they move every other turn), Overtime (five more moves) | |

Hearts was Timothy's; **swords, stars, diamonds and spirals are
proposals** (he named them, not what they do). Spirals came from history:
the rose is the fairy piece whose knight jumps curl round a circle, so a
spiral suit makes a piece's leaps do the same. The strength estimate now
counts circling squares between a slide and a leap, since each can be
blocked on the way round (the rose comes out at its known 5.5). A suit shows as the plinth's colour. A
piece taken is gone for good. Running out of moves falls on with nothing
found ("Out of moves" can end the run instead). The descent ends when every
piece is gone. Each level down: more pieces of theirs, sharper rabbits,
bigger boards, stranger ground, as fast as "It gets harder" says. No hole,
no ball: those are golf's now.

**Chaos.** One level from a completely random mix of every rule and
setting. The only rules: it is winnable, balanced, and as hard as the
Difficulty setting asks (measured, `metrics.js`).

**Golf.** A course of holes (nine by default). Each hole has its own ball,
in turn, from the six (ice, putting, billiard, hit by the pieces, and two
made for golf: sticky, which stops beside the first thing it passes, and
ghost, which rolls through pieces). As the course goes round: statues to
bank off, a moving hole, magic edges, a board that turns, a loose rabbit
or two in the way. A scorecard at the end, strokes against par, with the
golf words. A hole not sunk in time counts the limit and two, as if picked
up.

**Autochess.** Rounds. Put rabbits (patterns or minds) in your pieces and
let them fight; win a round to find a piece or an upgrade, lose one and it
costs a life (three by default). The chip says how forgiving a round is:
the share of setups the solver tried that win.

## Path audit

The method is `.claude/skills/game-design/` (Timothy's design philosophy).
Paths in: mastery, collection, power, customization, social (the daily).

| Path | Within one play | First week | Third month | Vertical / horizontal | Notated by |
|---|---|---|---|---|---|
| Mastery | reading rabbits' minds; par; difficulty shown on every level | harder bands in Chaos; deeper descents | brutal Chaos, daily birdies | vertical | written (par, difficulty), visual (moves, captures), audial (fanfare by score) |
| Power (the descent) | your hand grows, suits, fusing | first jokers, first fused piece | build-craft: which suits on which pieces | vertical within a run, reset each run | visual (plinth colours, new pieces), written (names: Knight of Hearts) |
| Collection | rabbits caught, by kind and trait | trait colours learned | a full collection fills autochess | horizontal | visual (fur colours), written |
| Customization | settings per mode | invented pieces, vetoes | Timothy's own modes from the settings | horizontal | written (panel), visual (the catalog) |
| Social | the daily | | | | (unchanged here) |

The named daily (version 4) moves three paths. Mastery: every board is
chosen for a high skill ceiling, so par is far below where a first win
lands, and the ending says how a novice bot did beside your score
(written, plus the golf word's colour and fanfare). Social: the vine and
the share text now carry the board's name, a thing to talk about ("did
you get The Unwilling Mitten under par?"). World: a name and a theme
each day, light on purpose (written and visual), with no lore behind
them yet; if the names are liked, a world could grow from them.

Gaps: power resets with every run, so nothing carries between descents
except the record and the rabbits; the long game
(`grove-long-game.md`) is where something should. Golf's progression is
only the scorecard. Autochess has no shop yet (rewards stand in for it).

## Out on purpose

- No currency or shop in the descent: rewards are chosen, not bought.
- No streaks or daily login rewards (house rule).
- The flat board (`?flat`) does not show everything new (turning boards,
  suit colours are 3D only).

## Next

- Make more named dailies before the stored ones run out (they go to the
  end of 2026; after that a date falls back to version 3).
- Calibrate difficulty and engagement against the workshop notebook's
  ratings.
- An autochess shop, and golf courses with their own character.

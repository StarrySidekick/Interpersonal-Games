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

## Kings, and the showdown (2026-10-09)

Timothy: "stalemates happen, and maybe something should change when there
are only two pieces left on the board... the default mode should be just
capture one thing instead of all pieces... you also need to be protecting
something as well, like the king in chess. let make each side have a king."

- **Each side has a King.** The level defaults are now "Take their King"
  (`goal: 'king'`) and "Your King is royal" (`royal`: lose it, lose the
  level), with "Always dealt a King" (`dealKing`) making sure yours is
  there. The Descent, Chaos (which rolls everything but how you win) and
  the workshop use them. The Daily, Golf and Autochess keep their old
  goals on purpose.
- **In the Descent** your King is dealt first, cannot be fused, promoted
  or swapped away on the title, and if it is taken the descent is over.
- **The showdown** (`showdown`, "Two left: the board closes in"): once one
  piece of yours and one of theirs are all that is left, the edge falls
  away every move, round and inward (the shrinking ground's spiral). A
  square with a piece on it never falls, so the board closes in round the
  two until one can reach the other. It is announced in words, a buzz, a
  sound and a chip.
- Settings are version 8. Links and stored boards from version 7 and
  before read these three as off, so every old board lays out as it did
  (`check-daily.mjs` passes: the rules object only carries `showdown`
  when it is on).

## How difficulty is measured, and how the descent climbs (2026-10-09)

**The measure** (`metrics.js`). A novice bot plays a level 24 times: it
takes a win it can see, usually grabs a capture, and otherwise picks
among its three best-looking moves with some luck. Difficulty 1 to 10 is
65% how often it loses, 35% how long the expert's shortest win (par) is
against the move limit. Skill ceiling is how many times longer the novice
takes than par. The tester (`searchLayouts` in `lab.js`) deals layout
after layout and keeps the first that is winnable, balanced and inside the
difficulty asked for (a band, or `aim`: within one of a number); if none
passes in time it keeps the nearest miss.

**Pieces can always take pieces** (Timothy, 2026-10-09: "as a rule
pieces should always be able to capture other pieces by default, so
difficulty needs to be based on the idea that there is no situation where
pieces literally cannot or refuse to capture"). Chaos and the daily
practice never roll "They can take your pieces" off, future stored
dailies are made with it on, and in a mode's panel it is not offered (the
workshop keeps it, for experiments). A rabbit mind still chooses: a Shy
one may pass up a capture to stay safe, as personality, not inability.

**What makes a level hard** was measured, depth 1 of the descent, six
layouts each: the novice mostly loses by giving up its royal King, so
captures are most of difficulty. With captures always on, the floor is
difficulty 2 (the novice wins about 80 to 90%): difficulty 1 needs about
95%, which only came from switching their captures off, and that is no
longer allowed. What still makes a start easy is clumsy rabbits: with the
first levels' minds Messy rather than Aggressive, six layouts of six
measured 2. Fewer enemies or duller rabbits barely moved it.

**The descent climbs by difficulty.** "First level's difficulty" (1 by
default, so the first level aims at 1 to 2 and lands on 2) is what depth
1 aims at; each level after aims higher by the "It gets harder" step
(gently 0.35, steadily 0.6, steeply 1). The board stays 6 by 6 ("The
board grows", off). More enemies, sharper rabbits, stronger pieces and
longer pars still climb, more slowly, so boards near the aim turn up
often enough. Depth 8 is the soft spot (it aims at 5, and measured 5 to
7) and is worth tuning against play. Later, roguelite unlocks could skip
the easy start.

**The daily** already sits just above the descent's start: its maker
keeps a board only at difficulty 3 to 6, with a novice winning at least
half its games and a high skill ceiling (approachable, hard to do
perfectly). The practice daily aims at 4. Stored dailies are unchanged.

**Balance with the King.** When one capture wins, most pieces never catch
anything, so a piece also has a job if it moves in the winning line
(`unbalanced`, opt-in `oneCapture`, so the shipped daily dealers judge as
they did).

## Where pieces start (2026-10-09)

Timothy: "pieces should start on the first row by default." Lined up (the
default) they always did in the descent; scattered, "Start within the
top/bottom" now defaults to 1 row each (settings version 9; older links
and stored dailies keep 3 and 2). Chaos and the daily practice used to
re-roll where pieces start (lined up or not, 1 to 3 rows, who moves
first), ignoring the panel; they now keep the mode's. A piece still starts
off the first row only when it cannot be there: a shaped board whose top
row has fewer squares than there are pieces (a diamond's has two), all
four edges joined (the top row then touches yours, so their line starts
halfway, or every level would open with captures), or Mirror.

## Piece power in context (2026-10-09)

`power.js` measures each piece by its own move code on the board it plays
on (6 by 6), from 240 spots among a level's worth of pieces: reach
(squares it can move to) and threat (pieces of theirs it could take).
Power is reach plus four times threat, scaled so the queen is 9. The
catalog sorts and shows it; the descent's offers and the shop's prices use
it. On 6 by 6 the king (4.5) is worth more than a bishop (3.5) or a
knight (3.25). **Pieces that cannot take without something to hop over**
(cannon, grasshopper) are off by default, as catalog vetoes applied once:
the cannon moves well but threatens 0.17 pieces on average, like a zebra.

## More suits, claiming, and settings per mode (2026-10-09)

- **✧ Spirits**: passes through pieces, statues and stumps as if they were
  not there, and lands as usual (`pieceMoves` in `rules.js`).
- **Promotion is gone**, because "the next piece up" was often no upgrade
  (a rook to a cannon). In its place, **claiming**: every piece of theirs
  you take on a level is claimed, and after the level you may combine
  one with a piece of yours. The same kind makes a veteran (a heart more,
  up to three lives); another kind fuses (their rook on your knight is a
  chancellor); a royal King only takes its own kind. A proposal: what a
  combination gives is open.
- **Settings per mode**: each mode's panel shows only what that mode uses
  (no autochess or golf settings in the descent), and a setting shows only
  when another makes it matter (`settingShown` in `modes.js`). In the
  descent, settings that climb say "(first level, then climbs)".
- **The board is built in a spiral**: the middle square drops in and
  slams, then the rest follow it round and out (`assemble` in
  `board3d.js`). **The floor goes the same way**, the middle first, each
  square falling down and away, statues with them (`collapse`).

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
| ♠ Swords | cleave: after it takes a piece it may take again, the same turn, as long as a capture is open | Rook of Swords |
| ★ Stars | moves twice: once a level, its first move is followed straight away by a second | Knight of Stars |
| ♦ Diamonds | treasure: each piece it takes adds a reward pick when the level is done (two extra at most) | Bishop of Diamonds |
| @ Spirals | swap: as its move, it trades squares with any other piece of yours | Knight of Spirals |
| Fuse | two pieces become one with both move sets; it frees a slot | rook + knight = Chancellor, bishop + knight = Archbishop, rook + bishop = Queen |
| Promotion | a piece becomes the next piece up in strength | |
| Jokers | rules for the rest of the run: Double Time (two moves to their one), Foresight (see where every rabbit goes next), Recruiter (your first catch each level joins you), Lazy Rabbits (they move every other turn), Overtime (five more moves) | |

**Every suit is Timothy's** (2026-10-08: he chose cleave, moves twice,
treasure and swap over the first proposals, which rewrote a piece's Betza
or made it hard to take). A suit is now a rule the piece carries, not a
change to its moves, so a Knight of Stars is still a knight. In
`rules.js`, Swords and Stars leave the turn open (`s.bonus`): only that
piece may move, waiting ends the turn, and the rabbits do not reply and
the clock does not tick until it closes. Par counts moves on the clock,
not plies, so a bonus move is free (`solve.js`). Spirals adds swap moves
to `movesFor`; Diamonds counts `s.treasure`. A stronger hand makes the
tester throw out more layouts ("the Wazir had no job"); the runner falls
back on the best it saw. A suit shows as the plinth's colour. A
piece taken is gone for good. Running out of moves falls on with nothing
found ("Out of moves" can end the run instead). The descent ends when every
piece is gone. Each level down: more pieces of theirs, sharper rabbits,
bigger boards, stranger ground, as fast as "It gets harder" says. No hole,
no ball: those are golf's now.

**What carries between descents** (setting "What you find carries over",
on by default). Every piece a descent finds joins **the roster**
(`ig.grove.roster.v1`): tap a piece of the dealt hand on the title to swap
it for any piece on it. **Waystones** are lit for good by the deepest
depth reached, shown on the title as lit or not, and announced with a
fanfare and a buzz on the way down when one lights (`WAYSTONES` in
`run.js`):

| Depth | Waystone | Every later descent |
|---|---|---|
| 4 | A keepsake | starts with an upgrade of your choice (a suit, a promotion or a joker) |
| 7 | Another piece | starts with one more piece |
| 10 | A second keepsake | starts with two upgrades |

Going deeper is the only way to light one: no experience, no grinding.

**Chaos.** One level from a completely random mix of every rule and
setting. The only rules: it is winnable, balanced, and as hard as the
Difficulty setting asks (measured, `metrics.js`).

**Golf.** Five **courses**, each a place with its own balls, ground and
turns (`COURSES` in `modes.js`), chosen on the title. Finishing a course,
at any score, opens the next; each keeps its own best.

| Course | Holes | Balls | Its character |
|---|---|---|---|
| The Meadow | 6 | putt, sticky | open grass, a statue or two, an L late on |
| The Frozen Pond | 9 | ice, sticky | round ponds; the sides join from hole 3 |
| The Billiard Hall | 9 | billiard, hit | many statues to bank off; the hole wanders late |
| The Clockwork Links | 9 | putt, billiard, ice | the board turns; the hole wanders; edges join late |
| The Haunted Hollow | 9 | ghost, sticky | rabbits on the fairways, crumbling ground, odd shapes |

"Mixed" in the settings is the old course: a course of holes (nine by
default). Each hole has its own ball,
in turn, from the six (ice, putting, billiard, hit by the pieces, and two
made for golf: sticky, which stops beside the first thing it passes, and
ghost, which rolls through pieces). As the course goes round: statues to
bank off, a moving hole, magic edges, a board that turns, a loose rabbit
or two in the way. A scorecard at the end, strokes against par, with the
golf words. A hole not sunk in time counts the limit and two, as if picked
up.

**Autochess.** Rounds. Put rabbits (patterns or minds) in your pieces and
let them fight; lose a round and it costs a life (three by default).
**The shop** (setting "Spend acorns in a shop", on for autochess): a round
earns acorns, three for a win, one for a loss and one more per piece of
theirs taken, spent between rounds on pieces (priced by strength), suits
(4), fusing (3), promotions (4) and, if allowed, jokers (5). New stock
costs one acorn; what is not spent is kept for later rounds. With the shop
off, a won round finds a piece or an upgrade as before. The chip says how forgiving a round is:
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

2026-10-08, second pass. Power: the roster and waystones carry between
descents, so the power path climbs across runs as well as within one
(vertical: waystones; horizontal: the roster), notated visually (lit
stones, the hand), in writing and audibly (the fanfare when one lights).
Suits now change the turn rather than the move set, which adds choices
(take again or stop, which piece swaps) without trivialising the solver's
par. World: golf has five named places, opened in order. Mastery: a best
per course. Autochess: acorns turn every round, lost ones too, into a
choice.

Gaps: the roster and waystones are per phone, like everything else. Golf's
courses are named but have no look of their own yet (the board is the same
green). The long game (`grove-long-game.md`) is still unbuilt.

## Out on purpose

- No currency or shop in the descent: rewards are chosen, not bought.
  (Autochess has one; the descent stays chosen.)
- No experience points for waystones: only reaching a new depth lights one.
- No streaks or daily login rewards (house rule).
- The flat board (`?flat`) does not show everything new (turning boards,
  suit colours are 3D only).

## Next

- Make more named dailies before the stored ones run out (they go to the
  end of 2026; after that a date falls back to version 3).
- Calibrate difficulty and engagement against the workshop notebook's
  ratings.
- Give each golf course its own look (board colours, a sound).
- Watch how often a suited hand makes the tester settle for its best
  layout, and tune the ramp if it is often.

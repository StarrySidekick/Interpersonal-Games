# Grove Chess modes: every mode is a collection of settings

Timothy, 2026-10-08: "a mode is a collection of settings. this means every
aspect of a mode should be composed of settings. with this in mind we can
make some new modes easily."

## How it is built

- **Eight parts.** Every setting belongs to one of the eight parts of a
  mode (`PARTS` in `lab.js`, 2026-10-13; see "The eight parts of a mode"
  below), and every settings panel is grouped by them.
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

## They move one piece a turn (2026-10-09)

Timothy: "the opposing team should only be able to move one piece a turn
like we can." A side that thinks always made one move; a side moved by
rabbits (minds or patterns) moved every piece every turn. Now
(`oneMove`, "They move one piece a turn", on; settings version 10, so old
links and the shipped dailies keep the old rule): if one of their pieces
would take one of yours this turn, that one moves; otherwise their pieces
take turns, in order (`oneFoeActs` in `rules.js`). Loose rabbits are not
their side and still hop every turn; autochess keeps every piece moving,
since yours do too. Measured after: the descent's climb tracks its aim
better than before (depth 8 measured 4 to 6, aiming at 5; it was 5 to 7).

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

## A batch from Timothy (2026-10-10)

Each note, and what became of it. Settings are version 11: links and
stored boards from version 10 and before read the new settings as they
were (waiting on, their pieces free to stay put, no layout step), and
`check-daily.mjs` passes.

- **"Decent mode should give no upgrade when starting."** New run setting
  "Waystones give upgrades at the start" (`keepsakes`), off. The depth 4
  and 10 waystones still light, and say on the title that their upgrade is
  off in the settings. The depth 7 waystone (one more piece) is unchanged.
- **"The beginning of the descent should not really have any fairy
  pieces in it, including on the enemy side."** New run setting "Fairy
  pieces from depth" (`fairyFrom`), 4. Above it their pool keeps only
  classic pieces (`classicUntil` in `modes.js`; the descent now starts
  from king, pawn, knight and bishop, where it had wazir and ferz), and
  what you find is two classic pieces (never a second King, which with a
  royal King would be a second way to lose). From that depth on, the
  wazir and ferz join their pool and finds are a classic and a fairy piece
  as before.
- **"If there's a new piece on the enemy side, it should also be
  explained in the intro."** The opening now has a card for each kind of
  theirs the first time it turns up, with the same demonstration as
  yours, in their colour. A piece that moves the same for either side
  shares one card (seeing your King, you are not shown theirs); one with a
  forward (pawn, lance, the generals) has its own, moving down the board.
- **"Nobody, including enemies, should be able to wait."** "Waiting
  allowed" is off by default, and the "Wait a turn" button only shows when
  it is allowed, when a suit left the turn open ("End turn"), or when
  nothing can move ("Pass"). Their side: new setting "They may stay put"
  (`foesWait`), off, which puts `foesMust` in the rules. With it, when
  they move one piece a turn, the one whose turn it is moves even if its
  rabbit would rather stay (a pause in a pattern, or no move its way: it
  takes the move nearest where the rabbit pointed); if it has no move at
  all, the next in order goes. Chaos still draws the dice for waiting, so
  its other rolls are unchanged, but no longer lets you wait.
- **The brown borders were too thick, and framed each square while
  falling.** The rim is 1.2 tenths of a square, was 3 (`LOOK.rimWidth` in
  `config.js`), and squares that are dropping in, falling or crumbling
  have no rim of their own: the board assembles and collapses as bare
  squares. Still, a shaped board keeps its outline.
- **"Statues should be a unique model."** A standing stone with a spiral
  cut in its face, moss at its foot, no plinth (it is not a piece), in
  three shapes (`statue` in `models.js`).
- **"Lay out your pieces when you start, in the first two rows."** New
  level setting "Lay out your pieces first" (`arrange`), on (not in
  autochess, which has its own setup). After the opening: tap a piece,
  then a lit square in your first two rows, or another of yours to swap.
  A square is lit only if nothing on either side could take on its first
  move, the same balance rule the dealt layout keeps, so you cannot set up
  a first-move win. If anything moved, par is worked out again for your
  layout (one and a half seconds at most; if the solver runs out, the
  level plays without a par).
- **More fairy pieces, smaller and stranger, with their real records, to
  be rethemed.** Thirteen new pieces and the settings console: both in
  `docs/grove-pieces.md`.

**Second batch, the same day.** Settings version 12 (older links and
stored boards keep the old behaviour):

- **"Every piece's movement pattern shows on the board"**, for people new
  to chess. "Show where every piece can go" (`showReach`), on: every
  square a piece of yours could go to glows yellow, every square one of
  theirs could go to a faint dark purple (both, if both), redrawn as
  pieces move (`reachMaps` in `rules.js`; colours `LOOK.reachYou` and
  `LOOK.reachFoe`). The 3D board shows it unless a level turns it off, so
  the shared daily shows it too; the flat board only when the runner asks.
  A selected piece's own squares still light up brighter on top.
  On 2026-10-11 the glow became rings: "kind of hard to tell what's
  happening ... maybe it's like an outline around the cell instead of
  coloring it." Each square a piece of theirs can reach gets a purple ring
  near its edge, each one yours can reach a gold ring inside that, so a
  square both reach shows both, and a piece of yours under attack stands
  in a purple ring. Each ring has a thin dark edge, to read on light and
  green squares alike (`marks` in `board3d.js`).
- **"Default amount of pieces ... equal to how wide the board is."** "A
  full row each" (`fullRow`), on: each side starts with as many pieces as
  the board is wide (six on six by six, eight at most). The descent now
  starts with six (its King among them, no second King) and carries up to
  eight. Chaos, golf and autochess keep their own counts.
- **A cloud on the second row, first turn**, since no pawns stand in front
  of the King. "A cloud on the second rows, first turn" (`cloud`), on: the
  row just in front of each side's pieces (`day.cloud`). Until both sides
  have moved once, a piece may step into the cloud but nothing goes
  through it, and nothing in it can be taken. First built as a wall,
  which left only knights able to move on turn one (the tester said so:
  "the Rook could not move at the start"); stepping in fixed that. Shown
  as low white puffs that blow away when it lifts, with an intro card the
  first time. Checked: 603 first moves on early descent boards, no
  capture by either side. On very narrow shapes deep in a descent the two
  sides can touch through it; the tester's own rule (no capture on a first
  move) still throws those layouts out.
- **The cloud, corrected (2026-10-11, settings version 13).** Timothy:
  "the clouds are to prevent opposing pieces from captures in the first
  turn, not stopping your own pieces from moving past their own second
  row ... pieces can move past their own cloud rows but just not past
  their opponents." So each side's cloud now stops only the other side
  ("Each cloud stops only the other side", `cloudOwn`; `cloudFor` in
  `rules.js`). Yours is the row in front of your pieces: you go through
  it freely, theirs cannot pass it or take anything in it; the same the
  other way round. Checked on 80 early descent boards (1,640 first
  moves): you never capture on your first move, nobody gets past the
  other side's cloud, and their first reply only ever takes a piece you
  just moved out past your own cloud into open ground, never one still
  behind it. The daily of 2026-10-11 keeps the first version (it was
  live); 2026-10-12 to 17 were made again with this one.
- **"Organize pieces only after your default set changes."** Laying out
  your pieces now opens only once your hand differs from the one you were
  dealt (a piece found, lost, swapped on the title, suited or fused), so a
  descent starts with its full row as dealt.
- **The daily.** The share link's piece digit now runs 0 to 9 (it was 0
  to 3, which is why the daily gave you four pieces at most). Stored daily
  boards from 2026-10-11 on were made again with a full row each (the
  shipped ones, 2026-10-09 and 10, are unchanged; nobody had seen the
  later ones). Timothy, the same day: "don't worry about storing future
  boards at the moment, outside of let's say like a week." So boards are
  stored to 2026-10-17 only; a later date falls back to dealer version 3
  (no full row) until more are made with `make-daily.mjs` (about 20
  seconds a board). With any rules at all almost no roll passed the
  daily's bar, so full-row dailies are held closer to chess: a rectangle
  five or six wide and six tall, take their King, hands mostly classic
  (up to two fairy kinds yours, one theirs), par from 3 rather than 4.
  The rest of the bar is as before (`make-daily.mjs`).
- **A bug found on the way.** `decodeLevel` (links, stored dailies, the
  runner's test hash) kept its own list of settings versions, which
  stopped at 10, so settings saved at 11 were read as version 1. Both
  places now ask one function (`knownVersion` in `lab.js`). Links made in
  the hours version 11 was live may have opened with old defaults; nothing
  stored was affected (the shipped dailies are versions 10 and before).

**Seeing the board (2026-10-11).** Timothy: "i like the purple outline
for dangerous cells to move to, its great. i want to be able to toggle off
your yellow highlighted spots ... off by default." Two settings now: "Show
where theirs can go" (on) and "Show where yours can go" (`showMyReach`,
off). And: "when a piece is defending another piece ... the defended piece
should get a cool shield on it and a sound effect when a piece moves into
a position where it can guard it." "Shields on guarded pieces"
(`showGuards`, on): a piece of yours that another of yours could avenge
(if theirs took it there, yours could take back on that square;
`guarded` in `rules.js`) wears a silver shield with a gold cross across
its front. When a piece becomes guarded its shield drops in from above,
bounces once, and clinks (`sfx.shield`), with a tap of the phone. Kings
are left out (losing one ends the game). Settings version 14; older
links keep their old look.

**Gold shields and beacons (2026-10-11).** Timothy: "if a piece is
defended by more than one piece, it gets a gold shield, if it's just
defended by one, it's a silver shield. ... a purple minecraft beacon like
thing to come from pieces that could be taken on the next enemy turn if
not moved. similarly a green beacon on enemy pieces that could be taken by
you on your turn."

- `guarded` now counts: one guard is a silver shield (silver with a steel
  rim), two or more a gold one. A shield turning gold drops in again, and
  its clink rings on a note higher.
- "Beacons on what can be taken" (`showBeacons`, on; settings version 15):
  `threats` in `rules.js` finds your pieces one of theirs could take on
  its next move if you left them (purple; on your King, that is check)
  and their pieces you can take now (green). Each gets a pool of light on
  the ground under it and a beam rising from its head about two squares,
  a bright core in a see-through beam, fading out. A new one rises when
  the move lands. Colours are `beaconYou` and `beaconFoe` in the look.
- Tried and changed: a beam six squares tall crossed the pieces behind
  and seemed to light them; added light (the 'lighter' blend) tinted the
  colours, purple going pink over your pieces.
- Cost: under a millisecond a frame on a full 8 × 8 board, so Kung fu,
  which redraws every frame, still runs at 60.

Paths moved: mastery. Chess's hardest early skill is seeing what hangs:
what you leave loose and what they leave loose. The beacons show both
before you move, and the shields show which of your pieces are safe to
leave and how safe. Notated: visual (silver, gold, purple, green), audial
(the clink and the higher ring for gold), touch (the tap).

**Rings as the move set (2026-10-12).** Timothy: "we need to see the
highlights as to where enemy pieces could move, even if it's underneath
another enemy piece. it's just like their move set maps onto the board ...
instead of the actual movability within that turn." The rings had shown
each piece's legal moves this turn, and a piece cannot move onto its own
side, so a square under one of theirs never lit, even when another of
theirs would take back there. Now (`reachMaps(s, true)`, `patternReach` in
`rules.js`) the rings also take in:

- squares their own side stands on that a piece's moves cover (a rook's
  file up to and including the first piece in the way): the pieces it
  guards;
- empty squares a piece could only take on: a pawn's forward diagonals,
  and the squares beyond a cannon's or vao's screen.

Things in the way still stop a slider, so a square behind a blocker stays
dark, and a side that cannot take gets nothing extra. Your gold rings, when
on, work the same way. Kung fu's thinking side still reads the old map
(moves this turn), so its play is unchanged.

Paths moved: mastery (the rings now say where taking back would happen,
not only where they can step). Notated: visual.

**Phone fixes (2026-10-11).** Double-tap zoom is off on every page
(`touch-action: manipulation` on the page, in `engine/app.css`): Safari
zoomed when menus and buttons were tapped twice. Pinch zoom still works.
Every number setting has a box to type into between its − and + (`form.js`),
kept in range when you finish; the box's text is 17 pixels, since iPhone
Safari zooms in on any text field smaller than 16 when you tap it.

**The settings console.** An artifact,
[Grove Chess Console](https://claude.ai/artifact/QDAPuPSH368u2TroPQ2QCf):
every piece (record, name, words, in or out, notes), every mode's settings
at its preset, and the look. What Timothy changes is saved in the
artifact's database (`console/changes`). To push it: ask Claude to
"apply the Grove Chess Console"; Claude reads that document and writes
`play/grove-chess/config.js`, which the game reads at load (names and
words in `rules.js`, presets in `modes.js`, off and on in the catalog,
colours and the rim in `board.js`, `board3d.js` and `models.js`). The
console's own source is `tools/settings-console/` (rebuild it after the
game changes: `console-data.mjs`, `sprites.mjs`, `build.mjs`).

Paths moved: mastery (a gentler, readable start: classic pieces first,
their pieces explained, no waiting to stall with; the layout step adds a
decision before move one), customization (the layout, and Timothy's own
customization of the whole game through the console), collection
(thirteen more pieces to find past depth 4). Notated: the intro cards
(visual, written), the lit squares while laying out (visual), the drop
sound and buzz on a placed piece (audial, touch).

## The descent, rebuilt small (2026-10-12)

Timothy: "decent starts with a 5x5 board ... one rabbit piece is on each
level to start ... the middle row is filled with the statue things, and
every round one randomly disappears to open up the spot ... 5 pieces per
side plus a rabbit on the enemy side ... you no longer use captured pieces
to upgrade yours right now. every new board you move to each side gets one
random upgrade of two to choose from, whether it's a new piece to combine
with your existing lineup or a new suit to apply to a piece, no more level
4-7-11 special upgrades ... after level 5 we move to a 7x7 board." And:
"the beacon that appears on pieces should be behind them in the layer
order on their head, not in front."

What it became (the descent's preset in `modes.js`; Kung fu descent is
unchanged):

- **Five by five, five a side.** Your King and four dealt from "You start
  with"; their King and four from their pool. **They carry a lineup too**
  (`run.foes` in `run.js`, sent to a level as `foeHand` and `foeMods`,
  which `makeLevel` lines up on the far row as it does your `hand`). Their
  lineup comes back whole every board; yours does not (a piece taken is
  still gone for good).
- **A Rabbit with theirs**, every board, on the row in front of their line
  (the `bunny` piece: two hops, never takes, rides heads).
- **A row of statues that opens** (level setting `statueRow`): the whole
  middle row is statues, and after every turn one of them, in an order the
  level draws at random, sinks away (`s.open` in `rules.js`, `statueAt`;
  the rule is `statuesOpen`). On five by five the row is clear after five
  turns. Notated three ways: the statue shrinks into the ground (visual), a
  low grind of stone (`sfx.shrink`, audial), "A statue sinks away."
  (written). The pieces sheet and a tap on a statue say how the row works.
- **One upgrade a board, each side** (run setting `upgrades: 'each'`). On
  every new board, won or out of moves: they get one at random, said
  before you choose ("Their side: their Bishop takes Hearts"), then you
  choose one of two cards (`boardCards`). A card is a piece or a suit:
  - a piece combines with one of yours, as claiming did: the same kind
    makes a veteran with a heart more, another kind fuses into one with
    every move of both. While your row has a gap (a piece lost), it can
    take the gap instead. Fusions that would change nothing (a mao onto a
    knight) are never offered, to either side.
  - a suit goes on a piece without one, any of the six.
  - Their upgrades: a fused piece, a veteran, or a suit, never on their
    King. **Only Hearts and Spirits for them** (`FOE_SUITS`): the other
    suits are rules for a turn of choices (cleave, a second move, a swap,
    treasure), and their pieces are moved by rabbits. Hearts on a piece of
    theirs is new in `rules.js`: your first capture costs it the heart and
    your piece bounces off ("Their Bishop lost a heart"). A suited piece
    of theirs wears the suit's colour on its plinth, as yours do.
  - Gone from this mode, on purpose: claiming and combining what you took,
    jokers, the find-a-piece-then-upgrades ladder, and the waystones at
    depths 4, 7 and 10 with the roster ("What you find carries over" is
    off). All still exist as settings; Kung fu descent keeps them.
- **Seven by seven from depth 6** (run setting `growAt`). The board opens,
  and each side gets two more pieces to fill its row: two different ones of
  knight, bishop and rook for you, two from their pool for them. Notated in
  writing, with a fanfare and a buzz. Measuring a seven by seven layout
  takes seconds, so the search settles after six (`find` in
  `play/main.js`) for the best it saw.
- Fairy pieces still wait for depth 4 ("Fairy pieces from depth").

**The beam behind the piece.** The beacon's beam is still drawn after the
pieces, but every pixel where the renderer drew that piece, or one
standing nearer you, is cut out of it (the renderer keeps which object
each pixel belongs to, `t3.id`). So it rises out from behind the head and
still crosses in front of pieces further back.

**A bug found on the way.** `unionBetza` (fusing) wrote terms one after
another, and a bare atom after a term ending in the same letter merged with
it: a pawn and a ferz came out as "mfWcfFF", a capture-only ferz rider, and
the ferz's quiet diagonal steps were lost. Bare atoms are now written first.

Paths moved: power (one choice a board instead of a ladder of rewards, and
now a climb on their side too: their lineup grows as yours does, so power
is matched by challenge rather than outrunning it), mastery (a small,
readable first board; the statue row makes the opening a question of
timing: which square opens next). Collection across descents is off for
now with the roster. Gaps: a fused piece of theirs looks like the piece it
started as (yours do too); a Hearts plinth on their side is a red close to
some rabbit traits' glow.

## The descent, second pass: one rabbit leads them (2026-10-13)

Timothy: "no setting up piece placement by default in decent; no clouds
anymore by default in decent; no losing pieces permanently in decent; the
default pieces setup for decent should be like micro chess but on a 5x5
board and no pawn; because of this the calculation for balancing and stuff
for the level shouldn't need to happen every level ... enemy pieces should
be able to receive all the different suits ... the rabbit should move every
turn and be the color of its type of rabbit, and not a piece base on the
model. it should start on enemy king ... the rabbit inhabiting each piece is
no longer a thing in decent or daily and its just that one rabbit and their
type/personality that defines the enemy team in difficulty and style."

What it became:

- **Microchess's pieces, no pawn.** Rook, bishop, knight, King, in that
  order, on the first four files of a five by five board; theirs the same,
  facing, so the Kings share a file (level setting `inOrder`: both lines
  stand in the order given, centred). The fifth file is empty: a piece card
  can fill it. Seven by seven from depth 6 adds two each, as before.
- **No layout step, no clouds, nothing lost for good.** Every board starts
  with your whole lineup; only losing your King ends the descent.
- **No balancing search.** With both lineups fixed, the board is laid out
  straight away from its seed: no solver, no measures, no par
  (`findOnce` in `play/main.js`). What changes board to board is the
  upgrades, the statue order and the rabbit.
- **One rabbit leads them** (level setting `darkBrain: 'rabbit'`, "One
  rabbit leads them"). Their pieces think (`ai.js`, a minimax search). A
  single Rabbit starts on their King's head and sets how: its trait is
  their mood (Aggressive and Hunter hunt, Shy flees, the rest weigh it up)
  and its intelligence how far ahead they look (2 or less: at random; 3 to
  5: one move; 6 to 8: two; 9 and 10: three; Messy one less). `leaderMind`
  in `rules.js`. The trait is drawn each board; the intelligence climbs
  with depth. The rabbit hops every turn by its own mind, after their piece
  moves, and is drawn as a rabbit in its trait's fur, with no plinth. Tap
  it, or open the pieces sheet, to read what kind it is.
- **Every suit on their side.** Swords cleaves and Stars moves twice, each
  extra move picked greedily (`foeMove`, `bestFollow`: the best capture,
  else out of your reach and toward your King); the lookahead plays them
  the same way. Spirals' swaps are among the moves they think about.
  Diamonds treasure gives them an upgrade more at the next board (two at
  most). Hearts and Spirits as before.
- **The AI, two fixes.** A side led by a rabbit now guards its King when
  taking it is how you win (`day.ai.guard`; only for that side, so the
  first dailies, which thought too, play as before). And its lookahead
  lifts the first-turn cloud as the real turn does: before, on turn one it
  saw your pieces as blocked and left its King open.

**The daily.** Rolled boards (the runner's daily practice, and
`make-daily.mjs`) are now led by one rabbit too: no rabbits inside pieces,
none loose, and none in their pool. Its intelligence is held to 3 to 5,
one move ahead: the solver and the measures play each candidate thousands
of times, and two moves ahead made dealing too slow (measured: one layout
tried in six seconds). Boards to 2026-10-13 are untouched;
see the dated note below for the boards after it.

Paths moved: mastery (a fixed, readable opening, the same every descent, so
skill carries from run to run; the rabbit's kind is a thing to read and
play against: a Shy one's side plays safe, a Hunter's comes for you) and
power (their side climbs by the same upgrades as yours, all six suits).
Notated: the rabbit's fur (visual), its description on a tap and in the
sheet (written), "Their piece of Swords takes again" (written).

## Flying shields, needles, a new line, and the piece trials (2026-10-13, later)

Timothy: "the guard shield should fly from the guarding pieces to the newly
guarded piece as an animation, in a slight arc. pieces that would be
considered absolutely pinned ... should have a metal sewing needle fly into
them from above as an animation that skewers them in place ... the descent
5x5 should start with this order and number of pieces from left to right:
tall rook, bishop, king, knight, short rook. the enemy side is the same but
reversed." Then two new pieces (`docs/grove-pieces.md`) and a mode for
testing pieces. What each became:

- **Shields fly.** `guarded` (`rules.js`) now says which pieces guard each
  one, not only how many. When a piece gains a guard, once the move has
  landed, a shield leaves each new guard and flies to the front of the
  piece in a low arc, turning as it goes, then lands with the clink and a
  buzz; a second guard turns it gold as it arrives (`board3d.js`,
  `guardOf`, the flights in `things`).
- **Needles through pinned pieces.** In chess a *pin* is a piece standing
  between an attacker and something behind it; an *absolute* pin is one
  where the thing behind is the King, so moving the piece off the line is
  illegal (a *relative* pin, to anything else, is only costly). Grove Chess
  has no rule against moving into danger (a King left where it can be taken
  is lost), so a pinned piece can still move, and moving it loses.
  `pinned(s)` finds them the plain way: lift the piece off the board and see
  whether a piece of the other side that could not take the King before now
  can, which catches every kind of pin (a slider's line, a cannon's screen).
  Both sides, wherever losing the King loses. A steel needle with a red
  thread drops from high above, faster and faster, and stops dead through
  the piece with a shiver; a thin whistle, then a dry stab (`sfx.pin`), and
  a buzz. When the pin ends it is pulled out upward. Level setting
  `showPins`, "Needles through pinned pieces", on; settings version 16
  (older links read it as off, as with the shields and beacons).
- **The descent's line.** Tall rook, bishop, King, knight, short rook: five,
  the full row (`startPool`, `startPieces: 5`). Theirs is the same read the
  other way (run setting `foeLine`, "Their line": the same files as yours,
  like Microchess, or yours reversed; the descent's is reversed), so each
  side, from its own end, has its tall rook on the left, and the Kings face
  each other on the middle file. At seven by seven the two new pieces each
  side gets go one at each end of the line, so the King stays in the middle.

### The piece trials

(Later the same day the trials moved into Custom and their engine was
replaced by the real rules; see "Ghosts, gates, wandering clouds, and
Custom" below. This is what they were first.)

`trials/` (menu: Piece trials), with the work in `trials.js` on a background
thread (`trials-worker.js`). Timothy: "choose what chess pieces are in,
choose the size of the board, then you calculate the board layout that would
make the games balanced and then test to see if the game would be fun ...
and if there even is an orientation of pieces that is playable ... often
times is also the assumption that the opposing sides are identical and
mirrored ... see a newly invented piece or fairy piece and play a balanced
game (if it exists) with that piece weaved in."

1. **Layouts.** Every distinct way to stand the army on the back row (two
   rows if it does not fit one), the King on the back row. Theirs is the
   same army, mirrored (the same files, like chess) or turned (reversed, the
   descent's), or both are tried. A layout and its reflection are one game,
   so one of each pair is kept. Five pieces on five files: 60 layouts.
2. **Checks.** Can anything be taken on the very first move (the balance
   rule since 2026-10-07; a setting, and if it throws out every layout they
   are judged anyway, marked)? Can the first side take the King by force
   within three moves, whatever the other does (thrown out as broken)?
3. **Self-play.** Two copies of one bot play each layout: a minimax search
   with alpha-beta pruning two moves deep, then a *quiescence* search that
   follows captures until the position is quiet (otherwise a bot stops
   counting halfway through a trade: the horizon effect). Its sense of a
   position is the same for both sides: material at each piece's power on
   that board (`power.js`), mobility, nearness to the other King, a
   *mop-up* term (well ahead in an ending, push the lone King to the edge
   and bring your own close, which is how King and rook beat a lone King),
   and *contempt* (a side treats a draw by repetition as a little worse
   than even, so it plays on when it can). A little luck per move keeps the
   games different. A screen of quick games picks the best few, which are
   judged: equal bots, and a bot that looks further ahead against one that
   does not. Its own small engine (make and unmake, no copying) using every
   piece's real move code, so invented pieces work.
4. **Measures**, after Cameron Browne's Ludi (2008), which invented games
   and judged them by self-play; one of its games, Yavalath, is published
   and still played. Balance (with Laplace's rule of succession, so 2 wins
   of 2 counts as 3 in 4: a small sample proves little), decisive, length,
   drama (the lead changing hands, comebacks), uncertainty (how late the
   winner pulls ahead for good), skill (does the further-ahead bot win?),
   every piece plays, variety (different openings). Fun is a weighted sum
   (balance and decisive and drama and skill weigh most); the verdict is
   playable, shaky or broken, with the reasons in words.

Every result shows the layout, the measures as bars, the record, each
piece's part, and three buttons: **Play it** (the runner, `?mode=trials`,
against the thinking side; the position travels in the link as an extended
FEN, `[Tallrook]` yours and `[tallrook]` theirs, read by `readFen`),
**Watch a game** (one of the bots' games, step by step), and **Copy**.
"Judge my order too" always judges the army in the order given. **Weave in
a piece** swaps the chosen piece in for each kind in the army in turn (and
adds it if there is room), and ranks the armies by their best layout. The
catalog's piece sheet links to it ("Weave it into an army, in the trials").
"Copy the results" is text to paste to Claude.

What it said about the new descent (thorough, five by five, both facings,
seed 1; 20 games each, so read the numbers loosely):

- **On an open board no layout works.** Every one lets a rook take on the
  first move or loses to a forced King hunt. The statue row is what makes
  five a side on five by five playable at all.
- **With the statue row, seven of the ten judged in full came out
  playable** (none was thrown out by the checks), and the best was
  bishop, tall rook, knight, short rook, King, turned (fun 79: the two sides
  won 3 and 5, 12 drawn). Timothy's order, turned, came out shaky (fun 65:
  14 of 20 drawn, and the stronger bot barely ahead); in a quick trial it
  had scored 70, playable. It is close to the middle of the pack, not bad.
- **About a quarter of games end with only the Kings left.** Equal armies
  trade down. The showdown would not decide those (it stops shrinking at
  half the board, and two Kings can dodge for ever), so they end out of
  moves. An open question for Timothy: what should happen when only the
  Kings are left?

The bots' opinions are not his: the fun weights are a first guess, not yet
checked against how the layouts feel to play. Paths moved: customization
(Timothy's own design bench: any army, any board, invented pieces, and an
answer in seconds), mastery (the needle teaches pins and the flying shield
teaches who guards whom, both by sight and sound; a descent line can be
chosen on evidence), collection (two new pieces). Gaps: only identical
armies (Betza's Chess with Different Armies, where each side fields a
different army of equal strength, would be the next step); no suits; no
showdown; results stay on the phone that ran them.

## Ghosts, gates, wandering clouds, and Custom (2026-10-13, latest)

Timothy, in one message: their side in the trials "in addition to mirrored
and reversed, setting for anything too"; suited pieces tested too; "when I
run the actual set of real chess pieces in the actual chess game on an 8x8
board, it actually doesn't even come up with the proper orientation ...
which may be a red flag"; ghosts, in place of clouds and statues as the
descent's default; the descent on five by six; clouds and statues as
neutral fairy pieces; gates; and "one central just custom mode where you
can play a game with custom rules, and also simulate it, or find the most
playable orientation of pieces within that ruleset and piece set". What
each became:

### Four neutral pieces

A *neutral* piece belongs to nobody (in fairy chess the word is used for
pieces either side may move; here neither does). They are board features
in the rules (`rules.js`, `look`, which tells a mover what stands on a
square) and catalog entries of kind `neutral` (`PIECES`), so the catalog
shows them, sheets explain them, and no pool ever deals one as a piece.

- **Ghosts** (level setting `ghosts`). The whole row in front of each
  side, where pawns would stand. A ghost never moves or takes. To its own
  side it is empty ground; to the other side it is a wall: sliders stop
  before it, nothing lands on it, leapers jump it. Once one of its own side
  slides through it or lands on it, it is gone for good (`passGhosts`;
  `s.ghostGone`). So a side opens its own ghost row by playing through
  it, and every opening it makes is also a door for the other side. A
  pale low figure with a scalloped hem, in its side's colour.
- **Gates** (`gates`, 0 to 6, in the middle rows). Up one turn, down the
  next; half start each way (`day.gates`, square to phase; `gateUp`).
  Down is open ground. Up is no square at all: nothing passes it and
  nothing stands on it, though a leaper can still jump the gap, as it jumps
  anything. My call where he did not say: a gate with a piece on it stays
  down until the piece leaves, so a gate never crushes anything. Iron
  railings between two posts, flat on the ground when down; a clank.
- **Wandering clouds** (`clouds`, 0 to 4). Each drifts one square a turn,
  any of the eight ways, over anything; the way is drawn from the level
  and the turn, so a game replays the same on any phone. A piece under a
  cloud is hidden from the other side (`hiddenFrom`, `seenBy`, which hands
  a side a copy of the game with the hidden pieces taken off the board),
  and so is its move into it: it is simply not drawn. Then a move can run
  into something it could not see: the *contact rule* (`contact`) stops it
  on the first hidden piece on its way and takes it. This is the rule of
  kriegspiel and of Dark Chess, the chess variants where you see only what
  your pieces see. You always see your own pieces, under a cloud or not.
  The bots, and the side that thinks, plan only from what they can see. A
  shade on the ground marks the square a cloud covers. (The old cloud,
  `cloud`, the first-turn cloud over the row in front of each side, is a
  different rule and stays.)
- **Statues that can be taken** (`statuesTake`). As before, sliders stop
  at a statue and leapers and hoppers (the grasshopper, the cannon) go
  over it. Now either side can take it, as a move, and then it is gone. On
  for new levels; settings version 17 reads older links as off, and the
  daily and golf keep it off (the stored daily boards must not change, and
  golf banks balls off statues).

### The descent on five by six, behind ghosts

`w: 5, h: 6, ghosts: true`, no statue row. The line is the same (tall rook,
bishop, King, knight, short rook; theirs reversed), with a ghost row in
front of each, so the middle two rows start empty. The rest stays: one
rabbit leading their side, 20 moves, the showdown, falling to the next
board when the moves run out.

### Custom

One page, `lab/` (menu: Custom; the home page's card is Grove Custom),
holding what were three: the workshop (any settings, one level, play it),
Chaos (now its "Go crazy" button) and the piece trials (`trials/` now
forwards to it, hash and all). The page's new parts are in `lab/custom.js`:

- **Armies.** Dealt from the settings' pools, as before, or square by
  square: your army piece by piece in order, each with a suit if you like
  (tap one to give it a suit, move it left or right, or take it out), and
  theirs mirrored (the same files, as in chess), turned (yours read the
  other way, the descent's) or, when searching, in any order of its own
  ("Their side, when searching": Mirrored, Turned, Any order, Try all).
  Presets, each with the rules it is played by: the descent's, Microchess,
  Gardner minichess, Los Alamos chess, Chess, and Shogi's generals.
- **Simulate it.** Twelve games between two equal bots and six between a
  stronger and a weaker one, on the level exactly as it stands, judged by
  the same measures as before (Browne's Ludi).
- **Find the most playable layout.** For square-by-square armies, a trial
  of the army (every way to stand it, checked, the best improved, the best
  few judged); for a dealt level, the best of many dice rolls of the same
  settings. Each result: the board, its measures, Play it, Watch a game.
- **Weave in a piece**, now with a suit too. The catalog's "Weave it into
  an army" opens it with that piece chosen (`#weave=<piece>`).

All of it runs on a pool of Web Workers (`sim-worker.js`): background
threads, one fewer than the device has cores, up to eight, so the page
stays responsive and a phone with eight cores works seven times as fast.

**One bot, on the real rules.** The trials had their own small chess engine
(make and unmake on a plain board, fast). It could not see suits, ghosts,
gates or clouds, so it is gone: `sim.js` plays both sides with the game's
own rules (`allMoves`, `playerMove`, `respondWith`), the same search
(minimax with alpha-beta, then quiescence) and the same sense of a
position. Copying the game for every move it looks at is slower, so the
rules now keep an *occupancy grid* while they generate moves (`withGrid`:
an array of what stands on each square, built once per position, instead
of searching the piece lists for every square a slider crosses), which made
chess half again as fast, checked equal to the old way on 1,258 positions.

### The red flag: chess was never found

He was right that it was a red flag. The army of chess, sixteen pieces on
sixteen squares, has 16! / (8! 2! 2! 2!) = 64,864,800 arrangements (the
eight pawns, the pairs of rooks, knights and bishops are each alike). The
trials drew a few dozen of them at random, so the real one, or anything
like it, was never even looked at. A search that samples blind cannot find
a needle in sixty-five million. Three changes, all standard practice in
designing chess variants:

1. **Structure.** Pieces that can never move back (pawns, and any piece
   whose moves all go forward, `retreats`) stand in front; the rest behind.
   For chess that leaves the 8! / (2! 2! 2!) = 5,040 back rows.
2. **Colour.** A *colour-bound* piece (the bishop, and others,
   `colourBound`) only ever stands on one colour of square, so two of them
   are spread over both colours, the rule Chess960 uses (Fischer's random
   chess: 960 back rows, the bishops on opposite colours and the King
   between the rooks).
3. **A hill climb.** The best layouts of the first screen are improved a
   swap at a time: swap two pieces, keep the swap if it judges better, stop
   when no swap helps. Hill climbing is the simplest *local search*: it
   finds a good layout near where it starts, not always the best of all.

With those, a trial of chess (thorough, mirrored) judges the real back row
playable: fun 70, and the most decisive of the 41 it judged in full (4 of 6
games won, against 1 or 2 for the others). It is not first: four layouts
scored 71 to 81, the top two with most of their games running out of
moves. With six games each, scores within about ten are too close to call,
and Chess960 is the evidence that many back rows play well; what the
search should not do is miss chess, and it no longer does.

### What the bots say about the descent now

Simulated as it stands (5 by 6, ghosts, the showdown, two equal bots, 12
games): **at 20 moves every game is drawn**, 8 out of moves and 4 down to
the two Kings. Allowing 40 moves, 2 are won, 7 end with only the Kings,
and 3 repeat. In the descent itself running out of moves is not a loss
(you fall to the next board), and their side there is a rabbit's mind, not
this bot, so this is a measure of the board, not a verdict. It says two
things: equal armies on this board trade down to bare Kings more often
than they did on five by five with the statue row (about a quarter then),
and 20 moves is short for the bots to take a King. What two bare Kings
should do is still his call.

Paths moved: customization (one place for every custom setting, with
armies square by square, suits and four new neutral pieces), mastery
(clouds reward reading what the other side cannot see, gates reward
timing, ghosts make opening your own row a choice), discovery (four new
things in the catalog). Gaps: different armies on each side are only
"any order" of the same pieces; Kung fu descent (real time) has none of the
new pieces.

## A best-move button, a row of pawns, and chess pawns everywhere (2026-10-14, later still)

Timothy: "I'd like a button, no matter what mode we're in during a game,
that plays the best possible move for me for testing purposes. I also want
to try having the tile mode and decent have a second row fully of pawns,
and two rooks on each side of the first row. Pawns should have en passant
and moving two squares as the first move in all modes by default."

- **Best move** (a button beside Wait/Pass, on the play page and in
  Custom; `best.js`). On a hole it plays the first move of the solver's
  line from where the game stands (`solveLevel` takes `from` now);
  anywhere else the two-sided bot's move three moves ahead, with no noise
  (`sim.js chooseMove`). In kung fu, with no turns to look ahead through,
  the most valuable capture a ready piece can make, else a move by one to
  a square none of theirs reaches (`kungfu.js best`). Not while you lay out
  your pieces, or set up autochess.
- **The line**: rook, bishop, King, knight, rook, with a row of pawns as
  wide as the board in front (run settings `startPool`, which may now
  repeat a piece, and `pawnRow`), in the descent and Tile Chess, mirrored.
  Pieces marked to stand in front (`row: 1` on a hand piece) take the
  second row (`makeLevel`). The descent's ghosts fall away by themselves:
  they only fill empty squares of the row in front of each line, and the
  pawns fill it. At depth 6 the board widens to seven and two pawns more
  join each side. The descent has 30 moves a board now (was 20).
- **Pawns** (level setting `pawnRules`, Armies, "Two squares first, and en
  passant", the default; settings version 21, so older links keep "One
  square at a time"). A pawn that has not moved yet this game may step two
  squares if both are empty. Stepping two leaves the square it passed over
  open: on the very next move, a pawn of the other side that could take
  on that square may take the pawn that passed, landing there
  (`enPassant` in `rules.js`). Kung fu has the two-square step but not en
  passant, since it has no turns. A chess variant keeps its own pawn
  rules. The stored daily boards are unchanged (they read as older
  settings).

## Tile Chess, and rings that stop where a piece could reach (2026-10-14, later)

Timothy: "new descent variant: every round you and your opponent pick a
tile to reveal around the board, expanding its size. every tile also
contains an icon with an suit or weapon upgrade on it, when flipped you get
it. this replaces the current method of just getting the choice of two
every round. the side that won the round gets the first pick of tile to
flip. when the board reaches a new threshold of cell amount, corresponding
to the amount that would be equal the a board size higher, each side is
given a random new piece, both the same for each side. ghosts from descent
are replaced with four random (destroyable) statues, and a rule that gives
every piece at the beginning of the round invinsibility until it moves for
the first time in the round, denotes by a bubble around the piece. this
mode will be called tile chess. also no rabbit here for now." And: "the
purple reach highlights seems to be still pushing past where a piece could
reasonably capture."

### Their rings

The look through their own pieces, ghosts and gates (releases 56 and 57)
is gone: a line stops at the first thing in its way, ringing it only if
it could take it. What stays from those releases: a stunned piece still
shows its reach, and a pawn its empty diagonals. The rings are what they
reach this turn, the same set the shields use.

### Tile Chess (`tiles` in `modes.js`, in every menu)

- **The lines and the goal** are the descent's: rook, bishop, King,
  knight, pawn, mirrored, on five by six; take their King to win a round;
  lose yours and the run is over. Their side thinks, a step further every
  three rounds. No rabbit, no ghosts. A pawn on the far row becomes a copy
  of another of yours.
- **Tiles** (`tiles.js`; run setting `upgrades: 'tiles'`). The board is
  carried from round to round. After every round each side turns over one
  tile beside the board (on any of its four sides), the winner first; out
  of moves, they go first. The board grows by that square, and the suit or
  weapon on the tile goes to the side that turned it (you choose the piece;
  theirs goes on one of theirs at random, never their King). Every tile's
  upgrade shows before it is turned, fixed from when the tile first
  appears. Their side picks a tile some piece of theirs can use, nearest
  their own row. Your pick is a tap on the board between rounds.
- **A size up, a piece each.** When the board has as many squares as the
  next size up (6 by 7 is 42, then 56, 72, 90 ...), each side gets the same
  new piece, a knight, a bishop or a rook, at random.
- **The board** for each round is the box round every square turned over,
  every other square of it a gap (level setting `tiles`, `lab.js`). Both
  lines stand on the first board's home rows, centred on its middle file; a
  line longer than the row spills onto the row in front.
- **Four statues** in the middle each round, which either side can break by
  taking one.
- **Bubbles** (level setting `bubbles`, Armies). Every piece starts each
  round in a bubble: nothing can take it, and to the other side it is a
  wall, until it moves. Moving pops it, in a pale puff. Drawn as a pale
  ring round the piece, pixel by pixel.
- **A choice that was not in the message:** every bubble still left
  bursts after four turns (`bubbleTurns`, 0 to 12; 0 is never). Without
  that, a King that never moved could never be taken, and no round could be
  won: the bots' rounds all ran out of moves until it was added.

Paths moved: world (the board itself grows, a different shape every run,
and its shape is the player's doing), power (upgrades on both sides, now a
contested choice: what you take, they cannot), and mastery (where to grow
the board, and which tile to deny them; the opening is safe, so the first
moves are about position). Notated: the tiles and their icons (visual),
the bubbles and their pop (visual), the line saying what each side took
and when a piece joins (written), a fanfare at each size up (audial).

## Rings up to what they could take, the King and the shields, and Capture the rabbit (2026-10-14)

Timothy: "the purple highlight should be the reach of enemy pieces up to
the pieces they could take, but not past that. so they can be under
friendly pieces but just not like as much as now. also, the shield icon
on cells works, but the king shouldn't be included in that calculation in
situations where the king would get captured if it [moved] there ... i
want codified mode selector for capture the flag".

- **Rings stop at what they could take.** A line runs on through their own
  pieces, ghosts and gates (as in release 56) until it meets something it
  could take: a piece of yours, a statue that can be taken, the rabbit to
  capture. That square is ringed and the line stops there. So the first
  of yours in a line shows a ring, and what stands behind it does not. A
  pawn's empty diagonals still show (`moveSet` in `rules.js`).
- **The King and the flat shields** (`guardedSquares`). With a royal King,
  the King is never the piece that steps in: taken there, the game is
  lost, so a piece that would take back is no comfort. It still counts as
  a guard, but only on a square one piece of theirs attacks: with two, the
  one that is left would take the King after it took back
  (`attackersOf`).
- **Capture the rabbit**, a mode of its own (`flag` in `modes.js`, in the
  menu on every page). The rabbit sits on the middle square of a seven by
  seven board. Both sides line up the same, as in chess without a King:
  rooks, knights, bishops and a queen behind seven pawns (the set position
  `rnbqbnr/ppppppp/7/7/7/PPPPPPP/RNBQBNR`). Theirs think two moves ahead.
  Take the rabbit and the piece that took it carries it; bring that piece
  to your first row to win. If they take it, they carry it to theirs. No
  King, so the rabbit is the whole game; 40 moves. Set positions can now
  play for the rabbit (`positionLevel` in `lab.js`, goal 'flag'); before
  they always played for the King.

## Their move sets, shields underfoot, and a rabbit moved on purpose (2026-10-13, after release 55)

Timothy: "shields that are on board spaces should be underneath pieces,
even if they may be occluded to some extent ... the purple reach outlines
should reflect the move set of the enemy pieces, even if they end up
displaying those outlines underneath friendly pieces. It's just supposed
to show where they could go regardless of whether or not they actually
could on that turn ... The rabbit that hops on heads should not have a
piece base ... moving the rabbit is now purposeful and costs a turn to do
for the side that has one. It is no longer random. However, there's a
setting that exists that allows it to be random again."

- **Their rings are their move sets.** Each piece's moves on an open board
  (`moveSet` in `rules.js`): every piece, ghost, statue and gate is looked
  through, so a rook's file runs on under your pieces to the edge, and a
  pawn's diagonals show with nothing on them. Only the board's own edge
  and gaps stop a line. A stunned piece still shows its set. What they
  can reach this turn is kept apart (`reachMaps(...).threat`), and the
  flat shields still go by that: a shield says a square is attacked now.
- **Flat shields lie under the pieces**, drawn on the squares before the
  models, so a piece standing in front hides part of one and the rest
  shows round it.
- **The riding rabbit is just a rabbit**, no plinth: pale lavender for
  theirs, pale green for yours, like the rabbit that leads them.
- **Moving the rabbit is a move** (level setting `rabbitMove`, Goal: "By
  its side, as a turn", the default, or "By itself, at random", the first
  way, every `rabbitHop` turns). Chosen, the rabbit can hop onto any other
  piece of its side, and that is the side's whole move. Your own (with
  "Rabbits ride: both") is picked by tapping it (the rabbit first, then
  the piece under it) and then tapping another of your pieces. Their side
  weighs it like any move: the piece it rides counts ten times, so they
  move it off a piece you are about to take, if nothing better saves it.
  A side whose pieces do not think keeps the random hop. Settings version
  20: older links read "at random".
- The descent plays it the new way: no hop count under the board.

Paths moved: mastery. The rings now show what a piece threatens once the
way is clear, so lines can be read a move ahead (a discovered attack, a
ghost about to go), and the rabbit is something both sides spend tempo
on, a choice to read rather than a dice roll.

## Rabbits to take, new suits, weapons, and golf with sliders (2026-10-13, after the shields)

Timothy, in one message: a **capturing** win condition, from one piece to
all of them; a rabbit that **hops between their pieces** every one to five
turns, three by default, where taking the piece it rides wins (and a
version with one on each side); the descent's line **rook, bishop, King,
knight, pawn**, mirrored, with that rabbit, and pawns that become **a copy
of another of your pieces** on the far row; **capture the rabbit**, a
rabbit in the middle of a seven by seven board to carry home; golf with
**sliders only**, a ball that moves only when hit, **par or better** to
win, and obstacles; **five suits** in place of the old; and **weapons**.

### Three goals

- **Capture** (`goal: 'capture'`, `captureN` 1 to 8, or 0 for every one of
  theirs). The rabbits of the old goals never count.
- **Take the rabbit's piece** (`goal: 'carrier'`). A Rabbit rides one of
  their pieces, drawn at random. It never moves by itself: every
  `rabbitHop` turns (1 to 5, default 3) it hops to another of their
  pieces, at random from the level's seed and the turn, so a game replays
  the same. Take the piece it rides and you win. With `rabbitSides:
  'both'`, one rides yours too, and losing that piece loses. A piece with a
  heart that is taken goes home with its rabbit still on it. The bar under
  the board says "the rabbit hops in N".
- **Capture the rabbit** (`goal: 'flag'`). A rabbit sits on the middle
  square, seven by seven by default. Either side takes it like a piece; it
  then rides on the head of the piece that took it, and whoever takes that
  piece takes the rabbit. Bring it to your first row to win; if they bring
  it to theirs, you lose.

### The descent

`startPool` rook, bishop, King, knight, pawn; `foeLine: 'mirror'`; `goal:
'carrier'`, every three turns, theirs only. **A pawn on the far row**
becomes a copy of any other piece of yours on the board (level rule
`promote: 'copy'`): one move per kind it could become, and tapping that
square asks which (`choose.js`). Never a King or a pawn. The copy keeps
its suit and weapon (a lance it could not carry is dropped), and it stays
that piece for the rest of the run. **The draft** after each board is two
cards, suits and weapons only; their side gets one of either. Their skill
climbs one step every three boards.

### The suits, replaced

| Suit | What it does |
|---|---|
| ♥ Hearts | a life more: taken, it goes back to your first row, on a free square you choose (the second row if the first is full, and so on). It starts on the free square nearest the middle; tap a lit square to move it. |
| @ Spirals | Pac-Man sides: off the left edge it comes back on at the right, and the other way |
| ⚙ Gears | as its move, it swaps squares with any other piece of yours |
| ★ Stars | moves twice: once a level, its first move is followed by a second |
| ❦ Vines | chain captures: after it takes, it may take again, the same turn |

Swords is Vines now and the old Spirals (the swap) is Gears. Diamonds
(treasure) and Spirits (through anything) are gone. Links before settings
version 19 read the old names that way (`pieceMod` in `lab.js`), and
Custom's saved armies are renamed once.

### Weapons

One per piece, beside one suit, each at level 1 to 3, drawn standing
beside the piece with a gold pip per level. Where suits are found, weapons
are too: the descent's draft, rewards, the shop, keepsakes, their side's
upgrades, and Custom's armies (`lab/custom.js`, by piece, with a level).

| Weapon | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| † Sword | takes the piece in front of where it lands | and the two beside | and the two diagonally in front |
| ↟ Lance | takes one piece it slides through | two | three |
| ✸ Mace, sliding | pushes one piece ahead of it | two | three |
| ✸ Mace, leaping or stepping | stuns in front of and behind where it lands | and beside | and the diagonals |

- **A sword or a lance takes no piece by landing on it**, so it cannot move
  onto one. A sword strikes after it lands; a lance lands on an empty
  square beyond what it went through. A lance only on a piece that slides.
- **A pushed piece of theirs is stunned**: it cannot move on its side's
  next turn (stars over its head). Yours can be pushed but never stunned.
  A stunned piece that is pushed again is taken. A push needs open ground:
  a line blocked at the far end is not pushed.
- Rules: `capturesOf`, `armed`, `pushes` and `takeAt` in `rules.js`; every
  hint (reach rings, shields, pins, threats) counts what a weapon takes,
  not where it lands.

### Golf, reworked

"The only pieces in the game should be sliders, as leapers don't really
make any sense. sliders move the ball, the ball doesn't move on its own.
There's no such thing as a sticky ball. the win condition is reaching par
or better ... there can be obstacles like gates and clouds."

- **Sliders only**: rook, bishop, queen, short rook, tall rook
  (`GOLF_POOL`). No rabbits.
- **Every ball is hit** (`ballMove: 'hit'`): move a piece into the ball and
  it slides on the same way until something stops it. The sticky ball is
  gone (a link that names it still reads).
- **Par or better wins the hole.** Par is the fewest strokes the solver
  finds plus two on the first two holes and one after, and it is the
  hole's stroke limit. Under par (a birdie, an eagle) means finding the
  best line or near it. Over par, the same hole again, as many times as
  it takes; the scorecard counts the tries. A hole the solver found no
  par for keeps the old limit of 15.
- **Hazards**, two new (level settings `sand` and `water`, Board,
  Neutral): **sand** stops the ball dead, pieces cross it; **water** is a
  wall to pieces, and a ball that rolls in goes back to the tee (or stops
  at the edge if the tee is taken). **Gates** stop it while up, and
  **wandering clouds** now stop it too, drifting a square a turn.
- **The courses** are told apart by hazards now: The Meadow (statues, then
  sand), The Lily Pond (water; the sides join), The Gatehouse (gates; was
  the Billiard Hall), The Clockwork Links (the board turns, sand), The
  Haunted Hollow (clouds, crumbling ground, water late). Mixed brings each
  hazard in turn.

### Decisions made where the message was open

- The sword strikes after it lands, from where it lands.
- A mace pushing a piece of theirs that was already stunned takes it; one
  push off the board or into a wall is not a move.
- Hearts: the piece comes back on the free first-row square nearest the
  middle, and you may tap another.
- The carrier starts on a random piece of theirs, not always the King.
- Capture the rabbit: the rabbit passes to whoever takes its carrier.
- Golf's par slack (two, then one) is mine; a proposal.

Paths moved: mastery (golf's par is now a bar to clear, replayed until
cleared; the rabbit's hop count is a clock to plan against) and power
(weapons are a second ladder beside suits, levels 1 to 3, on both sides).
Notated: weapons and stun stars on the board (visual), a tap on a piece
says what it carries (written), the hop count and the hole's hazards in
the bar and chips (written), the tries column on the scorecard (written).

## Shields on squares you guard (2026-10-13, after the small changes)

Timothy: "while we don't show friendly pieces reach unless you tap on the
piece before you move it, very specifically, if that piece's reach
overlaps with the position present on the enemy's reaches outline, wherein
if you moved a piece there, then that piece would be able to actually
defend that slot, then put a flat shield icon onto that cell ... let's say
there's a rook, and an enemy bishop crosses the rook's potential movement
path in front of it at one space. that specific space would have a large
shield icon on it".

- **Which squares.** An empty square their pieces reach (it has a purple
  ring) where, if a piece of yours stood there and they took it, one of
  yours could take back: the same test that puts a shield on a guarded
  piece (`guarded`), made for an empty square (`guardedSquares` in
  `rules.js`: stand a piece of theirs there, and see which of yours could
  take it). Your own pieces never show their reach; this is the one place
  it shows, where it meets theirs.
- **Two of yours, not one** (later the same day, Timothy: "the shield
  only shows if two friendly pieces are able to go to that spot in some
  way and then also if it's three then put a gold shield"). A square only
  guarded had a shield even when nothing of yours could move onto it, so
  picking a piece up showed there was no way there. Now a square needs a
  piece that can really move there, and another that would take back:
  each piece that can move there is moved there for real (and taken
  there), and only the others count, from where they then stand. Silver
  is two of your pieces meeting there (one to move, one to guard), gold
  is three or more (one to move, two guarding). In his first example, the
  rook alone puts no shield on the square in front of it; a knight that
  can step onto that square makes it silver.
- **With a piece picked up**, its own moves are tried for real. A piece
  cannot guard the square it moves to, and leaving its square can open or
  close a line, so on its destinations the shield counts only the others,
  from where they would then stand. In his example, picking up the rook
  takes its own shield off the square in front of it, unless something
  else guards that square too.
- **The look.** Flat, square above and pointed below like the shields
  pieces wear, with the same cross: silver for two of your pieces there
  (one to move in, one to guard), gold for three or more. Drawn pixel by pixel, so it is as crisp as the board. It lies over
  the pieces rather than under them: the square just in front of a piece,
  the one it most often guards, is the one its model stands over, and
  underneath it would be hidden.
- **The setting:** "Shields on squares you guard" (Information, on;
  settings version 18, so older links read it as off). It shows only with
  their reach rings and the guard shields on. The flat board (`?flat`)
  does not draw it.
- Custom's board now follows its Information settings (until now its
  hints were always on whatever the settings said).

Paths moved: mastery. Defending a square before you step onto it is a
real chess skill (a piece that is *protected*), and this teaches it by
sight at the moment of choosing a move.

## Four small changes (2026-10-13, after the eight parts)

Timothy: "in descent, the rabbit shouldn't have its moveset present as a
purple reach outline; descent by default should have mirrors pieces, not
reversed; there's like some kind of shadow over top the entire screen
when on a board ... turn it off; ... maybe some sort of really mild
anti-aliasing present ... that anti-aliasing shouldn't be there."

- **The leading rabbit shows no reach.** It never takes anything, so its
  hops were no danger to mark; `reachMaps` (`rules.js`) leaves it out.
  Their pieces' reach is unchanged.
- **The descent is mirrored.** `foeLine: 'mirror'`: their tall rook stands
  opposite yours, as in chess, and so on along the row. "Turned" is still
  a setting (Armies, Theirs). Custom's descent preset is mirrored too.
- **No shadow.** It was the fog-and-vignette layer over the board (see
  `docs/grove-look.md`, "Fog"); it is gone.
- **No anti-aliasing.** The board was smoothed up on purpose; it is now
  enlarged in whole, square pixels (`docs/grove-look.md`, "Crisp, not
  soft").

## The eight parts of a mode (2026-10-13, last)

Timothy listed what a mode is made of: "piece set (what pieces are
present), piece position (where they are placed) ... board size & shape &
type, are there rounds/levels or just single matches, can pieces change
over time like getting upgrades or stuff between rounds, what is the win
condition, is it turn based, live, or automatic, how difficult is it, and
does it get more difficult over time, is there an enemy side and how do
they work as compared to you". Refined with him into eight parts, each a
question every mode answers:

| Part | The question | Settings (of 100) |
|---|---|---|
| Format | One match or a series, and what ends it? | 7 |
| Board | What is it played on? | 16 |
| Armies | What does each side have, and where does it stand? | 23 |
| Control | Who moves each side, and when? | 21 |
| Goal | How do you win, how do you lose, and what ends a game that stalls? | 6 |
| Growth | What changes between the games of a series? | 11 |
| Difficulty | How hard is it, how does it climb, and what must every level pass? | 10 |
| Information | What can each side see, and which hints show? | 6 |

What changed from his list, and why:

- **Piece set and piece position are one part, Armies.** Where pieces
  stand only means something next to which pieces they are. Placement
  comes five ways: a fixed line (the descent's), dealt at random, laid out
  by you before the first move, square by square (Custom), or found by the
  search.
- **The enemy side is not a part of its own.** Armies and Control are each
  set for both sides (the panels say Yours and Theirs), so "how they
  compare to you" is whether the two sides' answers match. That is
  *symmetry*: chess is symmetric in both; the descent gives both sides the
  same army but gives theirs a rabbit for a mind.
- **"Turn based, live, or automatic" was two questions**: who moves a side
  (you, a bot, rabbits) and when (turns, or real time). They are
  independent, so both sit under Control: autochess is turn-based and
  automatic, Kung fu live and by hand.
- **Pieces that change within a game** (a suit that moves twice, the edge
  falling away) are rules of Armies and Board. Growth is only what changes
  between games.
- **Difficulty is a target, not a dial.** The game builds a level from the
  other seven, a bot plays it to measure it, and it is dealt again until it
  lands (`metrics.js`). So Difficulty constrains the others: the band to
  aim at, how it climbs, and what every level must pass (winnable, par,
  balance).
- **Information is new.** Wandering clouds made it a rule: the same board
  with and without hidden pieces is a different game. It also holds the
  hints (reach rings, shields, beacons, needles).

Across all eight, each value has a **source**: fixed by the mode, chosen
by you, rolled from a seed, or found by the search. That is what tells the
modes apart as much as the values do. The daily rolls everything once from
the date, so everyone gets the same board; Chaos rolls everything; the
descent fixes its first board and rolls its upgrades; Custom lets you
choose everything and hands placement to the search when you ask.

In code (`lab.js`, `modes.js`, `form.js`):

- `PARTS` lists the eight with their questions and the headings inside
  them (Board: Neutral pieces; Armies: Yours, Theirs, The ball; Control:
  Yours, Theirs, Rabbits, Real time). Each schema group is one part
  (`part(id)`), each field may carry a `sub`, and `PANEL` merges the run
  and level settings part by part. Regrouping changed no setting: every
  default, every mode's preset and every link reads as before (checked
  field by field), and only two help texts that said "below" or "under
  their pieces" were reworded.
- `describe(S)` says any mode or level in eight lines, one for each part,
  from its settings, so it cannot go stale. Each part's line is shown
  under its name in every settings panel and changes as you change a
  setting; the runner's title screen has "This mode in eight parts" and
  Custom "This game in eight parts"; the settings console shows each
  mode's preset in eight parts and its settings grouped the same way.

Writing the lines turned up one thing worth knowing: the descent's
Difficulty is "not searched". Since one upgrade a board (2026-10-13), each
board is the two lines as they stand, with no solver and no measure; what
climbs is their rabbit's intelligence (from 3, about one point every three
boards at the steady ramp) and the upgrades they collect. Its aim and par
settings still exist but do nothing there.

Every mode, at its preset, in eight parts (from `describe`):
**The daily** (`daily`)

| Part | The daily |
|---|---|
| Format | One game at a time, each rolled the way the daily is. |
| Board | Rolled: its size, its shape and everything on it. |
| Armies | Rolled with the board, a full row each, lined up like chess. |
| Control | You move yours; one rabbit leads theirs: their pieces think, and its mind (intelligence 3 to 5) sets their mood. Turns, yours first. |
| Goal | Rolled with the board, with at least 18 moves. |
| Growth | None: each game stands alone. |
| Difficulty | Aims at 4 of 10; each board searched to be winnable in 4 to 10 moves, balanced, engaging (at least 50 of 100) and with a high skill ceiling. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**The descent** (`descent`)

| Part | The descent |
|---|---|
| Format | A descent: board after board, deeper each time, until they take your King. Running out of moves drops you to the next board, with nothing found. |
| Board | 5 × 6 rectangle, with a row of ghosts in front of each side. |
| Armies | Yours: Tall rook, Bishop, King, Knight, Short rook, in that order. Theirs: the same, mirrored, each piece facing its twin. Lined up like chess. |
| Control | You move yours; one rabbit leads them: their pieces think, and its mind (intelligence 3) sets their mood. Turns, yours first; one piece a side each turn. |
| Goal | Take their King; lose your King and you lose. A limit of 20 moves; with one piece left each, the board closes in. |
| Growth | Each new board, both sides get an upgrade: you choose one of two (a piece to combine, or a suit), they get one at random; the board is 7 × 7 from depth 6 and fairy pieces from depth 4. |
| Difficulty | Not searched: each board is the two lines as they stand. What climbs is their rabbit’s intelligence, from 3, steadily, and the upgrades they get. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Kung fu descent** (`kungfu`)

| Part | Kung fu descent |
|---|---|
| Format | A descent: board after board, deeper each time, until they take your King. Running out of moves drops you to the next board, with nothing found. |
| Board | 6 × 6 square, with one statue either side can take. |
| Armies | Yours: 6 from Knight, Bishop, Rook, King. Theirs: a full row from King, Pawn, Knight, Bishop. Lined up like chess; you lay yours out first. |
| Control | You move yours; a rabbit inside each of theirs picks its way, by its own mind (intelligence 3). No turns: any piece moves when it is ready, and theirs too. |
| Goal | Take their King; lose your King and you lose. No move limit. |
| Growth | Finishing a board finds you a piece, up to 8, then upgrades and jokers; fairy pieces from depth 4 and what you find carries over to later descents. |
| Difficulty | Starts at 1 of 10 and climbs steadily, their pieces resting less each board; each board searched to be winnable in 3 to 10 moves and balanced. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Chaos** (`chaos`)

| Part | Chaos |
|---|---|
| Format | One game at a time, each rolled completely at random. |
| Board | 6 × 6; its shape and everything on it rolled. |
| Armies | Rolled with the board, lined up like chess. |
| Control | You move yours; how theirs move is rolled. Turns, yours first. |
| Goal | Take their King; lose your King and you lose. The move limit is rolled; with one piece left each, the board closes in. |
| Growth | None: each game stands alone. |
| Difficulty | Normal (4 to 6); each board searched to be winnable and balanced. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Golf** (`golf`)

| Part | Golf |
|---|---|
| Format | A golf course: The Meadow, 6 holes, strokes against par. |
| Board | Each hole its own, 6 × 6 to start, changing as the course goes round. |
| Armies | Yours: 3 from Rook, Bishop, Knight, King, Wazir and 2 more, and a ball: putting and sticky. Theirs: none; one loose rabbit. Scattered in the first 2 rows; you lay yours out first. |
| Control | You move yours; a loose rabbit hops by its own mind (intelligence 4). Turns, yours first; one piece a side each turn. |
| Goal | Sink the ball in as few strokes as you can. At most 15 strokes a hole. |
| Growth | Nothing between holes; the course itself changes as it goes round. |
| Difficulty | Any difficulty; each hole searched to be winnable in 3 to 9 strokes and balanced. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Chess variants** (`variants`)

| Part | Chess variants |
|---|---|
| Format | One game of Gardner minichess, from its own starting position. |
| Board | 5 × 5, the variant’s own board. |
| Armies | Yours: King, Queen, Rook, Knight, Bishop and 5 Pawns. Theirs: the same. As the variant stands them. |
| Control | You move yours; they think two moves ahead. Turns, yours first; one piece a side each turn. |
| Goal | Take their King. No move limit. |
| Growth | None: each game stands alone. |
| Difficulty | Not measured: it plays as it stands. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Piece trials** (`trials`)

| Part | Piece trials |
|---|---|
| Format | One game, from a set position. |
| Board | The position’s own board. |
| Armies | As the position stands them. |
| Control | You move yours; they think two moves ahead. Turns, yours first; one piece a side each turn. |
| Goal | Take their King; lose your King and you lose. No move limit. |
| Growth | None: each game stands alone. |
| Difficulty | Not measured: it plays as it stands. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

**Autochess** (`autochess`)

| Part | Autochess |
|---|---|
| Format | Autochess rounds, until you have lost 3 lives. |
| Board | 6 × 6 square, with one statue either side can take. |
| Armies | Yours: 3 from Knight, Bishop, Rook, King. Theirs: 2 from King, Knight, Bishop, Wazir. Lined up like chess. |
| Control | Rabbits move yours, once you have set them up; a rabbit inside each of theirs picks its way, by its own mind (intelligence 4). Turns, yours first; every piece of yours moves, then every piece of theirs. |
| Goal | Capture them all. A limit of 20 moves. |
| Growth | Win rounds to grow your side, up to 6, buying pieces and upgrades with acorns. |
| Difficulty | Any difficulty, climbing steadily; each board searched to be won by some setup within 20 turns and balanced. |
| Information | Both sides see the whole board. Hints: where theirs can go, shields on guarded pieces, beacons on what can be taken and needles through pinned pieces. |

Paths moved: customization (Timothy's own bench: a mode is now eight
answers he can read and change part by part), mastery a little (a player
can see what a mode is before playing it). Out on purpose: the eight are
his categories, kept in his words; no setting was renamed or removed.

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
| ♥ Hearts | a life more: taken, it goes back to your first row, on a square you choose | Knight of Hearts |
| @ Spirals | Pac-Man sides: off one side edge, back on at the other | Rook of Spirals |
| ⚙ Gears | swap: as its move, it trades squares with any other piece of yours | Knight of Gears |
| ★ Stars | moves twice: once a level, its first move is followed straight away by a second | Knight of Stars |
| ❦ Vines | chain captures: after it takes a piece it may take again, the same turn | Rook of Vines |
| Weapons | a sword, a lance or a mace, level 1 to 3, one per piece beside its suit (see "Rabbits to take, new suits, weapons") | |
| Fuse | two pieces become one with both move sets; it frees a slot | rook + knight = Chancellor, bishop + knight = Archbishop, rook + bishop = Queen |
| Promotion | a piece becomes the next piece up in strength | |
| Jokers | rules for the rest of the run: Double Time (two moves to their one), Foresight (see where every rabbit goes next), Recruiter (your first catch each level joins you), Lazy Rabbits (they move every other turn), Overtime (five more moves) | |

**Every suit is Timothy's** (2026-10-08: he chose cleave, moves twice,
treasure and swap over the first proposals; 2026-10-13 he replaced the
set with the five above). A suit is a rule the piece carries, not a
change to its moves, so a Knight of Stars is still a knight. In
`rules.js`, Vines and Stars leave the turn open (`s.bonus`): only that
piece may move, waiting ends the turn, and the rabbits do not reply and
the clock does not tick until it closes. Par counts moves on the clock,
not plies, so a bonus move is free (`solve.js`). Gears adds swap moves
to `movesFor`; Spirals folds a move off a side edge back on. A stronger hand makes the
tester throw out more layouts ("the Wazir had no job"); the runner falls
back on the best it saw. A suit shows as the plinth's colour. A
piece taken is gone for good. Running out of moves falls on with nothing
found ("Out of moves" can end the run instead). The descent ends when every
piece is gone. Each level down: more pieces of theirs, sharper rabbits,
bigger boards, stranger ground, as fast as "It gets harder" says. No hole,
no ball: those are golf's now.

**What carries between descents** (setting "What you find carries over",
on by default; the keepsakes only with "Waystones give upgrades at the
start", off since 2026-10-10). Every piece a descent finds joins **the roster**
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

**Chaos** ("Go crazy" in Custom, since 2026-10-13). One level from a
completely random mix of every rule and setting. The only rules: it is
winnable, balanced, and as hard as the Difficulty setting asks (measured,
`metrics.js`).

**Golf.** Five **courses**, each a place with its own hazards
(`COURSES` in `modes.js`), chosen on the title. Finishing a course, at any
score, opens the next; each keeps its own best. Your pieces are sliders
(rook, bishop, queen, short rook, tall rook), and the ball moves only when
one of them hits it: it slides on the same way until something stops it.
Sink it at par or better to go on; over par, play the hole again (since
2026-10-13; see "Golf, reworked").

| Course | Holes | Its character |
|---|---|---|
| The Meadow | 6 | open grass, a statue or two, then sand; an L late on |
| The Lily Pond | 9 | water your pieces cannot cross; the sides join from hole 3 |
| The Gatehouse | 9 | gates that rise and fall every turn; the hole wanders late |
| The Clockwork Links | 9 | the board turns; the hole wanders; sand; edges join late |
| The Haunted Hollow | 9 | clouds that drift and stop the ball, crumbling ground, odd shapes, water late |

"Mixed" in the settings is a course of holes (nine by default) bringing
each hazard in turn (sand, water, gates, clouds), more as it goes round,
with statues, a moving hole, magic edges and a board that turns. A
scorecard at the end: strokes against par, with the golf words and the
tries each hole took.

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

- Custom's simulations and finds change nothing by themselves: a layout
  they like goes into a mode only when Timothy says so.

- No currency or shop in the descent: rewards are chosen, not bought.
  (Autochess has one; the descent stays chosen.)
- No experience points for waystones: only reaching a new depth lights one.
- No streaks or daily login rewards (house rule).
- The flat board (`?flat`) does not show everything new (turning boards,
  suit colours are 3D only).

## Next

- Check Custom's fun against Timothy playing the layouts it ranks, and
  tune the weights (`judge` in `trials.js`).
- Decide what two bare Kings do, in the descent and in Custom, and whether
  the descent's 20 moves are enough on five by six.
- The new pieces in Kung fu descent.

- Make more named dailies before the stored ones run out (they go to
  2026-10-17, a week ahead, as Timothy asked; after that a date falls back
  to version 3).
- Calibrate difficulty and engagement against the workshop notebook's
  ratings.
- Give each golf course its own look (board colours, a sound).
- Watch how often a suited hand makes the tester settle for its best
  layout, and tune the ramp if it is often.

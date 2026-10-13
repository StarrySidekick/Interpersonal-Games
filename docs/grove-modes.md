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

- The piece trials change nothing by themselves: a layout they like goes
  into a mode only when Timothy says so.

- No currency or shop in the descent: rewards are chosen, not bought.
  (Autochess has one; the descent stays chosen.)
- No experience points for waystones: only reaching a new depth lights one.
- No streaks or daily login rewards (house rule).
- The flat board (`?flat`) does not show everything new (turning boards,
  suit colours are 3D only).

## Next

- Check the trials' fun against Timothy playing the layouts it ranks, and
  tune the weights (`judge` in `trials.js`).
- Decide what two bare Kings do, in the descent and the trials.

- Make more named dailies before the stored ones run out (they go to
  2026-10-17, a week ahead, as Timothy asked; after that a date falls back
  to version 3).
- Calibrate difficulty and engagement against the workshop notebook's
  ratings.
- Give each golf course its own look (board colours, a sound).
- Watch how often a suited hand makes the tester settle for its best
  layout, and tune the ramp if it is often.

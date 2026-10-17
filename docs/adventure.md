# Adventure

A Grove Chess mode, `play/grove-chess/play/?mode=adventure`. First built
2026-10-15 as its own page on Changeling's boards, then the same day, at
Timothy's word ("adventure should be rebuilt as a grove mode, shelve
changeling mode for now. everything should be in the grove"), rebuilt on
the Grove's rules, board, runner, suits and weapons. The old address now
sends you here. The name is his working name.

## What he asked for

**First (2026-10-15):** pieces are not forced to capture and do not change
into what they take. You start with a rook, bishop or knight. Their pieces
do not move and are grey, like statues; later levels have purple pieces
that do move. You start with one piece and discover more. Suits and
weapons. Levels can have moving neutral pieces. Capture every piece in as
few moves as possible. Over par you get one upgrade, on par a choice of
two, under par a choice of three. Levels get harder in some random way,
every run is different, and par should be reasonable for how deep you are.

**Then (the same day, later):**

- "i want rabbits possessing the pieces again, it makes the game a bit more
  dynamic. also, after the level is completed, a hole opens up and you jump
  into it to go to the next level"
- "when you get another piece, it now enters your set, and every turn you
  cycle through your piece set. so there is still always just one piece on
  the board"
- "enemy pieces possessed by rabbits still move each turn, each one of
  them. rabbits have colors like before representing what set pattern that
  move in. the pattern should generally be short, super predictable, and
  not land the piece in a stuck position."
- "when you collect more than 5 pieces ... you now shuffle out of your
  total randomly each level as to which ones land in your set five piece
  cycle for that round"
- "you earn pieces by capturing them within the game. you have to capture
  three of a piece to get a copy of it, so capturing gives you a rabbit of
  that piece, and three rabbits combine into one piece that enters your set"

## The game now

You start with your cat, always (Timothy, 2026-10-16; a rook before
that). Take every piece of theirs in as few moves as you can; then a hole
opens and your piece jumps in.

(Since later on 2026-10-16 the troupe, rabbits with a kind and a suit,
suits that work the same on either side, the shield, your pieces with
rabbits and the item card are in "Pieces, rabbits and suits", below; where
a bullet here says otherwise about a suit, a rabbit or a weapon, that
section is newer and wins.)

- **The cat** (Timothy, 2026-10-16: "the player has a special new piece
  call the cat, and it has the move set of the king. it can be given suits
  and weapons like other pieces, and it is always rolled as one of your
  pieces when you play. it is your starting piece. it has some
  customization options as to its model that you can choose, like
  different cat-like features"). `PIECES.cat` in `rules.js`, Betza `K`,
  kind `companion` (not classic or fairy, so no other mode deals it by
  chance; the lab can still use it). Adventure's `startPool` is `['cat']`.
  When your collection is bigger than your set, `adventureSet` always
  draws the cat and fills the rest at random. It takes suits and weapons
  like any piece. **Its look** is chosen on the title screen under "Your
  cat", Adventure only: ears (pointed, folded, tufted), tail (long,
  curled, fluffy), face (whiskers or none) and coat (tabby, plain, socks),
  with a live preview. Kept on this device (`ig.grove.cat.v1`); only the
  model changes, never the moves. In code: `CAT_OPTIONS`, `setCatLook` and
  `catShape` in `models.js`; the sprite cache key carries `catKey()` so a
  change redraws it.

- **Passing, and the order** (Timothy, 2026-10-16: "when you pass, the
  piece you have should move to the next one. when you complete the set of
  pieces you have it should just start again from number 1 -> 2 -> 3 again
  for that level"). A pass ("Pass: the next piece comes on", always there in
  Adventure now, `wait`) spends the turn of the piece on the board, as a
  move does, and their turn follows. The next piece comes on in the set's
  order; when all of the set have gone, a new round starts again from the
  first (`round` counts them; the page's `readyUp` brings on the first). You
  can still tap another under the board. The set itself is drawn at random
  from your pieces at the start of each board, when you have more than
  three. The swap is quicker too (260 ms, from 560: "swapping to the next
  piece should be faster and animated faster").
- **One piece on the board, chosen from your set** (Timothy, 2026-10-15:
  "you don't automatically cycle between your pieces, you choose between
  your set. sets are three instead of five now. however, you have to use all
  three before you can use them again. there is some way to unlock four and
  five set sizes later, not sure how yet"). Your set is three pieces (from
  everything you have collected). One stands on the board, on one square.
  Each move you choose which of the three it is, then move it. Once it has
  moved it is **used** for the round; when all three have had their turn, a
  new round starts and all are ready again. A piece of Gears has two turns
  a round. Each piece keeps its own suit, weapon and spent heart while it
  waits. Before Timothy's change the set (of five) took turns by itself,
  in order.
  - **How you choose:** right under the board is your set, icons only, each
    in its suit's look ("show all pieces in your cycle, and don't show
    text, just the piece icons"). The one on the board is outlined, the
    ready ones can be tapped, the used ones are faded. Tap a ready one and
    the piece on the board spins down into its plinth as that one spins up
    (with a burst of leaves and a grind of stone); its moves light. At the
    start of each turn, if the piece on the board has had its turn, the
    first ready one comes on by itself as a start; tap another to change.
    During their turn the piece standing there is the one that just moved.
  - **No tap to select** ("since we have one piece you shouldn't need to
    tap it to see where you can move ... it should just already have that
    option up"): the piece on the board always has its moves lit; tap a lit
    square to move. Tapping the piece says what it is.
  - In rules: each move carries `as`, the index of the piece of the set it
    is (`playerMove` brings that one on first, `chooseInSet`); `allMoves`
    lists every move of every ready piece, so the solver and the best-move
    button choose too; `isLegal` refuses a used one; `spendTurn` marks the
    piece used at the end of your turn and starts a new round when none is
    ready; `turnsOf` gives Gears two; `setView` is the set for the page;
    `stateKey` keeps who has gone. The row lower down lists the set with
    Now, Ready or Used.
  - **Not decided: how a set of four and five is unlocked.** The run keeps
    `maxPieces` (3 for Adventure now), so the unlock only needs to raise
    it. See "Open, and Timothy's".
- **Suits and weapons, redone for one piece at a time** (Timothy,
  2026-10-15):
  - **Gears**: first "should allow you to skip the piece in the cycle" (a
    skip button). Once you choose from your set a skip means nothing, so
    now a piece of Gears is wound up: it has **two turns a round** where
    the others have one (`turnsOf`). My call, not Timothy's; open to change.
  - **Squash** ("weapons no longer disable the normal capturing ability,
    which is now called squash (this is just the normal chess capturing,
    i've renamed it for clarity and theming reasons)"). Landing on a piece
    to take it, as in chess, is a **squash**. A sword or a lance used to
    lose it (they could not move onto a piece); with `rules.squash` (a lab
    setting, on in Adventure) they keep it and add their own way. The
    mace and the net never lost it. The captions say "You squash their
    knight" for a landing and "You take" for a weapon's strike; their
    pieces squash yours too. Other modes keep the old weapons.
  - **Sword** ("should be based on the direction you move, not just the
    space above"): with `swordAims` (a lab setting, on in Adventure) it
    strikes the square past where it lands, in the direction it moved, to
    the nearest of the eight directions (a knight's L counts as diagonal);
    level 2 adds the squares to either side of that, level 3 the two
    between (`swordAim` in `rules.js`). Elsewhere it still strikes toward
    the other side.
  - **Net** ◍ (Timothy, 2026-10-15: "new weapon/tool: net (like a bug
    net) using it captures the piece you capture, and you just get it
    without having to collect 3 of them"). Adventure's own weapon, so the
    other modes never deal it, and any piece can carry one. It changes no
    move. The first piece of theirs it takes on a board is netted whole:
    it leaves no rabbit, and joins your set when the board ends. Level 2
    nets the first two a board, level 3 the first three. **Why once a
    board:** a net that kept every catch would add a whole board of pieces
    each time, and your collection would outrun what the boards can
    challenge (the design method's "do not let power outrun challenge").
    In rules: `netIt` in `captureFoe` marks the piece (`netted`) and counts
    it on your piece; `netCatches` in `run.js` adds them to your hand; the
    caption says "You netted their wazir"; the row under the board lists
    them under "Netted". Drawn as a bug net beside the piece (`wNet`).
  - Their words follow (`suitDesc`, `weaponDesc` in `run.js`), on cards and
    when you tap the piece. Hearts, Spirals, Stars, Vines, the lance and
    the mace are as they were.
- **Theirs.** Grey statues never move and never take. The rest have a
  rabbit inside and **walk a route every turn, all of them**. A route is
  made of the piece's own moves, so it is easy to read: a rook's route is
  one square at a time, a knight's is L by L. Four kinds, each with its
  rabbit's colour (the plinth under the piece):

  | Route | Colour | Steps | From depth |
  |---|---|---|---|
  | Shuttle | tangerine | there, back | 1 |
  | Doze | sky blue | rest, there, rest, back | not dealt since 2026-10-16 (it rests) |
  | Box step | moss green | round a square: there, across, back, across | 4 |
  | Pace | crimson | there, there, back, back (no rests since 2026-10-16) | 6 |

  **No rests** (Timothy, 2026-10-16: "robot type suit rabbits should move
  every turn, not every other really ever, as it's confusing"): every loop
  Adventure deals takes a step every turn. Doze stays in the lab. (The
  colours in this table are the old route colours; since rabbits are suits
  a walker wears its rabbit's colour.)

  On the board each walker's **whole loop** is drawn in its colour
  (Timothy, 2026-10-15: "you see robot rabbits full move loop on the
  board"): a steady line, an arrow on each leg the way it goes, and a dot
  on every stop; its next step is drawn bolder, to a frame on the square
  it moves to next turn. (Before, the loop was faint and dashed and got
  lost among the pieces.)
  The lines go square by square with right-angle turns, not as the crow
  flies (Timothy, 2026-10-15): a diagonal as a staircase, a leap along its
  long side and then its short one, the way a knight's L is drawn;
  a rest is a dashed frame on its own square. **Stand on that square and it
  takes you.** It threatens nothing else, so its only danger ring is that
  square (red, see "One colour for danger" below).
- **The hole.** Taking the last of theirs wins the board: a hole opens on
  the free square nearest your piece (of those, the one straight on the way
  it was going, so it is not always toward the middle: Timothy, 2026-10-15,
  "hole always shows up in the center space"), and your piece hops into it by itself
  (Timothy, 2026-10-15: "the hole should just be like an animation where the
  piece jumping in, it's boring to have to move it yourself"). There is no
  hole on the board before then, and no flag (that is golf's). Par is the
  moves to clear the board. In rules: goal `'clear'` is won when every one
  of theirs is taken, and `exitSpot` places the hole; the board's
  `intoHole` plays the hop.
- **No pawns** (Timothy, 2026-10-15: "pawns kind of can't be a thing in
  this mode due to them moving in one direction"): none among theirs, so
  no pawn rabbits and never a pawn in your set.
- **Three of a kind.** Every piece of theirs you take counts toward its
  kind, statues included. Three of a kind become that piece, which joins
  your set after the board, up to sixteen pieces in all. The row under the
  board counts them (Knight: 2/3); the turn's caption says so when you take
  one. (These were called rabbits until 2026-10-16.)
- **More than three.** Past three pieces (five until 2026-10-15), each
  board draws three of them at random (in the order you got them) as your
  set, and the rest rest; the row shows how many are resting.
- **Taken** (Timothy, 2026-10-15: "you need to lose all your pieces to
  lose the game"; then 2026-10-16: "when a piece of yours is to be
  destroyed in a level, don't then move the player position, the next
  piece in the lineup simply appears in that spot" and "player pieces when
  captured shouldn't disappear forever, just for that level"). If they take
  the piece on the board, it is out **for this board only**: the next of
  your set appears on the very square it was taken on (or, if something of
  theirs still stands there, the nearest free square that nothing of
  theirs reaches), and the board goes on. Next board it is back. The
  caption says who took what and how many of the set are left; the row
  under the board lists the lost, struck through. If they take **every
  piece of your set on one board**, the adventure is over (my call: the
  rule had to end somewhere once losses stopped being permanent). In
  rules: `nextAfterLoss` runs after their turn (in `respond` and `apply`),
  marks the set entry `lost`, and picks the square with `entrySpot(n,
  lostPiece)`, centred on the lost piece; `afterAdventure` in `run.js` no
  longer removes anything from your collection and returns `{ lost, all }`.
  **Par stays a clean clear:** the solver does not search past a loss
  (`ch.arrived` in `solve.js`), so par never asks you to sacrifice a piece.
- **Between boards** (Timothy, 2026-10-16: "we don't need descriptions for
  the upgrades at the end of the level. the falling animation should cover
  the whole screen and you just choose which upgrade you want from the
  icon and names"). The fall fills the screen: its canvas takes the
  screen's shape (short side about 240 pixels, enlarged in crisp pixels)
  and sits fixed behind everything (`fullfall` on the between screen).
  The score line is at the top, the cards along the bottom, each only its
  mark and its name. Other modes keep the old boxed fall and full cards.
- **The piece strip is bigger** ("the piece chooser bottom bar should be
  bigger so we can see them"): slots 76 by 84, each piece drawn at twice
  the size, in its suit's look, with its weapon beside it.
- **Animations** (Timothy, 2026-10-16: "animations for: a piece being
  transformed into a suit - a piece equipping a weapon - a piece capturing
  with a weapon - completing the level"):
  - *A suit*: on the way down, the piece you gave it to spins faster and
    swells, flashes, and comes out of a burst in the suit's colour wearing
    its new look, with a shimmer up the scale (`restyle` in `fall.js`,
    `sfx.transform`).
  - *A weapon*: it drops in from above, spinning, into the piece's hand
    and clicks into place with a ring of its colour (`arm` in `fall.js`,
    `sfx.equip`). Falling pieces now carry their weapons.
  - *Capturing with a weapon*: a sword's white slash across each square it
    strikes; a lance's gold streak down its run, sparking at each piece it
    passes; a mace's double shockwave and cracks where it lands; a net
    dropping from above over what it catches and drawing tight, then a
    gold ring. Each has its own sound (`sfx.weapon`). In code:
    `weaponWork` in `board.js` reads the move (its `strike`, `pass`,
    `stun`, `push`) and a net's new catch, and `drawWeaponFx` draws them
    on both boards. They live on the board (`this.fx`), not the move's
    tween, so their reply does not cut them short.
  - *Completing a board*: the score word (Eagle, Birdie, Par...) pops up
    over the board with the moves and par under it, in a burst of
    confetti in the suits' colours, then your piece hops into the hole
    (`cheer` in `play/main.js`, `#cheer`). Reduced motion keeps the word
    and drops the confetti.
- **Par and the cards** (Timothy, 2026-10-15: "par should be 5 moves to
  start (so par 5 i guess) meaning a birdie is 4, eagle is 3, bogey is 6,
  and so on. every three levels the par goes up one (5,6,7,8) up to 15. par
  gives two things to choose from, birdie gives three, eagle four, bogey or
  lower no choice just one, less than bogey no choice and also no choice of
  what piece it gets applied to"). Par is set by depth (`adventurePar` in
  `modes.js`): 5 on boards 1 to 3, 6 on 4 to 6, and so on, at most 15.
  After a board:

  | Score | Moves | Cards |
  |---|---|---|
  | Eagle (or albatross) | 2 or more under | choose one of four |
  | Birdie | 1 under | choose one of three |
  | Par | par | choose one of two |
  | Bogey | 1 over | one card; you choose the piece for it |
  | Double bogey or worse, or not cleared | 2 or more over | one card, given to a piece by chance |

  `parVerdict`, `PAR_CARDS`, `PAR_AUTO` and `scoreName` in `run.js`. Cards
  are suits and weapons only: new pieces come from rabbits, the net, and
  the two given (below).
- **Two pieces given** ("you should get a bishop after level one, then a
  knight after level 3, so you have a set to work with on future levels"):
  a bishop joins your set after the first board, a knight after the third,
  however each went (`ADVENTURE_GIFTS`), said between boards with a
  fanfare.
- **Let the floor give way.** A board can still leave no way through once a
  piece of your set is lost. A quiet button ends the board, not cleared, in
  two taps (the first says what the second will do), so nobody has to play
  out forty moves to find out.

## Pieces, rabbits and suits, 2026-10-16 (later)

Timothy's list, in his words where they set a rule, and what was built.
This replaces "Rabbits are suits", which lasted most of the day: a rabbit
was a suit, a different power in your piece and in theirs. Now a piece
can have four things, each doing one job: **"a piece can have type, a
rabbit, a suit, and a weapon/tool"**. The type is its move shape; the
rabbit how it moves by itself; the suit a perk; the weapon how it takes.

**Fixes first.**
- *Switching pieces* ("kind of slow, not sure if that's intended or it's
  lag"): both. The spin was 260 ms and the board waited for it before
  lighting the new piece's moves; with a phone's speed (measured at four
  times slower) frames came 30 to 80 ms apart. Now the spin is 170 ms, the
  new piece's moves light at once, and you can play one while it spins
  (`choose` and `readyUp` in `play/main.js` no longer wait).
- *Sixteen at most* ("a max deck of pieces is 16, as an homage to regular
  chess"): `ADVENTURE_MAX` and `roomFor` in `run.js`. Three of a kind, the
  net and the gifts add nothing past sixteen, and the page says so.
- *The cat* ("more regal, stand upright, and have armor on"): it stands on
  its hind legs in a steel breastplate, shoulder plates, greaves and a belt
  of tassets, with a cape and a gold coronet between its ears. The gorget
  at its throat is the trim where a suit's motif sits. Ears, tail, face and
  coat are chosen as before (`catShape` in `models.js`).
- *Hearts* ("heart pieces stay where they are after being hit, and the
  piece that move to capture it then moves back to its original spot"):
  see the suits, below.
- *No other fairy pieces* ("for now, no fairy peices outside of our
  companion and other owns i define from here, for testing purposes"):
  theirs are the classic pieces and the troupe (below) only, the troupe
  from depth 4 and the queen from 8 (`foePool` in `modes.js`).
- *A robot's next square* ("should be the color of the line that shows its
  path, not red"): framed in its loop's colour, with a dark edge, not
  ringed red (`reachMaps` puts it in `steps`, not `theirs`;
  `Board3D.route` frames it).

**The troupe** ("fairy peices available currently in adventure, all of them
basically new ... they should look like chess peices, not people"). Kind
`troupe`, so no other mode deals them. Each is a turned piece with the tool
of its art at its head.

| Piece | His words | As built | Betza | Head |
|---|---|---|---|---|
| Thespian | "gets a random moveset from another peice every time" | moves as another piece (`role`), and takes a new part at random every time it moves | K (before a part) | the comedy and tragedy masks |
| Scribe | "one space any straight, then one space any diagonal" | a knight's L that a piece on its first square blocks; turning back on the diagonal is one square straight | nNW | an inkwell and a quill |
| Painter | "knight, but slides instead of hops" | the knight's L again and again in a line (the nightrider) | NN | a palette and a brush |
| Bard | "rook and bishop, but only every other space. hops every other space" | two squares straight or diagonal at a hop, over anything, and on while it lands on empty squares | DDAA | a lyre |
| Dancer | "hops to any space two away" | any square exactly two away (the squirrel) | NAD | a ribbon twirling |

- The thespian's parts are king, queen, rook, bishop, knight and the other
  four of the troupe (`THESPIAN_ROLES`). The part is drawn from the level,
  the turn and its square, so the solver and a replay see the same
  (`recast`). Its card says the part; on the board it holds up a little grey
  model of it. It walks no loop, since its moves change.
- *Calls of mine*: "any diagonal" read literally gives the scribe the four
  squares beside it as well as the knight's eight; its Betza is `nNW`, so
  the side step is not blocked the way the literal two steps would be (a
  difference only when both squares beside it are taken). "Slides" read as
  fairy chess's rider: the painter is the nightrider.

**Rabbits have a kind and a suit** ("rabbits have a type and a suit now.
the lore is that rabbits are eating playing cards and that's why they have
a suit. so there can be a 'scared rabbit of hearts' or a 'robot rabbit of
spirals'"). The kind is how its piece moves by itself, the colour of its
plinth (`RABBITS` in `run.js`); the suit, if it has one, the colour of its
piece. A statue has neither.

| Kind | Plinth | In theirs | In yours |
|---|---|---|---|
| Robot | tangerine | walks its loop, a step every turn; its next square framed | walks there and back along its shortest move toward the nearest of theirs |
| Sentry | red | strikes anything of yours in its red reach, from where it stands | every turn strikes the most valuable of theirs in its reach |
| Scared | sky blue | runs when you attack it, one a turn (fork it, or pin it) | runs when they could take it |
| Sentient | ink | thinks one move ahead and moves every turn ("actual piece behavior like a game of chess against an simple ai"), from depth 10 | plays by itself, one move ahead |
| Simple (later) | lime | one move a turn along its line toward you, all the way ("just moves once, all the way if it's a slider and one hop for a leaper"), turning back at the end; the line drawn, its next square framed; from depth 4 | the same, along a line toward the nearest of theirs |
| Trap (later) | magenta | takes anything of yours in its reach as a sentry does, and stays on the square it took ("sentry but doesn't move back to its new spot"); from depth 7 | the same, on theirs |

(The "in yours" column is what a piece of yours does while it stands on
the board by itself: see "Every piece stays where it moves", below.)

The sentient rabbit is the rabbit minds' one-move look (`mindStep`), a
hunter in theirs and aggressive in yours. Their sentries strike your piece
first, then your pieces with rabbits, then stones.

**Your rabbits** ("at the end of a level, you now have a chance of
capturing a rabbit ... normally you just get suit cards, but rarely you get
a rabbit. rabbits, when added to a piece, allow it to be sort of be
automated. peices with rabbits stay behind after you move with the
following peice ... the peice is placed in the new spot rather than in the
spot it started ... and then stay there").
- After a board on which you took a piece with a rabbit, one card in five
  of the offer is that rabbit (`RABBIT_CHANCE`, `rabbitsTaken`), for a piece
  of yours with none. It brings its suit to a piece with no suit.
- Move a piece with a rabbit and it stays on the square it moved to, out of
  your set for the rest of the board (`deploy` in `rules.js`: an `ally` in
  `s.pieces`, its set entry `out`); the next of your set comes on where it
  started. From the next turn it acts by itself at the start of every turn
  of theirs (`alliesAct`), a scared one at once. Its loop, if a robot, is
  drawn like theirs; its plinth is your white with its rabbit's colour on
  the band. It pins and threatens like your piece. It stays only while
  another of your set is there to come on; if the last of your set is
  taken, the first of them is your piece again (`recall`). After the board
  it is back in your set.
- *Calls of mine*: it does not act on the turn it stays (it moved already),
  except a scared one, which must be able to run from where it landed; a
  pass does not leave it behind.
- Since later the same day this is true of every piece of your set, with a
  rabbit or not, and pieces come off at the end of each round: see the
  next section. `recall` is no longer reached in Adventure.

**Every piece stays where it moves** (Timothy, 2026-10-16: "pieces even
from the [start] leave themselves behind after being played. the rabbit
simply defines what the peice does after its now on the board. after the
full set is played, they are removed from the board and then it starts
again").
- *The order* (Timothy, 2026-10-17: "so i think we got it flipped: the
  piece moves, then its transforms into the next piece. then, after that
  piece leaves that spot, the old piece stays there"). Release 86 had it
  the other way round: the piece stayed where it landed at once, and the
  next came on where it had started. Now (`deploy`, `pending`):
  1. Each turn you choose a piece of your set that is ready, and it moves.
  2. It turns into the next of your set that is ready, on the square where
     it landed (the turn spin, as before); you may still choose another.
     It is `pending`: inside the next piece, not on the board.
  3. When that next piece moves off the square, the one before is left
     standing on it (`standBehind`; the free square nearest, if that one
     is taken).
  So your piece walks on as it did before the change, and leaves a trail
  of your pieces behind it, one move behind. A piece with no rabbit just
  stands: it blocks, it can be taken (then it is out for the board), and
  it pins and gives check like any piece of yours. A piece with a rabbit
  acts by it from the turn it is left standing.
- When every piece of the set has had its turn, the one that moved last
  stays your piece (nothing is pending), the pieces standing act once
  more, and at the end of their turn they all come off the board
  (`newRound`, from `turnOver`), back into your set as they are (a heart
  spent stays spent). The new round starts from where the last one landed,
  with the first of your set. A puff where each stood, and the caption says
  so.
- If your piece is taken and none of the rest is ready, the same: the
  pieces standing come off, and the first comes on where it was taken.
- *Calls of mine*:
  - The round ends after the standing pieces have acted on its last turn,
    not before.
  - A pass leaves nothing behind and turns into nothing: the piece did not
    move. A piece still pending is left behind when the next piece that
    moves leaves its square.
  - A piece whose move ends where it began (a heart sent it back) still
    leaves the one before standing, on the free square nearest.
  - The board cleared ends it at once, whoever is standing (the hole is an
    animation, as before).
- **Par, measured again.** Two fixes so dealing keeps up with the rule:
  - The solver's sense of progress (`score` in `solve.js`, Adventure only,
    so the daily is untouched) counted a piece lifted at a round's end as
    lost, and measured nearness from pieces just standing, which take
    nothing. Now it counts what the whole set can take from where the next
    comes on, and what standing pieces with a rabbit can.
  - A first deal that finds no win gives up after seven seconds, not
    fifteen, and deals again with fewer of theirs (`relax`).
  - A board that comes in short is dealt again with more to do once, not
    up to three times: under the new rule a second or third time never
    landed on par (0 of 11 in the measure), and each cost about five
    seconds.

  Measured as before (51 boards a hand, depths 1 to 28), with the order
  fixed (2026-10-17): the plain hand 51 of 51 two or three under par, a
  deal 0.9 seconds in the middle, 8.4 for the slowest tenth, 21 at worst.
  The strong hand 33 of 51, a deal 1.0 seconds in the middle, 11.7 for the
  slowest tenth, 16 at worst: from depth 10 on its boards come in 4 to 6
  under, its suits and rabbits clearing more than a 7 x 7 board can hold.
  Three re-deals instead of one gave the same 33 (a second or third landed
  on par 0 times of 8) and cost five seconds more at the slow end. Open: a
  bigger board for strong sets.

**Suits, the same on either side** ("they also apply about the same for
player and enemy pieces now"). Colours: hearts red, vines green, stars
yellow, spirals purple, gears copper. Stone is gone ("stones - removed").

| Suit | Both sides |
|---|---|
| Hearts | Two lives. Hit once, it stays where it is, its heart spent, and the piece that hit it goes back where it came from (a robot that bounced tries the same step again). A little heart floats over it while the heart is whole |
| Vines | The vine trap as before: a trail where it moved; the other side's next move landing on it is caught |
| Stars | Two moves a turn, but it takes at most once ("can still only capture once"): if the first took, the second cannot. Their robots walk two steps |
| Spirals | Chain captures for as long as it can take ("perpetual"); a sentry of spirals strikes all in its reach. On a capture only (since "Tuned to par again"): a hit that a heart holds sends the hitter back and ends the chain |
| Gears | Trades squares with another piece, as its move. Yours: with any piece on the board, theirs too. Theirs: a scared one can run by trading with another of theirs out of your reach, and a sentient one may trade as its move |

Their rabbits carry suits from depth 5, one suit at a time (vines 5,
stars 6, spirals 8, gears 10), more of them deeper (45% at depth 5 rising
to 70%: `suitChance`). Hearts is dealt by count instead, from depth 4 (see
"Tuned to par again" below), on any of theirs, statues too. "Pieces
without suits are gray."

**Weapons** ("weapon/tool defines capture style").
- Sword and lance: as they were.
- Mace ("still stuns and no longer pushes anything, just adds the AOE stun
  to the landing (also make sure stun functionality actually works)"):
  every move, slide or not, stuns theirs round where it lands, by level.
  The stun did not work in Adventure's turn before (their pieces walked and
  struck stunned, and the caption came too late to show); now a stunned
  piece sits out their whole turn, said in the caption, with stars over it.
- Shield (new, Adventure's own: "pushes pieces, can still squash. just the
  push. if the piece is pushed off the board it is captured"): a move onto a
  piece of theirs can push it one square on, the way it moved, and take its
  square; up to its level in a row go together; off the board, it is taken.
  Any piece can carry one (`shoves` in `rules.js`).
- Net ("nothing new but you are guaranteed to get the corresponding rabbit
  of the peice you capture"): it still nets the piece whole, and the rabbit
  inside, if any, is yours: after the card you put it in a piece.
- **More than one way onto a square** (Timothy, 2026-10-16: "getting some
  weird popup that asks to turn a pawn into something when i move the cat").
  A shield gives two moves onto a piece of theirs (squash it, or push it);
  gears gave two (squash it, or trade places). The page asks which, but the
  box was written for a pawn promoting and said so. Now it says "Your cat
  can go there more than one way" and names each move (Squash it, Push it,
  Push it off, Swap places, Strike); the pawn's words are kept for a pawn.
  And gears no longer offers a trade onto a piece it can take, since taking
  it is the move anyone wants: no box at all there.

**Three of a kind.** Pieces you take still count toward their kind, three
to a piece (`takeTally`, `run.tally`). They were called rabbits; now that
rabbits are what is inside a piece, the row under the board says "Three of a
kind".

**Seeing it all.**
- *Card-suit icons* ("good drawn icons for each suit, that look like card
  suits"): `icons.js` draws each suit as one solid shape in SVG, a heart, an
  ivy leaf on a curling stem, a star, a spiral, a cog; a rabbit's head for
  rabbits, and the five weapons the same way.
- *Cards* ("suits upgrades should be presented as cards with the suit on
  them"): between boards each offer is a playing card, the pip in two
  corners and large in the middle, dealt in with a flick.
- *An item card* ("we need like an item tooltip thing games have for
  inspecting pieces on the board"): hold any piece (on the board or under
  it), or rest the mouse on it, and a card says its name, its moves (and a
  thespian's part), its rabbit, its suit, its weapon and how it stands now
  (a heart spent, stunned, pinned). Tapping a piece that is not a move shows
  it too.

## The look of your pieces

In Adventure each piece of yours wears its suit. Timothy asked in steps on
2026-10-15: first vines and suit colours, then "your pieces should start at
gray with no special visual ... you can mess with the actual 3d model of
the piece itself", then, after seeing busy ornaments, "the new models for
suits are a bit much, maybe start from scratch there. more tasteful this
time while integrating the idea of the suit into the model".

So each look is the piece's own shape in its suit's colours, and one thing
of the suit made part of it, at its collar, where the trim already sits
(`LOOK_BUILD` in `models.js`, `model(kind, look)`):

| Suit | Body | Its one motif |
|---|---|---|
| none | the grey of their statues (Timothy, 2026-10-15: "default pieces should just be gray, not the white we have now"), on your own plinth | none: a gold finial |
| Vines | the Grove's green | a wreath of eight leaves round the collar |
| Hearts | rose red | a pale heart locket on its chest, pink trim |
| Gears | copper (blue steel until 2026-10-16) | a brass collar toothed like a gear |
| Spirals | purple (amber until 2026-10-15) | the whole piece twisted about its axis |
| Stars | gold | a star brooch on its chest |

A stone it leaves behind is the same, darker, on pebbles.

How a motif finds the collar: each piece is built with its trim and gold
in two marker colours no piece uses (`MARK_TRIM`, `MARK_GOLD`). `collarOf`
finds the marked trim faces, so it knows the collar's height and how far
out it reaches; then `finish` recolours the markers to the suit's accent.
This works for every piece, including the knight, whose "collar" is its
mane. `twist` turns every corner about the axis by an angle that grows with
its height, and recomputes each face's facing so the renderer still culls
the right side.

A plain piece of yours is the same grey as their statue pieces; your
plinth (pale stone, theirs is darker) and the gold finial are what mark
it as yours. The board (`board.lookOf`), the set row, the
next-up strip, the intro's cards and the fall between boards all use the
look.

## How it is built, in Grove terms

It is a descent (`run: 'descent'`) with its own way between levels,
`upgrades: 'par'`. New engine parts are general settings, so the lab can
use them too.

- **The preset** is `MODES.adventure` in `modes.js`: one piece to start,
  a set of five (`maxPieces`), goal `'clear'`, `darkBrain: 'possessed'`
  with `patterns: 'routes'`, `oneMove: false` (all of theirs move every
  turn), and `cycle: true`.
- **Goal `'clear'`** (`rules.js`): every piece of theirs is marked, and
  `goalMet` is true once they are all taken. At the end of that move
  `playerMove` puts the hole on the free square nearest your piece
  (`exitSpot`); the board animates it opening (`animate`, a hole where
  there was none) and the runner plays the hop in (`intoHole`).
  `EXIT_DESC` says it in words. (Until release 69 you had to move onto the
  hole yourself, and par counted that move.)
- **Routes** (`lab.js`, `ROUTES` and `dealRoutes`): dealt last, on the
  finished level. For each piece of theirs, in random order, a route kind
  the depth allows (`routeKinds`) and a move `v` (and `w` for Box step)
  from its own shortest moves. `routeSquares` (`rules.js`) walks it once
  round with the real move code and keeps it only if it is never blocked,
  never bounces off an edge, and ends home facing the same way. No two
  routes share a square, none crosses your square or the hole, and each
  touches a square your set can reach. A piece with no route (any pawn,
  which never steps back) is a statue; a level dealt all pawns turns one
  into another of the pool so someone walks. In play a walker that finds
  you on its next square takes you, or if it cannot (a cannon next to
  you), waits and tries the same step again (`f.route` in
  `possessedStep`), so it never falls out of step.
- **Reach** (`setReach`): the squares your whole set can get to from where
  you start on the empty board. A lone bishop keeps to its colour, so
  statues and the hole are moved onto its colour. Without this, a bishop's
  board could be unwinnable.
- **The set** (`cycle`, `rules.js`): `makeLevel` keeps only the first
  piece on the board and the whole set as `day.cycle`; the state carries
  `s.set` and `s.ci`. At the end of every turn (`nextInSet`, called in
  `apply`, `respond` and `respondWith`) the board piece's own fields go
  back to `s.set[s.ci]` and the next entry comes out, keeping the square
  (`PLACE` lists what stays). `stateKey` includes `ci`, so the solver
  treats the same square as a different position for a different piece.
  `setOrder` gives the order from the board piece on, for the row.
- **The run** (`run.js`): `adventureSet` picks the board's set (all, or
  five at random from a seed of the run, the depth and the collection's
  size, so finding and playing agree); `handSettings(run, pick)` deals only
  those; `afterAdventure` removes the piece taken on the board and keeps
  hearts spent; `takeRabbits` counts rabbits by kind (`run.rabbits`) and
  turns every three into a piece; `adventureCards` deals suits and weapons
  only.
- **Every board is vetted** ("levels should be vetted before generating
  each time, should be verified that they can be completed"). The solver
  (`searchLayouts` with `quick`) wins every board before it is played: it
  looks for a layout whose best line is two under par (an eagle) or three
  (an albatross), so an eagle is always there to find; one it wins in
  fewer is kept, and after four seconds the longest of those is taken. A
  deal where the solver wins nothing is dealt again with fewer of theirs
  (`relax`, and from the third time no sentries or scared ones), up to
  twelve times; an unsolved board is never played (before, a search that
  ran out of time played its seed unsolved, which is how a lone rook could
  meet a sentry it could never take). Their number follows the best line
  asked for: one or two fewer pieces than its moves, at most eight. On
  boards with a best line over six moves the solver searches narrower (it
  only has to prove a win inside par), which took a deep deal from about
  15 seconds to about 4. Measured in node, depths 1 to 31: 0.2 to 4.2
  seconds a board.
- **Deep down, par outgrows the board.** A 7 x 7 board holds eight of
  theirs, whose best line is about nine moves; par keeps rising to 15, so
  from about depth 19 (par 11) boards come in well under it and eagles get
  easier. Bigger boards, or a lower top par, would close that; open.
  (Mostly closed since: see the next.)
- **Tuned to par again after the troupe, rabbits and suits** (Timothy,
  2026-10-16: "make sure levels are tuned properly with par rules that i
  set out now that we have all these changes"). His rules: par 5 at first,
  one more every three depths up to 15; birdie one under, eagle two,
  bogey one over; boards dealt so the solver's best line is two or three
  under par, so an eagle is always there to find. The new pieces broke
  that deep down: a gears cat, a shield, a spirals chain and pieces left
  standing with rabbits clear a board in far fewer moves, and hearts (now
  on either side) add moves the deal did not count. Four changes:
  - *Spirals chains on a capture only.* A piece of spirals hitting a
    piece of Hearts was sent back and then chained on, from where it
    started, as if it had taken: it could hit every heart twice in one
    counted move, so a board with more hearts came out *shorter* (one
    deal: eight of theirs, seven of them Hearts, best line 2 moves against
    par 14). Now a hit that a heart holds ends the chain, on every side
    (your piece, your pieces with rabbits, theirs, their sentries), so a
    heart costs a move, as two lives should. My call, from his rules:
    hearts "stay where they are after being hit, and the piece that moved
    to capture it then moves back", and the chain is a "chain capture".
  - *Hearts by count.* A heart of theirs is one more hit, so the deal now
    counts it as part of the best line: the hits it wants (best line less
    one or two) are split between pieces and hearts, from depth 4
    (`hearts` in `levelSettings`, "Of theirs, of Hearts" in the lab).
  - *Press.* A board whose best line comes in shorter than asked is dealt
    again with more to do (`press`: two more hits each time, one size up
    at the second), up to three times (once since "Every piece stays"); the longest found is kept. This is
    the other half of `relax`, which deals fewer when nothing is won.
  - *Faster solving*, so the extra deals fit: each piece's Betza moves
    are worked out once per side, the squares two away once, a state is
    copied field by field, and where the next of your set comes on after
    a loss uses the lighter danger map (`foeDanger`). That last one is a
    small rule change: a square only a statue, a scared one or a stunned
    one could reach no longer counts as in their reach when picking it.

  Measured in node, dealt as the page deals, three seeds a depth at
  depths 1 to 10, 12, 14, 16, 18, 20, 24 and 28. With a plain hand (a cat
  of hearts, a bishop with a sword, a knight, a rook, a painter): every
  board two or three under par, none outside it (release 84: 48 of 51,
  three 4 or 5 under). With a strong hand (a gears cat, a shield bishop
  with a sentry rabbit, a spirals knight with a sword, a stars rook with a
  robot rabbit): 44 of 51 two or three under; the other seven, all at
  depth 14 or deeper, 4 or 5 under, since that set clears boards faster
  than eight of theirs on a 7 x 7 can hold (release 84: 32 of 51, the
  worst 10 under). A deal takes about a second in the middle, 10 to
  15 at the slow end, about 23 at worst; in Chromium a strong set at
  depth 13 and 14 took 17 to 19 seconds, the cost of dealing again. Open:
  dealing faster, or a bigger board for strong sets deep down.

| Depth | Par | Best line | Board | Theirs | Routes | Clouds |
|---|---|---|---|---|---|---|
| 1 | 5 | 2-3 | 5 x 5 | 2 | Shuttle | none |
| 2-3 | 5 | 2-3 | 5 x 5, odd shapes from 3 | 2 | + Doze | none |
| 4-6 | 6 | 3-4 | 5 x 5 or 6 x 6 | 2-3 | + Box step | some, from 5 |
| 7-9 | 7 | 4-5 | 6 x 6 or 7 x 7 from 8, crumbling from 6 | 3-4 | + Pace | some |
| 10+ | 8 to 15 | par minus 2 or 3 | 6 x 6 or 7 x 7 | up to 8 | all | some, sometimes 2 |

Harder from the start since 2026-10-15 (Timothy: "early levels should be a
bit harder"): one more of theirs and one more walking at every depth, the
longer routes a depth or two sooner, and par no longer pays for the jump.

[`adventure-check.mjs`](../play/grove-chess/adventure-check.mjs) proves the
statues, the Changeling, the routes (72 dealt boards, 24 turns each: never
stuck, home after every round, no shared squares, pawns still), a walker
taking you, the hole (shut, open, sink, no sliding over), the set taking
turns and keeping suits, five of seven, rabbits, losing a piece, dealing
with a par that clears the board and opens the hole at five depths, no pawns among theirs, and the cards.

## The Changeling piece

The consolation for shelving the Changeling daily: a Grove fairy piece. It
steps like a king until it takes something, then moves like the last piece
it took, and changes again with every capture (`reshape` in `rules.js`,
for either side). Its shape is drawn as that piece on a plinth of fairy
silver, says so when tapped, and lasts the board. It cannot be fused. Its
model is a hooded fairy child with a borrowed face. Three Changeling
rabbits make you one.

## Paths

| Path | In? | Within one board | Within a run | Across runs | Notated by |
|---|---|---|---|---|---|
| Mastery | in, the core | the route through moving walkers and a changing piece; beating par | planning around the set's order | knowing each route and each set | written (par, the verdict), visual (routes, next steps, the set row), audial (the fanfare climbs with how far under par) |
| Collection | in | three of a kind make a piece; a rabbit now and then | a growing set, up to sixteen, and rabbits put in pieces | none yet | visual (the set row, the counts, the cards), written (captions) |
| Power | in, a run's curve | suits and weapons change your moves | one piece to five, then more to draw from | resets each run | visual (suit colours, weapons), written |
| Customization | light | none | which upgrade, on which piece | your first piece | written |
| Narrative | thin | adventure: down through the Grove, into the hole | what you picked up, what you lost | none | visual (the hole, the fall) |
| Social, world, competitive | out | | | | |

**Tensions to watch:** a big set dilutes the cycle (more pawns means more
turns as a pawn); power from upgrades against a challenge that grows only
by count and board size; wandering clouds hiding a walker, against "super
predictable".

**Gaps, and ideas (not built):** choosing which rabbits combine or setting
the set's order (customization); something that lasts between runs (the
descent's roster could carry); a walker's colour learned across runs like
the daily's rabbits.

## Tactics: chess technique with one piece at a time

Timothy, 2026-10-15: "i want to find a way to still have opportunities for
pinning and other chess technique even though we are working with one
piece at a time"; then, of seven ideas, "let's do everything but 6. also 5
should be a new suit called stone that lets you leave a sentry behind of
your piece." Chess technique needs pieces that defend, lines through
pieces, an opponent who can answer only one thing at a time, and something
precious. Each of these adds one of them back. All in `rules.js`
(`tacticsTurn`, with `rules.tactics`), dealt by `lab.js` (`dealRoutes`).

**Three kinds of rabbit** (Timothy, 2026-10-15: "i think sentry can be a
kind of rabbit. there there are rabbits that flee, rabbit that move to
attack if you enter their highlighted reach, and ones that move a set loop
of moves, tracing shapes. the three maine categories could be called
scared, sentry, and robot rabbits"). Every piece of theirs that acts is
possessed by one, and its fur says which:

- **Robot** rabbits (the route colours) walk a set loop, tracing a shape.
- **Sentry** rabbits (red) stand still and leap on you if you enter their
  red-ringed reach.
- **Scared** rabbits (snow white) run when you attack them.

A statue with no rabbit does nothing. `FUR` in `rabbits.js` holds the
colours; `patternName` on the piece is 'Sentry' or 'Scared' for the two new
kinds, so the fur, the possession animation and the pieces sheet all treat
them as rabbits like the robots.

**First, the turn order changed.** Your piece now becomes the next of your
set at the end of your move (`nextInSet` in `playerMove`), before they
answer, so a threat, a pin or a check is made by the piece that will move
next turn and can follow it up. On screen nothing looks different.

Their turn, in order:

1. **Pins.** A line from your piece, or a stone of yours, through one of
   theirs to another of theirs behind it pins the front one for the turn:
   it cannot step, strike, run or block (`tacticalPins`). Only sliding
   pieces have lines. Pinned pieces wear the Grove's pin needle.
2. **Check** (out of Adventure since 2026-10-15, Timothy: "get rid of the
   leader thing i think that's what confusing me"; the engine keeps it as
   the lab setting "A crowned leader", off by default, and this is how it
   works there). Their **leader** is a crowned King (gold plinth, a gold
   crown). If you attack it they answer: a piece of theirs takes the
   attacker if one can (the King itself only where nothing else of yours
   guards that square); else one steps into the line to block, and stands
   guard there from then on as a sentry; else the King runs to a square you
   do not attack; else it is **checkmate**: every piece of theirs falls and
   the board is yours. Attacked twice at once (double check, say your piece
   and a stone), only running will do. A red ring marks a leader in check.
3. **Flight.** A piece with a **scared** rabbit (snow white fur) runs to
   a square you do not attack when you attack it, but only one runs a turn,
   the most valuable that can. Attack two at once (a fork) and the other is
   left; pinned, it cannot run. A gold ring marks one that could not run.
4. **Walkers** take their steps, except the pinned, which hold.
5. **Sentries** (a red rabbit) never walk, but each takes anything of
   yours standing where it attacks, your piece first, then a stone, moving
   onto it. Their reach is ringed red, so you can see where not to stand.
6. **Your stones** each take one of theirs that moved this turn into where
   they attack, moving onto it: a trap, not a turret, so a stone never takes
   a statue that only stands on its line.

**The Stone suit** (gone since 2026-10-16, Timothy: "stones - removed"; the rules still know stones, for the lab's leader boards) (◆, sandstone, Adventure's own, so it never turns up in
the other modes). Since 2026-10-15 (Timothy: "stone suit now leaves behind
a sentry of their piece each time it moves? and it lasts for three moves
than disappears"): every move of a piece of Stone leaves a stone copy of
itself on the square it moves off, with no button to press. Each stone is
a sentry of yours for three turns: it stands through their turn just after
it is left and two more, then crumbles away (a puff of grit and the
crumble sound). A number at its corner counts the turns it has left, and
it sinks and shrinks a little as it wears. Its reach is ringed in sand on
the board while it stands (2026-10-16, Timothy: "we should see your
sentries reach while they are present to be able to plan tactics"),
inside any red ring, so you can see where a walker would step into it
(`reachMaps(s).stones`). While it stands it strikes as
above (what moves into its reach), pins and gives check along its lines,
and their pieces can break it. Your Stone piece is sandstone with carved
bands; a stone left behind is darker, on pebbles. In rules: the stone is
pushed in `playerMove` with `left: STONE_TURNS` (3), and `stonesAge` takes
a turn off each at the end of their turn (`turnOver`, in `respond` and
`apply`). Before this it was once a board, by a button.

**One colour for danger** (Timothy, 2026-10-15: "not sure what the purple
highlight is for vs the red"). Purple rings marked two things: a robot
rabbit's next square, and the crowned leader's reach. Red marked a
sentry's reach. Now, on a board with tactics, every danger ring is red and
means one thing: end your move here and something takes you. That is a
sentry's reach and a robot's next square (its loop no longer frames that
square in its own colour too, since the red ring does). The leader's reach
is not ringed at all: it takes only in answer to a check, and then only
where nothing of yours guards the square (`reachMaps` skips it, which also
keeps it out of where a lost piece's replacement may land). Other modes
keep their purple reach.

**Their pieces wear their suit** (Timothy, 2026-10-15: "since there's just
one piece at any given time we don't need the purple pieces are the bad
ones distinction we had before. enemy pieces are just based on their
suit"). In Adventure their pieces are drawn with the same looks as yours
(`board.lookOfFoe`, `suitLook`): plain grey without a suit, which in
Adventure is all of them for now. What tells them apart is the plinth: the
rabbit's colour (a robot's route colour, red for a sentry, white for a
scared one, gold for the crowned leader), grey for a statue, pale stone
for yours. The board, the tumble when one is taken, the intro's cards, the
pieces sheet and the Grove's preview all follow. Spirals turned purple the
same day, everywhere, since purple no longer means theirs here.

**Arrival, one at a time:** a sentry from depth 2, a scared rabbit from 4.
Pins work from the first board. No leader (it was dealt from depth 6 for
part of a day, then taken out).

**Checkmate is a shortcut** (lab boards with a leader only), since it
topples the board, so leader boards are dealt with care: the King starts with at least three open squares
round it and two or more from you, the sentries are the statues nearest
it (its bodyguards), par must be at least 4 plus a third of the depth, and
an exact search (as far as a budget lets) throws out any board that falls
to a mate sooner than that.

**In words:** the turn's caption says what happened: "Your rook pins
their knight: it holds", "Check! Their bishop steps in to block", "Double
check! Their leader runs", "Checkmate!", "Fork! Their bishop could not run
as well", "Your stone takes their camel". Tapping a sentry, a scared
rabbit, the leader or a stone says what it does; the pieces sheet lists them.

**Not built:** idea 6, skewer chains (a free move to take the piece behind
the one you take).

**The solver** now counts a win on their turn (checkmate, or a stone
taking the last of them) as a win (`solve.js`); before, it was thrown away
as game over.

## Open, and Timothy's

- From 2026-10-16 (later): whether a sentry of yours should strike
  anything in its reach (as now, so a sentry by a row of statues clears
  them one a turn) or only what moves into it, as stones did. Whether your
  pieces with rabbits should act on the turn they stay (now only a scared
  one does). The scribe's side step (from "any diagonal"), and the painter
  as the nightrider. Whether a rabbit's suit should come to a piece that
  has one already (now it does not). How rare a rabbit card is (one board
  in five, of boards where you took one).
- Deals are slower with suits and sentient rabbits deep down: about 3
  seconds a board at depths 8 to 12 (2.2 without them), some seeds 15;
  the page deals again with fewer pieces when one runs long.

- Losing every piece of your set on one board ends the adventure (my
  call, 2026-10-16). Alternatives: the board ends not cleared, with one
  card, and you go on.
- The cat's kind is `companion`, so no mode deals it by chance. Whether it
  should ever appear among theirs.
- Whether statues give rabbits (now: yes, every piece taken does).
- Whether a new piece should join mid-board rather than after it.
- The route kinds and their colours, and when each arrives.
- Wandering clouds, which can hide a walker.
- Endless, with no final depth.
- Tactics: whether stones should be traps (as now) or strike anything in
  reach. Whether the leader comes back in some clearer form, or stays out.
- **How a set of four, then five, is unlocked** (Timothy: "not sure how
  yet"). Candidates, each a milestone to mark in more than words:
  (1) by depth, a waystone lit the first time you reach depth 8, then 15,
  that raises it for every run after (mastery and power, permanent);
  (2) by collection, when your collection first holds six, then nine,
  different kinds (collection, permanent); (3) a rare card under par,
  "a fourth place", for this run only (power, within a run). My pick is
  (1): it rewards going deep, never decays, and the waystones already
  exist to hang it on.
- Gears' two turns a round (my call when the skip stopped meaning
  anything).

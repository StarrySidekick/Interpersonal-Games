# Intent

What this is for, and what to build next. Recorded **2026-09-06** from Timothy's
own answers to a direct set of questions, so this is *stated* intent rather than
intent inferred from the code.

**Read this before choosing what to build.** Where it disagrees with the rest of
the docs about **direction**, this file is newer and wins. Where it disagrees
about **mechanics** — how the code works, what was decided deliberately, the
invariants — the other docs win, always.

When something here is done, or turns out to be wrong, **edit it**. A stale
intent file is worse than no intent file.

## 2026-10-06: hone in on what is actually fun

Recorded from Timothy's own description. **The goal right now is to make
something actually fun**, and to start narrowing a lot of ideas into one
experience.

The shape he described, in three parts:

1. **A daily puzzle, the shareable one.** The same board for everyone, sent
   around a group chat. That is Grove Chess's daily rabbit today.
2. **A level-based, exploratory structure.** Much more open-ended: a world
   you explore, not one puzzle a day. The lab is where its pieces are being
   found.
3. **Other players woven in.** Possibly collaborative. The branching idea in
   particular: when you are on somebody's branch, you play a slightly
   upgraded version of the game, so the game is something shared by the
   friend group, as if everyone is in on one pot.

He called this a lot at once. Concrete options for each part, and a
suggested order, are in [`docs/grove-structure.md`](docs/grove-structure.md);
none of them is decided.

Also from him the same day: a light mode in a deep cream (dark stays as it
is), a ball-and-hole win condition, and control over which fairy pieces Go
crazy may use. All three are built.

Later the same day: the little grass marks are off the board, and stumps and
bramble are out "for now", replaced by a board variant where every move you
make removes a square. Built as **crumbling ground**: the square a piece
moves off falls away. About a third of daily boards from 2026-10-07, and a
switch in the lab. The first two daily boards keep their bramble so their
links still work (the dealer is versioned; see `docs/grove-chess.md`).
Without obstacles the daily boards got easier; the numbers are in the same
doc, under "Difficulty without obstacles".

Also on 2026-10-06, his design philosophy: games serve playstyles, each
playstyle is a progression path, and the paths together tell the player
story. Recorded in [`docs/design-philosophy.md`](docs/design-philosophy.md),
and it applies to every game here. Its first use, on Grove Chess, is
[`docs/grove-chess-paths.md`](docs/grove-chess-paths.md): ideas, not
decisions.

Then, in his words, the daily is "sort of a separate thing when it comes to
progression"; it is about social engagement. **Long-term progression goes in
a single-player mode**, part 2 above. A design for it, built on the paths
and on the history of chess, is in
[`docs/grove-long-game.md`](docs/grove-long-game.md): a proposal, not
decided. Sound and a proper winning catch are built in the daily and the
lab, the first two ideas from the audit.

Then a batch of notes from him the same evening. Each with what became of it:

- **The lab and the daily are one group**: separate design goals, shared
  developments. Built: the daily, the lab and the descent link to each
  other, and the daily's dealer version 3 (from 2026-10-07) takes the lab's
  developments below.
- **Crumbling boards look different, and a fallen square is only
  darkness.** Built.
- **What he meant by decaying**: a random part of the board's perimeter
  disappears, so the board slowly gets smaller, and the rim adapts. Built as
  shrinking ground, at random or in a spiral.
- **Rabbits do not eat by default.** Built: the lab's default, and the daily
  from 2026-10-07.
- **Balancing rules beyond moves to win**, including pieces like the
  grasshopper and cannon that only work in the right circumstances. Started:
  measurements, rules and the plan in
  [`docs/grove-balance.md`](docs/grove-balance.md).
- **An air of mystery**: a strange chessboard found in the middle of the
  forest. **Spirals** as a motif. **Nintendo 64, not 16-bit.** Direction in
  [`docs/grove-look.md`](docs/grove-look.md). Its big step, playing on a 3D
  board, is not built yet.
- **Rabbit colours by pattern**, collected over time, filling the garden.
  Colours and the collection are built; the garden is not.
- **Three kinds of thing against you**: holes, rabbits, and dark versions of
  your pieces. Boards framed as a ground, a shape and a size, a rabbit, a
  hole, and two dark pieces. Built as the lab's standard board, now its
  default.
- **A roguelike**: rabbits and a hole, sink the ball and fall to a harder
  level, see how far you can go. Built as the descent,
  `play/grove-chess/descent/`.

Later still: yes to the 3D board, fog in both modes. And new notes:

- **The rabbits possess the other pieces.** A coloured rabbit dives into
  each piece in the opening; you face about three; easy levels have one
  kind of rabbit so the pattern can be seen, later ones more. The rabbit
  sets the pattern (left, right, a pause), the piece's own moves are how.
  Built, in the lab's standard board and the descent.
- **An animation for descending**: your pieces falling with the ball. Built
  on the 3D board: the floor gives way into a pit.
- **The board stays top-down**, grid cells perfectly square; the pieces can
  be faked. Done: the board is drawn from straight above, the pieces from
  a gentle angle, standing on their squares.
- **Your pieces descend with you**, rather than picking a new piece each
  floor. Built; a piece taken stays gone.
- **A fairy piece that works like the ball?** There is not one exactly (see
  `docs/grove-chess.md`, the lab); the ball stays.
- The daily keeps its single loose rabbit for now. Possession could come to
  it in a later dealer version.

Later again, after playing it on his phone:

- **The board was invisible.** Safari on older iPhones (WebKit bug 256151)
  wiped the board while drawing the pieces. Fixed; the board now draws
  straight onto the screen.
- **The board read too small on a phone.** It now runs the full width of
  the screen with only a thin band of forest round it.
- **Pick a new piece in the descent as well.** Built: on the way down to
  each depth, take one of two pieces, one classic and one fairy, up to six.
- **The ball gets stuck a lot**, and the fairy-piece question again. Measured
  (`docs/grove-chess.md`, the lab): on ice it cannot reach the hole by
  itself in 36% of positions. The real fairy piece nearest a ball, the
  reflecting bishop of Billiards Chess, is worse (50%: it keeps to its
  colour). A ball that putts, rolling as far as you like and stopping where
  you choose, is 14%, so the descent and the lab use it; ice and billiard
  stay in the lab. The daily keeps the ice ball.

Then, on 2026-10-07:

- **New names for the game** besides Grove Chess: brainstorming, nothing
  decided.
- **The lab is now called Chaos.** Renamed on the page; the folder and
  links keep `lab/`.
- **Autochess**: rabbits you have caught possess your pieces, and the
  pieces move by themselves. Built as a Chaos setting; you set up your
  line (which rabbit in which piece, facing, order), then watch. Details in
  `docs/grove-chess.md`, under the lab. Not yet in the descent.
- **Pieces start lined up like chess**, yours on the bottom edge and theirs
  on the top, "for the most part". Built: the default in Chaos and in the
  descent.

Later on 2026-10-07, more notes. Each with what became of it:

- **The fall between depths**: your pieces go down the hole after the
  ball, then a screen of them falling, then landing on the next table.
  Built.
- **Purple against green**, and the rabbit inside colours the base.
  Built, for every piece.
- **Five more fairy pieces, and models true to history, not the forest.**
  Built: chancellor, amazon, dabbaba, silver general, lance; the ferz and
  wazir remodelled (an acorn and a toadstool were theming). In
  [`docs/grove-pieces.md`](docs/grove-pieces.md).
- **A strength score for every piece**, used to match the two pieces
  offered in the descent. Built (estimates, set out in the same doc).
- **Chaos settings as one board or a whole descent.** Built: "Play as a
  descent".
- **The pieces and the ball interacting**: the ball gets hit. Built as a
  Chaos setting, "Hit by the pieces", not yet the default anywhere.
- **Patents for pieces**: Betza notation, the established system, with
  every piece written in it and new pieces made from it. Built.

And later on 2026-10-07:

- **Frame rate.** Fixed in a pass: moves draw about six times cheaper
  (`docs/grove-chess.md`, "Frame rate").
- **The daily is not precious for now**: "don't worry about messing up
  the daily board, we will hone in on that after we get a solid game loop
  built." Recorded in `CLAUDE.md`. Nothing in this batch changed it.
- **No piece can capture on its first move**, either side. Built into the
  tester's balance rules.
- **The hit ball slides like ice**, and **the ball captures** by default.
  Built.
- **New boards: magic (Pac-Man edges) and geared (turns every turn).**
  Built as Chaos settings, with **statues** in place of stumps.

## 2026-10-05: the front door is asynchronous, and it is a group

Recorded from Timothy's own description. **Where this section disagrees with
the 2026-09-06 section below, this one wins.** The working name for the place
is **Hikari Garden**.

### What he is reacting to

Daily share-a-score games (Wordle, Pinstinct, Krillian and others) are working
in his friends' group chats. The share text is the score, and the score is also
the link to play. What they lack: the only interaction is comparing numbers.
Nobody's reply *does* anything, and day 40 is the same as day 1.

### What changed

- **A website first, not an app.** The genre lives on links in a chat, and a
  browser handles that fine. The iPhone app is no longer the near-term target.
- **Asynchronous first.** The live, on-a-call games (Blind Agreement,
  Twenty-Twenty, the PET bond) are **tabled, not cut**. They stay in the repo
  and the two-person PET framing below still describes that track.
- **A group, not a pair.** This reverses "it never becomes a game for a group"
  for the async track only.
- **Replying pulls you in.** Answering someone's score should enter you into
  their game, so the people in a chat end up tending one shared thing instead
  of each solving the same puzzle alone.
- **Ease people into interacting.** Start as low-commitment as a Wordle share
  and ask for a little more interaction over time, never all at once.
- **Long-term progression belongs to the group.** Rule 4 ("the tenth session
  isn't the first") now applies to a chat of people, not a couple.

### What survives

Nothing decays, nags, or keeps a streak you can break. The forest is still the
setting. The record still matters, and it now has a group-shaped version.

### The first prototype

**Grove Chess**, built 2026-10-05 at [`play/grove-chess/`](play/grove-chess/).
Timothy's skeleton, all of it in:

- a 5x5 or 6x6 board, light green and cream;
- a pixelated 3D model of the day's board turning on the start screen, which
  twirls when tapped and starts the game; models are simple polygons with a
  pixel filter, N64 style, not blocky voxels;
- the goal is to catch one rabbit, which hops in a hidden daily pattern you
  have to work out; you and the rabbit take turns; it eats any piece it lands
  on;
- each hand is one fairy piece (rotating through Grasshopper, Nightrider,
  Camel, Zebra, Alfil, Ferz, Wazir, Cannon, Mao, Squirrel, Rose, Archbishop)
  plus classic pieces, so nobody has to learn more than one strange piece a
  day;
- legal moves light up as whole squares; after the game the rabbit's pattern
  is drawn out;
- a test mode (`?test`) for jumping between days;
- **the lab** (`play/grove-chess/lab/`, 2026-10-05): every setting at once,
  for finding what is fun. Board size and shape, pieces on both sides, a
  thinking AI with adjustable skill and mood, win conditions. Rate each level
  and it goes in a notebook. The daily game runs on the same engine, proven
  unchanged by `play/grove-chess/check-daily.mjs`;
- lab levels are checked by a solver before you see them: winnable, and
  within 3 to 10 moves by default, which becomes par. Win conditions to
  compare: take their King, catch the rabbit, capture them all, any one, or
  a mix (2026-10-06);
- a day variable, on some boards and not others: the creeping bramble on the
  first two, crumbling ground from 2026-10-07;
- a pieces menu with every piece of the day, rabbit included, as a turning
  model with a short description;
- once you finish, everyone on your link branch can be overlaid on the board,
  or watched move by move.

How it works and what is still open: [`docs/grove-chess.md`](docs/grove-chess.md).

### Decisions still open, and they are his

0. **Other enemy pieces besides the rabbit.** Timothy is toying with it
   (2026-10-05). Possible in the lab now; not in the daily game. What the lab
   notebook says is fun should decide it.

1. **Server or no server.** A group world everyone sees the same way is much
   easier with a small backend. The no-server rule was justified by intimate
   two-person answers, which this track does not have. The prototype is links
   only, and it works; revisit once the loop has been played with real people.
2. **What a reply actually does** to the original poster's game.
3. **Puzzle or opponent.** Same daily position for everyone (Wordle-shaped) or
   real matches between players (correspondence-chess-shaped). Leaning: daily
   puzzle first, matches later.

## 2026-09-06: the framing changed, and most of this repo predates it

*Now the tabled live track. Still accurate for it.*

**2026-09-06.** This is no longer a collection of games. It is a place, and the
games are what tends it.

> You find a **PET** — in the sense of *Mega Man Battle Network* — in an
> abandoned, forested area. You wake it up, and it forms a **soul bond with
> exactly one other person**. Through it, the two of you talk to each other like
> a walkie-talkie and play *It Takes Two* / Mario Party style minigames, and
> **playing grows your gardens and reawakens the abandoned place**.

Read the rest of the docs with that in mind. `README.md` and `docs/scope.md`
were written before it and are still right about the *session shape*, the rules
that make a two-person game work, and the no-server constraint. They are out of
date about what the thing is.

### What the reframing keeps

Everything in `docs/scope.md` under "The session shape" survives intact, and
some of it is now load-bearing rather than merely wise:

- **Rule 4 — "the tenth session isn't the first session again"** was already
  called the hard part. The garden and the reawakening *are* the answer to it.
- **Rule 2 — things accrue; nothing decays.** A garden that wilts when you have
  not called in three weeks is exactly the guilt mechanic this repo bans. A
  place you left is a place that waits.
- **Rule 5 — the record is a first-class feature.** The place is the record now.

### What the reframing changes

- **The games are not the product.** They are the reason to be in the place
  together, and what they pay out in is growth.
- **Strictly two people, bonded.** Closer to *It Takes Two* or *Split Fiction*
  than to a party game. It started as something for Timothy and his partner and
  is now aimed a little wider, but it never becomes a game for a group.
- **The walkie-talkie is part of the fiction**, not just the phone call you
  happen to be on.

## What is next, in priority order

**1. Render the environment the games take place in.** This outranks new games.
There is no place yet, and the place is now the point.

**2. A way to play and test solo.** Timothy has not been able to properly
playtest, because playtesting currently requires getting Alyssa on the phone.
This unblocks him personally and it is worth building even though the finished
thing is strictly two-player.

**3. Long-term growth of elements.** Very important, in his words. Weight
anything that accrues across months over anything that entertains once.

## Deliberately not next

- **New games.** He wants to think hard before each one, and there are fourteen
  on the shelf already with two playable. Depth, not breadth.

## Where it is going

**Eventually an iPhone app, probably peer to peer.** So the no-server rule in
`docs/scope.md` is not a temporary constraint of GitHub Pages — build nothing
that needs a backend.

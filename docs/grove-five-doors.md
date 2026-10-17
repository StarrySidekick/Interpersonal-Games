# Five doors: the daily, Adventure, Golf, Custom, Variants

Recorded **2026-10-17** from Timothy's request: "a general pass of our
chess game, centered on the adventure mode, to get a general idea of it and
things we could do to improve it, move it further towards completion, make
it more fun, and refine it. similarly, i want to adapt daily mode to be a 5
minute or less version of adventure you can play and share. the finished
version of the app should have a daily mode, adventure, a custom mode,
golf, and a separate list of a bunch of variants others have made and me.
so Daily, Adventure, Golf, Custom, and Variants."

What was built is marked **Built**. Everything under "Adventure: a pass" is
**ideas, not decisions**, ranked, each with the paths it moves
([`design-philosophy.md`](design-philosophy.md)). Calls made without him
are marked as mine, and are his to change.

## The five doors (Built)

Chess of the Grove (`play/grove/`) opens on five doors: **the daily**
(wide, first), **Adventure**, **Golf**, **Custom** and **Variants**. The
Variants door scrolls to its list, in two parts:

- **Ours**: the rabbit (the first daily), the descent, Tile Chess, Kung fu
  descent, Capture the rabbit, Autochess.
- **From the history of chess**: the ten classic variants, each with who
  made it and when, as before.

The pieces catalog is a line at the foot. The menu under every page
(`menu.js`) is the same five, the hub and the pieces; a variant's own page
lights "Variants" in it, Chaos lights "Custom". Every old address still
works: `play/grove-chess/` is still the rabbit, and every `?mode=` still
plays. The home page's card says the five.

## The daily (Built)

`play/grove-chess/daily/` (it forwards to `play/?mode=today`, keeping the
link). Built on Adventure's runner, so it is Adventure's board, pieces,
rabbits, suits, weapons, hole, fall and cheer, cut to five minutes.

**What a day is.** Your cat and three more (two of the rook, bishop and
knight; most days one of the troupe, a different one each day in turn, as
the first daily had one fairy piece a day), some with a suit or a weapon.
Then three boards, climbing, dealt as Adventure deals them at three depths.
The week climbs too, as a crossword's does: Monday and Tuesday at depths 3,
5 and 7; Wednesday and Thursday 4, 6, 8; Friday and Saturday 5, 7, 9;
Sunday 6, 8, 10. No board's best line is under three moves.

**Scoring.** Golf, board by board. Par is the solver's best line plus two,
so an eagle means you found the best line it knows (Adventure's par by
depth comes out about the same; for a shared score, "par means the same
thing every day" mattered more). A board not cleared, or worse than a
double bogey, counts as a double bogey: golf's own "net double bogey" cap.
At par plus two moves not cleared, the floor gives way by itself, so no
board can eat the five minutes. The header says "par 6" and the pill "8
moves at most".

**Sharing.** The end screen is a scorecard (board, par, moves, and the
word), then a name and "Share your card". The share text marks each board
the way golf scorecards do, plain text so it reads the same in any chat:

    Hikari Garden daily #1: Where the Weather Listens
    ◎ ○ –  -3 (15 moves, par 18)
    https://…/play/grove-chess/daily/#d=2026-10-17&r=Tombo.4.6.5

(◎ eagle or better, ○ birdie, – par, □ bogey, ▣ double bogey.) The link is
the old daily's vine made small: it carries each player's moves per board,
and whoever plays from it adds theirs. Your vine on the end screen lists
everyone whose card reached you that day, then you. The title shows the
last three on your vine before you play. Your name is the old daily's, so
it carries over.

**Measured** (Chromium, the best-move button playing): three boards, 12
moves, about a minute of moves and animation; a person reading the board
takes the five minutes. Dealing 76 days took 11 minutes of node time
(1 to 35 seconds a day), run three months side by side.

**Decided without him (mine, his to change):**

- **No cards between boards.** Each board is dealt and vetted for the
  day's set, with that set baked into the stored board; a card would mean
  playing a board nobody vetted, and two friends' scores would be on
  different puzzles. Cards are what Adventure is for. If he wants a choice
  in the daily, the clean one is a choice of two sets at the start, each
  vetted.
- **Three boards.** Five minutes held with three; a fourth would push a
  Sunday past it.
- **Par is best line plus two**, not Adventure's par by depth (above).
- **The best-move button is hidden** in the daily (it is there with
  `?test`): a shared score means nothing if a button can play it.
- **Intro cards play once ever**, not every day: the daily keeps which
  pieces' cards you have seen, so a new troupe piece gets its card the first
  day it turns up, and the rest of the time you go straight to the board.
- **It started today, 2026-10-17**, as #1, so it is there as soon as it
  ships. The first daily's stored boards also end today; from tomorrow it
  deals its version 3 boards (unnamed, as `daily4.js` always intended), and
  it is in Variants as "The rabbit".
- A board left part way picks up where it was (its moves are kept and
  played back), so a bad board cannot be dealt again by reloading.
- Nothing decays and there is no streak: the title says days played and
  your best card.

**How it is built.** `daily5.js` (loading a day, scoring, the store, the
link), `dailies5/YYYY-MM.js` (the days, made through 2026-12-31),
`make-daily5.mjs` (deals them: `node play/grove-chess/make-daily5.mjs
2027-01-01 31`), `check-daily5.mjs` (a fingerprint of every stored board,
must pass), and `MODES.today` with `daily` branches in `play/main.js`
(`find` reads the stored board; `dailyOver`, `dailyDone`, `dailyTitle`,
`replay`). Why stored: Adventure deals against the clock (`searchLayouts`
gives up after seconds), so two phones would deal two boards.

**Open, his:** cards or a set choice in the daily; three boards and the
week's climb; watching a friend's board move by move (the old vine could:
this one carries scores only); a name for it.

## Adventure: a pass

Played in Chromium at a phone's size, two runs of nine boards each with the
best-move button, with every screen looked at; and read through
`adventure.md`, `modes.js`, `run.js` and the runner.

### What is working

- **The core verb is good and its own**: one piece on the board, choosing
  which of your set it is, leaving a trail of your pieces one move behind.
  It is chess technique (pins, forks, lines) with one piece at a time, which
  is what Timothy asked for, and nothing else plays like it.
- **Readable enemies.** Robot loops drawn square by square, red danger
  frames, plinth colours for the rabbit's kind: a depth 8 board with five
  kinds of thing on it still reads at a glance.
- **The between-boards moment.** The full-screen fall, the playing cards,
  the suit taking hold on the falling piece: it already has all three
  registers (picture, sound, words).
- **Every board is vetted** and an eagle is always there to find, so par
  means something.
- **It looks like itself**: the armoured cat, suits worked into the models,
  card-suit icons.

### What the pass found

1. **No stakes, no end.** A run ends only if they take every piece of your
   set on one board, which good play never allows (neither bot run came
   close); a board not cleared just gives a worse card. There is no bottom
   either ("Endless" is in `adventure.md`'s Open list). So nothing is at
   risk and nothing is finished: a run stops when you get bored, and the
   only record is the deepest depth.
2. **A wall of words before the first move.** The title blurb is about 170
   words; the first board's goal card about 350, naming six rabbit kinds and
   five suits at once. The game itself introduces them one depth at a time,
   which is the right order; the words undo it.
3. **Cards you cannot read on a phone.** The cards are an icon and a name
   (Timothy's call); their words are a mouse-over title, which a phone never
   shows. And some cards make a piece weaker: in Adventure a sword, lance or
   shield takes away squashing, so picking Shield for your cat can leave it
   unable to take the ordinary way, with nothing on the card to say so.
4. **Power outruns challenge, and the deck has no identity.** By depth 9 a
   run had eight pieces: two given, the troupe card, and three of a kind
   firing about every other board (statues count, and boards hold two to
   eight). Past four, your set is drawn at random, so the deck you built is
   not the deck you play. The known open item agrees: strong sets beat par
   by 4 to 7 from depth 8.
5. **Boards are short.** Best lines of 2 to 5 moves through depth 9. A board
   is a quick puzzle, which suits the daily well; in a run it means many
   boards and cards for little play each.
6. **The play screen is long.** The set is shown twice (the strip under the
   board and the Now/Ready/Used row), then Resting, Three of a kind and Your
   pieces cells; the caption that says what just happened sits below the
   fold. A set of four wrapped to two rows on a phone (**fixed**, this
   release), and "Move 1 of 40 · par 7" wraps (the 40 never matters).
7. **Across runs, nothing moves** but the deepest depth. The cat's looks are
   all open from the first run, so customization has nothing to earn.
8. **Waits.** "Finding the next one" showed at depth 9; a deal can take up
   to about 29 seconds at worst (`adventure.md`).

### Paths

| Path | Within one board | Within a run | Across runs | Vertical / horizontal | Notated by |
|---|---|---|---|---|---|
| Mastery | reading routes, choosing the order of the set, beating par | **flat**: boards stay 2 to 5 moves, nothing is at stake | none recorded but depth | vertical | W (par word), V (cheer), A (fanfare) |
| Power | suits and weapons on the set | **too steep**: a deck of 8 by depth 9 | resets | vertical | V (looks), A (transform), W |
| Collection | three of a kind ticking | a deck up to 16 | **none** | horizontal | W (counts), V (strip) |
| Customization | none | which card on which piece | the cat's looks, all open at once | horizontal | V |
| Narrative | adventure (down the hole) | none | none | none | V (the fall) |
| Social, world, competitive | out (the daily carries social) | | | | |

**The reading:** the board-level loop is strong and well notated; the run
and the time across runs are where the curves go flat. Every curve that
should climb across a run (mastery, narrative) is flat, and the one that
should be gentle (power) is steep.

### Ideas, ranked

Each: what it is, the paths it moves, the cost, the risk.

1. **A run is a course: nine boards to the bottom, scored like the daily.**
   A run is the front nine: a scorecard against par, board by board, with
   the daily's double-bogey cap and the floor giving way at par plus two
   (so a bad board costs strokes, not a whole evening). The ninth board is
   the bottom, a harder board of its own; then the card, your best front
   nine kept, and "on to the back nine" for whoever wants more (endless
   stays). Moves **mastery** (a number to beat that means something),
   **narrative** (a bottom to reach), and ties Adventure and the daily into
   one shape (three holes a day, nine a run). Cost: medium (the runner has
   the course scorecard already, from Golf). Risk: changes the feel of an
   endless run; keeping endless after board nine answers that.
2. **Teach by first sighting.** Cut the blurb to two sentences. Replace the
   350-word card with one short card the first time each thing turns up (a
   sentry, a scared one, Hearts...), kept across runs, the way the daily
   now keeps its intro cards. Moves **mastery** (alone, then developed,
   then combined) and, with the next idea, **collection**. Cost: small.
   Risk: none worth naming.
3. **A field guide.** Every rabbit kind and suit you have met (and taken),
   with its card, as a page: six kinds by six suits, filled in as you play,
   nothing missable. Moves **collection** with a visible home, and
   **mastery** (a reference you earned). Cost: small to medium.
4. **Cards readable on a phone; weapons that only add.** Tap a card once to
   turn it over (one line of what it does), again to take it: the card
   stays clean, as Timothy wanted, and the words are there when asked for.
   And either give squashing back to every weapon or say on the card when it
   takes it away. Moves **power** (choices you can reason about). Cost:
   small. Risk: the "no descriptions" call is his; this keeps the clean face.
5. **Slow the deck, and choose your four.** Three of a kind from pieces with
   a rabbit only (statues give nothing), and before each board pick your
   four from your deck instead of a random draw. Moves **customization**
   (your deck is yours), **mastery** (planning a set), and flattens
   **power** back toward the challenge. Cost: medium. Risk: one more screen
   between boards; it can share the cards' screen.
6. **Something that lasts between runs.** A fourth, then fifth place in the
   set unlocked at waystones (the pick already in `adventure.md`'s Open
   list); the cat's looks unlocked by milestones (a first eagle, a front
   nine under par, the bottom reached) instead of all open. Moves
   **customization** and **collection** across runs, notated by the cat
   itself (visual). Cost: medium. Risk: nothing decays and nothing is
   missable, so every unlock must be reachable by any run.
7. **One screen, less reading.** One set display (the strip), with three of
   a kind as pips on it; drop "of 40"; captions cut to the event that
   matters, with a chime and a glow for the big ones (three of a kind, a
   piece lost). Moves **notation** from written to visual and audial. Cost:
   small.
8. **The frame that is already there.** Rabbits that eat playing cards, a
   hole you jump down, suits, a cat: it is Alice's Wonderland, half built.
   A bottom board with a court (the rabbit that ate the whole deck, holding
   every suit) would give the course an ending worth reaching. Moves
   **narrative** and **wonder**. Cost: medium to large. Risk: theming is
   Timothy's; this is only the shape.
9. **Deal from the set's strength.** Deep down, strong sets beat par by 4 to
   7. Instead of only the depth, let the set's measured power raise the
   board (more of theirs, a size up). Moves **mastery** (flow kept as power
   grows). Cost: medium. Risk: slower deals.

**Suggested order:** 2 and 7 first (small, and they make everything after
easier to read), then 1 (the run gets a shape), then 4 and 5 (power that
can be reasoned about and a deck that is yours), then 3 and 6 (curves
across runs), with 8 and 9 when the course exists.

### Out on purpose

- **Social inside Adventure**: the daily carries it.
- **Ladders and leaderboards**: competition stays small (house rule 4); the
  vine compares friends, nothing ranks everyone.
- **Anything that decays, nags or keeps a streak.**
- **A server.** The daily's vine works through links, as before.

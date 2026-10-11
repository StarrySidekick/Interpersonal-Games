# Grove Chess: chess variants

Timothy, 2026-10-11: "model a few simpler chess variants in order to test
them and see if they can be weaved into the game ... maybe make a mode that
just lets you play chess variants that would be easier to code." He named
micro chess, King of the Hill, Los Alamos, Gardner, Racing Kings and mini
chess.

## The mode

**Chess variants** (`play/?mode=variants`, in every page's menu). Pick a
variant on the title, then play it from its real starting position against
the thinking side (`ai.js`, the minimax search). Its settings panel shows
only what still matters: how they think (skill, mood), the move limit (none
by default) and the reach glow. Positions and rules live in
`play/grove-chess/variants.js`, one entry each, so adding a variant is
adding an entry.

| Variant | Board | Start (FEN, yours in capitals) | Rules used |
|---|---|---|---|
| Microchess (Glimne, 1997) | 4 × 5 | `rbnk/p3/4/3P/RBNK` | promotion, pawn double step |
| Gardner minichess (1969) | 5 × 5 | `rnbqk/ppppp/5/PPPPP/RNBQK` | promotion |
| Los Alamos chess (1956) | 6 × 6 | `rnqknr/pppppp/6/6/PPPPPP/RNQKNR` | promotion |
| Mini chess (Speed chess layout) | 5 × 6 | `rbqkn/ppppp/5/5/PPPPP/RBQKN` | promotion |
| Petty chess | 5 × 6 | `qkbnr/ppppp/5/5/PPPPP/QKBNR` | promotion |
| King of the Hill | 8 × 8 | the usual chess start | promotion, double step, a King on a middle square wins |
| Racing Kings (Parton) | 8 × 8 | `8/8/8/8/8/8/krbnNBRK/qrbnNBRQ` | first King to the top row wins; no move may attack either King |
| Peasants' Revolt | 8 × 8 | `1nn1k1n1/4p3/8/8/8/8/PPPPPPPP/4K3` | promotion, double step |
| Monster chess | 8 × 8 | `rnbqkbnr/pppppppp/8/8/8/8/2PPPP2/4K3` | you move twice per turn; promotion, double step |

"Mini chess" names several games; the 5 × 6 Speed chess layout was taken,
with Petty chess beside it. Positions were checked against Fairy-Stockfish's
variant list (`src/variants.ini`: microchess, petty, peasant), the Wikipedia
pages for Minichess, Los Alamos chess and Racing Kings, and lichess's Racing
Kings start. The Wikipedia Microchess diagram appeared not to match its own
4 × 5 text; Fairy-Stockfish's 4 × 5 position was used.

**What Grove Chess plays differently** (each variant says so when it
starts and when it ends):

- You win by taking their King, not by checkmate, so a King left where it
  can be taken is lost. The reach glow shows where theirs can go, which
  doubles as a check warning. Racing Kings is the exception: no move may
  attack either King, as in the real rules.
- A pawn on the far row always becomes a queen (no choice).
- No castling and no en passant.
- Racing Kings: the first King to the top row wins. In the full rules,
  their King arriving on the very next move makes it a draw.

**New rules in the engine** (`rules.js`, all off unless a level asks):
`promote`, `pawnDouble`, `hill` (`onHill`), `race`, `noCheck`
(`givesCheck`), plus Monster chess using the existing `movesPerTurn`. A
variant's level skips the layout search (one fixed position). The AI knows
the hill and the race: how far each King has still to go counts.

Checked: every position reads with the right size and pieces; the first
move counts match real chess (20 in King of the Hill, 21 in Racing Kings,
7 in Gardner); every variant played out with no errors; the slowest reply
was under a second (Racing Kings, where no-check is costly).

## Kung fu: chess without turns (2026-10-11)

Timothy: "kind of crazy variant but it may be the key here, i want to be
able to test kung fu chess as a variant, and have it be a version of
descent you can play." Two ways in: **Kung Fu Chess** in the variants
list (the usual 8 × 8 start), and the **Kung fu descent** mode in the menu
(the descent, with no turns). Any level can be played this way with the
setting "Kung fu: no turns" (`realtime`); `kungfu.js` runs it.

Kung-Fu Chess (Shizmoo Games, 2001 to 2002; Audience Choice at the 2002
Independent Games Festival) is chess in real time: either side moves any
piece at any moment, moves take time to travel, a piece that has moved
must rest, and there is no check (a King is taken). Its lightning speed,
a square every 0.2 seconds and 2 seconds' rest, is the default here
(settings: travel time a square, your rest, theirs).

As built:
- A move starts from the piece's ordinary moves as things stand; the
  piece leaves its square and is in the air until it lands. Landing on a
  piece of theirs takes it; landing where one of yours has since moved
  bounces back. Nothing collides in the air (in the original, pieces
  moving into each other did).
- A resting piece wears a ring that runs down (gold yours, purple theirs).
  The reach rings still show where everything can go.
- Their side chooses several times a second: what it can take, what it
  can dodge (including squares yours are about to land on), the danger it
  walks into, how close it gets to your King, with less noise the sharper
  the rabbits. It is a scoring rule, not the turn-based search, which
  assumes turns.
- In the descent: their rest gets shorter each level down (3.5 seconds at
  first, 0.2 less a level on the steady ramp, never under 0.8); the
  ground stays solid and there is no cloud or showdown (all count turns).
  Suits: Hearts a second life, Swords no rest after a capture, Stars no
  rest after the level's first move, Diamonds treasure, Spirals an
  instant swap, Spirits through anything. Jokers: Double Time halves your
  rest, Lazy Rabbits doubles theirs. The clock stops when the page is not
  drawing (the phone put away).
- The level search still uses the turn-based solver to pick a fair
  layout; par and the measured difficulty are hidden, since they count
  turns.

Checked in a browser: a scripted player won the first descent level in
about ten seconds and fell to depth 2; an 8 × 8 game ran to its end
(their rook took the King) in under half a minute; the board kept 61
frames a second.

**Gentler, the same day.** Timothy: "enemy pieces moving so fast, feels
very hard to play." Their side had been choosing a move every quarter to
half a second, with any rested piece, and dodged the instant you moved. Now
it plays like one opponent: at most one move every 1.8 seconds at first
("They start a move at most every", `kfFoeGap`, quicker by 0.1 a level
down, never under 0.6), a 2.5 second head start, and it notices a move of
yours only after a reaction time (about half a second; sharper rabbits
sooner), so a quick strike lands. Their rest starts at 5 seconds (0.3 less
a level, never under 1.5), and travel is 0.3 seconds a square, a little
slower than lightning, so moves are easier to follow. Measured: doing
nothing for 15 seconds, their moves came at 2.5, 4.6, 6.7, 8.8, 10.7, 12.7
and 14.5 seconds, and nothing of yours was lost.

Why it might be the key: real time turns knowing the moves into reflexes,
which is a mastery curve chess players and non-players start on more
evenly, and it gives the descent's pieces a feel (speed, rest) that suits
and jokers can change. Open questions for play: how fast their rest should
fall, whether the AI should hold back more at first, and whether
collisions in the air should come back.

## What could be woven into Grove Chess

Each idea with the paths it would move (`docs/design-philosophy.md`):

- **The hill as a level goal.** A descent level where a King on the
  middle squares wins, alongside taking theirs. Two ways to win make a
  board readable at a glance and reward a bold King. Mastery; marked in
  gold already.
- **Racing as a level goal.** No capture needed to win: get your King to
  the far row first. A calmer kind of level for people new to chess, and
  a natural fit for golf's course structure. Mastery, world (a new kind
  of place).
- **Promotion back, as crossing the board.** Removed on 2026-10-09
  because "the next piece up" was no upgrade; the chess rule (a pawn that
  crosses becomes a queen) is clear and earned. A pawn-heavy hand in the
  descent gains a plan. Power, mastery.
- **Lopsided boss levels (Monster chess, Peasants' Revolt).** Few strong
  pieces against many weak ones, or the reverse, as the deep levels of a
  descent. The Double Time joker is already Monster chess's rule.
- **The small boards for the daily.** Gardner (5 × 5) and Los Alamos
  (6 × 6) are proper chess on boards the daily already uses. Gardner is
  solved as a draw with perfect play, which suits a puzzle with a par.

## Other variants, easy to code next

- **Three-check**: win by checking their King three times. Needs a count
  of attacks on the King after each move.
- **Antichess (losing chess)**: if you can capture, you must; lose all
  your pieces to win. Easy: a filter on moves.
- **Atomic**: a capture explodes, removing everything next to it except
  pawns. A small change in landing.
- **Chess960**: the back row shuffled. Already close to how Grove Chess
  deals.
- **Crazyhouse**: captured pieces can be dropped back in as your own. The
  nearest real game to the descent's claiming, worth studying.

# Grove Chess pieces: patents, strength, and what they look like

Timothy, 2026-10-07: "define different individual patents for pieces in
order to both understand them and in the future customize them ... does
the piece slide to its position or hop, can it capture pieces, does it
need to hop over something, what shape is its movement." And: "pieces in
general should have a strength score like real chess."

## The patent: Betza notation

There was already a codified way, so the game uses it: **Betza notation**,
from Ralph Betza's "funny notation" of the 1990s, the standard shorthand of
fairy chess. A piece is a list of moves, each an atom (the shape of one
jump) with letters in front that change it.

| Letter | Means |
|---|---|
| `W` `F` | one step straight; one step diagonally (the wazir and ferz) |
| `D` `A` | two straight; two diagonally (dabbaba, alfil) |
| `N` `C` `Z` | the knight's (2,1), the camel's (3,1), the zebra's (3,2) |
| `K` `R` `B` `Q` | king (`WF`), rook (`WW`), bishop (`FF`), queen |
| doubled (`NN`, `WW`) | a rider: repeats the jump in a line until stopped. This is sliding. |
| `m` / `c` | moves only / captures only |
| `p` | must hop over one thing first (the cannon captures with `cpR`) |
| `g` | grasshopper: over the first thing in its line, landing just beyond |
| `n` | lame: can be blocked on the way (the xiangqi horse, `nN`) |
| `q` | circular (the rose, `qN`) |
| `f` `b` `s` `v` | forward, backward, sideways, forward-and-back only |

`betza.js` reads the notation two ways:

- **Into moves** (`betzaMoves`). The pieces from before 2026-10-07 keep
  their hand-written move code, so no daily board can change.
  `betza-check.mjs` proves on 72,000 random boards that every piece's
  notation gives exactly the same moves as its code. The five new pieces
  are made from their notation alone, so a new piece can be made by writing
  its letters.
- **Into words** (`patent`). How it travels (steps, leaps, slides, hops,
  circles), how it captures, whether it needs something to hop over,
  whether it can be blocked, whether it has a forward, and the shapes. The
  pieces sheet shows this for every piece, and Chaos has an "Every piece"
  button to read them all.

## Strength

`strength` in `rules.js`, in pawns, the way chess players count. These are
estimates, not truths:

- The classic pieces use the usual modern values (pawn 1, knight and bishop
  3¼, rook 5, queen 9½). The king counts 3 as a fighting piece.
- The compound pieces follow what fairy chess players have found:
  the archbishop (bishop and knight) and the chancellor (rook and knight)
  are worth nearly a queen, and the amazon (queen and knight) clearly more.
- The rest are judged against those, with mobility (`mobility()` in
  `betza.js`) as a check.

**Mobility** is the average number of squares a piece reaches on an empty
board. It's the plainest measure of strength, but it misleads in exactly
the interesting cases. The grasshopper scores 0 on an empty board, because
it needs things to hop over. The mao scores the same as a knight, because
being blockable only matters once something is in the way. The numbers on
6 × 6, the size the game mostly uses:

| Piece | Betza | Strength | Mobility, 6 × 6 | 8 × 8 |
|---|---|---|---|---|
| Pawn | `mfWcfF` | 1 | 0.8 | 0.9 |
| Alfil | `A` | 1¼ | 1.8 | 2.3 |
| Dabbaba | `D` | 1¼ | 2.7 | 3.0 |
| Ferz | `F` | 1½ | 2.8 | 3.1 |
| Wazir | `W` | 1½ | 3.3 | 3.5 |
| Grasshopper | `gQ` | 2 | 0 (needs hurdles) | 0 |
| Lance | `fR` | 2¼ | 2.5 | 3.5 |
| Zebra | `Z` | 2¼ | 2.7 | 3.8 |
| Camel | `C` | 2½ | 3.3 | 4.4 |
| Silver general | `FfW` | 2½ | 3.6 | 3.9 |
| Mao | `nN` | 2¾ | 4.4 | 5.3 |
| King | `K` | 3 | 6.1 | 6.6 |
| Knight | `N` | 3¼ | 4.4 | 5.3 |
| Bishop | `B` | 3¼ | 6.1 | 8.8 |
| Cannon | `mRcpR` | 4 | 10.0 | 14.0 |
| Rook | `R` | 5 | 10.0 | 14.0 |
| Nightrider | `NN` | 5 | 6.2 | 9.5 |
| Squirrel | `NAD` | 5 | 8.9 | 10.5 |
| Rose | `qN` | 5½ | 7.9 | 12.9 |
| Archbishop | `BN` | 8¾ | 10.6 | 14.0 |
| Chancellor | `RN` | 9 | 14.4 | 19.3 |
| Queen | `Q` | 9½ | 16.1 | 22.8 |
| Amazon | `QN` | 12½ | 20.6 | 28.0 |

`value` (what the thinking AI counts) is left as it was, so old levels
with thinking pieces play exactly as they did.

**In the descent** the two pieces offered on the way down are matched by
strength (`offersFor` in `descent.js`). It picks a fairy piece for the
depth at random, then a classic piece within ¾ of a pawn of the closest
classic match, so it's a real choice between equals and not an obvious
one.

## Five new pieces

All made from their notation, all historical:

- **Chancellor** (`RN`), rook and knight. Capablanca chess, 1920s; earlier
  in variants as the champion or marshal.
- **Amazon** (`QN`), queen and knight. The queen of some 18th-century
  Russian chess, and the maharaja of "The Maharajah and the Sepoys". The
  strongest piece here, so it is in Chaos but not offered in the descent.
- **Dabbaba** (`D`), two straight, leaping. The war engine of Tamerlane
  chess, 14th century: a covered siege machine.
- **Silver general** (`FfW`) and **lance** (`fR`), from shogi. They are the
  game's first pieces with a forward that is not a pawn: for your pieces
  forward is up, for theirs down.

The daily's dealer pins its own list of twelve fairy pieces (`day.js`), so
new pieces never re-deal a daily board.

Candidates for later: the giraffe of Tamerlane chess (one diagonal step,
then straight on), and the locust (captures by hopping over, as in
draughts), which would need a capture that is not on the landing square.

## What the pieces look like, and why

Timothy: "make sure the models ... make sense based on the history of the
piece, not the forest theming of the game." The audit:

| Piece | Was | Now | Why |
|---|---|---|---|
| Ferz | an acorn (theming) | a small domed counsellor | The fers or firzan was the shah's counsellor in shatranj, the piece the queen grew out of. Early Islamic sets were abstract, and the counsellor was a smaller turned shape than the shah's. |
| Wazir | a toadstool (theming) | a turbaned vizier | *Wazir* is vizier; Tamerlane chess had a vizier that moved one square straight. |
| Cannon | a cannon | the same, on a xiangqi disc | *Pao*, the cannon of xiangqi (written "catapult" before gunpowder). The disc matches the mao, the other xiangqi piece. |
| Alfil | an elephant | kept | *Al-fil*, "the elephant", of shatranj. |
| Camel, zebra, squirrel, grasshopper | animals | kept | The name is the history: problemists named leapers after animals. |
| Mao | a horse on a disc | kept | The horse of xiangqi. |
| Nightrider | a horse with stars | kept | A knight that rides on (Dawson, 1925); the stars are for the name. |
| Rose | a rose | kept | Named for the flower its circling path draws. |
| Archbishop | a mitre with ears | kept | Capablanca's bishop-knight. |

**Statues** (2026-10-07) are any classic piece's shape in grey stone,
`STONE` in `models.js`, on a stone plinth: no side's colour, since they
belong to nobody.

**Colour** (Timothy: "enemy pieces should be purple, and friendly pieces
should be green for now, just clearly distinguish them. The rabbit inside
the pieces defines what colour the base is"). Every body is the side's
colour: green for yours, purple for theirs, fairy pieces included (they
used to keep their own animal colours). The plinth is the rabbit's: a piece
with a rabbit inside stands on its rabbit's colour, and one without stands
on plain stone. One palette in `models.js` (`YOU` and `FOE`) does it all.

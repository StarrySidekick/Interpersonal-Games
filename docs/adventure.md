# Adventure

A Grove Chess mode, `play/grove-chess/play/?mode=adventure`. First built
2026-10-15 as its own page on Changeling's boards, then the same day, at
Timothy's word ("adventure should be rebuilt as a grove mode, shelve
changeling mode for now. everything should be in the grove"), rebuilt on
the Grove's rules, board, runner, suits and weapons. The old address now
sends you here. The name is his working name.

## What he asked for

Pieces are not forced to capture and do not change into what they take. You
start with a rook, bishop or knight. Their pieces do not move and are grey,
like statues; later levels have purple pieces that do move. You start with
one piece and discover more, up to four. Suits and weapons. Levels can have
moving neutral pieces. The goal is to capture every piece in as few moves as
possible. Over par you get one upgrade, on par a choice of two, under par a
choice of three. Levels get harder in some random way, every run is
different, and par should be reasonable for how deep you are.

## How it is built, in Grove terms

It is a descent (`run: 'descent'`) with its own way between levels,
`upgrades: 'par'`. Everything else is the Grove's own machinery.

- **The preset** is `MODES.adventure` in `modes.js`: one piece to start,
  four at most, take every piece (`goal: 'capture'`, `captureN: 0`), no King
  to protect, scattered rather than lined up, fairy pieces of theirs from
  depth 4.
- **Your first piece** is chosen on the title screen (`starterList` in
  `play/main.js`), as golf chooses a course: rook, bishop or knight.
- **Statues of theirs** are a new level setting, `still` (`lab.js`): that
  many of their pieces get the brain `'still'`, so they never move, and
  `canTake` says they never take, which keeps them out of the purple reach,
  the threats, the shields and the pins. They are drawn in grey stone
  (`model(kind, 'grey')`, a palette added to `models.js`) on the 3D board,
  the flat board, the title scene and the pieces sheet. The rest of theirs
  think (`darkBrain: 'think'`).
- **Neutral pieces that move** are the Grove's wandering clouds: they drift
  a square a turn and hide what is under them.
- **Harder in a random way** (`levelSettings`, the `upgrades === 'par'`
  branch): each depth draws from what it allows.

| Depth | Board | Theirs | That move | Clouds |
|---|---|---|---|---|
| 1-2 | 5 x 5 | 2-4 | none | none |
| 3-7 | 5 x 5 or 6 x 6, odd shapes from 3 | 3-6 | from 4, usually 1 | about half the boards |
| 8+ | 6 x 6 or 7 x 7, crumbling ground sometimes | up to 9 | 1-3, thinking two ahead from 9 | sometimes 2 |

- **Par** is the Grove's solver (`searchLayouts` and `solveLevel`), asked
  only whether the board can be cleared and in how few moves (`quick`: no
  balance report, no novice games, which were most of the search's time).
  Par is that plus 1 to depth 5, plus 2 to depth 11, plus 3 after
  (`adventureSlack` in `run.js`), so under par is always possible. Measured:
  every depth from 1 to 20 finds a board in under 3 seconds in node.
- **Between boards** (`levelOver`, then `adventureCards` in `run.js`):
  over par, or not cleared, one card; on par, a choice of two; under par, a
  choice of three. The cards are the Grove's: a suit, a weapon (on a piece
  that has one already, a level up), or a new piece, which comes first after
  depths 2, 4 and 7 while you have fewer than four. Pieces you lose stay
  lost; lose them all and the run is over.
- **The Changeling** (below) can be found as a piece, and is among theirs
  from depth 8.

[`adventure-check.mjs`](../play/grove-chess/adventure-check.mjs) proves
the statues, the Changeling, dealing at several depths and the cards.

## The Changeling piece

The consolation for shelving the Changeling daily: a Grove fairy piece. It
steps like a king until it takes something, then moves like the last piece
it took, and changes again with every capture (`reshape` in `rules.js`,
for either side). Its shape is drawn as that piece on a plinth of fairy
silver, says so when tapped, and lasts the board. It cannot be fused. Its
model is a hooded fairy child with a borrowed face.

## Paths

| Path | In? | Within one board | Within a run | Across runs | Notated by |
|---|---|---|---|---|---|
| Mastery | in, the core | beating par: the route, reading their reply | combining suits, weapons and pieces | knowing what each upgrade is worth | written (par, the verdict), audial (the fanfare climbs with how far under par) |
| Power | in, a run's curve | weapons and suits change your moves | one piece to four, an upgrade every board | resets each run | visual (suit colours, weapons on the board), written |
| Customization | light | none | which upgrade, on which piece | your first piece | written |
| Collection | thin | none | none | your deepest, in the records line | written |
| Narrative | thin | adventure: down through the Grove, the fall between boards | what you picked up | none | visual (the fall) |
| Social, world, competitive | out | | | | |

**Gaps, and ideas (not built):** something that lasts between runs (the
descent's roster and waystones exist and could be switched on with
`carry`); their pieces with suits and weapons at depth; watching power
against challenge as your four pieces fill with upgrades.

## Open, and Timothy's

- Clouds as the neutral movers (rabbits would count as theirs to take).
- One of theirs moves each turn, as in every Grove mode.
- The new-piece depths (2, 4, 7), and the slack on par.
- Endless, with no final depth.

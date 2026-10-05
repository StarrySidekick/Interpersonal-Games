# Grove chess *(working name)*

The first async prototype for Hikari Garden. See [`../INTENT.md`](../INTENT.md),
2026-10-05. Everything here is a proposal, not a spec.

## The one-line pitch

A daily chess puzzle on a 5x5 board, played with woodland pieces against a
creeping blight. Your score is the link. Replying with your own link grows a
grove that belongs to your group chat.

## Three layers, built in this order

### 1. The daily grove (the Wordle slot)

- Everyone gets the **same position each day**, generated from the date with
  `engine/seed.js`. Same seed, same board, no server.
- You are the **Grove**. The opponent is the **Blight**, which is not a chess
  player but a deterministic rule: each turn it spreads one square toward the
  nearest grove piece, with a fixed tie-break. Its next move is always shown on
  the board (the *Into the Breach* trick), so the puzzle is about planning, not
  guessing.
- **Goal:** cleanse the Blight's root in as few turns as possible without
  losing your Heartseed. Score is turns used against par.
- One play per day. A loss is a score, not a punishment.

Why 5x5: small enough to read on a phone at a glance, and there is precedent.
Gardner's minichess (Martin Gardner, 1969) is 5x5 standard chess, and it was
weakly solved as a draw in 2013. A board that small is a puzzle space, which is
what a daily format wants.

### 2. The vine (the social layer)

- Your share link carries your result and your move line in the URL fragment
  (Engine B). The fragment never reaches a server.
- When a friend opens your link and plays, **their** link carries both of you.
  Each reply is a new branch off the post it answered. The thread in the chat
  becomes a vine, which is where the theme earns its keep.
- Your browser keeps the union of every link it has seen for that group. Union
  never conflicts and never deletes, so it obeys "nothing decays" for free.
  (This is a *grow-only set*, the simplest kind of CRDT: a data type two
  copies can merge without coordination.)
- The first link you open from someone puts you in **their grove**. Every
  solved day plants something there. Over months the grove is the record of
  that chat, and it looks different on day 90 than on day 1.

Known limits of links-only: people only see branches whose links they opened,
so two members' groves can differ. Two people answering the same post fork the
vine. Both are acceptable for a prototype, and the fork is arguably a feature.

### 3. Overlap (later, probably needs a server)

Ideas for when games actually touch each other:

- **Relay:** tomorrow's board starts where the group pushed the Blight today.
- **Shared board:** each person places one piece on a common board per day, and
  the group plays out the result together.
- **Challenge:** your solution line becomes a puzzle a friend has to beat.

These need everyone to agree on one state, which is the point where a small
backend stops being optional.

## Pieces (first draft)

| Piece | Moves | The twist |
|---|---|---|
| **Heartseed** | one step, any direction | the king. Lose it, lose the day |
| **Sapling** | one step forward | left unmoved for two turns, it roots into an Oak |
| **Oak** | cannot move | the Blight cannot enter the squares beside it |
| **Vine** | slides orthogonally, like a rook | leaves growth on squares it passed; the Blight cannot cross growth |
| **Hare** | jumps in an L, like a knight | the only piece that can jump the Blight |
| **Snail** | one step, always turning 90 degrees clockwise from its last move | traces a spiral; cleanses every square it touches |
| **Mushroom** | does not move | if the Blight takes it, spores bloom on every square around it |

Six or seven piece types is the ceiling for a game whose rules must fit on the
same screen as the board.

## Open questions

- Par and difficulty: hand-authored positions, generated ones, or generated and
  then filtered by a solver that checks a solution exists.
- What the share text looks like. Wordle's grid of squares is the bar to beat.
- What gets planted in the grove, and whether it is per person or shared.

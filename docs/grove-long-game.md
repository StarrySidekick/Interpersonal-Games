# The long game: a single-player Grove Chess, designed from the paths

Written 2026-10-06 with the `game-design` skill, after Timothy said the
daily is a separate thing when it comes to progression: it is about social
engagement. So long-term progression gets its own home, a single-player
mode. This is part 2 of the shape in [`INTENT.md`](../INTENT.md) ("a world
you explore, not one puzzle a day") and section 4 of
[`grove-structure.md`](grove-structure.md), worked out against
[`design-philosophy.md`](design-philosophy.md). **A design to react to, not
a decision.** No name yet; "the long game" is a placeholder.

## The split

| | The daily | The long game |
|---|---|---|
| For | the group chat | one player, over months |
| Main path | social | mastery, power, collection, world, identity, narrative |
| Shape | one board a day, the same for everyone | a map of clearings you open in your own order |
| Fairness | everyone equal, so results compare | your progress is yours; nothing to compare |
| Lives in | the link | this browser (with an export code) |

They share the engine, the pieces, the solver and the look. Any bridge
between them is optional (see the questions at the end).

## The spine: play through the history of chess

Two facts make this work.

**In chess, every piece is a verb.** A rook slides, a knight jumps, an alfil
leaps two. The design doc says the best power changes your verbs, not your
numbers. So a growing roster of pieces is power of the best kind, and
learning each new piece is mastery at the same time.

**Chess's own history is a power curve.** Chess reached Persia as
*shatranj*, where the pieces were weak: the **ferz** (the counsellor) moved
one square diagonally and the **alfil** (the elephant) leapt exactly two.
In Spain in the late 1400s, within a generation, the ferz became the
**queen** and the alfil the **bishop**, and the queen went from the weakest
piece to the strongest. Players at the time called the new game things like
"mad queen chess".
Then came the problemists of the 1900s (T. R. Dawson's grasshopper and
nightrider) and Capablanca's compound pieces in the 1920s.

So the player starts with a ferz and a wazir, one humble step each (the
wazir comes from later variants such as Tamerlane chess, but it is the
ferz's natural partner: one step straight to its one step diagonal), and
ends with a queen and an archbishop, and the story they have walked through
is true. That gives the narrative path the *idea* genre for free, and it
fits the setting: the wood is dark because the pieces' stories were
forgotten, and catching rabbits there brings the light back. *Hikari* means
light.

## The paths

Design targets, in the audit format from the skill. Nothing here exists yet.

| Path | First sitting | First week | Third month | Shape | Notated by |
|---|---|---|---|---|---|
| Mastery | catch one rabbit with one-step pieces; read its tracks | two rabbits, bounces, crumbling ground | thinking foes, your own King to protect, mixed goals, birdies on hard clearings | both | badge, fanfare, the map |
| Power | a ferz and a wazir | an alfil, a knight, a rook | the queen, the fairy pieces, an archbishop | vertical and horizontal | the piece's model and its motif change |
| Collection | the first rabbits in the notebook | a region's pieces and patterns | most of the roster, most clearings at par | both | notebook pages, the garden |
| World | one lantern lit | a region coming back | most of the wood lit | vertical | light, colour, music layers |
| Identity | choose your pieces' wood | a garden with rabbits in it | a garden that is clearly yours; a hand you favour | horizontal | the garden, your pieces |
| Narrative | the first piece's story | an era's story | the history up to the 1920s | vertical | cards, the map, motifs |
| Social | out, on purpose | | | | |
| Competitive | out, on purpose | | | | |

### Mastery

The core, as in the daily. What the long game adds is a curve.

- **Each region teaches one idea** in the order the design doc gives:
  introduce it alone, develop it, twist it, combine it with what came before.
  The Warren, for example: one rabbit, then two, then a rabbit that hops
  twice a turn, then two rabbits on crumbling ground.
- **Several clearings are open at once.** Stuck on one, play another. This
  is how a map protects flow: the player picks a challenge that fits their
  mood, so they steer themselves back into the channel between anxiety and
  boredom. Baba Is You's map works this way.
- **Three marks per clearing:** cleared, par, birdie. Clearing is enough to
  move on; par and birdie are there for whoever wants them, and can be
  earned any time later.

### Power

- **Set clearings** have a fixed hand, chosen in the lab and checked by the
  solver. They teach and test, and power cannot make them trivial.
- **Free clearings** let you pick your hand from your roster. The solver sets
  par against the hand you bring, so a queen makes a clearing easier to win
  and par harder to beat. Power grows without breaking mastery.
- **Crossings** are paths on the map that need a verb: a river of crumbled
  squares only a leaper can cross, a ring of holes only a nightrider can
  reach across. A new piece opens new places. Games where new abilities act
  as keys to new areas are called *Metroidvanias*, after Metroid and
  Castlevania; this borrows their best trick.
- **The big moment is the ferz becoming the queen**, at the end of the era
  where it happened. The piece you have carried since the first clearing is
  transformed, not replaced.
- **No experience points.** Power comes from finishing a region, never from
  repeating old clearings. Doing new things is the only way up.

### Collection

- **The roster:** every piece you have befriended, each with a history card
  (who invented it, when, where) and its turning model.
- **The notebook:** every rabbit you catch gets a page with its pattern drawn
  out, and the pattern plays its tune. The daily already makes each pattern
  a tune, so a notebook is a songbook.
- **The marks:** cleared, par and birdie on every clearing.
- **Nothing is missable.** Every clearing stays open forever; there is no
  numbered gap for anything skipped.

### World

- The map starts dark, and each clearing you finish lights a lantern there
  for good. A region whose clearings are all lit comes back to colour.
- **The music is a record too.** Each restored region adds a layer to the
  map's music. Game audio calls this *vertical layering*: the score is
  recorded as stacked parts, and the game fades parts in as the state
  changes. Come back after a month and the wood sounds the way you left it.
- Nothing goes dark again. A place you left waits for you.

### Identity

- **The garden** is your home clearing. Rabbits you have caught live there,
  hopping in their own patterns, so the collection is alive and on display.
  Things you earn (a lantern from each region, stumps, flowers) are yours to
  place.
- **Your pieces' wood:** oak, birch, cherry, stone. One chosen at the start,
  so there is something of yours from the first minute; more opened by
  regions.
- **The hand you bring** to free clearings says how you like to play.

### Narrative

| Elemental genre | Where it is |
|---|---|
| Idea | the true history of each piece, one card at a time |
| Mystery | every rabbit's pattern; the larger question of why the wood went dark |
| Wonder | fairy pieces that move like nothing in normal chess (the rose curving round a circle) |
| Adventure | the map, and the crossings that open it |
| Humor | a rabbit that eats chess pieces, and an owl at dusk |
| Thriller | dusk, thinking foes that hunt you, ground falling away |

Light on words. A card per piece and per era, the rest told by the map,
the models and the music.

### Social and competitive: out on purpose

The daily carries the social path, so the long game does not need to. That
is a decision, not a gap. Competition stays out for the house-rule reason.
Small bridges are listed under questions.

## Pacing: staggered curves

| Every clearing (2 to 4 minutes) | Every few clearings | Every region (a week or two) |
|---|---|---|
| a lantern lit, a notebook page, a mark | a new twist on the region's idea | a new piece, an era's story, colour and a music layer back |

Something moves at every scale, so no single curve has to carry a sitting.
It also fits the session shape in [`scope.md`](scope.md): a round is one
clearing, a sitting is a few, and the arc is the wood.

## How progress is notated

| Milestone | Written | Visual | Audial |
|---|---|---|---|
| Clearing cleared | the mark | the catch, then the lantern lighting | the fanfare (built) |
| Par, birdie | the golf word | the badge's colour (built) | a longer fanfare (built) |
| Rabbit caught | its notebook page | it appears in your garden | its pattern's tune (built) |
| Piece befriended | its card | its model turning, joining your side | its own short motif |
| Ferz becomes queen | the card for 1475 | the model transforms | the ferz's two notes grow into the queen's whole phrase |
| Region restored | the era's card | colour floods the region | a new layer in the music |

The ferz-to-queen row is the doc's audial idea made literal: a
**leitmotif**, a short phrase tied to one character, that grows as the
character does.

## The regions

A first sketch. The order matters more than the details.

| Region | Era | Teaches | You gain |
|---|---|---|---|
| The Old Garden | shatranj, around 600 | the rabbit, tracks, waiting | starts with ferz and wazir; gains the alfil |
| The Warren | | many rabbits, two-hop rabbits, bounces | the knight (shatranj's horse) |
| The Ridge | | crumbling ground | the rook |
| The River | xiangqi | the cannon's screen jump, the blockable horse | the cannon and the mao |
| The Court | medieval Europe | thinking foes, take their King, protect your own | the king, the pawn |
| The Queen's Hall | Spain, late 1400s | everything so far, faster | **the ferz becomes the queen, the alfil the bishop** |
| The Green | no era: a joke region | ball and moving hole | the ball |
| The Fairy Wood | the problemists, 1900s | grasshopper, nightrider, rose, squirrel, camel, zebra (the camel is far older, from Tamerlane chess) | each of them |
| Capablanca's Gate | 1920s | compound pieces | the archbishop |

About eight clearings each, so roughly 70 in all: months of play at a few
sittings a week. The engine can already build every one of these except
new compound pieces.

## Building it

- **A clearing is a lab level:** settings plus a seed, which already
  rebuilds exactly anywhere. Timothy plays the lab, rates levels, and the
  best ones become clearings, with par worked out once when they are chosen
  and stored, not on the phone.
- **Its own page**, for example `play/grove-chess/wood/`. The daily is not
  touched, so no dealer version is needed.
- **Progress** lives in this browser under its own key, only ever added to,
  with an export code so it survives a new phone (`engine/record.js` already
  works this way).
- **New pieces** (a chancellor, say) go into `rules.js` without touching
  anything the daily deals from, and `check-daily.mjs` proves it.

## Suggested order

1. **The first region as a slice:** The Old Garden's eight clearings from
   the lab, a plain map (a path of lanterns, not yet a 3D diorama), saved
   progress, notebook pages, and the alfil joining at the end with its card
   and motif. This tests whether *clear, light, befriend* is fun before
   anything else depends on it.
2. **The garden**, with caught rabbits hopping in it.
3. **Regions two and three**, then crossings once there are two kinds of
   piece to gate with.
4. **The Queen's Hall**, built toward as the first big payoff.

## Questions for Timothy

- Is the history of chess the right spine, or should the long game have a
  fiction of its own (the PET, the abandoned forest)? The two combine: the
  wood is dark because the pieces' stories were forgotten.
- Should the daily feed it at all? Two light bridges: pieces you meet in the
  daily count as *met* in the roster, and rabbits you catch in the daily
  hop into your garden.
- How long should it be? Seventy clearings is months; twenty is a few weeks.
- A name for it.

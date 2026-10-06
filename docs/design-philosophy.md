# Design philosophy: paths and the player story

Recorded **2026-10-06** from Timothy's own description of how he designs
games. This is the foundation every game here is judged against, whatever
track it is on. [`INTENT.md`](../INTENT.md) says *what* to build; this says
*how to tell whether it is good*. The `game-design` skill
([`.claude/skills/game-design/`](../.claude/skills/game-design/SKILL.md))
turns it into a method for working sessions, and
[`grove-chess-paths.md`](grove-chess-paths.md) is the first worked example.

The categories and the claims are his. Where a section goes further (a
failure mode, a test, an example), that is elaboration added for rigor, and
he can overrule any of it.

## The idea

A game serves certain **playstyles**: the reasons a person plays at all.
Each playstyle has its own **path**, a progression curve along which the
player grows over time. All the paths together tell the **player story**,
the story of one person's time with the game. A good game picks the paths it
wants, gives each one a real curve, keeps the player in flow along all of
them, and marks progress in ways the player can see and hear, not only read.

## Terms

- **Playstyle.** What a person came for: getting good, expressing
  themselves, owning things, growing strong, being with people, changing the
  world, hearing a story, beating others.
- **Path.** One dimension a player progresses along, with its own curve over
  time. A path that is present on the first play and identical on the
  fortieth is **flat**.
- **Player story.** What every path says at once: what you got better at,
  what you built and collected, who you played with, what changed because you
  were there. It is not the game's plot (that is one input, the narrative
  path). Two people playing the same game have different player stories.
- **Flow.** The absorbed state that happens when challenge matches skill,
  from the psychologist Mihaly Csikszentmihalyi (*Flow*, 1990). Too hard
  gives anxiety, too easy gives boredom; flow is the channel between. Because
  skill keeps growing, the challenge has to keep rising to stay in the
  channel, which is why mastery is an arms race.
- **Prescribed progression.** How the game itself notates that you
  progressed: written, visual, audial. See below.
- **Vertical and horizontal.** Vertical progression is linear movement up a
  ladder: level 1 to 20, a bigger number. Horizontal progression is more
  options over time at the same height: new outfits, new pieces, new routes.
  Most paths can go either way. Vertical gives the feeling of climbing;
  horizontal gives breadth, so the climb does not collapse into one number.

## The paths

| Path | What grows | Where it lives | Usual shape | Think of |
|---|---|---|---|---|
| Mastery | the player's skill | in the player | vertical | Tetris, Celeste |
| Customization / identity | how much you can express yourself | in your avatar, home, style | horizontal | The Sims |
| Collection | what you have and have completed | in the save | both | Pokemon, achievement lists |
| Power | what is possible for you in the world | in the character | vertical | D&D, level 1 to 20 |
| Social | your connection with the people you play with | between the people | muddy | Animal Crossing, Stardew's hearts |
| World | the world itself, changed by you | in the world | both | a land you restore or reshape |
| Narrative | the story | in the story | mostly vertical | any story game |
| Competitive | your place in a hierarchy of skill | in a community | vertical | ranked ladders, chess ratings |

"Where it lives" is the test that separates paths that look alike. Mastery
lives in the player, so it carries over to a new save file. Power lives in
the save, so a new file starts you weak again.

### Mastery / mechanical

The arms race between the player getting better at the game's mechanics and
the game introducing more mechanics, or harder challenges, to meet them.
**Flow matters most here.**

- *Progresses by:* new mechanics, then combinations of them, then harder
  versions. A reliable teaching order is to introduce a mechanic alone,
  develop it, twist it, then move on (the four-step structure Nintendo's
  designers have described for *Super Mario 3D Land*, borrowed from the
  *kishotenketsu* story form).
- *Goes wrong when:* challenge outruns skill (a wall) or lags it (boredom);
  every mechanic is on the table on day one, leaving nothing to introduce;
  difficulty is random instead of shaped.

### Customization / identity

*The Sims* is king. Games often start with little room to express yourself,
and as you play you unlock more of it: clothing, design, homes, even
playstyles. Some games front-load a few choices so you have something of
your own early and are drawn into the world.

- *Progresses by:* unlocking options, mostly horizontally.
- *Goes wrong when:* everything is open at the start (nothing to earn, and
  choice paralysis) or nothing is open until late (no attachment early);
  the expression is never seen by anyone, including you.

### Collection

The collectathon. Numbers going up, completing sets, earning achievements,
gathering items. Just getting stuff is intrinsically fun.

- *Progresses by:* acquisition (horizontal) and completion (vertical).
- *Goes wrong when:* items are missable or time-limited, which turns
  collecting into fear of missing out; the collection has no visible home;
  it is padded with filler.

### Power

Growing in what is possible within the game world. The pursuit of the
wizard: start with little power and end with a great deal, like a D&D
character going from level 1 to 20.

- *Progresses by:* new abilities and stronger ones. The best power
  progression changes your verbs (a new spell, a new way to move), not only
  your numbers (+3% damage is a number, not power).
- *Goes wrong when:* power outruns challenge, which makes everything trivial
  and kills mastery, unless the world rises to meet it.

### Social

The chance to be social inside the game. The progression is muddier here,
but often it is simply being able to socialize, or to do the other paths
with other people, and in turn to grow and tend your connection with the
people you play with.

- *Scales:* **two people**, an **ensemble** (a small group), or a whole
  **community**. Each is a different design.
- *Progresses by:* the game can chart your connection with prescribed
  progression to enhance it: Stardew Valley's friendship hearts, Persona's
  social links.
- *Goes wrong when:* the chart becomes a grind that stands in for the
  connection; the game turns into an obligation between friends.

This repo's premise lives on this path. See the house rules below.

### World

The world changes as you progress through it or through the story. It often
pairs with power or narrative: the things you do affect the world directly
and in ways that matter over time.

- *Progresses by:* places opening, restoring, growing, or being reshaped.
- *Goes wrong when:* the change is cosmetic and not caused by you, or you
  never see the before and after side by side.

### Narrative

Story, characters, plot, more story. Its own section below, because it can
grow in every way a story in literature can.

### Competitive

Ascending a social hierarchy of challenge or skill: **mastery paired with
social proof.** Not every game needs it or has it; it lives mostly in online
player-versus-player games.

- *Goes wrong when:* the ladder only rises for a few and sinks for most, or
  the stakes outgrow the game. In this repo, house rule 4 already caps it.

## Narrative and elemental genre

Narrative progression is complex, because a story can grow and change shape
in every way a story in literature can, and it carries genre inside it.

**Elemental genre** comes from *Writing Excuses*, the writing podcast
Brandon Sanderson co-hosts with Mary Robinette Kowal, Dan Wells and Howard
Tayler (season 11, 2016). It sorts stories by the emotion they give the
reader rather than the shelf they sit on, and one story usually mixes
several:

| Elemental genre | The emotion | In a game, where the player produces it |
|---|---|---|
| Wonder | awe: "I didn't know that was possible" | a vista; a mechanic that should not work but does |
| Idea | fascination with a concept | a system that is the idea, like Portal's portals |
| Adventure | the excitement of going somewhere new | exploration, the next area |
| Horror | dread | vulnerability, dwindling resources, the thing you cannot fight |
| Mystery | wanting to work out a hidden truth | the player is the detective and actually solves it (Outer Wilds, Return of the Obra Dinn) |
| Thriller | tension against danger and a clock | pursuit, timers, a countdown that is yours |
| Humor (comedy) | delight in the unexpected | systems colliding, emergent slapstick |
| Relationship | investment in a bond between people | companions, or the real people you play with |
| Drama | internal struggle and change | choices with a cost the player has to own |
| Issue (problem) | seeing a real question differently | Papers, Please |
| Ensemble | the pleasure of a group of distinct people | a party or crew, or a real group playing together |

**What a game adds:** the player is a co-author. A book's mystery is solved
for you; a game's mystery is solved *by* you, and the solution is yours. A
thriller's clock in a game is your clock. And the other paths keep producing
story beats nobody wrote: the challenge you finally beat is a small drama,
the rare thing you found is a small wonder. That is what makes narrative in
a game more dynamic and more personal than on a page, and it is how the
narrative path and the player story meet.

In this repo, relationship and ensemble can be made of real people, which
no novel can do.

## Prescribed progression: how the game says you progressed

1. **Written.** The weakest. "You leveled up." "You got this." "Achievement
   unlocked." A plain record that something progressed or unlocked. It tells
   rather than shows, and reading is not feeling. Needed for precision,
   never enough alone.
2. **Visual.** Colors, textures, animations. Your gear looks different, the
   world turns from grey to green, a flash, a pose.
3. **Audial.** Musical motifs, jingles, sound effects, songs. A
   **leitmotif** (a short musical phrase tied to a character or idea, the
   device Wagner built his operas on) can itself progress, growing as the
   thing it stands for grows.

The moments that matter use all three at once. When Link gets an item in
*Zelda*, the jingle plays (audial), he holds it overhead (visual), and a box
names it (written). Each register does a different job: sound says
something good happened before you look, the picture says what, the words
say exactly. **A milestone notated only in words is under-notated.**

Two extensions, offered as elaboration: on a phone, **touch** (haptics) is a
fourth register; and the strongest notation of all is the world itself
changing, which is the world path doing the notating.

## How the paths work together

- **Choose paths on purpose.** A game does not have to serve all eight.
  Write down which are in, which are out, and why. Out is a decision; missing
  is a mistake.
- **Give each chosen path a curve.** Flat paths are what make a game stale.
- **Stagger the curves.** When one path plateaus, another should be moving,
  so something is always progressing.
- **Let paths feed each other.** Collection unlocks customization, power
  opens the world, the world tells the story, social multiplies all of it.
  One change that moves two paths beats two changes that move one each.
- **Notate in more than words.**
- **Keep flow across all of it.**

The aim, in his words: a good game creates flow and solid progression in most
or all of its desired paths. The player unlocks customization, progresses the
story, gets better at the game and meets challenges that test it, builds out
their collection, further expresses their identity, impacts the world, and
discovers new and novel things about the game.

## In this repo

The [house rules](house-rules.md) and [the session shape](scope.md#the-session-shape)
bend the paths in specific ways:

- **Nothing decays.** Progression only accrues. No path goes backwards for
  time away.
- **No streaks.** A count may total days played, never consecutive days.
- **Collections without dread.** No missable items. A missed day is either
  something you can go back to or simply not shown; never a numbered hole.
- **Competition stays small** (house rule 4). Against the puzzle, compared in
  a chat; no ladders, no championships.
- **Social is not optional here.** Every game says which scale it is for
  (two people or an ensemble) and what progresses *between* the people. A
  game can leave it out of one mode when another mode carries it: Grove
  Chess's daily is the social mode and its long game is single-player.
- **No server** unless it has been decided one is worth it. A path that needs
  everyone to agree on one shared state (a group world, a ladder) runs into
  this, and a proposal should say so.

## Using it: a path audit

For a new game, or before changing one:

1. **Pick the paths.** In, out, and why.
2. **Fill a row for each path that is in:**

   | Path | First play | First week | Third month | Vertical / horizontal | Notated by (W/V/A) |
   |---|---|---|---|---|---|

3. **Read the table for:** flat rows; rows notated only in words; curves
   that plateau at the same moment; paths working against each other (power
   trivializing mastery); anything that breaks a house rule.
4. **For each proposed change,** name the paths it moves and the registers it
   notates in. Prefer changes that move two paths.

## Open

- **Discovery.** His summary of a good game ends with discovering new and
  novel things about it, which is not one of the eight. It could be a path
  of its own (secrets, hidden mechanics, the pleasure of finding out) or a
  part of mastery and world. Undecided.

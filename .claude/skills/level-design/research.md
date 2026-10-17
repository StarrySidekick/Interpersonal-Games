# Level design for small procedural boards: research

Gathered 2026-10-17 for Grove Chess's Adventure boards, from primary sources
where they could be found (talk transcripts, developer posts, papers); where a
point rests on a wiki or fan reverse-engineering it says so. Quotes are
verbatim; everything else is paraphrase. The sources are at the end.

## Principles

1. **Build the solution first, then decorate.** Lay the capture route
   (which piece takes what, in what order) and add rabbits and obstacles that
   do not break it, or search backward from the cleared board. Random layouts
   are almost always unsolvable or trivial. *Spelunky builds its guaranteed
   path before the side rooms (Kazemi); Taylor and Parberry's Sokoban
   generator plays backward from the goal, so every state is solvable.*
2. **Hand-make tiny parts, let rules assemble them.** A library of two to
   four piece motifs (a sentry guarding a file, a robot loop crossing a fork,
   a scared piece with one escape), with probabilistic cells, rotated or
   mirrored, stamped in from a per-depth recipe. Pure noise reads as chaos;
   templates read as designed and still vary. *Spelunky: 8 to 16 templates
   per room type, probabilistic tiles, mirroring. Dead Cells: hand-made tiles
   slotted into a per-biome concept graph, retried until constraints hold.
   Rogue Legacy: stitching hand-built rooms is what made it affordable.*
3. **Generate and test, scoring each candidate, not just pass or fail.**
   Keep the best of N within a time limit; difficulty must not be "wildly
   out of step" with the rest, and a generator running during play needs a
   predictable running time. *Togelius et al.*
4. **Par length is not difficulty.** Long walks add moves, not thought.
   Measure piece switches, forced moves and how many rabbit rules a solution
   uses; penalise long one-piece shuffles. *Taylor and Parberry: move counts
   measured tedium; many equally deep sibling solutions made levels less
   interesting.*
5. **Score the trick by comparing a shallow solver with a deep one.** The gap
   in strokes between a greedy or one-move solver and the optimal one is how
   counter-intuitive a board is; prefer a unique (or nearly) best first move.
   *Generating Creative Chess Puzzles (arXiv 2025).* The sentient rabbit's
   one-move look is the same tool.
6. **Difficulty has a cliff; budget with headroom.** In a perfect-information
   puzzle "too hard" means "unsolvable", sharply. *Into the Breach: one enemy
   too many broke boards; about 200 pre-made maps because bad terrain wrecked
   difficulty.* Constrain terrain: no disconnected floors, no large open
   areas, no dead-end cells (Taylor and Parberry).
7. **Telegraph everything; settle randomness before the player's turn.**
   Show each rabbit's next move and reach; break ties deterministically so par
   is fixed. *Into the Breach shows every target; Slay the Spire went through
   about ten versions of its intent system; Hoplite's demons are short
   priority lists.*
8. **One rule per enemy; upgrades change numbers, never behaviour.** *Into
   the Breach: "Alpha" versions are stronger in consistent ways; a behaviour
   change on upgrade was too hard to track; they built weapons "the UI could
   describe".*
9. **Introduce one mechanic at a time: introduce, develop, twist, conclude.**
   *Hayashida on kishotenketsu in Mario; Butler et al. built progressions from
   features common to all solutions, single concepts first; Desktop Dungeons:
   for experienced players tension comes from more kinds of situation, not
   tougher monsters.*
10. **Pools by depth, with minimum-depth gates and shuffle bags.** *Slay the
    Spire: an easy pool for the first fights of an act, elites never back to
    back; Balatro: each boss has a minimum ante and none repeats until all
    have come; Left 4 Dead: boss events dealt from a shuffled bag.*
11. **Spend a threat budget, with a cost per type and placement rules.**
    *Dead Cells: monster count from combat tile length; dangerous monsters
    count as ten tiles; caps; some types cannot share a platform.*
12. **Pace runs as a sawtooth, not a ramp.** Peaks, then breathers. *Left 4
    Dead's Director "adjusts pacing, not difficulty"; Dead Cells kept
    dramatic peaks and relaxing breaks; Hades biomes open with a free reward
    room and close on a boss; Balatro: 1x, 1.5x, then a boss at 2x with a
    rule, then the base jumps.*
13. **Every Nth board a boss: one rule twist, announced in advance.**
    *Balatro's boss blinds every third round, shown before you play;
    Slay the Spire's act boss known in advance.*
14. **Preview the reward and the risk; one clear decision between boards.**
    *Hades doors show the reward; Into the Breach cut its strategy layer to
    "one interesting choice" and avoided options ten times better than the
    rest.*
15. **Kill dead turns.** Reject boards whose best line is a long chase
    (scared, fleeing pieces are the risk). *Into the Breach added turn limits
    partly to stop "chasing down the final enemies"; battles of 4 to 5 turns.*
16. **Never leave the player in a silent checkmate.** Detect lost positions
    and offer a retry, rather than making them play the loss out. *Into the
    Breach added a small grid-defense chance because ending a turn in a lost
    position felt mean.*
17. **Watch the generator's spread; remove near-duplicates.** Plot boards per
    depth on two axes (par against trick gap, say); reduce boards to a
    canonical form across rotations and reflections. *Smith and Whitehead's
    "expressive range".*
18. **Calibrate against real play, carefully.** *van Kreveld et al. fitted
    features to ratings; Slay the Spire split data by Ascension and warned
    that a few heavy players dominate averages.*

## A recipe shape

```
run:    acts of ~5 slots: [intro, normal, normal, elite, boss]; size steps up by act
budget  = (b0 + b1 * depth) * slotMult[intro .75, normal 1, elite 1.3, boss 1.15]
pools:  rabbit {cost, minDepth, max, weight}; bossRule {minDepth} from a shuffle bag
targets per slot: par band, a new kind only where it debuts, no long chases
loop (N tries or T ms): spend the budget within caps; terrain; solve; keep or deal again
fallback: cut the budget and retry; never ship an unsolved board
```

Guarantees: every board solvable; a new kind first turns up with at most one
other special kind beside it; a boss rule never pairs with a brand new kind;
each board's seed comes from the run seed and its depth, so it can be dealt
again exactly.

## Meta progression that adds options, not power

- Unlocks add content to the pools (new rabbit kinds, suits, weapons, pieces,
  looks), each met first on an intro board. *Balatro, Slay the Spire.*
- Sidegrades you can swap. *Hades' Mirror: each talent has an alternative.*
- Opt-in difficulty as named, stacking rules. *Hades' Pact of Punishment,
  Slay the Spire's Ascension, Balatro's stakes.* With golf scoring: a best
  card for each set of rules.
- New routes, not new strength. *Dead Cells' keys open paths for later runs.*
- An optional, visible assist. *Hades' God Mode; Kasavin: if you could "just
  blow through it, what's interesting about the game goes away".*

Pitfalls: stat meta makes the early game trivial and moves mastery into the
save file (Rogue Legacy's own talk calls its rising-price fix "a bad
solution"); farming is a warning sign; strictly better unlocks make choices
fake; upgrades that change enemy behaviour break what players learned; keep
it permanent and never punishing (this repo's house rules).

## Sources read

- https://tinysubversions.com/spelunkyGen/ and https://tinysubversions.com/spelunkyGen2/
- https://www.youtube.com/watch?v=s_I07Iq_2XM (Into the Breach design postmortem, GDC 2019)
- https://www.youtube.com/watch?v=7rqfbvnO_H0 (Slay the Spire: Metrics Driven Design, GDC 2019)
- https://www.youtube.com/watch?v=apfNODay1_s (Rogue Legacy design postmortem, GDC 2014)
- https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach- (Benard, Dead Cells)
- https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf (Booth, Left 4 Dead)
- https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design (Hayashida)
- http://julian.togelius.com/Togelius2011Searchbased.pdf
- https://ianparberry.com/techreports/LARC-2011-01.pdf
- https://arxiv.org/html/2510.23881v1 (Generating Creative Chess Puzzles)
- https://www.microsoft.com/en-us/research/publication/automatic-game-progression-design-analysis-solution-features/ (abstract only)
- https://research-portal.uu.nl/en/publications/automated-puzzle-difficulty-estimation/ (abstract only)
- https://dl.acm.org/doi/pdf/10.1145/1814256.1814260 (Smith and Whitehead; excerpt only)
- https://www.inverse.com/gaming/hades-god-mode-interview (Kasavin)
- https://localthunk.com/blog/balatro-timeline-3aarh
- https://terrycavanaghgames.com/dice/presskit/switch/
- https://medium.com/@ThatOneAJ/shotgun-king-interview-with-r%C3%A9my-devaux-ae7124fee814
- http://devmag.org.za/2011/03/03/desktop-dungeons-design-analysis-part-1/ (third-party analysis)
- https://github.com/ychalier/hoplite/blob/master/RULES.md (fan reverse-engineering of Hoplite)
- https://the-art-of-x.writeas.com/game-breakdown-hoplite (secondary)
- https://thom.ee/blog/what-makes-or-breaks-agency-in-roguelikes/ (secondary)
- Wikis, for mechanics only: Balatro blinds and antes; Hades chambers, Tartarus, Pact of Punishment, Mirror of Night; Slay the Spire map locations; a community Steam guide to its map generation.

Gaps: no primary source found for Hoplite's generation or Hades' encounter
design (wikis and secondary write-ups only); Butler et al. and van Kreveld et
al. from abstracts only; Shotgun King's card pairs from wiki and guide
excerpts.

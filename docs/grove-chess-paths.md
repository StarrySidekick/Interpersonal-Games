# Grove Chess through the paths

The first audit using [`design-philosophy.md`](design-philosophy.md), run
2026-10-06 against Grove Chess as it is on `main`. **Ideas, not decisions.**
Each one says which paths it moves, what it costs, and what it risks. How
the game works now is in [`grove-chess.md`](grove-chess.md); the larger
structural options are in [`grove-structure.md`](grove-structure.md).

## Where it stands

| Path | In? | Within one game | Across days | Notated by |
|---|---|---|---|---|
| Mastery | in, the core | reading the hidden pattern, learning the day's fairy piece, beating par | **flat**: par 4 to 7 at random, every mechanic can appear on any day, the twelve fairy pieces cycle and repeat | written ("Birdie") |
| Identity | barely | your name on the vine | none | written |
| Collection | not yet | none | none visible; `engine/record.js` logs each finished day and nothing shows it | none |
| Power | out, correctly | none | none | none |
| Social | in, the strongest | the vine: links, branches, overlays, watching friends' games | **resets daily**; nothing accrues for the group | visual (colored paths), written (the list) |
| World | barely | the bramble creeps | none | visual |
| Narrative | thin, promising | mystery (the hidden pattern, then the reveal), thriller (dusk, a rabbit that eats, the creeping bramble), humor (a rabbit that eats chess pieces), wonder and idea (fairy pieces and their history) | none | written |
| Competitive | light, correctly | par, and scores on the vine | none | written |

**By register:** written is everywhere. Visual is strong in places (the
opening slam and cards, legal-move squares, the vine overlay, the pattern
drawing) and weak at the moment that matters most: on a catch the rabbit
simply vanishes and the result arrives as text. **Audial is empty.** There
is no sound at all. Touch exists (haptics on moves and the end).

**The reading:** each day is a good, complete chase, and the in-game curves
for mastery, social and narrative are real. But the player story is one day
long. Day 40 is day 1 again, which is the exact complaint
[`INTENT.md`](../INTENT.md) records about the Wordle-style games this is
reacting to. The gap is curves *across days*.

## Ideas

### Small, and safe for the dealer

None of these re-deal a board, so `check-daily.mjs` stays green and every
shared link keeps working.

1. **Sound.** Fill the empty register. Synthesized in the browser with the
   Web Audio API (no audio files, no dependencies): a hop, a capture, a
   crunch when the rabbit eats, a dusk sting, and a catch jingle that climbs
   with the result (par, birdie, eagle each a step higher). Mute beside the
   theme toggle. `docs/scope.md` already asks for sound where it matters.
   *Moves:* notation for mastery and narrative (the thriller beats).
2. **A catch worth the chase.** A beat of stillness, the rabbit tumbles,
   leaves burst, then the pattern draws itself across the board stroke by
   stroke. The reveal is the mystery's answer; show it before writing it.
   *Moves:* mastery and narrative notation.
3. **The field notebook.** A page for each day you played: that rabbit's
   pattern drawn out (`patternPicture` already draws it), the fairy piece,
   your result, the names on your vine. It shows what you have and never
   numbered blanks for days you missed. The data is already on the phone.
   This is scope rule 5, "the record is first class", finally given a face.
   *Moves:* collection, narrative (your history as a story), social.
4. **The piece album.** The twelve fairy pieces in two tiers: *met* (you
   played a day with it) and *mastered* (you caught the rabbit with it).
   Mastering one opens its history card (Dawson's Grasshopper of 1912, the
   shatranj ancestors of the bishop and queen), turning the idea genre into
   a reward. Optional: each mastered piece adds a phrase to the title tune,
   so a full album plays the whole song, a leitmotif that grows with the
   collection. *Moves:* collection (horizontal, then vertical), mastery
   (a reason to learn every piece), narrative (idea), audial notation.
5. **Past boards.** Any earlier day, playable from the notebook. The dealer
   already deals any date (test mode does it). A missed day becomes
   something you can go back to, which is what "nothing decays" asks of a
   collection. *Moves:* collection, mastery.
6. **Your color on the vine.** Choose your swatch once, and it travels in
   your link, so you are the same color on every friend's overlay. Today
   colors go by order and differ from phone to phone. Needs a
   backward-compatible addition to the link format in `vine.js`, not a
   dealer change. *Moves:* identity, social.
7. **A share picture.** `grove-chess.md` already says "Wordle's grid is the
   bar." A small grid of squares showing the shape of your chase is visual
   notation inside a text message. It must not give away the pattern.
   *Moves:* social, notation.

### Medium: needs a versioned dealer

8. **A weekly rhythm.** Shape difficulty across the week the way the New
   York Times crossword gets harder from Monday to Saturday: a gentle 5x5
   with no bramble early in the week, bramble midweek, stumps and the larger
   board toward the weekend, something special on Sunday (two rabbits, or the
   ball and hole). Mechanics arrive alone and are then combined. It is a
   calendar, not a streak: miss Wednesday and Thursday is still Thursday.
   This is the one idea that gives mastery a curve across days.
   *Moves:* mastery, flow. *Cost:* it changes dealing, so it ships as dealer
   v2 from a start date, with earlier dates still dealt by v1 so old links
   replay (see "Do not casually change the dealer" in `grove-chess.md`).
   The lab should find each weekday's settings first.

### Large: the structural options, mapped to paths

9. **Branch gifts** ([`grove-structure.md`](grove-structure.md), 2A). You add
   one thing to the board for whoever plays from your link. *Moves:* social,
   identity (the gift says something about you), the start of a group story.
10. **The group grove** (`grove-structure.md`, 3). A concrete form for it:
    each day a vine played becomes a small turning diorama of that day's
    board, planted in the grove. The low-poly engine already renders boards,
    and the bramble, stumps and drawn pattern make each one different. The
    garden *is* the record. *Moves:* world, social, collection. *Risk:* every
    phone agreeing on one grove may need a server; built from the union of
    games each phone has seen, two friends' groves will differ.
11. **World clearings with a roster** (`grove-structure.md`, 4). This is where
    power belongs. Start with a Wazir and a Ferz; each clearing adds a piece
    to your roster, broadening it (horizontal) and climbing toward the strong
    pieces (vertical). The solver sets par against the roster you have, so
    power grows without making the puzzles trivial. *Moves:* power, world,
    mastery, collection.

### Which paths each idea moves

| Idea | Mastery | Identity | Collection | Power | Social | World | Narrative | New register |
|---|---|---|---|---|---|---|---|---|
| 1 Sound | x | | | | | | x | audial |
| 2 The catch | x | | | | | | x | visual |
| 3 Notebook | | | x | | x | | x | visual |
| 4 Album | x | | x | | | | x | audial |
| 5 Past boards | x | | x | | | | | |
| 6 Your color | | x | | | x | | | visual |
| 7 Share picture | | | | | x | | | visual |
| 8 Weekly rhythm | x | | | | | | | |
| 9 Gifts | | x | | | x | | x | |
| 10 Group grove | | | x | | x | x | | visual |
| 11 Clearings | x | | x | x | | x | | |

## Out on purpose

- **Power in the daily.** The daily's point is one board for everyone, so a
  result means the same thing in every chat.
- **A competitive ladder** across chats or players. House rule 4. Par is the
  competition: you against the puzzle, compared among friends.
- **Any count of consecutive days.**

## Suggested order

1. **Sound and the catch** (1, 2). The cheapest, and they lift the notation
   of everything the game already does well.
2. **Notebook, album and past boards** (3, 4, 5). The first thing that
   accrues across days for a single player, built on data the phone already
   keeps.
3. **The weekly rhythm** (8), designed in the lab first, shipped as dealer v2.
4. Then **gifts and the group grove** (9, 10), the group-sized versions of
   the same idea, already recommended in `grove-structure.md`.

## Questions for Timothy

- Is a weekly rhythm right for the daily, or should every day stay
  comparable in difficulty so no day is "the easy one"?
- Should past boards count for the album the same as the day itself?
- Sound on by default, or off until switched on?

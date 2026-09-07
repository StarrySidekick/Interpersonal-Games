# Interpersonal Games

> **Read [`INTENT.md`](INTENT.md) first.** It records what this project is for
> and what Timothy wants next, in his own words, dated. Where it disagrees with
> this file about *direction* it is newer and wins; where it disagrees about
> *mechanics* — how the code works, what was decided deliberately, the
> invariants — this file wins.

**You find a PET in an abandoned, forested place.**

You wake it up. It bonds with exactly one other person, and from then on the
two of you can talk through it like a walkie-talkie, wherever you each are.
It also holds games — small ones, the kind two people play against and
alongside each other — and playing them is what feeds the place. Your gardens
grow. The forest comes back.

That is the whole thing. **The games are not the product. The place is, and the
games are what tends it.**

## What it actually is

Two people, a phone each, usually already on a call. Ten or twenty minutes at a
time, picked up again whenever you are both around, which might be Thursday or
might be three weeks from now. In between, what you have made together sits
there and waits.

It is closer to *It Takes Two* or *Split Fiction* than to a party game: built
for two specific people who want to be closer, not scaled down from something
built for six. One PET, one bond, one other person.

It began as something for two people in particular. It is aimed a little wider
now, but it never becomes a game for a group.

## The five rules a game in here has to keep

These predate the framing above and every one of them survived it. Two of them
stopped being merely sensible and became load-bearing.

1. **Be built for two.** Not scaled down from a party game.
2. **Run alongside a conversation, not instead of one.** You should be able to
   look away from the screen for fifteen seconds and lose nothing.
3. **Finish in a sitting, and survive a gap.** Ten to twenty minutes, ending
   complete. Three weeks later you pick it up with no rules to relearn and
   nothing lost for having been away.
4. **Be different on the tenth night than the first.** Something accrues.
   **The garden is the answer to this one.** It was called the hard part before
   there was anywhere for the growing to go.
5. **Leave you closer.** By laughing, by learning something, or by having made
   a thing together. A game you can win and feel nothing afterward isn't for
   this repo.

**Nothing here decays, nags, or keeps a streak you can break.** Which now has
teeth: a garden that wilts because you did not call is exactly the guilt
mechanic this repo bans. A place you left is a place that waits for you. Come
back after a month and it greets you with what you have built, never with what
you missed. See rule 2 of [the session shape](docs/scope.md#the-session-shape).

## Playable now

Two games run. There is not yet a place for them to feed.

**[Blind Agreement](games/blind-agreement.md)** — you both have to pick the
same thing; miss, and both your picks come off the board.
**[Play it](play/blind-agreement/)** · 30 seconds a round, a phone each.

**Twenty-Twenty** — you're both guessing, and each of you is allowed to lie
once.
**[Play it](play/twenty-twenty/)** · 10–15 minutes, a phone each.

## What is next

In order, and the order matters:

1. **The environment.** Render the place the games are played in and fed by.
   This outranks adding games, and there are no new games until it exists.
2. **Solo play, for testing.** Right now trying anything out requires getting
   the other person on the phone, which means the games are barely playtested.
   The finished thing is strictly two-player; the workbench should not be.
3. **Growth that accrues.** The garden, the forest, the record. Weight anything
   that lasts across months over anything that entertains once.

[`engine/record.js`](engine/record.js) is where the accruing already starts: it
logs a finished sitting to this browser and nowhere else, and it is written to
the rule above, so things pile up and nothing is ever taken away.

## How two phones share a game with no server

Three engines, none of which needs a backend, described in full in
[`docs/scope.md`](docs/scope.md):

- **A — the shared seed.** You both type the same short room code; it seeds a
  deterministic generator, so both phones build the identical game and two roles
  can be shown different things from it. Asymmetric information, zero network.
- **B — the link.** A turn encoded in a URL fragment, which is never sent to any
  server. For the weeks you cannot get on a call.
- **C — the record.** What you have made, kept on the device.

**This is not a limitation of GitHub Pages that goes away later.** The eventual
home is an iPhone app, most likely peer to peer, so nothing here should be built
that needs a server. Some of these games ask real questions, and those answers
should never touch anyone's machine but the two of yours.

## The shelf

Rules in prose. This is where the collection started and where playable
versions get built from, not a list of things that are all going to be built.
Adding to it is not currently the work.

| Game | Works over | Time | Feels like |
|---|---|---|---|
| [Blind Agreement](games/blind-agreement.md) — [play it](play/blind-agreement/) | voice, a phone each | 30 sec a round | finding the same idea from the inside |
| Twenty-Twenty — [play it](play/twenty-twenty/) | voice, a phone each | 10–15 min | reading someone you know well |
| [Twenty Questions](games/twenty-questions.md) | voice, text | 5–10 min | a puzzle you solve together |
| [Ghost](games/ghost.md) | voice | 5–15 min | sharp, competitive, quick |
| [Fortunately, Unfortunately](games/fortunately-unfortunately.md) | voice, text | 5–20 min | laughing at something you built |
| [Category Ping-Pong](games/category-ping-pong.md) | voice | 5 min | a warm-up, fast and silly |
| [Alphabet Anything](games/alphabet-anything.md) | voice, text | 10 min | pleasant, low-effort, endless |
| [Rose, Bud, Thorn](games/rose-bud-thorn.md) | voice, video, text | 5 min | a daily check-in that isn't a report |
| [Two Truths and a Hope](games/two-truths-and-a-hope.md) | voice, video | 10 min | learning something new about someone you know |
| [The First Time I…](games/the-first-time-i.md) | voice | 15–40 min | trading stories, no winner |
| [Would You Rather, And Why](games/would-you-rather-and-why.md) | voice, text | 5–20 min | arguing without stakes |
| [The 36 Questions](games/thirty-six-questions.md) | voice, video | 45–90 min | deliberate, deep, a bit of a dare |
| [Show Me](games/show-me.md) | video | 10 min | a tour of each other's rooms |
| [Photo Tennis](games/photo-tennis.md) | text, async | ongoing | a slow game across a time zone |

More on choosing between them in
[`docs/choosing-a-game.md`](docs/choosing-a-game.md).

## Docs

- [`INTENT.md`](INTENT.md) — what this is for and what is next
- [`docs/scope.md`](docs/scope.md) — the session shape, the UI rules, the three engines
- [`docs/choosing-a-game.md`](docs/choosing-a-game.md) — how to pick, by time, energy and medium
- [`docs/house-rules.md`](docs/house-rules.md) — the handful of rules that make any of these work
- [`docs/game-ideas.md`](docs/game-ideas.md) — candidates, what each costs
- [`docs/adding-a-game.md`](docs/adding-a-game.md) — the template, though its criteria are the old ones

## Credit

Several of these are folk games — Ghost, Twenty Questions, and Fortunately/
Unfortunately have been played for generations and belong to no one. Where a
game has a known author or origin, it's credited on the game's own page.

The PET is a nod to *Mega Man Battle Network*, and is meant as one.

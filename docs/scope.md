# Scoping the app

What we're building, what shape a session has, and how two phones share a
game with no server behind them.

> **The framing changed on 2026-09-06 and this document predates it.** It is a
> PET found in an abandoned forested place, bonded to one other person, and the
> games are what feed the place back to life — see [`../INTENT.md`](../INTENT.md)
> and the [README](../README.md).
>
> **Everything below survives that intact**, and two parts of it stopped being
> merely sensible. Rule 4, "the tenth session isn't the first session again",
> was called the hard part; the garden is the answer to it. Rule 2, "things
> accrue, nothing decays", is now also why a garden must never wilt for a call
> you did not make. What is out of date here is only the description of *what
> the thing is*, not of how a session works or how two phones share one.

## What this is

Real games, with a real interface, on your phone. Usually played while
you're on the phone with the person you're playing against — the call
carries the talking, the screen carries the game.

Where it sits, by what's on either side of it:

- **GamePigeon is too thin.** Not because the games are bad. Because they're
  solo games with a turn notification. You play your move alone at a red
  light, and the other person is a scoreboard. Nothing accumulates, and
  nobody talks.
- **A console game is too heavy.** It needs a night you scheduled, a room, a
  controller, and forty minutes before it's fun.

The gap: **a game that runs alongside a conversation.** You're already on the
phone. The game gives the call a shape, so it doesn't end at "so, how was
your day."

> An earlier draft of this repo said these games had to work with *no app, no
> screen, no equipment*. That was wrong, and it's been removed. The screen is
> the point — it's what lets a game keep a secret, hold a board, remember a
> season, and be genuinely designed rather than merely explained.

## The session shape

This is the constraint that decides almost every other question, and the one
most easily forgotten once you're building screens.

**You play a little at first. Then it comes back, intermittently, for
months.** Not daily. Not on a schedule. Whenever you're both on the phone
again — which might be Thursday, or might be three weeks from now.

Three time-scales, and each one has to work on its own:

| Scale | Length | Has to feel like |
|---|---|---|
| **A round** | 1–3 min | one complete thing. You can stop after any round. |
| **A sitting** | 10–20 min | finished, not interrupted. Nothing left hanging. |
| **The arc** | months | the tenth time is different from the first. |

What falls out of that, as rules:

1. **Every sitting ends complete.** No saved state you have to resume to make
   sense of. If you played four rounds and hung up, that was a whole game.
2. **Things accrue; nothing decays.** No streaks to break, no wilting plant,
   no "you haven't played in 12 days." Guilt mechanics are poison in
   something two people use to stay close — the app must never become a
   third party nagging one of them. Coming back after a month should be
   greeted with *what you've built so far*, not a penalty.
3. **Re-entry costs nothing.** Three weeks later, neither of you remembers
   the rules. One tap to resume, rules always on the same screen, no
   tutorial to sit through again.
4. **The tenth session isn't the first session again.** Something has to
   change over the arc — content that opens up, difficulty that tracks you,
   or your own past play becoming the material. This is the hard part, and
   it's the difference between a thing you use twice and a thing that
   becomes part of how two people talk.
5. **The record is a first-class feature, not a stats page.** What you've
   made together is the reason to come back. Build it early enough that
   every game writes to it from its first commit.

## The constraint that shapes the build

GitHub Pages is static. No server, no sockets, no accounts, no database,
nothing that can go down at 11pm. That lines up with something we'd want
anyway: some of these games ask real questions, and those answers should
never touch anyone's server, ours included.

Three ways two phones share a game with no backend at all.

### Engine A — the shared seed

Both of you type the same short room code (`otter-lamp-97`). The code seeds
a deterministic random generator, so both phones independently generate the
*identical* game — same words, same board, same target. Pick a role, and the
two roles can be shown different things from the same seed. Asymmetric
information, zero network.

- **For:** live play while you're on the call. Anything with a secret.
- **Costs:** you both have to type it right; nothing enforces turn order or
  prevents cheating. Neither matters when you're on the phone with someone
  you like.

### Engine B — the link

A turn encoded into the URL fragment. You play, the page hands you a link,
you paste it into your thread. They open it, see your turn, play theirs,
send one back. The fragment is never sent to any server, so the contents
stay on the two phones.

- **For:** the weeks you can't get on a call. Time zones. Slow games.
- **Costs:** a few KB per turn — plenty for words, not for images.

### Engine C — the record

`localStorage`, plus export. Scores, sessions, the things you made, the
season. Exportable as one code so it survives a new phone and so you can
both hold a copy.

- **For:** everything in the session-shape section above.
- **Costs:** clearing browser data loses it. So export has to be a prompt at
  the end of a good sitting, not a setting nobody finds.

### Not doing: realtime sync

WebRTC or a hosted realtime database would let both screens update live. It
also adds a signaling service, an outage mode, an account, and a privacy
story we don't want — to solve a problem we mostly don't have:

> **The call is the network.** Two people on the phone already have a
> zero-latency channel between them. Most sync problems are solved by one of
> you saying something out loud. Design toward that.

Worth revisiting only for a game that genuinely needs sub-second shared
state, and we should be suspicious of any design that claims to.

## Phases

**Phase 0 — the shell.** Front page, the record, and the room-code flow.
Dark, mobile-first, no build step: plain HTML, ES modules, JSON data. One
throwaway game to prove the whole path end to end.

**Phase 1 — the first real game, all the way finished.** One game with
actual UI, actual polish, and its long-arc hook working. Better to have one
game somebody plays in month three than six that get opened once. Blind
Agreement or The Shortlist are the cheap ways in; Correspondence is the one
that best proves the premise.

**Phase 2 — one per engine.** A live game and an async game, both writing
to the record. See [game-ideas.md](game-ideas.md) for the working list.

**Phase 3 — the arc.** The meta space: progress recorded and shown back.
Deliberately unspecified for now — see the end of
[game-ideas.md](game-ideas.md). What *is* settled is the shape of what games
log, so they can write to it from their first commit and the presentation
can be decided once there's real play to look at.

**Phase 4 — the long game.** Something with a payoff measured in months.

## Repo layout

```
index.html            front page: pick a game, or resume
play/<slug>/          one folder per game — the game itself
games/*.md            the rules in prose, linked from every game
docs/*.md             this, the game catalog, house rules
engine/seed.js        room code -> deterministic RNG (Engine A)
engine/link.js        state <-> URL fragment (Engine B) — not yet built;
                       no shipped game needs async play yet
engine/record.js      localStorage, export/import (Engine C)
engine/ui.js          shared shell: dark, tap targets, wake lock
data/*.json           word lists, spectrum pairs, question decks
```

## UI rules

Now that there's a real interface, these are the ones that quietly get
violated if they aren't written down.

- **One-handed.** The other hand is holding a phone to a face. Everything in
  thumb reach; nothing needing two fingers.
- **Glanceable.** You are mid-conversation. You must be able to look away for
  fifteen seconds and come back without losing your place. Nothing that
  moves, no timer that punishes attention, state always visible on screen.
- **Audible where it matters.** Sometimes both of you are looking at a road
  instead of a screen. Sound and haptics for turn changes, not just colour.
- **Readable in bed, in the dark, at arm's length.** Dark by default, big
  type, no white flash on load.
- **Screen stays awake.** A game that locks mid-round is broken. Wake Lock
  where it exists, a fallback where it doesn't.
- **Thirty seconds from tap to playing.** No account, no splash, no tutorial.
  Rules on the same screen as the game, collapsed.
- **Nothing intimate leaves the phone.** No analytics, no third-party fonts
  on a page where somebody answered a real question.
- **No build step.** If it can't be served straight from the branch, it's too
  clever.

## What happens to the twelve prose pages

They stay, and they earn their keep three ways: several are direct
candidates to build (Twenty Questions, Ghost, Rose/Bud/Thorn, Photo Tennis);
[`house-rules.md`](house-rules.md) is genuinely good design doctrine for
anything we build — rules 1, 2, 3 and 6 in particular should be read as
product requirements; and a built game's page is where its rules and credit
live.

[`adding-a-game.md`](adding-a-game.md) needs a rewrite, since its criteria
are the ones being retired.

## Open questions

- **Does the front page open on a game or on the meta space?** Leaning: the
  meta space, with resume front and centre — it's the answer to "what have
  we been doing," which is the actual reason to open this on week nine. But
  that depends on what the meta space turns out to be.
- **Do both of you need the record, or just one?** Export/import makes two
  copies possible but they'll drift. Might be cleaner to say the record
  belongs to whoever opens it, and each of you has your own view.
- **Question decks:** write our own. Forty good ones beat five hundred.
- **A name for the site**, separate from the repo name.

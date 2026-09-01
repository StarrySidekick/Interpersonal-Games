# Scoping the app

Where this repo goes next: a GitHub Pages site you can actually play on,
without stopping being a collection of games you can play with nothing.

## What we're actually building

Two people on a phone call. Each holding their own phone. The call carries
the talking. The screen carries the things a voice can't hold — a hidden
target, a shared board, a shot clock, a record of the last four months.

The bar is set by what's on either side of it:

- **GamePigeon is too little.** Not because the games are bad. Because they
  are solo games with a turn notification. You play your move alone, at a
  red light, and the other person is a scoreboard. Nobody talks.
- **A console game is too much.** It needs a room, a couch, a night you
  scheduled, and forty minutes before it's fun.

The gap in between: **a game that runs underneath a conversation.** You are
already on the phone. The game gives the call a shape so it doesn't end at
"so, how was your day." If a real conversation breaks out and you abandon
the game twenty minutes in, the game worked (house rule 7).

## The rule we have to change

Rule 1 of this collection is *no equipment, no app, no shared screen*. A
web app fails it. That's fine — but we should break it deliberately, once,
and write down what replaces it.

**Proposal: the collection becomes two tracks.**

- **Voice track** — the twelve games already here. Unchanged. Still the
  default, still the ones that work while walking the dog.
- **Screen track** — new games where the phone earns its place by doing
  something a voice genuinely cannot: keep a secret from one of you, hold a
  board you both need to see, judge a challenge, remember a season.

And **one new rule that protects the point of the repo:**

> **Every screen game degrades to a voice game.** If a battery dies mid-round
> you can finish with the rules you already know. The phone is a dealer, a
> referee, and a memory. It is never the opponent, and it is never the thing
> you're both looking at instead of listening.

If a game idea can't survive that rule, it's a good game for a different
repo. This is the single filter that keeps us from building a worse version
of a thing that already exists on the App Store.

## The constraint that shapes everything

GitHub Pages is static. No server, no sockets, no accounts, no database,
nothing that can go down at 11pm. Rather than fight that, take it as the
design brief — and notice that it lines up exactly with a privacy
requirement we'd want anyway. Some of these games ask real questions. Those
answers should never touch a server, ours or anyone's.

Three ways two phones can share a game with no backend at all:

### Engine A — the shared seed

Both of you type the same short room code (`otter-lamp-97`). The code seeds
a deterministic random generator, so both phones independently generate the
*identical* game — same words, same board, same target. You each pick a
role (whoever said the code out loud is A), and the two roles can be shown
different things from the same seed. That's asymmetric information with
zero network.

- **Best for:** live calls, competitive and co-op games, anything with a
  secret.
- **Costs:** both must type the code correctly; no way to enforce turn order
  or stop cheating. Neither matters when you're on the phone with someone
  you like.

### Engine B — the link

Game state encoded into the URL fragment. You play your turn, the page hands
you a link, you paste it into the thread. They open it, see your turn, play
theirs, send one back. The fragment (`#...`) is never sent to any server, so
even the answers stay on the two phones.

- **Best for:** time zones, slow games, anything that survives three days
  between turns. The Photo Tennis end of the collection.
- **Costs:** URL length caps what a turn can carry (a few KB — plenty for
  words, not for images).

### Engine C — the ledger

`localStorage`. Scores, streaks, what you played and when, the things you
made together, an end-of-season recap. Exportable as a single code so it
survives a new phone, and importable so both of you can hold a copy.

- **Best for:** the reason to come back. This is what a GamePigeon thread
  doesn't have.
- **Costs:** clearing your browser data loses it. Make export a prompt, not
  a settings screen.

### Deliberately not: realtime sync

WebRTC or a hosted realtime database would let both screens update live. It
also adds a signaling service, an outage mode, an account, and a privacy
story we don't want. Skip it — because of the one idea this whole thing
rests on:

> **The call is the network.** Two people on a phone have a zero-latency,
> perfectly reliable channel between them already. Every sync problem is
> solved by one of you reading something out loud. Design toward that
> instead of around it.

## Phases

**Phase 0 — the site.** Mobile-first reader for the twelve games that exist.
Dark by default, big type, one tap from the front page to playing. No build
step: plain HTML, ES modules, JSON data files. This alone is worth shipping.

**Phase 1 — referee tools.** Not new games — small screens that make the
existing games better, with no design risk. A challenge dictionary for
Ghost. A shot clock for Category Ping-Pong. A secret-keeper for Twenty
Questions, so neither of you has to think of the object. Prompt decks for
Would You Rather and The First Time I…. Ships the site with real utility and
proves the layout.

**Phase 2 — Engine A and the first real screen games.** Three, not ten. See
[game-ideas.md](game-ideas.md) for the candidates and the recommended three.

**Phase 3 — Engine B and Engine C.** The async games and the ledger. This is
where "repeat sessions over a longer period" stops being a hope and becomes
a feature: a season, a streak, a recap you didn't have to assemble.

**Phase 4 — the long games.** Things that only pay off after months. A
question a day for a year. An archive that prints.

## Repo layout

Keep prose and play in one repo. The prose pages are the rules of record —
every playable game links back to its own page, which is also its voice
fallback.

```
index.html            front page: pick a game
games/*.md            unchanged — the rules, the prose, the credit
docs/*.md             unchanged — choosing, house rules, this
play/<slug>/          one folder per playable game
engine/seed.js        room code -> deterministic RNG (Engine A)
engine/link.js        state <-> URL fragment (Engine B)
engine/ledger.js      localStorage, export/import (Engine C)
engine/ui.js          shared shell: dark, big tap targets, wake lock
data/*.json           word lists, spectrum pairs, question decks
```

## Non-negotiables

These are the ones that get quietly violated if we don't write them down.

- **One-handed.** The other hand is holding a phone to a face. Every control
  in thumb reach, nothing that needs two fingers.
- **Playable in the dark, in bed.** Dark by default. No white flash on load.
- **Keeps the screen awake.** A game that locks the screen mid-round is
  broken. Wake Lock where it exists, a fallback where it doesn't.
- **Thirty seconds from tap to playing.** No tutorial, no account, no splash.
  Rules on the same screen as the game, collapsed.
- **Nothing intimate leaves the phone.** No analytics, no fonts fetched from
  someone else's CDN on a page where you answered a real question.
- **Ends before it runs out.** House rule 6. Build "one more round?" prompts
  and natural stopping points, not infinite scroll.
- **No build step.** If it can't be served straight from `main`, it's too
  clever.

## Open questions

- **Does the front page default to voice games or screen games?** Argument
  for voice: it's the honest answer more often. Argument for screen: it's
  what someone opening the site came for. Leaning: one front page, two
  clearly labeled columns, voice on the left.
- **Question decks.** Write our own. Don't reproduce someone's published
  list, and don't ship 500 mediocre prompts — 40 good ones beat 500.
- **Photos.** Any game that stores images can't use Engine B and shouldn't
  use a server. Local-only with an export, or leave Photo Tennis in the
  thread where it already works.
- **A name for the site**, separate from the repo name.

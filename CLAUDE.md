# Working in this repo

Read [`INTENT.md`](INTENT.md) first for what this project is for and what is
next. This file is only about how to work here.

## Designing

Before designing, scoping, reviewing or changing a game, use the
`game-design` skill (`.claude/skills/game-design/`). It is Timothy's design
philosophy, [`docs/design-philosophy.md`](docs/design-philosophy.md), turned
into a method: say which progression paths a change moves and how the game
marks that progress.

## Merging

Timothy has given standing permission (2026-10-06): **when a build is done,
merge it to `main` without asking.** "Done" means built, tested in a browser,
and the checks below passing. Merge with a merge commit (`git merge --no-ff`),
matching the history, and push. GitHub Pages publishes `main`, so a merge is a
release: confirm the live site serves the new files before saying it is live.

## Before every merge

- `node play/grove-chess/check-daily.mjs`: run it. It proves the daily
  boards have not changed, the stored named ones (from 2026-10-09)
  included. Before stored boards run out, make more with
  `make-daily.mjs` (see `docs/grove-chess.md`, version 4). **For now a change to the daily is allowed**
  (Timothy, 2026-10-07: "don't worry about messing up the daily board, we
  will hone in on that after we get a solid game loop built"): if it fails,
  say so plainly in the merge and to Timothy, rather than versioning the
  dealer. Once the daily is redesigned, this goes back to must-pass.
- `node play/grove-chess/betza-check.mjs` must pass. It proves every
  piece's Betza notation gives the same moves as its move code.
- `node --check` on every changed `.js` file.
- Play the change in a real browser (Playwright and Chromium are available in
  cloud sessions).

## House style

- No build step, no frameworks, no dependencies: plain HTML, CSS and ES
  modules served straight from the branch.
- Nothing decays, nags, or keeps a streak you can break.
- No server unless it has been decided that one is worth it.

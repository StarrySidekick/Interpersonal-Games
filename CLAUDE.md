# Working in this repo

Read [`INTENT.md`](INTENT.md) first for what this project is for and what is
next. This file is only about how to work here.

## Merging

Timothy has given standing permission (2026-10-06): **when a build is done,
merge it to `main` without asking.** "Done" means built, tested in a browser,
and the checks below passing. Merge with a merge commit (`git merge --no-ff`),
matching the history, and push. GitHub Pages publishes `main`, so a merge is a
release: confirm the live site serves the new files before saying it is live.

## Before every merge

- `node play/grove-chess/check-daily.mjs` must pass. It proves the daily
  boards have not changed; a change there breaks every link people have
  shared. If a change is deliberate, version the dealer first (see
  `docs/grove-chess.md`).
- `node --check` on every changed `.js` file.
- Play the change in a real browser (Playwright and Chromium are available in
  cloud sessions).

## House style

- No build step, no frameworks, no dependencies: plain HTML, CSS and ES
  modules served straight from the branch.
- Nothing decays, nags, or keeps a streak you can break.
- No server unless it has been decided that one is worth it.

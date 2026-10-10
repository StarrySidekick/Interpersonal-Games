// Timothy's settings for Grove Chess, in one place (2026-10-10: "our entire
// set of settings ... so that I have more granular control without having to
// open up the game"). The settings console, an artifact, edits these and
// writes this whole file; the game reads it at load. Everything here is a
// change on top of what the code already does, so an empty CONFIG plays
// exactly as before.
//
// - pieces: { id: { name, desc, off, on, note } }. `name` and `desc` are what
//   the game calls a piece and says it does (its record, the real fairy chess
//   name and notation, stays in rules.js). `off: true` keeps it out of every
//   deal, and `on: true` lets a piece that is off by default (the cannon, say)
//   back in; each is applied once per phone, so the catalog can still change
//   it after. `note` is for the next build; the game does not read it.
// - modes: { modeId: { setting: value } }, on top of each mode's preset in
//   modes.js. Settings a player changed on their own phone still win.
// - look: colours and sizes, defaults below.
//
// The shipped daily boards never read this: their dealers are pinned.

export const CONFIG = {
  pieces: {},
  modes: {},
  look: {}
};

export const LOOK_DEFAULTS = {
  rim: '#5a3d26',       // the board's wooden rim
  rimWidth: 1.2,        // its width, in tenths of a square (it was 3)
  fog: '#1b2620',       // the forest, far off
  tileLight: '#b9dc9b', // solid ground's two squares
  tileDark: '#f6efd7',
  you: '#4f8a3b',       // your pieces' bodies
  foe: '#6c4795',       // theirs
  statue: '#8e918c'     // statues' stone
};

export const LOOK = { ...LOOK_DEFAULTS, ...(CONFIG.look || {}) };

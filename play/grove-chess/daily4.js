// The daily from version 4 (2026-10-09): boards made ahead of time by
// make-daily.mjs and kept in dailies/YYYY-MM.js, each with a name and a
// light theme. Earlier dates are dealt by day.js as before.
//
// A stored board is a level in the workshop's terms (lab.js): its settings
// and seed, from which makeLevel lays it out exactly. check-daily.mjs keeps a
// fingerprint of every stored board, so a change to makeLevel or the rules
// that would move one is caught. A date with no stored board (if boards were
// not made far enough ahead) falls back to day.js's version 3, which every
// phone deals the same.

import { makeDay, dayNumber } from './day.js';
import { decodeLevel, makeLevel } from './lab.js';
import { themeById } from './daily-names.js';

export const STORED_FROM = '2026-10-09';

const months = new Map();
/** The stored boards for a month ({} if there are none). */
export function monthOf(date) {
  const ym = date.slice(0, 7);
  if (!months.has(ym)) months.set(ym, import(`./dailies/${ym}.js`).then((m) => m.default).catch(() => ({})));
  return months.get(ym);
}

/** A stored board as a playable day. */
export function dayFromBoard(date, b) {
  const lv = decodeLevel(`lab=${b.lab}&v=${b.v}&seed=${b.seed}`);
  const day = makeLevel(lv.settings, lv.seed);
  return Object.assign(day, {
    date, number: dayNumber(date), version: 4, par: b.par, N: day.W,
    name: b.name, theme: themeById(b.theme), measure: b.measure
  });
}

/** The day for a date, whichever dealer it belongs to. */
export async function loadDay(date) {
  if (date < STORED_FROM) return makeDay(date);
  const b = (await monthOf(date))[date];
  return b ? dayFromBoard(date, b) : makeDay(date, 3);
}

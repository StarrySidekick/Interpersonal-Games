// Proves the daily from version 5 (2026-10-17) still deals every stored day
// exactly as it shipped: each board laid out from its stored settings and
// seed, then four seeded random games played on it, hashed, against the
// fingerprint make-daily5.mjs wrote (daily-print.mjs). If makeLevel or the
// rules change in a way that would move a board or change how it plays,
// this fails. Also checks each day is whole: a set of four with the cat,
// three boards, par the best line plus two.
//
//   node play/grove-chess/check-daily5.mjs

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printOf, readMonth } from './make-daily5.mjs';
import { EAGLE_ROOM } from './modes.js';
import { BOARDS, DAILY5_FROM } from './daily5.js';

const here = dirname(fileURLToPath(import.meta.url));
let days = 0, boards = 0, bad = 0, last = null;
for (const f of readdirSync(join(here, 'dailies5')).filter((n) => /^\d{4}-\d{2}\.js$/.test(n)).sort()) {
  for (const [date, day] of Object.entries(readMonth(join(here, 'dailies5', f)))) {
    days++;
    last = date;
    const whole = date >= DAILY5_FROM && day.name && day.set?.length === 4 && day.set[0].base === 'cat' && day.boards?.length === BOARDS;
    if (!whole) { bad++; console.log(date, 'NOT WHOLE'); continue; }
    day.boards.forEach((b, k) => {
      boards++;
      if (b.par !== b.best + EAGLE_ROOM) { bad++; console.log(date, `board ${k + 1}: par ${b.par} is not best ${b.best} + ${EAGLE_ROOM}`); }
      const p = printOf(date, k, b);
      if (p !== b.print) { bad++; console.log(date, `board ${k + 1} CHANGED: ${b.print} -> ${p}`); }
    });
  }
}
console.log(`${days} days, ${boards} boards checked, stored to ${last}: ${bad ? `${bad} FAILED` : 'all as shipped'}.`);
process.exit(bad ? 1 : 0);

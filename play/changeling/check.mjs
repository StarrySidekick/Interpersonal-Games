// Proves Changeling's dealt boards have not changed: deals every day from
// the first to a year on and compares each with the board stored in
// boards.txt. A shared link names a day, so a day that re-deals breaks
// every link to it and every score anyone posted.
//
//   node play/changeling/check.mjs          check
//   node play/changeling/check.mjs --write  store the boards (only for a
//                                           new dealer version's new days)
//
// Each line: the date, the shape, the start, then the pieces, each as a
// square number and the piece's kind.

import { readFileSync, writeFileSync } from 'node:fs';
import { deal, FIRST_DAY } from './rules.js';

const DAYS = 400;
const file = new URL('./boards.txt', import.meta.url);
const addDays = (date, k) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
const line = (L) => [L.date, `v${L.version}`, L.shape, `${L.start.kind}@${L.start.sq}`, L.pieces.map((p) => `${p.kind}@${p.sq}`).join(' ')].join(' | ');

const now = [];
for (let k = 0; k < DAYS; k++) now.push(line(deal(addDays(FIRST_DAY, k))));

if (process.argv.includes('--write')) {
  writeFileSync(file, now.join('\n') + '\n');
  console.log(`Stored ${DAYS} boards, ${FIRST_DAY} to ${addDays(FIRST_DAY, DAYS - 1)}.`);
} else {
  const kept = readFileSync(file, 'utf8').trim().split('\n');
  const bad = kept.filter((l, i) => now[i] !== l);
  if (bad.length) {
    console.log(`${bad.length} of ${kept.length} stored boards would deal differently now. First: ${bad[0].slice(0, 10)}`);
    process.exit(1);
  }
  console.log(`All ${kept.length} stored boards deal the same, ${FIRST_DAY} to ${kept[kept.length - 1].slice(0, 10)}.`);
}

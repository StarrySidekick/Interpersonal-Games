// Stamps the next release number into version.js (Timothy, 2026-10-11: "a
// version number system based on number of pushes ... that I can view in the
// actual site, so I can verify what push we are on").
//
//   node tools/release.mjs "what this release changes"
//
// Run it on the branch, last thing before merging to main. The number is how
// many releases main already has (its first-parent commits: one per merge or
// direct push) plus one, so it counts pushes to main. GitHub Pages serves the
// files as they are, with no build step, which is why the number is written
// into a file rather than worked out on the way out.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
sh('git fetch -q origin main');
const number = +sh('git rev-list --count --first-parent origin/main') + 1;
const date = new Date().toISOString().slice(0, 10);
const note = (process.argv[2] || '').replace(/[`\\$]/g, '');
writeFileSync(new URL('../version.js', import.meta.url), `// The release the site is on. Written by tools/release.mjs before every push to
// main: one more for every push (2026-10-11). Shown at the foot of the home
// page and of every Grove Chess page's menu. Do not edit by hand.
export const RELEASE = ${JSON.stringify({ number, date, note }, null, 2)};
`);
console.log(`Release ${number}, ${date}: ${note}`);

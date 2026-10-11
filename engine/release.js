// The release line: which push to main this page came from (version.js,
// written by tools/release.mjs). Small, at the foot of a page, so you can
// tell at a glance whether the site has the latest.

import { el } from './ui.js';
import { RELEASE } from '../version.js';

/** "Release 37 · Oct 11, 2026", with what it changed as a tooltip. */
export function releaseLine() {
  const [y, m, d] = RELEASE.date.split('-').map(Number);
  const when = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return el('p', { class: 'release small dim', style: 'text-align:center;margin:18px 0 6px;font-variant-numeric:tabular-nums', title: RELEASE.note || '' },
    `Release ${RELEASE.number} · ${when}`);
}

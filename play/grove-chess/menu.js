// The ways to play Grove Chess, and the pieces catalog: the menu every page
// shows, from one list, so a new mode appears everywhere at once. Every
// mode but the first daily (the rabbit, index.html) is played by the runner
// (play/), from its settings (modes.js); Custom (lab/) is where any setting
// can be tried, simulated and searched.

import { el } from '../../engine/ui.js';
import { releaseLine } from '../../engine/release.js';

/** Each entry: where it lives (from play/grove-chess/), its name. Five
    doors (Timothy, 2026-10-17: "the finished version of the app should
    have a daily mode, adventure, a custom mode, golf, and a separate list
    of a bunch of variants others have made and me"), the hub, and the
    pieces. Everything else is a variant, listed on the hub. */
export const MENU = [
  // Chess of the Grove (2026-10-15): every chess game here, and the classic
  // variants, in one list with previews.
  { id: 'hub', href: '../grove/', label: 'All of Chess of the Grove' },
  // The daily from 2026-10-17: three boards of Adventure (daily5.js).
  { id: 'today', href: 'daily/', label: 'The daily' },
  { id: 'adventure', href: 'play/?mode=adventure', label: 'Adventure' },
  { id: 'golf', href: 'play/?mode=golf', label: 'Golf' },
  // Custom (2026-10-13): the workshop, Chaos (Go crazy) and the piece
  // trials in one place.
  { id: 'custom', href: 'lab/', label: 'Custom' },
  { id: 'variants', href: '../grove/#variants', label: 'Variants' },
  { id: 'pieces', href: 'pieces/', label: 'The pieces' }
];

/** The modes listed under Variants: the first daily (the rabbit), our own
    runs and games, and the classic variants. */
const VARIANT_IDS = new Set(['daily', 'descent', 'kungfu', 'tiles', 'autochess', 'variants', 'flag', 'trials']);

/** Fill a <nav> with the menu. `root` is the way back to play/grove-chess/
    from this page ('' or '../'); `current` is this page's id. */
export function fillMenu(nav, current, root = '') {
  if (VARIANT_IDS.has(current)) current = 'variants';
  if (current === 'chaos') current = 'custom';
  if (current === 'tactics') current = 'adventure';
  nav.replaceChildren(...MENU.map((m) => el('a', { href: root + m.href || './', ...(m.id === current ? { 'aria-current': 'page' } : {}) }, m.label)));
  // Which release this is (version.js), under the menu on every page.
  if (!nav.nextElementSibling?.classList.contains('release')) nav.after(releaseLine());
}

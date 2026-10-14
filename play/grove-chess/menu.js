// The ways to play Grove Chess, and the pieces catalog: the menu every page
// shows, from one list, so a new mode appears everywhere at once. Every
// mode but the daily is played by the runner (play/), from its settings
// (modes.js); Custom (lab/) is where any setting can be tried, simulated
// and searched.

import { el } from '../../engine/ui.js';
import { releaseLine } from '../../engine/release.js';

/** Each entry: where it lives (from play/grove-chess/), its name. */
export const MENU = [
  { id: 'daily', href: '', label: 'The daily' },
  { id: 'descent', href: 'play/?mode=descent', label: 'The descent' },
  { id: 'kungfu', href: 'play/?mode=kungfu', label: 'Kung fu descent' },
  { id: 'tiles', href: 'play/?mode=tiles', label: 'Tile Chess' },
  { id: 'golf', href: 'play/?mode=golf', label: 'Golf' },
  { id: 'autochess', href: 'play/?mode=autochess', label: 'Autochess' },
  { id: 'variants', href: 'play/?mode=variants', label: 'Chess variants' },
  { id: 'flag', href: 'play/?mode=flag', label: 'Capture the rabbit' },
  // Custom (2026-10-13): the workshop, Chaos (Go crazy) and the piece
  // trials in one place.
  { id: 'custom', href: 'lab/', label: 'Custom' },
  { id: 'pieces', href: 'pieces/', label: 'The pieces' }
];

/** Fill a <nav> with the menu. `root` is the way back to play/grove-chess/
    from this page ('' or '../'); `current` is this page's id. */
export function fillMenu(nav, current, root = '') {
  nav.replaceChildren(...MENU.map((m) => el('a', { href: root + m.href || './', ...(m.id === current ? { 'aria-current': 'page' } : {}) }, m.label)));
  // Which release this is (version.js), under the menu on every page.
  if (!nav.nextElementSibling?.classList.contains('release')) nav.after(releaseLine());
}

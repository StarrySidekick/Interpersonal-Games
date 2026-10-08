// The ways to play Grove Chess, and the pieces catalog: the menu every page
// shows, from one list, so a new mode appears everywhere at once. Every
// mode but the daily is played by the runner (play/), from its settings
// (modes.js); the workshop (lab/) is where any setting can be tried.

import { el } from '../../engine/ui.js';

/** Each entry: where it lives (from play/grove-chess/), its name. */
export const MENU = [
  { id: 'daily', href: '', label: 'The daily' },
  { id: 'descent', href: 'play/?mode=descent', label: 'The descent' },
  { id: 'chaos', href: 'play/?mode=chaos', label: 'Chaos' },
  { id: 'golf', href: 'play/?mode=golf', label: 'Golf' },
  { id: 'autochess', href: 'play/?mode=autochess', label: 'Autochess' },
  { id: 'workshop', href: 'lab/', label: 'Workshop' },
  { id: 'pieces', href: 'pieces/', label: 'The pieces' }
];

/** Fill a <nav> with the menu. `root` is the way back to play/grove-chess/
    from this page ('' or '../'); `current` is this page's id. */
export function fillMenu(nav, current, root = '') {
  nav.replaceChildren(...MENU.map((m) => el('a', { href: root + m.href || './', ...(m.id === current ? { 'aria-current': 'page' } : {}) }, m.label)));
}

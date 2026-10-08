// The ways to play Grove Chess, and the pieces catalog: the menu every page
// shows, from one list, so a new mode appears everywhere at once.

import { el } from '../../engine/ui.js';

/** Each entry: where it lives (from play/grove-chess/), its name. */
export const MENU = [
  { id: 'daily', href: '', label: 'The daily' },
  { id: 'descent', href: 'descent/', label: 'The descent' },
  { id: 'chaos', href: 'lab/', label: 'Chaos' },
  { id: 'pieces', href: 'pieces/', label: 'The pieces' }
];

/** Fill a <nav> with the menu. `root` is the way back to play/grove-chess/
    from this page ('' or '../'); `current` is this page's id. */
export function fillMenu(nav, current, root = '') {
  nav.replaceChildren(...MENU.map((m) => el('a', { href: root + m.href || './', ...(m.id === current ? { 'aria-current': 'page' } : {}) }, m.label)));
}

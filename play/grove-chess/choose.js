// Choosing between moves that end on the same square (2026-10-13): a pawn
// reaching the far row in the descent becomes a copy of another of its
// side's pieces, and each kind it could become is a move of its own
// (rules.js promoteChoices). Tapping that square asks which.

import { el } from '../../engine/ui.js';
import { PIECES } from './rules.js';
import { sprite } from './board.js';

const CSS = `
  .choosebox { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(10, 14, 11, 0.45); padding: 16px; }
  .choosecard { background: var(--panel, #f8f2e2); color: var(--text, #2b2418); border-radius: 16px; padding: 14px 16px 10px; max-width: 360px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  .choosecard h3 { margin: 0 0 4px; font-size: 17px; }
  .choosecard p { margin: 0 0 10px; font-size: 14px; color: var(--dim, #6f6450); }
  .chooserow { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .chooserow button { display: grid; justify-items: center; gap: 2px; flex: 1 1 0; width: auto; min-width: 78px; min-height: 64px; padding: 6px 8px; border-radius: 12px; font-size: 14px; margin: 0; }
  .chooserow canvas { width: 45px; height: 54px; image-rendering: pixelated; }
`;
let styled = false;

/**
 * Ask which of `moves` (all ending on one square) to make. `piece` is the
 * piece making it. Resolves to the chosen move, or null if put off.
 */
export function pickMove(moves, piece) {
  if (!styled) { document.head.append(el('style', {}, CSS)); styled = true; }
  return new Promise((resolve) => {
    const close = (m) => { box.remove(); resolve(m); };
    const buttons = moves.map((m) => {
      const t = m.promote || piece.type, cv = el('canvas', { width: 30, height: 36 });
      cv.getContext('2d').drawImage(sprite(t, 'you'), 0, 0);
      return el('button', { class: 'quiet', onclick: () => close(m) }, cv, PIECES[t]?.name || t);
    });
    const box = el('div', { class: 'choosebox', onclick: (e) => { if (e.target === box) close(null); } },
      el('div', { class: 'choosecard', role: 'dialog', 'aria-label': 'Choose what it becomes' },
        el('h3', {}, 'Your pawn reaches the far row'),
        el('p', {}, 'It becomes a copy of another of your pieces. Which?'),
        el('div', { class: 'chooserow' }, ...buttons),
        el('button', { class: 'quiet', onclick: () => close(null) }, 'Not this move')));
    document.body.append(box);
    buttons[0]?.focus();
  });
}

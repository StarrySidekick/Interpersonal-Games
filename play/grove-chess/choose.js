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

/** What a move onto the square does, for its button (2026-10-16: more
    than one move can end on a square now: a piece of Gears can squash
    what is there or trade squares with it, a shield can squash it or push
    it, and a pawn on the far row becomes one of several pieces). */
function label(m, piece) {
  if (m.promote) return { kind: m.promote, text: PIECES[m.promote]?.name || m.promote };
  if (m.swap) return { kind: piece.type, text: 'Swap places' };
  if (m.push?.length) return { kind: piece.type, text: m.push.some((e) => e.to < 0) ? 'Push it off' : 'Push it' };
  if (m.strike?.length) return { kind: piece.type, text: 'Strike' };
  if (m.pass?.length) return { kind: piece.type, text: 'Run it through' };
  if (m.cap) return { kind: piece.type, text: 'Squash it' };
  return { kind: piece.type, text: 'Move there' };
}

/**
 * Ask which of `moves` (all ending on one square) to make. `piece` is the
 * piece making it. Resolves to the chosen move, or null if put off.
 */
export function pickMove(moves, piece) {
  if (!styled) { document.head.append(el('style', {}, CSS)); styled = true; }
  const promoting = moves.every((m) => m.promote);
  return new Promise((resolve) => {
    const close = (m) => { box.remove(); resolve(m); };
    const buttons = moves.map((m) => {
      const { kind, text } = label(m, piece), cv = el('canvas', { width: 30, height: 36 });
      cv.getContext('2d').drawImage(sprite(kind, 'you'), 0, 0);
      return el('button', { class: 'quiet', onclick: () => close(m) }, cv, text);
    });
    const name = (PIECES[piece.type]?.name || 'piece').toLowerCase();
    const box = el('div', { class: 'choosebox', onclick: (e) => { if (e.target === box) close(null); } },
      el('div', { class: 'choosecard', role: 'dialog', 'aria-label': promoting ? 'Choose what it becomes' : 'Choose how it moves there' },
        el('h3', {}, promoting ? 'Your pawn reaches the far row' : `Your ${name} can go there more than one way`),
        el('p', {}, promoting ? 'It becomes a copy of another of your pieces. Which?' : 'Which?'),
        el('div', { class: 'chooserow' }, ...buttons),
        el('button', { class: 'quiet', onclick: () => close(null) }, 'Not this move')));
    document.body.append(box);
    buttons[0]?.focus();
  });
}

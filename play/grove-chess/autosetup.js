// Autochess on a page: the setup panel (which rabbit in which piece, which
// way it faces, the order of your line), and playing a set-up level out.
// Shared by Chaos (lab/) and the descent, which both show it the same way.
// The rules are in rules.js (autoMove), the setups in lab.js.

import { el } from '../../engine/ui.js';
import { PIECES, initialState, autoMove, respond, isOver } from './rules.js';
import { FUR, FUR_WORD } from './rabbits.js';
import { sprite } from './board.js';
import { describeSteps } from './day.js';
import { emptySetup, withSetup, patternNamed, setupFits } from './lab.js';

function canvasOf(kind, side, fur) {
  const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
  cv.getContext('2d').drawImage(sprite(kind, side, fur), 0, 0);
  return cv;
}

/**
 * The setup panel for `level`, drawn into `tray` (your rabbits) and `slots`
 * (your line, left to right). `pool` is { name: how many }; `setup` is a
 * setup to start from, kept if it still fits. `onChange(setup)` runs after
 * every change, so the page can redraw the board. Returns { setup(),
 * paint(), pickAt(x, y), clear() }.
 */
export function setupPanel({ tray, slots, level, pool, setup = null, onChange = () => {} }) {
  let cur = setup && setup.length === level.pieces.length && setupFits(setup, pool) ? setup.map((u) => ({ ...u })) : emptySetup(level);
  let slot = 0;
  const places = () => level.pieces.map((p, i) => i).sort((a, b) => level.pieces[a].x - level.pieces[b].x || level.pieces[a].y - level.pieces[b].y);

  function paint() {
    const used = {};
    for (const u of cur) if (u.rabbit) used[u.rabbit] = (used[u.rabbit] || 0) + 1;
    const order = places(), here = order[slot];
    tray.replaceChildren(...Object.entries(pool).map(([name, n]) => {
      const left = n - (used[name] || 0);
      return el('button', { class: 'quiet chip', disabled: left <= 0, title: FUR_WORD[name] || '', onclick: () => {
        cur[here].rabbit = name;
        // On to the next empty place in the line.
        const next = order.findIndex((i, k) => k > slot && !cur[i].rabbit);
        if (next >= 0) slot = next;
        paint();
      } }, canvasOf('rabbit', 'foe', FUR[name]), name, el('small', {}, left > 0 ? `${left} left` : 'all used'));
    }));
    slots.replaceChildren(...order.map((i, k) => {
      const u = cur[i], pat = u.rabbit && patternNamed(u.rabbit);
      const swap = (d) => { const j = order[k + d]; [cur[i], cur[j]] = [cur[j], cur[i]]; slot = k + d; paint(); };
      return el('div', { class: 'slot', 'aria-current': String(k === slot) },
        el('button', { class: 'quiet who', onclick: () => { slot = k; paint(); } }, canvasOf(u.type, 'you'), el('span', {}, `${k + 1}`)),
        el('div', { class: 'what' }, el('b', {}, PIECES[u.type].name),
          pat ? `${u.rabbit}: ${describeSteps(pat.steps, u.mx, 1)}, then again.` : 'No rabbit: it stands still.'),
        el('div', { class: 'acts' },
          el('button', { class: 'quiet', disabled: !pat, 'aria-pressed': String(u.mx < 0), onclick: () => { u.mx = -u.mx; slot = k; paint(); } }, 'Mirror'),
          el('button', { class: 'quiet', disabled: !pat, onclick: () => { u.rabbit = null; slot = k; paint(); } }, 'Empty'),
          el('button', { class: 'quiet', disabled: k === 0, 'aria-label': 'Swap with the place to the left', onclick: () => swap(-1) }, '←'),
          el('button', { class: 'quiet', disabled: k === order.length - 1, 'aria-label': 'Swap with the place to the right', onclick: () => swap(1) }, '→')));
    }));
    onChange(cur);
  }

  return {
    setup: () => cur,
    paint,
    /** A tap on the board: one of your pieces picks its place in the line. */
    pickAt(x, y) {
      const k = places().findIndex((i) => level.pieces[i].x === x && level.pieces[i].y === y);
      if (k >= 0) { slot = k; paint(); }
    },
    clear() { cur = emptySetup(level); slot = 0; paint(); },
    /** Put a setup in (the solver's). */
    use(s) { cur = s.map((u) => ({ ...u })); slot = 0; paint(); }
  };
}

/** The state a setup starts from, for drawing it before the game begins. */
export const setupState = (level, setup) => initialState(withSetup(level, setup));

/**
 * Play a game out on `board`, turn by turn, animated, from the last of
 * `states` (the page's own list, which this adds to, with `moves`).
 * `onTurn(a, b)` runs after each turn and may return a promise;
 * `setShown(s)` is told what to draw while your half of a turn is shown.
 */
export async function playOut({ board, level, states, moves, onTurn = () => {}, slow = 1, setShown = () => {} }) {
  const cap = level.rules.maxMoves || 40;
  while (!isOver(states[states.length - 1]) && states[states.length - 1].t < cap) {
    const a = states[states.length - 1], mid = autoMove(a);
    setShown(mid);
    await board.animate(a, mid, { p: -1, auto: true }, slow);
    const b = respond(mid);
    states.push(b); moves.push({ p: -1, auto: true });
    setShown(null);
    if (!b.won) await board.animate(mid, b, { p: -1 }, slow);
    await onTurn(a, b);
    if (!isOver(b)) await new Promise((r) => setTimeout(r, 140 * slow));
  }
}

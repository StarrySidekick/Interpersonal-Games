// The pieces menu: every piece on a level, yours and theirs, as a turning
// model with a short description and a diagram of how it moves. Shared by
// the daily game and the lab.

import { el } from '../../engine/ui.js';
import { Mesh, makeTarget, render } from '../../engine/lowpoly.js';
import { model } from './models.js';
import { PIECES, RABBIT_DESC, RABBIT_AI_DESC, BRAMBLE_DESC, STUMP_DESC } from './rules.js';
import { diagram } from './board.js';

/**
 * Wire a <dialog> up as the pieces menu for `day`. `notes.rabbit` adds a line
 * under the rabbit (the daily uses it for the pattern length). Returns the
 * function that opens it.
 */
export function piecesSheet(dialog, list, day, notes = {}) {
  const spinners = [];
  let built = false;

  const row = (kind, side, title, tag, lines, withDiagram) => {
    const cv = el('canvas', { class: 'model pix', width: 48, height: 56 });
    spinners.push({ ctx: cv.getContext('2d'), t: makeTarget(48, 56), mesh: new Mesh().add(model(kind, side), 0, 0, 0, 1), phase: spinners.length * 0.7 });
    list.append(el('div', { class: 'prow' },
      el('div', {}, cv, withDiagram ? diagram(kind) : null),
      el('div', {}, el('span', { class: 'tag' }, tag), el('h3', {}, title),
        ...lines.filter(Boolean).map((l, i) => el('p', { class: i ? 'small dim' : '' }, l)))));
  };

  function build() {
    built = true;
    const head = (t) => list.append(el('p', { class: 'eyebrow', style: 'margin:6px 0 0' }, t));
    head('Yours');
    for (const type of new Set(day.pieces.map((p) => p.type))) {
      const P = PIECES[type];
      row(type, 'you', P.name, P.kind === 'fairy' ? 'Fairy piece' : 'Classic', [P.desc, P.origin], true);
    }
    head(day.foes.length > 1 ? 'Theirs' : 'The one to catch');
    const seen = new Set();
    for (const f of day.foes) {
      const key = f.type + f.brain;
      if (seen.has(key)) continue;
      seen.add(key);
      if (f.type === 'rabbit') {
        row('rabbit', 'foe', 'The rabbit', f.brain === 'ai' ? 'Thinks' : 'Follows a pattern',
          [f.brain === 'ai' ? RABBIT_AI_DESC : RABBIT_DESC, f.brain === 'ai' ? null : notes.rabbit], f.brain === 'ai');
      } else {
        const P = PIECES[f.type];
        row(f.type, 'foe', P.name, 'Theirs, and it thinks', [P.desc, P.origin], true);
      }
    }
    if (day.bramble.length || day.stumps.size) head('On the board');
    if (day.bramble.length) row('bramble', 'you', 'Bramble', 'Today',
      [BRAMBLE_DESC, `It grows one square every ${day.every} move${day.every > 1 ? 's' : ''}. The faint thorns show where it goes next.`]);
    if (day.stumps.size) row('stump', 'you', 'Stump', 'Today', [STUMP_DESC]);
    list.append(el('p', { class: 'small dim' },
      'Fairy pieces are invented chess pieces, some centuries old. In the diagrams: gold squares are moves, coral is a catch, brown is something in the way.'));
  }

  function spin(ts) {
    if (!dialog.open) return;
    for (const s of spinners) {
      render(s.t, s.mesh, { yaw: ts / 1400 + s.phase, pitch: 0.4, scale: 3, cx: 24, cy: 49 });
      s.ctx.putImageData(s.t.img, 0, 0);
    }
    requestAnimationFrame(spin);
  }

  return function open() {
    if (!built) build();
    dialog.showModal();
    requestAnimationFrame(spin);
  };
}

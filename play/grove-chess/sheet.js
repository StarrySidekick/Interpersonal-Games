// The pieces menu: every piece on a level, yours and theirs, as a turning
// model with a short description and a diagram of how it moves. Shared by
// the daily game and the lab.

import { el } from '../../engine/ui.js';
import { Mesh, makeTarget, render } from '../../engine/lowpoly.js';
import { model, suitLook } from './models.js';
import { PIECES, descOf, rabbitDesc, RABBIT_AI_DESC, BRAMBLE_DESC, STUMP_DESC, STATUE_ROW_DESC, statueDesc, HOLE_DESC, EXIT_DESC, CRUMBLE_DESC, SHRINK_DESC, LOCKED_DESC, statueKind, leaderDesc, rabbitIn } from './rules.js';
import { routeText } from './rabbits.js';
import { SUITS, RABBITS, rabbitName } from './run.js';
import { diagram } from './board.js';
import { patent } from './betza.js';

/** A piece's patent, in two short lines: its Betza notation with what that
    means, and its strength. */
export function patentLines(type) {
  const P = PIECES[type];
  if (!P?.betza) return [];
  const t = patent(P.betza);
  return [
    `Betza ${t.code}: ${t.shapes.join('; ')}. It ${t.travel}, and captures ${t.captures}${t.notes.length ? `; it ${t.notes.join(', ')}` : ''}.`,
    P.strength ? `Strength: about ${P.strength} pawns.` : null
  ].filter(Boolean);
}

/**
 * Wire a <dialog> up as the pieces menu for `day`. `notes.rabbit` adds a line
 * under the rabbit (the daily uses it for the pattern length); `notes.when`
 * tags what is on the board ('Today' unless it says otherwise). Returns the
 * function that opens it.
 */
export function piecesSheet(dialog, list, day, notes = {}) {
  const spinners = [];
  let built = false;

  const row = (kind, side, title, tag, lines, withDiagram) => {
    const cv = el('canvas', { class: 'model pix', width: 48, height: 56 });
    spinners.push({ ctx: cv.getContext('2d'), t: makeTarget(48, 56), mesh: new Mesh().add(model(kind, side), 0, 0, 0, 1), phase: spinners.length * 0.7 });
    list.append(el('div', { class: 'prow' },
      el('div', {}, cv, withDiagram ? diagram(kind, { ballMove: day.rules?.ballMove }) : null),
      el('div', {}, el('span', { class: 'tag' }, tag), el('h3', {}, title),
        ...lines.filter(Boolean).map((l, i) => el('p', { class: i ? 'small dim' : '' }, l)))));
  };

  function build() {
    built = true;
    const head = (t) => list.append(el('p', { class: 'eyebrow', style: 'margin:6px 0 0' }, t));
    head('Yours');
    for (const type of new Set(day.pieces.map((p) => p.type))) {
      const P = PIECES[type];
      row(type, 'you', P.name, P.kind === 'fairy' ? 'Fairy piece' : P.kind === 'special' ? 'Special' : 'Classic', [descOf(type, day.rules), P.origin, ...patentLines(type)], true);
    }
    if (day.hole && day.rules.goal === 'clear') {
      head('The goal');
      row('flag', 'you', 'The hole', 'Jump in once they are all taken', [EXIT_DESC], false);
    } else if (day.hole) {
      head('The goal');
      row('flag', 'you', 'The hole', 'Sink the ball here', [HOLE_DESC, day.rules.goal === 'descent' ? LOCKED_DESC : null,
        day.rules.ballStops ? 'On this level the ball has to come to rest on the hole; rolling over it is not enough.' : 'The ball drops in if it rolls over it.'],
      false);
    }
    if (day.foes.length) head(day.foes.length > 1 ? 'Theirs' : day.hole ? 'In your way' : 'The one to catch');
    const seen = new Set();
    // Adventure (goal 'clear'): theirs wear their suit, plain grey without one.
    const theirs = (f) => (day.rules.goal === 'clear' ? suitLook(f.suit) : 'foe');
    for (const f of day.foes) {
      const key = f.type + f.brain + (f.suit || '');
      if (seen.has(key)) continue;
      seen.add(key);
      if (f.brain === 'leader') {
        row('rabbit', 'foe', 'The rabbit that leads them', 'Leads them', [leaderDesc(f, day)], false);
      } else if (f.type === 'rabbit') {
        row('rabbit', 'foe', 'The rabbit', f.brain === 'ai' ? 'Thinks' : 'Follows a pattern',
          [f.brain === 'ai' ? RABBIT_AI_DESC : rabbitDesc(day.rules), f.brain === 'ai' ? null : notes.rabbit], f.brain === 'ai');
      } else {
        const P = PIECES[f.type];
        if (f.brain === 'still') row(f.type, f.suit ? theirs(f) : 'grey', P.name, f.suit ? `Theirs, a statue of ${f.suit[0].toUpperCase() + f.suit.slice(1)}` : 'Theirs, a statue', ['A statue of theirs: it never moves and never takes. Take it.', P.desc, ...patentLines(f.type)], false);
        // Adventure's tactics (2026-10-15).
        // Adventure (2026-10-16): a rabbit of a kind, and maybe a suit.
        else if (day.rules.suitRabbits && RABBITS[rabbitIn(f)]) {
          const r = rabbitIn(f);
          row(f.type, theirs(f), P.name, `Theirs, a ${rabbitName(r, f.suit).toLowerCase()} inside`, [RABBITS[r].desc, f.suit && SUITS[f.suit] ? `${SUITS[f.suit].name}: ${SUITS[f.suit].advDesc}` : null, P.desc], f.brain === 'possessed');
        }
        else if (f.brain === 'sentry') row(f.type, theirs(f), P.name, 'Theirs, a sentry rabbit inside', ['A sentry rabbit (red) never walks, but if anything of yours stands in its reach (ringed red) at the end of their turn, it leaps to take it. Pinned, it cannot.', P.desc], false);
        else if (f.brain === 'crown') row(f.type, 'crowned', 'Their leader', 'A crowned King', ['Attack it and they must answer: take your attacker, else block the line (the blocker stands guard after), else the King runs. If nothing works, it is checkmate: every piece of theirs falls, and the board is yours.', P.desc], false);
        else if (f.brain === 'scared') row(f.type, theirs(f), P.name, 'Theirs, a scared rabbit inside', ['A scared rabbit (white) runs to a square you do not attack when you attack it. Their side can save only one a turn: attack two at once and one is yours.', P.desc], false);
        else row(f.type, theirs(f), P.name, f.brain === 'possessed' ? 'Theirs, with a rabbit inside' : 'Theirs, and it thinks', [f.route ? routeText(f) : null, P.desc, P.origin, ...patentLines(f.type)], true);
      }
    }
    if (day.rules.crumble || day.rules.shrink || day.bramble.length || day.stumps.size || day.ghosts?.size || day.gates?.size || day.clouds?.length) head('On the board');
    // Neutral pieces (2026-10-13).
    if (day.ghosts?.size) row('ghost', 'you', 'Ghosts', 'In front of each side', [PIECES.ghost.desc, 'Yours are green and theirs purple: you can go through yours, not theirs.']);
    if (day.gates?.size) row('gateUp', 'you', 'Gates', 'Up, then down', [PIECES.gate.desc]);
    if (day.clouds?.length) row('cloud', 'you', 'Wandering clouds', 'They drift', [PIECES.cloud.desc]);
    if (day.rules.shrink) row('shrink', 'you', day.rules.shrink === 'spiral' ? 'Shrinking, in a spiral' : 'Shrinking ground', notes.when || 'Today',
      [SHRINK_DESC, `Here the edge falls every ${day.rules.shrinkEvery > 1 ? `${day.rules.shrinkEvery} moves` : 'move'}. The square that goes next is shadowed.`]);
    if (day.rules.crumble) row('crumble', 'you', 'Crumbling ground', notes.when || 'Today',
      [CRUMBLE_DESC, 'Select a piece and cracks show on the square it will leave.']);
    // Only the first two daily boards have these.
    if (day.bramble.length) row('bramble', 'you', 'Bramble', notes.when || 'Today',
      [BRAMBLE_DESC, `It grows one square every ${day.every} move${day.every > 1 ? 's' : ''}. The faint thorns show where it goes next.`]);
    if (day.stumps.size) row(statueKind(day, [...day.stumps][0]), 'stone', 'Statue', notes.when || 'Today', day.statueOrder ? [statueDesc(day.rules), STATUE_ROW_DESC] : [statueDesc(day.rules)]);
    list.append(el('p', { class: 'small dim' },
      'Fairy pieces are invented chess pieces, some centuries old. In the diagrams: gold squares are moves, coral is a catch, brown is something in the way.'),
      el('p', { class: 'small dim' },
        'Betza notation is how fairy chess writes a piece down: a letter for each shape of jump (W one step straight, F one step diagonally, N a knight\u2019s L, D and A two steps), doubled to slide (WW is a rook), with small letters for the rest (m moves only, c captures only, p hops a screen, g hops like a grasshopper, n can be blocked, f forward only).'));
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

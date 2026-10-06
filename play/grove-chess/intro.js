// The opening of a game: the board falls in and slams down, each of your
// pieces is introduced with its moves, then they drop onto the board.
//
// The movement uses the Web Animations API (element.animate): CSS-style
// keyframes started from JavaScript, each of which hands back a promise for
// when it finishes. That is what lets the steps run one after another with
// plain `await`, and lets Skip cancel whatever is running.

import { el, haptic } from '../../engine/ui.js';
import { Mesh, makeTarget, render } from '../../engine/lowpoly.js';
import { model } from './models.js';
import { PIECES, CRUMBLE_DESC, movesFor, playerMove } from './rules.js';
import { Board, demoBoard } from './board.js';
import * as sfx from './sounds.js';

const CSS = `
.intro-on #status, .intro-on #info, .intro-on #controls, .intro-on .hud, .intro-on .chips, .intro-on .chipline { opacity: 0; }
#status, #info, #controls, .hud, .chips, .chipline { transition: opacity .35s ease; }
.intro-veil { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px;
  background: rgba(0, 0, 0, .4); background: color-mix(in srgb, var(--bg) 72%, transparent); }
.intro-card { width: min(360px, 100%); background: var(--panel); border: 1px solid var(--line); border-radius: 20px;
  padding: 16px 16px 12px; text-align: center; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
.intro-card .eyebrow { margin: 0 0 4px; }
.intro-card h2 { margin: 2px 0 4px; font-size: 24px; }
.intro-card p { margin: 0 0 10px; font-size: 15px; color: var(--dim); }
.intro-card canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; margin: 0 auto; }
.intro-card .spin { width: 120px; height: 140px; }
.intro-card .demo { width: 100%; max-width: 252px; margin-top: 4px; }
.intro-skip { position: fixed; z-index: 21; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  width: auto; min-height: 44px; padding: 8px 22px; font-size: 15px; background: var(--panel); }
.intro-dust { position: fixed; z-index: 19; width: 6px; height: 6px; background: #b39a6e; pointer-events: none; }
`;

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  document.head.append(el('style', {}, CSS));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Play the opening on `board` (a Board already showing the level). `goal` is
 * an optional last card: { kind, side, title, text } for what you are after.
 * A crumbling level gets a card of its own before the goal.
 * Resolves when the game should start, whether it ran or was skipped.
 */
export async function playIntro(board, level, { goal = null, section = null } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  style();
  let skipped = false;
  const running = new Set();
  const track = (a) => { running.add(a); a.finished.catch(() => {}).finally(() => running.delete(a)); return a; };
  const cleanup = [];
  let advance = null; // resolves the current card early

  const skip = el('button', { class: 'quiet intro-skip', type: 'button', onclick: () => {
    skipped = true;
    for (const a of running) a.cancel();
    advance?.();
  } }, 'Skip intro');
  document.body.append(skip);
  cleanup.push(() => skip.remove());
  section?.classList.add('intro-on');
  cleanup.push(() => section?.classList.remove('intro-on'));

  try {
    // 1. The board falls from above the screen, slams, shakes, settles.
    board.hidePieces = true;
    board.landing = null;
    board.redraw();
    board.el.scrollIntoView({ block: 'center' });
    board.el.style.transformOrigin = '50% 100%';
    await track(board.el.animate(
      [{ transform: 'translateY(-115vh)' }, { transform: 'translateY(0)' }],
      { duration: 560, easing: 'cubic-bezier(.55, 0, 1, .55)' } // speeding up, like a fall
    )).finished.catch(() => {});
    if (!skipped) {
      haptic(35);
      sfx.slam();
      dust(board.el);
      await track(board.el.animate([
        { transform: 'scale(1.06, .9)' },
        { transform: 'translateY(-8px) scale(.98, 1.03)', offset: 0.25 },
        { transform: 'translate(-7px, 0)', offset: 0.45 },
        { transform: 'translate(6px, 0)', offset: 0.6 },
        { transform: 'translate(-4px, 0)', offset: 0.72 },
        { transform: 'translate(2px, 0)', offset: 0.86 },
        { transform: 'none' }
      ], { duration: 560, easing: 'ease-out' })).finished.catch(() => {});
    }

    // 2. A card for each kind of piece you have, then one for the goal.
    const kinds = [...new Set(level.pieces.map((p) => p.type))];
    const cards = kinds.map((k, i) => ({ kind: k, side: 'you', eyebrow: `Your pieces · ${i + 1} of ${kinds.length}`,
      title: PIECES[k].name, text: PIECES[k].desc, demo: true }));
    if (level.rules.crumble) cards.push({ kind: 'crumble', side: 'you', eyebrow: 'The ground', title: 'Crumbling ground',
      text: CRUMBLE_DESC, demo: 'crumble' });
    if (goal) cards.push({ ...goal, eyebrow: 'Your goal', demo: false });
    for (const c of cards) {
      if (skipped) break;
      await card(c, (fn) => { advance = fn; }, track, () => skipped);
    }

    // 3. Your pieces drop onto the board, one after another.
    if (!skipped) {
      const t0 = performance.now(), gap = 160, fall = 420;
      board.hidePieces = false;
      board.landing = (i, now) => {
        const k = (now - t0 - i * gap) / fall;
        if (k < 0) return null;            // not yet
        if (k < 1) return 230 * (1 - k * k); // falling, faster as it goes
        if (k < 1.35) return Math.sin(((k - 1) / 0.35) * Math.PI) * 7; // a small bounce
        return 0;
      };
      level.pieces.forEach((_, i) => setTimeout(() => { if (!skipped) { haptic(8); sfx.drop(i); } }, i * gap + fall));
      await board.runUntil(t0 + (level.pieces.length - 1) * gap + fall * 1.4);
    }
  } finally {
    cleanup.forEach((f) => f());
    board.el.style.transform = '';
    board.hidePieces = false;
    board.landing = null;
    board.redraw();
  }
}

/** A little burst of pixel dust from the board's bottom corners. */
function dust(target) {
  const r = target.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const left = i % 2 === 0;
    const d = el('div', { class: 'intro-dust' });
    d.style.left = `${(left ? r.left + 6 : r.right - 12) + (Math.random() * 30 - 15)}px`;
    d.style.top = `${r.bottom - 6}px`;
    document.body.append(d);
    const dx = (left ? -1 : 1) * (20 + Math.random() * 50), dy = -(10 + Math.random() * 40);
    d.animate([{ transform: 'translate(0,0)', opacity: 0.9 }, { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }],
      { duration: 500 + Math.random() * 300, easing: 'ease-out' }).finished.finally(() => d.remove());
  }
}

/** One card: the model turning, its words, and (for your pieces) a little
    board showing how it moves. Runs about three seconds, or until tapped. */
async function card(c, setAdvance, track, isSkipped) {
  const spin = el('canvas', { class: 'spin', width: 60, height: 70 });
  const words = [el('p', { class: 'eyebrow' }, c.eyebrow), el('h2', {}, c.title), el('p', {}, c.text)];
  const demoCanvas = c.demo ? el('canvas', { class: 'demo' }) : null;
  const body = el('div', { class: 'intro-card' }, spin, ...words, demoCanvas,
    el('p', { class: 'small', style: 'margin:8px 0 0;font-size:13px' }, 'Tap for the next one'));
  const veil = el('div', { class: 'intro-veil' }, body);
  document.body.append(veil);

  // The turning model.
  const t = makeTarget(60, 70), ctx = spin.getContext('2d');
  const mesh = new Mesh().add(model(c.kind, c.side), 0, 0, 0, 1);
  let alive = true;
  const turn = (ts) => {
    if (!alive) return;
    render(t, mesh, { yaw: ts / 900, pitch: 0.4, scale: 3.5, cx: 30, cy: 62 });
    ctx.putImageData(t.img, 0, 0);
    requestAnimationFrame(turn);
  };
  requestAnimationFrame(turn);

  let done = false;
  const hold = new Promise((res) => { setAdvance(() => { done = true; res(); }); veil.addEventListener('click', () => { done = true; res(); }); });

  track(body.animate([{ transform: 'translateX(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' }));

  const stop = () => done || isSkipped();
  const demo = c.demo === 'crumble' ? showCrumble(demoCanvas, stop) : c.demo ? showMoves(demoCanvas, c.kind, stop) : Promise.resolve();
  await Promise.race([hold, Promise.all([demo, wait(c.demo ? 0 : 2200)])]);
  done = true;

  if (!isSkipped()) {
    await track(body.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-60px)', opacity: 0 }],
      { duration: 220, easing: 'ease-in' })).finished.catch(() => {});
  }
  alive = false;
  veil.remove();
}

/**
 * How a piece moves, acted out on a 7 x 7 board: the squares it can reach
 * light up one by one, then it makes a move for real (taking something, if
 * that is how the piece works) and steps back, twice.
 */
async function showMoves(canvas, kind, stop) {
  const { day, s } = demoBoard(kind);
  const board = new Board(canvas, day);
  board.celebrate = false; // a demo catch is a demonstration, not a win
  const moves = movesFor(s, 0);
  let shown = [], state = s;
  board.redraw = () => board.draw({ state, legal: shown, sel: 0 });
  board.redraw();
  await wait(250);

  // Light the squares up, about a second and a half for all of them.
  const step = Math.max(40, Math.min(160, 1400 / Math.max(1, moves.length)));
  for (const m of moves) {
    if (stop()) return;
    shown = [...shown, m];
    board.redraw();
    await wait(step);
  }
  await wait(300);

  // Then show a move or two: a catch if it has one, otherwise the far ones.
  const far = (m) => Math.abs(m.x - 3) + Math.abs(m.y - 3);
  const picks = [moves.find((m) => m.cap), ...[...moves].sort((a, b) => far(b) - far(a))].filter(Boolean).slice(0, 2);
  for (const m of picks) {
    if (stop()) return;
    const to = { ...s, pieces: s.pieces.map((p, i) => (i ? p : { ...p, x: m.x, y: m.y })),
      foes: s.foes.map((f) => (f.x === m.x && f.y === m.y ? { ...f, taken: true } : f)) };
    await board.animate(state, to, { p: 0 }, 2);
    state = to;
    await wait(450);
    if (stop()) return;
    state = s;
    board.redraw();
    await wait(250);
  }
}

/**
 * Crumbling ground, acted out: a rook slides across and the square it left
 * falls away; then its moves light up, and the slide back stops at the gap.
 */
async function showCrumble(canvas, stop) {
  const { day, s } = demoBoard('rook', { at: [1, 3], rules: { crumble: true } });
  const board = new Board(canvas, day);
  board.celebrate = false; // a demo catch is a demonstration, not a win
  let state = s, shown = [], sel = 0;
  board.redraw = () => board.draw({ state, legal: shown, sel });
  board.redraw();
  await wait(600);
  if (stop()) return;
  const mv = { p: 0, x: 5, y: 3 }, after = playerMove(s, mv);
  sel = null;
  await board.animate(state, after, mv, 2);
  state = after;
  await wait(500);
  for (const m of movesFor(state, 0)) {
    if (stop()) return;
    shown = [...shown, m];
    sel = 0;
    board.redraw();
    await wait(110);
  }
  await wait(1600);
}

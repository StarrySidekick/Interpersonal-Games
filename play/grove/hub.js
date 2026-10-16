// Chess of the Grove: every chess game made here, in one place (Timothy,
// 2026-10-15: "in the list of interpersonal games, you just have this chess
// collection ... all of our personal variations ... in a more intuitive
// list ... with a preview board like we have ... and also a separate
// section ... for all pre-existing variations ... for educational purposes").
//
// Each card has a preview: one still frame of the Grove's own 3D board scene
// (board.js `scene`, as the daily's title screen draws it), built only when
// the card scrolls into view.

import { el, $, themeToggle } from '../../engine/ui.js';
import { releaseLine } from '../../engine/release.js';
import { rng } from '../../engine/seed.js';
import { makeTarget, render } from '../../engine/lowpoly.js';
import { scene, sceneFrame, crispWidth } from '../grove-chess/board.js';
import { initialState } from '../grove-chess/rules.js';
import { MODES, modeDefaults, modeSettings, saveModeSettings, levelSettings } from '../grove-chess/modes.js';
import { makeLevel } from '../grove-chess/lab.js';
import { newRun, handSettings, SUITS } from '../grove-chess/run.js';
import { newTiles, layout } from '../grove-chess/tiles.js';
import { loadDay } from '../grove-chess/daily4.js';
import { todayStr } from '../grove-chess/day.js';
import { FUR } from '../grove-chess/rabbits.js';
import { VARIANTS, VARIANT_ORDER } from '../grove-chess/variants.js';

// --- Previews. ------------------------------------------------------------------------

/** One still frame of a board's 3D scene on a canvas. */
function still(cv, day, fur = () => null) {
  // Drawn at the screen's own density, so a small preview keeps every detail.
  const pitch = 0.62, scale = Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1))), f = sceneFrame(day, pitch, scale);
  cv.width = f.w; cv.height = f.h;
  const t = makeTarget(f.w, f.h);
  render(t, scene(day, initialState(day), fur), { yaw: 0.55, pitch, scale, cx: f.w / 2, cy: f.cy });
  cv.getContext('2d').putImageData(t.img, 0, 0);
  crispWidth(cv, 128);
}

/** A Grove-shaped board for scene(): squares, holes, and what stands where.
    `cells` uses y = 0 at the top, as Changeling and Adventure do; the Grove
    counts from the bottom. */
function groveDay(W, H, on, mine, theirs) {
  const flip = (sq) => ({ x: sq % W, y: H - 1 - ((sq / W) | 0) });
  const holes = new Set();
  for (let sq = 0; sq < W * H; sq++) if (!on[sq]) { const { x, y } = flip(sq); holes.add(y * W + x); }
  return {
    W, H, holes, stumps: [], bramble: [], hole: null, rules: {}, statueKinds: new Map(),
    pieces: mine.map((p) => ({ type: p.kind, ...flip(p.sq) })),
    foes: theirs.map((p) => ({ type: p.kind, side: p.side, ...flip(p.sq) }))
  };
}

/** A runner mode's first level, built the way play/main.js starts a run
    (newSession), without starting one. */
function firstLevel(id, seed = 7) {
  const M = modeDefaults(id);
  let hand = null;
  if (M.run === 'descent' || M.run === 'rounds') {
    const one = M.upgrades === 'each' || M.upgrades === 'tiles';
    let start, foes = null;
    if (M.run === 'descent' && one) {
      start = M.startPool.includes('king') ? [...M.startPool] : [...M.startPool, 'king'];
      foes = M.foeLine === 'turned' ? start.slice().reverse() : start.slice();
    } else {
      const r = rng(`start:${seed}`);
      start = Array.from({ length: Math.min(M.maxPieces, M.startPieces) }, () => M.startPool[Math.floor(r() * M.startPool.length)]);
      if (M.royal && M.run === 'descent') start[0] = 'king';
    }
    const run = newRun(start, M.maxPieces, foes);
    if (M.pawnRow && one) for (const l of [run.hand, run.foes]) for (let i = 0; i < M.w; i++) l.push({ base: 'pawn', row: 1 });
    if (M.upgrades === 'tiles') { run.tiles = newTiles(M.w, M.h); run.foeRabbit = false; }
    hand = handSettings(run);
    if (run.tiles) hand.tiles = layout(run.tiles);
  }
  return makeLevel(levelSettings(M, { hand }, rng(`${id}:${seed}:1`)), seed + 1000);
}


const PREVIEW = {
  daily: async () => {
    const day = await loadDay(todayStr());
    return [day, (f) => ((f.brain === 'pattern' || f.brain === 'possessed' || f.mind) && FUR[f.patternName]) || null];
  },
  pieces: () => {
    const kinds = ['changeling', 'camel', 'cannon', 'nightrider', 'archbishop', 'squirrel', 'zebra', 'chancellor'];
    const day = groveDay(4, 2, new Uint8Array(8).fill(1), kinds.slice(0, 4).map((k, i) => ({ kind: k, sq: 4 + i })), kinds.slice(4).map((k, i) => ({ kind: k, sq: i, side: 'foe' })));
    return [day];
  }
};
for (const id of ['adventure', 'descent', 'kungfu', 'tiles', 'golf', 'flag', 'autochess', 'chaos']) PREVIEW[id] = () => [firstLevel(id)];
// Adventure's walkers wear their rabbits' colours, as in play.
PREVIEW.adventure = () => [firstLevel('adventure'), (f) => (['possessed', 'sentry', 'scared'].includes(f.brain) && (SUITS[f.suit]?.colour || FUR[f.patternName])) || null];
for (const id of VARIANT_ORDER) PREVIEW[`v:${id}`] = () => [makeLevel({ ...modeDefaults('variants'), variant: id }, 1)];

// Draw each preview when its card comes into view, one at a time.
const queue = [];
let drawing = false;
async function drain() {
  if (drawing) return;
  drawing = true;
  while (queue.length) {
    const { cv, id } = queue.shift();
    try {
      const got = await PREVIEW[id]?.();
      if (got?.[0]) still(cv, got[0], got[1]);
    } catch (e) { console.warn('preview', id, e); }
    await new Promise((r) => setTimeout(r, 0));
  }
  drawing = false;
}
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    seen.unobserve(e.target);
    queue.push({ cv: e.target, id: e.target.dataset.preview });
  }
  drain();
}, { rootMargin: '200px' });

// --- The list. -------------------------------------------------------------------------
// Ours, grouped by how you play them; then the classics.

const OURS = [
  { head: 'Every day', say: 'The same board for everyone, once a day. Share how you did.', items: [
    { id: 'daily', href: '../grove-chess/', name: 'The rabbit', line: 'Catch the day\'s rabbit, which hops in a hidden pattern. Friends who play from your link join your vine.', tags: ['daily', 'shared'], hot: true }
  ] },
  { head: 'Runs', say: 'Down through the Grove, board after board, until you fall. Different every time.', items: [
    { id: 'adventure', href: '../grove-chess/play/?mode=adventure', name: 'Adventure', line: 'Start with a rook. Take every piece and jump down the hole. Pieces with a rabbit inside walk short routes; three rabbits of a kind make you that piece, and you choose which of your three goes each turn.', tags: ['roguelite', 'new'], hot: true },
    { id: 'descent', href: '../grove-chess/play/?mode=descent', name: MODES.descent.name, line: 'A full army each, as in chess. Take the piece the rabbit rides to fall to the next board, and choose a suit or a weapon.', tags: ['roguelite', 'armies'] },
    { id: 'tiles', href: '../grove-chess/play/?mode=tiles', name: MODES.tiles.name, line: 'Win a round, turn over a tile at the edge: the board grows, and the suit or weapon on it is yours.', tags: ['rounds', 'armies'] },
    { id: 'kungfu', href: '../grove-chess/play/?mode=kungfu', name: MODES.kungfu.name, line: 'The descent with no turns: move any piece whenever it is ready, and so do they.', tags: ['real time'] }
  ] },
  { head: 'More ways to play', say: 'One idea each, played out.', items: [
    { id: 'golf', href: '../grove-chess/play/?mode=golf', name: MODES.golf.name, line: 'Your sliders are the clubs. Knock the ball into the hole at par or better.', tags: ['puzzle', 'a course'] },
    { id: 'flag', href: '../grove-chess/play/?mode=flag', name: MODES.flag.name, line: 'Capture the flag, with a rabbit for the flag. Carry it home to your first row.', tags: ['armies'] },
    { id: 'autochess', href: '../grove-chess/play/?mode=autochess', name: MODES.autochess.name, line: MODES.autochess.blurb, tags: ['watch them fight'] }
  ] },
  { head: 'The workshop', say: 'For trying ideas out.', items: [
    { id: 'chaos', href: '../grove-chess/lab/', name: 'Custom', line: 'Any pieces, any board, any rules. Play it, let bots simulate it, or have them find the most playable layout.', tags: ['every setting'] },
    { id: 'pieces', href: '../grove-chess/pieces/', name: 'The pieces', line: 'Every piece in the Grove, classic and fairy, with its history and how it moves. New: the Changeling, which takes on the moves of whatever it takes.', tags: ['catalog'] }
  ] }
];

function card({ id, href, name, line, tags = [], hot = false, who = '', onclick = null }) {
  const cv = el('canvas', { 'data-preview': id, 'aria-hidden': 'true' });
  const box = el(onclick ? 'button' : 'a', { class: 'mode', ...(onclick ? { type: 'button', onclick } : { href }) },
    el('div', { class: 'prev' }, cv),
    el('div', {},
      who ? el('p', { class: 'who' }, who) : null,
      el('h3', {}, name),
      el('p', {}, line),
      tags.length ? el('div', { class: 'tags' }, ...tags.map((t, i) => el('span', { class: hot && i === 0 ? 'hot' : '' }, t))) : null));
  seen.observe(cv);
  return box;
}

$('#ours').replaceChildren(...OURS.map((g) => el('section', { class: 'group' },
  el('h2', {}, g.head), el('p', { class: 'dim' }, g.say), el('div', { class: 'list' }, ...g.items.map(card)))));

/** Who made a variant and when: the first sentence of its history. */
const whoMade = (v) => (v.history || '').split(/(?<=\.)\s/)[0];
$('#classic').replaceChildren(...VARIANT_ORDER.map((id) => {
  const v = VARIANTS[id];
  return card({
    id: `v:${id}`, name: v.name, line: v.blurb, who: whoMade(v), tags: [v.size],
    // The variants mode plays the variant its settings name, so set it, then go.
    onclick: () => {
      saveModeSettings('variants', { ...modeSettings('variants'), variant: id });
      location.href = '../grove-chess/play/?mode=variants';
    }
  });
}));

$('.topbar').append(themeToggle());
$('.wrap').append(releaseLine());

// The daily game: today's board, the vine of everyone who played it, and the
// test mode (add ?test to the address). Drawing lives in board.js and the
// pieces menu in sheet.js; the lab (lab/) shares both.

import { $, el, show, haptic, keepAwake, themeToggle } from '../../engine/ui.js';
import { logSitting } from '../../engine/record.js';
import { soundToggle } from '../../engine/sound.js';
import { makeTarget, render } from '../../engine/lowpoly.js';
import {
  PIECES, descOf, rabbitDesc, CRUMBLE_DESC, SHRINK_DESC, STUMP_DESC, HOLE_DESC, movesFor, apply, playerMove, respond, isOver, outcome,
  isBramble, brambleCount, replay, crumbled, shrunk, holeOpen
} from './rules.js';
import { todayStr, describePattern, fairyFor } from './day.js';
import { loadDay } from './daily4.js';
import { GOAL_PILL, GOAL_TEXT, summary } from './lab.js';
import {
  load, save, dayEntry, readLink, parseVine, makeLink, encodeMoves, decodeMoves, cleanName
} from './vine.js';
import { Board, patternPicture, revealPattern, scene, sceneFrame, sprite } from './board.js';
import { FUR, FUR_WORD, caughtRabbits, recordCatch } from './rabbits.js';
import { makeBoard } from './board3d.js';
import * as sfx from './sounds.js';
import { piecesSheet } from './sheet.js';
import { fillMenu } from './menu.js';
import { playIntro } from './intro.js';

// --- The day, and what this phone already knows about it. -----------------

const store = load();
const link = readLink();
const date = link.date || todayStr();
const day = await loadDay(date);
const N = day.N;
// From version 4 (2026-10-09) a daily can be any level at all, with a
// name; before that it was always one rabbit on a pattern. `named` marks
// the new kind wherever the page has to say something different.
const named = day.version >= 4;
const entry = dayEntry(store, date);

const chunkOf = (p) => encodeURIComponent(cleanName(p.name) || 'Someone') + '.' + encodeMoves(p.moves, N);

// Every game a link brings in is kept. If you have not played yet, the link
// you came in on is your branch: your own link will carry it forward.
const incoming = parseVine(day, link.raw);
for (const p of incoming) {
  const c = chunkOf(p);
  if (!entry.seen.includes(c)) entry.seen.push(c);
}
if (!entry.done && incoming.length) entry.branch = incoming.map(chunkOf).join('~');
save(store);

function newGame(moves = [], practice = false) {
  const { states } = replay(day, moves);
  return { moves: moves.slice(0, states.length - 1), states, practice };
}
const real = newGame(decodeMoves(entry.moves || '', N) || []);
let game = real;
const now = () => game.states[game.states.length - 1];
const rabbitOf = (s) => s.foes[0];

const ME = '#262626';
const COLORS = ['#d0473d', '#2f6fc0', '#8a4bb0', '#de7a1f', '#118a74', '#c2378a', '#5f7a20', '#9a6a0c'];

// --- What the board is showing. --------------------------------------------

const board = makeBoard($('#board'), day);
// The rabbit wears its pattern's colour once you have caught that pattern
// before (rabbits.js); until then it is white.
let knownFur = caughtRabbits()[day.patternName] ? FUR[day.patternName] : null;
board.fur = named
  ? (f) => ((f.brain === 'pattern' || f.brain === 'possessed' || f.mind) && FUR[f.patternName]) || null
  : (f) => (f.type === 'rabbit' ? knownFur : null);
let view = { mode: 'play' };
let sel = null, legal = [];
// While your finished chase is being drawn out, how many moves of it show.
let chaseUpto = null;
// The position on screen while a turn is half done (your move made, theirs
// not yet), for a named daily's two-step animation.
let shown = null;

board.redraw = function redraw() {
  const s = now();
  if (view.mode === 'play') {
    const paths = isOver(s) ? [{ play: game, color: ME, upto: chaseUpto ?? undefined }] : null;
    board.draw({ state: shown || s, track: game.states, sel, legal, paths });
  } else if (view.mode === 'watch') {
    const st = view.play.states;
    board.draw({ state: st[view.k], track: st.slice(0, view.k + 1), paths: [{ play: view.play, color: view.color, upto: view.k }] });
  } else if (view.mode === 'all') {
    board.draw({ state: game.states[0], track: null, paths: view.paths });
  }
};
const redraw = () => board.redraw();

// --- Playing. --------------------------------------------------------------

let busy = false;
const status = (t) => { $('#status').textContent = t; };
const info = (t) => { $('#info').textContent = t; };

function hud() {
  $('#movecount').textContent = now().t;
  $('#movemax').textContent = `of ${day.rules.maxMoves || 15}`;
  $('#par').textContent = day.par;
}

const nameOf = (x) => PIECES[x.type]?.name || x.type;

/** What just happened, on a named daily: any level, any number of foes. */
function whatHappened(a, b) {
  const bits = [];
  b.foes.forEach((f, k) => { if (f.taken && !a.foes[k].taken) bits.push(`You took their ${nameOf(f)}.`); });
  b.foes.forEach((f) => {
    if (f.ate >= 0 && b.pieces[f.ate].taken && !a.pieces[f.ate].taken) bits.push(`Their ${nameOf(f)} took your ${nameOf(b.pieces[f.ate])}.`);
  });
  if (b.hole && !holeOpen(a) && holeOpen(b)) bits.push('The hole is open.');
  if (b.gone.length > a.gone.length) bits.push('The square you left crumbled away.');
  if (b.shrunk.length > a.shrunk.length) bits.push('A square fell off the edge.');
  if (!bits.length) bits.push('Your move.');
  return bits.join(' ');
}

function select(i) {
  sel = i;
  legal = i == null ? [] : movesFor(now(), i);
  if (i == null) info(named ? (day.hole && !holeOpen(now()) ? 'Tap a piece to light up where it can go. The hole opens once every rabbit is caught.' : 'Tap a piece to light up where it can go.')
    : 'Numbers mark where the rabbit has been, in order. Tap a piece to light up where it can go.');
  else {
    const type = now().pieces[i].type;
    info(`${PIECES[type].name}: ${descOf(type, now().day.rules)}${legal.length ? '' : ' It has nowhere to go right now.'}`);
  }
  redraw();
}

async function play(mv) {
  if (busy || isOver(now())) return;
  busy = true;
  if (named) return playNamed(mv);
  const a = now(), b = apply(a, mv);
  game.moves.push(mv); game.states.push(b);
  if (!game.practice) { entry.moves = encodeMoves(game.moves, N); save(store); }
  sel = null; legal = [];
  const r = rabbitOf(b);
  haptic(b.won ? [20, 40, 30] : r.ate >= 0 ? [40, 30, 40] : 10);
  hud();
  // A finished chase is drawn out afterwards (drawChase), so it starts hidden.
  if (isOver(b) && !calm()) chaseUpto = 0;
  await board.animate(a, b, mv);
  busy = false;

  if (isOver(b)) return finish(true);
  let msg = r.blocked
    ? 'The rabbit tried to hop, but something was in the way. It waited.'
    : r.ate >= 0
      ? `The rabbit landed on your ${PIECES[b.pieces[r.ate].type].name} and ate it.`
      : 'The rabbit hopped. Your move.';
  if (isBramble(b, r.x, r.y)) msg = 'The rabbit is hiding in the bramble. Nothing can reach it there.';
  if (brambleCount(day, b.t) > brambleCount(day, a.t)) msg += ' The bramble crept.';
  if (b.gone.length === 1 && !a.gone.length) msg = 'The square you left crumbled away. ' + msg;
  if (b.shrunk.length > a.shrunk.length) msg += ' A square fell off the edge.';
  status(msg);
  select(null);
}

/** A turn on a named daily: your move shown, then theirs. */
async function playNamed(mv) {
  const a = now(), mid = playerMove(a, mv), b = respond(mid);
  game.moves.push(mv); game.states.push(b);
  if (!game.practice) { entry.moves = encodeMoves(game.moves, N); save(store); }
  sel = null; legal = [];
  haptic(b.won ? [20, 40, 30] : b.pieces.some((p, i) => p.taken && !a.pieces[i].taken) ? [40, 30, 40] : 10);
  hud();
  if (isOver(b) && !calm()) chaseUpto = 0;
  shown = mid;
  await board.animate(a, mid, mv);
  shown = null;
  if (!mid.won) await board.animate(mid, b, { p: -1 });
  busy = false;
  if (isOver(b)) return finish(true);
  status(whatHappened(a, b));
  select(null);
}

board.el.addEventListener('click', (e) => {
  if (busy || view.mode !== 'play' || isOver(now())) return;
  const c = board.cellAt(e);
  if (!c) return;
  const { x, y } = c, s = now();
  if (sel != null) {
    const m = legal.find((m) => m.x === x && m.y === y);
    if (m) return play({ p: sel, x, y });
  }
  const i = s.pieces.findIndex((p) => !p.taken && p.x === x && p.y === y);
  if (i >= 0) return select(sel === i ? null : i);
  select(null);
  if (named) {
    if (s.hole && s.hole.x === x && s.hole.y === y) return info(HOLE_DESC);
    if (crumbled(s, x, y)) return info(CRUMBLE_DESC);
    if (shrunk(s, x, y)) return info(SHRINK_DESC);
    if (s.day.stumps.has(y * s.day.W + x)) return info(STUMP_DESC);
    const f = s.foes.find((f) => !f.taken && f.x === x && f.y === y);
    if (f) info(f.mind ? `Their ${nameOf(f)}, with a ${f.patternName ? f.patternName.toLowerCase() + ' ' : ''}rabbit inside (intelligence ${f.mind.iq}).` : `Their ${nameOf(f)}. ${PIECES[f.type].desc}`);
    return;
  }
  if (rabbitOf(s).x === x && rabbitOf(s).y === y) info(`The rabbit. ${rabbitDesc(day.rules)}`);
  else if (crumbled(s, x, y)) info(CRUMBLE_DESC);
  else if (shrunk(s, x, y)) info(SHRINK_DESC);
});

$('#wait').onclick = () => play({ p: -1, x: 0, y: 0 });
if (day.rules.wait === false) $('#wait').hidden = true;

// --- The end, and the vine. -----------------------------------------------

function golf(d) {
  if (d <= -3) return 'Albatross';
  return { '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[d] ?? `${d} over par`;
}

// A named daily wins in its own words: what winning was, on that board.
const WON = { all: 'Cleared in', king: 'King taken in', rabbit: 'Caught in', any: 'Caught in', target: 'Caught in', hole: 'Sunk in', descent: 'Done in' };
const wonWord = WON[day.goalKind] || 'Won in';
const RESULT = named ? {
  caught: (n) => `${wonWord} ${n}`,
  eaten: () => 'They won',
  dusk: () => 'Out of moves'
} : {
  caught: (n) => `Caught in ${n}`,
  eaten: () => 'It ate everything',
  dusk: () => 'It got away'
};
const shortResult = (p) => (named
  ? { caught: `${wonWord.toLowerCase()} ${p.score}`, eaten: 'beaten', dusk: 'out of moves' }
  : { caught: `caught in ${p.score}`, eaten: 'all eaten', dusk: 'got away' })[p.outcome];

function myPlay() {
  const end = real.states[real.states.length - 1];
  if (!isOver(end)) return null;
  return { name: store.name || 'You', moves: real.moves, states: real.states, caught: end.won, score: end.t, outcome: outcome(end) };
}

function others() {
  const mine = myPlay();
  return parseVine(day, entry.seen.join('~')).filter((p) => !(mine && store.name && chunkOf(p) === chunkOf(mine)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let revealToken = 0, patternWatch = null, finishes = 0;

/** Your chase drawn back onto the board a move at a time, just after you
    finish. Anything else you do with the board stops it. Resolves true if
    it ran to the end. */
async function drawChase() {
  const token = ++revealToken, g = game;
  await sleep(250);
  for (let k = 0; k <= g.moves.length; k++) {
    if (token !== revealToken || game !== g || view.mode !== 'play') break;
    chaseUpto = k; redraw();
    if (k && g.moves[k - 1].p >= 0) sfx.tick();
    await sleep(120);
  }
  chaseUpto = null; redraw();
  return token === revealToken && game === g;
}

/** `fresh` is true when the game has just ended, rather than being shown
    again on a later visit: only then does it play its tune and draw itself
    out. */
function finish(fresh = false) {
  const end = now(), how = outcome(end), over = end.t - day.par, mine = ++finishes;
  let firstOfKind = false;
  const firsts = [];
  if (!game.practice && !entry.done) {
    entry.done = true; save(store);
    logSitting({ game: 'grove-chess', data: { date, number: day.number, outcome: how, moves: end.t, par: day.par, ...(named ? { name: day.name } : {}) } });
    if (named) {
      // Every rabbit you caught on the way, pattern or mind, joins your collection.
      end.foes.forEach((f) => { if (f.taken && (f.type === 'rabbit' || f.brain === 'possessed' || f.mind) && FUR[f.patternName] && recordCatch(f.patternName)) firsts.push(f.patternName); });
    } else if (how === 'caught') { firstOfKind = recordCatch(day.patternName); knownFur = FUR[day.patternName] || null; }
  }
  $('#controls').hidden = true;
  $('#end').hidden = false;
  $('#end-score').textContent = (game.practice ? 'Practice: ' : '') + RESULT[how](end.t);
  $('#end-par').replaceChildren(`Par ${day.par} · `, how === 'caught'
    ? el('span', { class: `golf g${sfx.levelFor(over)}` }, golf(over))
    : named ? { eaten: 'they took what they needed', dusk: 'the moves ran out' }[how] : { eaten: 'the rabbit won', dusk: 'dusk fell first' }[how]);
  if (named) return finishNamed(fresh, how, over, firsts);
  const word = FUR_WORD[day.patternName];
  $('#end-pattern').textContent = `It was a ${day.patternName}${word ? `, a ${word} rabbit` : ''}. Its pattern: ${describePattern(day)}, then the same again. Shown the way it started; hitting an edge flips it on that axis. Each hop direction has its own note, so the tune repeats when the pattern does.`;
  $('#end-rabbit').textContent = firstOfKind
    ? `Your first ${day.patternName}. From now on a ${day.patternName} wears ${word} fur, so you will know it on sight.` : '';
  showRabbits();
  const pic = $('#pattern-pic'), { mx, my } = day.rabbit;
  patternWatch?.disconnect();
  if (fresh) {
    // The result in sound first, then in pictures: the score pops in, your
    // chase draws itself out, and the rabbit's pattern plays as a tune once
    // you scroll down to it.
    ({ caught: () => sfx.fanfare(sfx.levelFor(over)), dusk: () => sfx.dusk(), eaten: () => sfx.lost() })[how]();
    for (const n of [$('#end-score'), $('#end-par')]) { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); }
    if (!calm()) {
      patternPicture(pic, day.pattern, mx, my, 0);
      // One thing at a time: the tune waits for the chase to finish drawing.
      drawChase().then((done) => {
        // Cut short (you tapped someone's game): just show the pattern.
        if (!done) { if (mine === finishes) patternPicture(pic, day.pattern, mx, my); return; }
        const watch = patternWatch = new IntersectionObserver((seen) => {
          if (!seen.some((e) => e.isIntersecting)) return;
          watch.disconnect();
          if (patternWatch === watch) revealPattern(pic, day.pattern, mx, my);
        }, { threshold: 0.6 });
        watch.observe(pic);
      });
    } else patternPicture(pic, day.pattern, mx, my);
  } else patternPicture(pic, day.pattern, mx, my);
  $('#share-card').hidden = game.practice;
  $('#name').value = store.name || '';
  status({ caught: 'Caught.', eaten: 'The rabbit ate your last piece.', dusk: 'The rabbit slipped into its burrow at dusk.' }[how]);
  info('');
  renderVine();
  redraw();
}

/** The end of a named daily: the board's name and what it was, then the vine. */
function finishNamed(fresh, how, over, firsts) {
  $('#end-pattern-head').textContent = day.name;
  $('#pattern-pic').hidden = true;
  const m = day.measure;
  $('#end-pattern').textContent = day.theme.line +
    (m ? ` A novice bot wins it ${Math.round(m.winRate * 100)}% of the time, in about ${Math.round(m.winLen)} moves; the solver needs ${day.par}.` : '');
  $('#end-rabbit').textContent = firsts.length
    ? `Your first ${firsts.join(' and ')} rabbit${firsts.length > 1 ? 's' : ''}. From now on ${firsts.length > 1 ? 'they wear their' : 'it wears its'} colour, so you will know ${firsts.length > 1 ? 'them' : 'it'} on sight.` : '';
  showRabbits();
  if (fresh) {
    ({ caught: () => sfx.fanfare(sfx.levelFor(over)), dusk: () => sfx.dusk(), eaten: () => sfx.lost() })[how]();
    for (const n of [$('#end-score'), $('#end-par')]) { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); }
    if (!calm()) drawChase();
  }
  $('#share-card').hidden = game.practice;
  $('#name').value = store.name || '';
  status({ caught: 'Won.', eaten: 'They won this one.', dusk: 'Out of moves.' }[how]);
  info('');
  renderVine();
  redraw();
}

/** Every rabbit you have caught in the daily, one of each colour, with how
    many. Only what you have; never blanks for the ones you have not. */
function showRabbits() {
  const caught = caughtRabbits(), names = Object.keys(FUR).filter((n) => caught[n]);
  const box = $('#end-rabbits');
  box.replaceChildren();
  if (!names.length) return;
  box.append(el('p', { class: 'small dim', style: 'margin:10px 0 4px' }, 'The rabbits you have caught'));
  const row = el('div', { class: 'rabbitrow' });
  for (const n of names) {
    const cv = el('canvas', { class: 'pix', width: 30, height: 36, title: `${n}: ${FUR_WORD[n]}` });
    cv.getContext('2d').drawImage(sprite('rabbit', 'foe', FUR[n]), 0, 0);
    row.append(el('div', { class: 'rabbitcell' }, cv, el('span', { class: 'small' }, caught[n] > 1 ? `${n} ×${caught[n]}` : n)));
  }
  box.append(row);
}

let watchToken = 0, vineRows = [];

function renderVine() {
  const list = $('#vine-list');
  list.replaceChildren();
  const rows = [];
  const mine = myPlay();
  if (mine) rows.push({ play: mine, color: ME, label: store.name ? `${store.name} (you)` : 'You' });
  others().forEach((p, i) => rows.push({ play: p, color: COLORS[i % COLORS.length], label: p.name }));
  for (const r of rows) {
    const b = el('button', { class: 'vrow', 'aria-pressed': 'false' },
      el('span', { class: 'swatch', style: `background:${r.color}` }),
      el('span', {}, r.label),
      el('span', { class: 'dim small' }, shortResult(r.play)));
    b.onclick = () => watch(r, b);
    list.append(b);
  }
  if (rows.length <= 1) list.append(el('p', { class: 'small dim' },
    'Nobody else yet. Share your link: anyone who plays from it lands here, and so does anyone who plays from theirs.'));
  vineRows = rows;
}

async function watch(r, btn) {
  const token = ++watchToken;
  document.querySelectorAll('.vrow').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (view.mode === 'watch' && view.play === r.play) { view = { mode: 'play' }; return redraw(); }
  btn.setAttribute('aria-pressed', 'true');
  board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  view = { mode: 'watch', play: r.play, color: r.color, k: 0 };
  redraw();
  await new Promise((res) => setTimeout(res, 350));
  for (let k = 1; k < r.play.states.length; k++) {
    if (token !== watchToken) return;
    view.k = k;
    await board.animate(r.play.states[k - 1], r.play.states[k], r.play.moves[k - 1], 1.3);
    await new Promise((res) => setTimeout(res, 160));
  }
}

$('#all-paths').onclick = () => {
  watchToken++;
  document.querySelectorAll('.vrow').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (view.mode === 'all') { view = { mode: 'play' }; return redraw(); }
  view = { mode: 'all', paths: vineRows.map((r) => ({ play: r.play, color: r.color })) };
  board.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  redraw();
};

$('#practice').onclick = () => {
  watchToken++; revealToken++; chaseUpto = null;
  game = newGame([], true);
  view = { mode: 'play' };
  $('#end').hidden = true;
  $('#controls').hidden = false;
  hud();
  status('Practice. This game is not saved or shared.');
  select(null);
};

$('#share').onclick = async () => {
  const note = $('#share-note');
  const name = cleanName($('#name').value);
  if (!name) { note.textContent = 'Add a name first, so people know whose game it is.'; $('#name').focus(); return; }
  store.name = name; save(store);
  const mine = myPlay();
  const branch = parseVine(day, entry.branch).filter((p) => chunkOf(p) !== chunkOf(mine));
  const url = makeLink(location.origin + location.pathname, day, [...branch, mine]);
  const head = named ? `Hikari Garden #${day.number}: ${day.name}\n${RESULT[mine.outcome](mine.score)} (par ${day.par})`
    : `Hikari Garden, rabbit #${day.number}\n${RESULT[mine.outcome](mine.score)} (par ${day.par})`;
  renderVine();
  if (navigator.share) {
    try { await navigator.share({ text: head, url }); note.textContent = 'Sent.'; return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${head}\n${url}`);
    note.textContent = 'Copied. Paste it into your chat.';
  } catch {
    note.replaceChildren('Copy this:', el('input', { type: 'text', value: `${head} ${url}`, readonly: true }));
  }
};

// --- The pieces menu. ------------------------------------------------------

const openSheet = piecesSheet($('#sheet'), $('#sheet-list'), day, named ? { when: day.name } : {
  rabbit: day.pattern.length > 1 ? `Today's rabbit repeats its pattern every ${day.pattern.length} hops.` : 'Today’s rabbit makes the same hop every time.'
});
$('#pieces-title').onclick = openSheet;
$('#pieces-play').onclick = openSheet;
$('#sheet-close').onclick = () => $('#sheet').close();

// --- The title: today's board, turning. ------------------------------------

const dio = $('#diorama');
const pitch = 0.62, dscale = 2, frame = sceneFrame(day, pitch, dscale);
dio.width = frame.w; dio.height = frame.h;
// The board as you left it: the start for a fresh game, your position (and
// any crumbled squares) for one in progress.
const dctx = dio.getContext('2d'), dt = makeTarget(dio.width, dio.height), dmesh = scene(day, now(), board.fur);
let yaw = 0.6, last = 0, twirl = null;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function titleFrame(ts) {
  if ($('[data-screen=title]').hidden) return;
  const dtime = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  let lift = 0;
  if (twirl) {
    const k = Math.min(1, (ts - twirl.t0) / 1000);
    yaw = twirl.yaw0 + ease(k) * Math.PI * 4;
    lift = Math.sin(Math.PI * k) * 12;
    if (k >= 1 && !twirl.left) { twirl.left = true; dio.classList.add('leaving'); setTimeout(startPlay, 330); }
  } else yaw += dtime * 0.4;
  render(dt, dmesh, { yaw, pitch, scale: dscale, cx: dio.width / 2, cy: frame.cy - lift });
  dctx.putImageData(dt.img, 0, 0);
  requestAnimationFrame(titleFrame);
}

dio.addEventListener('click', () => {
  if (twirl) return;
  haptic(12);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return startPlay();
  twirl = { t0: performance.now(), yaw0: yaw };
});

async function startPlay() {
  show('play');
  keepAwake();
  hud();
  const chips = $('#chips');
  chips.replaceChildren(el('span', { class: 'pill' }, `${day.W || N} × ${day.H || N}`));
  if (named) {
    chips.append(el('span', { class: 'pill' }, GOAL_PILL[day.goalKind] || 'Win'));
    if (day.hole) chips.append(el('span', { class: 'pill' }, `Ball: ${({ ice: 'on ice', putt: 'putting', bounce: 'billiard', hit: 'hit by the pieces', sticky: 'sticky', ghost: 'a ghost' })[day.rules.ballMove || 'ice']}`));
    if (day.rules.wrap) chips.append(el('span', { class: 'pill' }, 'Magic edges'));
    if (day.rules.geared) chips.append(el('span', { class: 'pill' }, 'Geared'));
  }
  if (day.rules.crumble) chips.append(el('span', { class: 'pill' }, 'Crumbling ground'));
  if (day.rules.shrink) chips.append(el('span', { class: 'pill' }, day.rules.shrink === 'spiral' ? 'Shrinking in a spiral' : 'Shrinking ground'));
  if (day.bramble.length) chips.append(el('span', { class: 'pill' }, 'Bramble creeps'));
  if (day.stumps.size) chips.append(el('span', { class: 'pill' }, `${day.stumps.size} statue${day.stumps.size > 1 ? 's' : ''}`));
  if (isOver(now())) return finish();
  // The opening plays for a fresh game only: not when carrying on, and not
  // for practice.
  if (!game.moves.length && !game.practice) {
    busy = true;
    await playIntro(board, day, { section: $('[data-screen=play]'), goal: named
      ? { kind: day.hole ? 'flag' : 'rabbit', side: day.hole ? 'you' : 'foe', title: day.name,
        text: `${GOAL_PILL[day.goalKind] || 'Win'}, in ${day.rules.maxMoves} moves or fewer. ${day.theme.line}` }
      : { kind: 'rabbit', side: 'foe', title: 'The rabbit',
        text: 'Catch it. It hops in a hidden pattern that repeats, and its tracks are numbered on the board so you can work it out.' } });
    busy = false;
  }
  status(game.moves.length ? 'Carrying on where you left off. Your move.' : 'Your move. Tap a piece to see where it can go.');
  select(null);
}

// --- Words on the title. ---------------------------------------------------

if (named) {
  $('#how-old').hidden = true;
  $('#how-named').hidden = false;
  $('#how-goal').textContent = `Today: win by ${GOAL_TEXT[day.goalKind] || 'the goal above'}, in ${day.rules.maxMoves} moves or fewer.`;
  $('#dayname').textContent = day.name;
  $('#daytheme').textContent = day.theme.line;
} else $('#how-rabbit').textContent = `The rabbit: ${rabbitDesc(day.rules)}`;

{
  const [y, m, d] = date.split('-').map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const tag = named ? `No. ${day.number}` : `Rabbit #${day.number}`;
  $('#daypill').textContent = tag;
  $('#datenote').textContent = date === todayStr() ? `${tag} · ${when}` : `${tag} · the board for ${when}`;
  const end = now();
  $('#tapnote').textContent = isOver(end)
    ? 'You have played this one. Tap to see the vine.'
    : real.moves.length ? `You are on move ${end.t}. Tap to carry on.` : 'Tap the board to begin.';
  const bits = incoming.slice(-3).map((p) => (named
    ? { caught: `${p.name} won in ${p.score}.`, eaten: `${p.name} was beaten.`, dusk: `${p.name} ran out of moves.` }
    : { caught: `${p.name} caught it in ${p.score}.`, eaten: `The rabbit ate all of ${p.name}'s pieces.`, dusk: `${p.name} lost it at dusk.` })[p.outcome]);
  if (bits.length) $('#vinenote').textContent = bits.join(' ') + (isOver(end) ? '' : ' Your turn.');
}

// --- Test mode: add ?test to the address. ---------------------------------
// Jump between days, clear a board to play it again for real, and peek at
// what the day dealt. Every board is a pure function of its date, so a date
// is all it takes to get any board back.

if (new URLSearchParams(location.search).has('test')) {
  const go = (d) => { location.hash = `d=${d}`; location.reload(); };
  const shift = (n) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  $('#testpanel').hidden = false;
  $('#t-prev').onclick = () => go(shift(-1));
  $('#t-next').onclick = () => go(shift(1));
  $('#t-today').onclick = () => go(todayStr());
  $('#t-random').onclick = () => go(new Date(Date.UTC(2026, 0, 1) + Math.floor(Math.random() * 1826) * 86400000).toISOString().slice(0, 10));
  $('#t-date').value = date;
  $('#t-date').onchange = (e) => { if (e.target.value) go(e.target.value); };
  $('#t-reset').onclick = () => { delete store.days[date]; save(store); location.reload(); };
  $('#t-next-end').hidden = false;
  // For automated tests: play a move and see whether the board is busy.
  window.__daily = { play, busy: () => busy, now, day };
  $('#t-next-end').onclick = () => go(shift(1));
  if (named) $('#t-spoil').textContent = `${day.name} (${day.theme.id}). ${summary(day.settings)} Par ${day.par}. ` +
    `Measured: difficulty ${day.measure.difficulty}, skill ceiling ${day.measure.ceiling}, engagement ${day.measure.engagement}, ` +
    `novice wins ${Math.round(day.measure.winRate * 100)}% in ${day.measure.winLen}. Dealer v4 (stored).`;
  else $('#t-spoil').textContent = `Fairy piece: ${PIECES[fairyFor(date)].name}. Hand: ${day.pieces.map((p) => PIECES[p.type].name).join(', ')}. ` +
    `Pattern: ${day.patternName} (${describePattern(day)}), ${day.pattern.length} hop${day.pattern.length > 1 ? 's' : ''}. ` +
    `Par ${day.par}. Board ${N} × ${N}. Ground: ${day.ground || (day.rules.crumble ? 'crumble' : 'solid')}. Rabbit eats: ${day.rules.rabbitsEat ?? day.rules.foesCapture ? 'yes' : 'no'}.` +
    (day.version === 1 ? ` Bramble: ${day.bramble.length ? 'yes' : 'no'}. Stumps: ${day.stumps.size}.` : '') +
    ` Dealer v${day.version}.`;
}

$('.topbar .pill').before(soundToggle(), themeToggle());
show('title');
requestAnimationFrame(titleFrame);
fillMenu($('#modes'), 'daily', '');

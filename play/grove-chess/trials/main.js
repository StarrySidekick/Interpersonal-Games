// The piece trials page (Timothy, 2026-10-13): choose an army and a board,
// find the layouts that play balanced and look fun (trials.js does the
// work, on a background thread), watch one played, and play it.

import { $, el, themeToggle } from '../../../engine/ui.js';
import { PIECES, statueKind } from '../rules.js';
import { sprite } from '../board.js';
import { LOOK } from '../config.js';
import { powers } from '../power.js';
import { loadCatalog, registerInvented } from '../invented.js';
import { encodeLevel, defaults } from '../lab.js';
import { fillMenu } from '../menu.js';
import { trialPiece, position, statueOrder, runTrial, runWeave, MEASURE_WORDS, EFFORT } from '../trials.js';

const catalog = loadCatalog();
registerInvented(catalog.invented);

// --- What is asked, kept on this phone between visits. ------------------------

const KEY = 'ig.grove.trials.v1';
const PRESETS = [
  { name: 'The descent’s', army: ['tallrook', 'bishop', 'king', 'knight', 'shortrook'], W: 5, H: 5, facing: 'turned', statueRow: true },
  { name: 'Microchess’s', army: ['rook', 'bishop', 'knight', 'king'], W: 4, H: 5, facing: 'mirror', statueRow: false },
  { name: 'Gardner’s back row', army: ['rook', 'knight', 'bishop', 'queen', 'king'], W: 5, H: 5, facing: 'mirror', statueRow: false },
  { name: 'Los Alamos’s back row', army: ['rook', 'knight', 'queen', 'king', 'knight', 'rook'], W: 6, H: 6, facing: 'mirror', statueRow: false },
  { name: 'Shogi’s generals', army: ['silver', 'gold', 'king', 'gold', 'silver'], W: 5, H: 5, facing: 'turned', statueRow: false }
];
const DEFAULT = { army: PRESETS[0].army, W: 5, H: 5, rows: 1, facing: 'both', statueRow: true, firstCapture: true, mine: true, effort: 'quick', weave: null };
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1) return { ...DEFAULT, ...s.ask, last: s.last || null, lastWeave: s.lastWeave || null }; } catch { /* blocked */ }
  return { ...DEFAULT, last: null, lastWeave: null };
}
const S = load();
function save() {
  const { last, lastWeave, ...ask } = S;
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, ask, last, lastWeave })); } catch { /* storage full or blocked: the page still works */ }
}
// Pieces it knows of only by id, from an earlier visit, that are gone (an
// invention deleted since): left out.
S.army = S.army.filter((k) => trialPiece(k));
if (!S.army.includes('king')) S.army.push('king');

const name = (k) => PIECES[k]?.name || k;
const lower = (k) => name(k).toLowerCase();
const rowsFor = () => (S.army.length > S.W ? 2 : S.rows);
const room = () => S.W * 2;

// --- The army. ------------------------------------------------------------------

const FILTERS = [['all', 'All'], ['classic', 'Classic'], ['fairy', 'Fairy'], ['invented', 'Invented']];
let filter = 'all';

function pieceCanvas(k, side = 'you') {
  const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
  cv.getContext('2d').drawImage(sprite(k, side), 0, 0);
  return cv;
}

function paintArmy() {
  $('#army').replaceChildren(...S.army.map((k, i) => el('button', {
    class: `quiet${k === 'king' ? ' fixed' : ''}`, title: k === 'king' ? 'The King stays' : `Take the ${lower(k)} out`,
    onclick: () => { if (k === 'king') return; S.army.splice(i, 1); changed(); }
  }, pieceCanvas(k), name(k))));
  const pw = powers(S.W, S.H);
  const keys = Object.keys(PIECES).filter(trialPiece).filter((k) => k !== 'king').filter((k) =>
    filter === 'all' || (filter === 'invented' ? PIECES[k].invented : filter === 'fairy' ? PIECES[k].kind === 'fairy' && !PIECES[k].invented : PIECES[k].kind === filter))
    .sort((a, b) => (pw[a]?.power ?? 0) - (pw[b]?.power ?? 0));
  $('#cards').replaceChildren(...keys.map((k) => {
    const n = S.army.filter((t) => t === k).length;
    return el('button', { class: 'pcard', title: PIECES[k].desc, onclick: () => {
      if (S.army.length >= room()) { note(`A side can have at most ${room()} pieces on a board ${S.W} wide (two rows).`); return; }
      S.army.push(k); changed();
    } }, pieceCanvas(k), el('span', {}, el('b', {}, name(k)), el('small', {}, `${PIECES[k].betza || ''}${pw[k] ? ` · power ${pw[k].power}` : ''}${catalog.vetoed.includes(k) ? ' · vetoed' : ''}`)),
    el('span', { class: 'n' }, n ? `×${n}` : ''));
  }));
  if (!keys.length) $('#cards').append(el('p', { class: 'small dim' }, 'Nothing here yet.'));
}

function paintFilters() {
  $('#filters').replaceChildren(...FILTERS.map(([v, label]) => el('button', { class: 'quiet', 'aria-pressed': String(filter === v), onclick: () => { filter = v; paintFilters(); paintArmy(); } }, label)));
  $('#presets').replaceChildren(...PRESETS.map((p) => el('button', { class: 'quiet', onclick: () => {
    Object.assign(S, { army: p.army.slice(), W: p.W, H: p.H, facing: p.facing === 'turned' && S.facing === 'both' ? 'both' : p.facing, statueRow: p.statueRow, rows: 1 });
    changed();
  } }, p.name)));
}

// --- The board and how to look. ----------------------------------------------------

function stepper(key, min, max) {
  return el('span', { class: 'stepper' },
    el('button', { class: 'quiet', 'aria-label': 'Fewer', onclick: () => { S[key] = Math.max(min, S[key] - 1); changed(); } }, '−'),
    el('b', {}, String(S[key])),
    el('button', { class: 'quiet', 'aria-label': 'More', onclick: () => { S[key] = Math.min(max, S[key] + 1); changed(); } }, '+'));
}
function seg(key, options, disabled = false) {
  return el('span', { class: 'seg' }, ...options.map(([v, label]) => el('button', { class: 'quiet', 'aria-pressed': String(S[key] === v), disabled: disabled || null,
    onclick: () => { S[key] = v; changed(); } }, label)));
}
const field = (label, help, control, wide = false) => el('div', { class: `field${wide ? ' wide' : ''}` }, el('span', { class: 'flabel' }, label, help ? el('span', { class: 'fhelp' }, help) : null), control);

function paintFields() {
  const two = S.army.length > S.W, odd = S.H % 2 === 1;
  $('#fields').replaceChildren(
    field('Width', null, stepper('W', 3, 8)),
    field('Height', null, stepper('H', 4, 8)),
    field('Start on', two ? `Two rows: ${S.army.length} pieces do not fit a row ${S.W} wide.` : null,
      seg('rows', [[1, 'The back row'], [2, 'The back two rows']], two), true),
    field('Their side', 'Mirrored: each piece opposite its twin, like chess. Turned: yours read the other way, as if the board were spun round (the descent’s).',
      seg('facing', [['mirror', 'Mirrored'], ['turned', 'Turned'], ['both', 'Try both']]), true),
    field('The middle', odd ? 'A row of statues fills the middle row, and one sinks away every turn, as in the descent.' : 'A row of statues needs a middle row: an odd height.',
      seg('statueRow', [[false, 'Open'], [true, 'A row of statues']], !odd), true),
    field('Nothing taken on the first move', 'Throw out layouts where either side could take something on its very first move (the balance rule since 2026-10-07). If every layout fails it, they are judged anyway, and marked.',
      seg('firstCapture', [[true, 'On'], [false, 'Off']])),
    field('Judge my order too', 'Your army in the order above, centred, always judged, whatever the screen thinks of it.', seg('mine', [[true, 'On'], [false, 'Off']])),
    field('How hard to look', `Quick: up to ${EFFORT.quick.cap} layouts, ${EFFORT.quick.games} games each for the best. Thorough: up to ${EFFORT.thorough.cap}, ${EFFORT.thorough.games} games, slower.`,
      seg('effort', [['quick', 'Quick'], ['thorough', 'Thorough']]), true)
  );
}

function changed() {
  if (S.army.length > room()) S.army = S.army.slice(0, room());
  if (S.H % 2 === 0) S.statueRow = false;
  save(); paintArmy(); paintFields(); paintWeavePick();
}

let noteTimer = null;
function note(t) { $('#progresstext').textContent = t; $('#progress').hidden = false; $('#bar').hidden = true; clearTimeout(noteTimer); noteTimer = setTimeout(() => { if (!busy) $('#progress').hidden = true; }, 3500); }

// --- Asking. -------------------------------------------------------------------------

let busy = false;
const spec = () => ({ army: S.army.slice(), W: S.W, H: S.H, rows: rowsFor(), facing: S.facing, statueRow: S.statueRow && S.H % 2 === 1,
  firstCapture: S.firstCapture, mine: S.mine, effort: S.effort, seed: 1, invented: catalog.invented });

const STAGE = { check: 'Checking every layout', screen: 'A few quick games each', judge: 'Judging the best' };

/** Run a trial or a weave on the background thread (or here, if workers fail). */
function ask(msg) {
  return new Promise((resolve, reject) => {
    busy = true;
    $('#progress').hidden = false; $('#bar').hidden = false; $('#bar').value = 0;
    const progress = (p) => {
      const part = { check: 0, screen: 0.15, judge: 0.4 }[p.stage] ?? 0, span = { check: 0.15, screen: 0.25, judge: 0.6 }[p.stage] ?? 1;
      const one = (part + span * (p.done / Math.max(1, p.total)));
      $('#bar').value = p.armies ? ((p.army - 1) + one) / p.armies : one;
      $('#progresstext').textContent = `${p.armies ? `Army ${p.army} of ${p.armies}. ` : ''}${STAGE[p.stage] || 'Working'}: ${p.done} of ${p.total}.`;
    };
    const done = (out) => { busy = false; $('#progress').hidden = true; resolve(out); };
    try {
      const w = new Worker(new URL('../trials-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => {
        if (data.type === 'progress') return progress(data);
        w.terminate();
        if (data.type === 'done') done(data.out); else { busy = false; reject(new Error(data.message)); }
      };
      w.onerror = (e) => { w.terminate(); e.preventDefault?.(); here(); };
      w.postMessage(msg);
    } catch { here(); }
    // No worker: do it on this thread, after the page has drawn the bar.
    function here() { setTimeout(() => { try { done(msg.weave ? runWeave(msg, progress) : runTrial(msg, progress)); } catch (e) { busy = false; reject(e); } }, 40); }
  });
}

$('#go').onclick = async () => {
  if (busy) return;
  const q = spec();
  $('#go').disabled = true; $('#weavego').disabled = true;
  try { S.last = { spec: q, out: await ask(q), at: new Date().toISOString().slice(0, 10) }; save(); paintResults(); $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  catch (e) { note(`The trial stopped: ${e.message}`); }
  $('#go').disabled = false; $('#weavego').disabled = false;
};

// --- Drawing a layout. -----------------------------------------------------------------

const C = 28, TOP = 12;
/** A board from straight above, its pieces standing on it: { t, s, x, y }. */
function drawBoard(cv, W, H, pieces, statues = new Set(), mark = null) {
  cv.width = W * C; cv.height = H * C + TOP;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = LOOK.rim; g.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    g.fillStyle = (x + y) % 2 === 0 ? LOOK.tileLight : LOOK.tileDark;
    g.fillRect(x * C, TOP + (H - 1 - y) * C, C, C);
  }
  if (mark) for (const [x, y] of mark) { g.fillStyle = 'rgba(236,201,90,.55)'; g.fillRect(x * C, TOP + (H - 1 - y) * C, C, C); }
  const things = [...[...statues].map((sq) => ({ img: sprite(statueKind({}, sq), 'stone'), x: sq % W, y: Math.floor(sq / W) })),
    ...pieces.map((p) => ({ img: sprite(p.t, p.s === 0 ? 'you' : 'foe'), x: p.x, y: p.y }))];
  things.sort((a, b) => b.y - a.y); // the far row first, so nearer pieces stand in front
  for (const t of things) g.drawImage(t.img, t.x * C - 1, TOP + (H - 1 - t.y) * C + C / 2 + 6 - 31);
}

/** The pieces after `plies` moves of a game, and the statues still standing. */
function replayTo(r, plies) {
  const pos = position(r.cells, { W: r.W, H: r.H, rows: r.rows, facing: r.facing, statueRow: r.statueRow });
  const order = r.statueRow ? statueOrder(pos, r.sample.seed) : new Map();
  const ps = pos.pieces.map((p) => ({ ...p, alive: true }));
  let last = null;
  r.sample.moves.slice(0, plies).forEach(([fx, fy, tx, ty]) => {
    const p = ps.find((q) => q.alive && q.x === fx && q.y === fy);
    if (!p) return;
    for (const q of ps) if (q.alive && q.x === tx && q.y === ty) q.alive = false;
    p.x = tx; p.y = ty;
    if (p.t === 'pawn' && ty === (p.s === 0 ? r.H - 1 : 0)) p.t = 'queen';
    last = [[fx, fy], [tx, ty]];
  });
  const open = plies >> 1, statues = new Set([...order].filter(([, k]) => k >= open).map(([sq]) => sq));
  return { pieces: ps.filter((p) => p.alive), statues, last };
}

// --- Results. ---------------------------------------------------------------------------

const VERDICT = { playable: 'Playable', shaky: 'Shaky', broken: 'Broken' };
const facingWord = (f) => (f === 'turned' ? 'theirs turned (yours read the other way)' : 'theirs mirrored (each piece opposite its twin)');
const lineOf = (r) => r.cells.slice(0, r.W).map((t) => (t ? name(t) : 'gap')).join(', ') + (r.rows > 1 ? `; in front: ${r.cells.slice(r.W).map((t) => (t ? name(t) : 'gap')).join(', ')}` : '');

function meters(m) {
  return el('div', {}, ...Object.entries(MEASURE_WORDS).map(([k, [label, help]]) => m[k] == null ? null : el('div', { class: 'meter', title: help },
    el('span', {}, label), el('i', {}, el('span', { style: `width:${m[k]}%` })), el('b', {}, String(m[k])))));
}

function pieceLines(r) {
  return el('ul', { class: 'tight' }, ...Object.entries(r.pieceUse).map(([k, u]) => el('li', {},
    `${name(k)}: moved in ${Math.round(u.moved * 100)}% of games, ${u.moves.toFixed(1)} moves a game, ${u.took.toFixed(2)} captures a game, taken in ${Math.round(u.lost * 100)}%.`)));
}

/** Where the play link goes: the runner, with this layout as the level. */
function playHref(r) {
  const used = new Set(r.cells.filter(Boolean));
  const invented = catalog.invented.filter((p) => used.has(p.id));
  // From today's defaults: settings with no version read as the very first
  // (shields, beacons and needles all off).
  return `../play/?mode=trials#${encodeLevel({ ...defaults(), position: r.fen, statueRow: r.statueRow, darkBrain: 'think', skill: '2', style: 'balanced', maxMoves: 0, cloud: false, showdown: false, ...(invented.length ? { invented } : {}) }, 1)}`;
}

function resultCard(r, i) {
  const cv = el('canvas', { class: 'mini pix' });
  const start = replayTo(r, 0);
  drawBoard(cv, r.W, r.H, start.pieces, start.statues);
  const rec = r.record;
  const watchBox = el('div', { class: 'watch', hidden: true });
  let ply = 0, timer = null;
  const showPly = () => {
    const at = replayTo(r, ply);
    drawBoard(cv, r.W, r.H, at.pieces, at.statues, at.last);
    const n = r.sample.moves.length;
    watchBox.querySelector('span').textContent = ply < n ? `Move ${ply} of ${n}` : r.sample.winner === null ? `Move ${n}: a draw (${r.sample.end === 'repeat' ? 'going round in circles' : r.sample.end === 'bare' ? 'only the Kings left' : 'out of moves'})` : `Move ${n}: the ${r.sample.winner === 0 ? 'first' : 'second'} side takes the King`;
  };
  const stop = () => { clearInterval(timer); timer = null; watchBox.querySelector('.pp').textContent = 'Play'; };
  watchBox.append(
    el('button', { class: 'quiet', 'aria-label': 'Back a move', onclick: () => { stop(); ply = Math.max(0, ply - 1); showPly(); } }, '◀'),
    el('button', { class: 'quiet pp', onclick: () => {
      if (timer) return stop();
      if (ply >= r.sample.moves.length) ply = 0;
      watchBox.querySelector('.pp').textContent = 'Pause';
      timer = setInterval(() => { if (ply >= r.sample.moves.length) return stop(); ply++; showPly(); }, 650);
    } }, 'Play'),
    el('button', { class: 'quiet', 'aria-label': 'On a move', onclick: () => { stop(); ply = Math.min(r.sample.moves.length, ply + 1); showPly(); } }, '▶'),
    el('span', {}, ''));
  return el('div', { class: 'card' },
    el('div', { class: 'result' }, el('div', {}, cv, watchBox),
      el('div', {},
        el('p', { class: 'verdict' }, `Layout ${i + 1} `, el('span', { class: `badge ${r.verdict}` }, VERDICT[r.verdict]), ' ', el('span', { class: 'small dim' }, `fun ${r.fun}`), r.mine ? el('span', { class: 'badge mine', style: 'margin-left:6px' }, 'Your order') : null),
        el('p', { class: 'small', style: 'margin:0 0 6px' }, `Yours, left to right: ${lineOf(r)}; ${facingWord(r.facing)}${r.statueRow ? ', a row of statues between' : ''}.`),
        r.why.length ? el('p', { class: 'small', style: 'margin:0 0 6px;color:var(--warm)' }, r.why.join('; ') + '.') : null,
        meters(r.measures))),
    el('p', { class: 'small dim', style: 'margin:8px 0 2px' },
      `${rec.games} games between equal bots: the first side won ${rec.first}, the second ${rec.second}, ${rec.draws} drawn; ${(rec.avgPlies / 2).toFixed(1)} moves each a game${rec.draws < rec.games ? ' (the decided ones)' : ''}, ${rec.openings} different openings.` +
      (rec.skillShare != null ? ` A bot thinking further ahead scored ${Math.round(rec.skillShare * 100)}% against one that does not.` : '')),
    el('details', {}, el('summary', {}, 'Each piece'), pieceLines(r)),
    el('div', { class: 'row3' },
      el('a', { class: 'btn primary', href: playHref(r), style: 'width:auto;min-height:44px;padding:10px 16px;font-size:14px' }, 'Play it'),
      el('button', { class: 'quiet', onclick: () => { watchBox.hidden = false; ply = 0; showPly(); } }, 'Watch a game'),
      el('button', { class: 'quiet', onclick: () => copy(resultText(r, i)) }, 'Copy')));
}

function headline(out, q) {
  const ok = out.results.filter((r) => r.verdict === 'playable').length;
  const what = `${q.army.map(lower).join(', ')} on ${q.W} by ${q.H}${q.statueRow ? ', with a row of statues' : ''}`;
  const thrown = Object.entries(out.thrown).map(([w, n]) => `${n} because ${w}`).join('; ');
  const lines = [
    el('p', { class: 'verdict' }, ok ? `${ok} of the ${out.results.length} layouts judged look playable.` : out.results.length ? 'None of the layouts judged looks playable.' : 'No layout of these pieces gets through the checks.'),
    el('p', { class: 'small dim' }, `${what}. ${out.considered} layouts to check${out.total && out.total * (q.facing === 'both' ? 2 : 1) > out.considered ? ` (of ${out.total * (q.facing === 'both' ? 2 : 1)} in all)` : ''}; ${out.tried} got through${thrown ? ` (${thrown})` : ''}; the best ${out.results.length} judged in full.`)
  ];
  if (out.relaxed) lines.push(el('p', { class: 'small', style: 'color:var(--warm)' }, 'Every layout lets something be taken on the very first move, so they were judged anyway. A row of statues, a taller board, or the rule off may help.'));
  return el('div', { class: 'card' }, ...lines);
}

function paintResults() {
  const L = S.last;
  if (!L) { $('#results').replaceChildren(); return; }
  $('#results').replaceChildren(headline(L.out, L.spec), ...L.out.results.map(resultCard));
}

// --- Weaving. -------------------------------------------------------------------------

function paintWeavePick() {
  const keys = Object.keys(PIECES).filter(trialPiece).filter((k) => k !== 'king')
    .sort((a, b) => (PIECES[b].invented ? 1 : 0) - (PIECES[a].invented ? 1 : 0) || name(a).localeCompare(name(b)));
  if (!S.weave || !keys.includes(S.weave)) S.weave = keys.find((k) => PIECES[k].invented) || 'tallrook';
  $('#weavepick').replaceChildren(...keys.map((k) => el('option', { value: k, selected: k === S.weave || null }, `${name(k)}${PIECES[k].invented ? ' (invented)' : ''} · ${PIECES[k].betza || ''}`)));
}
$('#weavepick').onchange = () => { S.weave = $('#weavepick').value; save(); };

$('#weavego').onclick = async () => {
  if (busy) return;
  const q = { ...spec(), weave: S.weave };
  if (!q.army.some((k) => k !== 'king' && k !== q.weave) && q.army.length >= q.W * q.rows) { note('Put some other pieces in the army first: the new one is swapped in for them.'); return; }
  $('#go').disabled = true; $('#weavego').disabled = true;
  try { S.lastWeave = { spec: q, out: await ask(q) }; save(); paintWeave(); }
  catch (e) { note(`The weave stopped: ${e.message}`); }
  $('#go').disabled = false; $('#weavego').disabled = false;
};

function paintWeave() {
  const L = S.lastWeave;
  if (!L) { $('#weaveresults').replaceChildren(); return; }
  const fits = L.out.armies.filter((a) => a.best?.verdict === 'playable');
  $('#weaveresults').replaceChildren(
    el('p', { class: 'verdict' }, fits.length ? `The ${lower(L.out.weave)} fits ${fits.length === 1 ? 'one way' : `${fits.length} ways`}.` : `No way of weaving the ${lower(L.out.weave)} into this army looks playable.`),
    ...L.out.armies.map((a) => {
      const box = el('div', { hidden: true });
      return el('div', { style: 'margin:0 0 10px' },
        el('p', { class: 'small', style: 'margin:0' }, el('b', {}, `With ${a.change}: `), a.best ? el('span', { class: `badge ${a.best.verdict}` }, VERDICT[a.best.verdict]) : 'nothing got through the checks', a.best ? ` fun ${a.best.fun}` : '',
          el('span', { class: 'dim' }, ` · ${a.army.map(name).join(', ')}`)),
        a.best ? el('button', { class: 'quiet', style: 'width:auto;min-height:40px;padding:6px 12px;font-size:14px;margin-top:4px', onclick: (e) => {
          box.hidden = !box.hidden; e.target.textContent = box.hidden ? 'Show its layouts' : 'Hide them';
          if (!box.hidden && !box.childNodes.length) box.append(...a.results.map(resultCard));
        } }, 'Show its layouts') : null, box);
    }));
}

// --- Copying out. -----------------------------------------------------------------------

function resultText(r, i) {
  const m = r.measures, rec = r.record;
  return [
    `Layout ${i + 1}: ${VERDICT[r.verdict]}, fun ${r.fun}${r.mine ? ' (your order)' : ''}. ${r.fen}${r.statueRow ? ' with a row of statues' : ''}, ${r.facing}.`,
    `  Yours, left to right: ${lineOf(r)}.`,
    r.why.length ? `  Why: ${r.why.join('; ')}.` : null,
    `  ${Object.entries(MEASURE_WORDS).filter(([k]) => m[k] != null).map(([k, [label]]) => `${label} ${m[k]}`).join(', ')}.`,
    `  ${rec.games} games: first ${rec.first}, second ${rec.second}, drawn ${rec.draws}; ${(rec.avgPlies / 2).toFixed(1)} moves each a game.${rec.skillShare != null ? ` Further-ahead bot scored ${Math.round(rec.skillShare * 100)}%.` : ''}`,
    `  ${Object.entries(r.pieceUse).map(([k, u]) => `${name(k)} moved in ${Math.round(u.moved * 100)}%, ${u.took.toFixed(2)} captures a game`).join('; ')}.`
  ].filter(Boolean).join('\n');
}

function allText() {
  const out = [];
  if (S.last) {
    const q = S.last.spec;
    out.push(`Piece trials (${S.last.at || ''}): ${q.army.map(lower).join(', ')} on ${q.W} by ${q.H}${q.statueRow ? ', a row of statues' : ''}; their side ${q.facing === 'both' ? 'mirrored and turned' : q.facing}; ${q.effort}.`);
    out.push(`${S.last.out.considered} layouts checked, ${S.last.out.tried} through the checks (${Object.entries(S.last.out.thrown).map(([w, n]) => `${n}: ${w}`).join('; ') || 'none thrown out'})${S.last.out.relaxed ? '; every layout failed the first-move rule, judged anyway' : ''}.`);
    S.last.out.results.forEach((r, i) => out.push(resultText(r, i)));
  }
  if (S.lastWeave) {
    out.push('', `Weaving the ${lower(S.lastWeave.out.weave)} into ${S.lastWeave.spec.army.map(lower).join(', ')} on ${S.lastWeave.spec.W} by ${S.lastWeave.spec.H}:`);
    for (const a of S.lastWeave.out.armies) out.push(`- with ${a.change}: ${a.best ? `${VERDICT[a.best.verdict]}, fun ${a.best.fun}, ${a.best.fen}${a.best.why.length ? ` (${a.best.why.join('; ')})` : ''}` : 'nothing got through the checks'}`);
  }
  return out.join('\n') || 'Nothing tried yet.';
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); $('#copynote').textContent = 'Copied.'; }
  catch { $('#copynote').textContent = 'Could not copy here: select the text below instead.'; $('#copynote').after(el('textarea', { style: 'width:100%;min-height:160px' }, text)); }
  setTimeout(() => { $('#copynote').textContent = ''; }, 2500);
}
$('#copyall').onclick = () => copy(allText());

// --- Start. --------------------------------------------------------------------------------

// From the pieces catalog: #weave=<piece> picks the piece to weave in.
const askedWeave = new URLSearchParams(location.hash.slice(1)).get('weave');
if (askedWeave && trialPiece(askedWeave)) { S.weave = askedWeave; save(); }

$('.topbar .pill').before(themeToggle());
fillMenu($('#modes'), 'trials', '../');
paintFilters(); paintArmy(); paintFields(); paintWeavePick(); paintResults(); paintWeave();
if (askedWeave) $('#weavepick').scrollIntoView({ block: 'center' });

// For automated tests.
window.__trials = { settings: () => S, run: () => $('#go').onclick(), weave: () => $('#weavego').onclick() };

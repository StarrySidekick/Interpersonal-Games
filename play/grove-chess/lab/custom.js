// Custom (Timothy, 2026-10-13: "combine all the custom chess setting stuff
// like chaos and piece trials into one central just custom mode where you
// can play a game with custom rules, and also simulate it, or find the most
// playable orientation of pieces within that ruleset and piece set").
//
// The workshop's page already makes a level from any settings and plays it,
// and rolls a Chaos level ("Go crazy"). This module adds the rest:
// - Armies: both sides piece by piece, in order, with suits, theirs
//   mirrored or turned; or dealt from the settings' pools, as before.
// - Simulate: bots play the level as it stands, many times, and say how it
//   plays (trials.js simulate, judge).
// - Find the most playable layout: a trial of the army (trials.js runTrial),
//   or, for a dealt level, the best of many dice rolls (runSeeds).
// - Weave in a piece: swap a new piece in for each kind in the army.
// All of it on a pool of workers (sim-worker.js), as many as the device has
// cores to spare, so the page stays responsive.

import { $, el } from '../../../engine/ui.js';
import { PIECES, statueKind, ghostAt, gateUp, canArm } from '../rules.js';
import { sprite } from '../board.js';
import { LOOK } from '../config.js';
import { powers } from '../power.js';
import { SUITS, WEAPONS, WEAPON_ORDER } from '../run.js';
import { makeLevel, clean, saveLab } from '../lab.js';
import { replayLine } from '../sim.js';
import {
  trialPiece, givenCells, facingCells, cellSettings, runTrial, runWeave, runSeeds, simulate, runJob, MEASURE_WORDS, EFFORT, pieceName, keyOf, asItem
} from '../trials.js';

// --- The workers. ----------------------------------------------------------

let pool = null;
/** Run a job on a free worker; a promise of its result. Falls back to this
    page, a job at a time, where workers cannot start. */
function makePool() {
  const size = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const workers = [], idle = [], queue = [], waiting = new Map();
  let id = 0, broken = false;
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop(), q = queue.shift();
      waiting.set(q.id, { ...q, w });
      w.postMessage({ id: q.id, job: q.job });
    }
  };
  const here = (job) => new Promise((resolve, reject) => setTimeout(() => { try { resolve(runJob(job)); } catch (e) { reject(e); } }, 0));
  try {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../sim-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => {
        const q = waiting.get(data.id);
        waiting.delete(data.id);
        idle.push(w);
        if (q) { if (data.error) q.reject(new Error(data.error)); else q.resolve(data.out); }
        pump();
      };
      w.onerror = (e) => {
        e.preventDefault?.();
        // A worker that cannot start: everything waiting on it runs here.
        broken = true;
        for (const [k, q] of waiting) if (q.w === w) { waiting.delete(k); here(q.job).then(q.resolve, q.reject); }
      };
      workers.push(w); idle.push(w);
    }
  } catch { broken = true; }
  return {
    size,
    run(job) {
      if (broken || !workers.length) return here(job);
      return new Promise((resolve, reject) => { queue.push({ id: ++id, job, resolve, reject }); pump(); });
    },
    stop() { workers.forEach((w) => w.terminate()); }
  };
}

// --- What Custom keeps, with the workshop's notebook. --------------------------

const DEFAULT = {
  on: false, army: [{ t: 'rook' }, { t: 'bishop' }, { t: 'king' }, { t: 'knight' }, { t: 'pawn' }], facing: 'mirror',
  pawnsFront: true, spread: true, findFacing: 'all', firstCapture: true, mine: true, effort: 'quick', weave: null, layout: null
};
// Each with the rules it is played by: a board with nothing on it but the
// armies, unless the game has more (the descent's ghosts, its move limit
// and its showdown).
const PLAIN = { ghosts: false, statueRow: false, statues: 0, gates: 0, clouds: 0, cloud: false, showdown: false, shape: 'rect', holes: 0, ground: 'solid', magic: 'none', geared: false, rabbits: 0 };
const PRESETS = [
  { name: 'The descent’s', army: ['rook', 'bishop', 'king', 'knight', 'pawn'], w: 5, h: 6, facing: 'mirror', rules: { ...PLAIN, ghosts: true, showdown: true, maxMoves: 20 } },
  { name: 'Microchess', army: ['rook', 'bishop', 'knight', 'king', 'pawn'], w: 4, h: 5, facing: 'mirror', rules: { ...PLAIN, maxMoves: 40 } },
  { name: 'Gardner minichess', army: ['rook', 'knight', 'bishop', 'queen', 'king', ...Array(5).fill('pawn')], w: 5, h: 5, facing: 'mirror', rules: { ...PLAIN, maxMoves: 50 } },
  { name: 'Los Alamos', army: ['rook', 'knight', 'queen', 'king', 'knight', 'rook', ...Array(6).fill('pawn')], w: 6, h: 6, facing: 'mirror', rules: { ...PLAIN, maxMoves: 60 } },
  { name: 'Chess', army: ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', ...Array(8).fill('pawn')], w: 8, h: 8, facing: 'mirror', rules: { ...PLAIN, maxMoves: 80 } },
  { name: 'Shogi’s generals', army: ['silver', 'gold', 'king', 'gold', 'silver'], w: 5, h: 6, facing: 'turned', rules: { ...PLAIN, ghosts: true, maxMoves: 40 } }
];
const SUIT_ORDER = [null, ...Object.keys(SUITS)];
const WEAPON_CHOICES = [null, ...WEAPON_ORDER];
const name = (a) => pieceName(keyOf(a));
const key = (a) => keyOf(a);
// Saved before the suits were renamed (2026-10-13): Swords is Vines now,
// Spirals (the swap) is Gears, and Diamonds and Spirits are gone.
const OLD_SUITS = { swords: 'vines', spirals: 'gears', diamonds: null, spirits: null };
const renamed = (a) => { if (!(a.suit in OLD_SUITS)) return a; const { suit, ...b } = a; return OLD_SUITS[suit] ? { ...b, suit: OLD_SUITS[suit] } : b; };
const renamedKey = (k) => (k === '.' ? k : keyOf(renamed(asItem(k))));

/**
 * Mount Custom on the workshop page. `hooks`: lab (the saved workshop),
 * catalog, settings() and seed() (the level now), use(S, seed) (make that
 * the level), play(S, seed) (and play it), note(text).
 */
export function mountCustom(hooks) {
  const { lab, catalog } = hooks;
  const C = lab.custom = { ...DEFAULT, ...(lab.custom || {}) };
  if (!(C.v >= 19)) {
    C.army = (C.army || []).map(renamed);
    if (C.weave) C.weave = renamed(C.weave);
    if (C.layout) C.layout = { ...C.layout, cells: C.layout.cells.map(renamedKey), foeCells: C.layout.foeCells.map(renamedKey) };
    C.v = 19;
  }
  C.army = (C.army || []).filter((a) => trialPiece(a.t)).map((a) => (a.weapon && !canArm(a.t, a.weapon) ? (({ weapon, wl, ...b }) => b)(a) : a));
  if (!C.army.some((a) => a.t === 'king')) C.army.push({ t: 'king' });
  // A level that arrives with both sides square by square (a link, or the
  // one last worked on) keeps them: its layout is the armies.
  const S0 = hooks.settings();
  if (S0.cells && S0.foeCells) {
    const keys = (c, m) => c.map((t, i) => (t ? keyOf({ t, ...m?.[i] }) : '.'));
    C.on = true;
    C.layout = { w: S0.w, h: S0.h, cells: keys(S0.cells, S0.cellMods), foeCells: keys(S0.foeCells, S0.foeCellMods) };
    const army = keys(S0.cells, S0.cellMods).filter((k) => k !== '.').map(asItem);
    if (army.length) C.army = army;
  }
  const save = () => saveLab(lab);
  let picked = null, filter = 'all', busy = false;

  // --- The armies, as level settings. ----------------------------------------

  /** The current settings with the armies in (or taken out). */
  function apply(S) {
    const out = { ...S };
    for (const k of ['cells', 'cellMods', 'foeCells', 'foeCellMods']) delete out[k];
    if (!C.on) return clean(out);
    const W = S.w, rows = C.army.length > W ? 2 : 1;
    if (C.army.length > 2 * W) C.army = C.army.slice(0, 2 * W);
    let cells, foe;
    if (C.layout && C.layout.w === S.w && C.layout.h === S.h) ({ cells, foe } = { cells: C.layout.cells, foe: C.layout.foeCells });
    else {
      C.layout = null;
      cells = givenCells(C.army, W, rows, C.pawnsFront);
      foe = facingCells(cells, W, C.facing);
    }
    return clean({ ...out, ...cellSettings(cells, foe), ...(S.darkBrain === 'possessed' ? { darkBrain: 'think' } : {}), goal: S.goal === 'mix' ? 'king' : S.goal });
  }
  const changed = () => { C.layout = null; save(); paint(); hooks.use(apply(hooks.settings()), hooks.seed()); };

  // --- Drawing. ----------------------------------------------------------------

  const canvas = (t, side = 'you') => { const cv = el('canvas', { class: 'pix', width: 30, height: 36 }); cv.getContext('2d').drawImage(sprite(t, side), 0, 0); return cv; };
  const suitMark = (a) => `${a.suit ? SUITS[a.suit].mark : ''}${a.weapon ? WEAPONS[a.weapon].mark + (a.wl || 1) : ''}`;

  function paintArmy() {
    const box = $('#army');
    box.replaceChildren(...C.army.map((a, i) => el('button', {
      class: 'quiet', 'aria-pressed': String(picked === i), title: `${name(a)}: tap to change`,
      style: a.suit ? `box-shadow: inset 0 -3px 0 ${SUITS[a.suit].colour}` : '',
      onclick: () => { picked = picked === i ? null : i; paint(); }
    }, canvas(a.t), `${suitMark(a)} ${PIECES[a.t].name}`.trim())));
    // The piece picked: its suit, its place in the line, or out.
    const tools = $('#armytools');
    if (picked == null || !C.army[picked]) { tools.hidden = true; return; }
    const a = C.army[picked];
    tools.hidden = false;
    tools.replaceChildren(
      el('p', { class: 'small', style: 'margin:0 0 6px' }, el('b', {}, name(a)), a.t === 'king' ? ' (every army has its one King)' : ''),
      el('div', { class: 'seg' }, ...SUIT_ORDER.map((s) => el('button', { class: 'quiet', 'aria-pressed': String((a.suit || null) === s), title: s ? SUITS[s].desc : 'No suit',
        onclick: () => { if (s) a.suit = s; else delete a.suit; changed(); } }, s ? `${SUITS[s].mark} ${SUITS[s].name}` : 'No suit'))),
      // Its weapon and the weapon's level (2026-10-13). A lance only on a
      // piece that slides.
      el('div', { class: 'seg', style: 'margin-top:6px' }, ...WEAPON_CHOICES.map((w) => el('button', { class: 'quiet', 'aria-pressed': String((a.weapon || null) === w),
        disabled: w && !canArm(a.t, w) || null, title: w ? WEAPONS[w].desc(a.wl || 1) : 'No weapon',
        onclick: () => { if (w) { a.weapon = w; a.wl = a.wl || 1; } else { delete a.weapon; delete a.wl; } changed(); } }, w ? `${WEAPONS[w].mark} ${WEAPONS[w].name}` : 'No weapon'))),
      a.weapon ? el('div', { class: 'seg', style: 'margin-top:6px' }, ...[1, 2, 3].map((lv) => el('button', { class: 'quiet', 'aria-pressed': String((a.wl || 1) === lv), title: WEAPONS[a.weapon].desc(lv),
        onclick: () => { a.wl = lv; changed(); } }, `Level ${lv}`))) : null,
      el('div', { class: 'seg', style: 'margin-top:6px' },
        el('button', { class: 'quiet', disabled: picked === 0 || null, onclick: () => { [C.army[picked - 1], C.army[picked]] = [C.army[picked], C.army[picked - 1]]; picked--; changed(); } }, '◀ Left'),
        el('button', { class: 'quiet', disabled: picked === C.army.length - 1 || null, onclick: () => { [C.army[picked + 1], C.army[picked]] = [C.army[picked], C.army[picked + 1]]; picked++; changed(); } }, 'Right ▶'),
        a.t === 'king' ? null : el('button', { class: 'quiet', onclick: () => { C.army.splice(picked, 1); picked = null; changed(); } }, 'Take it out')));
  }

  function paintCards() {
    const S = hooks.settings(), pw = powers(S.w, S.h);
    const keys = Object.keys(PIECES).filter(trialPiece).filter((k) => k !== 'king').filter((k) =>
      filter === 'all' || (filter === 'invented' ? PIECES[k].invented : filter === 'fairy' ? PIECES[k].kind === 'fairy' && !PIECES[k].invented : PIECES[k].kind === filter))
      .sort((a, b) => (pw[a]?.power ?? 0) - (pw[b]?.power ?? 0));
    $('#armycards').replaceChildren(...keys.map((k) => {
      const n = C.army.filter((a) => a.t === k).length;
      return el('button', { class: 'pcard', title: PIECES[k].desc, onclick: () => {
        if (C.army.length >= 2 * S.w) return hooks.note(`A side can have at most ${2 * S.w} pieces on a board ${S.w} wide (two rows).`);
        C.army.push({ t: k }); changed();
      } }, canvas(k), el('span', {}, el('b', {}, PIECES[k].name), el('small', {}, `${PIECES[k].betza || ''}${pw[k] ? ` · power ${pw[k].power}` : ''}`)),
      el('span', { class: 'n' }, n ? `×${n}` : ''));
    }));
  }

  const seg = (k, opts, after = changed) => el('span', { class: 'seg' }, ...opts.map(([v, label]) => el('button', { class: 'quiet', 'aria-pressed': String(C[k] === v), onclick: () => { C[k] = v; after(); } }, label)));
  const field = (label, help, control) => el('div', { class: 'field wide' }, el('span', { class: 'flabel' }, label, help ? el('span', { class: 'fhelp' }, help) : null), control);
  const quietly = () => { save(); paint(); };

  function paint() {
    $('#armyon').replaceChildren(seg('on', [[false, 'Dealt from the settings'], [true, 'Set square by square']]));
    $('#armybox').hidden = !C.on;
    if (C.on) {
      paintArmy();
      paintCards();
      $('#armyfilters').replaceChildren(...[['all', 'All'], ['classic', 'Classic'], ['fairy', 'Fairy'], ['invented', 'Invented']].map(([v, label]) =>
        el('button', { class: 'quiet', 'aria-pressed': String(filter === v), onclick: () => { filter = v; paintCards(); paintFiltersOnly(); } }, label)));
      $('#armypresets').replaceChildren(...PRESETS.map((p) => el('button', { class: 'quiet', onclick: () => {
        C.army = p.army.map((t) => ({ t })); C.facing = p.facing; C.layout = null; picked = null; save();
        hooks.use(apply(clean({ ...hooks.settings(), w: p.w, h: p.h, ...p.rules })), hooks.seed());
        paint();
      } }, p.name)));
      $('#armyfields').replaceChildren(...[
        field('Their side', 'Mirrored: each piece opposite its twin, like chess. Turned: yours read the other way, as if the board were spun round.', seg('facing', [['mirror', 'Mirrored'], ['turned', 'Turned']])),
        field('Pieces that never move back stand in front', 'As pawns do in chess. Off: your order fills the back row first.', seg('pawnsFront', [[true, 'On'], [false, 'Off']])),
        C.layout?.found ? el('p', { class: 'small', style: 'color:var(--warm);margin:8px 0 0' }, 'Using a layout the search found. Change the army, or ', el('button', { class: 'linkish', onclick: () => { C.layout = null; changed(); } }, 'go back to your order'), '.') : null].filter(Boolean));
    }
    $('#findfields').replaceChildren(...[
      C.on ? field('Their side, when searching', 'Any order: their line need not match yours at all. Try all: mirrored, turned and any.', seg('findFacing', [['mirror', 'Mirrored'], ['turned', 'Turned'], ['any', 'Any order'], ['all', 'Try all']], quietly)) : null,
      field('Nothing taken on the first move', 'Throw out layouts where either side could take something on its very first move. If every layout fails, they are judged anyway, and marked.', seg('firstCapture', [[true, 'On'], [false, 'Off']], quietly)),
      C.on ? field('Same-colour pieces on both colours', 'Two bishops (or anything that keeps to one colour of square) start on different colours, as Chess960 insists.', seg('spread', [[true, 'On'], [false, 'Off']], quietly)) : null,
      C.on ? field('Judge my order too', 'Your army in the order above, always judged, whatever the screen thinks of it.', seg('mine', [[true, 'On'], [false, 'Off']], quietly)) : null,
      field('How hard to look', `Quick: up to ${EFFORT.quick.cap} layouts. Thorough: up to ${EFFORT.thorough.cap}, more games each, and a longer climb. Big boards take longer.`, seg('effort', [['quick', 'Quick'], ['thorough', 'Thorough']], quietly))].filter(Boolean));
    $('#weavebox').hidden = !C.on;
    if (C.on) paintWeavePick();
  }
  const paintFiltersOnly = () => $('#armyfilters').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(['all', 'classic', 'fairy', 'invented'][i] === filter)));

  function paintWeavePick() {
    const keys = Object.keys(PIECES).filter(trialPiece).filter((k) => k !== 'king')
      .sort((a, b) => (PIECES[b].invented ? 1 : 0) - (PIECES[a].invented ? 1 : 0) || PIECES[a].name.localeCompare(PIECES[b].name));
    if (!C.weave || !keys.includes(C.weave.t)) C.weave = { t: keys.find((k) => PIECES[k].invented) || 'tallrook' };
    $('#weavepick').replaceChildren(...keys.map((k) => el('option', { value: k, selected: k === C.weave.t || null }, `${PIECES[k].name}${PIECES[k].invented ? ' (invented)' : ''} · ${PIECES[k].betza || ''}`)));
    $('#weavesuit').replaceChildren(...SUIT_ORDER.map((s) => el('option', { value: s || '', selected: (C.weave.suit || null) === s || null }, s ? `${SUITS[s].mark} ${SUITS[s].name}` : 'No suit')));
  }
  $('#weavepick').onchange = () => { C.weave = { t: $('#weavepick').value, ...(C.weave?.suit ? { suit: C.weave.suit } : {}) }; save(); };
  $('#weavesuit').onchange = () => { const s = $('#weavesuit').value; C.weave = { t: C.weave.t, ...(s ? { suit: s } : {}) }; save(); };

  // --- Asking the workers. -------------------------------------------------------

  const STAGE = { check: 'Checking the layouts', screen: 'A few quick games each', judge: 'Judging the best', simulate: 'Playing it' };
  async function working(label, fn) {
    if (busy) return null;
    busy = true;
    pool = pool || makePool();
    const t0 = Date.now(), bar = $('#custombar'), text = $('#customprogress');
    $('#customwork').hidden = false; bar.value = 0;
    for (const b of ['#simulate', '#find', '#weavego']) $(b).disabled = true;
    const progress = (p) => {
      const part = { check: 0, screen: 0.15, judge: 0.55, simulate: 0.1 }[p.stage] ?? (p.stage?.startsWith('climb') ? 0.35 : 0);
      const span = { check: 0.15, screen: 0.2, judge: 0.45, simulate: 0.9 }[p.stage] ?? (p.stage?.startsWith('climb') ? 0.2 : 0.1);
      const one = part + span * (p.done / Math.max(1, p.total));
      bar.value = p.armies ? ((p.army - 1) + one) / p.armies : one;
      const stage = p.stage?.startsWith('climb') ? `Climbing (round ${p.stage.slice(6)})` : STAGE[p.stage] || 'Working';
      text.textContent = `${label}. ${p.armies ? `Army ${p.army} of ${p.armies}. ` : ''}${stage}: ${p.done} of ${p.total}. ${Math.round((Date.now() - t0) / 1000)} s, on ${pool.size} worker${pool.size > 1 ? 's' : ''}.`;
    };
    try { return await fn((job) => pool.run({ ...job, invented: catalog.invented }), progress); }
    catch (e) { hooks.note(`It stopped: ${e.message}`); return null; }
    finally {
      busy = false; $('#customwork').hidden = true;
      for (const b of ['#simulate', '#find', '#weavego']) $(b).disabled = false;
      lab.customTime = Math.round((Date.now() - t0) / 1000);
    }
  }

  $('#simulate').onclick = async () => {
    const S = hooks.settings(), seed = hooks.seed();
    const out = await working('Simulating this level', (run, post) => simulate(S, seed, {}, run, post));
    if (!out) return;
    C.lastSim = { out, at: new Date().toISOString().slice(0, 10) };
    save();
    $('#customresults').replaceChildren(el('div', { class: 'card' }, el('p', { class: 'verdict' }, 'This level, simulated'),
      el('p', { class: 'small dim' }, `Bots played it as it stands: ${out.record.games} games between equal bots, and some between a bot that looks further ahead and one that does not.`)),
    resultCard(out, 0, { title: 'This level' }));
    $('#customresults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('#find').onclick = async () => {
    const S = hooks.settings();
    const rules = { ...S }; for (const k of ['cells', 'cellMods', 'foeCells', 'foeCellMods']) delete rules[k];
    const rows = C.army.length > S.w ? 2 : 1;
    const out = C.on
      ? await working('Finding the most playable layout', (run, post) => runTrial({ army: C.army, W: S.w, H: S.h, rows, facing: C.findFacing, rules, firstCapture: C.firstCapture,
        pawnsFront: C.pawnsFront, spread: C.spread, mine: C.mine, effort: C.effort, seed: 1, invented: catalog.invented }, run, post))
      : await working('Finding the most playable dice roll', (run, post) => runSeeds(S, { effort: C.effort, firstCapture: C.firstCapture, from: hooks.seed() }, run, post));
    if (!out) return;
    C.lastFind = { out, armyOn: C.on, at: new Date().toISOString().slice(0, 10), what: C.on ? C.army.map(name).join(', ') : 'the settings’ pools' };
    save();
    paintFind();
    $('#customresults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('#weavego').onclick = async () => {
    const S = hooks.settings();
    const rules = { ...S }; for (const k of ['cells', 'cellMods', 'foeCells', 'foeCellMods']) delete rules[k];
    const out = await working(`Weaving in the ${name(C.weave).toLowerCase()}`, (run, post) => runWeave({ army: C.army, weave: C.weave, W: S.w, H: S.h, rows: C.army.length > S.w ? 2 : 1,
      facing: C.findFacing === 'all' ? 'both' : C.findFacing, rules, firstCapture: C.firstCapture, pawnsFront: C.pawnsFront, spread: C.spread, seed: 1, invented: catalog.invented }, run, post));
    if (!out) return;
    C.lastWeave = { out, at: new Date().toISOString().slice(0, 10) };
    save();
    paintWeave();
  };

  // --- Results. ----------------------------------------------------------------------

  const VERDICT = { playable: 'Playable', shaky: 'Shaky', broken: 'Broken' };
  const CELL = 28, TOP = 12;

  /** One state, from straight above, everything standing on it. */
  function drawState(cv, s, mark = null) {
    const { W, H } = s.day;
    cv.width = W * CELL; cv.height = H * CELL + TOP;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = LOOK.rim; g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? LOOK.tileLight : LOOK.tileDark;
      g.fillRect(x * CELL, TOP + (H - 1 - y) * CELL, CELL, CELL);
    }
    if (mark) for (const [x, y] of mark) { g.fillStyle = 'rgba(236,201,90,.55)'; g.fillRect(x * CELL, TOP + (H - 1 - y) * CELL, CELL, CELL); }
    const sq = (q) => ({ x: q % W, y: Math.floor(q / W) }), things = [];
    for (const q of s.day.stumps) if (!s.open?.includes(q)) things.push({ img: sprite(statueKind(s.day, q), 'stone'), ...sq(q) });
    for (const [q] of s.day.ghosts || []) { const o = ghostAt(s, q); if (o) things.push({ img: sprite('ghost', o), ...sq(q) }); }
    for (const [q] of s.day.gates || []) things.push({ img: sprite(gateUp(s, q) ? 'gateUp' : 'gateDown', 'you'), ...sq(q) });
    for (const p of s.pieces) if (!p.taken && p.x >= 0) things.push({ img: sprite(p.type, 'you'), x: p.x, y: p.y });
    for (const f of s.foes) if (!f.taken && f.x >= 0) things.push({ img: sprite(f.brain === 'leader' ? 'rabbit' : f.type, 'foe'), x: f.x, y: f.y });
    for (const c of s.clouds || []) things.push({ img: sprite('cloud'), x: c.x, y: c.y - 0.01, lift: 12 });
    things.sort((a, b) => b.y - a.y);
    for (const t of things) g.drawImage(t.img, Math.round(t.x * CELL - 1), Math.round(TOP + (H - 1 - t.y) * CELL + CELL / 2 + 6 - 31 - (t.lift || 0)));
  }

  function meters(m) {
    return el('div', {}, ...Object.entries(MEASURE_WORDS).map(([k, [label, help]]) => m[k] == null ? null : el('div', { class: 'meter', title: help },
      el('span', {}, label), el('i', {}, el('span', { style: `width:${m[k]}%` })), el('b', {}, String(m[k])))));
  }

  const lineText = (S) => {
    const row = (c, mods, from, n) => c.slice(from, from + n).map((t, i) => (t ? pieceName(keyOf({ t, ...mods?.[from + i] })) : 'gap')).join(', ');
    if (!S.cells) return '';
    const W = S.w, two = S.cells.length > W;
    const facing = S.foeCells.join() === S.cells.join() ? 'theirs mirrored' : S.foeCells.join() === facingCells(S.cells.map((t) => t || '.'), W, 'turned').map((k) => (k === '.' ? null : k)).join() ? 'theirs turned' : `theirs in their own order: ${row(S.foeCells, S.foeCellMods, 0, W)}`;
    return `Yours, left to right: ${row(S.cells, S.cellMods, 0, W)}${two ? `; in front: ${row(S.cells, S.cellMods, W, W)}` : ''}; ${facing}.`;
  };

  function resultCard(r, i, { title = null } = {}) {
    const cv = el('canvas', { class: 'mini pix' });
    let states = null;
    const level = () => makeLevel(r.settings, r.sample.levelSeed ?? r.sample.seed ?? 1);
    drawState(cv, replayLine(level(), []).at(0));
    const watch = el('div', { class: 'watch', hidden: true });
    let ply = 0, timer = null;
    const show = () => {
      states = states || replayLine(level(), r.sample.line);
      const s = states[Math.min(ply, states.length - 1)], st = r.sample.line[ply - 1];
      const prev = states[Math.max(0, ply - 1)];
      const mover = st?.you ? prev.pieces[st.you.p] : st?.foe ? prev.foes[st.foe.k] : null;
      drawState(cv, s, mover && st ? [[mover.x, mover.y], [(st.you || st.foe).x, (st.you || st.foe).y]] : null);
      const n = r.sample.line.length;
      watch.querySelector('span').textContent = ply < n ? `Move ${ply} of ${n}` : r.sample.winner === null ? `Move ${n}: a draw (${({ repeat: 'going round in circles', bare: 'only the Kings left', limit: 'out of moves' })[r.sample.end] || r.sample.end})` : `Move ${n}: ${r.sample.winner === 0 ? 'you' : 'they'} win`;
    };
    const stop = () => { clearInterval(timer); timer = null; watch.querySelector('.pp').textContent = 'Play'; };
    watch.append(
      el('button', { class: 'quiet', 'aria-label': 'Back a move', onclick: () => { stop(); ply = Math.max(0, ply - 1); show(); } }, '◀'),
      el('button', { class: 'quiet pp', onclick: () => {
        if (timer) return stop();
        if (ply >= r.sample.line.length) ply = 0;
        watch.querySelector('.pp').textContent = 'Pause';
        timer = setInterval(() => { if (ply >= r.sample.line.length) return stop(); ply++; show(); }, 600);
      } }, 'Play'),
      el('button', { class: 'quiet', 'aria-label': 'On a move', onclick: () => { stop(); ply = Math.min(r.sample.line.length, ply + 1); show(); } }, '▶'),
      el('span', {}, ''));
    const rec = r.record;
    const ends = Object.entries(rec.ends || {}).filter(([e]) => e !== 'won').map(([e, n]) => `${n} ${({ repeat: 'going round in circles', bare: 'with only the Kings left', limit: 'out of moves' })[e] || e}`).join(', ');
    const seedOf = r.levelSeed ?? 1;
    return el('div', { class: 'card' },
      el('div', { class: 'result' }, el('div', {}, cv, watch),
        el('div', {},
          el('p', { class: 'verdict' }, title || `Layout ${i + 1} `, ' ', el('span', { class: `badge ${r.verdict}` }, VERDICT[r.verdict]), ' ', el('span', { class: 'small dim' }, `fun ${r.fun}`),
            r.mine ? el('span', { class: 'badge mine', style: 'margin-left:6px' }, 'Your order') : null),
          r.settings.cells ? el('p', { class: 'small', style: 'margin:0 0 6px' }, lineText(r.settings)) : el('p', { class: 'small dim', style: 'margin:0 0 6px' }, `Dice roll ${seedOf}.`),
          r.why.length ? el('p', { class: 'small', style: 'margin:0 0 6px;color:var(--warm)' }, r.why.join('; ') + '.') : null,
          meters(r.measures))),
      el('p', { class: 'small dim', style: 'margin:8px 0 2px' },
        `${rec.games} games between equal bots: you (moving first) won ${rec.first}, they won ${rec.second}, ${rec.draws} drawn${ends ? ` (${ends})` : ''}; ${(rec.avgPlies / 2).toFixed(1)} moves each a game, ${rec.openings} different openings.` +
        (rec.skillShare != null ? ` A bot looking further ahead scored ${Math.round(rec.skillShare * 100)}% against one that does not.` : '')),
      el('details', {}, el('summary', {}, 'Each piece'), el('ul', { class: 'tight' }, ...Object.entries(r.pieceUse).map(([k, u]) => el('li', {},
        `${pieceName(k)}: moved in ${Math.round(u.moved * 100)}% of games, ${u.moves.toFixed(1)} moves a game, ${u.took.toFixed(2)} captures a game, taken in ${Math.round(u.lost * 100)}%.`)))),
      el('div', { class: 'row3' },
        title ? null : el('button', { class: 'primary', onclick: () => { load(r); hooks.play(); } }, 'Play it'),
        title ? null : el('button', { class: 'quiet', onclick: () => { load(r); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Use it'),
        el('button', { class: 'quiet', onclick: () => { watch.hidden = false; ply = 0; show(); } }, 'Watch a game'),
        el('button', { class: 'quiet', onclick: () => copy(resultText(r, i)) }, 'Copy')));
  }

  /** Make a result the level on the page. */
  function load(r) {
    if (r.settings.cells) {
      C.on = true;
      C.layout = { found: true, w: r.settings.w, h: r.settings.h, cells: r.cells || r.settings.cells.map((t, i) => (t ? keyOf({ t, ...r.settings.cellMods?.[i] }) : '.')),
        foeCells: r.foeCells || r.settings.foeCells.map((t, i) => (t ? keyOf({ t, ...r.settings.foeCellMods?.[i] }) : '.')) };
      save(); paint();
      hooks.use(apply(clean(r.settings)), r.sample.levelSeed ?? 1);
    } else hooks.use(clean(r.settings), r.levelSeed ?? r.seed ?? 1);
  }

  function paintFind() {
    const L = C.lastFind;
    if (!L) return;
    const out = L.out, ok = out.results.filter((r) => r.verdict === 'playable').length;
    const thrown = Object.entries(out.thrown || {}).map(([w, n]) => `${n} because ${w}`).join('; ');
    const lines = [
      el('p', { class: 'verdict' }, ok ? `${ok} of the ${out.results.length} judged look playable.` : out.results.length ? 'None of the ones judged looks playable.' : 'Nothing got through the checks.'),
      el('p', { class: 'small dim' }, L.armyOn
        ? `${L.what}. ${out.n ? `${out.n.toLocaleString()} ways to stand them${out.total ? ` (${out.total.toLocaleString()} once mirror images count once)` : ''}; ` : ''}${out.considered} checked${out.climbed ? `, ${out.climbed} of them found by climbing from the best` : ''}; ${out.tried} got through${thrown ? ` (${thrown})` : ''}; the best ${out.results.length} judged in full.`
        : `Dealt from the settings: ${out.considered} dice rolls checked, ${out.tried} got through${thrown ? ` (${thrown})` : ''}; the best ${out.results.length} judged in full.`)
    ];
    if (out.relaxed) lines.push(el('p', { class: 'small', style: 'color:var(--warm)' }, 'Every one lets something be taken on the very first move, so they were judged anyway. Ghosts, a row of statues, a taller board, or the rule off may help.'));
    $('#customresults').replaceChildren(el('div', { class: 'card' }, ...lines), ...out.results.map((r, i) => resultCard(r, i)));
  }

  function paintWeave() {
    const L = C.lastWeave;
    if (!L) { $('#weaveresults').replaceChildren(); return; }
    const fits = L.out.armies.filter((a) => a.best?.verdict === 'playable'), w = pieceName(key(L.out.weave)).toLowerCase();
    $('#weaveresults').replaceChildren(
      el('p', { class: 'verdict' }, fits.length ? `The ${w} fits ${fits.length === 1 ? 'one way' : `${fits.length} ways`}.` : `No way of weaving the ${w} into this army looks playable.`),
      ...L.out.armies.map((a) => {
        const box = el('div', { hidden: true });
        return el('div', { style: 'margin:0 0 10px' },
          el('p', { class: 'small', style: 'margin:0' }, el('b', {}, `With ${a.change}: `), a.best ? el('span', { class: `badge ${a.best.verdict}` }, VERDICT[a.best.verdict]) : 'nothing got through the checks', a.best ? ` fun ${a.best.fun}` : '',
            el('span', { class: 'dim' }, ` · ${a.army.map(name).join(', ')}`)),
          a.best ? el('button', { class: 'quiet', style: 'width:auto;min-height:40px;padding:6px 12px;font-size:14px;margin-top:4px', onclick: (e) => {
            box.hidden = !box.hidden; e.target.textContent = box.hidden ? 'Show its layouts' : 'Hide them';
            if (!box.hidden && !box.childNodes.length) box.append(...a.results.map((r, i) => resultCard(r, i)));
          } }, 'Show its layouts') : null, box);
      }));
  }

  // --- Copying out. ------------------------------------------------------------------

  function resultText(r, i) {
    const m = r.measures, rec = r.record;
    return [
      `${r.settings.cells ? `Layout ${i + 1}` : `Dice roll ${r.levelSeed ?? r.seed}`}: ${VERDICT[r.verdict]}, fun ${r.fun}${r.mine ? ' (your order)' : ''}.`,
      r.settings.cells ? `  ${lineText(r.settings)}` : null,
      r.why.length ? `  Why: ${r.why.join('; ')}.` : null,
      `  ${Object.entries(MEASURE_WORDS).filter(([k]) => m[k] != null).map(([k, [label]]) => `${label} ${m[k]}`).join(', ')}.`,
      `  ${rec.games} games: you won ${rec.first}, they won ${rec.second}, drawn ${rec.draws}${Object.keys(rec.ends || {}).length ? ` ${JSON.stringify(rec.ends)}` : ''}; ${(rec.avgPlies / 2).toFixed(1)} moves each a game.${rec.skillShare != null ? ` Further-ahead bot scored ${Math.round(rec.skillShare * 100)}%.` : ''}`,
      `  ${Object.entries(r.pieceUse).map(([k, u]) => `${pieceName(k)} moved in ${Math.round(u.moved * 100)}%, ${u.took.toFixed(2)} captures a game`).join('; ')}.`
    ].filter(Boolean).join('\n');
  }
  function allText() {
    const out = [];
    if (C.lastFind) {
      out.push(`Custom, finding the most playable layout (${C.lastFind.at}): ${C.lastFind.what}.`);
      C.lastFind.out.results.forEach((r, i) => out.push(resultText(r, i)));
    }
    if (C.lastWeave) {
      out.push('', `Weaving the ${pieceName(key(C.lastWeave.out.weave)).toLowerCase()} in:`);
      for (const a of C.lastWeave.out.armies) out.push(`- with ${a.change}: ${a.best ? `${VERDICT[a.best.verdict]}, fun ${a.best.fun}${a.best.why.length ? ` (${a.best.why.join('; ')})` : ''}` : 'nothing got through the checks'}`);
    }
    if (C.lastSim) out.push('', 'This level, simulated:', resultText(C.lastSim.out, 0));
    return out.join('\n') || 'Nothing tried yet.';
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); hooks.note('Copied.'); }
    catch { hooks.note('Could not reach the clipboard here.'); }
  }
  $('#customcopy').onclick = () => copy(allText());

  // From the pieces catalog: #weave=<piece> picks the piece to weave in.
  const askedWeave = new URLSearchParams(location.hash.slice(1)).get('weave');
  if (askedWeave && trialPiece(askedWeave)) { C.weave = { t: askedWeave }; C.on = true; save(); }

  paint();
  if (C.lastFind) paintFind();
  else if (C.lastSim) $('#customresults').replaceChildren(resultCard(C.lastSim.out, 0, { title: 'This level' }));
  paintWeave();
  if (askedWeave) setTimeout(() => $('#weavebox').scrollIntoView({ block: 'center' }), 300);
  return { apply, paint };
}

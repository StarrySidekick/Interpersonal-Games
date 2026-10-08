// The pieces catalog: every piece, its moves, strength and history; your
// vetoes and notes on each; pieces you invent; and a way to copy it all out.

import { $, el, themeToggle } from '../../../engine/ui.js';
import { soundToggle } from '../../../engine/sound.js';
import { Mesh, makeTarget, render } from '../../../engine/lowpoly.js';
import { PIECES, descOf } from '../rules.js';
import { model } from '../models.js';
import { sprite, diagram } from '../board.js';
import { patentLines } from '../sheet.js';
import { HISTORY } from '../history.js';
import { betzaMoves, patent, mobility } from '../betza.js';
import { loadCatalog, saveCatalog, registerInvented, betzaError, estimateStrength, newId } from '../invented.js';
import { encodeLevel, defaults, clean } from '../lab.js';
import { fillMenu } from '../menu.js';

const cat = loadCatalog();
registerInvented(cat.invented);
const save = () => saveCatalog(cat);
const KIND = { classic: 'Classic', fairy: 'Fairy', special: "Grove Chess's own", quarry: "Grove Chess's own" };
const list = () => Object.keys(PIECES);

// --- The grid. -------------------------------------------------------------

const FILTERS = [['all', 'All'], ['classic', 'Classic'], ['fairy', 'Fairy'], ['invented', 'Invented'], ['vetoed', 'Vetoed'], ['notes', 'With notes']];
let filter = 'all';

function shown(k) {
  const P = PIECES[k];
  if (filter === 'classic') return P.kind === 'classic';
  if (filter === 'fairy') return P.kind === 'fairy' && !P.invented;
  if (filter === 'invented') return !!P.invented;
  if (filter === 'vetoed') return cat.vetoed.includes(k);
  if (filter === 'notes') return !!cat.notes[k];
  return true;
}

function paintFilters() {
  $('#filters').replaceChildren(...FILTERS.map(([v, label]) => el('button', { class: 'quiet', 'aria-pressed': String(filter === v),
    onclick: () => { filter = v; paintFilters(); paintCards(); } }, label)));
}

function paintCards() {
  const keys = list().filter(shown).sort((a, b) => (PIECES[a].strength ?? 0) - (PIECES[b].strength ?? 0));
  $('#cards').replaceChildren(...keys.map((k) => {
    const P = PIECES[k], cv = el('canvas', { class: 'pix', width: 30, height: 36 });
    cv.getContext('2d').drawImage(sprite(k, k === 'rabbit' ? 'foe' : 'you'), 0, 0);
    return el('button', { class: `pcard${cat.vetoed.includes(k) ? ' vetoed' : ''}`, onclick: () => open(k) }, cv,
      el('span', {}, el('b', {}, P.name), el('small', {}, `${P.invented ? 'Invented' : KIND[P.kind]}${P.strength ? ` · ${P.strength}` : ''}${P.betza ? ` · ${P.betza}` : ''}`),
        cat.notes[k] ? el('small', { class: 'note-dot' }, ' · noted') : null));
  }));
  if (!keys.length) $('#cards').append(el('p', { class: 'small dim' }, 'Nothing here yet.'));
}

// --- One piece. ------------------------------------------------------------

let current = null, side = 'you', spinning = false;
const target = makeTarget(48, 56);

function spin(ts) {
  if (!$('#detail').open || !current) { spinning = false; return; }
  const mesh = new Mesh().add(model(current, side), 0, 0, 0, 1);
  render(target, mesh, { yaw: ts / 1400, pitch: 0.4, scale: 3, cx: 24, cy: 49 });
  $('#d-model').getContext('2d').putImageData(target.img, 0, 0);
  requestAnimationFrame(spin);
}

function open(k) {
  current = k; side = k === 'rabbit' ? 'foe' : 'you';
  const P = PIECES[k];
  $('#d-name').textContent = P.name;
  $('#d-diagram').replaceChildren(k === 'rabbit' ? el('span') : diagram(k, { ballMove: 'putt' }));
  $('#d-desc').textContent = descOf(k, { ballMove: 'putt' });
  const mob = P.betza ? mobility(P.moves, 8).toFixed(1) : null;
  $('#d-facts').replaceChildren(
    el('p', { style: 'margin:0 0 4px' }, `${P.invented ? 'Invented' : KIND[P.kind]}${P.strength ? ` · strength about ${P.strength} pawns${P.invented ? ' (estimated from its moves)' : ''}` : ''}${mob ? ` · reaches ${mob} squares on an empty 8 × 8 board, on average` : ''}.`),
    ...patentLines(k).slice(0, 1).map((l) => el('p', { style: 'margin:0 0 4px' }, l)),
    P.origin ? el('p', { style: 'margin:0' }, P.origin) : null);
  $('#d-history').textContent = HISTORY[k] || (P.invented ? P.desc : 'No history written yet.');
  $('#d-note').value = cat.notes[k] || '';
  paintVeto();
  $('#d-side').hidden = k === 'rabbit' || k === 'ball';
  $('#d-side').textContent = 'Show theirs';
  $('#d-remove').hidden = !P.invented;
  $('#d-chaos').hidden = k === 'rabbit' || k === 'ball';
  $('#detail').showModal();
  if (!spinning) { spinning = true; requestAnimationFrame(spin); }
}

function paintVeto() {
  const v = cat.vetoed.includes(current);
  $('#d-veto').textContent = v ? 'Vetoed: let it back in' : 'Keep it out of the game';
  $('#d-veto').setAttribute('aria-pressed', String(v));
}

$('#d-close').onclick = () => $('#detail').close();
$('#detail').addEventListener('close', () => { current = null; paintCards(); });
$('#d-side').onclick = () => { side = side === 'you' ? 'foe' : 'you'; $('#d-side').textContent = side === 'you' ? 'Show theirs' : 'Show yours'; };
$('#d-veto').onclick = () => {
  cat.vetoed = cat.vetoed.includes(current) ? cat.vetoed.filter((k) => k !== current) : [...cat.vetoed, current];
  save(); paintVeto();
};
$('#d-note').addEventListener('input', () => {
  const t = $('#d-note').value.trim();
  if (t) cat.notes[current] = t; else delete cat.notes[current];
  save();
});
$('#d-remove').onclick = () => {
  if (!confirm(`Delete ${PIECES[current].name}? Levels that used it will deal something else.`)) return;
  cat.invented = cat.invented.filter((p) => p.id !== current);
  cat.vetoed = cat.vetoed.filter((k) => k !== current);
  delete cat.notes[current];
  delete PIECES[current];
  save(); $('#detail').close();
};
// Chaos with this piece in your hand and theirs.
$('#d-chaos').onclick = () => {
  const S = clean({ ...defaults(), minePool: [current, 'knight', 'rook'], foePool: [current, 'king', 'bishop'], invented: cat.invented });
  location.href = `../lab/#${encodeLevel(S, 1 + Math.floor(Math.random() * 1e9))}`;
};

// --- Inventing. ------------------------------------------------------------

const looks = list().filter((k) => !PIECES[k].invented && k !== 'rabbit');
$('#inv-look').replaceChildren(...looks.map((k) => el('option', { value: k }, PIECES[k].name)));
$('#inv-look').value = 'squirrel';

function previewInvent() {
  const code = $('#inv-code').value.trim(), err = betzaError(code);
  $('#inv-err').textContent = code ? err || '' : '';
  $('#inv-diagram').replaceChildren();
  $('#inv-patent').textContent = '';
  if (!code || err) return;
  // A temporary piece, to draw its diagram the way every piece's is drawn.
  PIECES['x-preview'] = { name: 'Preview', kind: 'fairy', invented: true, tier: 0, value: 1, betza: code, moves: betzaMoves(code) };
  $('#inv-diagram').append(diagram('x-preview'));
  delete PIECES['x-preview'];
  const t = patent(code);
  $('#inv-patent').textContent = `${t.shapes.join('; ')}. It ${t.travel}, captures ${t.captures}${t.notes.length ? `; it ${t.notes.join(', ')}` : ''}. Strength about ${estimateStrength(code)} pawns.`;
}
$('#inv-code').addEventListener('input', previewInvent);

$('#inv-save').onclick = () => {
  const name = $('#inv-name').value.trim(), code = $('#inv-code').value.trim(), err = betzaError(code);
  if (!name) { $('#inv-err').textContent = 'Give it a name.'; return; }
  if (err) { $('#inv-err').textContent = err; return; }
  const id = newId(name, new Set(list()));
  cat.invented.push({ id, name, betza: code, look: $('#inv-look').value, desc: $('#inv-desc').value.trim() });
  registerInvented(cat.invented);
  save();
  $('#inv-name').value = ''; $('#inv-code').value = ''; $('#inv-desc').value = '';
  previewInvent();
  filter = 'invented'; paintFilters(); paintCards();
  open(id);
};

// --- Copying out, and back in. ---------------------------------------------

function exportText() {
  const lines = ['Grove Chess: notes from the pieces catalog', ''];
  if (cat.vetoed.length) lines.push(`Vetoed (kept out of the game): ${cat.vetoed.map((k) => PIECES[k]?.name || k).join(', ')}.`, '');
  const noted = Object.entries(cat.notes);
  if (noted.length) { lines.push('Notes on how pieces should change:'); for (const [k, t] of noted) lines.push(`- ${PIECES[k]?.name || k} (${PIECES[k]?.betza || '?'}): ${t}`); lines.push(''); }
  if (cat.invented.length) { lines.push('Invented pieces:'); for (const p of cat.invented) lines.push(`- ${p.name}: Betza ${p.betza}, looks like a ${PIECES[p.look]?.name.toLowerCase() || p.look}. ${p.desc}`); lines.push(''); }
  lines.push('Data:', JSON.stringify({ version: 1, vetoed: cat.vetoed, notes: cat.notes, invented: cat.invented }));
  return lines.join('\n');
}

$('#copy').onclick = async () => {
  try { await navigator.clipboard.writeText(exportText()); $('#copynote').textContent = 'Copied.'; }
  catch { $('#copynote').textContent = 'Could not reach the clipboard; here it is:'; $('#importbox').hidden = false; $('#import-text').value = exportText(); }
};
$('#import-open').onclick = () => { $('#importbox').hidden = !$('#importbox').hidden; };
$('#import-go').onclick = () => {
  const text = $('#import-text').value, at = text.lastIndexOf('{"version"');
  try {
    const d = JSON.parse(at >= 0 ? text.slice(at) : text);
    cat.vetoed = [...new Set([...cat.vetoed, ...(d.vetoed || [])])];
    cat.notes = { ...cat.notes, ...(d.notes || {}) };
    const have = new Set(cat.invented.map((p) => p.id));
    cat.invented.push(...(d.invented || []).filter((p) => !have.has(p.id)));
    registerInvented(cat.invented);
    save(); paintCards();
    $('#copynote').textContent = 'Brought in.';
  } catch { $('#copynote').textContent = 'That did not read as a copied export.'; }
};

$('.topbar .pill').before(soundToggle(), themeToggle());
fillMenu($('#modes'), 'pieces', '../');
paintFilters();
paintCards();

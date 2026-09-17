// The place.
//
// Priority 1 in INTENT.md: render the environment the games take place in.
// This is a first render, not the finished growth system in priority 3 — it
// draws from what already accrues rather than inventing a new schema.
//
// record.js is explicit that a sitting's `data` is deliberately not schema'd
// across games ("the meta space isn't designed yet"), so this file never
// reads it. The one thing every sitting can be trusted to have, whichever
// game logged it, is that it happened — that is the unit the place grows by,
// and it is why a new game will make the clearing grow without this file
// changing at all.

import { load } from '../engine/record.js';
import { rng, shuffled } from '../engine/seed.js';
import { $, el, relativeDay } from '../engine/ui.js';

const TREE_SLOTS = 7;
const FLOWER_SLOTS = 18;

function boot() {
  const sittings = load().sittings.slice().sort((a, b) => a.endedAt - b.endedAt);
  const total = sittings.length;
  const firstPlayed = total ? sittings[0].startedAt : null;
  const lastPlayed = total ? sittings[total - 1].endedAt : null;

  renderScene(total);
  renderStats(total, firstPlayed, lastPlayed);
}

// --- the scene ---------------------------------------------------------

function renderScene(total) {
  const grown = Math.min(total, TREE_SLOTS);
  const flowers = Math.max(0, Math.min(total - TREE_SLOTS, FLOWER_SLOTS));
  const overflow = Math.max(0, total - TREE_SLOTS - FLOWER_SLOTS);
  const awake = total > 0;

  // Fixed layout, not a room code: this view belongs to one phone and one
  // record, and the clearing should look the same on the next reload rather
  // than reshuffling itself. shuffled() only decides the ORDER trees fill in
  // as sittings accrue — their positions on the ground never move.
  const rand = rng('the-place|v1');
  const fillOrder = shuffled([...Array(TREE_SLOTS).keys()], rand);
  const grownSlots = new Set(fillOrder.slice(0, grown));

  const trees = [];
  for (let slot = 0; slot < TREE_SLOTS; slot++) {
    trees.push(tree(slot, grownSlots.has(slot), rand));
  }
  const bed = [];
  for (let i = 0; i < flowers; i++) bed.push(flower(rand));

  const label = awake
    ? `A clearing with ${grown} of ${TREE_SLOTS} trees grown back${flowers ? ` and ${flowers} flowers in the bed` : ''}.`
    : 'A bare, quiet clearing. Nothing has grown here yet.';

  $('#scene').innerHTML = `
    <svg viewBox="0 0 400 220" role="img" aria-label="${label}">
      <defs>
        <radialGradient id="p-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#cfe0ff" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#cfe0ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle class="p-moon-glow" cx="332" cy="36" r="50"/>
      <circle class="p-moon" cx="332" cy="36" r="9"/>
      ${stars(rand)}
      <path class="p-ground-far" d="M0,152 Q90,130 180,150 T400,142 V220 H0 Z"/>
      <path class="p-ground-near" d="M0,170 Q110,152 220,168 T400,160 V220 H0 Z"/>
      ${trees.join('')}
      ${bed.join('')}
      ${pet(awake, rand)}
    </svg>`;

  $('#scene-caption').textContent = awake
    ? sceneCaption(grown, flowers, overflow)
    : 'Still bare. Play a round with someone and something will take.';
}

function tree(slot, grown, rand) {
  const x = 26 + slot * (348 / (TREE_SLOTS - 1)) + (rand() - 0.5) * 16;
  const y = 176 + (rand() - 0.5) * 8;
  const h = grown ? 34 + rand() * 14 : 20 + rand() * 10;

  if (!grown) {
    // Bare — a trunk and two thin twigs, nothing to show for it yet.
    const lean = (rand() - 0.5) * 8;
    return `
      <line class="p-trunk-bare" x1="${x}" y1="${y}" x2="${x + lean}" y2="${y - h}"/>
      <line class="p-twig" x1="${x + lean * 0.6}" y1="${y - h * 0.6}" x2="${x + lean * 0.6 - 9}" y2="${y - h * 0.6 - 7}"/>
      <line class="p-twig" x1="${x + lean * 0.8}" y1="${y - h * 0.8}" x2="${x + lean * 0.8 + 8}" y2="${y - h * 0.8 - 7}"/>`;
  }

  // Grown — a trunk and a small cluster of foliage, sized and dropped
  // slightly differently per tree so seven trees don't read as one stamp.
  const r = 15 + rand() * 6;
  const cx = x, cy = y - h;
  return `
    <line class="p-trunk" x1="${x}" y1="${y}" x2="${x}" y2="${cy + r * 0.4}"/>
    <circle class="p-foliage" cx="${cx - r * 0.4}" cy="${cy + r * 0.15}" r="${r * 0.7}"/>
    <circle class="p-foliage" cx="${cx + r * 0.45}" cy="${cy + r * 0.1}" r="${r * 0.72}"/>
    <circle class="p-foliage" cx="${cx}" cy="${cy - r * 0.3}" r="${r}"/>`;
}

function flower(rand) {
  const x = 18 + rand() * 364;
  const y = 196 + rand() * 16;
  const r = 2.2 + rand() * 1.6;
  return `<circle class="p-flower" cx="${x}" cy="${y}" r="${r}"/>`;
}

function stars(rand) {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const x = rand() * 400;
    const y = rand() * 90;
    const r = 0.6 + rand() * 1.1;
    out += `<circle class="p-star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
  }
  return out;
}

/** The PET. Curled up and dim until the first sitting; awake after. */
function pet(awake, rand) {
  const cx = 96, cy = 190;
  const eyes = awake
    ? `<circle class="p-pet-eye" cx="${cx - 5}" cy="${cy - 3}" r="1.6"/>
       <circle class="p-pet-eye" cx="${cx + 5}" cy="${cy - 3}" r="1.6"/>`
    : `<line class="p-pet-eye-shut" x1="${cx - 7}" y1="${cy - 3}" x2="${cx - 2}" y2="${cy - 3}"/>
       <line class="p-pet-eye-shut" x1="${cx + 2}" y1="${cy - 3}" x2="${cx + 7}" y2="${cy - 3}"/>`;
  return `
    <g class="${awake ? 'p-pet p-pet-awake' : 'p-pet p-pet-asleep'}">
      <ellipse cx="${cx}" cy="${cy}" rx="16" ry="12"/>
      <circle cx="${cx - 8}" cy="${cy - 9}" r="3.4"/>
      <circle cx="${cx + 8}" cy="${cy - 9}" r="3.4"/>
      ${eyes}
    </g>`;
}

function sceneCaption(grown, flowers, overflow) {
  if (grown < TREE_SLOTS) {
    return `${grown} of ${TREE_SLOTS} trees back. Every finished sitting brings one more.`;
  }
  if (flowers === 0) {
    return 'Every tree is back. The next sitting starts the garden bed.';
  }
  const more = overflow ? `, and ${overflow} more sitting${overflow === 1 ? '' : 's'} it doesn't have room to draw` : '';
  return `All seven trees are back, and ${flowers} flower${flowers === 1 ? '' : 's'} in the bed${more}.`;
}

// --- the record, in words -----------------------------------------------

function renderStats(total, firstPlayed, lastPlayed) {
  const card = $('#stats');
  const empty = $('#empty');
  if (!total) {
    card.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  card.hidden = false;
  card.replaceChildren(
    stat('Sittings here', String(total)),
    stat('First time', relativeDay(firstPlayed) || '—'),
    stat('Last time', relativeDay(lastPlayed) || '—')
  );
}

function stat(label, value) {
  return el('div', { class: 'stat' },
    el('span', { class: 'dim' }, label), el('b', {}, value));
}

boot();

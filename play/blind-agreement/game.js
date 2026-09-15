// Blind Agreement.
//
// Pure coordination: you both have to land on the same option, with nothing
// agreed in advance about which. There is no connection between the two
// phones — the seed makes the boards identical, and the call does the rest.

import { rng, shuffled, newRoomCode, normalizeCode } from '../../engine/seed.js';
import { logSitting, blindAgreementStats } from '../../engine/record.js';
import { $, el, show, keepAwake, haptic, relativeDay } from '../../engine/ui.js';

const GAME = 'blind-agreement';
const LAST_CODE = 'ig.lastCode';

let boards = [];

const game = {
  code: '', order: [], roundNo: 0,
  board: null, options: [], gone: new Set(), myPick: null, passes: 0,
  rounds: [], startedAt: 0,
  solo: false, soloTheirs: null // INTENT.md priority 2 — solo testing, below
};

// --- setup -----------------------------------------------------------------

async function boot() {
  keepAwake();
  const res = await fetch('../../data/blind-agreement.json');
  boards = (await res.json()).boards;

  const saved = localStorage.getItem(LAST_CODE);
  $('#code').value = saved || '';

  $('#suggest').onclick = () => { $('#code').value = newRoomCode(); };
  $('#start').onclick = startSitting;
  $('#practice').onclick = startSoloSitting;
  $('#lock').onclick = lockIn;
  $('#matched').onclick = () => resolveRound(true);
  $('#missed').onclick = () => { renderTheirs(); show('miss'); };
  $('#solo-continue').onclick = soloContinue;
  $('#next').onclick = nextRound;
  $('#end').onclick = endSitting;
  $('#again').onclick = () => show('setup');

  show('setup');
}

function startSitting() {
  const code = normalizeCode($('#code').value) || normalizeCode(newRoomCode());
  localStorage.setItem(LAST_CODE, code);

  game.code = code;
  game.solo = false;
  // One deterministic board order for the whole sitting, so round N is the
  // same board on both phones however long you play.
  game.order = shuffled(boards, rng(`${code}|order`));
  game.roundNo = 0;
  game.rounds = [];
  game.startedAt = Date.now();

  nextRound();
}

/**
 * INTENT.md priority 2 — solo testing. There's no code to type and nothing is
 * ever saved: a practice sitting has to be unmistakably not the real thing, or
 * it starts leaking fake progress into the record and the place it feeds.
 * A fresh code every time, never touching LAST_CODE, so practice can never
 * collide with — or quietly overwrite — the code you actually share.
 */
function startSoloSitting() {
  const code = normalizeCode(newRoomCode());
  game.code = code;
  game.solo = true;
  game.order = shuffled(boards, rng(`${code}|order`));
  game.roundNo = 0;
  game.rounds = [];
  game.startedAt = Date.now();

  nextRound();
}

// --- a round ---------------------------------------------------------------

function nextRound() {
  game.board = game.order[game.roundNo % game.order.length];
  game.options = shuffled(game.board.options, rng(`${game.code}|opts|${game.roundNo}`));
  game.gone = new Set();
  game.myPick = null;
  game.passes = 0;

  $('#prompt').textContent = game.board.prompt;
  renderBoard();
  updateStatus();
  show('pick');
}

function renderBoard() {
  const board = $('#board');
  board.replaceChildren(...game.options.map((label, i) => {
    const gone = game.gone.has(i);
    return el('button', {
      class: `opt${gone ? ' gone' : ''}`,
      'aria-pressed': game.myPick === i,
      disabled: gone,
      onclick: () => selectOption(i)
    }, label);
  }));
  $('#lock').disabled = game.myPick === null;
}

function selectOption(i) {
  game.myPick = i;
  haptic(8);
  renderBoard();
}

function lockIn() {
  game.passes += 1;
  $('#mypick').textContent = game.options[game.myPick];
  updateStatus();
  haptic([14, 60, 14]);
  if (game.solo) { soloReveal(); return; }
  show('say');
}

// --- practice: a simulated partner ------------------------------------------
//
// A real round needs two independent choices, and one person genuinely can't
// make two of those — whichever you "pick for them" is never actually blind
// to your own pick. So practice doesn't ask you to pretend; it deals a second,
// real, independently-drawn choice from the seed, weighted toward matching
// yours so a practice sitting doesn't run forever, and shows you both.

function weightedBotPick(candidates, favor) {
  const draw = rng(`${game.code}|bot|${game.roundNo}|${game.passes}`);
  const weights = candidates.map((i) => (i === favor ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = draw() * total;
  for (let k = 0; k < candidates.length; k++) {
    r -= weights[k];
    if (r <= 0) return candidates[k];
  }
  return candidates[candidates.length - 1];
}

function soloReveal() {
  const candidates = game.options.map((_, i) => i).filter((i) => !game.gone.has(i));
  game.soloTheirs = weightedBotPick(candidates, game.myPick);

  $('#solo-mine').textContent = game.options[game.myPick];
  $('#solo-theirs').textContent = game.options[game.soloTheirs];
  $('#solo-outcome').textContent = game.soloTheirs === game.myPick
    ? 'Matched.' : 'Missed — both come off the board.';
  show('solo');
}

function soloContinue() {
  if (game.soloTheirs === game.myPick) resolveRound(true);
  else strikeBoth(game.soloTheirs);
}

function renderTheirs() {
  const board = $('#board-theirs');
  const choices = game.options
    .map((label, i) => ({ label, i }))
    .filter(({ i }) => !game.gone.has(i) && i !== game.myPick);

  board.replaceChildren(...choices.map(({ label, i }) => el('button', {
    class: 'opt',
    onclick: () => strikeBoth(i)
  }, label)));
}

/** A miss removes both picks — that shrinking board is the whole shape. */
function strikeBoth(theirs) {
  game.gone.add(game.myPick);
  game.gone.add(theirs);
  game.myPick = null;
  haptic(20);

  const left = game.options.length - game.gone.size;

  if (left === 0) {
    resolveRound(false);          // Down to two, and you split them. Bust.
  } else if (left === 1) {
    game.passes += 1;
    resolveRound(true, true);     // Only one option survives. Forced match.
  } else {
    renderBoard();
    updateStatus();
    show('pick');
  }
}

function resolveRound(matched, forced = false) {
  game.rounds.push({
    board: game.board.id,
    passes: game.passes,
    matched,
    forced
  });
  game.roundNo += 1;

  $('#round-score').textContent = matched ? game.passes : '—';
  if (!matched) {
    $('#round-line').textContent = 'Nothing left to agree on.';
    $('#round-sub').textContent = 'You took the last two options in opposite directions.';
  } else if (forced) {
    $('#round-line').textContent = 'By elimination.';
    $('#round-sub').textContent = 'One option left standing. It counts, technically.';
  } else {
    $('#round-line').textContent = passLine(game.passes);
    $('#round-sub').textContent =
      game.passes === 1 ? '' : `${game.passes} passes.`;
  }

  updateStatus();
  show('round');
}

function passLine(passes) {
  if (passes === 1) return 'Straight away.';
  if (passes === 2) return 'Second pass. Respectable.';
  if (passes === 3) return 'Took a bit of work.';
  return 'Eventually.';
}

function updateStatus() {
  const pass = game.passes ? ` · pass ${game.passes}` : '';
  const prefix = game.solo ? 'Practice · ' : '';
  $('#status').textContent = `${prefix}Round ${game.roundNo + 1}${pass}`;
}

// --- end -------------------------------------------------------------------

function endSitting() {
  const matched = game.rounds.filter((r) => r.matched);
  const avg = matched.length
    ? (matched.reduce((n, r) => n + r.passes, 0) / matched.length).toFixed(1)
    : null;

  if (game.solo) {
    // Never logged — a practice sitting must never accrue toward the real
    // record or the place it feeds. See startSoloSitting().
    $('#done-heading').textContent = 'Good practice.';
    $('#done-note').textContent = 'Nothing here was saved — practice sittings '
      + "don't touch the record.";
    $('#summary').replaceChildren(
      stat('Practice rounds', String(game.rounds.length)),
      stat('Matched', `${matched.length} of ${game.rounds.length}`),
      stat('Average passes', avg ?? '—')
    );
    show('done');
    return;
  }

  if (game.rounds.length) {
    logSitting({
      game: GAME,
      startedAt: game.startedAt,
      data: { code: game.code, rounds: game.rounds }
    });
  }

  const all = blindAgreementStats();

  $('#done-heading').textContent = 'Good sitting.';
  $('#done-note').textContent = 'Saved to this phone only. Nothing was sent anywhere.';
  $('#summary').replaceChildren(
    stat('Rounds tonight', String(game.rounds.length)),
    stat('Matched', `${matched.length} of ${game.rounds.length}`),
    stat('Average passes', avg ?? '—'),
    stat('All time', all.avgPasses
      ? `${all.avgPasses.toFixed(1)} average, over ${all.rounds} rounds`
      : 'this is the first one')
  );

  show('done');
}

function stat(label, value) {
  return el('div', { class: 'stat' },
    el('span', { class: 'dim' }, label), el('b', {}, value));
}

boot();

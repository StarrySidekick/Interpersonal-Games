// Blind Agreement.
//
// Pure coordination: you both have to land on the same option, with nothing
// agreed in advance about which. There is no connection between the two
// phones — the seed makes the boards identical, and the call does the rest.

import { rng, shuffled, newRoomCode, normalizeCode } from '../../engine/seed.js';
import { logSitting, blindAgreementStats } from '../../engine/record.js';
import {
  $, el, show, keepAwake, haptic, relativeDay, practiceInfo, practiceBanner
} from '../../engine/ui.js';

const GAME = 'blind-agreement';
const LAST_CODE = 'ig.lastCode';

let boards = [];

const game = {
  code: '', order: [], roundNo: 0,
  board: null, options: [], gone: new Set(), myPick: null, passes: 0,
  rounds: [], startedAt: 0, practice: false
};

// --- setup -----------------------------------------------------------------

async function boot() {
  keepAwake();
  const res = await fetch('../../data/blind-agreement.json');
  boards = (await res.json()).boards;

  // A pane on solo.html arrives with its code in the URL rather than typed —
  // see practiceInfo() for why a practice round must not become the phone's
  // new default code or a line in the real record.
  const practice = practiceInfo();
  game.practice = practice.on;
  if (practice.on) practiceBanner();

  const saved = localStorage.getItem(LAST_CODE);
  $('#code').value = practice.code || saved || '';

  $('#suggest').onclick = () => { $('#code').value = newRoomCode(); };
  $('#start').onclick = startSitting;
  $('#lock').onclick = lockIn;
  $('#matched').onclick = () => resolveRound(true);
  $('#missed').onclick = () => { renderTheirs(); show('miss'); };
  $('#next').onclick = nextRound;
  $('#end').onclick = endSitting;
  $('#again').onclick = () => show('setup');

  show('setup');
  if (practice.on && practice.code) startSitting();
}

function startSitting() {
  const code = normalizeCode($('#code').value) || normalizeCode(newRoomCode());
  if (!game.practice) localStorage.setItem(LAST_CODE, code);

  game.code = code;
  // One deterministic board order for the whole sitting, so round N is the
  // same board on both phones however long you play.
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
  show('say');
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
  $('#status').textContent = `Round ${game.roundNo + 1}${pass}`;
}

// --- end -------------------------------------------------------------------

function endSitting() {
  if (game.rounds.length && !game.practice) {
    logSitting({
      game: GAME,
      startedAt: game.startedAt,
      data: { code: game.code, rounds: game.rounds }
    });
  }

  const matched = game.rounds.filter((r) => r.matched);
  const avg = matched.length
    ? (matched.reduce((n, r) => n + r.passes, 0) / matched.length).toFixed(1)
    : null;
  const all = blindAgreementStats();

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

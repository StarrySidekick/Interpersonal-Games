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
let soloWanted = false;

const game = {
  code: '', order: [], roundNo: 0,
  board: null, options: [], gone: new Set(), myPick: null, passes: 0,
  rounds: [], startedAt: 0, solo: false
};

// --- setup -----------------------------------------------------------------

async function boot() {
  keepAwake();
  const res = await fetch('../../data/blind-agreement.json');
  boards = (await res.json()).boards;

  const saved = localStorage.getItem(LAST_CODE);
  $('#code').value = saved || '';

  $('#suggest').onclick = () => { $('#code').value = newRoomCode(); };
  $('#solo-toggle').onclick = toggleSolo;
  $('#start').onclick = startSitting;
  $('#lock').onclick = lockIn;
  $('#matched').onclick = () => resolveRound(true);
  $('#missed').onclick = () => { renderTheirs(); show('miss'); };
  $('#solo-continue').onclick = () => {
    if (game.soloMatched) resolveRound(true);
    else strikeBoth(game.soloTheirs);
  };
  $('#next').onclick = nextRound;
  $('#end').onclick = endSitting;
  $('#again').onclick = () => show('setup');

  show('setup');
}

function toggleSolo() {
  soloWanted = !soloWanted;
  $('#solo-toggle').setAttribute('aria-pressed', String(soloWanted));
  $('#solo-note').hidden = !soloWanted;
}

function startSitting() {
  const code = normalizeCode($('#code').value) || normalizeCode(newRoomCode());
  localStorage.setItem(LAST_CODE, code);

  game.code = code;
  game.solo = soloWanted;
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
  updateStatus();
  haptic([14, 60, 14]);
  if (game.solo) {
    soloReveal();
  } else {
    $('#mypick').textContent = game.options[game.myPick];
    show('say');
  }
}

/**
 * There is no partner to say a pick out loud, so one is simulated: a
 * uniformly random still-available option, seeded so a given round+pass
 * always simulates the same "partner" if you ever replay it. This exists to
 * exercise the round loop alone (docs/game-ideas.md's coordination design
 * needs two real people to mean anything) — see INTENT.md.
 */
function soloReveal() {
  const avail = game.options
    .map((_, i) => i)
    .filter((i) => !game.gone.has(i));
  const pick = rng(`${game.code}|partner|${game.roundNo}|${game.passes}`);
  const theirs = avail[Math.floor(pick() * avail.length)];

  game.soloTheirs = theirs;
  game.soloMatched = theirs === game.myPick;

  $('#solo-mine').textContent = game.options[game.myPick];
  $('#solo-theirs').textContent = game.options[theirs];
  $('#solo-result').textContent = game.soloMatched ? 'Matched.' : 'Missed.';
  show('solo');
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
  const solo = game.solo ? ' · testing' : '';
  $('#status').textContent = `Round ${game.roundNo + 1}${pass}${solo}`;
}

// --- end -------------------------------------------------------------------

function endSitting() {
  // A solo sitting is you against a coin flip, not the two of you against a
  // board — it doesn't belong in a record that's supposed to be what you
  // built together, so it's never written.
  if (game.rounds.length && !game.solo) {
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

  $('#save-note').textContent = game.solo
    ? 'Testing alone — this sitting was not saved to the record.'
    : 'Saved to this phone only. Nothing was sent anywhere.';

  show('done');
}

function stat(label, value) {
  return el('div', { class: 'stat' },
    el('span', { class: 'dim' }, label), el('b', {}, value));
}

boot();

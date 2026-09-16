// Twenty-Twenty.
//
// Twenty Questions, except you are both guessing at once and each of you is
// allowed to lie exactly once. The lie is what turns a deduction game into a
// game about knowing somebody's tells over a phone line — see
// docs/game-ideas.md, which is where this design comes from.
//
// There is no connection between the two phones, and this game needs less of
// one than Blind Agreement does. Every fact a phone holds is a fact about ITS
// OWN player: your secret, your lie, your count, the calls you made. Nothing
// has to agree with anything on the other screen, so nothing can silently
// disagree. The seed is only there so the two of you are dealt from one deck
// and cannot both be given the octopus.

import { rng, shuffled, newRoomCode, normalizeCode } from '../../engine/seed.js';
import { logSitting, twentyTwentyStats } from '../../engine/record.js';
import { $, el, show, keepAwake, haptic, relativeDay } from '../../engine/ui.js';

const GAME = 'twenty-twenty';
const LAST_CODE = 'ig.lastCode';
const LAST_SIDE = 'ig.tt.side';
const QUESTIONS = 20;

let subjects = [];
let soloWanted = false;

const game = {
  code: '', side: '', secret: null, startedAt: 0,
  asked: 0, lieSpent: false, calls: [], outcome: null,
  solo: false, soloStage: null, soloDeck: null
};

// --- setup -----------------------------------------------------------------

async function boot() {
  keepAwake();
  const res = await fetch('../../data/twenty-twenty.json');
  subjects = (await res.json()).subjects;

  $('#code').value = localStorage.getItem(LAST_CODE) || '';
  game.side = localStorage.getItem(LAST_SIDE) || '';

  $('#suggest').onclick = () => { $('#code').value = newRoomCode(); };
  $('#side-a').onclick = () => pickSide('a');
  $('#side-b').onclick = () => pickSide('b');
  $('#solo-toggle').onclick = toggleSolo;
  $('#start').onclick = startSitting;
  $('#got-it').onclick = () => show('play');
  $('#ask').onclick = () => bumpAsked(1);
  $('#undo-ask').onclick = () => bumpAsked(-1);
  $('#lie').onclick = spendLie;
  $('#call').onclick = () => show('callit');
  $('#call-right').onclick = () => resolveCall(true);
  $('#call-wrong').onclick = () => resolveCall(false);
  $('#call-cancel').onclick = () => show('play');
  $('#peek').onclick = () => { renderSecret(); show('secret'); };
  $('#done').onclick = () => show('end');
  $('#won-me').onclick = () => endSitting('me');
  $('#won-them').onclick = () => endSitting('them');
  $('#won-both').onclick = () => endSitting('both');
  $('#won-neither').onclick = () => endSitting('neither');

  pickSide(game.side);
  renderArc();
  show('setup');
}

// The pill carries the running call tally during a sitting, so it has to be
// put back or the setup screen reports the sitting you just finished.
function resetPill() { $('#status').textContent = 'Twenty-Twenty'; }

function backToSetup() { resetPill(); renderArc(); show('setup'); }

function pickSide(side) {
  game.side = side === 'a' || side === 'b' ? side : '';
  $('#side-a').setAttribute('aria-pressed', String(game.side === 'a'));
  $('#side-b').setAttribute('aria-pressed', String(game.side === 'b'));
  $('#start').disabled = soloWanted ? false : !game.side;
}

/**
 * Testing alone doesn't need a partner's phone, because every fact this game
 * tracks already lives on one side only. What it needs is a way to see both
 * secrets a room code deals and step through both, which two live people
 * never require of it. Sequential rather than split-screen: you play the
 * left all the way through, then the same deck deals you the right.
 */
function toggleSolo() {
  soloWanted = !soloWanted;
  $('#solo-toggle').setAttribute('aria-pressed', String(soloWanted));
  $('#solo-note').hidden = !soloWanted;
  $('#sides-pick').hidden = soloWanted;
  $('#sides-note').hidden = soloWanted;
  $('#start').disabled = soloWanted ? false : !game.side;
}

function startSitting() {
  const code = normalizeCode($('#code').value) || normalizeCode(newRoomCode());
  localStorage.setItem(LAST_CODE, code);

  // One deck order from the code, then the left takes the first and the right
  // takes the second. Both phones compute the same shuffle, so the two of you
  // are dealt different things without either phone knowing the other exists.
  const deck = shuffled(subjects, rng(`${code}|tt`));
  game.code = code;
  game.solo = soloWanted;

  if (game.solo) {
    game.soloDeck = deck;
    game.soloStage = 'a';
    game.side = 'a';
  } else {
    localStorage.setItem(LAST_SIDE, game.side);
    game.soloStage = null;
    game.soloDeck = null;
  }

  game.secret = deck[game.side === 'a' ? 0 : 1];
  game.startedAt = Date.now();
  game.asked = 0;
  game.lieSpent = false;
  game.calls = [];
  game.outcome = null;

  renderSecret();
  renderPlay();
  show('secret');
}

/** The second half of a solo test: same deck, the other side, from scratch. */
function playOtherSoloSide() {
  game.soloStage = 'b';
  game.side = 'b';
  game.secret = game.soloDeck[1];
  game.startedAt = Date.now();
  game.asked = 0;
  game.lieSpent = false;
  game.calls = [];
  game.outcome = null;

  renderSecret();
  renderPlay();
  show('secret');
}

// --- a sitting -------------------------------------------------------------

function renderSecret() {
  $('#secret').textContent = game.secret.n;
  $('#secret-cat').textContent = game.secret.c;

  const stageEl = $('#secret-stage');
  stageEl.hidden = !game.solo;
  if (game.solo) {
    stageEl.textContent = game.soloStage === 'a'
      ? 'Testing alone — the left, first.'
      : 'Testing alone — now the right, same deck.';
  }
}

function bumpAsked(n) {
  // A miscount is the one thing that makes this game sour over a phone line,
  // and a fat thumb is the commonest cause, so Undo is a first-class button
  // rather than a long press.
  game.asked = Math.max(0, Math.min(QUESTIONS, game.asked + n));
  haptic(8);
  renderPlay();
}

function spendLie() {
  if (game.lieSpent) return;
  game.lieSpent = true;
  haptic([10, 40, 10]);
  renderPlay();
}

function resolveCall(right) {
  game.calls.push({ right, at: game.asked });
  haptic(right ? [10, 30, 10] : 20);
  renderPlay();
  show('play');
}

function renderPlay() {
  $('#asked').textContent = String(game.asked);
  const left = QUESTIONS - game.asked;
  $('#left').textContent = left === 0
    ? 'That was your twentieth.'
    : `${left} left`;

  // The lie is spent silently and permanently. There is no way to take it
  // back, because being able to would make it a setting rather than a nerve.
  $('#lie-state').textContent = game.lieSpent
    ? 'Your lie is spent. You have to be honest now.'
    : 'You have one lie. You never have to use it.';
  $('#lie').disabled = game.lieSpent;

  const made = game.calls.length;
  const right = game.calls.filter((c) => c.right).length;
  const solo = game.solo ? ` · testing (${game.soloStage === 'a' ? 'left' : 'right'})` : '';
  $('#status').textContent = (made ? `Called ${made} · right ${right}` : 'Twenty-Twenty') + solo;
}

function endSitting(outcome) {
  game.outcome = outcome;
  const made = game.calls.length;
  const right = game.calls.filter((c) => c.right).length;

  // A solo pass is one person stepping through one secret — it isn't a
  // sitting the two of you had, so it never joins the record. Same rule as
  // Blind Agreement's solo mode; see INTENT.md.
  if (!game.solo) {
    logSitting({
      game: GAME,
      startedAt: game.startedAt,
      data: {
        side: game.side,
        subject: game.secret.n,
        category: game.secret.c,
        asked: game.asked,
        lieSpent: game.lieSpent,
        calls: made,
        callsRight: right,
        outcome
      }
    });
  }

  $('#reveal').textContent = game.secret.n;
  const bits = [];
  if (game.solo) bits.push('Testing alone — not saved.');
  bits.push(`You asked ${game.asked}.`);
  bits.push(game.lieSpent ? 'You used your lie.' : 'You never used your lie.');
  if (made) {
    bits.push(`You called ${made} ${made === 1 ? 'lie' : 'lies'} and were right about ${right}.`);
  } else {
    bits.push('You never called one.');
  }
  $('#tally').textContent = bits.join(' ');
  setupAfterButton();
  show('after');
}

/** What "again" means depends on where a solo test is in its two passes. */
function setupAfterButton() {
  const btn = $('#again');
  if (game.solo && game.soloStage === 'a') {
    btn.textContent = 'Now play the right';
    btn.onclick = playOtherSoloSide;
  } else if (game.solo && game.soloStage === 'b') {
    btn.textContent = 'Done testing';
    btn.onclick = backToSetup;
  } else {
    btn.textContent = 'Another';
    btn.onclick = backToSetup;
  }
}

// --- the arc ---------------------------------------------------------------
//
// Things accrue and nothing decays: no streak, no gap warning, and a month
// away is greeted with what you have built rather than with a penalty. The
// number that means something over months is how often you are right when you
// call a lie — which only exists once you have called a few.

function renderArc() {
  const s = twentyTwentyStats();
  if (!s.sittings) { $('#arc').hidden = true; return; }

  const bits = [`${s.sittings} ${s.sittings === 1 ? 'sitting' : 'sittings'}`];
  if (s.calls) {
    bits.push(`you've called ${s.calls} ${s.calls === 1 ? 'lie' : 'lies'} and been right about ${s.callsRight}`);
  }
  if (s.liesTold) {
    bits.push(`you've lied ${s.liesTold} ${s.liesTold === 1 ? 'time' : 'times'}`);
  }
  const when = relativeDay(s.lastPlayed);
  if (when) bits.push(`last played ${when}`);
  $('#arc-line').textContent = `${bits.join(' · ')}.`;
  $('#arc').hidden = false;
}

boot();

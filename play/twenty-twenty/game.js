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

const game = {
  code: '', side: '', secret: null, startedAt: 0,
  asked: 0, lieSpent: false, calls: [], outcome: null, practice: false
};

// --- setup -----------------------------------------------------------------

async function boot() {
  keepAwake();
  const res = await fetch('../../data/twenty-twenty.json');
  subjects = (await res.json()).subjects;

  // Twenty-Twenty is the one that actually needs a second person, because
  // each phone only ever knows its own secret. Practice mode doesn't fake
  // that — it just makes it possible to run both phones yourself: see
  // ../../practice.html, which opens two of these panels on the same code
  // with opposite sides preset, and this game stops writing to the real
  // record so a solo run-through can't be mistaken for a real sitting later.
  const params = new URLSearchParams(location.search);
  game.practice = params.get('practice') === '1';
  if (game.practice) $('#practice-badge').hidden = false;

  $('#code').value = params.get('code') || localStorage.getItem(LAST_CODE) || '';
  game.side = params.get('side') || localStorage.getItem(LAST_SIDE) || '';

  $('#suggest').onclick = () => { $('#code').value = newRoomCode(); };
  $('#side-a').onclick = () => pickSide('a');
  $('#side-b').onclick = () => pickSide('b');
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
  $('#again').onclick = () => { resetPill(); renderArc(); show('setup'); };

  pickSide(game.side);
  renderArc();
  show('setup');
}

// The pill carries the running call tally during a sitting, so it has to be
// put back or the setup screen reports the sitting you just finished.
function resetPill() { $('#status').textContent = 'Twenty-Twenty'; }

function pickSide(side) {
  game.side = side === 'a' || side === 'b' ? side : '';
  $('#side-a').setAttribute('aria-pressed', String(game.side === 'a'));
  $('#side-b').setAttribute('aria-pressed', String(game.side === 'b'));
  $('#start').disabled = !game.side;
}

function startSitting() {
  const code = normalizeCode($('#code').value) || normalizeCode(newRoomCode());
  localStorage.setItem(LAST_CODE, code);
  localStorage.setItem(LAST_SIDE, game.side);

  // One deck order from the code, then the left takes the first and the right
  // takes the second. Both phones compute the same shuffle, so the two of you
  // are dealt different things without either phone knowing the other exists.
  const deck = shuffled(subjects, rng(`${code}|tt`));
  game.code = code;
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

// --- a sitting -------------------------------------------------------------

function renderSecret() {
  $('#secret').textContent = game.secret.n;
  $('#secret-cat').textContent = game.secret.c;
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
  $('#status').textContent = made
    ? `Called ${made} · right ${right}`
    : 'Twenty-Twenty';
}

function endSitting(outcome) {
  game.outcome = outcome;
  const made = game.calls.length;
  const right = game.calls.filter((c) => c.right).length;

  if (!game.practice) {
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
  const bits = [`You asked ${game.asked}.`];
  bits.push(game.lieSpent ? 'You used your lie.' : 'You never used your lie.');
  if (made) {
    bits.push(`You called ${made} ${made === 1 ? 'lie' : 'lies'} and were right about ${right}.`);
  } else {
    bits.push('You never called one.');
  }
  bits.push(game.practice ? 'Practice sitting — nothing was saved.' : '');
  $('#tally').textContent = bits.join(' ').trim();
  show('after');
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

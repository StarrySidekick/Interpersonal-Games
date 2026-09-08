// Shared shell helpers. Small on purpose — there is no framework here and the
// UI rules in docs/scope.md are mostly about restraint.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid != null) node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

/** Show exactly one of a set of screens. */
export function show(id) {
  $$('[data-screen]').forEach((s) => { s.hidden = s.dataset.screen !== id; });
  window.scrollTo(0, 0);
}

/**
 * A game that locks the screen mid-round is broken. Re-acquires on return,
 * because the lock is dropped whenever the tab is backgrounded — which happens
 * constantly when the phone is also being used as a phone.
 */
export function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  let lock = null;
  const acquire = async () => {
    try { lock = await navigator.wakeLock.request('screen'); } catch { /* denied */ }
  };
  acquire();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !lock?.released) acquire();
  });
}

export function haptic(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/**
 * Query-string plumbing for a solo practice pane — see each game's solo.html.
 * `?practice=1&code=...` (and `&side=a|b` for a game with roles) lets one
 * page load two synced iframes instead of two phones. A game reads this once
 * in boot() to prefill and auto-start, and must not let a practice run touch
 * localStorage's "last code" default or the real record — a solo test round
 * is not a sitting. Any new game gets solo testing for free by following the
 * same three params rather than inventing its own.
 */
export function practiceInfo() {
  const p = new URLSearchParams(location.search);
  return {
    on: p.get('practice') === '1',
    code: p.get('code') || '',
    side: p.get('side') || ''
  };
}

/** So a practice pane never looks or scores like the real thing. */
export function practiceBanner() {
  const topbar = $('.topbar');
  const note = el('p', { class: 'small dim center', style: 'margin:-6px 0 14px' },
    'Practice pane — not saved to your record.');
  if (topbar) topbar.after(note); else document.body.prepend(note);
}

export function relativeDay(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

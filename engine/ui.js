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

export function relativeDay(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

// --- Light and dark. -------------------------------------------------------
// The choice is kept in this browser. Each page's <head> applies it before
// anything is drawn (see the one-line script there), so there is no flash.

const THEME_KEY = 'ig.theme';
const systemTheme = () => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const currentTheme = () => document.documentElement.dataset.theme || systemTheme();

function paintThemeColour() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

/** A button that flips between light and dark, labelled with where it goes. */
export function themeToggle() {
  const b = el('button', { class: 'quiet themebtn', type: 'button' });
  const paint = () => { b.textContent = currentTheme() === 'light' ? 'Dark' : 'Light'; paintThemeColour(); };
  b.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* still switches, just won't remember */ }
    paint();
  });
  paint();
  return b;
}

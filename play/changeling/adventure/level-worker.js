// Builds a level off the page's thread, so the board never freezes while
// the par search runs (a deep level can take a second or two on a phone).
// It also finds a hint for test mode.

import { makeLevel } from './run.js';
import { search } from './rules.js';

onmessage = (e) => {
  const { kind, id, run, state } = e.data;
  if (kind === 'level') postMessage({ id, level: makeLevel(run) });
  if (kind === 'hint') postMessage({ id, found: search(state, { width: 80, cap: 30 }) });
};

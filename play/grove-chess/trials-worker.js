// The piece trials' background thread (trials.js): a trial plays hundreds of
// games, which takes seconds, so it runs here and the page stays responsive.
// Invented pieces come with the question and are made real first.

import { runTrial, runWeave } from './trials.js';
import { registerInvented } from './invented.js';

self.onmessage = ({ data }) => {
  registerInvented(data.invented || []);
  // Progress at most every tenth of a second: a message per layout would
  // swamp the page.
  let last = 0;
  const post = (m) => { const now = Date.now(); if (now - last > 100) { last = now; self.postMessage(m); } };
  try {
    self.postMessage({ type: 'done', out: data.weave ? runWeave(data, post) : runTrial(data, post) });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e?.message || e) });
  }
};

// The trials' and the Custom page's workers (2026-10-13): each runs jobs
// (trials.js runJob: checks and games, on the real rules) handed to it by
// the page, so a trial uses every core the phone or computer has.
// Invented pieces come with the first job and are made real first.

import { runJob } from './trials.js';
import { registerInvented } from './invented.js';

self.onmessage = ({ data }) => {
  const { id, job } = data;
  try {
    if (job.invented?.length) registerInvented(job.invented);
    if (job.settings?.invented?.length) registerInvented(job.settings.invented);
    self.postMessage({ id, out: runJob(job) });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};

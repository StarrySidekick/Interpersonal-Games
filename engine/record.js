// Engine C — the record.
//
// Everything lives in this browser and nowhere else. No account, no server,
// nothing to leak. The rules from docs/scope.md that this file exists to
// enforce: things accrue, nothing decays, and there are no streaks to break.

const KEY = 'ig.record.v1';

const empty = () => ({ version: 1, created: Date.now(), sittings: [] });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sittings)) {
      return empty();
    }
    return parsed;
  } catch {
    return empty(); // Private mode, disabled storage, corrupt blob. Play anyway.
  }
}

export function save(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    return true;
  } catch {
    return false; // Never let a full or blocked disk end a round.
  }
}

/**
 * Log one finished sitting. `data` is game-specific and deliberately not
 * schema'd here — the meta space isn't designed yet, so games record what they
 * know and the presentation gets decided later.
 */
export function logSitting({ game, startedAt, data }) {
  const record = load();
  record.sittings.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    game,
    startedAt: startedAt || Date.now(),
    endedAt: Date.now(),
    data: data || {}
  });
  save(record);
  return record;
}

export function sittingsFor(game) {
  return load().sittings.filter((s) => s.game === game);
}

/** Blind Agreement's numbers. Lives here so the front page can show them. */
export function blindAgreementStats() {
  const sittings = sittingsFor('blind-agreement');
  const rounds = sittings.flatMap((s) => s.data.rounds || []);
  const matched = rounds.filter((r) => r.matched);
  const avg = matched.length
    ? matched.reduce((n, r) => n + r.passes, 0) / matched.length
    : null;
  return {
    sittings: sittings.length,
    rounds: rounds.length,
    matched: matched.length,
    avgPasses: avg,
    best: matched.length ? Math.min(...matched.map((r) => r.passes)) : null,
    lastPlayed: sittings.length ? sittings[sittings.length - 1].endedAt : null
  };
}

export function exportCode() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(load()))));
}

export function importCode(code) {
  const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sittings)) {
    throw new Error('That does not look like a record.');
  }
  // Merge rather than replace — two phones each holding a partial history is
  // the expected case, not an error.
  const mine = load();
  const seen = new Set(mine.sittings.map((s) => s.id));
  for (const s of parsed.sittings) if (!seen.has(s.id)) mine.sittings.push(s);
  mine.sittings.sort((a, b) => a.startedAt - b.startedAt);
  save(mine);
  return mine;
}

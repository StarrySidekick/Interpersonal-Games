// Everything the settings console (an artifact, 2026-10-10) shows, as JSON:
// every piece with its record, every mode's settings with the panel's
// labels, and the look. Run it to rebuild the console's data after the game
// changes:
//
//   node play/grove-chess/console-data.mjs > console-data.json
//
// The console only ever edits config.js; this is what it edits against.

import { PIECES } from './rules.js';
import { patent } from './betza.js';
import { powers } from './power.js';
import { MODES, PANEL, modeDefaults, settingShown } from './modes.js';
import { DEFAULT_OFF } from './invented.js';
import { HISTORY } from './history.js';
import { CONFIG, LOOK_DEFAULTS } from './config.js';
import { readFileSync } from 'node:fs';

const pw = powers(6, 6);
const pieces = Object.keys(PIECES).filter((k) => ['classic', 'fairy'].includes(PIECES[k].kind)).map((k) => {
  const P = PIECES[k];
  let words = '';
  try { const t = patent(P.betza); words = `${t.travel[0].toUpperCase()}${t.travel.slice(1)}: ${t.shapes.join('; ')}. Captures ${t.captures}.${t.notes.map((n) => ` ${n[0].toUpperCase()}${n.slice(1)}.`).join('')}`; } catch { /* no patent */ }
  return {
    id: k, record: P.record, kind: P.kind, betza: P.betza, strength: P.strength, power: pw[k]?.power ?? null,
    screen: !!pw[k]?.screen, desc: P.desc, origin: P.origin || '', history: HISTORY[k] || '', patent: words,
    offByDefault: [...DEFAULT_OFF, 'vao'].includes(k)
  };
}).sort((a, b) => (a.power ?? 0) - (b.power ?? 0));

const groups = PANEL.map((g) => ({ group: g.group, fields: g.fields.map((f) => ({
  key: f.key, label: f.label, type: f.type, def: f.def, min: f.min, max: f.max, unit: f.unit || '', help: f.help || '',
  options: f.options ? f.options.map((o) => ({ v: o.v, label: o.label })) : undefined
})) }));

const modes = Object.fromEntries(Object.keys(MODES).map((id) => {
  const S = modeDefaults(id);
  const shown = groups.flatMap((g) => g.fields.map((f) => f.key)).filter((k) => settingShown(k, S));
  const values = Object.fromEntries(shown.map((k) => [k, S[k]]));
  return [id, { name: MODES[id].name, blurb: MODES[id].blurb, values, shown }];
}));

// config.js itself, with its CONFIG block cut out: the console fills it back
// in, so what it hands over is the whole file.
const template = readFileSync(new URL('./config.js', import.meta.url), 'utf8').replace(/export const CONFIG = \{[\s\S]*?\n\};/, '/*CONFIG*/');

process.stdout.write(JSON.stringify({ made: new Date().toISOString().slice(0, 10), pieces, groups, modes, look: LOOK_DEFAULTS, config: CONFIG, template }));

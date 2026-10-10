// Builds the Grove Chess Console artifact (2026-10-10) from its template.
//
//   node play/grove-chess/console-data.mjs > tools/settings-console/data.json
//   node tools/settings-console/sprites.mjs   (needs the site served on :8123)
//   node tools/settings-console/build.mjs <out.html>
//
// The page is then published as an artifact; its saved changes live in the
// artifact's database (doc console/changes), which Claude reads to write
// play/grove-chess/config.js.
import { readFileSync, writeFileSync } from 'node:fs';
const here = (f) => new URL(`./${f}`, import.meta.url);
const html = readFileSync(here('template.html'), 'utf8')
  .replace('/*DATA*/', () => readFileSync(here('data.json'), 'utf8').replace(/<\//g, '<\\/'))
  .replace('/*SPRITES*/', () => readFileSync(here('sprites.json'), 'utf8'));
writeFileSync(process.argv[2], html);
console.log(`${process.argv[2]}: ${html.length} bytes`);

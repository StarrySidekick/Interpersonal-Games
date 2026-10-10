// Renders every piece, yours and theirs, to a PNG for the console (see build.mjs).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8')).pieces.map((p) => p.id);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('http://localhost:8123/play/grove-chess/pieces/');
const out = await p.evaluate(async (ids) => {
  const { sprite } = await import('../board.js');
  const r = {};
  for (const k of [...ids, 'statue']) {
    const one = (side) => { const c = document.createElement('canvas'); const s = k === 'statue' ? sprite('rook', 'stone') : sprite(k, side); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0); return c.toDataURL('image/png'); };
    r[k] = { you: one('you'), foe: k === 'statue' ? null : one('foe') };
  }
  return r;
}, ids);
writeFileSync(new URL('./sprites.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, JSON.stringify(out).length);
await b.close();

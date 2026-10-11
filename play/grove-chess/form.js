// A settings form, built from a schema (lab.js SCHEMA, modes.js
// RUN_SCHEMA): steppers with a box to type in for numbers, switches, choices, several-of
// choices, and pieces. Shared by Chaos and every mode's settings panel, so
// a setting looks and works the same wherever it is.

import { el } from '../../engine/ui.js';
import { PIECES } from './rules.js';
import { sprite } from './board.js';

/**
 * Build the form for `groups` ([{ group, fields }]) into `root`. `get()`
 * returns the current settings; `set(key, value)` changes one. `open` is
 * which groups start open. Returns `update()`, which repaints every control
 * from get() (call it after the settings change from outside).
 */
export function buildForm(root, groups, get, set, open = () => false, { show = () => true, note = () => '' } = {}) {
  // `show(key, settings)` hides what does not apply (a mode's own settings
  // only, and a setting only when another one makes it matter); `note`
  // adds words to a label (the descent's "first level, then climbs").
  const updaters = [];

  function field(f) {
    const extra = el('span', { class: 'fnote' });
    const label = el('div', { class: 'flabel' }, f.label, extra, f.help ? el('span', { class: 'fhelp' }, f.help) : null);
    updaters.push(() => { extra.textContent = note(f.key, get()) || ''; });
    let ctrl;
    if (f.type === 'int') {
      // A box to type the number into, between − and + (2026-10-11: "need
      // text entry for things like the millisecond travel time"). It takes
      // the number when you finish (Enter, or tapping away), kept in range.
      const clamp = (v) => Math.max(f.min, Math.min(f.max, Math.round(v)));
      const box = el('input', { class: 'fnum', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', 'aria-label': f.label, autocomplete: 'off' });
      const commit = () => {
        const v = parseInt(box.value.replace(/[^0-9-]/g, ''), 10);
        if (Number.isFinite(v) && clamp(v) !== get()[f.key]) set(f.key, clamp(v));
        else box.value = String(get()[f.key]);
      };
      box.addEventListener('change', commit);
      box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.blur(); } });
      box.addEventListener('focus', () => box.select());
      const unit = el('span', { class: 'funit' });
      const step = (d) => el('button', { class: 'quiet', 'aria-label': d < 0 ? `Less ${f.label}` : `More ${f.label}`,
        onclick: () => set(f.key, clamp(get()[f.key] + d)) }, d < 0 ? '−' : '+');
      ctrl = el('div', { class: 'stepper' }, step(-1), box, step(1), unit);
      updaters.push(() => {
        const v = get()[f.key];
        if (document.activeElement !== box) box.value = String(v); // never under your fingers mid-typing
        unit.textContent = f.key === 'maxMoves' && v === 0 ? 'none' : f.unit || '';
      });
    } else if (f.type === 'bool') {
      ctrl = el('button', { class: 'quiet tog', onclick: () => set(f.key, !get()[f.key]) });
      updaters.push(() => { ctrl.textContent = get()[f.key] ? 'On' : 'Off'; ctrl.setAttribute('aria-pressed', String(!!get()[f.key])); });
    } else if (f.type === 'choice') {
      const btns = f.options.map((o) => el('button', { class: 'quiet', onclick: () => set(f.key, o.v) }, o.label));
      ctrl = el('div', { class: 'seg' }, ...btns);
      updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(f.options[i].v === get()[f.key]))));
    } else if (f.type === 'multi') {
      const btns = f.options.map((o) => el('button', { class: 'quiet', onclick: () => {
        const cur = get()[f.key], on = cur.includes(o.v) ? cur.filter((x) => x !== o.v) : [...cur, o.v];
        if (on.length) set(f.key, on); // always keep at least one
      } }, o.label));
      ctrl = el('div', { class: 'seg' }, ...btns);
      updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(get()[f.key].includes(f.options[i].v)))));
    } else if (f.type === 'pieces') {
      const kinds = [...(f.rabbit ? ['rabbit'] : []), ...Object.keys(PIECES).filter((k) => k !== 'rabbit' && (k !== 'ball' || f.ball))];
      const btns = kinds.map((k) => {
        const cv = el('canvas', { class: 'pix', width: 30, height: 36 });
        cv.getContext('2d').drawImage(sprite(k, f.rabbit ? 'foe' : 'you'), 0, 0);
        return el('button', { class: 'quiet chip', onclick: () => {
          const cur = get()[f.key], pool = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
          if (pool.length) set(f.key, pool); // always keep at least one
        } }, cv, PIECES[k].name);
      });
      ctrl = el('div', { class: 'chips' }, ...btns);
      updaters.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(get()[f.key].includes(kinds[i])))));
    }
    const row = el('div', { class: `field${['pieces', 'choice', 'multi'].includes(f.type) ? ' wide' : ''}` }, label, ctrl);
    updaters.push(() => { row.hidden = !show(f.key, get()); });
    return row;
  }

  for (const g of groups) {
    const box = el('details', { class: 'group', open: open(g.group) }, el('summary', {}, g.group), ...g.fields.map(field));
    updaters.push(() => { box.hidden = !g.fields.some((f) => show(f.key, get())); });
    root.append(box);
  }
  const update = () => updaters.forEach((u) => u());
  update();
  return update;
}

/** The form's styles, for pages that do not have them yet. */
export const FORM_CSS = `
  .group { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 4px 14px 10px; margin: 12px 0; }
  .group > summary { font-size: 17px; font-weight: 700; color: var(--text); padding: 10px 0; }
  .field { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
  .field.wide { grid-template-columns: 1fr; }
  .flabel { font-size: 15px; font-weight: 600; }
  .fnote { font-weight: 400; color: var(--accent); }
  .fhelp { display: block; font-size: 13px; font-weight: 400; color: var(--dim); }
  .stepper { display: flex; align-items: center; gap: 6px; }
  .stepper button, .seg button, .tog, .chip { width: auto; min-height: 44px; padding: 8px 12px; font-size: 15px; border-radius: 12px; }
  .stepper button { min-width: 44px; font-size: 20px; padding: 4px 0; }
  .fval { min-width: 64px; text-align: center; font-weight: 700; }
  .stepper { flex-wrap: wrap; justify-content: flex-end; max-width: 220px; }
  .stepper .fnum { width: 76px; flex: 0 0 76px; min-height: 44px; text-align: center; font: inherit; font-size: 17px; font-weight: 700; color: var(--text);
    background: var(--panel-2); border: 1px solid var(--line); border-radius: 12px; padding: 6px 4px; }
  .stepper .fnum:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .funit { flex-basis: 100%; text-align: right; font-size: 13px; color: var(--dim); }
  .funit:empty { display: none; }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button[aria-pressed='true'], .tog[aria-pressed='true'], .chip[aria-pressed='true'] { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
  .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
  .chip { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px; font-size: 13px; }
  .chip canvas { width: 30px; height: 36px; }
`;

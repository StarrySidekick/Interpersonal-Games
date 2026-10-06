// Sound, made in the browser while it plays: oscillators and filtered noise
// from the Web Audio API. No audio files, nothing to download.
//
// Two primitives, and a game builds its own sounds out of them:
//   tone()  one note whose pitch can glide, with a fast attack and a fade.
//   noise() a burst of hiss through a filter, for thuds, crunches and dust.
//
// Browsers only allow sound once the person has touched the page, so the
// audio context is opened (or woken) on the first real tap. On an iPhone the
// ring/silent switch mutes it, which is the polite default.
//
// Whether sound is on is kept in this browser, like the theme.

import { el } from './ui.js';

const KEY = 'ig.sound';
let on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked: on, unremembered */ }

let ac = null, out = null, noiseBuf = null;

export const soundOn = () => on;

/** The audio context, opened on first use. Null when sound is off or the
    browser has no Web Audio. */
function audio() {
  if (!on) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    out = ac.createGain();
    out.gain.value = 0.5;
    // A gentle limiter, so several sounds landing together do not clip.
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -12; lim.ratio.value = 6;
    out.connect(lim).connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

// These are the events browsers count as a real tap ("user activation").
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) {
  addEventListener(ev, () => audio(), { capture: true, passive: true });
}

/** One note. Pitch glides from f to f2 (Hz) over `dur` seconds; `at` is
    seconds from now. */
export function tone({ f, f2 = f, type = 'sine', at = 0, dur = 0.15, vol = 0.25, attack = 0.005 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + Math.max(0, at), o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A burst of noise through a filter whose cutoff slides from `from` to
    `to` Hz. Lowpass sounds dull and heavy, bandpass like a crunch or a tap,
    highpass like a hiss. */
export function noise({ at = 0, dur = 0.2, vol = 0.2, from = 2000, to = from, type = 'lowpass', q = 1 }) {
  const c = audio();
  if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + Math.max(0, at), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf;
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(from, t);
  if (to !== from) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 0.5); // a different stretch of hiss each time
  s.stop(t + dur + 0.02);
}

// A speaker, with sound waves or a cross. Drawn in the button's text colour.
const SPEAKER = '<path d="M4 9h3l4-4v14l-4-4H4z" fill="currentColor"/>';
const WAVES = '<path d="M14.5 9a4 4 0 0 1 0 6M17 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const CROSS = '<path d="M15 9.5l5 5M20 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

/** A small speaker button that turns sound off and on. It shows the state
    sound is in now, the way speaker buttons usually do; the label read out
    to screen readers says what tapping it will do. */
export function soundToggle() {
  const b = el('button', { class: 'quiet themebtn soundbtn', type: 'button' });
  const paint = () => {
    b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${SPEAKER}${on ? WAVES : CROSS}</svg>`;
    b.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
    b.title = on ? 'Sound is on' : 'Sound is off';
  };
  b.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* still switches, just won't remember */ }
    if (on) tone({ f: 660, f2: 990, dur: 0.12, vol: 0.18 }); // a chirp, so you know it is back
    else ac?.suspend().catch(() => {});
    paint();
  });
  paint();
  return b;
}

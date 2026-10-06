// Tests lab layouts on a background thread (a Web Worker), so the page keeps
// moving while the solver works. The search itself is searchLayouts() in
// lab.js; this only passes messages in and out.

import { searchLayouts } from './lab.js';

self.onmessage = ({ data }) => searchLayouts(data, (msg) => self.postMessage(msg));

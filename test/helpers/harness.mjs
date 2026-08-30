// Testharnas: start een jsdom-omgeving waarin content.js kan draaien, en geeft
// de interne test-API terug (window.__onsHelperTestApi).
//
// Twee dingen moeten hier gestubd worden:
//  1) de chrome-extensie-API's, die in Node niet bestaan;
//  2) zichtbaarheid. content.js gebruikt visible() = offsetParent/getClientRects,
//     en jsdom doet geen layout: daar is ALLES onzichtbaar, waardoor de
//     cliëntdetectie niets zou vinden. We laten daarom elk element dat in het
//     document hangt als zichtbaar gelden, tenzij het expliciet verborgen is.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_JS = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

export function fixture(name) {
  return fs.readFileSync(path.join(ROOT, 'test', 'fixtures', name), 'utf8');
}

export function bootHelper({ html = '<!doctype html><html><body></body></html>', url } = {}) {
  const dom = new JSDOM(html, {
    url: url || 'https://impegno.ons-dossier.nl/calendar/invitee/123/day?date=2026-08-30',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;

  // (1) chrome-API's
  w.chrome = {
    runtime: {
      id: 'test',
      getManifest: () => ({ version: '1.6.181' }),
      getURL: (p) => 'chrome-extension://test/' + p,
      onMessage: { addListener: () => {} },
      sendMessage: () => {},
    },
    storage: {
      local: { get: (_k, cb) => cb && cb({}), set: (_v, cb) => cb && cb() },
      managed: { get: (_k, cb) => cb && cb({}) },
      onChanged: { addListener: () => {} },
    },
  };
  // Geen echte netwerkcalls in tests.
  w.fetch = () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve(null), text: () => Promise.resolve('') });

  // (2) zichtbaarheid + geometrie
  const El = w.Element.prototype;
  El.getClientRects = function () {
    if (!this.isConnected) return [];
    if (this.hasAttribute && this.hasAttribute('data-test-hidden')) return [];
    return [this.getBoundingClientRect()];
  };
  El.getBoundingClientRect = function () {
    // Optioneel expliciete coördinaten meegeven: data-test-rect="top,left,breedte,hoogte"
    const spec = this.getAttribute && this.getAttribute('data-test-rect');
    let top = 0, left = 0, width = 200, height = 20;
    if (spec) {
      const p = spec.split(',').map((n) => parseFloat(n.trim()) || 0);
      [top, left, width, height] = [p[0] || 0, p[1] || 0, p[2] || 200, p[3] || 20];
    }
    return {
      top, left, width, height,
      right: left + width, bottom: top + height,
      x: left, y: top, toJSON() { return this; },
    };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.isConnected && !(this.hasAttribute && this.hasAttribute('data-test-hidden')) ? (this.parentElement || w.document.body) : null; },
  });

  w.__ONS_EXPOSE_FOR_TEST = true;
  w.eval(CONTENT_JS);

  return { dom, window: w, document: w.document, api: w.__onsHelperTestApi || {} };
}

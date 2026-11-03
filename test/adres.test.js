// Adreswijzigingen van ONS zelf (single-page app): de main-world meldt
// pushState/replaceState, zodat het content-script meteen reageert en niet
// pas bij zijn eigen controle (elke seconde, alleen nog een vangnet).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const ONS = 'https://impegno.onsagenda.nl';

test('main-world: pushState en replaceState van de pagina geven een seintje, zonder adres', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { url: ONS + '/invitees/1/calendar/week', runScripts: 'outside-only' });
  const w = dom.window;
  const gezien = [];
  w.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'urlGewijzigd') gezien.push(ev.data); });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  w.history.pushState({}, '', '/invitees/1/calendar/day?date=2026-11-03');
  w.history.replaceState({}, '', '/clients/9');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gezien.length, 2);
  assert.doesNotMatch(JSON.stringify(gezien), /clients|invitees/, 'alleen een seintje');
  assert.equal(w.location.pathname, '/clients/9', 'de navigatie zelf werkt gewoon');
});

test('content: op het seintje van de main-world meteen een locationchange', async () => {
  const { window, dom } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  await new Promise((r) => setTimeout(r, 30));
  let gemeld = 0;
  window.addEventListener('locationchange', () => { gemeld++; });
  // Zoals ONS navigeert: het adres verandert zonder dat de geïsoleerde wereld het ziet.
  dom.reconfigure({ url: ONS + '/invitees/1/calendar/day?date=2026-11-03' });
  window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'urlGewijzigd' }, origin: window.location.origin, source: window }));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(gemeld, 1, 'meteen, niet pas na een seconde');
});

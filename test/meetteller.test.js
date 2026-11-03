// Meetteller (beheer: features.meetteller, standaard uit): hoeveel verzoeken
// ONS zelf doet en hoeveel de hulp erbij doet, per soort adres, zonder
// getallen of waarden.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPatroon, meetPatroon, meettellerOverzicht, voegTellingToe, MAX_PATRONEN } from '../src/shared/meetteller.js';
import { bootHelper } from './helpers/harness.mjs';
import { createHash } from 'node:crypto';
import { debugHash, sha256Hex } from '../src/shared/sha256.js';

const ONS = 'https://impegno.onsagenda.nl';

test('soort adres: id\'s, datums en zoektermen eruit, layer blijft', () => {
  assert.equal(meetPatroon('/calendar/invitee/42479/entries/week?date=2026-11-02&layer=events', 'GET', ONS), 'GET /calendar/invitee/{n}/entries/week?date=…&layer=events');
  assert.equal(meetPatroon('/search_panel/clients?term=Tamara%20Test&usage=event&out_of_care=false&page=1', 'GET', ONS), 'GET /search_panel/clients?term=…&usage=event&out_of_care=…&page=…');
  assert.equal(meetPatroon(ONS + '/invitees/13970,45267/calendar/day?date=2026-11-02', 'get', ONS), 'GET /invitees/{n}/calendar/day?date=…');
  assert.equal(meetPatroon('/calendar/events', 'POST', ONS), 'POST /calendar/events');
  assert.equal(meetPatroon('/events/new?invitee_ids%5B%5D=1&invitee_ids%5B%5D=2', 'GET', ONS), 'GET /events/new?invitee_ids[]=…', 'dubbele namen één keer');
  assert.equal(meetPatroon('https://impegno.ons-samen.nl/wapi/widget/widgetURLbyTag?tag=uw-hub', 'GET', ONS), 'GET impegno.ons-samen.nl/wapi/widget/widgetURLbyTag?tag=…', 'ander domein met de naam erbij');
  assert.equal(meetPatroon('/calendar/invitee/1/registrations/9a8b7c6d5e4f3a2b1c0d/details', 'GET', ONS), 'GET /calendar/invitee/{n}/registrations/{n}/details');
  assert.equal(meetPatroon('javascript:alert(1)', 'GET', ONS), '');
  assert.ok(!/Tamara|42479|2026/.test(meetPatroon('/x/Tamara-42479?q=2026', 'GET', ONS).replace('Tamara-{n}', '')), 'getallen weg');
  assert.equal(isPatroon('GET /calendar/invitee/{n}/entries/week?date=…&layer=events'), true);
  assert.equal(isPatroon('<img src=x onerror=alert(1)>'), false);
});

test('telling optellen, met een maximum aan adressen; overzicht met het extra percentage', () => {
  let t = voegTellingToe(null, { 'GET /a': { ons: 3, hulp: 1 } }, 1000);
  t = voegTellingToe(t, { 'GET /a': { ons: 1 }, 'GET /b': { hulp: 2 }, 'kapot': { ons: 9 } }, 2000);
  assert.deepEqual(t, { start: 1000, bijgewerkt: 2000, patronen: { 'GET /a': { ons: 4, hulp: 1 }, 'GET /b': { ons: 0, hulp: 2 } } });
  const o = meettellerOverzicht(t);
  assert.deepEqual([o.ons, o.hulp, o.extraProcent, o.rijen.map((r) => r.patroon)], [4, 3, 75, ['GET /a', 'GET /b']]);
  const vol = {}; for (let i = 0; i < MAX_PATRONEN + 5; i++) vol['GET /p' + i] = { ons: 1 };
  assert.equal(Object.keys(voegTellingToe(null, vol, 1).patronen).length, MAX_PATRONEN);
  assert.equal(meettellerOverzicht(null).extraProcent, null);
});

function opzet() {
  const b = bootHelper({ url: ONS + '/invitees/42479/calendar/week?date=2026-11-02' });
  const opgeslagen = [];
  let stand = null;
  b.window.chrome.storage.local = { get: (k, cb) => cb({ 'onsHelper.meetteller': stand }), set: (obj) => { stand = obj['onsHelper.meetteller']; opgeslagen.push(stand); }, remove: () => {} };
  b.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  const naarMain = [];
  b.window.addEventListener('message', (ev) => { if (ev.data && ev.data.dir === 'to-main' && ev.data.type === 'meettellerZetten') naarMain.push(ev.data.aan); });
  b.window.postMessage = (data) => b.window.dispatchEvent(new b.window.MessageEvent('message', { data, origin: b.window.location.origin, source: b.window }));
  const vanMain = (data) => b.window.dispatchEvent(new b.window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', ...data }, origin: b.window.location.origin, source: b.window }));
  return { ...b, opgeslagen, vanMain, naarMain };
}

test('content: standaard uit, aan via de configuratie; telt de hulp en ONS en schrijft alleen aantallen weg', async () => {
  const { api, window, opgeslagen, vanMain, naarMain } = opzet();
  await api.getJson('/calendar/holidays');
  api.werkMeettellerBij();
  window.dispatchEvent(new window.Event('pagehide'));
  assert.deepEqual(opgeslagen, [], 'uit: niets geteld');
  api.applyHelperConfig({ features: { meetteller: true } });
  api.werkMeettellerBij();
  assert.deepEqual(naarMain, [true], 'de main-world gaat ONS-verzoeken melden');
  await api.getJson('/calendar/invitee/42479/entries/week?date=2026-11-02&layer=events');
  await api.getJson('/calendar/invitee/42479/entries/week?date=2026-11-09&layer=events');
  await api.postJson('/calendar/events', { event: { name: 'Tamara' } });
  vanMain({ type: 'verzoekGezien', patroon: 'GET /calendar/invitee/{n}/entries/week?date=…&layer=events' });
  vanMain({ type: 'verzoekGezien', patroon: '<script>' });
  vanMain({ type: 'mainWorldKlaar' });
  assert.deepEqual(naarMain, [true, true], 'een later geladen main-world krijgt het opnieuw');
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(opgeslagen.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(opgeslagen[0].patronen)), {
    'GET /calendar/invitee/{n}/entries/week?date=…&layer=events': { ons: 1, hulp: 2 },
    'POST /calendar/events': { ons: 0, hulp: 1 },
  });
  assert.doesNotMatch(JSON.stringify(opgeslagen), /42479|Tamara|2026-11/, 'geen id, naam of datum');
  api.applyHelperConfig({ features: { meetteller: false } });
  api.werkMeettellerBij();
  assert.deepEqual(naarMain, [true, true, false]);
  await api.getJson('/calendar/holidays');
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(opgeslagen.length, 1, 'weer uit: niets meer');
});

test('main-world: meldt verzoeken van ONS zelf alleen als de meetteller aan staat, met alleen het soort adres', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { url: ONS + '/invitees/42479/calendar/week', runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, clone() { return this; }, text: () => Promise.resolve('{}') });
  const gezien = [];
  w.addEventListener('message', (ev) => { const d = ev.data; if (d && d.dir === 'from-main' && (d.type === 'verzoekGezien' || d.type === 'mainWorldKlaar')) gezien.push(d.type === 'verzoekGezien' ? d.patroon : 'klaar'); });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const stuur = (aan) => w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'meettellerZetten', aan }, origin: w.location.origin, source: w }));
  await new Promise((r) => setTimeout(r, 20));
  w.fetch('/calendar/invitee/42479/entries/week?date=2026-11-02&layer=events');
  stuur(true);
  w.fetch('/calendar/invitee/42479/entries/week?date=2026-11-09&layer=events');
  const xhr = new w.XMLHttpRequest(); xhr.open('GET', '/search_panel/clients?term=Tamara&page=1');
  try { xhr.send(); } catch (e) {}
  stuur(false);
  w.fetch('/calendar/holidays');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(gezien, ['klaar', 'GET /calendar/invitee/{n}/entries/week?date=…&layer=events', 'GET /search_panel/clients?term=…&page=…']);
});

test('SHA-256 voor het debugwachtwoord: gelijk aan de standaard (en dus aan crypto.subtle in het beheerscherm)', () => {
  for (const t of ['', 'abc', 'geheim123', 'é€', 'x'.repeat(200)]) assert.equal(sha256Hex(t), createHash('sha256').update(t, 'utf8').digest('hex'), JSON.stringify(t));
  assert.equal(debugHash('geheim123'), createHash('sha256').update('onsah-debug:geheim123').digest('hex'));
});

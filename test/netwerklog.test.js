// Netwerklog (zijpaneel, Info, Debug, Netwerk): elk verzoek van ONS zelf en
// van de hulp, alleen zolang het zijpaneel erom vraagt, alleen in het geheugen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const ONS = 'https://impegno.onsagenda.nl';

function opzet() {
  const b = bootHelper({ url: ONS + '/invitees/42479/calendar/week?date=2026-11-02' });
  b.window.fetch = (pad) => Promise.resolve({
    ok: !/kapot/.test(pad), status: /kapot/.test(pad) ? 500 : 200,
    headers: { get: (h) => (h === 'content-length' ? '1234' : null) }, json: () => Promise.resolve({}),
  });
  const naarMain = [];
  b.window.addEventListener('message', (ev) => { if (ev.data && ev.data.dir === 'to-main' && ev.data.type === 'netwerklogZetten') naarMain.push(ev.data.aan); });
  b.window.postMessage = (data) => b.window.dispatchEvent(new b.window.MessageEvent('message', { data, origin: b.window.location.origin, source: b.window }));
  const vanMain = (data) => b.window.dispatchEvent(new b.window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', ...data }, origin: b.window.location.origin, source: b.window }));
  return { ...b, naarMain, vanMain };
}
const kaal = (x) => JSON.parse(JSON.stringify(x));

test('content: uit tot het zijpaneel vraagt; dan ONS en de hulp met methode, adres, status, duur en grootte', async () => {
  const { api, window, naarMain, vanMain } = opzet();
  await api.getJson('/calendar/holidays');
  vanMain({ type: 'netwerkVerzoek', methode: 'GET', url: '/x', status: 200, ms: 5 });
  assert.equal(api.netwerklogAan(), false);
  assert.deepEqual(naarMain, [], 'de main-world meldt nog niets');
  assert.deepEqual(kaal(api.netwerklogSinds(0)), [], 'niets van voor het aanzetten');
  assert.deepEqual(naarMain, [true]);
  assert.equal(api.netwerklogAan(), true);
  await api.getJson('/calendar/invitee/42479/entries/week?date=2026-11-02&layer=events');
  await api.postJson('/calendar/events', { event: { name: 'Tamara' } });
  await assert.rejects(api.getJson('/kapot'));
  vanMain({ type: 'netwerkVerzoek', methode: 'get', url: ONS + '/calendar/holidays?year=2026', status: 304, ms: 12.6, grootte: null });
  vanMain({ type: 'netwerkVerzoek', methode: 'GET', url: 'https://impegno.ons-samen.nl/wapi/widget?tag=a', status: 0, ms: 3, grootte: 10 });
  vanMain({ type: 'mainWorldKlaar' });
  assert.deepEqual(naarMain, [true, true], 'een later geladen main-world krijgt het opnieuw');
  const items = kaal(api.netwerklogSinds(0)).map(({ id, tijd, ...rest }) => rest);
  assert.deepEqual(items, [
    { bron: 'hulp', methode: 'GET', url: '/calendar/invitee/42479/entries/week?date=2026-11-02&layer=events', status: 200, ms: items[0].ms, grootte: 1234 },
    { bron: 'hulp', methode: 'POST', url: '/calendar/events', status: 200, ms: items[1].ms, grootte: 1234 },
    { bron: 'hulp', methode: 'GET', url: '/kapot', status: 500, ms: items[2].ms, grootte: 1234 },
    { bron: 'ons', methode: 'GET', url: '/calendar/holidays?year=2026', status: 304, ms: 13, grootte: null },
    { bron: 'ons', methode: 'GET', url: 'https://impegno.ons-samen.nl/wapi/widget?tag=a', status: 0, ms: 3, grootte: 10 },
  ]);
  assert.doesNotMatch(JSON.stringify(items), /Tamara/, 'geen inhoud');
  const alle = api.netwerklogSinds(0);
  assert.equal(kaal(api.netwerklogSinds(alle[2].id)).length, 2, 'alleen wat na sinds kwam');
  assert.equal(typeof api.netwerklogSessie(), 'string');
  // Vraagt het zijpaneel 15 seconden niet meer, dan logt het niet meer.
  const echt = window.Date.now;
  try {
    window.Date.now = () => echt() + 16000;
    assert.equal(api.netwerklogAan(), false);
    await api.getJson('/calendar/holidays');
    window.Date.now = echt;
    assert.equal(kaal(api.netwerklogSinds(alle.at(-1).id)).length, 0, 'na het verlopen niets meer gelogd');
  } finally { window.Date.now = echt; }
});

test('main-world: meldt verzoeken van ONS (fetch en XHR) alleen als het log aan staat, zonder inhoud', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { url: ONS + '/invitees/42479/calendar/week', runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = (url) => (/kapot/.test(url) ? Promise.reject(new Error('net'))
    : Promise.resolve({ ok: true, status: 200, headers: { get: (h) => (h === 'content-length' ? '2048' : null) }, clone() { return this; }, text: () => Promise.resolve('{"naam":"Tamara"}') }));
  // Een nep-XHR: geen echt netwerk in de test.
  class NepXhr {
    constructor() { this.l = {}; this.status = 0; }
    open(m, u) { this.m = m; this.u = u; }
    send() { setTimeout(() => { this.status = 404; (this.l.loadend || []).forEach((f) => f()); }, 5); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    getResponseHeader(h) { return h === 'content-length' ? '17' : null; }
  }
  w.XMLHttpRequest = NepXhr;
  const gezien = [];
  w.addEventListener('message', (ev) => { const d = ev.data; if (d && d.dir === 'from-main' && d.type === 'netwerkVerzoek') gezien.push(d); });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const stuur = (aan) => w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'netwerklogZetten', aan }, origin: w.location.origin, source: w }));
  await w.fetch('/calendar/holidays');
  stuur(true);
  await w.fetch('/calendar/invitee/42479/entries/week?date=2026-11-09&layer=events');
  await w.fetch('/kapot').catch(() => {});
  const xhr = new w.XMLHttpRequest(); xhr.open('POST', '/search_panel/clients?term=Tamara'); xhr.send('{"x":1}');
  await new Promise((r) => setTimeout(r, 30));
  stuur(false);
  await w.fetch('/calendar/holidays');
  await new Promise((r) => setTimeout(r, 20));
  const kort = gezien.map((d) => [d.methode, d.url, d.status, d.grootte, typeof d.ms]);
  assert.deepEqual(kort, [
    ['GET', '/calendar/invitee/42479/entries/week?date=2026-11-09&layer=events', 200, 2048, 'number'],
    ['GET', '/kapot', 0, null, 'number'],
    ['POST', '/search_panel/clients?term=Tamara', 404, 17, 'number'],
  ]);
  assert.doesNotMatch(JSON.stringify(gezien), /naam|"x":1/, 'geen inhoud van verzoek of antwoord');
});

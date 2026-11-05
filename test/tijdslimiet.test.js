// Tijdslimiet op verzoeken: geen knop die blijft draaien als ONS of de
// routedienst niet antwoordt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { metTijdslimiet, isTijdslimiet, TIJDSLIMIET_MS } from '../src/shared/tijdslimiet.js';
import { roadMatrix, _clearRouteCache } from '../src/sidepanel/geo.js';
import { bootHelper } from './helpers/harness.mjs';

const ONS = 'https://impegno.onsagenda.nl';
const antwoord = (status) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: () => Promise.resolve({ ok: 1 }), clone() { return this; }, text: () => Promise.resolve('{}') });
const nooit = () => new Promise(() => {});

test('metTijdslimiet: standaard 20 seconden, afbreken met een TimeoutError en het signaal', async () => {
  assert.equal(TIJDSLIMIET_MS, 20000);
  let signaal = null;
  const t0 = Date.now();
  await assert.rejects(metTijdslimiet((u, i) => { signaal = i.signal; return nooit(); }, '/x', { method: 'GET' }, 30), (e) => {
    assert.equal(isTijdslimiet(e), true);
    assert.match(e.message, /Geen antwoord binnen 0 seconden/);
    return true;
  });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(signaal.aborted, true, 'het verzoek is afgebroken');
});

test('metTijdslimiet: een snel antwoord komt gewoon door, de eigen opties blijven', async () => {
  let init = null;
  const r = await metTijdslimiet((u, i) => { init = i; return Promise.resolve('klaar'); }, '/x', { method: 'POST', body: 'b' }, 50);
  assert.equal(r, 'klaar');
  assert.equal(init.method, 'POST');
  assert.equal(init.body, 'b');
  assert.equal(init.signal.aborted, false, 'niet afgebroken na een antwoord');
  await assert.rejects(metTijdslimiet(() => Promise.reject(new Error('net')), '/x', {}, 50), /net/);
  assert.equal(isTijdslimiet(new Error('net')), false);
});

test('GET naar ONS: na de limiet een fout, en niet opnieuw proberen', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  api._zetWachtBasis(1); api._wisTeDruk(); api._zetTijdslimieten(40, 60);
  let n = 0;
  window.fetch = () => { n++; return nooit(); };
  await assert.rejects(api.getJson('/a'), /Geen antwoord binnen/);
  assert.equal(n, 1, 'een trage ONS niet nog eens belasten');
  // Een gewone netwerkfout wel opnieuw (zoals altijd).
  n = 0;
  window.fetch = () => { n++; return n < 3 ? Promise.reject(new Error('net')) : Promise.resolve(antwoord(200)); };
  assert.deepEqual(JSON.parse(JSON.stringify(await api.getJson('/b'))), { ok: 1 });
  assert.equal(n, 3);
  api._zetTijdslimieten();
});

test('POST naar ONS: na de limiet een fout die zegt dat het toch opgeslagen kan zijn', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  api._zetTijdslimieten(40, 60);
  let n = 0;
  window.fetch = () => { n++; return nooit(); };
  await assert.rejects(api.postJson('/events', { a: 1 }), (e) => {
    assert.match(e.message, /binnen 0 seconden geen antwoord\. Kijk in de agenda of het toch is opgeslagen/);
    return true;
  });
  assert.equal(n, 1, 'een POST nooit opnieuw');
  window.fetch = () => Promise.resolve(antwoord(200));
  assert.equal((await api.postJson('/events', { a: 1 })).status, 200);
  api._zetTijdslimieten();
});

test('routes: een verzoek zonder antwoord stopt (TimeoutError), met het signaal mee', async () => {
  _clearRouteCache();
  let signaal = null;
  const gewoon = setTimeout;
  // De limiet is 20 s: laat de timer hier meteen aflopen.
  globalThis.setTimeout = (f, ms) => gewoon(f, ms === TIJDSLIMIET_MS ? 5 : ms);
  try {
    await assert.rejects(roadMatrix({ key: 'k' }, ['2611EB', '2511AA'], (u, i) => { signaal = i.signal; return nooit(); }), (e) => isTijdslimiet(e));
  } finally { globalThis.setTimeout = gewoon; }
  assert.equal(signaal.aborted, true);
});

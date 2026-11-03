// Rustig voor ONS: opnieuw proberen met backoff, stoppen bij 'te druk', en
// vooraf laden alleen met het zijpaneel open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const ONS = 'https://impegno.onsagenda.nl';
const antwoord = (status, extra = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (h) => (extra[h.toLowerCase()] ?? null) }, json: () => Promise.resolve({ ok: 1 }) });

test('GET: bij een netwerkfout of 500/502/504 hooguit twee keer opnieuw, daarna de fout', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  api._zetWachtBasis(1); api._wisTeDruk();
  let n = 0;
  window.fetch = () => { n++; return n === 1 ? Promise.reject(new Error('net')) : n === 2 ? Promise.resolve(antwoord(502)) : Promise.resolve(antwoord(200)); };
  assert.deepEqual(JSON.parse(JSON.stringify(await api.getJson('/a'))), { ok: 1 });
  assert.equal(n, 3, 'twee keer opnieuw en toen gelukt');
  n = 0;
  window.fetch = () => { n++; return Promise.resolve(antwoord(500)); };
  await assert.rejects(api.getJson('/b'), /HTTP 500/);
  assert.equal(n, 3, 'niet vaker dan twee keer opnieuw');
  n = 0;
  window.fetch = () => { n++; return Promise.resolve(antwoord(404)); };
  await assert.rejects(api.getJson('/c'), /HTTP 404/);
  assert.equal(n, 1, 'een 404 niet opnieuw');
});

test('429 of 503: niet opnieuw, en even geen vooraf laden (Retry-After, tussen 10 s en 10 min)', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  api._zetWachtBasis(1); api._wisTeDruk();
  let n = 0;
  window.fetch = () => { n++; return Promise.resolve(antwoord(429, { 'retry-after': '120' })); };
  await assert.rejects(api.getJson('/a'), /HTTP 429/);
  assert.equal(n, 1);
  assert.equal(api.onsTeDruk(), true);
  assert.equal(api.pauzeNa(antwoord(503, { 'retry-after': '5' })), 10000, 'minstens 10 s');
  assert.equal(api.pauzeNa(antwoord(503, { 'retry-after': '99999' })), 600000, 'hooguit 10 min');
  assert.equal(api.pauzeNa(antwoord(503)), 60000, 'zonder Retry-After een minuut');
  // Zolang het te druk is: niet opnieuw proberen na een 500.
  n = 0;
  window.fetch = () => { n++; return Promise.resolve(antwoord(500)); };
  await assert.rejects(api.getJson('/b'), /HTTP 500/);
  assert.equal(n, 1);
  api._wisTeDruk();
});

test('vooraf laden: alleen met het zijpaneel open en niet als ONS te druk is', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week?date=2026-11-02' });
  await new Promise((r) => setTimeout(r, 30));
  api._zetWachtBasis(1); api._wisTeDruk(); api._clearPreloadCache();
  const gevraagd = [];
  // Alleen wat het vooraf laden vraagt (planhulp: de lagen voor afwezigheid
  // en Outlook); het weekoverzicht van de bekeken week laat het hier buiten.
  const vooraf = () => gevraagd.filter((u) => /layer=(unavailabilities|outlook_appointments)/.test(u));
  window.fetch = (u) => { gevraagd.push(String(u)); return Promise.resolve(antwoord(200)); };
  api._agendaPage.sidePanelOpen = false;
  api.preloadPanelData();
  await new Promise((r) => setTimeout(r, 1200));
  assert.deepEqual(vooraf(), [], 'zijpaneel dicht: niets vooraf');
  // Te druk: ook met het zijpaneel open niets.
  window.fetch = () => Promise.resolve(antwoord(503));
  await api.getJson('/x').catch(() => {});
  window.fetch = (u) => { gevraagd.push(String(u)); return Promise.resolve(antwoord(200)); };
  api._agendaPage.sidePanelOpen = true;
  api.preloadPanelData();
  await new Promise((r) => setTimeout(r, 1200));
  assert.deepEqual(vooraf(), [], 'te druk: niets vooraf');
  // Zijpaneel open en niet te druk: wel.
  api._wisTeDruk();
  api.preloadPanelData();
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(vooraf().length > 0, 'dan wel vooraf laden');
  api._agendaPage.sidePanelOpen = false;
});

test('foutbuffer: safe() en mislukte verzoeken komen erin, zonder gegevens; hooguit 100', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  api._zetWachtBasis(1); api._wisTeDruk(); api._wisFouten();
  api._safe(() => { throw new Error('cliënt 106839 niet gevonden'); }, 'test plek');
  window.fetch = () => Promise.resolve(antwoord(500));
  await api.getJson('/calendar/invitee/42479/entries/week?date=2026-11-02&term=Tamara').catch(() => {});
  window.fetch = () => Promise.resolve(antwoord(404));
  await api.getJson('/bestaat/niet').catch(() => {});
  const f = JSON.parse(JSON.stringify(api.foutLijst()));
  assert.deepEqual(f.map((x) => [x.plek, x.melding]), [
    ['test plek', 'cliënt … niet gevonden'],
    ['GET /calendar/invitee/{n}/entries/week', 'HTTP 500'],
  ], 'een 404 telt niet als fout; nummers en zoekdeel eruit');
  assert.equal(api.plekUitStack('Error: x\n    at a (chrome-extension://abc/dist/content.js:1:23456)\n    at b (chrome-extension://abc/dist/content.js:1:999)'), 'content.js:1:23456');
  assert.equal(api.schoneMelding(new TypeError('x')), 'TypeError: x');
  for (let i = 0; i < 120; i++) api._safe(() => { throw new Error('n' + i); }, 'lus');
  assert.equal(api.foutLijst().length, 100);
  assert.equal(api.foutLijst().at(-1).melding, 'n119');
  api._wisFouten();
});

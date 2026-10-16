// Het lege afspraakmodel van ONS (GET /calendar/events/new) vooraf aanvullen
// met wat de planhulp klaarzette: datum, tijden en afspraaktype.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

// Zoals ONS het lege model stuurt (ingekort, zonder medewerkergegevens).
const LEEG = () => ({ valid_from: null, start_time: null, end_time: null, client_invitations: [], client_present: true, clients: [],
  employees: [{ id: 42479, authorized: true }], groups: [], labels: [], location: {}, teams: [],
  meta: { extended_workflow: true, new_record: true, create_url: '/calendar/events', remove_url: null, show_travel_time: true } });

function metTijdzone(t) {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
}

test('planhulp zet datum, tijden en afspraaktype klaar in de vorm van het ONS-model', (t) => {
  metTijdzone(t);
  const { api, window } = bootHelper();
  window.HTMLAnchorElement.prototype.click = function () {};
  assert.equal(api.openNewEvent({ date: '2026-10-20', time: '10:00', minutes: 60, label: { id: 46, name: 'JG Huisbezoek' } }).ok, true);
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.deepEqual(klaar.model, { valid_from: '2026-10-20', start_time: '2026-10-20T10:00:00+02:00', end_time: '2026-10-20T11:00:00+02:00', labels: [{ id: 46, name: 'JG Huisbezoek' }] });
  // Na de wissel naar wintertijd: +01:00.
  api.openNewEvent({ date: '2026-10-27', time: '09:15', minutes: 30 });
  const winter = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.deepEqual(winter.model, { valid_from: '2026-10-27', start_time: '2026-10-27T09:15:00+01:00', end_time: '2026-10-27T09:45:00+01:00' }, 'zonder type geen labels');
  // Een ongeldig type gaat niet mee.
  api.openNewEvent({ date: '2026-10-20', time: '10:00', minutes: 60, label: { id: 'x', name: '<b>' } });
  assert.equal(JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment')).model.labels, undefined);
});

test('eigen formulieren (meerdere afspraken plannen) houden hun eigen type', () => {
  const { api, window } = bootHelper();
  window.HTMLAnchorElement.prototype.click = function () {};
  api.openNewEvent({ date: '2026-11-02', time: '09:00', minutes: 60, multi: true, label: { id: 46, name: 'JG Huisbezoek' },
    eigen: [{ date: '2026-11-02', time: '10:15', minutes: 90, clientIds: ['51486'], label: { id: 47, name: 'Face to face' } }] });
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingDuplicates'));
  assert.deepEqual(klaar.eigen[0].label, { id: 47, name: 'Face to face' });
});

async function mainWorld() {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/events/new?invitee_ids%5B%5D=42479', runScripts: 'outside-only' });
  const w = dom.window;
  w.Response = Response;
  let antwoord = JSON.stringify(LEEG());
  w.fetch = () => Promise.resolve(new Response(antwoord, { status: 200, headers: { 'content-type': 'application/json' } }));
  // Een nep-XHR met de getters op het prototype, zoals in de browser.
  class NepXHR {
    open() {}
    send() { this.readyState = 4; this.status = 200; }
    addEventListener() {}
    get responseText() { return antwoord; }
    get response() { return this.responseType === 'json' ? JSON.parse(antwoord) : antwoord; }
  }
  w.XMLHttpRequest = NepXHR;
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const zet = (model, oud) => w.sessionStorage.setItem('onsHelper.pendingAppointment', JSON.stringify({ date: '2026-10-20', time: '10:00', ts: Date.now() - (oud || 0), model }));
  return { w, zet, zetAntwoord: (j) => { antwoord = JSON.stringify(j); } };
}
const MODEL = { valid_from: '2026-10-20', start_time: '2026-10-20T10:00:00+02:00', end_time: '2026-10-20T11:00:00+02:00', labels: [{ id: 46, name: 'JG Huisbezoek' }] };

test('main-world vult het lege afspraakmodel aan (fetch), alleen als de planhulp iets klaarzette', async () => {
  const { w, zet, zetAntwoord } = await mainWorld();
  const haal = async (url, init) => (await w.fetch(url, init)).json();
  // Niets klaargezet: precies het antwoord van ONS.
  assert.deepEqual(await haal('/calendar/events/new?invitee_ids%5B%5D=42479'), LEEG());
  zet(MODEL);
  const j = await haal('/calendar/events/new?invitee_ids%5B%5D=42479');
  assert.equal(j.valid_from, '2026-10-20');
  assert.equal(j.start_time, '2026-10-20T10:00:00+02:00');
  assert.equal(j.end_time, '2026-10-20T11:00:00+02:00');
  assert.deepEqual(j.labels, [{ id: 46, name: 'JG Huisbezoek' }]);
  assert.deepEqual(j.employees, LEEG().employees, 'de rest blijft zoals ONS het stuurde');
  assert.deepEqual(j.meta, LEEG().meta);
  // Andere adressen of een POST: niet aanraken.
  assert.deepEqual(await haal('/calendar/events/new/extra'), LEEG());
  assert.deepEqual(await haal('/calendar/events/new', { method: 'POST' }), LEEG());
  // Wat ONS zelf al invult, blijft staan.
  zetAntwoord({ ...LEEG(), labels: [{ id: 9, name: 'Eigen' }], start_time: '2026-10-21T08:00:00+02:00' });
  const eigen = await haal('/calendar/events/new');
  assert.deepEqual(eigen.labels, [{ id: 9, name: 'Eigen' }]);
  assert.equal(eigen.start_time, '2026-10-21T08:00:00+02:00');
  assert.equal(eigen.valid_from, '2026-10-20', 'alleen lege velden');
  // Geen nieuw model (bestaande afspraak): niets.
  zetAntwoord({ ...LEEG(), meta: { ...LEEG().meta, new_record: false } });
  assert.equal((await haal('/calendar/events/new')).valid_from, null);
  // Te oud klaargezet (meer dan twee minuten): niets.
  zetAntwoord(LEEG());
  zet(MODEL, 3 * 60 * 1000);
  assert.deepEqual(await haal('/calendar/events/new'), LEEG());
});

test('main-world vult het lege afspraakmodel ook aan als ONS het met XHR ophaalt', async () => {
  const { w, zet } = await mainWorld();
  zet(MODEL);
  const x = new w.XMLHttpRequest();
  x.open('GET', '/calendar/events/new?invitee_ids%5B%5D=42479');
  x.send();
  assert.deepEqual(JSON.parse(x.responseText).labels, [{ id: 46, name: 'JG Huisbezoek' }]);
  assert.equal(JSON.parse(x.response).start_time, '2026-10-20T10:00:00+02:00');
  const j = new w.XMLHttpRequest();
  j.responseType = 'json';
  j.open('GET', '/calendar/events/new');
  j.send();
  assert.equal(j.response.valid_from, '2026-10-20');
  // Een ander verzoek blijft ongemoeid.
  const ander = new w.XMLHttpRequest();
  ander.open('GET', '/calendar/events/available_labels');
  ander.send();
  assert.equal(JSON.parse(ander.responseText).labels.length, 0);
});

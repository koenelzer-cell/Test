// Planhulp: één afspraak op meerdere momenten. Het opslaan-verzoek van ONS
// is het voorbeeld; per moment schuiven alleen datum, begin en eind mee.
process.env.TZ = 'Europe/Amsterdam';
import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateEventPayload, inspectEventPayload, remainingMoments } from '../src/content/domain/event-duplicate.js';
// duplicate.js haalt (via het afspraakformulier) modules binnen die bij het
// laden naar location/document kijken: een minimale pagina-omgeving.
const { JSDOM } = await import('jsdom');
const _dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/' });
for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'sessionStorage']) { if (!(k in globalThis)) globalThis[k] = _dom.window[k]; }
const { makeDuplicates } = await import('../src/content/features/appointment/duplicate.js');

// Vorm zoals ONS hem stuurt (POST /calendar/events), met nepgegevens.
const VOORBEELD = () => ({ event: {
  valid_from: '2026-10-27', start_time: '2026-10-27T17:20:00+01:00', end_time: '2026-10-27T18:20:00+01:00',
  client_ids: [1], client_information: { 1: { hour_type_id: 5, care_order_external_id: null, activity_ids: [] } },
  client_present: true, comment: '', custom_location: null, employee_ids: [42479], group: null, groups: [],
  hour_type_id: null, label_ids: [47], labels: [], location: null, location_id: null, name: 'Testafspraak',
  team_ids: [], teams: [], travel_time_after: 0, travel_time_before: 0,
} });

test('voorbeeld lezen: dag, begin en duur', () => {
  assert.deepEqual(inspectEventPayload(VOORBEELD()), { ok: true, date: '2026-10-27', startMin: 17 * 60 + 20, minutes: 60 });
  assert.equal(inspectEventPayload({}).ok, false);
});

test('kopie: zelfde inhoud, ander moment, tijdzone van die dag', () => {
  const k = duplicateEventPayload(VOORBEELD(), { date: '2026-10-20', startMin: 9 * 60 + 15 });
  assert.equal(k.event.valid_from, '2026-10-20');
  assert.equal(k.event.start_time, '2026-10-20T09:15:00+02:00');
  assert.equal(k.event.end_time, '2026-10-20T10:15:00+02:00');
  const { valid_from, start_time, end_time, ...rest } = k.event;
  const { valid_from: a, start_time: b, end_time: c, ...orig } = VOORBEELD().event;
  assert.deepEqual(rest, orig, 'de rest blijft gelijk');
});

test('geen kopie over middernacht of van een herhalende afspraak', () => {
  assert.equal(duplicateEventPayload(VOORBEELD(), { date: '2026-10-20', startMin: 23 * 60 + 30 }), null);
  const herhaald = VOORBEELD(); herhaald.event.recurrence = { frequency: 'weekly' };
  assert.deepEqual(inspectEventPayload(herhaald), { ok: false, reason: 'herhalende afspraak' });
  const zonder = VOORBEELD(); zonder.event.recurrence = null;
  assert.equal(inspectEventPayload(zonder).ok, true, 'leeg herhalingsveld is geen herhaling');
});

test('resterende momenten: zonder het opgeslagen moment en zonder dubbele, op volgorde', () => {
  const r = remainingMoments(VOORBEELD(), [
    { date: '2026-11-03', startMin: 600 }, { date: '2026-10-27', startMin: 17 * 60 + 20 },
    { date: '2026-10-29', startMin: 540 }, { date: '2026-11-03', startMin: 600 }, { date: 'x', startMin: 1 },
  ]);
  assert.deepEqual(r, [{ date: '2026-10-29', startMin: 540 }, { date: '2026-11-03', startMin: 600 }]);
});

test('kopieën maken: per moment één POST, mislukte apart gemeld', async () => {
  const gepost = [];
  const post = (url, body) => { gepost.push([url, body.event.start_time]); return body.event.valid_from === '2026-11-03' ? Promise.reject(new Error('HTTP 422')) : Promise.resolve({}); };
  const r = await makeDuplicates(JSON.stringify(VOORBEELD()), [
    { date: '2026-10-27', startMin: 17 * 60 + 20 }, { date: '2026-10-29', startMin: 540 }, { date: '2026-11-03', startMin: 600 },
  ], post);
  assert.deepEqual(gepost, [['/calendar/events', '2026-10-29T09:00:00+01:00'], ['/calendar/events', '2026-11-03T10:00:00+01:00']]);
  assert.deepEqual(r.made, [{ date: '2026-10-29', startMin: 540 }]);
  assert.deepEqual(r.failed, [{ date: '2026-11-03', startMin: 600 }]);
});

test('kopieën maken: onleesbaar verzoek -> niets posten', async () => {
  let n = 0;
  const r = await makeDuplicates('geen json', [{ date: '2026-10-29', startMin: 540 }], () => { n++; return Promise.resolve(); });
  assert.equal(n, 0);
  assert.ok(r.reason);
});

test('main-world geeft het opslaan-verzoek alleen door als er momenten klaarstaan', async () => {
  const { JSDOM } = await import('jsdom');
  const fs = await import('node:fs');
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, clone() { return { text: () => Promise.resolve('{}') }; } });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const gezien = [];
  w.addEventListener('message', (e) => { if (e.data && e.data.type === 'eventCreated') gezien.push(e.data); });
  const body = JSON.stringify(VOORBEELD());
  w.fetch('/calendar/events', { method: 'POST', body });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gezien.length, 0, 'niets klaargezet: niet doorgeven');
  const klaar = JSON.stringify({ moments: [{ date: '2026-10-29', startMin: 540 }], ts: Date.now() });
  w.sessionStorage.setItem('onsHelper.pendingDuplicates', klaar);
  w.fetch('/calendar/events', { method: 'GET' });
  w.fetch('/calendar/events', { method: 'POST', body });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gezien.length, 1);
  assert.equal(gezien[0].body, body);
  assert.equal(gezien[0].pending, klaar);
});

test('een nagemaakt opslaan-bericht maakt hooguit 19 kopieën', async () => {
  const { bootHelper } = await import('./helpers/harness.mjs');
  const { window } = bootHelper({ url: 'https://impegno.onsagenda.nl/events/new' });
  let gepost = 0;
  window.fetch = () => { gepost++; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('{}') }); };
  const moments = Array.from({ length: 50 }, (_, i) => ({ date: '2026-11-' + String(1 + (i % 28)).padStart(2, '0'), startMin: 480 + i }));
  window.dispatchEvent(new window.MessageEvent('message', { origin: window.location.origin, source: window, data: { __onsah: true, dir: 'from-main', type: 'eventCreated',
    body: JSON.stringify(VOORBEELD()), pending: JSON.stringify({ moments, ts: Date.now() }) } }));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(gepost, 19);
});

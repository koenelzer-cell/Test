// Afspraak maken met een locatie: de boom uit ONS (search_panel/locations/tree)
// en location_id = value in het verzoek.
import test from 'node:test';
import assert from 'node:assert/strict';
import { locatiesUitBoom } from '../src/content/domain/locaties.js';
import { buildEventPayload } from '../src/content/domain/event-create.js';
import { bootHelper } from './helpers/harness.mjs';

// Zoals de gebruiker het antwoord van ONS plakte, met een tak zonder toegang.
const BOOM = [{
  label: 'impegno', value: 1, internal_id: 42, authorized: true, children: [
    { label: 'Begeleiding', value: 8, internal_id: 47, authorized: true, children: [
      { label: 'BG Rotterdam', value: 46, internal_id: 5230, authorized: true, children: [] },
      { label: 'BG Breda', value: 34, internal_id: 5218, authorized: true, children: [] },
    ] },
    { label: 'Behandeling', value: 9, internal_id: 48, authorized: true, children: [
      { label: 'J&G  Oosterhout', value: 60, internal_id: 6000, authorized: false, children: [] },
      { label: 'Kapot', value: 'x', children: [] },
      { label: 'BG Breda', value: 34, children: [] },
    ] },
  ],
}];

test('locaties: alleen de bladeren, met value als id en de groep erboven', () => {
  assert.deepEqual(locatiesUitBoom(BOOM), [
    { id: '46', name: 'BG Rotterdam', groep: 'Begeleiding', kan: true },
    { id: '34', name: 'BG Breda', groep: 'Begeleiding', kan: true },
    { id: '60', name: 'J&G Oosterhout', groep: 'Behandeling', kan: false },
  ], 'internal_id niet, groepen niet te kiezen, dubbel en kapot weg');
  assert.deepEqual(locatiesUitBoom(BOOM[0]).map((l) => l.id), ['46', '34', '60'], 'ook één wortel');
  assert.deepEqual(locatiesUitBoom({ data: BOOM }).length, 3);
  assert.deepEqual(locatiesUitBoom(null), []);
  assert.deepEqual(locatiesUitBoom([{ label: 'Los', value: 5, children: [] }]), [{ id: '5', name: 'Los', groep: '', kan: true }]);
});

test('verzoek: location_id is de value; zonder of onzin blijft het null', () => {
  const basis = { date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [{ id: 11142, hourTypeId: 5 }] };
  assert.equal(buildEventPayload({ ...basis, locationId: 46 }).event.location_id, 46);
  assert.equal(buildEventPayload({ ...basis, locationId: '34' }).event.location_id, 34);
  assert.equal(buildEventPayload({ ...basis, locationId: 'x' }).event.location_id, null);
  assert.equal(buildEventPayload({ ...basis, locationId: 0 }).event.location_id, null);
  assert.equal(buildEventPayload(basis).event.location_id, null);
  assert.equal(buildEventPayload({ ...basis, locationId: 46 }).event.location, null, 'location zelf blijft leeg');
  assert.equal(buildEventPayload(basis).event.custom_location, null);
});

test('verzoek: zelf ingevulde locatie als tekst in custom_location, dan geen location_id', () => {
  const basis = { date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [{ id: 11142, hourTypeId: 5 }] };
  const p = buildEventPayload({ ...basis, customLocation: '  Wijkcentrum\n De Brug  ', locationId: 46 }).event;
  assert.deepEqual([p.custom_location, p.location_id], ['Wijkcentrum De Brug', null]);
  assert.equal(buildEventPayload({ ...basis, customLocation: '   ' }).event.custom_location, null, 'leeg telt niet');
  assert.equal(buildEventPayload({ ...basis, customLocation: 'x'.repeat(300) }).event.custom_location.length, 200);
});

const DAG = 'https://impegno.onsagenda.nl/invitees/42479/calendar/day?date=2026-10-27';

test('locaties ophalen bij Afspraak maken: één keer per pagina, en meesturen bij maken', async (t) => {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
  const { window, deliver } = bootHelper({ url: DAG });
  const gevraagd = [], gepost = [];
  window.fetch = (url, init) => {
    if (init && init.method === 'POST') { gepost.push(JSON.parse(init.body).event); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); }
    gevraagd.push(url);
    const j = /locations\/tree/.test(url) ? BOOM : /available_labels/.test(url) ? [{ id: 47, name: 'Face to face' }] : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  };
  const r = await deliver({ type: 'ag-event-options', clientIds: [], locaties: true });
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.locations.map((l) => [l.id, l.name, l.kan]))), [['46', 'BG Rotterdam', true], ['34', 'BG Breda', true], ['60', 'J&G Oosterhout', false]]);
  assert.equal(r.locationsError, undefined);
  assert.ok(gevraagd.includes('/search_panel/locations/tree'));
  await deliver({ type: 'ag-event-options', clientIds: [], locaties: true });
  assert.equal(gevraagd.filter((u) => /locations\/tree/.test(u)).length, 1, 'de tweede keer uit het geheugen');
  const zonder = await deliver({ type: 'ag-event-options', clientIds: [] });
  assert.equal(zonder.locations, undefined, 'alleen als erom gevraagd wordt');
  const res = await deliver({ type: 'ag-create-events', events: [
    { date: '2026-10-28', startMin: 600, minutes: 60, clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face Tamara', locationId: 46 },
    { date: '2026-10-29', startMin: 600, minutes: 60, nietClient: true, hourTypeId: 77, name: 'Teamoverleg', locationId: 34 },
    { date: '2026-10-30', startMin: 600, minutes: 60, clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face Tamara' },
    { date: '2026-10-31', startMin: 600, minutes: 60, clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face Tamara', customLocation: 'Bij de cliënt thuis' },
  ] });
  assert.deepEqual(JSON.parse(JSON.stringify(res.results)), [{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
  assert.deepEqual(gepost.map((e) => [e.location_id, e.custom_location]), [[46, null], [34, null], [null, null], [null, 'Bij de cliënt thuis']]);
});

test('locaties die ONS niet geeft: Afspraak maken gaat door, met een melding voor de regel Locatie', async () => {
  const { window, deliver } = bootHelper({ url: DAG });
  let vorm = { locaties: [] };
  window.fetch = (url) => {
    if (/locations\/tree/.test(url)) return vorm ? Promise.resolve({ ok: true, json: () => Promise.resolve(vorm) }) : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(/available_labels/.test(url) ? [{ id: 47, name: 'Face to face' }] : {}) });
  };
  const anders = await deliver({ type: 'ag-event-options', clientIds: [], locaties: true });
  assert.equal(anders.ok, true, 'de rest werkt gewoon');
  assert.deepEqual(JSON.parse(JSON.stringify([anders.labels.map((l) => l.id), anders.locations])), [[47], []]);
  assert.match(anders.locationsError, /ONS geeft de locaties in een andere vorm terug/);
  vorm = null;
  const kapot = await deliver({ type: 'ag-event-options', clientIds: [], locaties: true });
  assert.equal(kapot.ok, true);
  assert.equal(kapot.locationsError, 'De locaties konden niet worden opgehaald uit ONS.', 'een fout wordt niet onthouden: opnieuw gevraagd');
});

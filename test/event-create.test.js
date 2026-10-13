// Afspraak maken vanuit de planhulp (zonder formulier).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventPayload, defaultEventName, learnEventMeta, parseLabels, parseProductOptions } from '../src/content/domain/event-create.js';

test('uursoorten met id uit product_list (zoals ONS ze geeft)', () => {
  const json = { basic_list: [
    ['Onlangs gebruikt', [['JW BG H10 Individuele BG midde', 5, [], false, true], ['JGGZ Speciaal ZOU FG2', 1182, [], false, true]]],
    ['Geadviseerd', []],
    ['Toegestaan', [['Behandeling (GGZ 18+)', 1135, [], false, false], ['JW BG H10 Individuele BG midde', 5, [], false, true], ['Kapot'], 'x']],
  ], care_orders: [] };
  assert.deepEqual(parseProductOptions(json), [
    { id: 5, name: 'JW BG H10 Individuele BG midde', recent: true },
    { id: 1182, name: 'JGGZ Speciaal ZOU FG2', recent: true },
    { id: 1135, name: 'Behandeling (GGZ 18+)', recent: false },
  ]);
  assert.deepEqual(parseProductOptions(null), []);
});

test('afspraaktypes uit available_labels', () => {
  assert.deepEqual(parseLabels([{ id: 46, name: 'Huisbezoek', icon: 'home', color: 'lightblue' }, { id: 47, name: 'Face to face' }, { name: 'zonder id' }]),
    [{ id: 46, name: 'Huisbezoek' }, { id: 47, name: 'Face to face' }]);
});

test('meta: alleen ja/nee, getallen en null', () => {
  assert.deepEqual(learnEventMeta({ extended_workflow: true, time_distribution_enabled: true, show_travel_time: true, aantal: 3, naam: 'Tamara', lijst: [1], leeg: null }),
    { extended_workflow: true, time_distribution_enabled: true, show_travel_time: true, aantal: 3, leeg: null });
  assert.equal(learnEventMeta('x'), null);
});

test('naam: afspraaktype en voornaam, zonder streepje', () => {
  assert.equal(defaultEventName('Face to face', 'Tamara Test'), 'Face to face Tamara');
  assert.equal(defaultEventName('', 'Tamara Test'), 'Tamara');
});

test('verzoek zoals het formulier van ONS het verstuurt (uursoort per cliënt)', (t) => {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
  const p = buildEventPayload({ date: '2026-10-27', startMin: 17 * 60 + 20, minutes: 60, employeeIds: ['42479'], clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face - Tamara' },
    { extended_workflow: true, naam: 'weg' });
  assert.deepEqual(p.event, {
    valid_from: '2026-10-27', start_time: '2026-10-27T17:20:00+01:00', end_time: '2026-10-27T18:20:00+01:00',
    client_ids: [11142], client_information: { 11142: { hour_type_id: 5, care_order_external_id: null, activity_ids: [] } },
    client_present: true, clients: [], comment: '', custom_location: null, employee_ids: [42479], employees: [],
    group: null, groups: [], hour_type_id: null, label_ids: [47], labels: [], location: null, location_id: null,
    name: 'Face to face - Tamara', team_ids: [], teams: [], travel_time_after: 0, travel_time_before: 0,
    meta: { extended_workflow: true },
  });
  const r = buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [{ id: 11142, hourTypeId: 5 }], travelBefore: 20, travelAfter: 999 });
  assert.deepEqual([r.event.travel_time_before, r.event.travel_time_after], [20, 240], 'reistijd in minuten, hooguit 4 uur');
  assert.equal(buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [{ id: 11142 }] }), null, 'zonder uursoort niet');
  assert.equal(buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [], clients: [{ id: 11142, hourTypeId: 5 }] }), null, 'zonder medewerker niet');
});

test('niet cliëntgebonden: uursoort op de afspraak zelf, geen cliënt', (t) => {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
  const p = buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [], hourTypeId: 77, name: 'Teamoverleg' });
  assert.deepEqual([p.event.client_ids, p.event.client_information, p.event.client_present, p.event.hour_type_id, p.event.name, p.event.label_ids],
    [[], {}, false, 77, 'Teamoverleg', []]);
  assert.equal(buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [] }), null, 'zonder uursoort niet');
  assert.equal(buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [], clients: [], hourTypeId: 77 }), null, 'zonder medewerker niet');
  const metClient = buildEventPayload({ date: '2026-10-27', startMin: 600, minutes: 60, employeeIds: [42479], clients: [{ id: 11142, hourTypeId: 5 }], hourTypeId: 77 });
  assert.deepEqual([metClient.event.hour_type_id, metClient.event.client_present], [null, true], 'met cliënt blijft de uursoort per cliënt');
});

test('uursoorten zonder cliënt: ook andere groepen, behalve groepen die met Niet beginnen', () => {
  const json = { basic_list: [
    ['Onlangs gebruikt', [['Teamoverleg', 77, []]]],
    ['Indirect', [['Scholing', 78, []], ['Teamoverleg', 77, []]]],
    ['Niet toegestaan', [['Verboden', 79, []]]],
  ] };
  assert.deepEqual(parseProductOptions(json, { alleGroepen: true }), [
    { id: 77, name: 'Teamoverleg', recent: true },
    { id: 78, name: 'Scholing', recent: false },
  ]);
  assert.deepEqual(parseProductOptions(json), [{ id: 77, name: 'Teamoverleg', recent: true }], 'met cliënt: alleen de bekende groepen');
});

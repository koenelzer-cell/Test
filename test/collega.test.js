// Afspraak maken met collega's: zoeken via ONS, nakijken of een collega op
// een moment kan, en de collega's meesturen naar ONS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { beschikbaarheid, medewerkersUitZoek } from '../src/content/domain/collega.js';
import { mapAgendaEntry } from '../src/content/domain/agenda-entries.js';
import { bootHelper } from './helpers/harness.mjs';

function amsterdam(t) {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
}
// Zoals ONS de weekagenda geeft (tijden met tijdzone).
const afs = (dag, van, tot, extra = {}) => ({ id: dag + van, date: dag, type: 'event', start_time: dag + 'T' + van + ':00+01:00', end_time: dag + 'T' + tot + ':00+01:00', time_slot: extra.time_slot || {}, ...extra });
const laag = (l, e) => Object.assign(mapAgendaEntry(e), { layer: l });

// Uit search_panel/employees (zoals de gebruiker het plakte), met wat er niet bij mag.
const ZOEK = { employees: [
  { id: 42479, external_id: 2355, type: 'employee', name: 'Koen Elzer', sortable_name: 'elzer', can_create_event: true, can_view_agenda: null, date_of_birth: '1980-01-01', gender: 'male', identification_no: '104363-1', invitee_type_name: 'Bg begeleider', team: 'Medewerker Forta Services ICT' },
  { id: 555, external_id: 9, type: 'employee', name: 'Eva  Vermeulen', can_create_event: true, date_of_birth: '1990-02-02', gender: 'female', identification_no: '1-1', team: 'Team Oost' },
  { id: 556, type: 'employee', name: 'Bram Verhoeven', can_create_event: false, team: null },
  { id: 'x', type: 'employee', name: 'Kapot' },
  { id: 557, type: 'client', name: 'Geen medewerker' },
] };

test('collega zoeken: alleen id, naam en team; niet de eigen agenda, geen cliënten', () => {
  const r = medewerkersUitZoek(ZOEK, ['42479']);
  assert.deepEqual(r, [
    { id: '555', name: 'Eva Vermeulen', team: 'Team Oost', kanUitnodigen: true },
    { id: '556', name: 'Bram Verhoeven', team: '', kanUitnodigen: false },
  ]);
  assert.ok(r.every((m) => Object.keys(m).join() === 'id,name,team,kanUitnodigen'), 'geen geboortedatum, personeelsnummer of geslacht');
  assert.equal(medewerkersUitZoek(ZOEK.employees, []).length, 3, 'ook een kale lijst');
  assert.deepEqual(medewerkersUitZoek(null), []);
  const veel = { employees: Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, type: 'employee', name: 'M ' + i })) };
  assert.equal(medewerkersUitZoek(veel).length, 8, 'hooguit acht treffers');
});

test('beschikbaarheid: vrij, afspraak met reistijd, en precies aansluiten mag', (t) => {
  amsterdam(t);
  const dag = '2026-11-02';
  const lijst = [laag('events', afs(dag, '09:00', '10:00', { time_slot: { travel_time_before: 30, travel_time_after: 15 } })), laag('events', afs(dag, '13:00', '14:00'))];
  assert.deepEqual(beschikbaarheid(lijst, dag, 11 * 60, 60), { kan: true });
  assert.deepEqual(beschikbaarheid(lijst, dag, 14 * 60, 60), { kan: true }, 'begint als de afspraak eindigt');
  assert.deepEqual(beschikbaarheid(lijst, dag, 10 * 60, 30), { kan: false, soort: 'afspraak', heleDag: false, van: 510, tot: 615, reistijd: true }, 'de reistijd erna telt mee');
  assert.deepEqual(beschikbaarheid(lijst, '2026-11-03', 9 * 60, 60), { kan: true }, 'andere dag');
});

test('beschikbaarheid: afwezigheid gaat voor, hele dagen en meerdere dagen', (t) => {
  amsterdam(t);
  const ziek = laag('unavailabilities', { id: 'u1', date: '2026-11-04', type: 'unavailability', time_slot: { all_day: true } });
  const zonderTijd = laag('unavailabilities', { id: 'u2', date: '2026-11-05', type: 'unavailability', time_slot: {} });
  const vakantie = laag('unavailabilities', { id: 'u3', date: '2026-11-09', type: 'unavailability', start_time: '2026-11-09T12:00:00+01:00', end_time: '2026-11-11T12:00:00+01:00', time_slot: {} });
  const afspraak = laag('events', afs('2026-11-09', '12:30', '13:30'));
  const lijst = [ziek, zonderTijd, vakantie, afspraak];
  assert.deepEqual(beschikbaarheid(lijst, '2026-11-04', 600, 60), { kan: false, soort: 'afwezig', heleDag: true, van: 0, tot: 1440, reistijd: false });
  assert.equal(beschikbaarheid(lijst, '2026-11-05', 600, 60).heleDag, true, 'afwezig zonder tijden: de hele dag');
  assert.deepEqual(beschikbaarheid(lijst, '2026-11-09', 12 * 60 + 30, 60), { kan: false, soort: 'afwezig', heleDag: false, van: 720, tot: 1440, reistijd: false }, 'afwezigheid zegt meer dan de afspraak');
  assert.equal(beschikbaarheid(lijst, '2026-11-09', 600, 60).kan, true, 'ochtend nog vrij');
  assert.equal(beschikbaarheid(lijst, '2026-11-10', 600, 60).heleDag, true, 'de dag ertussen helemaal');
  assert.deepEqual(beschikbaarheid(lijst, '2026-11-11', 600, 60), { kan: false, soort: 'afwezig', heleDag: false, van: 0, tot: 720, reistijd: false });
  assert.equal(beschikbaarheid(lijst, '2026-11-11', 720, 60).kan, true, 'vanaf 12:00 weer terug');
});

test('beschikbaarheid: reserveringen en Outlook vrij of elders werkzaam tellen niet', (t) => {
  amsterdam(t);
  const dag = '2026-11-02';
  const lijst = [
    laag('reservations', afs(dag, '09:00', '12:00', { type: 'reservation' })),
    laag('outlook_appointments', afs(dag, '09:00', '10:00', { show_as: 'free' })),
    laag('outlook_appointments', afs(dag, '10:00', '11:00', { show_as: 'workingElsewhere' })),
  ];
  assert.deepEqual(beschikbaarheid(lijst, dag, 540, 120), { kan: true });
  lijst.push(laag('outlook_appointments', afs(dag, '10:30', '11:00', { show_as: 'busy' })));
  assert.equal(beschikbaarheid(lijst, dag, 540, 120).kan, false, 'bezet in Outlook telt wel');
});

const DAG = 'https://impegno.onsagenda.nl/invitees/42479/calendar/day?date=2026-10-27';

test('collega zoeken via ONS: zelfde zoekfunctie als bij genodigden, de eigen agenda telt niet', async () => {
  const { window, deliver } = bootHelper({ url: DAG });
  const gevraagd = [];
  window.fetch = (url) => { gevraagd.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(/search_panel\/employees/.test(url) ? ZOEK : {}) }); };
  const res = await deliver({ type: 'ag-employee-search', term: 'ver' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.employees.map((m) => m.id), ['555', '556']);
  assert.ok(gevraagd.includes('/search_panel/employees?term=ver&usage=event&page=1'));
  gevraagd.length = 0;
  const kort = await deliver({ type: 'ag-employee-search', term: 'v' });
  assert.deepEqual([kort.ok, kort.employees.length, gevraagd.length], [true, 0, 0], 'minder dan twee letters: niet gezocht');
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ resultaten: [] }) });
  const anders = await deliver({ type: 'ag-employee-search', term: 'ver' });
  assert.equal(anders.ok, false);
  assert.match(anders.error, /ONS geeft de gevonden medewerkers in een andere vorm terug/);
});

test('collega nakijken: de agenda van de collega per moment, met onbekend als ONS die niet geeft', async (t) => {
  amsterdam(t);
  const { window, deliver } = bootHelper({ url: DAG });
  const gevraagd = [];
  window.fetch = (url) => {
    gevraagd.push(url);
    const id = /invitee\/(\d+)\//.exec(url)[1], l = /layer=(\w+)/.exec(url)[1];
    if (id === '777') return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve(null) });
    const data = l === 'events' ? [afs('2026-11-02', '10:00', '11:00')] : l === 'unavailabilities' ? [{ id: 'u', date: '2026-11-04', type: 'unavailability', time_slot: { all_day: true } }] : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
  };
  const res = await deliver({ type: 'ag-colleague-check', ids: ['555', '777', 'kapot'], moments: [
    { date: '2026-11-02', startMin: 600, minutes: 60 }, { date: '2026-11-02', startMin: 660, minutes: 60 }, { date: '2026-11-04', startMin: 600, minutes: 60 }, { date: 'gisteren', startMin: 1, minutes: 1 },
  ] });
  assert.equal(res.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(res.result)), {
    555: [{ kan: false, soort: 'afspraak', heleDag: false, van: 600, tot: 660, reistijd: false }, { kan: true }, { kan: false, soort: 'afwezig', heleDag: true, van: 0, tot: 1440, reistijd: false }],
    777: [{ onbekend: true }, { onbekend: true }, { onbekend: true }],
  });
  assert.ok(gevraagd.every((u) => /invitee\/(555|777)\/entries\/week\?date=2026-11-02&layer=/.test(u)), 'alleen de week van de momenten, alleen de collega\'s');
  assert.ok(!gevraagd.some((u) => /invitee\/42479\//.test(u)), 'niet de eigen agenda');
});

test('afspraak maken met collega\'s: in employee_ids naast de eigen agenda, en in het formulier als genodigde', async (t) => {
  amsterdam(t);
  const { api, window } = bootHelper({ url: DAG });
  const gepost = [];
  window.fetch = (url, init) => {
    if (init && init.method === 'POST') { gepost.push(JSON.parse(init.body).event); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  };
  const res = await api.createEvents([
    { date: '2026-10-28', startMin: 600, minutes: 60, clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face Tamara', medewerkers: ['555', '42479', '555', 'x'] },
    { date: '2026-10-29', startMin: 600, minutes: 60, clients: [{ id: '11142', hourTypeId: 5 }], labelId: 47, name: 'Face to face Tamara' },
    { date: '2026-10-30', startMin: 600, minutes: 60, nietClient: true, hourTypeId: 77, name: 'Teamoverleg', medewerkers: ['556'] },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(res)), [{ ok: true }, { ok: true }, { ok: true }]);
  assert.deepEqual(gepost.map((e) => e.employee_ids), [[42479, 555], [42479], [42479, 556]], 'dubbel, eigen en onzin vallen weg');
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };
  api.openNewEvent({ date: '2026-10-28', time: '10:00', minutes: 60, medewerkers: ['555', 'x'] });
  assert.match(geklikt.at(-1) || '', /\/events\/new\?invitee_ids%5B%5D=42479&invitee_ids%5B%5D=555&redirect_to_calendar=true/);
});

// Open registraties: de controle over een periode en snel registreren.
//
// De overlapcontrole van ONS is een ongedocumenteerd endpoint. Deze tests
// leggen vast dat een onherkend antwoord nooit als 'geen overlap' wordt
// gelezen, maar als 'onbekend' (null).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const NU = Date.parse('2026-10-07T12:00:00');
const afspraak = (id, date, start, minuten, extra = {}) => {
  const s = Date.parse(date + 'T' + start + ':00');
  return {
    id, date, type: 'event', allDay: false, startMs: s, endMs: s + minuten * 60000,
    durationSec: minuten * 60, clientPresent: true, hourType: 'JG Huisbezoek', classes: 'not-declared', ...extra,
  };
};

test('overlap van ONS: ja, nee en onbekend', () => {
  const { api } = bootHelper();
  assert.equal(api.parseDetectOverlap(true), true);
  assert.equal(api.parseDetectOverlap({ overlap: false }), false);
  assert.equal(api.parseDetectOverlap({ overlapping_registrations: [{ id: 1 }] }), true);
  assert.equal(api.parseDetectOverlap([]), false);
  assert.equal(api.parseDetectOverlap({ status: 'ok' }), null);
  assert.equal(api.parseDetectOverlap('<html>'), null);
});

test('overlap van ONS: tijden gaan mee met de tijdzone van die dag', () => {
  const { api } = bootHelper();
  const iso = api.isoLocalWithOffset('2026-10-06', 12 * 60 + 45);
  assert.match(iso, /^2026-10-06T12:45:00[+-]\d{2}:\d{2}$/);
  assert.equal(api.isoLocalWithOffset('2026-10-06', null), null);
  assert.equal(api.isoLocalWithOffset('6-10-2026', 60), null);
});

test('periode: de weken lopen van de maandag van de begindatum t/m de einddatum', () => {
  const { api } = bootHelper();
  // wo 30 sep t/m wo 14 okt 2026 raakt drie weken.
  assert.deepEqual([...api.weekStartsBetween('2026-09-30', '2026-10-14')], ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual([...api.weekStartsBetween('2026-10-05', '2026-10-05')], ['2026-10-05']);
  assert.deepEqual([...api.weekStartsBetween('2026-10-14', '2026-09-30')], [], 'omgekeerde periode');
  assert.deepEqual([...api.weekStartsBetween('', '2026-09-30')], []);
});

test('periode: telt per dag alleen afgelopen, niet-geregistreerde afspraken binnen de periode', () => {
  const { api } = bootHelper();
  const r = api.summarizeOpenRange([
    afspraak(1, '2026-10-05', '09:00', 60),                                   // open, cliënt
    afspraak(2, '2026-10-05', '11:00', 30, { clientPresent: false }),         // open, overig
    afspraak(3, '2026-10-05', '13:00', 45, { classes: 'declared' }),          // al geregistreerd
    afspraak(4, '2026-10-06', '10:00', 60, { clientPresent: false, hourType: '' }), // pauze: telt niet
    afspraak(5, '2026-10-07', '15:00', 60),                                   // nog niet afgelopen
    afspraak(6, '2026-10-03', '10:00', 60),                                   // zaterdag
    afspraak(7, '2026-09-28', '10:00', 60),                                   // vóór de periode
    afspraak(1, '2026-10-05', '09:00', 60),                                   // dubbel
  ], { from: '2026-09-30', to: '2026-10-07', now: NU, lateHours: 24 });
  assert.equal(r.days.length, 1);
  const d = r.days[0];
  assert.equal(d.date, '2026-10-05');
  assert.equal(d.client, 60);
  assert.equal(d.overig, 30);
  assert.equal(d.count, 2);
  assert.equal(d.lateCount, 2, 'meer dan 24 uur geleden');
  assert.deepEqual([...d.items.map((i) => i.uursoort)], ['JG Huisbezoek', 'JG Huisbezoek']);
  assert.equal(r.totalMinutes, 90);
  assert.equal(r.totalCount, 2);
  // Geen namen of titels in het resultaat.
  assert.doesNotMatch(JSON.stringify(r), /title|name/);
});

test('periode: haalt elke week op en faalt hardop als een week niet lukt', async () => {
  const { api, window } = bootHelper();
  const gevraagd = [];
  window.fetch = (url) => {
    gevraagd.push(String(url));
    const date = /date=([\d-]+)/.exec(url)[1];
    if (date === '2026-10-05') return Promise.resolve({ ok: false, status: 500 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  };
  await assert.rejects(api.fetchEntriesForRange(123, '2026-09-28', '2026-10-07'), /2026-10-05/);
  assert.ok(gevraagd.every((u) => u.startsWith('/calendar/invitee/123/entries/week?date=')), 'alleen same-origin week-endpoints');

  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  const voortgang = [];
  const rows = await api.fetchEntriesForRange(123, '2026-09-28', '2026-10-07', (d, t) => voortgang.push(d + '/' + t));
  assert.equal(rows.length, 0);
  assert.deepEqual(voortgang, ['1/2', '2/2']);
  await assert.rejects(api.fetchEntriesForRange(123, '2026-01-01', '2026-12-31'), /te lang/);
});

test('snel registreren: de link vult datum, begintijd en duur (in seconden) in', () => {
  const { api } = bootHelper();
  assert.equal(api.quickRegisterUrl(42479, '2026-10-06', '12:45', 15),
    '/invitees/42479/registrations/new?declaration%5Bstart_date%5D=2026-10-06&declaration%5Bstart_time%5D=12%3A45&declaration%5Bduration%5D=900&redirect_to_calendar=true');
});

test('snel registreren: ongeldige invoer geeft een melding en opent niets', async () => {
  const { api } = bootHelper();
  assert.match((await api.quickRegister({ date: '', time: '10:00', minutes: 15 })).error, /datum/);
  assert.match((await api.quickRegister({ date: '2026-10-06', time: '25:00', minutes: 15 })).error, /begintijd/);
  assert.match((await api.quickRegister({ date: '2026-10-06', time: '10:00', minutes: 0 })).error, /duur/);
  assert.match((await api.quickRegister({ date: '2026-10-06', time: '23:50', minutes: 30 })).error, /middernacht/);
});

test('snel registreren: waarschuwt eerst bij overlap, en opent pas na "toch openen"', async () => {
  const { api, window } = bootHelper();
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  api.__setTijdvakken('registraties', '2026-10-06', [{ id: '9', ymd: '2026-10-06', startMin: 600, endMin: 660, uursoort: 'JG MDO' }]);
  api.__setOnsOverlap('2026-10-06', 630, 645, null);
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };

  const eerst = await api.quickRegister({ date: '2026-10-06', time: '10:30', minutes: 15 });
  assert.equal(eerst.ok, false);
  assert.match(eerst.overlap, /10:00 tot 11:00 \(JG MDO\)/);
  assert.equal(geklikt.length, 0, 'nog niet geopend');

  const daarna = await api.quickRegister({ date: '2026-10-06', time: '10:30', minutes: 15, force: true });
  assert.equal(daarna.ok, true);
  assert.equal(geklikt.length, 1);
  assert.match(geklikt[0], /\/invitees\/123\/registrations\/new\?declaration%5Bstart_date%5D=2026-10-06&declaration%5Bstart_time%5D=10%3A30&declaration%5Bduration%5D=900/);
});

test('snel registreren: een "ja" van ONS waarschuwt ook als wij zelf niets vinden', async () => {
  const { api, window } = bootHelper();
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  api.__setTijdvakken('registraties', '2026-10-06', []);
  api.__setOnsOverlap('2026-10-06', 630, 645, true);
  const r = await api.quickRegister({ date: '2026-10-06', time: '10:30', minutes: 15 });
  assert.match(r.overlap, /ONS meldt/);
});

test('periode: "niet registreren" (wont-declare) telt als afgehandeld', () => {
  const { api } = bootHelper();
  const r = api.summarizeOpenRange([
    afspraak(1, '2026-10-05', '09:00', 60, { classes: 'not-declared wont-declare' }),
    afspraak(2, '2026-10-05', '11:00', 30),
  ], { from: '2026-10-05', to: '2026-10-07', now: NU });
  assert.equal(r.totalCount, 1);
  assert.equal(r.days[0].items[0].key, '2|2026-10-05|' + Date.parse('2026-10-05T11:00:00'), 'sleutel voor de afwerklijst');
});

test('productieverloop: per week directe, indirecte en cliënttijd', () => {
  const { api } = bootHelper();
  const rij = api.productionWeekRow('2026-10-05', { directMinutes: 480, indirectMinutes: 150, travelMinutes: 60, clientMinutes: 690, nonClientMinutes: 5, totalMinutes: 695, count: 9 }, 'JGGZ');
  assert.equal(rij.week, 41);
  assert.equal(rij.directMinutes, 480);
  assert.equal(rij.indirectMinutes, 150);
  assert.equal(rij.travelMinutes, 60);
  assert.equal(rij.clientMinutes, 690);
});

test('gepland: label bepaalt direct/indirect; zonder label maar met cliënt is direct', () => {
  const { api } = bootHelper();
  const e = (extra) => ({ type: 'event', date: '2026-10-12', durationSec: 3600, clientPresent: true, hourType: 'JG Huisbezoek', labels: [], ...extra });
  assert.equal(api.computeDirectIndirect(e(), []).directMin, 60, 'geen label + cliënt = direct');
  assert.equal(api.computeDirectIndirect(e({ labels: [{ name: 'Indirect' }] }), []).indirectMin, 60);
  assert.equal(api.computeDirectIndirect(e({ labels: ['Direct contact'] }), []).directMin, 60);
  assert.equal(api.computeDirectIndirect(e({ clientPresent: false }), []).unknownMin, 60, 'geen cliënt, geen label: onbekend');
  const rows = api.plannedRatioRows([e(), e({ labels: ['Indirect'] }), e({ hourType: 'Overleg *', clientPresent: false })], []);
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [{ type: 'JG Huisbezoek', direct: 60, indirect: 60, travel: 0, other: 0, minutes: 120 }]);
});

test('productieverloop: weken lopen tegelijk, met een gedeelde limiet', async () => {
  const { api } = bootHelper();
  const limiet = api.createLimiter(3);
  let tegelijk = 0, max = 0;
  const taak = () => limiet(() => { tegelijk++; max = Math.max(max, tegelijk); return new Promise((r) => setTimeout(() => { tegelijk--; r(); }, 5)); });
  await Promise.all(Array.from({ length: 10 }, taak));
  assert.equal(max, 3);
});

test('productieverloop: een latere week komt uit de planning', () => {
  const { api } = bootHelper();
  const e = (extra) => ({ type: 'event', date: '2026-10-19', durationSec: 3600, clientPresent: true, hourType: 'JG Huisbezoek', labels: [], ...extra });
  const rij = api.plannedProductionRow('2026-10-19', [e(), e({ labels: ['Indirect'] })]);
  assert.equal(rij.planned, true);
  assert.equal(rij.week, 43);
  assert.equal(rij.directMinutes, 60);
  assert.equal(rij.indirectMinutes, 60);
});

test('planhulp: vrije blokken binnen werktijd, rond afspraken, pauze en afwezigheid', () => {
  const { api } = bootHelper();
  const NU = Date.parse('2026-10-07T13:10:00'); // woensdag
  const afs = (date, van, tot, extra = {}) => ({ type: 'event', date, startMs: Date.parse(date + 'T' + van + ':00'), endMs: Date.parse(date + 'T' + tot + ':00'), ...extra });
  const gaps = api.findFreeGaps([
    afs('2026-10-07', '14:00', '15:00'),
    afs('2026-10-08', '09:00', '10:00', { travelAfter: 1800 }),              // + 30 m reistijd
    { type: 'event', date: '2026-10-09', allDay: true, layer: 'unavailabilities' }, // vrijdag verlof
  ], { now: NU, days: 3, minMinutes: 60, stepMin: 15, windowStart: 480, windowEnd: 1020, blocked: [{ from: 720, to: 750 }] });
  const tekst = [...gaps.map((g) => g.date + ' ' + g.startMin + '-' + g.endMin)];
  assert.deepEqual(tekst, [
    '2026-10-07 900-1020',     // vandaag: na de afspraak tot 17:00 (13:15-14:00 is te kort)
    '2026-10-08 480-540',      // do 08:00-09:00
    '2026-10-08 630-720',      // do na afspraak + reistijd (10:30) tot de pauze
    '2026-10-08 750-1020',     // do na de pauze tot 17:00
  ]);
});

test('planhulp: het afspraakformulier opent met datum, tijd en duur', () => {
  const { api } = bootHelper();
  assert.equal(api.newEventUrl(42479, '2026-10-08', '10:30', 60),
    '/invitees/42479/events/new?event%5Bstart_date%5D=2026-10-08&event%5Bstart_time%5D=10%3A30&event%5Bduration%5D=3600&redirect_to_calendar=true');
});

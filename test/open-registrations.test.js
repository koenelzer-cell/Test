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

test('planhulp: vrije blokken binnen werktijd, rond afspraken en onbeschikbaarheid', () => {
  const { api } = bootHelper();
  const NU = Date.parse('2026-10-07T13:10:00'); // woensdag
  const afs = (date, van, tot, extra = {}) => ({ type: 'event', date, startMs: Date.parse(date + 'T' + van + ':00'), endMs: Date.parse(date + 'T' + tot + ':00'), ...extra });
  const gaps = api.findFreeGaps([
    afs('2026-10-07', '14:00', '15:00'),
    afs('2026-10-08', '09:00', '10:00', { travelAfter: 30 }),                // + 30 m reistijd (minuten)
    { type: 'event', date: '2026-10-09', allDay: true, layer: 'unavailabilities' }, // vrijdag verlof
    { type: 'unavailability', date: '2026-10-08', layer: 'unavailabilities',          // do 12:00-12:30 onbeschikbaar
      startMs: Date.parse('2026-10-08T12:00:00'), endMs: Date.parse('2026-10-08T12:30:00') },
  ], { now: NU, days: 3, minMinutes: 60, stepMin: 15, windowStart: 480, windowEnd: 1020 });
  const tekst = [...gaps.map((g) => g.date + ' ' + g.startMin + '-' + g.endMin)];
  assert.deepEqual(tekst, [
    '2026-10-07 900-1020',     // vandaag: na de afspraak tot 17:00 (13:15-14:00 is te kort)
    '2026-10-08 480-540',      // do 08:00-09:00
    '2026-10-08 630-720',      // do na afspraak + reistijd (10:30) tot de onbeschikbaarheid
    '2026-10-08 750-1020',     // do daarna tot 17:00
  ]);
});

test('planhulp: opent het afspraakformulier zoals ONS het zelf doet en zet datum en tijd klaar', () => {
  const { api, window } = bootHelper();
  assert.equal(api.newEventUrl(42479), '/events/new?invitee_ids%5B%5D=42479&redirect_to_calendar=true');
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };
  const r = api.openNewEvent({ date: '2026-10-08', time: '10:30', minutes: 60 });
  assert.equal(r.ok, true);
  assert.match(geklikt[0], /\/events\/new\?invitee_ids%5B%5D=123&redirect_to_calendar=true&event%5Bstart_date%5D=2026-10-08$/);
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.deepEqual({ date: klaar.date, time: klaar.time }, { date: '2026-10-08', time: '10:30' });
  assert.equal(api.onsDateText('2026-10-08'), '08-10-2026', 'zoals het datumveld van ONS hem toont');
  assert.equal(api.openNewEvent({ date: '2026-10-08', time: '25:00', minutes: 60 }).ok, false);
});

test('planhulp: geen vaste pauze; zonder afspraken is de hele werkdag vrij', () => {
  const { api } = bootHelper();
  const gaps = api.findFreeGaps([], { now: Date.parse('2026-10-08T07:00:00'), days: 1, minMinutes: 60, stepMin: 15, windowStart: 480, windowEnd: 1020 });
  assert.equal(gaps.length, 1);
  assert.deepEqual([gaps[0].startMin, gaps[0].endMin], [480, 1020], '08:00-17:00 aaneengesloten');
});

test('planhulp: Outlook-afspraken tellen mee volgens show_as', (t) => {
  // ONS stuurt tijden met +02:00; de medewerker zit in Nederland.
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const { api } = bootHelper();
  const NU = Date.parse('2026-10-08T07:00:00');
  // Het antwoord van ONS (entries/week, laag outlook_appointments), zoals het binnenkomt.
  const ruw = { data: [
    { id: 'A', date: '2026-10-09', start_time: '2026-10-09T09:00:00.000+02:00', end_time: '2026-10-09T17:00:00.000+02:00',
      time_slot: { all_day: false, duration: 28800, travel_time_before: 0, travel_time_after: 0 }, type: 'outlook_appointment', name: 'Afwezig', show_as: 'oof' },
    { id: 'B', date: '2026-10-08', start_time: '2026-10-08T10:00:00.000+02:00', end_time: '2026-10-08T11:00:00.000+02:00',
      time_slot: { all_day: false, duration: 3600 }, type: 'outlook_appointment', show_as: 'busy' },
    { id: 'C', date: '2026-10-08', start_time: '2026-10-08T13:00:00.000+02:00', end_time: '2026-10-08T15:00:00.000+02:00',
      time_slot: { all_day: false, duration: 7200 }, type: 'outlook_appointment', show_as: 'free' },
  ] };
  const entries = api.mapAgendaWeekResponse(ruw);
  const gaps = api.findFreeGaps(entries, { now: NU, days: 2, minMinutes: 60, stepMin: 15, windowStart: 480, windowEnd: 1020 });
  const tekst = [...gaps.map((g) => g.date + ' ' + g.startMin + '-' + g.endMin)];
  assert.deepEqual(tekst, [
    '2026-10-08 480-600',   // do 08:00-10:00
    '2026-10-08 660-1020',  // do 11:00-17:00 (13-15 'free' blijft vrij)
    '2026-10-09 480-540',   // vr 08:00-09:00, daarna afwezig (oof) tot 17:00
  ]);
});

const MEER = 'https://impegno.onsagenda.nl/invitees/13970,45267/calendar/day?date=2026-10-30';

test('meerdere invitees: alle agenda\'s uit de URL, ook bij springen en afspraak maken', () => {
  const { api, window } = bootHelper({ url: MEER });
  assert.deepEqual([...api.currentInviteeIds()], ['13970', '45267']);
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };
  api.jumpToDayVoorTest('2026-11-02', true);
  assert.match(geklikt.at(-1), /\/invitees\/13970,45267\/calendar\/day\?date=2026-11-02$/, 'beide agenda\'s blijven in beeld');
  assert.equal(api.newEventUrl(['13970', '45267']), '/events/new?invitee_ids%5B%5D=13970&invitee_ids%5B%5D=45267&redirect_to_calendar=true');
  // Cliënten staan ook in invitee_ids[] (zoals ONS zelf), plus de datum.
  assert.equal(api.newEventUrl(['42479'], ['11142', '9', 'x'], '2026-10-09'),
    '/events/new?invitee_ids%5B%5D=42479&invitee_ids%5B%5D=11142&invitee_ids%5B%5D=9&redirect_to_calendar=true&event%5Bstart_date%5D=2026-10-09');
  api.openNewEvent({ date: '2026-11-02', time: '10:00', minutes: 60 });
  assert.match(geklikt.at(-1), /invitee_ids%5B%5D=13970&invitee_ids%5B%5D=45267/);
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.deepEqual([klaar.date, klaar.time, klaar.minutes], ['2026-11-02', '10:00', 60], 'duur gaat mee: eindtijd wordt ingevuld, geen duurvraag');
});

test('meerdere invitees: de planhulp zoekt tijd waarop iedereen vrij is', async (t) => {
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const { api, window } = bootHelper({ url: MEER });
  const gevraagd = new Set();
  const afs = (dag, van, tot) => ({ id: dag + van, date: dag, type: 'event', start_time: dag + 'T' + van + ':00+01:00', end_time: dag + 'T' + tot + ':00+01:00', time_slot: {} });
  window.fetch = (url) => {
    const id = /invitee\/(\d+)\//.exec(url)[1];
    gevraagd.add(id);
    const laag = /layer=(\w+)/.exec(url)[1];
    const data = laag !== 'events' ? [] : id === '13970' ? [afs('2026-11-02', '09:00', '12:00')] : [afs('2026-11-02', '13:00', '17:00')];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
  };
  const r = await api.findFreeSlots(60, 1);
  assert.deepEqual([...gevraagd].sort(), ['13970', '45267'], 'beide agenda\'s opgehaald');
  assert.equal(r.invitees, 2);
  // De rekenregel op de samengevoegde agenda's, op een vaste datum.
  const beide = api.mapAgendaWeekResponse({ data: [afs('2026-11-02', '09:00', '12:00'), afs('2026-11-02', '13:00', '17:00')] });
  const gaps = api.findFreeGaps(beide, { now: Date.parse('2026-11-02T07:00:00+01:00'), days: 1, minMinutes: 60, stepMin: 15, windowStart: 480, windowEnd: 1020 });
  assert.deepEqual([...gaps.map((g) => g.startMin + '-' + g.endMin)], ['480-540', '720-780'], 'alleen 08:00-09:00 en 12:00-13:00 zijn voor allebei vrij');
});

test('planhulp: reserveringen tellen niet als bezet, maar worden per blok gemeld', async (t) => {
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const { api } = bootHelper();
  // Uit entries/week?layer=reservations (ingekort).
  const ruw = { data: [
    { id: '9695', date: '2026-10-05', start_time: '2026-10-05T08:00:00.000+02:00', end_time: '2026-10-05T09:00:00.000+02:00', type: 'reservation', name: null, title: null,
      time_slot: { all_day: false, duration: 3600.0, travel_time_before: 0, travel_time_after: 0 }, labels: [{ id: 29, name: 'JG Verslaglegging' }] },
    { id: '9696', date: '2026-10-05', start_time: '2026-10-05T10:00:00.000+02:00', end_time: '2026-10-05T11:00:00.000+02:00', type: 'reservation',
      time_slot: { all_day: false, duration: 3600.0 }, labels: [{ id: 14, name: 'JG Face to face kantoor' }] },
  ] };
  const blokken = api.reservationBlocks(api.mapAgendaWeekResponse(ruw));
  assert.deepEqual(JSON.parse(JSON.stringify(blokken)), [
    { date: '2026-10-05', startMin: 480, endMin: 540, label: 'JG Verslaglegging' },
    { date: '2026-10-05', startMin: 600, endMin: 660, label: 'JG Face to face kantoor' },
  ]);
  assert.deepEqual([...api.reservationsOverlapping(blokken, '2026-10-05', 510, 570).map((r) => r.label)], ['JG Verslaglegging']);
  assert.equal(api.reservationsOverlapping(blokken, '2026-10-05', 540, 600).length, 0, 'aansluitend is geen overlap');
});

test('planhulp: zoeken tot en met een datum', async () => {
  const { api, window } = bootHelper({ url: MEER });
  const weken = new Set();
  window.fetch = (url) => { weken.add(/date=([\d-]+)/.exec(url)[1]); return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }); };
  const vandaag = new Date();
  const ymd = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  const tot = new Date(vandaag); tot.setDate(tot.getDate() + 60);
  const r = await api.findFreeSlots(60, 1, ymd(tot));
  assert.equal(r.to, ymd(tot));
  assert.equal(r.lastDate, ymd(tot));
  assert.ok(weken.size >= 9, 'alle weken tot die datum opgehaald (' + weken.size + ')');
  const teVer = new Date(vandaag); teVer.setDate(teVer.getDate() + 400);
  await assert.rejects(api.findFreeSlots(60, 1, ymd(teVer)), /half jaar/);
  const gisteren = new Date(vandaag); gisteren.setDate(gisteren.getDate() - 1);
  await assert.rejects(api.findFreeSlots(60, 1, ymd(gisteren)), /vanaf vandaag/);
});

test('reistijd van een afspraak staat in minuten (echt voorbeeld uit ONS)', (t) => {
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const { api } = bootHelper();
  // Uit entries/week?layer=events: 09:00-10:15, duration 4500 (seconden), reistijd 30/30 (minuten).
  const ruw = { data: [{
    id: '4435056', date: '2026-10-20', type: 'event', hour_type: 'JW BG WBO BH Ambulant', labels: [], clients: [{ id: 1 }],
    start_time: '2026-10-20T09:00:00.000+02:00', end_time: '2026-10-20T10:15:00.000+02:00',
    time_slot: { all_day: false, duration: 4500, start_time: '2026-10-20T09:00:00.000+02:00', end_time: '2026-10-20T10:15:00.000+02:00',
      travel_time_before: 30, travel_time_after: 30 },
  }] };
  const entries = api.mapAgendaWeekResponse(ruw);
  // Planhulp: bezet van 08:30 (reistijd heen) tot 10:45 (reistijd terug).
  const gaps = api.findFreeGaps(entries, { now: Date.parse('2026-10-20T07:00:00+02:00'), days: 1, minMinutes: 30, stepMin: 15, windowStart: 480, windowEnd: 1020 });
  assert.deepEqual([...gaps.map((g) => g.startMin + '-' + g.endMin)], ['480-510', '645-1020']);
  // Gepland: 1 u 15 m direct (cliënt, geen label) + 1 u reistijd.
  const di = api.computeDirectIndirect(entries[0], []);
  assert.equal(di.directMin, 75);
  assert.equal(di.travelMin, 60);
  const rij = api.plannedProductionRow('2026-10-19', entries);
  assert.equal(rij.travelMinutes, 60);
  assert.equal(rij.directMinutes, 75);
});

test('meerdere collega\'s: open registraties in één lijst per dag, met naam en eigen sleutel', () => {
  const { api } = bootHelper();
  const NU = Date.parse('2026-10-07T12:00:00');
  const a = api.summarizeOpenRange([afspraak(1, '2026-10-05', '09:00', 60)], { from: '2026-10-01', to: '2026-10-07', now: NU });
  const b = api.summarizeOpenRange([afspraak(1, '2026-10-05', '09:00', 60), afspraak(2, '2026-10-06', '10:00', 30)], { from: '2026-10-01', to: '2026-10-07', now: NU });
  const r = api.mergeOpenRangePerPersoon([a, b], ['13970', '45267'], ['Anna', 'Bram']);
  assert.equal(r.totalCount, 3, 'een gezamenlijke afspraak telt voor ieder');
  assert.equal(r.days[0].items.length, 2);
  assert.deepEqual([...r.days[0].items.map((i) => i.persoon)].sort(), ['Anna', 'Bram']);
  assert.notEqual(r.days[0].items[0].key, r.days[0].items[1].key, 'eigen sleutel per collega (afwerklijst)');
});

test('vooraf laden: een lopende berekening wordt gedeeld, met voortgang; vers haalt opnieuw op', async () => {
  const { api, window } = bootHelper();
  api._clearPreloadCache();
  let aanroepen = 0;
  window.fetch = () => { aanroepen++; return new Promise((r) => setTimeout(() => r({ ok: true, json: () => Promise.resolve({ data: [] }) }), 5)); };
  const vooraf = api.cachedOpenRange('2026-09-28', '2026-10-07');            // vooraf laden (2 weken)
  const voortgang = [];
  const paneel = api.cachedOpenRange('2026-09-28', '2026-10-07', (d, t) => voortgang.push(d + '/' + t)); // het zijpaneel vraagt hetzelfde
  assert.equal(vooraf, paneel, 'dezelfde berekening');
  await paneel;
  assert.equal(aanroepen, 2, 'niet dubbel opgehaald');
  assert.deepEqual(voortgang, ['1/2', '2/2'], 'voortgang ook voor wie later aanhaakt');
  assert.equal(api.isCached('open', '2026-09-28|2026-10-07'), true);
  await api.cachedOpenRange('2026-09-28', '2026-10-07');
  assert.equal(aanroepen, 2, 'uit het geheugen');
  await api.cachedOpenRange('2026-09-28', '2026-10-07', null, true);
  assert.equal(aanroepen, 4, 'vers: opnieuw opgehaald (afwerklijst bijwerken)');
});

test('planhulp: na opslaan kopieën maken en het volgende moment met eigen instellingen in een nieuw formulier openen', async (t) => {
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const { window, sent } = bootHelper({ url: 'https://impegno.onsagenda.nl/events/new?invitee_ids%5B%5D=42479&redirect_to_calendar=true' });
  const gepost = [];
  window.fetch = (url, init) => { if (!init || init.method !== 'POST') return Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve(null) }); gepost.push([url, init.method, JSON.parse(init.body).event.start_time]); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };
  const body = JSON.stringify({ event: { valid_from: '2026-10-27', start_time: '2026-10-27T17:20:00+01:00', end_time: '2026-10-27T18:20:00+01:00', employee_ids: [42479], client_ids: [1] } });
  const pending = JSON.stringify({ moments: [{ date: '2026-10-29', startMin: 540 }], eigen: [{ date: '2026-11-03', startMin: 600 }, { date: '2026-11-05', startMin: 600 }], ts: Date.now() });
  // Zoals de main-world het meldt (jsdom zet bij postMessage geen origin; daarom direct).
  window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'eventCreated', body, pending }, origin: window.location.origin, source: window }));
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(gepost, [['/calendar/events', 'POST', '2026-10-29T09:00:00+01:00']], 'kopie alleen voor het moment met dezelfde instellingen');
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment')), { ...JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment')), date: '2026-11-03', time: '10:00' });
  const rest = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingDuplicates'));
  assert.deepEqual(rest.moments, []);
  assert.deepEqual(rest.eigen, [{ date: '2026-11-05', startMin: 600 }], 'de volgende met eigen instellingen staat klaar');
  assert.match(geklikt.at(-1) || '', /\/events\/new\?invitee_ids%5B%5D=42479&redirect_to_calendar=true&event%5Bstart_date%5D=2026-11-03$/, 'nieuw formulier voor dezelfde medewerker');
  const melding = sent.find((m) => m && m.type === 'ag-duplicates-done');
  assert.deepEqual(JSON.parse(JSON.stringify(melding.next)), { date: '2026-11-03', startMin: 600 });
  assert.equal(melding.left, 2);
});

test('meerdere afspraken plannen: elk een eigen formulier met eigen duur (eindtijd klaar), geen kopieën', async (t) => {
  const { api, window } = bootHelper({ url: MEER });
  api.openNewEvent({ date: '2026-11-02', time: '09:00', minutes: 60, multi: true, extra: [{ date: '2026-11-02', time: '11:00' }], eigen: [{ date: '2026-11-02', time: '10:15', minutes: 90, clientIds: ['51486'] }], clientIds: ['24819'] });
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingDuplicates'));
  assert.deepEqual(klaar.moments, [], 'geen kopieën bij meerdere plannen');
  assert.deepEqual(klaar.eigen, [{ date: '2026-11-02', startMin: 615, minutes: 90, clientIds: ['51486'] }]);
  // Na het opslaan: het volgende formulier krijgt zijn eigen duur.
  const oudeTz = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oudeTz === undefined) delete process.env.TZ; else process.env.TZ = oudeTz; });
  const geklikt = [];
  window.HTMLAnchorElement.prototype.click = function () { geklikt.push(this.getAttribute('href')); };
  const body = JSON.stringify({ event: { valid_from: '2026-11-02', start_time: '2026-11-02T09:00:00+01:00', end_time: '2026-11-02T10:00:00+01:00', employee_ids: [42479], client_ids: [1] } });
  window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'eventCreated', body, pending: JSON.stringify(klaar) }, origin: window.location.origin, source: window }));
  await new Promise((r) => setTimeout(r, 50));
  const volgende = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.equal(volgende.date, '2026-11-02');
  assert.equal(volgende.time, '10:15');
  assert.equal(volgende.minutes, 90);
  await new Promise((r) => setTimeout(r, 1300));
  assert.match(geklikt.at(-1) || '', /invitee_ids%5B%5D=42479&invitee_ids%5B%5D=51486&redirect_to_calendar=true&event%5Bstart_date%5D=2026-11-02$/, 'volgende formulier met de eigen cliënt');
});

test('planhulp-afstand: elke afspraak met een cliënt telt (geen labelcontrole), BG/J&G-locatie telt als kantoor', async () => {
  const { api, window } = bootHelper({ url: MEER });
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // volgende maandag
  const ymd = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  const t = (u) => ymd + 'T' + u + ':00';
  const afs = (id, van, tot, extra) => ({ id, date: ymd, type: 'event', start_time: t(van), end_time: t(tot), time_slot: {}, labels: [{ name: 'Face to face' }], clients: [], meta: { detailsUrl: '/details/' + id }, ...extra });
  window.fetch = (url) => {
    if (/^\/details\/a/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ event: { clients: [{ address: { mapUrl: 'https://www.google.nl/maps/place/Teststraat+1,+2611EB,+Delft' } }] } }) });
    const laag = /layer=(\w+)/.exec(url)[1];
    const data = laag !== 'events' || !/13970/.test(url) ? [] : [
      afs('a', '09:00', '10:00', { clients: [{ id: 1 }] }),
      afs('b', '13:00', '14:00', { clients: [{ id: 2 }], location: { id: 1, name: 'J&G Oosterhout' } }),
      afs('c', '15:00', '15:30', {}),
    ];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
  };
  const r = await api.findFreeSlots(60, 2, '', true);
  const dag = (r.visits || {})[ymd] || [];
  assert.deepEqual(JSON.parse(JSON.stringify(dag.map((v) => [v.pc, v.soort]))), [['2611EB', 'client'], ['4822NH', 'kantoor']]);
});

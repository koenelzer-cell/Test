// Detail in de Weekplanning: alles wat in een week tijd bezet houdt, per dag,
// zonder titel of cliënt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDagen, weekDagItem } from '../src/content/domain/week-dagen.js';

const t = (d, u, m) => new Date(2026, 10, d, u, m || 0).getTime();
const afspraak = (o) => ({
  id: o.id, type: 'event', date: '2026-11-0' + o.d, startMs: t(o.d, o.u, o.m), endMs: t(o.d, o.u, o.m) + o.duur * 60000,
  durationSec: o.duur * 60, travelBefore: o.reis || 0, travelAfter: o.reis || 0, allDay: false,
  clientPresent: o.client !== false, hourType: o.uursoort || '', classes: o.classes || '', labels: o.labels || [],
  // Velden die er nooit uit mogen komen:
  name: 'Gesprek met Jan Jansen', clients: [{ name: 'Jan Jansen' }]
});
const NU = t(6, 10, 40); // vrijdag 6 november, 10:40

test('één afspraak: tijden, reistijd, soort, status en een naam zonder titel of cliënt', () => {
  const it = weekDagItem(afspraak({ id: 1, d: 3, u: 11, duur: 60, reis: 15, labels: [{ name: 'JG Huisbezoek' }], classes: 'event not-declared' }),
    { now: NU, choices: [{ label: 'Huisbezoek', etiketten: ['JG Huisbezoek'] }] });
  assert.deepEqual(it, { startMin: 660, minutes: 60, travelBefore: 15, travelAfter: 15, soort: 'direct', status: 'open', naam: 'Huisbezoek', bron: 'events', heleDag: false });
  assert.doesNotMatch(JSON.stringify(it), /Jan|Gesprek/);
  // Geregistreerd, gepland, niet-cliënttijd, uursoort als naam.
  assert.equal(weekDagItem(afspraak({ id: 2, d: 3, u: 9, duur: 30, classes: 'event declared' }), { now: NU }).status, 'ok');
  assert.equal(weekDagItem(afspraak({ id: 3, d: 6, u: 13, duur: 30 }), { now: NU }).status, 'gepland');
  const overig = weekDagItem(afspraak({ id: 4, d: 4, u: 12, duur: 120, client: false, uursoort: 'Scholing' }), { now: NU });
  assert.equal(overig.soort, 'overig');
  assert.equal(overig.naam, 'Scholing');
  // Zonder cliënt en zonder uursoort (een pauze): wel tonen, geen status.
  const pauze = weekDagItem(afspraak({ id: 5, d: 4, u: 12, duur: 30, client: false }), { now: NU });
  assert.equal(pauze.status, '');
  assert.equal(pauze.naam, 'Afspraak');
  // Label 'indirect': indirect.
  assert.equal(weekDagItem(afspraak({ id: 6, d: 4, u: 15, duur: 60, labels: [{ name: 'Indirect overleg' }] }), { now: NU }).soort, 'indirect');
  // Zonder label en zonder uursoort, met cliënt: ook tonen.
  const zonderLabel = weekDagItem(afspraak({ id: 8, d: 5, u: 10, duur: 60, classes: 'event not-declared' }), { now: NU });
  assert.deepEqual([zonderLabel.naam, zonderLabel.soort, zonderLabel.status], ['Cliëntafspraak', 'direct', 'open']);
  // Een afspraak uit de laag events met een ander soort: ook tonen, met status.
  assert.equal(weekDagItem(Object.assign(afspraak({ id: 9, d: 3, u: 9, duur: 60, classes: 'event declared' }), { type: 'appointment', layer: 'events' }), { now: NU }).status, 'ok');
  // Hele dag: over de hele dag, zonder status.
  const heel = weekDagItem(Object.assign(afspraak({ id: 7, d: 3, u: 9, duur: 60 }), { allDay: true }), { now: NU });
  assert.deepEqual([heel.heleDag, heel.startMin, heel.minutes, heel.status], [true, 0, 1440, '']);
});

test('andere lagen: afwezig, Outlook (niet als vrij) en geplande bezoeken, zonder onderwerp; reserveringen niet', () => {
  const met = (o) => Object.assign({ id: 1, date: '2026-11-04', startMs: t(4, 13), endMs: t(4, 14), allDay: false, subject: 'Tandarts Jan', name: 'Privé' }, o);
  const afw = weekDagItem(met({ type: 'unavailability', layer: 'unavailabilities' }), { now: NU });
  assert.deepEqual(afw, { startMin: 780, minutes: 60, travelBefore: 0, travelAfter: 0, soort: 'overig', status: '', naam: 'Afwezig', bron: 'unavailabilities', heleDag: false });
  assert.equal(weekDagItem(met({ type: 'unavailability', layer: 'unavailabilities', startMs: null, endMs: null }), { now: NU }).heleDag, true, 'zonder tijden: hele dag');
  const outlook = weekDagItem(met({ type: 'outlook_appointment', layer: 'outlook_appointments', showAs: 'busy' }), { now: NU });
  assert.equal(outlook.naam, 'Outlook');
  assert.doesNotMatch(JSON.stringify(outlook), /Tandarts|Jan|Privé/);
  assert.equal(weekDagItem(met({ type: 'outlook_appointment', showAs: 'free' }), { now: NU }), null, 'Outlook vrij: niet bezet');
  assert.equal(weekDagItem(met({ type: 'outlook_appointment', showAs: 'workingElsewhere' }), { now: NU }), null);
  assert.equal(weekDagItem(met({ layer: 'planned_visits', type: 'planned_visit' }), { now: NU }).naam, 'Gepland bezoek');
  assert.equal(weekDagItem(met({ layer: 'reservations', type: 'reservation' }), { now: NU }), null, 'reservering bezet niets');
});

test('afwezig over meerdere dagen: op elke dag die hij raakt', () => {
  const r = weekDagen([{ id: 5, type: 'unavailability', layer: 'unavailabilities', date: '2026-11-03', startMs: t(3, 12), endMs: t(5, 10), allDay: false }], { datum: '2026-11-03', now: NU });
  const per = Object.fromEntries(r.days.map((d) => [d.date, d.items.map((i) => [i.startMin, i.minutes])]));
  assert.deepEqual(per['2026-11-03'], [[720, 720]]);
  assert.deepEqual(per['2026-11-04'], [[0, 1440]]);
  assert.deepEqual(per['2026-11-05'], [[0, 600]]);
  assert.deepEqual(per['2026-11-06'], []);
});

test('de week: ma tot en met vr altijd, weekend alleen met afspraken; venster op hele uren, minstens 8 tot 17', () => {
  const r = weekDagen([
    afspraak({ id: 1, d: 3, u: 15, duur: 45, classes: 'event not-declared' }),
    afspraak({ id: 2, d: 3, u: 9, duur: 90, classes: 'event declared' }),
    afspraak({ id: 2, d: 3, u: 9, duur: 90, classes: 'event declared' }), // dubbel: één keer
    afspraak({ id: 3, d: 5, u: 7, m: 30, duur: 60, reis: 20 }),
    afspraak({ id: 4, d: 8, u: 17, duur: 60 }) // zondag, tot 18:00
  ], { datum: '2026-11-05', now: NU });
  assert.equal(r.maandag, '2026-11-02');
  assert.deepEqual(r.days.map((d) => d.date), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-08']);
  const di = r.days[1];
  assert.deepEqual(di.items.map((i) => i.startMin), [540, 900], 'op tijd gesorteerd, dubbele één keer');
  assert.equal(di.open, 1);
  assert.equal(r.startMin, 7 * 60, '07:10 met reistijd: vanaf 7 uur');
  assert.equal(r.endMin, 18 * 60);
  assert.deepEqual(weekDagen([], { datum: '2026-11-05' }).startMin, 480);
  assert.deepEqual(weekDagen([], { datum: '2026-11-05' }).endMin, 1020);
});

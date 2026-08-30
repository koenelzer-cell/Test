// Waarschuwing bij een overlappende registratie. Bewust puur een
// tijdvergelijking: de code leest geen cliëntgegevens uit de API (zie de
// privacy-notitie bij parseRegistrationDetails), dus "dubbel" betekent hier
// "op deze dag staat al iets in dit tijdvak", niet "bij deze cliënt".
//
// Het is een waarschuwing, geen blokkade — dubbel boeken kan legitiem zijn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const reg = (ymd, start, eind, extra = {}) => ({
  ymd, startMin: start, endMin: eind,
  hourTypeName: extra.hourTypeName || 'JG Huisbezoek',
  occurrenceId: extra.occurrenceId || null,
});
const uur = (h, m = 0) => h * 60 + m;

test('tijdvakken die elkaar overlappen worden herkend', () => {
  const { api } = bootHelper();
  const o = api._tijdvakkenOverlappen;
  assert.equal(o(uur(10), uur(11), uur(10, 30), uur(11, 30)), true, 'gedeeltelijke overlap');
  assert.equal(o(uur(10), uur(12), uur(10, 30), uur(11)), true, 'volledig omsloten');
  assert.equal(o(uur(10), uur(11), uur(10), uur(11)), true, 'exact hetzelfde vak');
});

test('vakken die elkaar alleen raken tellen niet als overlap', () => {
  const { api } = bootHelper();
  const o = api._tijdvakkenOverlappen;
  assert.equal(o(uur(10), uur(11), uur(11), uur(12)), false,
    '10:00-11:00 en 11:00-12:00 sluiten op elkaar aan; dat is normaal werk, geen dubbele invoer');
  assert.equal(o(uur(11), uur(12), uur(10), uur(11)), false, 'ook andersom');
});

test('een tijdvak zonder duur levert nooit een melding op', () => {
  const { api } = bootHelper();
  const o = api._tijdvakkenOverlappen;
  assert.equal(o(uur(10), uur(10), uur(9), uur(12)), false, 'begin gelijk aan eind is geen vak');
  assert.equal(o(null, uur(11), uur(10), uur(12)), false, 'ontbrekende tijd');
});

test('een overlappende registratie op dezelfde dag wordt gevonden', () => {
  const { api } = bootHelper();
  api.__setWeekRegDetails([
    reg('2026-08-30', uur(9), uur(10)),
    reg('2026-08-30', uur(10, 30), uur(11, 30), { hourTypeName: 'JG MDO' }),
  ]);
  const hit = api.overlappendeRegistratie('2026-08-30', uur(11), uur(12), null);
  assert.ok(hit, 'er staat al iets van 10:30 tot 11:30');
  assert.equal(hit.hourTypeName, 'JG MDO', 'de melding hoort te vertellen wát er al staat');
});

test('een registratie op een ANDERE dag telt niet mee', () => {
  const { api } = bootHelper();
  api.__setWeekRegDetails([reg('2026-08-29', uur(10), uur(12))]);
  assert.equal(api.overlappendeRegistratie('2026-08-30', uur(10), uur(11), null), null,
    'hetzelfde tijdstip op een andere dag is geen dubbele invoer');
});

test('een registratie merkt zichzelf niet aan als dubbel', () => {
  const { api } = bootHelper();
  api.__setWeekRegDetails([reg('2026-08-30', uur(10), uur(11), { occurrenceId: 'abc-123' })]);
  assert.equal(api.overlappendeRegistratie('2026-08-30', uur(10), uur(11), 'abc-123'), null,
    'bij het bewerken van een bestaande registratie mag die zichzelf niet als overlap melden');
  assert.ok(api.overlappendeRegistratie('2026-08-30', uur(10), uur(11), 'iets-anders'),
    'een ándere registratie op datzelfde vak moet wél gemeld worden');
});

test('zonder weekgegevens wordt er niets gemeld', () => {
  const { api } = bootHelper();
  api.__setWeekRegDetails([]);
  assert.equal(api.overlappendeRegistratie('2026-08-30', uur(10), uur(11), null), null,
    'zijn de weekgegevens nog niet geladen, dan liever zwijgen dan een melding op onvolledige gegevens');
});

test('onvolledige invoer levert geen melding op', () => {
  const { api } = bootHelper();
  api.__setWeekRegDetails([reg('2026-08-30', uur(10), uur(11))]);
  assert.equal(api.overlappendeRegistratie(null, uur(10), uur(11), null), null, 'geen datum');
  assert.equal(api.overlappendeRegistratie('2026-08-30', null, uur(11), null), null, 'geen begintijd');
  assert.equal(api.overlappendeRegistratie('2026-08-30', uur(10), null, null), null, 'geen eindtijd');
});

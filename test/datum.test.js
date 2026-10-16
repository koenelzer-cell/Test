// Datums met date-fns (src/shared/datum.js): ONS-formaat, ISO-weken en de
// Nederlandse notatie die het zijpaneel en de hulp gebruiken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dagKort, dagLang, isoWeek, maandagenTussen, maandagVan, maandJaar, plusDagen, uitYmd, werkweekTekst, ymd } from '../src/shared/datum.js';

test('datum: YYYY-MM-DD heen en terug, ongeldig = null', () => {
  assert.equal(ymd(uitYmd('2026-10-13')), '2026-10-13');
  assert.equal(uitYmd('2026-13-45'), null);
  assert.equal(uitYmd('13-10-2026'), null);
  assert.equal(ymd(new Date('kapot')), null);
});

test('datum: ISO-weken, ook rond de jaarwisseling', () => {
  assert.equal(isoWeek('2026-10-13'), 42);
  assert.equal(isoWeek('2026-12-31'), 53);
  assert.equal(isoWeek('2027-01-01'), 53, 'vrijdag 1 januari hoort nog bij week 53');
  assert.equal(isoWeek('2027-01-04'), 1);
  assert.equal(maandagVan('2026-10-18'), '2026-10-12', 'zondag hoort bij de week ervoor');
});

test('datum: rekenen met dagen over de wissel naar zomertijd heen', () => {
  assert.equal(plusDagen('2026-03-28', 1), '2026-03-29');
  assert.equal(plusDagen('2026-03-28', 2), '2026-03-30');
  assert.equal(plusDagen('2026-10-24', 2), '2026-10-26', 'en naar wintertijd');
  assert.deepEqual(maandagenTussen('2026-09-30', '2026-10-14'), ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(maandagenTussen('2026-10-14', '2026-09-30'), [], 'omgekeerde periode');
});

test('datum: Nederlandse notatie zonder punten', () => {
  assert.equal(dagLang('2026-10-13'), 'Dinsdag 13 oktober');
  assert.equal(dagLang('2026-10-13', true), 'Di 13 oktober');
  assert.equal(dagKort('2026-03-02'), 'ma 2 mrt');
  assert.equal(dagKort('2026-10-13', true), 'di 13 okt 2026');
  assert.equal(maandJaar(uitYmd('2026-10-01')), 'oktober 2026');
  assert.equal(werkweekTekst('2026-10-07'), '5 tot en met 9 oktober');
  assert.equal(werkweekTekst('2026-10-01'), '28 september tot en met 2 oktober', 'over de maand heen');
  assert.equal(werkweekTekst('2031-03-05', true), '3 tot en met 7 maart 2031', 'jaar erbij als het niet dit jaar is');
  assert.equal(dagLang('onzin'), 'onzin');
});

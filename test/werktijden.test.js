// Eigen werktijden (popup): opslaan als tekst per weekdag, gebruiken als
// minuten per dag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeWorkHours, normalizeWorkHours, weekRange, workWindowFor } from '../src/shared/work-hours.js';

const PARTTIME = { 1: { start: '08:30', end: '17:00' }, 2: { start: '08:30', end: '17:00' }, 4: { start: '08:30', end: '17:00' }, 5: { start: '09:00', end: '12:30' } };

test('normaliseren: geldige dagen in minuten, de rest is geen werkdag', () => {
  const h = normalizeWorkHours(PARTTIME);
  assert.deepEqual(h[1], { start: 510, end: 1020 });
  assert.equal(h[3], null, 'woensdag werkt niet');
  assert.deepEqual(h[5], { start: 540, end: 750 });
});

test('niets of niets geldigs ingesteld: de dagindeling van het team geldt', () => {
  assert.equal(normalizeWorkHours(null), null);
  assert.equal(normalizeWorkHours({}), null);
  assert.equal(normalizeWorkHours({ 1: { start: '17:00', end: '08:00' } }), null, 'begin na einde telt niet');
  assert.equal(normalizeWorkHours({ 1: { start: '8:30', end: '25:00' } }), null);
  assert.equal(workWindowFor(null, 1), undefined);
});

test('venster per dag: zaterdag en een vrije dag zijn geen werkdag', () => {
  const h = normalizeWorkHours(PARTTIME);
  assert.deepEqual(workWindowFor(h, 1), { start: 510, end: 1020 });
  assert.equal(workWindowFor(h, 3), null);
  assert.equal(workWindowFor(h, 6), null);
  assert.deepEqual(weekRange(h), { start: 510, end: 1020 });
});

test('omschrijving: opeenvolgende dagen met dezelfde tijden samen', () => {
  assert.equal(describeWorkHours(normalizeWorkHours(PARTTIME)), 'ma en di 08:30 tot 17:00, do 08:30 tot 17:00, vr 09:00 tot 12:30');
  const voltijd = {};
  [1, 2, 3, 4, 5].forEach((d) => { voltijd[d] = { start: '08:00', end: '16:30' }; });
  assert.equal(describeWorkHours(normalizeWorkHours(voltijd)), 'ma t/m vr 08:00 tot 16:30');
});

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

test('planhulp: vrije tijd alleen binnen de werktijden van die dag', async () => {
  process.env.TZ = 'Europe/Amsterdam';
  const { findFreeGaps } = await import('../src/content/domain/free-slots.js');
  const uren = normalizeWorkHours({ 1: { start: '08:30', end: '17:00' }, 5: { start: '09:00', end: '12:30' } });
  const gaps = findFreeGaps([], {
    now: new Date(2026, 9, 19, 7, 0).getTime(), days: 5, minMinutes: 60, stepMin: 15, maxResults: 20,
    windowStart: 480, windowEnd: 1020, dayWindow: (weekday) => workWindowFor(uren, weekday),
  });
  assert.deepEqual(gaps.map((g) => [g.date, g.startMin, g.endMin]), [
    ['2026-10-19', 510, 1020],   // maandag 08:30 tot 17:00
    ['2026-10-23', 540, 750],    // vrijdag 09:00 tot 12:30; di, wo en do geen werkdag
  ]);
});

test('kleuring: de zones van het team, alleen binnen de eigen werktijden', async () => {
  const { bootHelper } = await import('./helpers/harness.mjs');
  const kolom = (dag, datum) => `<td class="calendar_day ${dag}"><div class="day js_day" data-date="${datum}" data-test-rect="0,0,100,960"></div></td>`;
  const html = '<!doctype html><html><body><table><tr>' + kolom('monday', '2026-10-19') + kolom('wednesday', '2026-10-21') + kolom('friday', '2026-10-23') + '</tr></table></body></html>';
  const { document } = bootHelper({
    html, url: 'https://impegno.onsagenda.nl/invitees/123/calendar/workweek?date=2026-10-19',
    sync: { colorProfile: 'JGGZ', workHours: { 1: { start: '08:30', end: '17:00' }, 5: { start: '09:00', end: '12:30' } } },
  });
  await new Promise((r) => setTimeout(r, 200));
  // 960 px voor 24 uur: 40 px per uur.
  const zones = (datum) => [...document.querySelectorAll(`[data-date="${datum}"] > [data-seg^="zone"]`)]
    .map((z) => [parseInt(z.style.top, 10) / 40, (parseInt(z.style.top, 10) + parseInt(z.style.height, 10)) / 40]);
  const ma = zones('2026-10-19');
  assert.equal(ma[0][0], 8.5, 'maandag begint om 08:30');
  assert.equal(ma[ma.length - 1][1], 17);
  assert.deepEqual(zones('2026-10-21'), [], 'woensdag is geen werkdag');
  assert.deepEqual(zones('2026-10-23'), [[9, 11.5], [11.5, 12], [12, 12.5]], 'vrijdag 09:00 tot 12:30');
});

test('tijdveld: invoer wordt een Nederlandse tijd (24 uur, uu:mm)', async () => {
  const { normalizeTime } = await import('../src/shared/time-field.js');
  const geval = { '9': '09:00', '930': '09:30', '0930': '09:30', '9:30': '09:30', '9.30': '09:30', '17': '17:00', '1730': '17:30', ' 08:15 ': '08:15', '23:59': '23:59' };
  for (const [in_, uit] of Object.entries(geval)) assert.equal(normalizeTime(in_), uit, in_);
  for (const fout of ['', '24:00', '9:60', '5 PM', 'abc', '12345']) assert.equal(normalizeTime(fout), null, fout);
});

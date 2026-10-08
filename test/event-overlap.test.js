// ONS' overlapcontrole voor afspraken (/event_planner/overlap_detection).
//
// De vorm van het verzoek is niet gedocumenteerd; de hulp leert hem van de
// aanroep die ONS zelf doet. Deze tests leggen vast dat hij rollen herkent,
// cliëntgegevens weggooit, het verzoek correct nabouwt en bij twijfel niets
// doet (null).
process.env.TZ = 'Europe/Amsterdam';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverlapUrl, learnOverlapTemplate, parseEventOverlap } from '../src/content/domain/event-overlap.js';

const P = '/event_planner/overlap_detection';
const query = (url) => [...new URLSearchParams(url.split('?')[1]).entries()];

test('leert datum, tijd en duur (in seconden) en bouwt het verzoek na', () => {
  const t = learnOverlapTemplate(P + '?invitee_ids%5B%5D=42479&start_date=09-10-2026&start_time=08:00&duration=3600&event_type=normal');
  assert.ok(t);
  const url = buildOverlapUrl(t, { ids: ['13970', '45267'], date: '2026-10-30', startMin: 13 * 60 + 15, endMin: 14 * 60 });
  assert.deepEqual(query(url), [
    ['invitee_ids[]', '13970'], ['invitee_ids[]', '45267'],
    ['start_date', '30-10-2026'], ['start_time', '13:15'], ['duration', '2700'], ['event_type', 'normal'],
  ]);
});

test('leert ISO-begin en -eind met tijdzone', () => {
  const t = learnOverlapTemplate('https://impegno.onsagenda.nl' + P + '?start=2026-10-09T08:00:00%2B02:00&end=2026-10-09T09:00:00%2B02:00&invitee_ids=42479');
  const url = buildOverlapUrl(t, { ids: ['42479'], date: '2026-11-02', startMin: 9 * 60, endMin: 10 * 60 });
  assert.deepEqual(query(url), [
    ['start', '2026-11-02T09:00:00+01:00'], ['end', '2026-11-02T10:00:00+01:00'], ['invitee_ids', '42479'],
  ]);
});

test('duur in minuten herkend uit begin en eind', () => {
  const t = learnOverlapTemplate(P + '?employee_id=1&start_time=08:00&end_time=09:30&date=2026-10-09&duration=90');
  assert.equal(t.params.find((p) => p.role === 'duration').unit, 'min');
});

test('cliënt, titel en eigen afspraak gaan er altijd uit', () => {
  const t = learnOverlapTemplate(P + '?invitee_ids[]=1&client_ids[]=555&title=Huisbezoek&event_id=9&start=2026-10-09T08:00&end=2026-10-09T09:00');
  const url = buildOverlapUrl(t, { ids: ['1'], date: '2026-10-09', startMin: 600, endMin: 660 });
  assert.doesNotMatch(url, /client|title|event_id|555|Huisbezoek/);
  assert.match(url, /start=2026-10-09T10%3A00&end=2026-10-09T11%3A00/);
});

test('geen sjabloon bij een ander pad of te weinig gegevens', () => {
  assert.equal(learnOverlapTemplate('/worksheet/registrations/detect_overlap?start=2026-10-09T08:00'), null);
  assert.equal(learnOverlapTemplate(P + '?start_date=2026-10-09&start_time=08:00&duration=3600'), null, 'zonder medewerker');
  assert.equal(learnOverlapTemplate(P + '?invitee_ids[]=1&start_time=08:00'), null, 'zonder datum en eind');
  assert.equal(learnOverlapTemplate(P), null);
});

test('ongeldig tijdvak -> geen URL', () => {
  const t = learnOverlapTemplate(P + '?invitee_ids[]=1&start_date=2026-10-09&start_time=08:00&duration=3600');
  assert.equal(buildOverlapUrl(t, { ids: [], date: '2026-10-09', startMin: 60, endMin: 120 }), null);
  assert.equal(buildOverlapUrl(t, { ids: ['1'], date: '2026-10-09', startMin: 120, endMin: 60 }), null);
});

test('antwoord lezen: ja, nee en onbekend', () => {
  assert.equal(parseEventOverlap({ overlap: false }), false);
  assert.equal(parseEventOverlap({ overlapping_events: [{ id: 1 }] }), true);
  assert.equal(parseEventOverlap({ conflict_count: 0 }), false);
  assert.equal(parseEventOverlap({ events: [], warnings: [] }), false);
  assert.equal(parseEventOverlap({ events: [{}], warnings: [] }), true);
  assert.equal(parseEventOverlap([]), false);
  assert.equal(parseEventOverlap({ status: 'ok' }), null);
  assert.equal(parseEventOverlap(null), null);
});

test('main-world geeft ONS’ eigen aanroep door, en alleen die', async () => {
  const { JSDOM } = await import('jsdom');
  const fs = await import('node:fs');
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, clone() { return { text: () => Promise.resolve('{"overlap":false}') }; } });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const gezien = [];
  w.addEventListener('message', (e) => { if (e.data && e.data.type === 'eventOverlap') gezien.push(e.data); });
  w.fetch('/product_selection/product_list');
  w.fetch('https://impegno.onsagenda.nl' + P + '?invitee_ids%5B%5D=42479&start_date=09-10-2026&start_time=08:00&duration=3600');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(gezien.length, 1);
  assert.equal(gezien[0].url, P + '?invitee_ids%5B%5D=42479&start_date=09-10-2026&start_time=08:00&duration=3600');
  assert.ok(learnOverlapTemplate(gezien[0].url));
  assert.equal(parseEventOverlap(JSON.parse(gezien[0].body)), false);
});

// Totaal geregistreerd tussen twee datums (Cliënttijd, productieverloop): per
// registratie de dag, per week de opbouw per dag, en optellen op de dag
// precies, ook als de periode midden in een week begint of eindigt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistrationDetails, somGeregistreerd, summarizeWeekRegistrations } from '../src/content/domain/registrations.js';

const reg = (date, direct, indirect, reis, duur) => ({ registration: { date, direct_time: direct, indirect_time: indirect, travel_time_before: reis, travel_time_after: 0,
  start_time: date + 'T09:00:00.000+01:00', end_time: new Date(Date.parse(date + 'T09:00:00.000+01:00') + duur * 60000).toISOString(), hour_type: { id: 5, name: 'JW GGZ' } } });

test('registratie: de dag komt mee (alleen de datum)', () => {
  const r = parseRegistrationDetails(reg('2026-11-04', 60, 15, 10, 90));
  assert.equal(r.date, '2026-11-04');
  assert.equal(r.otherMin, 5, 'de rest van de duur is niet-cliënttijd');
});

test('week: per dag dezelfde getallen als het weektotaal', () => {
  const s = summarizeWeekRegistrations([
    parseRegistrationDetails(reg('2026-11-02', 60, 0, 0, 60)),
    parseRegistrationDetails(reg('2026-11-02', 30, 15, 0, 45)),
    parseRegistrationDetails(reg('2026-11-04', 0, 60, 20, 80))
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(s.perDag)), {
    '2026-11-02': { direct: 90, indirect: 15, travel: 0, other: 0, count: 2 },
    '2026-11-04': { direct: 0, indirect: 60, travel: 20, other: 0, count: 1 }
  });
  assert.equal(s.directMinutes, 90);
});

test('totaal: op de dag precies, over meerdere weken', () => {
  const week1 = { '2026-11-02': { direct: 90, indirect: 15, travel: 0, other: 0, count: 2 }, '2026-11-04': { direct: 0, indirect: 60, travel: 20, other: 10, count: 1 } };
  const week2 = { '2026-11-09': { direct: 120, indirect: 0, travel: 30, other: 0, count: 1 }, '2026-11-13': { direct: 45, indirect: 0, travel: 0, other: 0, count: 1 } };
  const alles = somGeregistreerd([week1, week2], '2026-11-02', '2026-11-13');
  assert.deepEqual([alles.directMinutes, alles.indirectMinutes, alles.travelMinutes, alles.otherMinutes, alles.clientMinutes, alles.totalMinutes, alles.count, alles.dagen],
    [255, 75, 50, 10, 380, 390, 5, 4]);
  // Begint woensdag en eindigt maandag: de dagen erbuiten tellen niet.
  const deel = somGeregistreerd([week1, week2], '2026-11-03', '2026-11-09');
  assert.deepEqual([deel.directMinutes, deel.indirectMinutes, deel.travelMinutes, deel.count, deel.van, deel.tot], [120, 60, 50, 2, '2026-11-03', '2026-11-09']);
  // Weken zonder opbouw (gepland) en lege periodes.
  assert.equal(somGeregistreerd([null, undefined, week1], '2026-11-04', '2026-11-04').indirectMinutes, 60);
  assert.equal(somGeregistreerd([week1], '2026-12-01', '2026-12-31').count, 0);
});

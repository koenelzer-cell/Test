// Planhulp: meerdere afspraken efficiënt plannen (zonder server).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buren, extraVoor, kandidaten, planMany, voorstelParen } from '../src/sidepanel/multi-plan.js';
import { clientsForPlan } from '../src/content/features/agenda/client-lookup.js';
import { postcodeFromClient } from '../src/content/domain/route.js';

// Postcodes op een rechte lijn (km).
const POS = { '1111AA': 0, '1111BB': 1, '2222CC': 20, '2222DD': 21, '3333EE': 50 };
const afstand = (a, b) => (a in POS && b in POS) ? Math.abs(POS[a] - POS[b]) : null;
const dag = (date) => ({ date, startMin: 9 * 60, endMin: 17 * 60, minutes: 480 });

test('kandidaten: elke 15 minuten waar de afspraak past', () => {
  const k = kandidaten([{ date: '2026-10-12', startMin: 540, endMin: 660 }], 60);
  assert.deepEqual(k.map((c) => c.startMin), [540, 555, 570, 585, 600]);
});

test('bundelt afspraken die dicht bij elkaar liggen, en bij een vaste afspraak in de buurt', () => {
  const visits = { '2026-10-12': [{ startMin: 540, endMin: 600, pc: '2222CC' }] };
  const r = planMany([{ pc: '2222DD', minutes: 60 }, { pc: '1111AA', minutes: 60 }, { pc: '1111BB', minutes: 60 }],
    [dag('2026-10-12'), dag('2026-10-13')], visits, { afstand, maxPerDag: 2 });
  assert.deepEqual(r.unplaced, []);
  const op = Object.fromEntries(r.placed.map((p) => [p.pc, p]));
  assert.equal(op['2222DD'].date, '2026-10-12', 'naast de vaste afspraak in 2222CC');
  assert.equal(op['1111AA'].date, '2026-10-13');
  assert.equal(op['1111BB'].date, '2026-10-13', 'samen met 1111AA');
  // Niet over elkaar en met tijd voor de rit (1 km -> 2 min, dus een kwartier later).
  const [a, b] = [op['1111AA'], op['1111BB']].sort((x, y) => x.startMin - y.startMin);
  assert.ok(b.startMin >= a.startMin + 60 + 15, 'rit past ertussen');
  assert.ok(r.extraKm < 25);
});

test('hooguit per dag: wat niet past blijft over', () => {
  const r = planMany([{ pc: '1111AA', minutes: 60 }, { pc: '1111BB', minutes: 60 }], [dag('2026-10-12')], {}, { afstand, maxPerDag: 1 });
  assert.equal(r.placed.length, 1);
  assert.equal(r.unplaced.length, 1);
});

test('rit moet passen: geen afspraak direct na een verre vaste afspraak', () => {
  const visits = { '2026-10-12': [{ startMin: 540, endMin: 600, pc: '3333EE' }] };
  // Alleen 10:00-11:30 vrij; 50 km -> 67 min rijden, dan past 1 uur niet meer.
  const r = planMany([{ pc: '1111AA', minutes: 60 }], [{ date: '2026-10-12', startMin: 600, endMin: 690 }], visits, { afstand });
  assert.equal(r.placed.length, 0);
});

test('vertrekpunt telt mee; buren, extra rijden en de paren voor Google', () => {
  const r = planMany([{ pc: '2222DD', minutes: 60 }], [dag('2026-10-12'), dag('2026-10-13')],
    { '2026-10-13': [{ startMin: 540, endMin: 600, pc: '2222CC' }] }, { afstand, thuisPc: '1111AA' });
  assert.equal(r.placed[0].date, '2026-10-13', 'bij de vaste afspraak, niet een losse rit vanaf huis');
  const visits = { '2026-10-13': [{ startMin: 540, endMin: 600, pc: '2222CC' }] };
  const br = buren(r.placed, visits, '1111AA');
  assert.deepEqual(br[0], { date: '2026-10-13', startMin: r.placed[0].startMin, voor: '2222CC', na: '1111AA' });
  assert.equal(extraVoor(br[0], '2222DD', afstand), 1 + 21 - 20);
  assert.deepEqual(voorstelParen(br, r.placed), [['2222CC', '2222DD'], ['2222DD', '1111AA'], ['2222CC', '1111AA']]);
});

test('cliënt zoeken: naam en postcode uit het search_panel-antwoord van ONS', () => {
  const json = { clients: [
    { id: 24819, external_id: 21794, type: 'client', name: 'Test4 Cliënt', sortable_name: 'cliënt', address: 'Centaurusweg 15, 5015 TA Tilburg', home_town: 'Schin op Geul', identification_no: '118916', date_of_birth: '01-01-1984' },
    { id: 51486, external_id: 45651, type: 'client', name: 'R Test', sortable_name: 'test', address: 'Hoofdweg  1, 1058 BB Amsterdam' },
    { id: 7, name: 'Zonder Adres' },
  ] };
  assert.deepEqual(clientsForPlan(json), [
    { id: '24819', name: 'Test4 Cliënt', pc: '5015TA', number: '118916', birth: '01-01-1984' },
    { id: '51486', name: 'R Test', pc: '1058BB', number: '', birth: '' },
    { id: '7', name: 'Zonder Adres', pc: '', number: '', birth: '' },
  ]);
  assert.equal(postcodeFromClient({ address: { zipcode: '2611 eb', city: 'Delft' } }), '2611EB');
});

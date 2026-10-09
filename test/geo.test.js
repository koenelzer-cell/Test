// Afstand voor de planhulp: postcode -> coördinaat (PDOK) en omrijden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detour, km, lookupPostcodes, normPostcode, parsePdok, _clearGeoCache } from '../src/sidepanel/geo.js';

const DELFT = { lat: 52.0116, lon: 4.3571 }, DEN_HAAG = { lat: 52.0705, lon: 4.3007 }, ROTTERDAM = { lat: 51.9244, lon: 4.4777 };

test('postcode normaliseren', () => {
  assert.equal(normPostcode('2611 eb'), '2611EB');
  assert.equal(normPostcode('2611EB'), '2611EB');
  assert.equal(normPostcode('0611EB'), '');
  assert.equal(normPostcode('Koornmarkt 35'), '');
});

test('PDOK-antwoord lezen', () => {
  assert.deepEqual(parsePdok({ response: { numFound: 1, docs: [{ postcode: '2611EB', centroide_ll: 'POINT(4.35710 52.01160)' }] } }), { lon: 4.3571, lat: 52.0116 });
  assert.equal(parsePdok({ response: { docs: [] } }), null);
  assert.equal(parsePdok(null), null);
});

test('afstand: hemelsbreed maal wegfactor', () => {
  const d = km(DELFT, DEN_HAAG);
  assert.ok(d > 9 && d < 11, 'Delft-Den Haag ≈ 7,5 km hemelsbreed, ≈ 10 km over de weg: ' + d);
  assert.equal(km(DELFT, null), null);
});

test('omrijden: tussen het bezoek ervoor en erna, anders vanaf één kant of het vertrekpunt', () => {
  const coord = (pc) => ({ A: DELFT, B: ROTTERDAM, C: DEN_HAAG })[pc] || null;
  const bezoeken = [{ startMin: 540, endMin: 600, pc: 'A' }, { startMin: 780, endMin: 840, pc: 'B' }];
  // Nieuw in Delft tussen Delft en Rotterdam: bijna niets extra.
  const r1 = detour(bezoeken, 660, 60, DELFT, coord, null);
  assert.ok(r1.km < 0.5, 'op de route: ' + r1.km);
  assert.deepEqual([r1.voor, r1.na], ['A', 'B']);
  // Nieuw in Den Haag tussen Delft en Rotterdam: flink om.
  assert.ok(detour(bezoeken, 660, 60, DEN_HAAG, coord, null).km > 15);
  // Na het laatste bezoek: alleen vanaf Rotterdam.
  const r3 = detour(bezoeken, 900, 60, DELFT, coord, null);
  assert.equal(r3.na, '');
  assert.ok(Math.abs(r3.km - km(ROTTERDAM, DELFT)) < 0.01);
  // Geen bezoeken, wel vertrekpunt: heen (en terug valt weg want p == q).
  assert.ok(detour([], 600, 60, DEN_HAAG, coord, DELFT).km > 0);
  assert.equal(detour([], 600, 60, DEN_HAAG, coord, null), null, 'niets om mee te vergelijken');
});

test('postcodes opzoeken: één verzoek per postcode, alleen de postcode in de URL', async () => {
  _clearGeoCache();
  const gevraagd = [];
  const coord = await lookupPostcodes(['2611EB', '2611EB', '2511AA'], (url) => { gevraagd.push(url); return Promise.resolve({ response: { docs: [{ centroide_ll: 'POINT(4.3 52.0)' }] } }); });
  assert.equal(gevraagd.length, 2);
  assert.match(gevraagd[0], /^https:\/\/api\.pdok\.nl\/bzk\/locatieserver\/search\/v3_1\/free\?fq=type:postcode&rows=1&fl=postcode,centroide_ll&q=2611EB$/);
  assert.deepEqual(coord('2611EB'), { lon: 4.3, lat: 52 });
});

// Rijtijden via de Google Routes API (alleen postcodes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normPostcode, roadMatrix, _clearRouteCache } from '../src/sidepanel/geo.js';

test('postcode normaliseren', () => {
  assert.equal(normPostcode('2611 eb'), '2611EB');
  assert.equal(normPostcode('2611EB'), '2611EB');
  assert.equal(normPostcode('0611EB'), '');
  assert.equal(normPostcode('Koornmarkt 35'), '');
});

test('rijtijden rechtstreeks via Google Routes: één matrix, alleen postcodes, tweede keer uit het geheugen', async () => {
  _clearRouteCache();
  const vragen = [];
  const fetchFn = (url, init) => {
    vragen.push({ url, key: init.headers['X-Goog-Api-Key'], body: JSON.parse(init.body) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      { originIndex: 0, destinationIndex: 1, distanceMeters: 12000, duration: '900s', condition: 'ROUTE_EXISTS' },
      { originIndex: 1, destinationIndex: 0, distanceMeters: 12500, duration: '960s', condition: 'ROUTE_EXISTS' },
    ]) });
  };
  const pair = await roadMatrix({ key: 'k' }, ['2611EB', '2511AA', '2611EB', 'onzin'], fetchFn);
  assert.equal(vragen.length, 1);
  assert.match(vragen[0].url, /computeRouteMatrix$/);
  assert.equal(vragen[0].key, 'k');
  assert.deepEqual(vragen[0].body.origins.map((o) => o.waypoint.address), ['2611EB, Nederland', '2511AA, Nederland'], 'alleen geldige postcodes, uniek');
  assert.deepEqual(pair('2611EB', '2511AA'), { m: 12000, s: 900 });
  assert.deepEqual(pair('2611EB', '2611EB'), { m: 0, s: 0 });
  assert.equal(pair('2611EB', '9999ZZ'), null);
  const nogmaals = await roadMatrix({ key: 'k' }, ['2511AA', '2611EB'], fetchFn);
  assert.equal(vragen.length, 1, 'al bekend: geen nieuwe aanvraag (kost niets)');
  assert.deepEqual(nogmaals('2511AA', '2611EB'), { m: 12500, s: 960 });
});

test('rijtijden via de eigen server: alleen postcodes en het token', async () => {
  _clearRouteCache();
  let gevraagd;
  const pair = await roadMatrix({ url: 'https://proxy.example', token: 't' }, ['2611EB', '2511AA'], (url, init) => {
    gevraagd = { url, token: init.headers['X-Agendahulp-Token'], body: JSON.parse(init.body) };
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ pairs: { '2611EB|2511AA': { m: 1, s: 2 } } }) });
  });
  assert.deepEqual(gevraagd, { url: 'https://proxy.example/matrix', token: 't', body: { pcs: ['2611EB', '2511AA'] } });
  assert.deepEqual(pair('2611EB', '2511AA'), { m: 1, s: 2 });
});

// Routes-proxy (server/routes-proxy): alleen postcodes, token en origin verplicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.GOOGLE_MAPS_KEY = 'testsleutel';
process.env.PROXY_TOKEN = 'geheim';
process.env.ALLOWED_ORIGINS = 'chrome-extension://abc';
const { handler, normPcs } = await import('../server/routes-proxy/index.mjs');

const naarGoogle = [];
const nepFetch = (url, init) => {
  naarGoogle.push({ url, body: JSON.parse(init.body), key: init.headers['X-Goog-Api-Key'] });
  if (/computeRouteMatrix/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve([
    { originIndex: 0, destinationIndex: 1, distanceMeters: 9000, duration: '720s', condition: 'ROUTE_EXISTS' },
    { originIndex: 1, destinationIndex: 0, distanceMeters: 9100, duration: '730s', condition: 'ROUTE_EXISTS' },
  ]) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ routes: [{ optimizedIntermediateWaypointIndex: [1, 0], distanceMeters: 30000, duration: '2400s' }] }) });
};
const server = http.createServer(handler(nepFetch));
await new Promise((r) => server.listen(0, r));
const poort = server.address().port;
test.after(() => server.close());
const vraag = (pad, body, headers = {}) => fetch('http://127.0.0.1:' + poort + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'chrome-extension://abc', 'X-Agendahulp-Token': 'geheim', ...headers }, body: JSON.stringify(body) });

test('alleen geldige postcodes', () => {
  assert.deepEqual(normPcs(['2611 eb', '2611EB', '2613RR']), ['2611EB', '2613RR']);
  assert.equal(normPcs(['Koornmarkt 35, Delft']), null);
});

test('matrix: postcodes naar Google, sleutel alleen op de server', async () => {
  const r = await vraag('/matrix', { pcs: ['2611EB', '2613RR'] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { pairs: { '2611EB|2613RR': { m: 9000, s: 720 }, '2613RR|2611EB': { m: 9100, s: 730 } } });
  const g = naarGoogle.at(-1);
  assert.equal(g.key, 'testsleutel');
  assert.deepEqual(g.body.origins.map((o) => o.waypoint.address), ['2611EB, Nederland', '2613RR, Nederland']);
});

test('optimize: rondrit vanaf het vertrekpunt', async () => {
  const r = await vraag('/optimize', { origin: '4822NH', stops: ['2611EB', '2613RR'] });
  assert.deepEqual(await r.json(), { order: [1, 0], m: 30000, s: 2400 });
  assert.equal(naarGoogle.at(-1).body.optimizeWaypointOrder, true);
});

test('weigert zonder token, verkeerde origin of met een adres', async () => {
  assert.equal((await vraag('/matrix', { pcs: ['2611EB', '2613RR'] }, { 'X-Agendahulp-Token': 'fout' })).status, 401);
  assert.equal((await vraag('/matrix', { pcs: ['2611EB', '2613RR'] }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await vraag('/matrix', { pcs: ['Koornmarkt 35', '2613RR'] })).status, 400);
});

test('pairs: alleen de gevraagde paren, per herkomst één aanvraag', async () => {
  const voor = naarGoogle.length;
  const r = await vraag('/pairs', { pairs: [['2611EB', '2613RR'], ['2611EB', '4822NH'], ['4822NH', '2611EB']] });
  assert.equal(r.status, 200);
  const nieuw = naarGoogle.slice(voor).filter((g) => /computeRouteMatrix/.test(g.url));
  assert.ok(nieuw.every((g) => g.body.origins.length === 1));
  assert.equal(nieuw.reduce((t, g) => t + g.body.destinations.length, 0) <= 3, true, 'hooguit 3 elementen (cache telt mee)');
});

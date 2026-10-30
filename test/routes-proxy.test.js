// Routes-proxy (server/routes-proxy): alleen postcodes, token en origin verplicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.GOOGLE_MAPS_KEY = 'testsleutel';
process.env.PROXY_TOKEN = 'geheim';
process.env.ALLOWED_ORIGINS = 'chrome-extension://abc';
process.env.LOG = '0';
const { handler, normPcs, clientIp, kortIp } = await import('../server/routes-proxy/index.mjs');

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

// Een eigen server met eigen limieten (los van de server hierboven).
async function proxy(opties) {
  const s = http.createServer(handler(nepFetch, opties));
  await new Promise((r) => s.listen(0, r));
  const p = s.address().port;
  const v = (pad, body, headers = {}) => fetch('http://127.0.0.1:' + p + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'chrome-extension://abc', 'X-Agendahulp-Token': 'geheim', ...headers }, body: JSON.stringify(body) });
  return { v, sluit: () => new Promise((r) => s.close(r)) };
}
const PCS = { pcs: ['2611EB', '2613RR'] };

test('beveiligingsheaders op elk antwoord, ook bij een weigering', async () => {
  for (const r of [await vraag('/matrix', PCS), await vraag('/matrix', PCS, { 'X-Agendahulp-Token': 'fout' })]) {
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.match(r.headers.get('strict-transport-security'), /max-age=/);
  }
});

test('alleen via https: een verzoek dat als http binnenkwam wordt geweigerd', async () => {
  assert.equal((await vraag('/matrix', PCS, { 'X-Forwarded-Proto': 'http' })).status, 403);
  assert.equal((await vraag('/matrix', PCS, { 'X-Forwarded-Proto': 'https' })).status, 200);
});

test('limiet per minuut geldt ook zonder geldig token (raden kost tijd)', async () => {
  const { v, sluit } = await proxy({ maxPerMin: 3, log: false });
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await v('/matrix', PCS, { 'X-Agendahulp-Token': 'fout' + i })).status);
    assert.deepEqual(codes, [401, 401, 401, 429, 429]);
  } finally { await sluit(); }
});

test('achter een proxy telt het adres dat de proxy toevoegde, niet wat de client zelf instuurt', async () => {
  const req = (xff) => ({ headers: { 'x-forwarded-for': xff }, socket: { remoteAddress: '10.9.9.9' } });
  assert.equal(clientIp(req('1.1.1.1, 203.0.113.7'), 1), '203.0.113.7', 'de laatste: van de vertrouwde proxy');
  assert.equal(clientIp(req('203.0.113.7'), 0), '10.9.9.9', 'zonder proxy: de verbinding zelf');
  const { v, sluit } = await proxy({ maxPerMin: 2, hops: 1, log: false });
  try {
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await v('/matrix', PCS, { 'X-Forwarded-For': 'nep' + i + ', 203.0.113.7' })).status);
    assert.deepEqual(codes, [200, 200, 429], 'een ander nepadres vooraan helpt niet');
    assert.equal((await v('/matrix', PCS, { 'X-Forwarded-For': '198.51.100.4' })).status, 200, 'een andere gebruiker wel');
  } finally { await sluit(); }
});

test('dagplafond: na het maximum geen Google-aanvragen meer', async () => {
  const { v, sluit } = await proxy({ maxPerDag: 2, log: false });
  try {
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await v('/matrix', PCS)).status);
    assert.deepEqual(codes, [200, 200, 429]);
    assert.deepEqual(await (await v('/matrix', PCS)).json(), { error: 'dagplafond' });
  } finally { await sluit(); }
});

test('logregels bij geweigerde verzoeken: soort, pad en ingekort IP, nooit token of sleutel', async () => {
  const regels = [], oud = console.log;
  console.log = (x) => regels.push(String(x));
  const { v, sluit } = await proxy({ log: true });
  try {
    await v('/matrix', PCS, { 'X-Agendahulp-Token': 'raadpoging-123' });
    await v('/matrix', PCS, { Origin: 'https://evil.example' });
    await v('/matrix', PCS);
  } finally { console.log = oud; await sluit(); }
  const json = regels.map((r) => JSON.parse(r));
  assert.deepEqual(json.map((r) => r.soort), ['geweigerd-token', 'geweigerd-origin'], 'een geslaagd verzoek logt niets');
  assert.ok(json.every((r) => r.pad === '/matrix' && /\.0$|::$/.test(r.ip) && r.tijd));
  assert.ok(regels.every((r) => !/raadpoging|geheim|testsleutel|2611EB/.test(r)), 'geen token, sleutel of postcodes');
  assert.equal(kortIp('203.0.113.7'), '203.0.113.0');
  assert.equal(kortIp('::ffff:203.0.113.7'), '203.0.113.0');
  assert.equal(kortIp('2001:db8:85a3:8d3:1319:8a2e:370:7348'), '2001:db8:85a3::');
});

// De ONS-API-laag (src/content/services/ons-api/): één fetch-route, de
// endpoint-sjablonen en het ophalen van uursoorten. Geen echte server: fetch
// wordt per test vervangen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

function metFetch(handler) {
  const boot = bootHelper();
  const calls = [];
  boot.window.fetch = (url, opts) => {
    calls.push({ url: String(url), opts });
    return Promise.resolve(handler(String(url)));
  };
  return { ...boot, calls };
}
const json = (body, ok = true, status = 200) => ({ ok, status, json: () => Promise.resolve(body) });

test('getJson gaat altijd same-origin met de sessie en vraagt JSON', async () => {
  const { api, calls } = metFetch(() => json({ a: 1 }));
  assert.deepEqual({ ...(await api.getJson('/x')) }, { a: 1 });
  assert.equal(calls[0].opts.credentials, 'same-origin');
  assert.equal(calls[0].opts.headers.Accept, 'application/json');
});

test('getJson maakt van een fout-antwoord een fout, zodat de aanroeper kan terugvallen', async () => {
  const { api } = metFetch(() => json(null, false, 500));
  await assert.rejects(() => api.getJson('/x'), /HTTP 500/);
});

test('alle endpoints zijn relatieve paden en vullen hun plaatshouders veilig in', () => {
  const { api } = bootHelper();
  const url = api._apiUrl('searchClients', { term: 'Jan & Piet', outOfCare: 'false' });
  assert.match(url, /^\/search_panel\/clients\?term=Jan%20%26%20Piet&/);
  for (const naam of ['weekEvents', 'weekRegistrations', 'registrationDetails', 'eventDetails', 'searchClients', 'productList', 'calendarVariables', 'employeeRegistrations']) {
    assert.match(api._apiUrl(naam, {}), /^\//, naam + ' hoort een relatief pad te zijn');
  }
});

test('de product-API levert de uursoorten en cachet een niet-lege lijst', async () => {
  const { api, calls } = metFetch(() => json({ basic_list: [['Toegestaan', [['BG licht'], ['BG zwaar']]], ['Overig', [['Niet tonen']]]] }));
  const args = { date: '2026-09-01', employeeId: '7', clientIds: ['11', '12'] };
  const eerste = await api.fetchProductList(args);
  assert.deepEqual(Array.from(eerste), ['BG licht', 'BG zwaar']);
  assert.match(calls[0].url, /employee_ids%5B%5D=7|employee_ids\[\]=7/);
  assert.match(calls[0].url, /client_ids%5B%5D=12$/, 'een tweede cliënt hoort achter de URL te staan');
  await api.fetchProductList(args);
  assert.equal(calls.length, 1, 'de tweede keer hoort uit de cache te komen');
});

test('een onverwachte product-respons is een fout (dan valt de hulp terug op de dropdown)', async () => {
  const { api } = metFetch(() => json({ iets: 'anders' }));
  await assert.rejects(() => api.fetchProductList({ date: '2026-09-01', employeeId: '7', clientIds: ['99'] }), /ONS geeft de lijst met uursoorten in een andere vorm terug/);
});

test('valibot: ONS-antwoorden in een andere vorm geven een duidelijke fout, met waar het misging', () => {
  const { api } = bootHelper();
  assert.deepEqual({ ...api.controleerOns('weekagenda', { data: [{ id: 1 }] }) }, { data: [{ id: 1 }] }, 'goede vorm: ongewijzigd terug');
  assert.ok(api.controleerOns('weekagenda', []), 'ook direct een lijst');
  assert.ok(api.controleerOns('clienten', { clients: [] }));
  assert.throws(() => api.controleerOns('weekagenda', { entries: [] }), (e) => e.name === 'OnsFormaatFout' && /ONS geeft de weekagenda in een andere vorm terug dan de hulp kent/.test(e.message) && /Meld probleem/.test(e.message));
  let fout = null;
  try { api.controleerOns('productlijst', { basic_list: [['Toegestaan', 'geen lijst'], 'kapot'] }); } catch (e) { fout = e; }
  assert.equal(fout && fout.soort, 'productlijst');
  assert.match(fout.pad, /^basic_list\.1/, 'waar het eerst misging, zonder inhoud');
  assert.throws(() => api.controleerOns('afspraaktypes', { labels: [] }), /afspraaktypes/);
});

test('valibot: cliënten zoeken en afspraaktypes ophalen melden een andere vorm hardop', async () => {
  const { api } = metFetch((url) => (/available_labels/.test(url) ? json({ labels: [] }) : /search_panel/.test(url) ? json({ resultaten: [] }) : json({ basic_list: [] })));
  await assert.rejects(() => api.searchClientsForPlan('Tamara'), /ONS geeft de gevonden cliënten in een andere vorm terug/);
});

test('de medewerker-id komt uit calendar_variables als URL en pagina niets geven', async () => {
  const { api } = metFetch((url) => (/calendar_variables/.test(url)
    ? json({ invitees: [{ type: 'client', id: 1 }, { type: 'employee', id: 4242 }] })
    : json(null, false, 404)));
  assert.equal(await api.getEmployeeIdAsync(), '4242');
});

// Regressie: blokkeert de pagina inline-scripts, dan kwam er nooit antwoord op
// de laatste stap en bleef het ophalen van uursoorten eeuwig hangen.
test('het zoeken naar de medewerker-id blijft nooit hangen', async () => {
  const { api } = metFetch(() => json(null, false, 404));
  const t0 = Date.now();
  const id = await api.getEmployeeIdAsync();
  assert.equal(id, null);
  assert.ok(Date.now() - t0 < 5000, 'hoort binnen enkele seconden op te geven');
});

test('DOMPurify: beheerbare tekst houdt alleen veilige opmaak over', () => {
  const { api, window } = bootHelper();
  const doc = window.document;
  const div = doc.createElement('div');
  div.appendChild(api.managedRichHtml('<b>Let op</b> <img src=x onerror="alert(1)"><a href="javascript:alert(2)">klik</a> <a href="https://impegno.nl" onclick="x()">site</a><script>alert(3)</script><span style="color:red;position:fixed">rood</span><svg><script>alert(4)</script></svg>'));
  const html = div.innerHTML;
  assert.doesNotMatch(html, /onerror|onclick|javascript:|<script|<img|<svg|alert/, 'niets dat code kan uitvoeren');
  assert.match(html, /<b>Let op<\/b>/, 'opmaak blijft');
  const links = [...div.querySelectorAll('a')];
  assert.equal(links[0].getAttribute('href'), null, 'javascript-link zonder href');
  assert.equal(links[1].getAttribute('href'), 'https://impegno.nl');
  assert.equal(links[1].getAttribute('target'), '_blank');
  assert.equal(links[1].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(links[1].style.color, 'rgb(204, 8, 125)', 'link in de merkkleur');
  const span = div.querySelector('span');
  assert.equal(span.style.color, 'red', 'kleur blijft');
  assert.equal(span.style.position, '', 'andere stijlen gaan eruit');
});

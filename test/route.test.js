// Route langs de huisbezoeken van een dag (Google Maps-link).
process.env.TZ = 'Europe/Amsterdam';
import test from 'node:test';
import assert from 'node:assert/strict';
const { JSDOM } = await import('jsdom');
const _dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/' });
for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'sessionStorage']) { if (!(k in globalThis)) globalThis[k] = _dom.window[k]; }
const { addressFromDetails, addressFromMapsUrl, isAtClient, postcodeFromAddress, routeUrls } = await import('../src/content/domain/route.js');

// Vorm zoals ONS de details van een afspraak geeft (nepgegevens).
const DETAILS = { event: {
  id: 1, occurrence_id: 'x', name: 'Huisbezoek - Test', location: null,
  labels: [{ id: 16, name: 'JG Huisbezoek' }],
  clients: [{ id: 2, name: 'Test Persoon', hometown: 'Ergens', birthdate: '01-01-2020',
    address: { asText: 'Teststraat 1-a, 1234AB, Teststad', mapUrl: 'https://www.google.nl/maps/place/Teststraat+1-a,+1234AB,+Teststad', email: 'x@example.org' } }],
} };

test('adres uit de details: de kaartlink van ONS', () => {
  assert.equal(addressFromDetails(DETAILS), 'Teststraat 1-a, 1234AB, Teststad');
  assert.equal(addressFromMapsUrl('https://www.google.nl/maps/place/Koornmarkt+35-a,+2611EB,+Delft'), 'Koornmarkt 35-a, 2611EB, Delft');
});

test('adres uit de details: zonder link valt hij terug op asText of losse velden, nooit op een naam', () => {
  const zonderLink = JSON.parse(JSON.stringify(DETAILS));
  delete zonderLink.event.clients[0].address.mapUrl;
  assert.equal(addressFromDetails(zonderLink), 'Teststraat 1-a, 1234AB, Teststad');
  assert.equal(addressFromDetails({ event: { clients: [{ name: 'Naam 12', address: { street: 'Laan', house_number: 5, zipcode: '1111AA', city: 'Stad' } }] } }), 'Laan 5, 1111AA, Stad');
  assert.equal(addressFromDetails({ event: { name: 'Huisbezoek Dorpstraat 3', clients: [] } }), '', 'een titel is geen adres');
});

test('bij de cliënt: geen labelcontrole, wel niet op kantoor', () => {
  assert.equal(isAtClient({ clientPresent: true, labels: [{ name: 'Face to face' }] }, false), true, 'label maakt niet uit');
  assert.equal(isAtClient({ clientPresent: true }, true), false, 'op een kantoorlocatie');
  assert.equal(isAtClient({ clientPresent: false }, false), false, 'zonder cliënt');
});

test('routes: per 10 stops, aansluitend, met vertrekpunt', () => {
  const adressen = Array.from({ length: 12 }, (_, i) => 'Straat ' + (i + 1) + ', Stad');
  const urls = routeUrls(adressen, 'Kantoor 1, Stad');
  assert.equal(urls.length, 2);
  const q = (u) => Object.fromEntries(new URLSearchParams(u.split('?')[1]));
  assert.equal(q(urls[0]).origin, 'Kantoor 1, Stad');
  assert.equal(q(urls[0]).destination, 'Straat 10, Stad');
  assert.equal(q(urls[0]).waypoints.split('|').length, 9);
  assert.equal(q(urls[1]).origin, 'Straat 10, Stad', 'tweede route begint waar de eerste eindigt');
  assert.equal(q(urls[1]).destination, 'Straat 12, Stad');
  assert.match(urls[0], /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/);
  assert.equal(new URLSearchParams(routeUrls(['A 1, B'])[0].split('?')[1]).get('origin'), null, 'zonder vertrekpunt: start bij je locatie');
  assert.deepEqual(routeUrls([]), []);
});

test('postcode uit een adresregel', () => {
  assert.equal(postcodeFromAddress('Koornmarkt 35-a, 2611EB, Delft'), '2611EB');
  assert.equal(postcodeFromAddress('Laan 5, 1111 aa, Stad'), '1111AA');
  assert.equal(postcodeFromAddress('Laan 5, Stad'), '');
});

test('kantoor bij een ONS-locatie: alleen BG en J&G, met de echte locatienamen', async () => {
  const { officeForLocation } = await import('../src/content/domain/offices.js');
  const { DEFAULT_APP_CONFIG } = await import('../src/content/config/defaults.js');
  const o = DEFAULT_APP_CONFIG.offices;
  const verwacht = {
    'BG Rotterdam (73731810 / )': '3083CW', 'BG Breda (73731810 / )': '4822NH', 'BG Meierij': '5232BC', 'BG BOEV-Kempen': '5612EK',
    'BG Den Haag Noord-Oost': '2521DB', 'BG Oosterhout': '4822NH', 'BG Brabantse Wal (73731810 / )': '4624DE', 'BG Veluwe-Gelderland': '6716AE',
    'BG NOB': '5344AT', 'BG Midden Holland': '2803PB', 'BG Utrecht': '3432ET', 'BG Westland': '2671ZP', 'BG Holland Rijnland': '2312TH',
    'BG Den Haag Zuid-West': '2552AE', 'BG Waalwijk': '5141PA', 'BG Rijswijk-Delft e.o.': '2285VL',
    'J&G Kracht': '2552AE', 'J&G Kracht GKO': '2552AE', 'J&G Utrecht': '3432ET', 'J&G Oosterhout': '4822NH', 'J&G NOB': '5344AT',
    'J&G Zoetermeer': '2713JA', 'J&G Rijswijk-Delft': '2285VL', 'J&G Midden-Holland': '2803PB', 'J&G Breda en West-Brabant West': '4822NH',
    'J&G Zuidoost-Brabant': '5612EK', 'J&G Hart van Brabant': '5026RM',
    // Onbekend of geen kantoor:
    'BG DH2': null, 'BG HWDN (73731810 / )': null, 'BG ADGG': null, 'BG De6 (73731810 / )': null, 'BG Overig': null,
    'GGZ volwassenen (73738332 / )': null, 'Jeugd en Gezin (73731810 / )': null, 'Breda': null,
  };
  for (const [naam, pc] of Object.entries(verwacht)) {
    const r = officeForLocation(naam, o);
    assert.equal(r ? r.postcode : null, pc, naam);
  }
  assert.equal(officeForLocation('J&G Bosschenhoofd', o), null, 'geen halve woorden (oss)');
});

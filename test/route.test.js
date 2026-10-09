// Route langs de huisbezoeken van een dag (Google Maps-link).
process.env.TZ = 'Europe/Amsterdam';
import test from 'node:test';
import assert from 'node:assert/strict';
const { JSDOM } = await import('jsdom');
const _dom = new JSDOM('<!doctype html><body></body>', { url: 'https://impegno.onsagenda.nl/' });
for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'sessionStorage']) { if (!(k in globalThis)) globalThis[k] = _dom.window[k]; }
const { addressFromDetails, addressFromMapsUrl, isHomeVisit, routeUrls } = await import('../src/content/domain/route.js');

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

test('huisbezoek herkennen aan label of uursoort', () => {
  assert.equal(isHomeVisit({ labels: [{ name: 'JG Huisbezoek' }] }), true);
  assert.equal(isHomeVisit({ labels: [{ name: 'Face to face' }], hourType: '' }), false);
  assert.equal(isHomeVisit({ labels: [], hourType: 'Huisbezoek ambulant' }), true);
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

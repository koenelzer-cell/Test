// QR-code van de route (in de extensie gemaakt, geen QR-dienst).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { qrMatrix, qrSvg } from '../src/sidepanel/qr.js';

const LINK = 'https://www.google.com/maps/dir/?api=1&destination=Laan%205%2C%202613RR%2C%20Delft&waypoints=Teststraat%201%2C%202611EB%2C%20Delft&travelmode=driving';

test('QR: geldige grootte en de drie zoekpatronen in de hoeken', () => {
  const m = qrMatrix(LINK);
  assert.ok(m && (m.n - 21) % 4 === 0, 'n = 21 + 4 x (versie - 1)');
  for (const [r, c] of [[0, 0], [0, m.n - 7], [m.n - 7, 0]]) {
    // Zoekpatroon: donkere rand van 7x7, licht ringetje, donker blokje van 3x3.
    assert.equal(m.dark(r, c), true); assert.equal(m.dark(r + 6, c + 6), true);
    assert.equal(m.dark(r + 1, c + 1), false); assert.equal(m.dark(r + 3, c + 3), true);
  }
});

test('QR: lange route (10 stops) past, veel te lang geeft null', () => {
  const lang = LINK + '&x=' + 'Koornmarkt%2035-a%2C%202611EB%2C%20Delft%7C'.repeat(10);
  assert.ok(qrMatrix(lang));
  assert.equal(qrMatrix('x'.repeat(5000)), null);
});

test('QR: SVG met witte rand en één pad', () => {
  const { document } = new JSDOM('').window;
  const svg = qrSvg(document, LINK, 240);
  const n = qrMatrix(LINK).n;
  assert.equal(svg.getAttribute('viewBox'), '0 0 ' + (n + 8) + ' ' + (n + 8));
  assert.equal(svg.getAttribute('width'), String(Math.max(240, (n + 8) * 3)), 'minstens 3 px per module');
  assert.equal(svg.querySelectorAll('path').length, 1);
  assert.match(svg.querySelector('path').getAttribute('d'), /^M4 4h1v1h-1z/, 'eerste module linksboven (zoekpatroon) na de rand');
});

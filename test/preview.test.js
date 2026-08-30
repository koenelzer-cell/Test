// Controle vóór opslaan. De hulp vult onderweg meerdere velden in ONS in;
// zonder overzicht merkt de medewerker een stille fout pas achteraf.
//
// Twee eisen: het overzicht moet de ECHTE stand tonen (niet wat de hulp dénkt
// te hebben ingevuld), en het mag zelf niets veranderen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreviewList } from './build/components.mjs';

const TOKENS = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
};
const toon = (rows) => renderToStaticMarkup(createElement(PreviewList, { rows, tokens: TOKENS }));

test('het overzicht toont elk veld met zijn waarde', () => {
  const html = toon([
    { label: 'Type', waarde: 'Huisbezoek', ontbreekt: false },
    { label: 'Duur', waarde: '60 min', ontbreekt: false },
    { label: 'Uursoort Tinus', waarde: 'BG zwaar', ontbreekt: false },
  ]);
  assert.match(html, /Dit wordt opgeslagen/);
  assert.match(html, /Huisbezoek/);
  assert.match(html, /60 min/);
  assert.match(html, /Uursoort Tinus/);
  assert.match(html, /BG zwaar/);
});

test('een leeg veld valt op en wordt geteld', () => {
  const html = toon([
    { label: 'Type', waarde: 'Huisbezoek', ontbreekt: false },
    { label: 'Uursoort Tamara', waarde: '', ontbreekt: true },
  ]);
  assert.match(html, /nog leeg/, 'een leeg veld hoort als zodanig benoemd te worden');
  assert.match(html, /Eén veld is nog leeg/, 'en geteld, zodat het niet over het hoofd wordt gezien');
});

test('meerdere lege velden worden in meervoud geteld', () => {
  const html = toon([
    { label: 'Uursoort Tinus', waarde: '', ontbreekt: true },
    { label: 'Uursoort Tamara', waarde: '', ontbreekt: true },
  ]);
  assert.match(html, /2 velden zijn nog leeg/);
});

test('zonder lege velden verschijnt er geen waarschuwing', () => {
  const html = toon([{ label: 'Type', waarde: 'Huisbezoek', ontbreekt: false }]);
  assert.doesNotMatch(html, /nog leeg/);
});

test('een leeg overzicht toont niets in plaats van een lege kop', () => {
  assert.equal(toon([]), '');
  assert.equal(toon(null), '');
});

// ── De leeskant: leest het de werkelijke stand uit ONS? ──────────────────────

test('de uursoort wordt uit de cliëntkaart gelezen, niet uit de eigen state', async () => {
  const { bootHelper } = await import('./helpers/harness.mjs');
  const { api, document } = bootHelper();
  assert.ok(api.entryUursoortText, 'entryUursoortText is niet blootgesteld');

  const kaart = document.createElement('li');
  const sub = document.createElement('div');
  const summary = document.createElement('span');
  summary.className = '_summary_x1y2z';
  summary.textContent = 'BG zwaar';
  sub.appendChild(summary);
  kaart.appendChild(sub);
  document.body.appendChild(kaart);

  assert.equal(api.entryUursoortText({ card: kaart }), 'BG zwaar',
    'het overzicht hoort te tonen wat er echt in ONS staat');
});

test('een cliëntkaart zonder gekozen uursoort levert lege tekst op', async () => {
  const { bootHelper } = await import('./helpers/harness.mjs');
  const { api, document } = bootHelper();
  const kaart = document.createElement('li');
  document.body.appendChild(kaart);
  assert.equal(api.entryUursoortText({ card: kaart }), '',
    'niets gekozen hoort leeg te zijn, niet een verzonnen waarde');
  assert.equal(api.entryUursoortText(null), '');
});

test('het opbouwen van het overzicht verandert niets aan de pagina', async () => {
  const { bootHelper } = await import('./helpers/harness.mjs');
  const { api, document } = bootHelper();
  document.body.innerHTML = '<div id="proef"><input id="titel" value="Bestaande titel"></div>';
  const voor = document.body.innerHTML;
  try { api.appointmentPreviewRows(); } catch (e) { /* zonder ONS-pagina mag dit falen */ }
  assert.equal(document.body.innerHTML, voor,
    'de controle is puur lezen; hij mag de afspraak niet aanraken');
});

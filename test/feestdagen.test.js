// Feestdagen: naam uit ONS -> eigen ontwerp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feestdagSleutel } from '../src/sidepanel/feestdagen.js';

test('feestdag herkennen aan de naam uit ONS', () => {
  const namen = ['Hemelvaartsdag', 'Eerste pinksterdag', ' Tweede pinksterdag', 'Eerste kerstdag', 'Tweede kerstdag', 'Nieuwjaarsdag',
    'Eerste paasdag', 'Tweede paasdag', 'Koningsdag', 'Bevrijdingsdag', 'Suikerfeest'];
  assert.deepEqual(namen.map(feestdagSleutel), ['hemel', 'pinkster1', 'pinkster2', 'kerst1', 'kerst2', 'nieuwjaar',
    'paas1', 'paas2', 'koning', 'bevrijding', 'standaard']);
});

test('feestdag herkennen: alleen op naam, ook als hij net anders is ingetypt', () => {
  const v = { 'koningsdag': 'koning', 'KONINGSDAG 2027': 'koning', '2e Paasdag': 'paas2', 'Paasmaandag': 'paas2', 'Pasen': 'paas1', '1e paasdag': 'paas1',
    'Pinkstermaandag': 'pinkster2', 'tweede  Pinksterdag': 'pinkster2', '2de kerstdag': 'kerst2', 'Kerstmis': 'kerst1', '1e Kerstdag': 'kerst1',
    'Nieuwjaar': 'nieuwjaar', 'Bevrijdingsdag (lustrum)': 'bevrijding', 'Hemelvaart': 'hemel', 'Teamuitje': 'standaard' };
  Object.entries(v).forEach(([naam, sleutel]) => assert.equal(feestdagSleutel(naam), sleutel, naam));
});

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

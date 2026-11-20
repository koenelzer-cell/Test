// Eigen duur in de planhulp (src/shared/duur.js): zelf getypte duur lezen,
// grenzen (5 minuten tot 8 uur) en de stappen van min en plus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DUUR_MAX, DUUR_MIN, duurInvoer, geldigeDuur, kwartierStap, leesDuur } from '../src/shared/duur.js';

test('duur: uren en minuten lezen', () => {
  assert.equal(leesDuur('2:45'), 165);
  assert.equal(leesDuur('0:20'), 20);
  assert.equal(leesDuur('2:5'), 125);
  assert.equal(leesDuur('2u45'), 165);
  assert.equal(leesDuur('2u'), 120);
  assert.equal(leesDuur('2 uur'), 120);
  assert.equal(leesDuur(' 1:07 '), 67);
  assert.equal(leesDuur('2,5'), 150);
  assert.equal(leesDuur('1.25'), 75);
  assert.equal(leesDuur('20m'), 20);
  assert.equal(leesDuur('20 min'), 20);
  assert.equal(leesDuur('45 minuten'), 45);
  assert.equal(leesDuur('3'), 180, 'los getal tot en met 8: uren');
  assert.equal(leesDuur('8'), 480);
  assert.equal(leesDuur('90'), 90, 'daarboven: minuten');
});

test('duur: onzin en te veel minuten geven null', () => {
  for (const t of ['', null, undefined, 'abc', '2:60', '1:2:3', '-1', '2u45x', '1000']) assert.equal(leesDuur(t), null, String(t));
});

test('duur: grenzen 5 minuten tot 8 uur', () => {
  assert.equal(DUUR_MIN, 5);
  assert.equal(DUUR_MAX, 480);
  assert.equal(geldigeDuur(5), true);
  assert.equal(geldigeDuur(480), true);
  assert.equal(geldigeDuur(4), false);
  assert.equal(geldigeDuur(481), false);
  assert.equal(geldigeDuur(null), false);
  assert.equal(geldigeDuur(leesDuur('9:00')), false);
});

test('duur: invoertekst', () => {
  assert.equal(duurInvoer(165), '2:45');
  assert.equal(duurInvoer(20), '0:20');
  assert.equal(duurInvoer(480), '8:00');
});

test('duur: min en plus gaan naar het volgende hele kwartier', () => {
  assert.equal(kwartierStap(150, 1), 165);
  assert.equal(kwartierStap(150, -1), 135);
  assert.equal(kwartierStap(20, 1), 30, 'van 20 minuten naar het kwartier erboven');
  assert.equal(kwartierStap(20, -1), 15, 'en naar het kwartier eronder');
  assert.equal(kwartierStap(15, -1), 5, 'niet onder 5 minuten');
  assert.equal(kwartierStap(5, -1), 5);
  assert.equal(kwartierStap(5, 1), 15);
  assert.equal(kwartierStap(472, 1), 480);
  assert.equal(kwartierStap(480, 1), 480, 'niet boven 8 uur');
});

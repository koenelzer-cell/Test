// Terug volgt nu de werkelijke route in plaats van één vast doel per scherm.
// Aanleiding: vanuit het reistijdscherm kwam je in het keuzemenu terecht,
// terwijl je van de duurkeuze kwam.
//
// Terug maakt niets ongedaan — de wizard schrijft onderweg in ONS. De stapel
// bepaalt alleen wélk scherm je weer ziet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

// De geschiedenis komt uit de jsdom-omgeving; overzetten naar een gewone array
// van dit proces voordat we vergelijken.
const route = (api) => Array.from(api.__getScreenHistory() || []);

test('de route wordt bijgehouden in de volgorde waarin je hem loopt', () => {
  const { api } = bootHelper();
  assert.ok(api.markScreen && api.__getScreenHistory, 'geschiedenis is niet blootgesteld');

  api.markScreen('choices');
  api.markScreen('appointmentDurationSelection', { choice: { label: 'Huisbezoek' } });
  api.markScreen('appointmentTravelSelection', { choice: { label: 'Huisbezoek' } });

  assert.deepEqual(route(api), ['choices', 'appointmentDurationSelection'],
    'het huidige scherm hoort niet in de geschiedenis, de route ernaartoe wel');
});

test('hetzelfde scherm opnieuw tekenen groeit de geschiedenis niet', () => {
  const { api } = bootHelper();
  api.markScreen('choices');
  api.markScreen('appointmentReadyToSave');
  // Het opslaanscherm hertekent zichzelf bij elke omslag van de doorplannen-bewaking.
  api.markScreen('appointmentReadyToSave');
  api.markScreen('appointmentReadyToSave');

  assert.deepEqual(route(api), ['choices'],
    'een scherm dat zichzelf hertekent mag de stapel niet volpompen');
});

test('de geschiedenis loopt niet onbeperkt vol', () => {
  const { api } = bootHelper();
  // Afwisselend twee schermen, zodat elke stap ook echt telt.
  for (let i = 0; i < 60; i++) api.markScreen(i % 2 ? 'choices' : 'registrationChoices');
  const n = route(api).length;
  assert.ok(n <= 20, 'de stapel hoort begrensd te zijn, kreeg ' + n);
});

test('een nieuwe sessie begint zonder de route van de vorige', () => {
  const { api } = bootHelper();
  api.markScreen('choices');
  api.markScreen('appointmentDurationSelection');
  api.clearScreenHistory();
  assert.deepEqual(route(api), [], 'na deactiveren mag er geen oude route blijven staan');
});

test('een niet-herstelbaar scherm onderbreekt de route niet', () => {
  const { api } = bootHelper();
  api.markScreen('choices');
  api.markScreen('appointmentDurationSelection');
  // showUursoort e.d. wissen de markering; de route ernaartoe blijft bruikbaar.
  api.clearScreenMark();
  assert.deepEqual(route(api), ['choices', 'appointmentDurationSelection'],
    'de opgebouwde route hoort te blijven staan, ook als het huidige scherm niet herstelbaar is');
});

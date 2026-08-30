// De schermtoestand: welk hulpscherm staat er? Voorheen werd dat achteraf
// geraden door de schermTEKST met patronen te ontleden — en juist die teksten
// zijn in het beheerscherm aanpasbaar. Deze tests borgen dat het scherm zichzelf
// aanmeldt en dat een niet-herstelbaar scherm de markering wist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

test('een scherm meldt zichzelf aan, inclusief zijn gegevens', () => {
  const { api } = bootHelper();
  assert.ok(api.markScreen, 'markScreen is niet blootgesteld');

  api.markScreen('appointmentReadyToSave');
  assert.equal(api.__getCurrentScreen().name, 'appointmentReadyToSave');

  const keuze = { label: 'Huisbezoek' };
  api.markScreen('registrationDurationAsk', { choice: keuze });
  const nu = api.__getCurrentScreen();
  assert.equal(nu.name, 'registrationDurationAsk');
  assert.equal(nu.args.choice.label, 'Huisbezoek', 'de gegevens van het scherm moeten mee worden onthouden');
});

test('een nieuw scherm vervangt het vorige', () => {
  const { api } = bootHelper();
  api.markScreen('choices');
  api.markScreen('appointmentTravelSelection', { choice: { label: 'Huisbezoek' } });
  assert.equal(api.__getCurrentScreen().name, 'appointmentTravelSelection');
});

test('een niet-herstelbaar scherm wist de markering', () => {
  const { api } = bootHelper();
  api.markScreen('appointmentReadyToSave');
  api.clearScreenMark();
  assert.equal(api.__getCurrentScreen(), null,
    'blijft hier een oude markering staan, dan springt de hulp bij aan/uit zetten naar het VERKEERDE scherm');
});

test('de schermtoestand hangt niet af van de tekst op het scherm', () => {
  const { window, api } = bootHelper();
  api.markScreen('appointmentReadyToSave');
  // Beheerder past de schermtekst aan (dat mag): de herkenning moet blijven werken.
  window.document.body.textContent = 'Een compleet andere tekst dan voorheen';
  assert.equal(api.__getCurrentScreen().name, 'appointmentReadyToSave');
});

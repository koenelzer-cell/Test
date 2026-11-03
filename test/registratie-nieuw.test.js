// Het vernieuwde registratieformulier (impegno-backup-staging.onsagenda.nl):
// daar draait de oude registratiehulp niet; de module registratie-nieuw
// herkent het formulier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

test('op de host met het nieuwe formulier: oude registratiehulp uit, nieuwe module herkent het formulier', async () => {
  const { api } = bootHelper({ url: 'https://impegno-backup-staging.onsagenda.nl/registrations/07eaa0c43ea6c/edit?redirect_to_calendar=true' });
  await tick();
  assert.equal(api.opNieuwFormulierHost('impegno-backup-staging.onsagenda.nl'), true);
  assert.notEqual(api.getHelperPanel().activeMode, 'registrations', 'de oude registratiehulp start niet');
  assert.equal(api.nieuweRegistratiehulpActief(), true);
});

test('elders blijft alles zoals het was: de oude registratiehulp start op het registratieformulier', async () => {
  const { api } = bootHelper({ url: 'https://impegno.onsagenda.nl/registrations/07eaa0c43ea6c/edit?redirect_to_calendar=true' });
  await tick();
  assert.equal(api.opNieuwFormulierHost('impegno.onsagenda.nl'), false);
  assert.equal(api.getHelperPanel().activeMode, 'registrations');
  assert.equal(api.nieuweRegistratiehulpActief(), false);
});

test('op de nieuwe host maar niet op een registratieformulier: de module staat uit', async () => {
  const { api } = bootHelper({ url: 'https://impegno-backup-staging.onsagenda.nl/invitees/1/calendar/week' });
  await tick();
  assert.equal(api.nieuweRegistratiehulpActief(), false);
});

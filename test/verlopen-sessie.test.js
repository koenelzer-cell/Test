// Klaargezette gegevens in sessionStorage (afspraak uit de planhulp, kopieën,
// registratie vanuit een afspraak): verlopen betekent meteen weg, niet alleen
// negeren. Geldig blijft staan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const ONS = 'https://impegno.onsagenda.nl';
const AFSPRAAK = 'onsHelper.pendingAppointment', KOPIE = 'onsHelper.pendingDuplicates', REG = 'onsHelper.pendingReg';

test('afspraak uit de planhulp: na twee minuten weg; vers, onbruikbaar en onleesbaar', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  const ss = window.sessionStorage;
  ss.setItem(AFSPRAAK, JSON.stringify({ date: '2026-10-20', time: '10:00', ts: Date.now() - 3 * 60000 }));
  api.forgetStalePendingAppointment();
  assert.equal(ss.getItem(AFSPRAAK), null, 'verlopen: weg');
  ss.setItem(AFSPRAAK, JSON.stringify({ date: '2026-10-20', time: '10:00', ts: Date.now() - 30000 }));
  api.forgetStalePendingAppointment();
  assert.ok(ss.getItem(AFSPRAAK), 'vers: blijft');
  ss.setItem(AFSPRAAK, JSON.stringify({ date: '2026-10-20', ts: Date.now() }));
  api.forgetStalePendingAppointment();
  assert.equal(ss.getItem(AFSPRAAK), null, 'zonder tijd: weg');
  ss.setItem(AFSPRAAK, '{kapot');
  api.forgetStalePendingAppointment();
  assert.equal(ss.getItem(AFSPRAAK), null, 'onleesbaar: weg');
  // Ook op het formulier zelf: verlopen wordt niet ingevuld en verdwijnt.
  ss.setItem(AFSPRAAK, JSON.stringify({ date: '2026-10-20', time: '10:00', ts: Date.now() - 3 * 60000 }));
  assert.equal(api.applyPendingAppointment(), null);
  assert.equal(ss.getItem(AFSPRAAK), null);
});

test('kopieën: buiten het formulier na tien seconden weg, op het formulier pas na een half uur', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  const ss = window.sessionStorage;
  const zet = (oud) => ss.setItem(KOPIE, JSON.stringify({ moments: [{ date: '2026-10-21', startMin: 600 }], ts: Date.now() - oud }));
  zet(60000);
  api.forgetStaleDuplicates();
  assert.equal(ss.getItem(KOPIE), null, 'niet op het formulier: weg');
  const opFormulier = bootHelper({ url: ONS + '/calendar/events/new?invitee_ids%5B%5D=1' });
  const ss2 = opFormulier.window.sessionStorage;
  ss2.setItem(KOPIE, JSON.stringify({ moments: [{ date: '2026-10-21', startMin: 600 }], ts: Date.now() - 20 * 60000 }));
  opFormulier.api.forgetStaleDuplicates();
  assert.ok(ss2.getItem(KOPIE), 'op het formulier, 20 min: blijft');
  ss2.setItem(KOPIE, JSON.stringify({ moments: [{ date: '2026-10-21', startMin: 600 }], ts: Date.now() - 31 * 60000 }));
  opFormulier.api.forgetStaleDuplicates();
  assert.equal(ss2.getItem(KOPIE), null, 'op het formulier, na een half uur: weg');
  ss2.setItem(KOPIE, JSON.stringify({ moments: [] }));
  opFormulier.api.forgetStaleDuplicates();
  assert.equal(ss2.getItem(KOPIE), null, 'zonder tijdstempel: weg');
});

test('registratie vanuit een afspraak: zonder registratie-id na tien minuten weg, met id blijft hij', async () => {
  const { api, window } = bootHelper({ url: ONS + '/invitees/1/calendar/week' });
  const ss = window.sessionStorage;
  api.__setPendingRegistration({ id: null, label: 'Huisbezoek', ts: Date.now() - 11 * 60000 });
  api.forgetStalePendingRegistration();
  assert.equal(ss.getItem(REG), null, 'verlopen zonder id: weg');
  api.__setPendingRegistration({ id: null, label: 'Huisbezoek', ts: Date.now() - 60000 });
  api.forgetStalePendingRegistration();
  assert.ok(ss.getItem(REG), 'vers: blijft');
  api.__setPendingRegistration({ id: '123', vorm: 'Huisbezoek', ts: Date.now() - 60 * 60000 });
  api.forgetStalePendingRegistration();
  assert.ok(ss.getItem(REG), 'met id: blijft voor die registratie (herstel na verversen)');
  ss.setItem(REG, 'kapot');
  api.forgetStalePendingRegistration();
  assert.equal(ss.getItem(REG), null, 'onleesbaar: weg');
});

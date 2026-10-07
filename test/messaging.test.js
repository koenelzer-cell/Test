// Berichten tussen het content-script en de rest van de extensie, op een
// echte (jsdom-)pagina met de gebouwde bundel. Deze tests lopen de paden die
// alleen bij een bericht draaien — daar zaten ontbrekende imports eerder
// verstopt (esbuild meldt die niet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const AGENDA = 'https://impegno.onsagenda.nl/invitees/123/calendar/workweek?date=2026-08-31';
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test('op de agenda vraagt het script of het zijpaneel openstaat', async () => {
  const { sent } = bootHelper({ url: AGENDA });
  await tick();
  assert.ok(sent.some((m) => m && m.type === 'sidepanel-query'));
});

test('het zijpaneel krijgt op verzoek de toestand van de Agendahulp', async () => {
  const { deliver } = bootHelper({ url: AGENDA });
  await tick();
  const res = await deliver({ type: 'ag-get-state' });
  assert.ok(res && 'state' in res, 'er hoort een antwoord met state te komen');
  if (res.state) {
    assert.equal(typeof res.state.enabled, 'boolean');
    assert.ok(Array.isArray(res.state.legend));
  }
});

test('zijpaneel open: de toestand wordt uitgezonden; dicht: niet meer', async () => {
  const { deliver, sent } = bootHelper({ url: AGENDA });
  await tick();
  await deliver({ type: 'sidepanel-state', open: true });
  await tick();
  assert.ok(sent.some((m) => m && m.type === 'ag-state'), 'na openen hoort de toestand verstuurd te worden');
});

test('de dagindeling aan/uit zetten vanuit het zijpaneel wordt onthouden', async () => {
  const { deliver, window } = bootHelper({ url: AGENDA });
  await tick();
  await deliver({ type: 'ag-toggle-enabled', value: false });
  assert.equal(window.localStorage.getItem('onsHelper.greyEnabled'), '0');
});

test('de registratievormen gaan naar de service worker (voor het rechtermuismenu)', async () => {
  const { sent, api } = bootHelper({ url: AGENDA });
  await tick();
  api.pushRegistrationForms();
  const forms = sent.filter((m) => m && m.type === 'forms').at(-1);
  assert.ok(forms && forms.forms.length > 0);
});

test('een menukeuze zonder aangeklikte afspraak geeft geen fout', async () => {
  const { deliver } = bootHelper({ url: AGENDA });
  await tick();
  await assert.doesNotReject(() => deliver({ type: 'ctx-register', vorm: 'MDO' }));
});

test('de agenda verlaten meldt dat aan het zijpaneel', async () => {
  const { deliver, sent, window } = bootHelper({ url: AGENDA });
  await tick();
  await deliver({ type: 'sidepanel-state', open: true });
  window.history.pushState({}, '', '/clients/1');
  window.dispatchEvent(new window.Event('locationchange'));
  await tick();
  assert.ok(sent.some((m) => m && m.type === 'ag-gone'));
});

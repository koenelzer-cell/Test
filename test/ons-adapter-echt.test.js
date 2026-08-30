// De adapter tegen een ECHTE, opgeslagen ONS-pagina (meerdere-clienten.html):
// drie cliënten, waaronder één met een wachtlijst-markering.
//
// WAT DEZE FIXTURE WEL EN NIET KAN
// Een opgeslagen HTML-bestand bevat geen shadow DOM: elementen als
// <uc-date-input> en <uc-time-input> staan er leeg in, omdat hun invoerveld pas
// op de draaiende pagina door JavaScript wordt aangemaakt. Datum- en
// tijdvelden zijn hier dus niet te testen — dat is een beperking van de export,
// geen fout in de extensie.
//
// Wat er wél volledig in staat is de lichte DOM: de cliëntkaarten met hun
// namen, uitklapknoppen en uursoort-velden. Precies de plek waar de fouten
// zaten die deze week zijn opgelost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper, fixture } from './helpers/harness.mjs';

const echt = () => bootHelper({ html: fixture('meerdere-clienten.html') });

test('alle drie de cliënten uit de echte pagina worden herkend', () => {
  const { api } = echt();
  const rijen = Array.from(api.OnsAdapter.clienten.lijst() || []);
  assert.equal(rijen.length, 3, 'verwacht 3 cliënten, kreeg ' + rijen.length);
  assert.deepEqual(rijen.map((r) => r.name), ['Tinus Test', 'Tamara Test', 'Dhr. T. Testjes']);
});

test('een naam met aanhef levert een bruikbare voornaam op', () => {
  const { api } = echt();
  const rijen = Array.from(api.OnsAdapter.clienten.lijst() || []);
  rijen.forEach((r) => {
    assert.ok(r.firstName && r.firstName.length > 0,
      'elke cliënt heeft een aanspreeknaam nodig; die komt in schermteksten terecht');
  });
});

test('een wachtlijst-markering verstoort de herkenning niet', () => {
  const { api } = echt();
  const rijen = Array.from(api.OnsAdapter.clienten.lijst() || []);
  const wacht = rijen.find((r) => /Testjes/.test(r.name));
  assert.ok(wacht, 'de cliënt met de wachtlijst-tag hoort gewoon mee te tellen');
  assert.ok(api.OnsAdapter.clienten.uursoortVeld(wacht), 'en een eigen uursoort-veld te hebben');
});

test('ELKE cliënt krijgt een eigen uursoort-veld', () => {
  const { api } = echt();
  const rijen = Array.from(api.OnsAdapter.clienten.lijst() || []);
  const velden = rijen.map((r) => api.OnsAdapter.clienten.uursoortVeld(r));
  velden.forEach((v, i) => assert.ok(v, 'cliënt ' + (i + 1) + ' heeft geen uursoort-veld'));
  assert.equal(new Set(velden).size, velden.length,
    'twee cliënten wijzen naar hetzelfde veld — dan belandt de uursoort bij de verkeerde persoon');
});

test('nog niet ingevulde uursoorten worden als leeg gemeld, niet geraden', () => {
  const { api } = echt();
  const rijen = Array.from(api.OnsAdapter.clienten.lijst() || []);
  rijen.forEach((r) => {
    assert.equal(api.OnsAdapter.clienten.heeftUursoort(r), false);
    assert.equal(api.OnsAdapter.clienten.uursoort(r), '');
  });
});

test('alle drie de cliënten staan op de lijst "mist nog een uursoort"', () => {
  const { api } = echt();
  const missend = Array.from(api.clientsMissingUursoortEntries(new Set()));
  assert.equal(missend.length, 3,
    'geen enkele cliënt heeft een uursoort, dus alle drie moeten worden aangeboden');
});

test('een al afgehandelde cliënt valt af, de rest blijft over', () => {
  const { api } = echt();
  const missend = Array.from(api.clientsMissingUursoortEntries(new Set(['tinus test'])));
  assert.equal(missend.length, 2, 'wie al geholpen is, hoort niet opnieuw langs te komen');
  assert.ok(!missend.some((e) => /Tinus/.test(e.name)));
});

test('de zelftest meldt per cliënt geen ontbrekend veld als ze er allemaal zijn', () => {
  const { api } = echt();
  const gemist = Array.from(api.appointmentMissingHooks());
  assert.ok(!gemist.some((n) => /uursoortveld/.test(n)),
    'alle drie de uursoort-velden zijn aanwezig; er hoort er dus geen gemeld te worden');
});

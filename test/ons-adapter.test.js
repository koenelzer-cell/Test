// De ONS-adapter: één gedocumenteerde naad naar ONS, zodat de rest van de
// extensie niet hoeft te weten hóé ONS zijn velden opbouwt.
//
// De opbrengst zit hier: met een opgeslagen stuk ONS-HTML kun je controleren of
// de herkenning nog klopt. Verandert ONS, dan falen déze tests — in plaats van
// dat een medewerker het merkt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper, fixture } from './helpers/harness.mjs';

const metAfspraak = () => bootHelper({ html: fixture('afspraak-twee-clienten.html') });

test('de adapter vindt beide cliëntkaarten', () => {
  const { api } = metAfspraak();
  const rijen = api.OnsAdapter.clienten.lijst();
  assert.equal(rijen.length, 2);
  assert.deepEqual(Array.from(rijen, (r) => r.firstName), ['Tinus', 'Tamara']);
});

test('de adapter leest per cliënt de gekozen uursoort', () => {
  const { api } = metAfspraak();
  const rijen = api.OnsAdapter.clienten.lijst();
  assert.equal(api.OnsAdapter.clienten.uursoort(rijen[0]), 'BG zwaar');
  assert.equal(api.OnsAdapter.clienten.uursoort(rijen[1]), '',
    'Tamara heeft nog geen uursoort; dat hoort leeg te zijn, niet geraden');
});

test('de adapter geeft per cliënt een eigen uursoort-veld', () => {
  const { api } = metAfspraak();
  const rijen = api.OnsAdapter.clienten.lijst();
  const a = api.OnsAdapter.clienten.uursoortVeld(rijen[0]);
  const b = api.OnsAdapter.clienten.uursoortVeld(rijen[1]);
  assert.ok(a && b, 'beide cliënten horen een veld te hebben');
  assert.notEqual(a, b, 'wijzen ze naar hetzelfde veld, dan belandt de uursoort bij de verkeerde cliënt');
});

// ── Het register van gemiste velden ─────────────────────────────────────────

test('een veld dat ONS niet (meer) heeft, wordt geregistreerd', () => {
  const { api } = bootHelper(); // lege pagina: niets is te vinden
  api.onsVergeetGemist();
  api.OnsAdapter.afspraak.labelVeld();
  api.OnsAdapter.afspraak.datumVeld();
  const gemist = Array.from(api.onsGemisteVelden());
  assert.ok(gemist.includes('label'), 'een ontbrekend labelveld hoort gemeld te worden');
  assert.ok(gemist.includes('datum'), 'een ontbrekende datum ook');
});

test('de namen in het register zijn leesbaar voor een medewerker', () => {
  const { api } = bootHelper();
  api.onsVergeetGemist();
  api.OnsAdapter.afspraak.begintijdVeld();
  api.OnsAdapter.afspraak.eindtijdVeld();
  const gemist = Array.from(api.onsGemisteVelden());
  gemist.forEach((naam) => {
    assert.doesNotMatch(naam, /[A-Z][a-z]+[A-Z]|querySelector|data-qa/,
      'de melding gaat naar een medewerker, dus geen functienamen of selectors: ' + naam);
  });
});

test('het register wordt gewist bij een nieuwe controle', () => {
  const { api } = bootHelper();
  api.OnsAdapter.afspraak.labelVeld();
  assert.ok(Array.from(api.onsGemisteVelden()).length > 0);
  api.onsVergeetGemist();
  assert.equal(Array.from(api.onsGemisteVelden()).length, 0);
});

// ── De zelftest bouwt hierop ────────────────────────────────────────────────

test('de zelftest meldt ontbrekende velden op een lege pagina', () => {
  const { api } = bootHelper();
  const gemist = Array.from(api.appointmentMissingHooks());
  assert.ok(gemist.length >= 3,
    'zonder ONS-pagina hoort de zelftest de kernvelden als ontbrekend te melden');
});

test('de zelftest kijkt verder dan de drie oorspronkelijke velden', () => {
  const { api } = metAfspraak();
  // De fixture heeft cliëntkaarten mét uursoort-velden, maar geen datum/tijd.
  const gemist = Array.from(api.appointmentMissingHooks());
  assert.ok(gemist.length > 0);
  // Vroeger stonden hier drie hardgecodeerde controles; nu komt alles mee wat
  // de adapter werkelijk probeerde te lezen.
  assert.ok(gemist.some((n) => /datum|begintijd|label/.test(n)),
    'de kernvelden horen er nog steeds bij te zitten');
});

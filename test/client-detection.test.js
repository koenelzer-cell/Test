// Meerdere cliënten in één afspraak — precies de flow waarin cliënt 2 werd
// overgeslagen of diens uursoort werd overschreven.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper, fixture } from './helpers/harness.mjs';

function boot() {
  return bootHelper({ html: fixture('afspraak-twee-clienten.html') });
}

test('beide cliënten in de afspraak worden herkend', () => {
  const { api } = boot();
  assert.ok(api.findClientEntries, 'findClientEntries is niet blootgesteld');
  const entries = api.findClientEntries();
  assert.equal(entries.length, 2, 'verwacht 2 cliënten, kreeg ' + entries.length);
  // Array.from: entries komt uit de jsdom-omgeving, dus overzetten naar een
  // gewone array van dit proces voordat we vergelijken.
  assert.deepEqual(Array.from(entries, (e) => e.name), ['Tinus Test', 'Tamara Test']);
});

test('elke cliënt krijgt een eigen uursoort-veld (niet dat van de ander)', () => {
  const { api } = boot();
  const entries = api.findClientEntries();
  const triggers = entries.map((e) => e.uursoortTrigger);
  assert.ok(triggers[0], 'cliënt 1 heeft geen uursoort-veld');
  assert.ok(triggers[1], 'cliënt 2 heeft geen uursoort-veld');
  assert.notEqual(triggers[0], triggers[1], 'beide cliënten wijzen naar HETZELFDE veld — dit is de bug waarbij de uursoort bij de verkeerde cliënt belandt');
});

test('alleen de cliënt zonder uursoort geldt als "mist nog een uursoort"', () => {
  const { api } = boot();
  const entries = api.findClientEntries();
  assert.equal(api.entryUursoortIsSet(entries[0]), true, 'Tinus heeft een uursoort en zou als gezet moeten gelden');
  assert.equal(api.entryUursoortIsSet(entries[1]), false, 'Tamara heeft nog geen uursoort');

  const missing = api.clientsMissingUursoortEntries(new Set());
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, 'Tamara Test');
});

test('een al afgehandelde cliënt wordt niet nog een keer aangeboden', () => {
  const { api } = boot();
  const behandeld = new Set(['tamara test']);
  const missing = api.clientsMissingUursoortEntries(behandeld);
  assert.equal(missing.length, 0, 'een cliënt die de gebruiker al heeft gezet mag niet opnieuw langskomen');
});

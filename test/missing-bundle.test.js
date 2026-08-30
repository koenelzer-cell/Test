// De schermen van de hulp zitten in dist/react-bundle.js. Ontbreekt die — niet
// gebouwd na een wijziging in src/, bestand kwijt, of de volgorde in het
// manifest gewijzigd — dan moet de medewerker een melding zien die de oorzaak
// benoemt, niet een leeg paneel of een generiek "Er ging iets mis".
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

// bootHelper laadt alleen content.js, dus window.__onsahReact bestaat hier niet:
// precies de situatie waarin de bundel ontbreekt.
function zonderBundel() {
  const boot = bootHelper();
  assert.equal(boot.window.__onsahReact, undefined, 'voor deze test mag de bundel juist NIET geladen zijn');
  return boot;
}

test('zonder bundel toont de hulp een melding die de oorzaak benoemt', () => {
  const { window, document, api } = zonderBundel();
  assert.ok(api.renderScreen, 'renderScreen is niet blootgesteld');

  const container = document.createElement('div');
  document.body.appendChild(container);
  const ok = api.renderScreen(container, 'choices', {});

  assert.equal(ok, false, 'renderScreen hoort false te geven als er niets getekend kon worden');
  const tekst = container.textContent || '';
  assert.match(tekst, /niet worden geladen/i, 'de melding moet zeggen dát er iets niet geladen is');
  assert.match(tekst, /Meld probleem/i, 'de melding moet zeggen wat de medewerker kan doen');
  assert.notEqual(tekst.trim(), '', 'het paneel mag niet leeg blijven');
  void window;
});

test('de melding vervangt eerdere inhoud in plaats van eronder te plakken', () => {
  const { document, api } = zonderBundel();
  const container = document.createElement('div');
  container.textContent = 'oude inhoud van een vorig scherm';
  document.body.appendChild(container);

  api.renderScreen(container, 'choices', {});
  assert.doesNotMatch(container.textContent, /oude inhoud/,
    'de vorige schermtekst moet weg zijn, anders staan er twee schermen door elkaar');
});

test('een ontbrekende container geeft geen fout', () => {
  const { api } = zonderBundel();
  assert.doesNotThrow(() => api.renderScreen(null, 'choices', {}));
});

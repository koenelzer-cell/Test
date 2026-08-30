// Schermcomponenten zijn pure functies: gegevens erin, opmaak eruit. Daardoor
// zijn ze te testen zonder browser en zonder ONS-omgeving.
// De bundel test/build/components.mjs komt uit `npm run build`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WizardScreen } from './build/components.mjs';

const TOKENS = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
};
const render = (name, props) => renderToStaticMarkup(createElement(WizardScreen, { name, props }));

test('keuzemenu toont alle afspraaktypes met hun badge', () => {
  const html = render('choices', {
    choices: [
      { label: 'Huisbezoek', tick: '#ff0000', meta: 'direct' },
      { label: 'MDO', tick: '#ffff00', meta: 'indirect' },
    ],
    tokens: TOKENS, onPick() {}, onReset() {},
  });
  assert.match(html, /Huisbezoek/);
  assert.match(html, /MDO/);
  assert.match(html, /direct/);
  assert.match(html, /Verwijder instellingen/);
});

test('geblokkeerd keuzemenu toont de melding en zet de types uit', () => {
  const html = render('choices', {
    choices: [{ label: 'Huisbezoek', tick: '#ff0000', meta: 'direct' }],
    blocked: true,
    blockedNote: 'Er zijn al instellingen toegepast.',
    tokens: TOKENS, onPick() {}, onReset() {},
  });
  assert.match(html, /Er zijn al instellingen toegepast/);
  assert.match(html, /aria-disabled="true"/, 'de afspraaktypes moeten uitgeschakeld zijn');
});

test('het registratiemenu kan een eigen label voor de resetknop hebben', () => {
  const html = render('choices', {
    choices: [{ label: 'Verslaglegging' }],
    tokens: TOKENS, resetLabel: 'Instellingen verwijderen', onPick() {}, onReset() {},
  });
  assert.match(html, /Instellingen verwijderen/);
});

test('keuzelijst toont een melding als er geen opties zijn', () => {
  const html = render('pickList', {
    title: 'Uursoort Tamara', options: [], emptyMessage: 'Geen uursoorten gevonden',
    tokens: TOKENS, onBack() {}, onPick() {},
  });
  assert.match(html, /Uursoort Tamara/);
  assert.match(html, /Geen uursoorten gevonden/);
});

test('keuzelijst toont tijdens laden geen opties en geen foutmelding', () => {
  const html = render('pickList', {
    title: 'Uursoort Tamara', loading: true, options: null,
    emptyMessage: 'Geen uursoorten gevonden', tokens: TOKENS, onBack() {}, onPick() {},
  });
  assert.doesNotMatch(html, /Geen uursoorten gevonden/,
    'tijdens laden mag niet al "niets gevonden" verschijnen');
  assert.match(html, /Terug/);
});

test('opslaanscherm: knop is gedempt zolang doorplannen opslaan blokkeert', () => {
  const geblokkeerd = render('readyToSave', {
    textNodes: [], toggleNode: null, tokens: TOKENS,
    onBack() {}, onSave() {}, saveDisabled: true, showUursoortNote: false,
  });
  assert.match(geblokkeerd, /aria-disabled="true"/);
  assert.match(geblokkeerd, /not-allowed/);

  const vrij = render('readyToSave', {
    textNodes: [], toggleNode: null, tokens: TOKENS,
    onBack() {}, onSave() {}, saveDisabled: false, showUursoortNote: false,
  });
  assert.doesNotMatch(vrij, /aria-disabled="true"/);
});

test('opslaanscherm toont de uursoort-waarschuwing alleen wanneer nodig', () => {
  const met = render('readyToSave', {
    textNodes: [], tokens: TOKENS, onBack() {}, onSave() {}, showUursoortNote: true,
  });
  assert.match(met, /voeg nog een uursoort toe/i);

  const zonder = render('readyToSave', {
    textNodes: [], tokens: TOKENS, onBack() {}, onSave() {}, showUursoortNote: false,
  });
  assert.doesNotMatch(zonder, /voeg nog een uursoort toe/i);
});

test('ja/nee-vraag toont vraag, toelichting en beide knoppen', () => {
  const html = render('prompt', {
    question: 'Afschermen via Episodes?',
    hint: 'Kopieer en plak de af te schermen zin(nen).',
    tokens: TOKENS, onYes() {}, onNo() {},
  });
  assert.match(html, /Afschermen via Episodes\?/);
  assert.match(html, /Kopieer en plak/);
  assert.match(html, />Ja</);
  assert.match(html, />Nee</);
});

test('duurscherm toont een foutmelding als de duur onbekend is', () => {
  const html = render('duration', {
    title: 'Duur directe tijd:', errorMessage: 'Registratieduur onbekend of te kort.',
    tokens: TOKENS, onBack() {},
  });
  assert.match(html, /Registratieduur onbekend of te kort/);
});

test('duurscherm toont de aangeboden minutenkeuzes', () => {
  const html = render('duration', {
    title: 'Duur directe tijd:',
    options: [{ value: 5, label: '5 min' }, { value: 10, label: '10 min' }],
    tokens: TOKENS, onBack() {}, onPick() {},
  });
  assert.match(html, /5 min/);
  assert.match(html, /10 min/);
});

test('categoriescherm toont een info-knop alleen bij opties met toelichting', () => {
  const html = render('category', {
    heading: 'Overleg',
    options: [{ display: 'Teamoverleg', info: true }, { display: 'Intervisie', info: false }],
    tokens: TOKENS, onBack() {}, onPick() {}, onInfo() {},
  });
  assert.match(html, /Teamoverleg/);
  assert.match(html, /Intervisie/);
  assert.match(html, /Meer info over Teamoverleg/);
  assert.doesNotMatch(html, /Meer info over Intervisie/);
});

test('onbekende schermnaam levert niets op i.p.v. een fout', () => {
  assert.equal(render('bestaat-niet', {}), '');
});

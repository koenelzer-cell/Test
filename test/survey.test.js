// De vragenlijstcontrole (src/survey/): welke vragen verplicht zijn en het
// opstarten van het content-script. De regels komen uit config.surveys
// (beheerscherm); hier testen we de pure logica rechtstreeks uit src/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { parseSurveys, ageSatisfies, ctLower } from '../src/survey/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('een vraag uit het beheerscherm wordt een regel met leeftijdsvoorwaarde', () => {
  const [survey] = parseSurveys([{ name: 'JG Outcome', questions: [{ question: 'Hoe tevreden ben je?  *', op: '>=', value: '12' }] }]);
  assert.equal(survey.nameLc, 'jg outcome');
  const q = survey.questions[0];
  assert.equal(q.textLc, 'hoe tevreden ben je?', 'spaties en het verplicht-sterretje horen weg te zijn');
  assert.equal(q.rule, 'vraag_verplicht');
  assert.equal(q.value, 12);
});

test('vragen zonder bruikbare tekst en lege vragenlijsten vallen weg', () => {
  assert.deepEqual(parseSurveys([{ name: 'Leeg', questions: [{ question: 'abc' }] }]), []);
  assert.deepEqual(parseSurveys(null), []);
});

test('de oude platte vorm (één vraag per vragenlijst) blijft werken', () => {
  const [survey] = parseSurveys([{ name: 'Oud', question: 'Een oude vraag', op: '<', value: 12 }]);
  assert.equal(survey.questions[0].op, '<');
});

test('leeftijdsregels: =, <, >, >=, <=, binnen en buiten', () => {
  const r = (op, value, value2) => ({ condition: 'leeftijd', op, value, value2 });
  assert.equal(ageSatisfies(12, r('>=', 12)), true);
  assert.equal(ageSatisfies(11, r('>=', 12)), false);
  assert.equal(ageSatisfies(11, r('<', 12)), true);
  assert.equal(ageSatisfies(12, r('=', 12)), true);
  assert.equal(ageSatisfies(14, r('<>', 12, 16)), true, 'binnen, grenzen inbegrepen');
  assert.equal(ageSatisfies(17, r('<>', 12, 16)), false);
  assert.equal(ageSatisfies(17, r('><', 12, 16)), true, 'buiten');
  assert.equal(ageSatisfies(null, r('>=', 12)), false, 'onbekende leeftijd: geen leeftijdsregel van toepassing');
  assert.equal(ageSatisfies(null, { condition: 'altijd' }), true);
});

test('vraagteksten worden tolerant vergeleken', () => {
  assert.equal(ctLower('  Hoe  gaat het?\nAntwoord wissen'), 'hoe gaat het?');
});

function boot(url) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.chrome = {
    runtime: { getManifest: () => ({ version: '9.9.9' }), getURL: (p) => 'chrome-extension://t/' + p, sendMessage: () => {}, onMessage: { addListener: () => {} }, lastError: undefined },
    storage: { local: { get: (k, cb) => cb({}) }, managed: { get: (k, cb) => cb({}) }, onChanged: { addListener: () => {} } },
  };
  w.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  w.eval(fs.readFileSync(path.join(ROOT, 'dist', 'survey.js'), 'utf8'));
  return w;
}

test('de controle start alleen op ONS Dossier', () => {
  const opDossier = boot('https://impegno.ons-dossier.nl/clients/1/surveys');
  assert.equal(opDossier.document.documentElement.getAttribute('data-ons-agendahulp-survey-version'), '9.9.9');
  const opAgenda = boot('https://impegno.onsagenda.nl/invitees/1/calendar/day');
  assert.equal(opAgenda.document.documentElement.getAttribute('data-ons-agendahulp-survey-version'), null);
});

// Regressie: config.json (via fetch, traag) overschreef het beleid
// (chrome.storage.managed, snel) omdat beide tegelijk werden opgevraagd.
test('bedrijfsbeleid wint van config.json, ook als config.json later binnenkomt', async () => {
  const { loadSurveyConfig, SURVEY_CONFIG, UI_OVERRIDES } = await import('../src/survey/config.js');
  const store = {
    local: { 'onsHelper.uiOverrides': { surveyAgeSelector: '#lokaal-hersteld' } },
    managed: { surveyHelperEnabled: false },
  };
  globalThis.chrome = {
    runtime: { getURL: (p) => p, lastError: undefined },
    storage: {
      local: { get: (keys, cb) => setTimeout(() => cb(store.local), 1) },
      managed: { get: (keys, cb) => setTimeout(() => cb(store.managed), 1) },
    },
  };
  globalThis.fetch = () => new Promise((resolve) => setTimeout(() => resolve({
    ok: true,
    json: () => Promise.resolve({ features: { surveyRequired: true }, uiSelectors: { surveyAgeSelector: '#uit-config' } }),
  }), 30));
  try {
    await loadSurveyConfig();
    assert.equal(SURVEY_CONFIG.surveyHelperEnabled, false, 'het beleid hoort te winnen');
    assert.equal(UI_OVERRIDES.surveyAgeSelector, '#lokaal-hersteld', 'lokaal herstel hoort te winnen van config.json');
  } finally {
    delete globalThis.chrome; delete globalThis.fetch;
  }
});

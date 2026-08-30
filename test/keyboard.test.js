// Sneltoetsen in de keuzeschermen. Het grootste risico is niet dat ze niet
// werken, maar dat ze afgaan terwijl de medewerker in ONS zit te typen: dan
// kiest een "5" in een tijdveld ineens een afspraaktype.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { WizardScreen } from './build/components.mjs';

const TOKENS = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
};

function omgeving() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
function opruimen(dom) {
  delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  try { delete global.navigator; } catch (e) {}
  dom.window.close();
}
function toets(key) {
  global.window.dispatchEvent(new global.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

async function toonKeuzemenu(extra = {}) {
  const root = createRoot(document.getElementById('root'));
  const gekozen = [];
  await act(async () => {
    root.render(createElement(WizardScreen, {
      name: 'choices',
      props: {
        choices: [{ label: 'Huisbezoek' }, { label: 'Digitaal' }, { label: 'MDO' }],
        tokens: TOKENS,
        onPick: (i) => gekozen.push(i),
        onReset() {},
        ...extra,
      },
    }));
  });
  return { root, gekozen };
}

test('cijfertoets kiest de bijbehorende optie', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu();
    await act(async () => { toets('2'); });
    assert.deepEqual(gekozen, [1], 'toets 2 hoort de tweede optie te kiezen');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('een cijfer buiten de lijst doet niets', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu();
    await act(async () => { toets('9'); });
    assert.deepEqual(gekozen, [], 'er zijn maar drie opties, dus 9 mag niets kiezen');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('pijltjes wijzen aan en Enter bevestigt', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu();
    await act(async () => { toets('ArrowDown'); toets('ArrowDown'); });
    await act(async () => { toets('Enter'); });
    assert.deepEqual(gekozen, [1], 'twee keer omlaag komt op de tweede optie uit');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('Enter zonder aanwijzing kiest niets', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu();
    await act(async () => { toets('Enter'); });
    assert.deepEqual(gekozen, [], 'zonder aanwijzing mag Enter niets kiezen');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

// ── De kern: niet ingrijpen terwijl er getypt wordt ──────────────────────────

test('een cijfer in een ONS-invoerveld kiest NIETS', async () => {
  const dom = omgeving();
  try {
    const veld = document.createElement('input');
    document.body.appendChild(veld);
    const { root, gekozen } = await toonKeuzemenu();
    veld.focus();
    await act(async () => { toets('2'); });
    assert.deepEqual(gekozen, [],
      'de hulp mag geen keuze maken terwijl de medewerker in een veld typt — dit is de ergste denkbare fout');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('ook een invoerveld in een web component (shadow DOM) telt als typen', async () => {
  const dom = omgeving();
  try {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const schaduw = host.attachShadow({ mode: 'open' });
    const veld = document.createElement('input');
    schaduw.appendChild(veld);

    const { root, gekozen } = await toonKeuzemenu();
    veld.focus();
    await act(async () => { toets('3'); });
    assert.deepEqual(gekozen, [],
      'ONS bouwt met web components; zonder afdaling door de shadow root zou de hulp hier wél ingrijpen');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('een combobox telt ook als typen', async () => {
  const dom = omgeving();
  try {
    const combo = document.createElement('div');
    combo.setAttribute('role', 'combobox');
    combo.setAttribute('tabindex', '0');
    document.body.appendChild(combo);
    const { root, gekozen } = await toonKeuzemenu();
    combo.focus();
    await act(async () => { toets('1'); });
    assert.deepEqual(gekozen, [], 'een uursoort-combobox is geen <input> maar gedraagt zich wel zo');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('met een toetscombinatie (Ctrl/Alt/Meta) grijpt de hulp niet in', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu();
    await act(async () => {
      global.window.dispatchEvent(new global.window.KeyboardEvent('keydown', { key: '2', ctrlKey: true, bubbles: true }));
    });
    assert.deepEqual(gekozen, [], 'Ctrl+2 is een browsersneltoets, geen keuze in de hulp');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('uitgeschakelde sneltoetsen doen niets (ingeklapt paneel, hulp uit)', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu({ keyboardEnabled: false });
    await act(async () => { toets('1'); });
    assert.deepEqual(gekozen, [], 'staat het paneel dicht, dan mag een cijfertoets niets kiezen');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('geblokkeerde afspraaktypes zijn ook per toetsenbord niet te kiezen', async () => {
  const dom = omgeving();
  try {
    const { root, gekozen } = await toonKeuzemenu({ blocked: true, blockedNote: 'Al ingesteld.' });
    await act(async () => { toets('1'); });
    assert.deepEqual(gekozen, [], 'wat niet klikbaar is, mag ook niet via een sneltoets');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('de sneltoets is zichtbaar op de tegel', async () => {
  const dom = omgeving();
  try {
    const { root } = await toonKeuzemenu();
    const tekst = document.getElementById('root').textContent;
    assert.match(tekst, /1/, 'zonder zichtbaar cijfer is een sneltoets een verrassing, geen functie');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

test('Ja/Nee-vragen zijn met 1 en 2 te beantwoorden', async () => {
  const dom = omgeving();
  try {
    const root = createRoot(document.getElementById('root'));
    let antwoord = null;
    await act(async () => {
      root.render(createElement(WizardScreen, {
        name: 'prompt',
        props: { question: 'No show?', tokens: TOKENS, onYes: () => { antwoord = 'ja'; }, onNo: () => { antwoord = 'nee'; } },
      }));
    });
    await act(async () => { toets('2'); });
    assert.equal(antwoord, 'nee');
    await act(async () => { root.unmount(); });
  } finally { opruimen(dom); }
});

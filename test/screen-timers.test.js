// De controle-lussen (doorplannen-bewaking, wachten op uursoort) horen bij hun
// scherm. Ze moeten vanzelf stoppen zodra dat scherm verdwijnt — voorheen moest
// dat met losse stop-aanroepen en bleef er bij vergeten een timer doortikken op
// een paneel dat niet meer bestond.
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

function mountEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  // react-dom heeft deze globals nodig. `navigator` is in Node alleen-lezen,
  // dus die moet via defineProperty tijdelijk worden overschreven.
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator, configurable: true, writable: true,
  });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

function cleanup() {
  delete global.window; delete global.document;
  delete global.IS_REACT_ACT_ENVIRONMENT;
  try { delete global.navigator; } catch (e) { /* alleen-lezen: laten staan */ }
}

test('de controle-lus tikt zolang het scherm staat en stopt daarna', async () => {
  const dom = mountEnvironment();
  try {
    let ticks = 0;
    const container = document.getElementById('root');
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(WizardScreen, {
        name: 'readyToSave',
        props: {
          textNodes: [], tokens: TOKENS, onBack() {}, onSave() {},
          onWatchTick: () => { ticks++; },
          watchIntervalMs: 20,
        },
      }));
    });

    await new Promise((r) => setTimeout(r, 90));
    const tijdensScherm = ticks;
    assert.ok(tijdensScherm > 0, 'de lus zou moeten tikken zolang het scherm staat');

    // Naar een ander scherm: React ruimt de lus op.
    await act(async () => {
      root.render(createElement(WizardScreen, {
        name: 'infoScreen',
        props: { title: 'Vrije dag', body: '' },
      }));
    });

    const naWissel = ticks;
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(ticks, naWissel,
      'de lus tikte door nadat het scherm was vervangen — dat is precies de lek die we wilden uitsluiten');

    await act(async () => { root.unmount(); });
  } finally {
    cleanup();
    dom.window.close();
  }
});

test('een lus met interval 0 start niet', async () => {
  const dom = mountEnvironment();
  try {
    let ticks = 0;
    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(createElement(WizardScreen, {
        name: 'readyToSave',
        props: {
          textNodes: [], tokens: TOKENS, onBack() {}, onSave() {},
          onWatchTick: () => { ticks++; },
          watchIntervalMs: 0, // doorplannen-functie uitgeschakeld in de config
        },
      }));
    });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(ticks, 0, 'staat de functie uit, dan hoort er geen lus te draaien');
    await act(async () => { root.unmount(); });
  } finally {
    cleanup();
    dom.window.close();
  }
});

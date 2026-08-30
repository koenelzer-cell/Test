// Bij meerdere cliëntkaarten staan er identieke uursoort-comboboxen onder
// elkaar. Het zoekveld waarin de hulp typt moet bij DIE combobox horen; anders
// belandt de uursoort bij de verkeerde cliënt (de bug die zich uitte als
// "de uursoort van Tamara wordt overschreven").
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

// top,left,breedte,hoogte
const rect = (t, l, w = 400, h = 40) => `${t},${l},${w},${h}`;

function opstelling() {
  const html = `<!doctype html><html><body>
    <div id="combo1" data-test-rect="${rect(100, 0)}">combobox cliënt 1</div>
    <input id="zoek1" data-test-rect="${rect(150, 0, 380, 30)}" placeholder="Zoeken">
    <div id="combo2" data-test-rect="${rect(500, 0)}">combobox cliënt 2</div>
    <input id="zoek2" data-test-rect="${rect(550, 0, 380, 30)}" placeholder="Zoeken">
    <input id="inline" data-test-rect="${rect(100, 10, 380, 30)}" placeholder="Zoeken">
  </body></html>`;
  const boot = bootHelper({ html });
  const d = boot.document;
  return {
    api: boot.api,
    combo1: d.getElementById('combo1'), zoek1: d.getElementById('zoek1'),
    combo2: d.getElementById('combo2'), zoek2: d.getElementById('zoek2'),
    inline: d.getElementById('inline'),
  };
}

test('het zoekveld onder een combobox hoort bij die combobox', () => {
  const { api, combo1, zoek1 } = opstelling();
  assert.equal(api.inputBelongsToTrigger(zoek1, combo1.getBoundingClientRect(), combo1), true);
});

test('het zoekveld van een ANDERE cliënt hoort er niet bij', () => {
  const { api, combo2, zoek1 } = opstelling();
  assert.equal(api.inputBelongsToTrigger(zoek1, combo2.getBoundingClientRect(), combo2), false,
    'zoekveld van cliënt 1 werd aan cliënt 2 gekoppeld — zo belandt de uursoort bij de verkeerde cliënt');
});

test('een inline zoekveld op dezelfde hoogte hoort er wél bij (labels)', () => {
  // Het labelveld is een chip-invoer: het zoekveld ligt NAAST/IN het veld,
  // niet eronder. Een controle die alleen "eronder" accepteert brak labels.
  const { api, combo1, inline } = opstelling();
  assert.equal(api.inputBelongsToTrigger(inline, combo1.getBoundingClientRect(), combo1), true,
    'inline zoekveld werd geweigerd — dan kan de hulp geen labels meer toevoegen');
});

test('een zoekveld binnen de combobox zelf hoort er altijd bij', () => {
  const { api, combo1 } = opstelling();
  const inp = combo1.ownerDocument.createElement('input');
  combo1.appendChild(inp);
  assert.equal(api.inputBelongsToTrigger(inp, combo1.getBoundingClientRect(), combo1), true);
});

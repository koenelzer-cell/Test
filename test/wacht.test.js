// wachtTot: wachten op een signaal (wijziging in de pagina) in plaats van met
// vaste timers, met een vangnet-interval en een maximale wachttijd.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

test('wachtTot: meteen klaar als de voorwaarde al waar is', async () => {
  const { api } = bootHelper();
  assert.equal(await api.wachtTot(() => 'klaar'), 'klaar');
});

test('wachtTot: klaar zodra de pagina verandert, niet pas bij het vangnet-interval', async () => {
  const { api, window } = bootHelper();
  const start = Date.now();
  setTimeout(() => { const d = window.document.createElement('div'); d.id = 'nieuw'; window.document.body.appendChild(d); }, 30);
  const el = await api.wachtTot(() => window.document.getElementById('nieuw'), { max: 3000, elke: 2000 });
  assert.ok(el, 'gevonden');
  assert.ok(Date.now() - start < 1000, 'op het signaal, niet na 2 s (' + (Date.now() - start) + ' ms)');
});

test('wachtTot: null na de maximale wachttijd; een fout in de voorwaarde telt als nog niet', async () => {
  const { api } = bootHelper();
  let keer = 0;
  const r = await api.wachtTot(() => { keer++; throw new Error('nog niet'); }, { max: 120, elke: 20 });
  assert.equal(r, null);
  assert.ok(keer >= 2, 'meer dan eens geprobeerd');
});

test('pollFor (callback-vorm) volgt wachtTot', async () => {
  const { api, window } = bootHelper();
  setTimeout(() => { window.__klaar = true; }, 40);
  const r = await new Promise((klaar) => api.pollFor(() => window.__klaar && 'ja', klaar, { timeout: 1000, interval: 20 }));
  assert.equal(r, 'ja');
});

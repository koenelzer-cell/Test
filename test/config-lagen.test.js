// Configuratie: bij elke wijziging opnieuw opbouwen vanaf de standaard
// (standaard < config.json < testconfig in het testpakket < beleid), zodat
// wat een beheerder uit het beleid haalt meteen weer weg is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const kaal = (x) => JSON.parse(JSON.stringify(x));

test('bouwConfig is puur: lagen op volgorde, en de standaard blijft ongemoeid', async () => {
  const { api } = bootHelper();
  await tick();
  const c = api.bouwConfig([{ features: { planner: false }, texts: { a: { text: 'A' } } }, { features: { production: false } }]);
  assert.equal(c.features.planner, false);
  assert.equal(c.features.production, false);
  assert.equal(c.features.weekRatio, true, 'wat geen laag noemt, uit de standaard');
  assert.equal(c.texts.a.text, 'A');
  assert.equal(api.getDefaultConfig().features.planner, true, 'standaard niet aangepast');
  assert.equal(api.bouwConfig([]).features.planner, true);
});

test('beleid gewijzigd: opnieuw opgebouwd, een weggehaalde sleutel of enabled: false blijft niet hangen', async () => {
  const managed = {};
  const bundled = { helperConfig: { features: { production: false }, support: { topdeskUrl: 'https://bundel.example/' } } };
  const { api, storageChange } = bootHelper({ managed, bundled });
  await tick(80);
  const cfg = () => kaal(api.getAppConfig());
  assert.equal(cfg().features.production, false, 'config.json telt');
  // Het beleid zet iets aan en de hulp uit.
  Object.assign(managed, { enabled: false, helperConfig: { features: { planner: false, production: true }, texts: { extra: { text: 'Uit beleid' } } } });
  storageChange({ helperConfig: { newValue: managed.helperConfig } }, 'managed');
  await tick(80);
  assert.equal(cfg().features.planner, false);
  assert.equal(cfg().features.production, true, 'beleid wint van config.json');
  assert.equal(cfg().texts.extra.text, 'Uit beleid');
  assert.equal(api.getRuntimeConfig().enabled, false);
  // De beheerder haalt het weer weg.
  for (const k of Object.keys(managed)) delete managed[k];
  storageChange({ helperConfig: { oldValue: {} } }, 'managed');
  await tick(80);
  assert.equal(cfg().features.planner, true, 'terug naar de standaard');
  assert.equal(cfg().features.production, false, 'terug naar config.json');
  assert.equal(cfg().texts.extra, undefined, 'weggehaalde tekst is weg');
  assert.equal(api.getRuntimeConfig().enabled, true, 'de hulp staat weer aan');
  assert.equal(cfg().support.topdeskUrl, 'https://bundel.example/');
});

test('testconfig: in het gewone pakket genegeerd; in het testpakket wel, maar nooit routes-server, ONS-adressen of domeinen', async () => {
  const lokaal = { onsHelperConfig: { enabled: false, helperConfig: { features: { planner: false }, routesProxy: { url: 'https://kwaad.example', token: 'x' }, apiEndpoints: { weekEvents: '/kwaad' }, activation: { domains: ['kwaad.example'] } } } };
  const gewoon = bootHelper({ lokaal });
  await tick(80);
  assert.equal(gewoon.api.getAppConfig().features.planner, true, 'gewoon pakket: testconfig telt niet');
  assert.equal(gewoon.api.getRuntimeConfig().enabled, true);
  assert.equal(gewoon.gelezen.some((k) => JSON.stringify(k).includes('onsHelperConfig')), false, 'en wordt niet eens gelezen');
  const tp = bootHelper({ lokaal, naam: 'ONS Agendahulp (test)' });
  await tick(80);
  const c = kaal(tp.api.getAppConfig());
  assert.equal(c.features.planner, false, 'testpakket: testconfig telt');
  assert.equal(tp.api.getRuntimeConfig().enabled, false);
  assert.notEqual((c.routesProxy || {}).url, 'https://kwaad.example', 'geen routes-server uit de testconfig');
  assert.notEqual((c.apiEndpoints || {}).weekEvents, '/kwaad', 'geen ONS-adressen uit de testconfig');
  assert.deepEqual((c.activation || {}).domains, [], 'geen domeinen uit de testconfig');
});

test('activation.domains: precies de host of een subdomein, nooit een stukje', async () => {
  const { api } = bootHelper();
  await tick();
  assert.equal(api.domeinPast('impegno.onsagenda.nl', 'impegno.onsagenda.nl'), true);
  assert.equal(api.domeinPast('impegno.onsagenda.nl', 'onsagenda.nl'), true, 'subdomein');
  assert.equal(api.domeinPast('impegno.onsagenda.nl', '*.onsagenda.nl'), true);
  assert.equal(api.domeinPast('impegno.onsagenda.nl', 'onsagenda'), false, 'een stukje telt niet');
  assert.equal(api.domeinPast('onsagenda.nl.ander.nl', 'onsagenda.nl'), false);
  assert.equal(api.domeinPast('xonsagenda.nl', 'onsagenda.nl'), false);
  assert.equal(api.domeinPast('impegno.onsagenda.nl', ''), false);
});

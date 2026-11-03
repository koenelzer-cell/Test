// Herhaling op 'Niet' (Afspraak doorplannen uit): via ONS' eigen Vue-koppeling
// van het keuzeveld, zonder de keuzelijst te openen; klikken alleen als
// terugval.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const KEUZES = [{ value: 'none', label: 'Niet' }, { value: 'daily', label: 'Dagelijks' }, { value: 'weekly', label: 'Wekelijks' }];
const TOON = { none: 'Niet', single: 'Niet', daily: 'Dagelijks', weekly: 'Wekelijks' };

// Een nagebootst afspraakformulier met het herhalingveld (uc-form-field
// data-qa="recurrence-type" met een uc-select erin), zoals de andere velden.
// opties: neemtOver (het veld neemt de keuze over), keuzes en waar ze staan
// (props van het veld, optie-vnodes, of props van de uc-select erin),
// combobox (het veld toont de keuze, zoals in ONS), model (EventDetails met
// event.recurrence en onChange), koppeling (het veld heeft onUpdate:modelValue).
async function formulier({ neemtOver = true, keuzesIn = 'props', keuzes = KEUZES, combobox = false, toont = TOON, model = false, koppeling = true, start = 'daily' } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><uc-form-field data-qa="recurrence-type"><uc-select>'
    + (combobox ? '<div role="combobox"></div>' : '') + '</uc-select></uc-form-field></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const veld = w.document.querySelector('uc-form-field'), sel = w.document.querySelector('uc-select');
  const toon = (x) => { const c = w.document.querySelector('[role="combobox"]'); if (c) { c.setAttribute('aria-description', toont[x] || String(x)); c.textContent = toont[x] || String(x); } };
  const gezet = [];
  const binnen = { el: sel, props: {} };
  const v = { el: veld, props: { 'model-value': start }, children: [binnen] };
  if (koppeling) v.props['onUpdate:modelValue'] = (x, t) => { gezet.push([x, t]); if (neemtOver) { v.props['model-value'] = x; toon(x); } };
  if (keuzesIn === 'props') v.props.options = keuzes;
  else if (keuzesIn === 'binnen') binnen.props.items = keuzes;
  else if (keuzesIn === 'json') v.props.options = JSON.stringify(keuzes);
  else if (keuzesIn === 'paren') v.props.options = keuzes.map((k) => [k.label, k.value]);
  else if (keuzesIn === 'kaart') v.props.options = Object.fromEntries(keuzes.map((k) => [k.value, k.label]));
  else if (keuzesIn === 'vnodes') binnen.children = keuzes.map((k) => ({ el: null, props: { value: k.value }, children: k.label }));
  toon(start);
  const modelZet = [];
  const event = { clients: [{ id: 11142, name: 'Tamara Test' }], recurrence: { recurring: true, description: 'wekelijks', recurrence_type: start, cycle_interval: 1, valid_from: '2026-11-03' } };
  const details = { type: { name: 'EventDetails' }, props: { event }, setupState: { onChange() {}, onRecurrenceChange() {} },
    proxy: { onChange: (x, veldNaam) => { modelZet.push([veldNaam, x && x.recurrence_type]); event[veldNaam] = x; if (veldNaam === 'recurrence') toon(x.recurrence_type); } } };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  details.subTree = { children: [{ el: houder, props: {}, children: [v] }] };
  houder._vnode = model ? { component: details } : { component: { subTree: { children: [{ el: houder, props: {}, children: [v] }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = () => new Promise((klaar) => {
    const id = 'h' + Math.random();
    const luister = (ev) => { const d = ev.data; if (d && d.type === 'herhalingGezet' && d.id === id) { w.removeEventListener('message', luister); klaar(d); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetHerhalingNiet', id }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 1500);
  });
  const inBeeld = () => { const c = w.document.querySelector('[role="combobox"]'); return c ? c.textContent : null; };
  return { gezet: () => JSON.parse(JSON.stringify(gezet)), modelZet: () => JSON.parse(JSON.stringify(modelZet)), vraag, inBeeld, v };
}

test('main-world: herhaling op Niet via onUpdate:modelValue, met de waarde uit de eigen keuzes', async () => {
  const f = await formulier();
  const r = await f.vraag();
  assert.equal(r.ok, true);
  assert.deepEqual(f.gezet(), [['none', 'Niet']], 'de waarde van Niet, geen vaste waarde');
});

test('main-world: de keuzes in andere vormen: optie-vnodes, in de uc-select erin, als JSON, als paren of als object', async () => {
  for (const [keuzesIn, verwacht] of [['vnodes', 'none'], ['binnen', 'none'], ['json', 'none'], ['paren', 'none'], ['kaart', 'none']]) {
    const f = await formulier({ keuzesIn, combobox: true });
    const r = await f.vraag();
    assert.equal(r.ok, true, keuzesIn);
    assert.equal(f.gezet()[0][0], verwacht, keuzesIn);
    assert.equal(f.inBeeld(), 'Niet', keuzesIn);
  }
});

test('main-world: nagekeken op wat het veld toont; neemt het veld het niet over, dan teruggezet en ok false met de opbouw', async () => {
  // Het model zegt 'none', maar het veld toont nog Wekelijks: niet gelukt.
  const f = await formulier({ combobox: true, toont: { ...TOON, none: 'Wekelijks' } });
  const r = await f.vraag();
  assert.equal(r.ok, false);
  assert.match(r.reden, /nam de waarde niet over/);
  assert.deepEqual(f.gezet(), [['none', 'Niet'], ['daily', 'Dagelijks']], 'eerst Niet, daarna terug naar wat er stond');
  assert.ok(r.opbouw && Array.isArray(r.opbouw.geprobeerd) && r.opbouw.geprobeerd.length === 1);
  assert.match(r.opbouw.elementen[0], /^uc-form-field recurrence-type/);
  // Zonder combobox: op het model.
  const weigert = await formulier({ neemtOver: false });
  const r2 = await weigert.vraag();
  assert.equal(r2.ok, false);
  assert.match(r2.reden, /nam de waarde niet over/);
});

test('main-world: geen keuze Niet te vinden en een bekende herhaling: single, alleen goed als het veld daarna Niet toont', async () => {
  const goed = await formulier({ keuzes: KEUZES.slice(1), combobox: true });
  const r = await goed.vraag();
  assert.equal(r.ok, true);
  assert.equal(r.via, 'single op het veld');
  assert.deepEqual(goed.gezet(), [['single', 'Niet']]);
  // Toont het veld niets, dan geen gok: terug naar wat er stond.
  const blind = await formulier({ keuzes: KEUZES.slice(1) });
  const r2 = await blind.vraag();
  assert.equal(r2.ok, false);
  assert.deepEqual(blind.gezet(), [['single', 'Niet'], ['daily', '']]);
  assert.equal(blind.v.props['model-value'], 'daily');
  // Geen bekende waarde en geen Niet: niets gezet.
  const onbekend = await formulier({ keuzes: KEUZES.slice(1), start: 'iets anders' });
  const r3 = await onbekend.vraag();
  assert.equal(r3.ok, false);
  assert.match(r3.reden, /keuze Niet niet gevonden/);
  assert.deepEqual(onbekend.gezet(), []);
});

test('main-world: zonder koppeling op het veld via het afspraakmodel (EventDetails.onChange met recurrence); diagnose zonder cliëntnaam', async () => {
  const f = await formulier({ koppeling: false, keuzes: KEUZES.slice(1), combobox: true, model: true, start: 'weekly' });
  const r = await f.vraag();
  assert.equal(r.ok, true);
  assert.equal(r.via, 'model recurrence');
  assert.deepEqual(f.modelZet(), [['recurrence', 'single']]);
  assert.equal(f.inBeeld(), 'Niet');
  // Toont het veld daarna geen Niet: terugzetten, en de opbouw met het herhalingdeel van het model.
  const g = await formulier({ koppeling: false, keuzes: KEUZES.slice(1), combobox: true, model: true, start: 'weekly', toont: { ...TOON, single: 'Wekelijks' } });
  const r2 = await g.vraag();
  assert.equal(r2.ok, false);
  assert.deepEqual(g.modelZet(), [['recurrence', 'single'], ['recurrence', 'weekly']]);
  assert.equal(r2.opbouw.model.recurrence.recurrence_type, 'weekly');
  assert.ok(r2.opbouw.methoden.includes('onRecurrenceChange'));
  assert.doesNotMatch(JSON.stringify(r2.opbouw), /Tamara|11142/, 'geen cliëntgegevens');
});

test('main-world: staat er al Niet, dan niets doen', async () => {
  const f = await formulier({ combobox: true, start: 'none' });
  const r = await f.vraag();
  assert.equal(r.ok, true);
  assert.deepEqual(f.gezet(), []);
});

// De opslaanpagina met het uitgeklapte herhalingveld op 'Dagelijks'.
const PAGINA = '<!doctype html><html><body><div class="modal"><button aria-expanded="true"><span>Herhaling</span><span>Dagelijks</span></button>'
  + '<uc-form-field data-qa="recurrence-type"><div role="combobox" aria-description="Dagelijks">Dagelijks</div></uc-form-field>'
  + '<ul role="listbox" id="lijst" hidden><li role="option">Niet</li><li role="option">Dagelijks</li></ul></div></body></html>';

function metMainWorld(window, antwoord) {
  const gevraagd = [];
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main' || d.type !== 'zetHerhalingNiet') return;
    gevraagd.push(d.type);
    if (antwoord == null) return;
    if (antwoord) { const c = window.document.querySelector('[role="combobox"]'); c.setAttribute('aria-description', 'Niet'); c.textContent = 'Niet'; }
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'herhalingGezet', id: d.id, ok: antwoord }, origin: window.location.origin, source: window }));
  });
  return gevraagd;
}

test('doorplannen uit: herhaling op Niet via het formulier, zonder de keuzelijst te openen', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  const gevraagd = metMainWorld(window, true);
  let geopend = 0;
  window.document.querySelector('[role="combobox"]').addEventListener('click', () => { geopend++; });
  assert.equal(api.recurrenceIsSet(), true);
  const ok = await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  assert.equal(ok, true);
  assert.deepEqual(gevraagd, ['zetHerhalingNiet']);
  assert.equal(geopend, 0, 'de keuzelijst bleef dicht');
  assert.equal(api.recurrenceIsSet(), false);
});

test('doorplannen uit: lukt het formulier niet, dan één keer via de keuzelijst', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  const gevraagd = metMainWorld(window, false);
  const doc = window.document;
  let geopend = 0, gekozen = '';
  doc.querySelector('[role="combobox"]').addEventListener('click', () => { geopend++; doc.getElementById('lijst').hidden = false; });
  doc.querySelectorAll('[role="option"]').forEach((o) => o.addEventListener('click', () => { gekozen = o.textContent; }));
  const ok = await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  assert.deepEqual(gevraagd, ['zetHerhalingNiet'], 'eerst gevraagd');
  assert.equal(geopend, 1, 'daarna de keuzelijst open');
  assert.equal(gekozen, 'Niet');
  assert.equal(ok, true);
});

test('doorplannen uit: zegt het formulier ok maar toont het veld nog een herhaling, dan toch via de keuzelijst', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  // De main-world zegt ok, maar het veld blijft Dagelijks tonen.
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main' || d.type !== 'zetHerhalingNiet') return;
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'herhalingGezet', id: d.id, ok: true, via: 'keuze uit het veld' }, origin: window.location.origin, source: window }));
  });
  const doc = window.document;
  let geopend = 0;
  doc.querySelector('[role="combobox"]').addEventListener('click', () => { geopend++; doc.getElementById('lijst').hidden = false; });
  doc.querySelectorAll('[role="option"]').forEach((o) => o.addEventListener('click', () => { const c = doc.querySelector('[role="combobox"]'); c.setAttribute('aria-description', o.textContent); c.textContent = o.textContent; }));
  const ok = await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  assert.equal(geopend, 1, 'nagekeken en daarna via de keuzelijst');
  assert.equal(ok, true);
  assert.equal(api.recurrenceIsSet(), false);
});

test('Debug, Formulier: de uitkomsten van de route via het formulier, met de opbouw bij de herhaling; nooit wat het formulier bevat', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main') return;
    const terug = (type, extra) => window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type, id: d.id, ...extra }, origin: window.location.origin, source: window }));
    if (d.type === 'zetHerhalingNiet') terug('herhalingGezet', { ok: false, reden: 'keuze Niet niet gevonden', opbouw: { geprobeerd: [], elementen: ['uc-form-field recurrence-type'] } });
    if (d.type === 'leesFormulier') terug('formulierGelezen', { ok: true, clients: [{ id: 11142, voornaam: 'Tamara' }], uursoorten: {}, labelIds: [47] });
  });
  await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  const gelezen = await api.leesFormulier();
  assert.equal(gelezen.clients[0].voornaam, 'Tamara', 'de aanroeper krijgt het antwoord gewoon');
  const log = JSON.parse(JSON.stringify(api.formulierLog()));
  assert.deepEqual(log.map((x) => [x.actie, x.ok, x.reden || '']), [['zetHerhalingNiet', false, 'keuze Niet niet gevonden'], ['leesFormulier', true, '']]);
  assert.deepEqual(JSON.parse(log[0].opbouw).elementen, ['uc-form-field recurrence-type']);
  assert.doesNotMatch(JSON.stringify(log), /Tamara|11142/, 'niets uit het formulier bewaard');
});

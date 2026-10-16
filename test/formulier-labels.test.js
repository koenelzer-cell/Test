// Labels van het open afspraakformulier zetten via ONS' eigen Vue-koppeling
// (main-world, taak 6) in plaats van de dropdown te openen.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const BESCHIKBAAR = [{ id: 46, name: 'JG Huisbezoek' }, { id: 14, name: 'JG Face to face kantoor' }, { id: 29, name: 'JG Verslaglegging' }, { id: 31, name: 'JG Face to face' }];

// Een nagebootst ONS-formulier: Vue-app met het labelveld als vnode, zoals
// het in de echte pagina zat (model-value, available-labels, onUpdate:modelValue).
async function formulier({ neemtOver = true, beginWaarde = [] } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><uc-modal><uc-card><uc-form-field><uc-combo-box data-qa="label_select"></uc-combo-box></uc-form-field></uc-card></uc-modal></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const veld = w.document.querySelector('[data-qa="label_select"]');
  const gezet = [];
  const kaal = () => JSON.parse(JSON.stringify(gezet));
  const combo = { el: veld, props: { size: 'small', 'model-value': beginWaarde, 'available-labels': BESCHIKBAAR,
    'onUpdate:modelValue': (t) => { gezet.push(t); if (neemtOver) combo.props['model-value'] = t; } } };
  // EventDetails > (div) > combobox; de app hangt aan #content.
  const details = { type: { __name: 'EventDetails' }, subTree: { el: null, children: [{ el: null, children: [combo] }] } };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [{ component: details }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = (labels, extra) => new Promise((klaar) => {
    const id = 'test-' + Math.random();
    const luister = (ev) => { const d = ev.data; if (d && d.type === 'labelsGezet' && d.id === id) { w.removeEventListener('message', luister); klaar(d); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetLabels', id, labels }, origin: (extra && extra.origin) || w.location.origin, source: w }));
    setTimeout(() => klaar(null), 400);
  });
  return { w, gezet, kaal, combo, vraag };
}

test('main-world zet het label via onUpdate:modelValue, zonder dropdown', async () => {
  const { kaal, vraag } = await formulier();
  const r = await vraag(['JG Huisbezoek']);
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(), [[46]], 'de id, zoals ONS hem als label_ids krijgt');
});

test('main-world: meerdere labels, hoofdletters en accenten maken niet uit, de set vervangt wat er stond', async () => {
  const { kaal, vraag } = await formulier({ beginWaarde: [29] });
  const r = await vraag(['jg huisbezoek', 'JG VERSLAGLEGGING']);
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(), [[46, 29]]);
});

test('main-world: bevat het veld labelobjecten, dan gaan er objecten in', async () => {
  const { kaal, vraag } = await formulier({ beginWaarde: [{ id: 29, name: 'JG Verslaglegging' }] });
  assert.equal((await vraag(['JG Huisbezoek'])).ok, true);
  assert.deepEqual(kaal(), [[{ id: 46, name: 'JG Huisbezoek' }]]);
});

test('main-world: onbekend of dubbelzinnig label, of het veld neemt het niet over: ok false (dan klikt de hulp)', async () => {
  const a = await formulier();
  const onbekend = await a.vraag(['Bestaat niet']);
  assert.equal(onbekend.ok, false);
  assert.equal(a.gezet.length, 0, 'niets aangeroepen');
  // 'JG Face to face' is exact een label; 'Face to' zit in twee labels.
  assert.equal((await a.vraag(['Face to'])).ok, false, 'dubbelzinnig');
  assert.equal((await a.vraag(['JG Face to face'])).ok, true, 'exact gaat voor');
  assert.deepEqual(a.kaal().at(-1), [31]);
  const b = await formulier({ neemtOver: false });
  const r = await b.vraag(['JG Huisbezoek']);
  assert.equal(r.ok, false);
  assert.match(r.reden, /nam de waarde niet over/);
});

test('main-world: alleen opdrachten van de eigen origin', async () => {
  const { gezet, vraag } = await formulier();
  assert.equal(await vraag(['JG Huisbezoek'], { origin: 'https://kwaadaardig.example' }), null, 'geen antwoord');
  assert.equal(gezet.length, 0);
});

test('main-world: geen labelveld of geen Vue-app: ok false', async () => {
  const { w, vraag } = await formulier();
  w.document.querySelector('[data-qa="label_select"]').remove();
  const r = await vraag(['JG Huisbezoek']);
  assert.equal(r.ok, false);
  assert.match(r.reden, /geen labelveld/);
});

test('content-script vraagt het aan de main-world en wacht op het antwoord met hetzelfde id', async () => {
  const { api, window } = bootHelper();
  const verzonden = [];
  let antwoorden = true;
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!antwoorden || !d || d.dir !== 'to-main' || d.type !== 'zetLabels') return;
    verzonden.push(d);
    // Een antwoord voor een ander id telt niet; daarna het echte.
    const terug = (id, ok) => window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'labelsGezet', id, ok }, origin: window.location.origin, source: window }));
    terug('ander', false);
    terug(d.id, true);
  });
  // jsdom levert postMessage zonder origin af: daarom zelf doorsturen.
  const post = window.postMessage.bind(window);
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  assert.equal(await api.zetLabelsViaFormulier(['JG Huisbezoek']), true);
  assert.deepEqual(verzonden[0].labels, ['JG Huisbezoek']);
  window.postMessage = post;
  antwoorden = false;
  // Geen main-world die antwoordt: na de wachttijd false (de hulp klikt dan).
  assert.equal(await api.zetLabelsViaFormulier(['JG Huisbezoek'], 50), false);
  assert.equal(await api.zetLabelsViaFormulier([]), false, 'niets gevraagd');
});

// Twee cliënten, elk een eigen uursoortveld (zoals in ONS: uc-select met
// data-qa="hour_type_select" en onUpdate:modelValue(id, omschrijving)).
async function formulierMetUursoort({ neemtOver = true } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><ul data-qa="selected_clients">'
    + '<li><span class="invitee-name">A</span><uc-select data-qa="hour_type_select"></uc-select></li>'
    + '<li><span class="invitee-name">B</span><uc-select data-qa="hour_type_select"></uc-select></li></ul></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const [veldA, veldB] = w.document.querySelectorAll('[data-qa="hour_type_select"]');
  const gezet = [];
  const maak = (el, wie) => {
    const v = { el, props: { 'model-value': null, 'client-ids': [wie === 'A' ? 1 : 2], size: 'small',
      'onUpdate:modelValue': function (e, t) { gezet.push([wie, e, t]); if (neemtOver) v.props['model-value'] = e; } } };
    return v;
  };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [{ component: { subTree: { children: [maak(veldA, 'A'), maak(veldB, 'B')] } } }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = (data) => new Promise((klaar) => {
    const id = 'test-' + Math.random();
    const luister = (ev) => { const d = ev.data; if (d && d.type === 'uursoortGezet' && d.id === id) { w.removeEventListener('message', luister); klaar(d); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetUursoort', id, ...data }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 400);
  });
  return { w, veldA, veldB, kaal: () => JSON.parse(JSON.stringify(gezet)), vraag };
}

test('main-world zet de uursoort van precies de gemarkeerde cliënt (id en omschrijving)', async () => {
  const { veldB, kaal, vraag } = await formulierMetUursoort();
  veldB.setAttribute('data-onsah-doel', 'u1');
  const r = await vraag({ doel: 'u1', hourTypeId: 1135, beschrijving: 'Behandeling (GGZ 18+)' });
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(), [['B', 1135, 'Behandeling (GGZ 18+)']], 'alleen cliënt B');
});

test('main-world: het kenmerk mag ook op een element binnen of rond het veld staan', async () => {
  const { w, veldA, kaal, vraag } = await formulierMetUursoort();
  veldA.parentElement.setAttribute('data-onsah-doel', 'rond');
  assert.equal((await vraag({ doel: 'rond', hourTypeId: 5, beschrijving: 'JW BG H10' })).ok, true);
  assert.deepEqual(kaal(), [['A', 5, 'JW BG H10']]);
  const binnen = w.document.createElement('span');
  veldA.appendChild(binnen);
  binnen.setAttribute('data-onsah-doel', 'binnen');
  assert.equal((await vraag({ doel: 'binnen', hourTypeId: 6, beschrijving: 'x' })).ok, true);
});

test('main-world: uursoort niet overgenomen of ongeldig verzoek: ok false, niets verkeerd gezet', async () => {
  const a = await formulierMetUursoort({ neemtOver: false });
  a.veldA.setAttribute('data-onsah-doel', 'u2');
  const r = await a.vraag({ doel: 'u2', hourTypeId: 5, beschrijving: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.reden, /nam de waarde niet over/);
  const b = await formulierMetUursoort();
  assert.equal((await b.vraag({ doel: 'bestaat-niet', hourTypeId: 5 })).ok, false);
  assert.equal((await b.vraag({ doel: '"] , *', hourTypeId: 5 })).ok, false, 'geen eigen selector');
  b.veldA.setAttribute('data-onsah-doel', 'u3');
  assert.equal((await b.vraag({ doel: 'u3', hourTypeId: 0 })).ok, false, 'geen id');
  assert.equal(b.kaal().length, 0);
});

test('content-script markeert het uursoortveld even en stuurt id en omschrijving mee', async () => {
  const { api, window } = bootHelper();
  const veld = window.document.createElement('uc-select');
  window.document.body.appendChild(veld);
  const verzonden = [];
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main' || d.type !== 'zetUursoort') return;
    verzonden.push({ ...d, kenmerk: window.document.querySelector('[data-onsah-doel="' + d.doel + '"]') === veld });
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'uursoortGezet', id: d.id, ok: true }, origin: window.location.origin, source: window }));
  });
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  assert.equal(await api.zetUursoortViaFormulier(veld, 1135, 'Behandeling (GGZ 18+)'), true);
  assert.equal(verzonden[0].kenmerk, true, 'het veld had het kenmerk tijdens het verzoek');
  assert.deepEqual([verzonden[0].hourTypeId, verzonden[0].beschrijving], [1135, 'Behandeling (GGZ 18+)']);
  assert.equal(veld.hasAttribute('data-onsah-doel'), false, 'daarna weer weg');
  assert.equal(await api.zetUursoortViaFormulier(veld, 0, 'x'), false, 'zonder id niets');
});

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

test('main-world: ook het uursoortveld op afspraakniveau (niet cliëntgebonden, aria-label Uursoort)', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><section><uc-select aria-label="Uursoort"></uc-select></section></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const veld = w.document.querySelector('uc-select');
  const gezet = [];
  const v = { el: veld, props: { 'model-value': null, 'onUpdate:modelValue': (e) => { gezet.push(e); v.props['model-value'] = e; } } };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [v] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  veld.setAttribute('data-onsah-doel', 'nc');
  const r = await new Promise((klaar) => {
    w.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'uursoortGezet') klaar(ev.data); });
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetUursoort', id: 'x', doel: 'nc', hourTypeId: 77, beschrijving: 'Overleg *' }, origin: w.location.origin, source: w }));
  });
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(gezet)), [77]);
});

test('niet-cliëntgebonden: het id bij de naam uit de uursoorten van de medewerker (met of zonder sterretje)', async () => {
  const { api, window } = bootHelper({ url: 'https://impegno.onsagenda.nl/invitees/42479/calendar/day?date=2026-10-16' });
  const urls = [];
  window.fetch = (url) => {
    urls.push(url);
    const json = { basic_list: [
      ['Onlangs gebruikt', [['Overleg *', 77]]],
      ['Toegestaan', [['Scholing *', 78], ['Overleg *', 77]]],
      ['Niet toegestaan', [['Verboden *', 99]]],
    ] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
  };
  assert.deepEqual(JSON.parse(JSON.stringify(await api.nietClientUursoortMetId('Overleg *'))), { id: 77, name: 'Overleg *', recent: true });
  assert.equal((await api.nietClientUursoortMetId('scholing')).id, 78, 'zonder sterretje en hoofdletters');
  assert.equal(await api.nietClientUursoortMetId('Verboden *'), null, 'niet toegestaan telt niet');
  assert.equal(await api.nietClientUursoortMetId('Bestaat niet'), null);
  assert.ok(urls.every((u) => /product_list\?employee_ids%5B%5D=\d+$/.test(u)), 'de lijst zonder cliënt');
  assert.equal(urls.length, 1, 'één keer opgehaald, daarna uit het geheugen');
});

test('main-world: uursoort op cliënt-id (planhulp), zonder kenmerk in de pagina', async () => {
  const { kaal, vraag } = await formulierMetUursoort();
  assert.equal((await vraag({ clientId: '2', hourTypeId: 5, beschrijving: 'JW BG H10' })).ok, true);
  assert.deepEqual(kaal(), [['B', 5, 'JW BG H10']], 'het veld met client-ids [2]');
  assert.equal((await vraag({ clientId: '9', hourTypeId: 5 })).ok, false, 'onbekende cliënt');
  assert.equal((await vraag({ clientId: '2 or 1', hourTypeId: 5 })).ok, false, 'alleen cijfers');
  assert.equal(kaal().length, 1);
});

test('main-world: wissen van uursoort en labels via het formulier', async () => {
  const u = await formulierMetUursoort();
  u.veldA.setAttribute('data-onsah-doel', 'u9');
  assert.equal((await u.vraag({ doel: 'u9', hourTypeId: 5, beschrijving: 'x' })).ok, true);
  assert.equal((await u.vraag({ doel: 'u9', wis: true })).ok, true);
  assert.deepEqual(u.kaal().at(-1), ['A', null, ''], 'leeg gemaakt');
  const l = await formulier({ beginWaarde: [46, 29] });
  const leeg = await new Promise((klaar) => {
    l.w.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'labelsGezet' && ev.data.id === 'wis') klaar(ev.data); });
    l.w.dispatchEvent(new l.w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetLabels', id: 'wis', labels: [], wis: true }, origin: l.w.location.origin, source: l.w }));
  });
  assert.equal(leeg.ok, true);
  assert.deepEqual(l.kaal(), [[]]);
  assert.equal((await l.vraag([])).ok, false, 'leeg zonder wis: niets');
});

test('planhulp zet de uursoorten klaar voor het formulier (per cliënt en voor eigen formulieren)', () => {
  const { api, window } = bootHelper();
  window.HTMLAnchorElement.prototype.click = function () {};
  api.openNewEvent({ date: '2026-10-20', time: '10:00', minutes: 60, clientIds: ['222'], multi: true,
    uursoorten: [{ clientId: '222', hourTypeId: 5, name: 'JW BG H10' }, { clientId: 'x', hourTypeId: 1 }, { clientId: '11', hourTypeId: 0 }],
    eigen: [{ date: '2026-10-21', time: '09:00', minutes: 60, clientIds: ['11142'], uursoorten: [{ clientId: '11142', hourTypeId: 1135, name: 'Behandeling' }] }] });
  const klaar = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment'));
  assert.deepEqual(klaar.uursoorten, [{ clientId: '222', hourTypeId: 5, name: 'JW BG H10' }], 'alleen geldige');
  assert.equal(klaar.uursoortAfspraak, undefined);
  const dup = JSON.parse(window.sessionStorage.getItem('onsHelper.pendingDuplicates'));
  assert.deepEqual(dup.eigen[0].uursoorten, [{ clientId: '11142', hourTypeId: 1135, name: 'Behandeling' }]);
  api.openNewEvent({ date: '2026-10-20', time: '10:00', minutes: 60, uursoortAfspraak: { hourTypeId: 77, name: 'Teamoverleg' } });
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('onsHelper.pendingAppointment')).uursoortAfspraak, { hourTypeId: 77, name: 'Teamoverleg' });
});

test('vanuit de planhulp: het afspraaktype bij het label, de niet-cliëntgebonden optie bij de uursoort', () => {
  const { api } = bootHelper();
  const keuze = api.CONFIG.choices.find((c) => api.choiceLabels(c).length);
  assert.ok(keuze, 'de standaardconfig heeft afspraaktypes met labels');
  const label = api.choiceLabels(keuze)[0];
  assert.equal(api.keuzeVoorLabel(label), keuze);
  assert.equal(api.keuzeVoorLabel(label.toUpperCase()), keuze, 'hoofdletters maken niet uit');
  assert.equal(api.keuzeVoorLabel('Bestaat niet'), null);
  assert.equal(api.keuzeVoorLabel(''), null);
  const opties = [].concat(...api.nonClientCategoriesActive().map((c) => [].concat(c.directOption ? [c.directOption] : [], c.options || [])));
  const opt = opties.find((o) => o && o.uursoort);
  assert.ok(opt, 'de standaardconfig heeft niet-cliëntgebonden opties');
  assert.equal(api.nietClientOptieVoorUursoort(opt.uursoort), opt);
  assert.equal(api.nietClientOptieVoorUursoort(opt.uursoort.replace(/[*#\s]+$/, '')), opt, 'ook zonder sterretje');
  assert.equal(api.nietClientOptieVoorUursoort('Bestaat niet'), null);
});

test('main-world leest het formulier uit het Vue-model: cliënt-id en voornaam, uursoort per cliënt, labels (geen andere gegevens)', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><uc-combo-box data-qa="label_select"></uc-combo-box>'
    + '<uc-select data-qa="hour_type_select"></uc-select><uc-select data-qa="hour_type_select"></uc-select></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const [label, uA, uB] = [w.document.querySelector('[data-qa="label_select"]'), ...w.document.querySelectorAll('[data-qa="hour_type_select"]')];
  const event = { name: 'Face to face', label_ids: [46], client_ids: [11142, 222],
    clients: [{ id: 11142, name: 'Tamara Test', date_of_birth: '2020-01-01', identification_no: '106839', address: { street: 'X' } },
      { id: 222, name: 'Dhr. Bram Proef', date_of_birth: '1990-02-02', identification_no: '1' }] };
  const vel = (el, cids, waarde) => ({ el, props: { 'client-ids': cids, 'model-value': waarde, 'onUpdate:modelValue': () => {} } });
  const details = { type: { name: 'EventDetails' }, props: { event },
    subTree: { children: [{ el: label, props: { 'model-value': [46], 'onUpdate:modelValue': () => {} } }, vel(uA, [11142], 1135), vel(uB, [222], null)] } };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [{ component: details }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const r = await new Promise((klaar) => {
    w.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'formulierGelezen') klaar(ev.data); });
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'leesFormulier', id: 'l1' }, origin: w.location.origin, source: w }));
  });
  const kaal = JSON.parse(JSON.stringify(r));
  assert.equal(kaal.ok, true);
  assert.deepEqual(kaal.clients, [{ id: 11142, voornaam: 'Tamara' }, { id: 222, voornaam: 'Bram' }], 'aanhef overgeslagen');
  assert.deepEqual(kaal.uursoorten, { 11142: 1135, 222: null });
  assert.deepEqual(kaal.labelIds, [46]);
  const tekst = JSON.stringify(kaal);
  for (const geheim of ['Test', 'Proef', '2020-01-01', '106839', 'street']) assert.ok(!tekst.includes(geheim), 'niet in het antwoord: ' + geheim);
});

test('afspraakhulp: voornamen voor de titel eerst uit het formulier, anders uit de kaarten', async () => {
  const { api, window } = bootHelper();
  const post = window.postMessage.bind(window);
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main' || d.type !== 'leesFormulier') return;
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'formulierGelezen', id: d.id, ok: true,
      clients: [{ id: 1, voornaam: 'Tamara' }, { id: 2, voornaam: 'tamara' }, { id: 3, voornaam: 'Bram' }], uursoorten: {}, labelIds: [] }, origin: window.location.origin, source: window }));
  });
  assert.deepEqual(Array.from(await api.clientVoornamenAsync()), ['Tamara', 'Bram'], 'uit het model, zonder dubbele');
  window.postMessage = post;
});

test('main-world zet titel, tijden en reistijd via EventDetails.onChange en kijkt het model na; alleen vaste velden', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><uc-combo-box data-qa="label_select"></uc-combo-box></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const event = { name: '', start_time: '10:00', end_time: '11:00', travel_time_before: 0, label_ids: [], clients: [] };
  const aangeroepen = [];
  let neemtOver = true;
  const details = { type: { name: 'EventDetails' }, props: { event },
    proxy: { onChange: (waarde, veld) => { aangeroepen.push([veld, waarde]); if (neemtOver) event[veld] = waarde; } },
    subTree: { children: [{ el: w.document.querySelector('[data-qa="label_select"]'), props: { 'onUpdate:modelValue': () => {} } }] } };
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [{ component: details }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const zet = (veld, waarde) => new Promise((klaar) => {
    const id = 'v' + Math.random();
    const luister = (ev) => { if (ev.data && ev.data.type === 'veldGezet' && ev.data.id === id) { w.removeEventListener('message', luister); klaar(ev.data); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetVeld', id, veld, waarde }, origin: w.location.origin, source: w }));
  });
  assert.equal((await zet('name', 'Face to face - Tamara')).ok, true);
  assert.equal(event.name, 'Face to face - Tamara');
  assert.equal((await zet('end_time', '11:30')).ok, true);
  assert.equal((await zet('travel_time_before', 15)).ok, true);
  assert.equal(event.travel_time_before, 15);
  assert.match((await zet('end_time', '25:00')).reden, /ongeldige tijd/);
  assert.match((await zet('label_ids', [1])).reden, /onbekend veld/, 'labels gaan via hun eigen veld');
  assert.match((await zet('client_ids', [9])).reden, /onbekend veld/, 'cliënten nooit via deze weg');
  neemtOver = false;
  const r = await zet('name', 'Andere titel');
  assert.equal(r.ok, false);
  assert.match(r.reden, /nam de waarde niet over/);
  assert.deepEqual(JSON.parse(JSON.stringify(aangeroepen.map((a) => a[0]))), ['name', 'end_time', 'travel_time_before', 'name'], 'ongeldige verzoeken roepen ONS niet aan');
});

test('main-world: een label toevoegen laat de bestaande staan', async () => {
  const { w, kaal } = await formulier({ beginWaarde: [29] });
  const r = await new Promise((klaar) => {
    w.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'labelsGezet' && ev.data.id === 't') klaar(ev.data); });
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetLabels', id: 't', labels: ['JG Huisbezoek'], toevoegen: true }, origin: w.location.origin, source: w }));
  });
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(), [[46, 29]], 'het nieuwe label erbij, Verslaglegging blijft');
});

test('eerstViaFormulier: het scherm-pad alleen als het formulier-pad niet lukt', async () => {
  const { api } = bootHelper();
  let scherm = 0;
  const viaScherm = () => { scherm++; return 'scherm'; };
  assert.equal(await api.eerstViaFormulier(() => Promise.resolve(true), viaScherm), true);
  assert.equal(scherm, 0, 'formulier gelukt: scherm niet aangeraakt');
  assert.equal(await api.eerstViaFormulier(() => Promise.resolve(false), viaScherm), 'scherm');
  assert.equal(await api.eerstViaFormulier(() => { throw new Error('kapot'); }, viaScherm), 'scherm', 'ook bij een fout');
  assert.equal(await api.eerstViaFormulier(() => false, () => Promise.resolve(7)), 7, 'scherm-pad mag een belofte geven');
  assert.equal(scherm, 2);
});

// Een afspraakformulier met begin- en eindtijd (uc-time-input met een input
// in de shadow root) en reistijd heen/terug, plus een nagebootste main-world:
// antwoordt `neemtOver`, dan zet hij de waarde in het veld (zoals Vue na
// onChange) zonder input-events; anders ok false.
function tijdenFormulier({ neemtOver = true } = {}) {
  const { api, window } = bootHelper({ html: '<!doctype html><body>'
    + '<uc-time-input aria-label="Begintijd"></uc-time-input><uc-time-input aria-label="Eindtijd"></uc-time-input>'
    + '<div data-test-rect="100,0,100,20">Reistijd heen</div><input id="heen" inputmode="decimal" value="0" data-test-rect="125,0,80,20">'
    + '<div data-test-rect="100,300,100,20">Reistijd terug</div><input id="terug" inputmode="decimal" value="0" data-test-rect="125,300,80,20">'
    + '</body>' });
  const d = window.document;
  const veld = (aria, waarde) => {
    const host = d.querySelector('uc-time-input[aria-label="' + aria + '"]');
    host.attachShadow({ mode: 'open' }).innerHTML = '<input placeholder="uu:mm">';
    const inp = host.shadowRoot.querySelector('input');
    inp.value = waarde;
    return inp;
  };
  const start = veld('Begintijd', '10:00');
  const eind = veld('Eindtijd', '11:00');
  const heen = d.getElementById('heen'), terug = d.getElementById('terug');
  const getypt = [];
  [eind, heen, terug].forEach((el) => el.addEventListener('input', () => getypt.push(el.id || 'eind')));
  const gevraagd = [];
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || m.dir !== 'to-main' || m.type !== 'zetVeld') return;
    gevraagd.push([m.veld, m.waarde]);
    if (neemtOver) ({ end_time: eind, travel_time_before: heen, travel_time_after: terug })[m.veld].value = String(m.waarde);
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'veldGezet', id: m.id, ok: neemtOver }, origin: window.location.origin, source: window }));
  });
  return { api, window, start, eind, heen, terug, getypt, gevraagd };
}

test('eindtijd en reistijd gaan eerst via het afspraakmodel (onChange), zonder typen', async () => {
  const f = tijdenFormulier();
  assert.equal(f.api.setAppointmentEndTimePlusMinutes(45), true, 'meteen: het kan');
  await f.api.wachtTot(() => f.eind.value === '10:45', { max: 1000 });
  assert.equal(f.eind.value, '10:45');
  assert.equal(f.api.setAppointmentTravelTotalMinutes(25), true);
  await f.api.wachtTot(() => f.terug.value === '12', { max: 1000 });
  assert.deepEqual([f.heen.value, f.terug.value], ['13', '12'], 'totaal verdeeld: heen naar boven afgerond');
  assert.deepEqual(JSON.parse(JSON.stringify(f.gevraagd)), [['end_time', '10:45'], ['travel_time_before', 13], ['travel_time_after', 12]]);
  assert.equal(f.api.clearAppointmentTravelTimes(), true);
  await f.api.wachtTot(() => f.heen.value === '0' && f.terug.value === '0', { max: 1000 });
  assert.deepEqual(f.getypt, [], 'niets getypt');
  // De eindtijd-guard leest de tijd van de hulp niet als eigen wijziging.
  assert.equal(f.api.appointmentEndGuardState().helperEndText, '10:45');
  assert.equal(f.api.appointmentEndGuardState().userOwned, false);
});

test('eindtijd en reistijd: neemt het model het niet over, dan één keer typen', async () => {
  const f = tijdenFormulier({ neemtOver: false });
  assert.equal(await f.api.zetEindtijdAsync('11:15'), true);
  assert.equal(f.eind.value, '11:15');
  assert.ok(f.getypt.includes('eind'), 'getypt');
  await f.api.zetReistijdenAsync(10, 5);
  assert.deepEqual([f.heen.value, f.terug.value], ['10', '5']);
  assert.ok(f.getypt.includes('heen') && f.getypt.includes('terug'));
});

test('eindtijd-guard: terwijl de hulp de eindtijd via het model zet, telt de oude tijd niet als eigen wijziging', async () => {
  const f = tijdenFormulier();
  f.api.resetAppointmentEndGuard();
  // Het model antwoordt pas later: intussen staat er nog 11:00.
  const traag = f.window.postMessage;
  f.window.postMessage = (data) => setTimeout(() => traag(data), 150);
  f.api.setAppointmentEndTimePlusMinutes(30);
  assert.equal(f.api.enforceAppointmentEndTime(30), true);
  assert.equal(f.api.appointmentEndGuardState().userOwned, false, 'niet als eigen wijziging gelezen');
  await f.api.wachtTot(() => f.eind.value === '10:30', { max: 1500 });
  assert.equal(f.eind.value, '10:30');
  // Daarna zelf een andere tijd: dat is wel een eigen wijziging.
  await new Promise((r) => setTimeout(r, 50));
  f.eind.value = '12:00';
  assert.equal(f.api.enforceAppointmentEndTime(30), false);
  assert.equal(f.api.appointmentEndGuardState().userOwned, true);
});

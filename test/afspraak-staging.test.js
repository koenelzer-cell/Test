// Het afspraakformulier op backup staging: geen cliëntkaarten meer, maar één
// uursoortveld voor de hele afspraak (HourTypeSelect met alle cliënten, zoals
// registratie-uursoort versie 4 liet zien). Elders blijft alles zoals het was.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { bootHelper } from './helpers/harness.mjs';

const MAIN = fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8');
const STAGING = 'https://impegno-backup-staging.onsagenda.nl';
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const kaal = (x) => JSON.parse(JSON.stringify(x));

// Zoals ONS op staging: EventDetails met het afspraakmodel, daarin
// HourTypeSelect (onUpdate:modelValue(id, naam)) met een wrapper als wortel,
// de uc-select en zijn uc-select-list met de keuzes.
function afspraakformulier() {
  const dom = new JSDOM('<!doctype html><body><div id="content"><uc-modal><div id="details"><div id="hts"><uc-select data-qa="hour_type_select" aria-label="Uursoort"><uc-select-list></uc-select-list></uc-select></div></div></uc-modal></div></body>',
    { url: STAGING + '/invitees/42479/events/new', runScripts: 'outside-only' });
  const w = dom.window, $ = (s) => w.document.querySelector(s);
  const event = { name: '', client_ids: [11142, 9], clients: [{ id: 11142, name: 'Tamara Test' }, { id: 9, name: 'Bram Proef' }], label_ids: [], hour_type_id: null };
  $('uc-select-list').items = [
    { value: 1135, label: 'Behandeling (GGZ 18+)', group: 'Onlangs gebruikt' },
    { value: '__empty_Geadviseerd', label: '', group: 'Geadviseerd' },
    { value: 1136, label: 'Diagnostiek (GGZ 18+)', group: 'Toegestaan' },
    { value: 1135, label: 'Behandeling (GGZ 18+)', group: 'Toegestaan' },
  ];
  const gezet = [];
  const hts = { type: { name: 'HourTypeSelect' }, props: { modelValue: null, clientIds: [11142, 9] }, subTree: { el: $('#hts'), children: [
    { type: 'uc-select', el: $('uc-select'), props: { 'data-qa': 'hour_type_select' }, children: [{ type: 'uc-select-list', el: $('uc-select-list'), props: {} }] },
  ] } };
  const htsVnode = { component: hts, el: $('#hts'), props: { modelValue: null, clientIds: [11142, 9], 'onUpdate:modelValue': (id, naam) => { gezet.push([id, naam]); event.hour_type_id = id; htsVnode.props.modelValue = id; hts.props.modelValue = id; } } };
  hts.vnode = htsVnode;
  const details = { type: { name: 'EventDetails' }, props: { event }, subTree: { el: $('#details'), children: [htsVnode] } };
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: { type: { name: 'App' }, props: {}, subTree: { el: $('uc-modal'), children: [{ component: details, props: {} }] } } };
  w.eval(MAIN);
  const vraag = (type, antwoordType, velden = {}) => new Promise((klaar) => {
    const id = 'q' + Math.random();
    const luister = (ev) => { const x = ev.data; if (x && x.type === antwoordType && x.id === id) { w.removeEventListener('message', luister); klaar(x); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type, id, ...velden }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 600);
  });
  return { w, $, event, gezet, vraag };
}

test('main-world: de uursoort op afspraakniveau en de keuzes uit de lijst van het veld zelf (zonder lege groepen en dubbele)', async () => {
  const f = afspraakformulier();
  const r = await f.vraag('leesFormulier', 'formulierGelezen', { uursoortOpties: true });
  assert.equal(r.ok, true);
  assert.equal(r.uursoort, null);
  assert.deepEqual(kaal(r.uursoortOpties), [
    { id: 1135, naam: 'Behandeling (GGZ 18+)', groep: 'Onlangs gebruikt' },
    { id: 1136, naam: 'Diagnostiek (GGZ 18+)', groep: 'Toegestaan' },
  ]);
  const zonder = await f.vraag('leesFormulier', 'formulierGelezen');
  assert.equal(zonder.uursoortOpties, undefined, 'de keuzes alleen op verzoek');
  assert.doesNotMatch(JSON.stringify(r), /Tamara Test|Bram Proef/, 'geen volledige namen');
});

test('main-world: zetten via HourTypeSelect (onUpdate:modelValue(id, naam)), ook als de wortel van het onderdeel een wrapper is; nagekeken', async () => {
  const f = afspraakformulier();
  f.$('uc-select').setAttribute('data-onsah-doel', 'a1');
  const r = await f.vraag('zetUursoort', 'uursoortGezet', { doel: 'a1', hourTypeId: 1136, beschrijving: 'Diagnostiek (GGZ 18+)' });
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(f.gezet), [[1136, 'Diagnostiek (GGZ 18+)']], 'zoals ONS zelf, met id en naam');
  assert.equal(f.event.hour_type_id, 1136);
  const na = await f.vraag('leesFormulier', 'formulierGelezen');
  assert.equal(na.uursoort, 1136);
  assert.deepEqual(kaal(na.uursoorten), { 9: 1136, 11142: 1136 }, 'één veld voor alle cliënten');
});

test('content op staging: geen cliëntkaart uitklappen; de uursoortstap vraagt één uursoort met de keuzes van het veld en zet hem met het id', async () => {
  const { api, window } = bootHelper({ url: STAGING + '/invitees/42479/events/new', react: true,
    html: '<!doctype html><html><body><div data-test-rect="0,0,900,700"><div>Afspraakdetails</div><div>Uursoort</div><uc-select data-qa="hour_type_select" aria-label="Uursoort" data-test-rect="300,500,380,40"></uc-select></div></body></html>' });
  let uitgeklapt = null;
  api.ensureClientExpanded((ok) => { uitgeklapt = ok; });
  assert.equal(uitgeklapt, true, 'meteen klaar, zonder iets te klikken');
  window.postMessage = (data) => setTimeout(() => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window })), 0);
  const naarMain = [];
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main') return;
    naarMain.push(d);
    const terug = (type, extra) => window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type, id: d.id, ...extra }, origin: window.location.origin, source: window }));
    if (d.type === 'leesFormulier') terug('formulierGelezen', { ok: true, clients: [{ id: 11142, voornaam: 'Tamara' }], uursoorten: {}, labelIds: [], uursoort: null, uursoortOpties: [{ id: 1135, naam: 'Behandeling (GGZ 18+)', groep: 'Onlangs gebruikt' }, { id: 1136, naam: 'Diagnostiek (GGZ 18+)', groep: 'Toegestaan' }] });
    if (d.type === 'zetUursoort') terug('uursoortGezet', { ok: true });
  });
  // Een paneel om in te tekenen, zoals het hulppaneel.
  const paneel = window.document.createElement('div');
  paneel.innerHTML = '<div data-body></div><div data-status></div>';
  window.document.body.appendChild(paneel);
  api.getHelperPanel().popupEl = paneel;
  let verder = 0;
  api.showUursoortQueue([], () => { verder++; });
  const knop = () => [...paneel.querySelectorAll('button')].find((b) => /Diagnostiek \(GGZ 18\+\)$/.test(b.textContent.trim()));
  for (let i = 0; i < 100 && !knop(); i++) await tick();
  assert.ok(knop(), 'Kies uursoort met de keuzes van het veld');
  assert.match(paneel.textContent, /Kies uursoort/);
  assert.equal(naarMain.find((d) => d.type === 'leesFormulier').uursoortOpties, true);
  knop().click();
  for (let i = 0; i < 100 && !verder; i++) await tick();
  const zet = naarMain.find((d) => d.type === 'zetUursoort');
  assert.deepEqual([zet.hourTypeId, zet.beschrijving], [1136, 'Diagnostiek (GGZ 18+)'], 'het id uit de lijst, geen opzoeken op naam');
  assert.equal(verder, 1, 'daarna verder (labels en opslaan)');
});

test('content op staging: staat de uursoort er al, dan meteen verder zonder te vragen', async () => {
  const { api, window } = bootHelper({ url: STAGING + '/invitees/42479/events/new', react: true });
  window.postMessage = (data) => setTimeout(() => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window })), 0);
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (d && d.dir === 'to-main' && d.type === 'leesFormulier') window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'formulierGelezen', id: d.id, ok: true, clients: [], uursoorten: {}, labelIds: [], uursoort: 1135, uursoortOpties: [] }, origin: window.location.origin, source: window }));
  });
  let verder = 0;
  api.showUursoortQueue([], () => { verder++; });
  for (let i = 0; i < 100 && !verder; i++) await tick();
  assert.equal(verder, 1);
});

test('elders (productie) blijft de cliëntkaart gewoon uitgeklapt worden', () => {
  const { api } = bootHelper({ url: 'https://impegno.onsagenda.nl/invitees/42479/events/new' });
  let uitgeklapt = 'nog niet';
  api.ensureClientExpanded((ok) => { uitgeklapt = ok; });
  assert.equal(uitgeklapt, 'nog niet', 'niet meteen klaar: hij zoekt de kaart');
});

test('main-world: reistijd in het vernieuwde formulier (geen onChange) via update:event van EventDetails, met het hele model; nagekeken', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="content"><uc-modal><div id="details"><uc-combo-box data-qa="label_select"></uc-combo-box></div></uc-modal></div></body>',
    { url: STAGING + '/invitees/42479/events/new', runScripts: 'outside-only' });
  const w = dom.window, $ = (s) => w.document.querySelector(s);
  const ontvangen = [];
  const details = { type: { name: 'EventDetails' }, props: { event: { name: '', travel_time_before: 0, travel_time_after: 0, hour_type_id: 1135 } }, subTree: { el: $('#details'), children: [] } };
  const vnode = { component: details, props: { 'onUpdate:event': (ev) => { ontvangen.push(ev); details.props.event = ev; } } };
  details.vnode = vnode;
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: { type: { name: 'App' }, props: {}, subTree: { el: $('uc-modal'), children: [vnode] } } };
  w.eval(MAIN);
  const vraag = (velden) => new Promise((klaar) => {
    const id = 'v' + Math.random();
    const luister = (ev) => { const x = ev.data; if (x && x.type === 'veldGezet' && x.id === id) { w.removeEventListener('message', luister); klaar(x); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetVeld', id, ...velden }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 600);
  });
  const r = await vraag({ veld: 'travel_time_before', waarde: 8 });
  assert.equal(r.ok, true);
  assert.deepEqual(kaal(ontvangen), [{ name: '', travel_time_before: 8, travel_time_after: 0, hour_type_id: 1135 }], 'het hele model, met alleen de reistijd anders');
  const titel = await vraag({ veld: 'name', waarde: 'Gesprek' });
  assert.deepEqual([titel.ok, titel.reden], [false, 'geen onChange'], 'tekst en tijden niet via deze route');
});

test('content: de reistijdvelden heten in het vernieuwde formulier Heenreis en Terugreis', () => {
  const { api } = bootHelper({ url: STAGING + '/invitees/42479/events/new',
    html: '<!doctype html><html><body><div data-test-rect="100,0,120,20">Heenreis</div><input id="heen" inputmode="decimal" data-test-rect="125,0,110,40">'
      + '<div data-test-rect="100,150,120,20">Terugreis</div><input id="terug" inputmode="decimal" data-test-rect="125,150,110,40"></body></html>' });
  assert.equal(api.appointmentTravelInput('heen').id, 'heen');
  assert.equal(api.appointmentTravelInput('terug').id, 'terug');
});

// tools/console/registratie-uursoort.js: de consolecode die uitleest hoe het
// vernieuwde registratievenster de uursoort doorgeeft. Hij moet de lijst en
// de gebeurtenissen laten zien, en geen cliënt- of medewerkernamen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const CODE = fs.readFileSync(new URL('../tools/console/registratie-uursoort.js', import.meta.url), 'utf8');

function venster() {
  const dom = new JSDOM('<!doctype html><body><div id="content"><uc-modal><div id="form">'
    + '<uc-select id="uursoort" name="activity" aria-label="Uursoort"></uc-select>'
    + '<uc-select id="medewerker" aria-label="Medewerker Jan Jansen"></uc-select>'
    + '<div id="client"></div></div></uc-modal></div></body>', { url: 'https://impegno-backup-staging.onsagenda.nl/invitees/1/calendar/week', runScripts: 'outside-only' });
  const w = dom.window, d = w.document, $ = (s) => d.querySelector(s);
  const doorgegeven = [];
  // Zoals Vue: de luisteraars van een element onder het symbool _vei.
  const vei = (el, naam) => { const s = Symbol('_vei'); el[s] = { onChange: { value: (ev) => doorgegeven.push([naam, ev.detail]) } }; };
  vei($('#uursoort'), 'uursoort'); vei($('#medewerker'), 'medewerker');
  const uursoorten = [{ id: 1135, name: 'Behandeling', description: 'Behandeling', code: 'BEH' }, { id: 1136, name: 'No show#', description: 'No show' }];
  const medewerkers = [{ id: 4645, name: 'Jan Jansen' }, { id: 4646, name: 'Piet Proef' }];
  const client = { type: { name: 'ClientRegistrationForm' }, props: { hourType: null, clientDeclaration: { client: { id: 11142, name: 'Tamara Test' } } }, subTree: { el: $('#client'), children: [] } };
  const onHourType = (x) => doorgegeven.push(['client', x]);
  const form = { type: { name: 'DeclareAsRegistrationForm' }, props: {}, subTree: { el: $('#form'), children: [
    { type: 'uc-select', el: $('#uursoort'), props: { name: 'activity', options: uursoorten, modelValue: null } },
    { type: 'uc-select', el: $('#medewerker'), props: { options: medewerkers, modelValue: medewerkers[0] } },
    { component: client, props: { 'onUpdate:hourType': onHourType } },
  ] } };
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: { type: { name: 'DeclareAsRegistrationModal' }, props: {}, subTree: { el: $('uc-modal'), children: [{ component: form, props: {} }] } } };
  w.copy = () => {};
  const melding = w.eval(CODE);
  return { w, $, melding, doorgegeven, form };
}

test('opbouw: de uursoortlijst met namen, de medewerkerlijst zonder namen', () => {
  const v = venster();
  assert.match(v.melding, /2 keuzevelden gevonden, 1 voor de uursoort \(uc-select\)/);
  const u = v.w.onsahUursoort.uitkomst();
  const lijst = u.keuzelijsten.find((k) => k.naam === 'activity');
  assert.equal(lijst.uursoort, true);
  assert.deepEqual(JSON.parse(JSON.stringify(lijst.luistertNaar)), ['onChange']);
  assert.equal(lijst.lijst_options.aantal, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(lijst.lijst_options.namen[0])), { id: 1135, name: 'Behandeling', description: 'Behandeling', code: 'BEH' });
  const mw = u.keuzelijsten.find((k) => k.naam !== 'activity');
  assert.equal(mw.uursoort, false);
  assert.equal(mw.lijst_options.namen, undefined, 'geen medewerkernamen');
  assert.ok(u.componenten.some((c) => c.component === 'ClientRegistrationForm' && c.luisteraars.includes('onUpdate:hourType')));
});

test('meelezen: wat de uursoortlijst en de cliënt doorgeven, en ONS krijgt het gewoon', () => {
  const v = venster();
  const sym = (el) => Object.getOwnPropertySymbols(el).find((s) => s.description === '_vei');
  const kies = (el, detail) => el[sym(el)].onChange.value(new v.w.CustomEvent('change', { detail }));
  kies(v.$('#uursoort'), [{ id: 1135, name: 'Behandeling' }]);
  kies(v.$('#medewerker'), ['Piet Proef']);
  v.form.subTree.children[2].props['onUpdate:hourType']({ id: 1135, name: 'Behandeling', client: { name: 'Tamara Test', id: 11142 } });
  assert.equal(v.doorgegeven.length, 3, 'elke gebeurtenis gaat door naar ONS');
  const g = v.w.onsahUursoort.uitkomst().gebeurtenissen;
  assert.equal(g.length, 3);
  assert.equal(g[0].event, 'onChange');
  assert.deepEqual(JSON.parse(JSON.stringify(g[0].args[0])), { event: 'change', detail: [{ id: 1135, name: 'Behandeling' }] }, 'een uursoort is leesbaar');
  assert.equal(g[2].handler, 'onUpdate:hourType');
  const tekst = JSON.stringify(v.w.onsahUursoort.uitkomst());
  assert.doesNotMatch(tekst, /Jan|Jansen|Piet|Proef|Tamara|11142|4645/);
  v.w.onsahUursoort.stop();
});

// Versie 2: een eigen element zoals ue-activity-select (Lit, met
// constructor.elementProperties), in de Vue-boom en los in de DOM.
function vensterMetEigenVeld() {
  const dom = new JSDOM('<!doctype html><body><div id="content"><uc-modal><div id="form"><div id="client"><ue-activity-select id="act" data-qa="activity-select"></ue-activity-select></div></div></uc-modal></div>'
    + '<div id="los"></div></body>', { url: 'https://impegno-backup-staging.onsagenda.nl/invitees/1/calendar/week', runScripts: 'outside-only' });
  const w = dom.window, d = w.document, $ = (s) => d.querySelector(s);
  class Activiteit extends w.HTMLElement {}
  Activiteit.elementProperties = new Map([['activities', {}], ['value', {}], ['disabled', {}], ['clientId', {}]]);
  w.customElements.define('ue-activity-select', Activiteit);
  const act = $('#act');
  act.activities = [{ id: 5, name: 'Behandeling', description: 'Behandeling' }, { id: 6, name: 'No show#' }];
  act.disabled = false;
  act.clientId = 11142;
  const doorgegeven = [], opgevraagd = [];
  const s = Symbol('_vei');
  act[s] = { onActivityChange: { value: (ev) => doorgegeven.push(ev.detail) } };
  const client = { type: { name: 'ClientRegistrationForm' }, props: {}, subTree: { el: $('#client'), children: [{ type: 'ue-activity-select', el: act, props: { clientId: 11142, onActivityChange: () => {} } }] } };
  const reg = { direct_time: 55, hour_type: { id: 5, name: 'Behandeling', employee: { name: 'Jan Jansen' } }, client_declarations: [{ client: { id: 11142, name: 'Tamara Test' }, hour_type: null }] };
  const tijd = { type: { name: 'TimeRegistrationCard' }, props: { registration: reg }, subTree: { el: $('#form'), children: [] } };
  const form = { type: { name: 'RegistrationForm' }, props: {}, subTree: { el: $('#form'), children: [{ component: tijd, props: {} }, { component: client, props: { 'onUpdate:hourType': (x) => doorgegeven.push(x) } }] } };
  // Wat ONS laadde, en de lijst als je hem nog eens opvraagt.
  w.performance.getEntriesByType = () => [{ name: 'https://impegno-backup-staging.onsagenda.nl/gateway/api/v0/administration/authorized/activities?date=2026-11-04&employee_id=4645', responseStatus: 200, startTime: 37000 }];
  w.fetch = (u) => { opgevraagd.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: 5, name: 'Behandeling', code: 'BEH' }, { id: 6, name: 'No show#' }], meta: { total: 2 } }) }); };
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: { type: { name: 'DeclareAsRegistrationModal' }, props: {}, subTree: { el: $('uc-modal'), children: [{ component: form, props: {} }] } } };
  const los = d.createElement('ue-activity-select');
  los.activities = [];
  $('#los').appendChild(los);
  w.copy = () => {};
  const melding = w.eval(CODE);
  return { w, $, act, melding, doorgegeven, opgevraagd };
}

test('versie 2: een eigen uursoortelement wordt gevonden, met zijn eigenschappen en lijst', () => {
  const v = vensterMetEigenVeld();
  assert.match(v.melding, /2 voor de uursoort \(ue-activity-select, ue-activity-select\)/);
  const u = v.w.onsahUursoort.uitkomst();
  const inBoom = u.keuzelijsten.find((k) => !k.alleenInDom);
  assert.equal(inBoom.element, 'ue-activity-select');
  assert.equal(inBoom.inComponent, 'ClientRegistrationForm');
  assert.deepEqual(JSON.parse(JSON.stringify(inBoom.eigenschappen)), ['activities', 'value', 'disabled', 'clientId']);
  assert.deepEqual(JSON.parse(JSON.stringify(inBoom.luistertNaar)), ['onActivityChange']);
  assert.equal(inBoom.el_activities.aantal, 2);
  assert.equal(inBoom.el_activities.namen[0].name, 'Behandeling');
  assert.equal(inBoom.el_disabled, false);
  const los = u.keuzelijsten.find((k) => k.alleenInDom);
  assert.equal(los.el_activities.aantal, 0, 'een lege lijst is te zien');
  assert.equal(los._el, undefined, 'geen elementen in de uitkomst');
  assert.doesNotMatch(JSON.stringify(u), /11142/);
});

test('versie 2: wat het uursoortelement zelf verstuurt en wat Vue binnenkrijgt; ONS krijgt het gewoon', () => {
  const v = vensterMetEigenVeld();
  const keuze = new v.w.CustomEvent('activity-change', { detail: { id: 5, name: 'Behandeling' } });
  v.act.dispatchEvent(keuze);
  const sym = Object.getOwnPropertySymbols(v.act).find((x) => x.description === '_vei');
  v.act[sym].onActivityChange.value(keuze);
  assert.equal(v.doorgegeven.length, 1, 'de luisteraar van Vue kreeg de keuze');
  const g = v.w.onsahUursoort.uitkomst().gebeurtenissen;
  assert.deepEqual(JSON.parse(JSON.stringify(g.map((x) => x.soort))), ['verstuurd', 'vue-op-element']);
  assert.equal(g[0].event, 'activity-change');
  assert.deepEqual(JSON.parse(JSON.stringify(g[0].args[0])), { event: 'activity-change', detail: { id: 5, name: 'Behandeling' } });
  v.w.onsahUursoort.stop();
  assert.equal(Object.prototype.hasOwnProperty.call(v.act, 'dispatchEvent'), false, 'stop zet dispatchEvent terug');
});

test('versie 3: waar de uursoort in de registratie staat, en de opbouw van de uursoortlijst', async () => {
  const v = vensterMetEigenVeld();
  await new Promise((klaar) => setTimeout(klaar, 20));
  const u = v.w.onsahUursoort.uitkomst();
  const r = JSON.parse(JSON.stringify(u.registratie.TimeRegistrationCard));
  assert.deepEqual(r.hour_type, { id: 5, name: 'Behandeling', employee: { name: 'tekst(10)' } }, 'uursoort leesbaar, de medewerker niet');
  assert.equal(r['client_declarations[0].hour_type'], null);
  assert.ok(r.sleutels.includes('direct_time'));
  assert.deepEqual(JSON.parse(JSON.stringify(u.netwerk[0].zoek)), ['date', 'employee_id'], 'alleen de namen van de zoekwaarden');
  assert.equal(v.opgevraagd.length, 1, 'de lijst één keer opgevraagd, op hetzelfde adres als ONS');
  const l = JSON.parse(JSON.stringify(u.uursoortlijst));
  assert.equal(l.lijstOnder, 'data');
  assert.equal(l.lijst.aantal, 2);
  assert.deepEqual(l.eerste, { id: 5, name: 'Behandeling', code: 'BEH' });
  assert.doesNotMatch(JSON.stringify(u), /Tamara|Jansen|11142|4645|2026-11-04/);
  v.w.onsahUursoort.stop();
});

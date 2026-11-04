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
  assert.match(v.melding, /3 keuzelijsten|2 keuzelijsten/);
  const u = v.w.onsahUursoort.uitkomst();
  const lijst = u.keuzelijsten.find((k) => k.naam === 'activity');
  assert.equal(lijst.uursoort, true);
  assert.deepEqual(JSON.parse(JSON.stringify(lijst.luistertNaar)), ['onChange']);
  assert.equal(lijst.lijst_options.aantal, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(lijst.lijst_options.namen[0])), { id: 'number', name: 'Behandeling', description: 'Behandeling', code: 'BEH' });
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
  assert.deepEqual(JSON.parse(JSON.stringify(g[0].args[0])), { event: 'change', detail: [{ id: 'id', name: 'tekst(11)' }] });
  assert.equal(g[2].handler, 'onUpdate:hourType');
  const tekst = JSON.stringify(v.w.onsahUursoort.uitkomst());
  assert.doesNotMatch(tekst, /Jan|Jansen|Piet|Proef|Tamara|11142|4645/);
  v.w.onsahUursoort.stop();
});

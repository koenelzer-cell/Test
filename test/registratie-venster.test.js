// Het vernieuwde registratievenster (DeclareAsRegistrationForm op de agenda):
// de main-world leest het uit en zet tijden en no-show via de luisteraars die
// de ouder aan de kaarten meegeeft, zoals ONS zelf (registratie-luister).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = '<!doctype html><body><div id="content"><uc-modal><div id="form"><uc-card id="tijd"><div data-qa="time-distribution-fields"></div></uc-card><uc-card id="rapport"></uc-card></div></uc-modal></div></body>';

// opties: neemtOver (de ouder werkt de registratie bij), metClients.
async function venster({ neemtOver = true, metVenster = true } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(metVenster ? HTML : '<!doctype html><body><div id="content"></div></body>', { url: 'https://impegno-backup-staging.onsagenda.nl/invitees/1,2/calendar/week', runScripts: 'outside-only' });
  const w = dom.window, d = w.document, $ = (s) => d.querySelector(s);
  const reg = {
    client_declarations: [
      { client: { id: 11142, name: 'Tamara Test', identification_no: '106839', birth_date: '1990-01-01' }, hour_type: null, no_show: false, report_comment: null },
      { client: { id: 222, name: 'Weg Gehaald' }, soft_deleted: true },
      { client: { id: 333, name: 'Bram Proef' }, hour_type: { id: 1135, name: 'Behandeling' }, no_show: false },
    ],
    date: '2026-11-03', direct_time: 55, indirect_time: 0, travel_time_before: 0, travel_time_after: 0,
    start_time: '2026-11-03T13:05:00.000+01:00', end_time: new Date(2026, 10, 3, 14, 0), report_comment: 'Gesprek met Tamara', meta: { report_required: true, allow_travel_time_registration: true },
  };
  const ontvangen = [];
  // Zoals DeclareAsRegistrationForm: een stukje registratie samenvoegen.
  const werkBij = (stuk) => { ontvangen.push(['registration', stuk]); if (neemtOver) Object.assign(reg, stuk); };
  const veldBij = (x) => { ontvangen.push(['field', x]); if (neemtOver) { const cd = reg.client_declarations.find((c) => c.client.id === x.client_id); if (cd) cd[x.field] = x.value; } };
  const tijd = { type: { name: 'TimeRegistrationCard' }, props: { registration: reg }, subTree: { el: $('#tijd') || d.body, children: [] } };
  const clients = { type: { name: 'ReportAndClientsCard' }, props: { registration: reg }, subTree: { el: $('#rapport') || d.body, children: [] } };
  const form = { type: { name: 'DeclareAsRegistrationForm' }, props: { initialRegistration: reg }, subTree: { el: $('#form') || d.body, children: [
    { component: tijd, props: { 'onUpdate:registration': werkBij } },
    { component: clients, props: { 'onUpdate:registration': werkBij, 'onUpdate:clientDeclarationField': veldBij } },
  ] } };
  const modal = { type: { name: 'DeclareAsRegistrationModal' }, props: {}, subTree: { el: $('uc-modal') || d.body, children: [{ component: form, props: {} }] } };
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: modal };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = (type, antwoordType, velden = {}) => new Promise((klaar) => {
    const id = 'r' + Math.random();
    const luister = (ev) => { const x = ev.data; if (x && x.type === antwoordType && x.id === id) { w.removeEventListener('message', luister); klaar(x); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type, id, ...velden }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 600);
  });
  return { vraag, reg, ontvangen: () => JSON.parse(JSON.stringify(ontvangen)) };
}

test('lezen: tijden, getallen en per cliënt id, no-show en uursoort; geen namen of rapportagetekst', async () => {
  const v = await venster();
  const r = await v.vraag('leesRegistratie', 'registratieGelezen');
  assert.equal(r.ok, true);
  assert.deepEqual({ datum: r.datum, begin: r.begin, eind: r.eind, direct: r.direct, indirect: r.indirect, reisHeen: r.reisHeen, reisTerug: r.reisTerug, rapportVerplicht: r.rapportVerplicht, rapportLengte: r.rapportLengte },
    { datum: '2026-11-03', begin: '13:05', eind: '14:00', direct: 55, indirect: 0, reisHeen: 0, reisTerug: 0, rapportVerplicht: true, rapportLengte: 18 });
  assert.deepEqual(JSON.parse(JSON.stringify(r.clients)), [{ id: 11142, noShow: false, uursoort: null }, { id: 333, noShow: false, uursoort: 1135 }], 'een weggehaalde cliënt telt niet');
  assert.doesNotMatch(JSON.stringify(r), /Tamara|Bram|106839|1990|Behandeling|Gesprek/);
});

test('tijden zetten zoals ONS: een stukje registratie aan de luisteraar van TimeRegistrationCard, reistijd als tekst, nagekeken', async () => {
  const v = await venster();
  const r = await v.vraag('zetRegistratie', 'registratieGezet', { velden: { direct_time: 30, indirect_time: 15, travel_time_before: 5, iets_anders: 9 } });
  assert.equal(r.ok, true);
  assert.deepEqual(v.ontvangen(), [['registration', { direct_time: 30, indirect_time: 15, travel_time_before: '5' }]], 'alleen bekende velden, in de vorm van ONS');
  assert.equal(v.reg.direct_time, 30);
  const fout = await v.vraag('zetRegistratie', 'registratieGezet', { velden: { direct_time: -5, indirect_time: 1.5 } });
  assert.deepEqual([fout.ok, fout.reden], [false, 'geen geldige velden']);
});

test('neemt ONS het niet over, dan ok false; geen venster: ok false', async () => {
  const v = await venster({ neemtOver: false });
  const r = await v.vraag('zetRegistratie', 'registratieGezet', { velden: { direct_time: 30 } });
  assert.deepEqual([r.ok, r.reden], [false, 'het formulier nam de waarde niet over']);
  const leeg = await venster({ metVenster: false });
  const r2 = await leeg.vraag('leesRegistratie', 'registratieGelezen');
  assert.deepEqual([r2.ok, r2.reden], [false, 'geen registratievenster']);
});

test('no-show per cliënt via onUpdate:clientDeclarationField({ client_id, field, value }), alleen voor een cliënt in deze registratie', async () => {
  const v = await venster();
  const r = await v.vraag('zetRegistratie', 'registratieGezet', { noShow: { clientId: 11142, aan: true } });
  assert.equal(r.ok, true);
  assert.deepEqual(v.ontvangen(), [['field', { client_id: 11142, field: 'no_show', value: true }]]);
  assert.equal(v.reg.client_declarations[0].no_show, true);
  const vreemd = await v.vraag('zetRegistratie', 'registratieGezet', { noShow: { clientId: 999, aan: true } });
  assert.deepEqual([vreemd.ok, vreemd.reden], [false, 'cliënt niet in deze registratie']);
});

// Het vernieuwde registratievenster (DeclareAsRegistrationForm op de agenda):
// de main-world leest het uit en zet tijden en no-show via de luisteraars die
// de ouder aan de kaarten meegeeft, zoals ONS zelf (registratie-luister).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = '<!doctype html><body><div id="content"><uc-modal><div id="form"><uc-card id="tijd"><div data-qa="time-distribution-fields"></div><ue-activity-select aria-label="Uursoort"></ue-activity-select></uc-card><uc-card id="rapport"></uc-card></div></uc-modal></div></body>';
// Zoals /gateway/api/v0/administration/authorized/activities (ingekort).
const ACTIVITEITEN = {
  suggestedActivityList: [
    { activityModel: { objectId: 1145, description: 'Behandeling (GGZ 18+)', identificationNo: 'BEH-GGZ-18', typeDirect: 'Direct' }, preselected: false },
    { activityModel: { objectId: 1146, description: 'Diagnostiek (GGZ 18+) ', typeDirect: 'Direct' }, preselected: false },
  ],
  otherActivityList: [{ activityModel: { objectId: 1089, description: 'Detachering ' } }, { activityModel: { objectId: 1145, description: 'Behandeling (GGZ 18+)' } }],
  allowDistributeClientTime: false,
};

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
  // Het uursoortveld: TimeRegistrationCard luistert met onChangeActivity en
  // maakt er zelf hour_type { external_id } van (zoals registratie-uursoort liet zien).
  const activiteit = [];
  const opActiviteit = (ev) => { activiteit.push([ev.type, ev.detail]); werkBij({ hour_type: { external_id: String(ev.detail[0]) } }); };
  const uursoortVeld = $('ue-activity-select');
  const tijd = { type: { name: 'TimeRegistrationCard' }, props: { registration: reg }, subTree: { el: $('#tijd') || d.body, children: uursoortVeld ? [{ type: 'ue-activity-select', el: uursoortVeld, props: { 'activity-ids': '', onChangeActivity: opActiviteit } }] : [] } };
  const clients = { type: { name: 'ReportAndClientsCard' }, props: { registration: reg }, subTree: { el: $('#rapport') || d.body, children: [] } };
  const form = { type: { name: 'DeclareAsRegistrationForm' }, props: { initialRegistration: reg }, subTree: { el: $('#form') || d.body, children: [
    { component: tijd, props: { 'onUpdate:registration': werkBij } },
    { component: clients, props: { 'onUpdate:registration': werkBij, 'onUpdate:clientDeclarationField': veldBij } },
  ] } };
  const modal = { type: { name: 'DeclareAsRegistrationModal' }, props: {}, subTree: { el: $('uc-modal') || d.body, children: [{ component: form, props: {} }] } };
  $('#content').__vue_app__ = { version: '3.5.43' };
  $('#content')._vnode = { component: modal };
  // Wat de pagina zelf ophaalt (de main-world kijkt mee).
  w.fetch = (u) => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, clone() { return this; }, text: () => Promise.resolve(/authorized\/activities/.test(String(u)) ? JSON.stringify(ACTIVITEITEN) : '{}') });
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = (type, antwoordType, velden = {}) => new Promise((klaar) => {
    const id = 'r' + Math.random();
    const luister = (ev) => { const x = ev.data; if (x && x.type === antwoordType && x.id === id) { w.removeEventListener('message', luister); klaar(x); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type, id, ...velden }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 600);
  });
  return { w, vraag, reg, ontvangen: () => JSON.parse(JSON.stringify(ontvangen)), activiteit: () => JSON.parse(JSON.stringify(activiteit)) };
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

test('uursoort lezen: in het vernieuwde venster hour_type { external_id }, ook per cliënt', async () => {
  const v = await venster();
  v.reg.hour_type = { external_id: '1145' };
  v.reg.client_declarations[0].hour_type = { external_id: '1146' };
  const r = await v.vraag('leesRegistratie', 'registratieGelezen');
  assert.equal(r.uursoort, 1145);
  assert.deepEqual(JSON.parse(JSON.stringify(r.clients.map((c) => c.uursoort))), [1146, 1135], 'per cliënt: external_id of id');
  assert.equal(r.uursoorten, undefined, 'de uursoortlijst alleen op verzoek');
});

test('de uursoortlijst die het uursoortveld ophaalt: alleen id en naam, zonder dubbele, alleen op verzoek mee', async () => {
  const v = await venster();
  const leeg = await v.vraag('leesRegistratie', 'registratieGelezen', { uursoorten: true });
  assert.deepEqual(JSON.parse(JSON.stringify(leeg.uursoorten)), [], 'nog niets opgehaald');
  await v.w.fetch('/gateway/api/v0/administration/authorized/activities?inactive=false&employeeId=4645&date=2026-11-04');
  await new Promise((k) => setTimeout(k, 20));
  const r = await v.vraag('leesRegistratie', 'registratieGelezen', { uursoorten: true });
  assert.deepEqual(JSON.parse(JSON.stringify(r.uursoorten)), [
    { id: 1145, naam: 'Behandeling (GGZ 18+)' }, { id: 1146, naam: 'Diagnostiek (GGZ 18+)' }, { id: 1089, naam: 'Detachering' },
  ]);
  assert.doesNotMatch(JSON.stringify(r), /BEH-GGZ|4645/);
});

test('uursoort zetten: het change-activity-event met de id als tekst aan onChangeActivity van het uursoortveld, nagekeken', async () => {
  const v = await venster();
  const r = await v.vraag('zetRegistratie', 'registratieGezet', { uursoort: 1146 });
  assert.equal(r.ok, true);
  assert.deepEqual(v.activiteit(), [['change-activity', ['1146']]], 'zoals het veld zelf een keuze meldt');
  assert.deepEqual(v.ontvangen(), [['registration', { hour_type: { external_id: '1146' } }]], 'TimeRegistrationCard maakte er zelf hour_type van');
  const fout = await v.vraag('zetRegistratie', 'registratieGezet', { uursoort: 'abc' });
  assert.deepEqual([fout.ok, fout.reden], [false, 'ongeldige uursoort']);
  const nietOver = await venster({ neemtOver: false });
  const r2 = await nietOver.vraag('zetRegistratie', 'registratieGezet', { uursoort: 1146 });
  assert.deepEqual([r2.ok, r2.reden], [false, 'het formulier nam de waarde niet over']);
});

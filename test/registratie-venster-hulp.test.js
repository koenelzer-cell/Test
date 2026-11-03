// De registratiehulp in het vernieuwde registratievenster (impegno-backup-
// staging): het content-script, de schermen (React-bundel) en de main-world
// draaien hier samen in één jsdom-venster, met een nagebouwde Vue-boom van het
// venster zoals in registratie-venster.test.js. Zo loopt elke stap via de
// echte brug: opdracht naar de main-world, die de luisteraars van ONS
// aanroept, en het antwoord terug.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const MAIN = fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8');
const AGENDA = 'https://impegno-backup-staging.onsagenda.nl/invitees/1,2/calendar/week';
const VENSTER = '<uc-modal><div id="form"><uc-card id="tijd"><div data-qa="time-distribution-fields"></div></uc-card>'
  + '<uc-card id="rapport"><div data-qa="new-report-field"><uc-textarea></uc-textarea></div></uc-card>'
  + '<uc-button data-qa="submit-button">Indienen</uc-button></div></uc-modal>';
const VORMEN = { registrationForms: [
  { vorm: 'No show', startVerdeling: '100% direct', uursoort: 'No show#', eindtijdBeginPlusMin: 1, rapportagePrefix: 'No show', labels: [] },
  { vorm: 'MDO', startVerdeling: '100% indirect', labels: ['MDO'] },
  { vorm: 'Huisbezoek', startVerdeling: '100% direct', vraagIndirecteTijd: true, vraagReistijd: true, labels: ['Huisbezoek'] },
  { vorm: 'Verslaglegging', startVerdeling: '100% indirect', vraagDirecteTijd: true, rapportagePrefix: 'Verslag:', labels: ['Verslaglegging'] },
] };

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));
async function wachtOp(fn, max = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) { const v = fn(); if (v) return v; await tick(); }
  return fn();
}

// opties: venster (open bij het laden), labels (van de afspraak waaruit het
// venster komt), host.
function opzet({ venster = true, labels = null, host = 'impegno-backup-staging.onsagenda.nl', uursoort = null } = {}) {
  const boot = bootHelper({
    url: AGENDA.replace('impegno-backup-staging.onsagenda.nl', host),
    html: '<!doctype html><html><body><div id="content">' + (venster ? VENSTER : '') + '</div></body></html>',
    bundled: VORMEN, react: true,
  });
  const w = boot.window, d = w.document, $ = (s) => d.querySelector(s);
  // jsdom's postMessage geeft geen origin mee; de brug controleert die wel.
  w.postMessage = function (data) { setTimeout(() => w.dispatchEvent(new w.MessageEvent('message', { data, origin: w.location.origin, source: w })), 0); };
  const reg = {
    client_declarations: [
      { client: { id: 11142, name: 'Tamara Test' }, hour_type: uursoort, no_show: false },
      { client: { id: 333, name: 'Bram Proef' }, hour_type: null, no_show: false },
    ],
    date: '2026-11-03', direct_time: 55, indirect_time: 0, travel_time_before: 0, travel_time_after: 0,
    start_time: '2026-11-03T13:05:00.000+01:00', end_time: '2026-11-03T14:00:00.000+01:00', report_comment: null,
    meta: { report_required: true, allow_travel_time_registration: true },
  };
  const ontvangen = [];
  const werkBij = (stuk) => { ontvangen.push(['registration', stuk]); Object.assign(reg, stuk); };
  const veldBij = (x) => { ontvangen.push(['field', x]); const cd = reg.client_declarations.find((c) => c.client.id === x.client_id); if (cd) cd[x.field] = x.value; };
  const bouw = () => {
    const tijd = { type: { name: 'TimeRegistrationCard' }, props: { registration: reg }, subTree: { el: $('#tijd') || d.body, children: [] } };
    const clients = { type: { name: 'ReportAndClientsCard' }, props: { registration: reg }, subTree: { el: $('#rapport') || d.body, children: [] } };
    const form = { type: { name: 'DeclareAsRegistrationForm' }, props: { initialRegistration: reg }, subTree: { el: $('#form') || d.body, children: [
      { component: tijd, props: { 'onUpdate:registration': werkBij } },
      { component: clients, props: { 'onUpdate:registration': werkBij, 'onUpdate:clientDeclarationField': veldBij } },
    ] } };
    const modal = { type: { name: 'DeclareAsRegistrationModal' }, props: { occurrenceId: 'occ1' }, subTree: { el: $('uc-modal') || d.body, children: [{ component: form, props: {} }] } };
    $('#content').__vue_app__ = { version: '3.5.43' };
    $('#content')._vnode = { component: modal };
  };
  let ingediend = 0;
  // Zoals ReportFields en de knop Indienen van ONS.
  const koppel = () => {
    const veld = $('uc-textarea');
    if (veld) veld.addEventListener('input', (ev) => werkBij({ report_comment: ev.detail[0] }));
    const knop = $('[data-qa="submit-button"]');
    if (knop) knop.addEventListener('click', () => { ingediend++; });
  };
  if (venster) { bouw(); koppel(); }
  w.eval(MAIN);
  if (labels) w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'details', url: '/calendar/invitee/1/events/occ1/details', labels }, origin: w.location.origin, source: w }));
  const paneel = () => boot.api.getHelperPanel().popupEl;
  const tekst = () => (paneel() ? paneel().textContent.replace(/\s+/g, ' ') : '');
  // Een keuzetegel begint met zijn sneltoets (1, 2, …): die laten we weg.
  const knop = (re) => paneel() && [...paneel().querySelectorAll('button')].find((b) => re.test(b.textContent.trim().replace(/^\d(?=\D)/, '')));
  const openVenster = () => { $('#content').insertAdjacentHTML('beforeend', VENSTER); bouw(); koppel(); };
  return { ...boot, reg, ontvangen: () => JSON.parse(JSON.stringify(ontvangen)), ingediend: () => ingediend, paneel, tekst, knop, openVenster, $ };
}

test('venster open op de agenda: het hulppaneel staat erin met de registratievormen, en de agenda blijft aan', async () => {
  const t = opzet();
  await wachtOp(() => t.knop(/^MDO/));
  const hp = t.api.getHelperPanel();
  assert.equal(hp.activeMode, 'registratieVenster');
  assert.ok(t.$('uc-modal').contains(t.paneel()), 'het paneel hangt in het venster (een modaal venster maakt de rest onklikbaar)');
  assert.match(t.tekst(), /Registratiehulp/);
  assert.match(t.tekst(), /No show.*MDO.*Huisbezoek.*Verslaglegging/);
  assert.ok(!t.knop(/Verwijder instellingen/), 'geen knop zonder werking');
  assert.equal(t.api._agendaPage.active, true, 'de agenda (en dus het zijpaneel) blijft aan');
  assert.ok(!t.sent.some((m) => m && m.type === 'ag-gone'), 'het zijpaneel krijgt geen bericht dat de agenda weg is');
});

test('een vorm kiezen zet de tijdverdeling via ONS; daarna de controles, en Indienen pas als alles klopt', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^MDO/))).click();
  await wachtOp(() => t.reg.indirect_time === 55);
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [0, 55], 'MDO is 100% indirect over de hele registratie (13:05 tot 14:00)');
  assert.deepEqual(t.ontvangen()[0], ['registration', { direct_time: 0, indirect_time: 55 }]);
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()));
  assert.match(t.tekst(), /Kies de uursoort/);
  const indienen = t.paneel().querySelector('[data-registratievenster-indienen]');
  assert.equal(indienen.getAttribute('aria-disabled'), 'true');
  indienen.click();
  await tick(150);
  assert.equal(t.ingediend(), 0, 'met open punten klikt de hulp Indienen van ONS niet');
  // De medewerker schrijft de rapportage en kiest de uursoort in ONS.
  t.reg.report_comment = 'Overleg gehad';
  t.reg.client_declarations[0].hour_type = { id: 1135 };
  await wachtOp(() => indienen.getAttribute('aria-disabled') === 'false', 3000);
  assert.doesNotMatch(t.tekst(), /Schrijf eerst|Kies de uursoort/);
  indienen.click();
  await wachtOp(() => t.ingediend() === 1);
  assert.equal(t.ingediend(), 1, 'de knop Indienen van ONS is geklikt');
});

test('vorm uit het afspraaklabel: meteen de vraag naar de tegen-tijd, dan reistijd (heen de helft naar boven) en de rapportage', async () => {
  const t = opzet({ labels: ['JG Huisbezoek'] });
  await wachtOp(() => /Indirecte tijd aanwezig/.test(t.tekst()));
  assert.doesNotMatch(t.tekst(), /Verslaglegging/, 'de keuze is overgeslagen');
  t.knop(/^Nee/).click();
  await wachtOp(() => /Totale reistijd/.test(t.tekst()));
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [55, 0]);
  t.knop(/^25 min\.?$/).click();
  await wachtOp(() => t.reg.travel_time_before === '13');
  assert.deepEqual([t.reg.travel_time_before, t.reg.travel_time_after], ['13', '12'], 'zoals ONS: reistijd als tekst');
  await wachtOp(() => t.paneel().querySelector('[data-registratievenster-indienen]'));
  assert.equal(t.reg.report_comment, null, 'Huisbezoek heeft geen aanhef: de rapportage blijft leeg');
});

test('tegen-tijd kiezen: de gekozen minuten indirect, de rest direct; een aanhef komt in de lege rapportage', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^Verslaglegging/))).click();
  await wachtOp(() => /Directe tijd aanwezig/.test(t.tekst()));
  t.knop(/^Ja/).click();
  await wachtOp(() => /Duur directe tijd/.test(t.tekst()));
  t.knop(/^0:15$|^15 min\.?$/).click();
  await wachtOp(() => t.reg.indirect_time === 40);
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [15, 40]);
  await wachtOp(() => t.reg.report_comment === 'Verslag:');
  assert.equal(t.reg.report_comment, 'Verslag:', 'de aanhef staat in de rapportage, via het veld zoals ONS het doorgeeft');
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.match(t.tekst(), /Schrijf eerst de rapportage/, 'alleen de aanhef telt niet als rapportage');
});

test('No show: no-show aan bij elke cliënt, geen tijdverdeling; de rapportage hoeft dan niet', async () => {
  const t = opzet({ uursoort: { id: 77 } });
  (await wachtOp(() => t.knop(/^No show/))).click();
  await wachtOp(() => t.reg.client_declarations.every((c) => c.no_show === true));
  assert.deepEqual(t.reg.client_declarations.map((c) => c.no_show), [true, true]);
  assert.ok(!t.ontvangen().some(([soort, x]) => soort === 'registration' && 'direct_time' in x), 'geen tijden gezet');
  const indienen = await wachtOp(() => t.paneel().querySelector('[data-registratievenster-indienen]'));
  await wachtOp(() => indienen.getAttribute('aria-disabled') === 'false', 3000);
  assert.equal(indienen.getAttribute('aria-disabled'), 'false');
});

test('het venster gaat open en dicht op de agenda: de hulp komt en gaat mee', async () => {
  const t = opzet({ venster: false });
  await tick(300);
  assert.equal(t.api.getHelperPanel().activeMode, null, 'zonder venster geen hulp');
  t.openVenster();
  await wachtOp(() => t.knop(/^MDO/));
  assert.equal(t.api.getHelperPanel().activeMode, 'registratieVenster');
  t.$('uc-modal').remove();
  await wachtOp(() => t.api.getHelperPanel().activeMode === null, 4000);
  assert.equal(t.api.getHelperPanel().activeMode, null);
  assert.equal(t.paneel(), null, 'het paneel is weg');
});

test('op andere hosts start deze hulp niet', async () => {
  const t = opzet({ host: 'impegno.onsagenda.nl' });
  await tick(400);
  assert.notEqual(t.api.getHelperPanel().activeMode, 'registratieVenster');
});

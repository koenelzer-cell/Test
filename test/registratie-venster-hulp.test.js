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

// De tijden in het venster staan in Nederlandse tijd (+01:00); de eindtijd die
// de hulp zet is een Date, zoals ONS hem doorgeeft. Zelfde tijdzone als in ONS.
process.env.TZ = 'Europe/Amsterdam';

const MAIN = fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8');
const AGENDA = 'https://impegno-backup-staging.onsagenda.nl/invitees/1,2/calendar/week';
const VENSTER = '<uc-modal><div id="form"><uc-card id="tijd"><div data-qa="time-distribution-fields"></div>'
  + '<uc-button data-qa="add-travel-times">+ Reistijd</uc-button><ue-activity-select aria-label="Uursoort"></ue-activity-select></uc-card>'
  + '<uc-card id="rapport"><div data-qa="new-report-field"><uc-textarea></uc-textarea></div><uc-button id="toevoegen">Toevoegen</uc-button></uc-card>'
  + '<uc-button data-qa="submit-button">Indienen</uc-button></div></uc-modal>';
const VORMEN = { registrationForms: [
  { vorm: 'No show', startVerdeling: '100% direct', uursoort: 'No show#', eindtijdBeginPlusMin: 1, rapportagePrefix: 'No show', labels: [] },
  { vorm: 'MDO', startVerdeling: '100% indirect', labels: ['MDO'] },
  { vorm: 'Huisbezoek', startVerdeling: '100% direct', vraagIndirecteTijd: true, vraagReistijd: true, labels: ['Huisbezoek'] },
  { vorm: 'Verslaglegging', startVerdeling: '100% indirect', vraagDirecteTijd: true, rapportagePrefix: 'Verslag:', labels: ['Verslaglegging'] },
  { vorm: 'Diagnostiek', startVerdeling: '100% direct', uursoort: 'Diagnostiek', labels: [] },
  { vorm: 'Overleg', startVerdeling: '100% indirect', uursoort: 'Overleg extern', labels: [] },
] };
// Wat het uursoortveld ophaalt (/authorized/activities, ingekort).
const ACTIVITEITEN = { suggestedActivityList: [{ activityModel: { objectId: 1145, description: 'Behandeling (GGZ 18+)' } }, { activityModel: { objectId: 1146, description: 'Diagnostiek (GGZ 18+)' } }], otherActivityList: [{ activityModel: { objectId: 1089, description: 'Detachering ' } }] };

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));
async function wachtOp(fn, max = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) { const v = fn(); if (v) return v; await tick(); }
  return fn();
}

// opties: venster (open bij het laden), labels (van de afspraak waaruit het
// venster komt), host, uursoort (van de eerste cliënt), registratieUursoort
// (al gekozen, bijvoorbeeld uit de afspraak), uursoorten (het uursoortveld
// heeft zijn lijst al opgehaald).
// metKeuzelijst: het uursoortveld heeft zijn keuzelijst (uc-select met de
// opties) in de shadow-DOM, zoals in ONS; een klik op een optie meldt
// change-activity, waar Vue op luistert.
function opzet({ venster = true, labels = null, host = 'impegno-backup-staging.onsagenda.nl', uursoort = null, registratieUursoort, uursoorten = true, metKeuzelijst = false } = {}) {
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
  if (registratieUursoort) reg.hour_type = registratieUursoort;
  const ontvangen = [];
  const werkBij = (stuk) => { ontvangen.push(['registration', stuk]); Object.assign(reg, stuk); };
  const veldBij = (x) => { ontvangen.push(['field', x]); const cd = reg.client_declarations.find((c) => c.client.id === x.client_id); if (cd) cd[x.field] = x.value; };
  const bouw = () => {
    // Het uursoortveld: TimeRegistrationCard maakt van change-activity zelf hour_type.
    const veld = $('ue-activity-select');
    const opActiviteit = (ev) => werkBij({ hour_type: { external_id: String(ev.detail[0]) } });
    const tijd = { type: { name: 'TimeRegistrationCard' }, props: { registration: reg }, subTree: { el: $('#tijd') || d.body, children: veld ? [{ type: 'ue-activity-select', el: veld, props: { onChangeActivity: opActiviteit } }] : [] } };
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
  // Zoals ReportFields, de knop Indienen en de knop '+ Reistijd' van ONS (die
  // toont de reistijdvelden en verdwijnt).
  let toegevoegd = 0;
  const gekozenInVeld = [];
  const koppel = () => {
    const toevoegen = $('#toevoegen');
    if (toevoegen) toevoegen.addEventListener('click', () => { toegevoegd++; });
    const ue = $('ue-activity-select');
    if (ue && metKeuzelijst) {
      // Zoals Vue: de luisteraar op het veld zelf.
      ue.addEventListener('change-activity', (ev) => werkBij({ hour_type: { external_id: String(ev.detail[0]) } }));
      const sr = ue.attachShadow({ mode: 'open' });
      sr.innerHTML = '<uc-select role="combobox" aria-label="Uursoort"></uc-select><div role="listbox" data-test-rect="40,0,300,200">'
        + ACTIVITEITEN.suggestedActivityList.concat(ACTIVITEITEN.otherActivityList).map((a) => '<div role="option" data-id="' + a.activityModel.objectId + '" data-test-rect="50,0,280,30">' + a.activityModel.description.trim() + '</div>').join('') + '</div>';
      sr.querySelectorAll('[role="option"]').forEach((o) => o.addEventListener('click', () => {
        gekozenInVeld.push(o.textContent);
        ue.dispatchEvent(new w.CustomEvent('change-activity', { detail: [o.getAttribute('data-id')] }));
      }));
    }
    const reis = $('[data-qa="add-travel-times"]');
    if (reis) reis.addEventListener('click', () => {
      ontvangen.push(['klik', 'add-travel-times']);
      reis.insertAdjacentHTML('afterend', '<input data-qa="travel-before"><input data-qa="travel-after">');
      reis.remove();
    });
    const veld = $('uc-textarea');
    if (veld) veld.addEventListener('input', (ev) => werkBij({ report_comment: ev.detail[0] }));
    const knop = $('[data-qa="submit-button"]');
    if (knop) knop.addEventListener('click', () => { ingediend++; });
  };
  if (venster) { bouw(); koppel(); }
  // De pagina haalt de uursoorten op (de main-world kijkt mee); de rest gaat
  // naar de stub van het harnas.
  const oudeFetch = w.fetch;
  w.fetch = (u, init) => (/authorized\/activities/.test(String(u))
    ? Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, clone() { return this; }, text: () => Promise.resolve(JSON.stringify(ACTIVITEITEN)) })
    : oudeFetch(u, init));
  w.eval(MAIN);
  const laadUursoorten = () => w.fetch('/gateway/api/v0/administration/authorized/activities?date=2026-11-03').then(() => tick(20));
  if (venster && uursoorten) laadUursoorten();
  if (labels) w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'details', url: '/calendar/invitee/1/events/occ1/details', labels }, origin: w.location.origin, source: w }));
  const paneel = () => boot.api.getHelperPanel().popupEl;
  const tekst = () => (paneel() ? paneel().textContent.replace(/\s+/g, ' ') : '');
  // Een keuzetegel begint met zijn sneltoets, vast aan de naam ('1No show'):
  // die laten we weg ('0 min.' blijft heel).
  const knop = (re) => paneel() && [...paneel().querySelectorAll('button')].find((b) => re.test(b.textContent.trim().replace(/^\d(?=[A-Za-z])/, '')));
  const openVenster = () => { $('#content').insertAdjacentHTML('beforeend', VENSTER); bouw(); koppel(); };
  return { ...boot, reg, ontvangen: () => JSON.parse(JSON.stringify(ontvangen)), ingediend: () => ingediend, toegevoegd: () => toegevoegd, gekozenInVeld: () => gekozenInVeld.slice(), paneel, tekst, knop, openVenster, laadUursoorten, $ };
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

test('een vorm kiezen zet de tijdverdeling via ONS; zonder uursoort eerst Kies uursoort; daarna de controles, en Indienen pas als alles klopt', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^MDO/))).click();
  await wachtOp(() => t.reg.indirect_time === 55);
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [0, 55], 'MDO is 100% indirect over de hele registratie (13:05 tot 14:00)');
  assert.deepEqual(t.ontvangen()[0], ['registration', { direct_time: 0, indirect_time: 55 }]);
  // Zoals de afspraakhulp: de uursoort uitvragen, met de lijst van het uursoortveld.
  await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Detachering$/));
  assert.match(t.tekst(), /Behandeling \(GGZ 18\+\).*Diagnostiek \(GGZ 18\+\).*Detachering/, 'de aanbevolen uursoorten eerst, zoals in ONS');
  t.knop(/^Diagnostiek \(GGZ 18\+\)$/).click();
  await wachtOp(() => t.reg.hour_type);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1146' }, 'gezet zoals het uursoortveld een keuze meldt');
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.doesNotMatch(t.tekst(), /Kies de uursoort/);
  const indienen = t.paneel().querySelector('[data-registratievenster-indienen]');
  assert.equal(indienen.getAttribute('aria-disabled'), 'true');
  indienen.click();
  await tick(150);
  assert.equal(t.ingediend(), 0, 'met open punten klikt de hulp Indienen van ONS niet');
  // De medewerker schrijft de rapportage.
  t.reg.report_comment = 'Overleg gehad';
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
  (await wachtOp(() => t.knop(/^Nee$/))).click();
  await wachtOp(() => /Totale reistijd/.test(t.tekst()));
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [55, 0]);
  (await wachtOp(() => t.knop(/^25 min\.?$/))).click();
  await wachtOp(() => t.reg.travel_time_before === '13');
  assert.deepEqual([t.reg.travel_time_before, t.reg.travel_time_after], ['13', '12'], 'zoals ONS: reistijd als tekst');
  const stappen = t.ontvangen().map(([soort, x]) => (soort === 'klik' ? 'klik' : soort === 'registration' && 'travel_time_before' in x ? 'reistijd' : null)).filter(Boolean);
  assert.deepEqual(stappen, ['klik', 'reistijd'], 'eerst + Reistijd van ONS (dan staan de velden in beeld), dan de waarden');
  assert.ok(t.$('[data-qa="travel-before"]') && !t.$('[data-qa="add-travel-times"]'), 'de reistijdvelden staan in beeld');
  (await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Behandeling \(GGZ 18\+\)$/))).click();
  await wachtOp(() => t.paneel().querySelector('[data-registratievenster-indienen]'));
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1145' });
  assert.equal(t.reg.report_comment, null, 'Huisbezoek heeft geen aanhef: de rapportage blijft leeg');
});

test('tegen-tijd kiezen: de gekozen minuten indirect, de rest direct; een aanhef komt in de lege rapportage', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^Verslaglegging/))).click();
  await wachtOp(() => /Directe tijd aanwezig/.test(t.tekst()));
  (await wachtOp(() => t.knop(/^Ja$/))).click();
  await wachtOp(() => /Duur directe tijd/.test(t.tekst()));
  (await wachtOp(() => t.knop(/^0:15$|^15 min\.?$/))).click(); // de kiezer komt net na de titel
  await wachtOp(() => t.reg.indirect_time === 40);
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [15, 40]);
  await wachtOp(() => t.reg.report_comment === 'Verslag:');
  assert.equal(t.reg.report_comment, 'Verslag:', 'de aanhef staat in de rapportage, via het veld zoals ONS het doorgeeft');
  (await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Behandeling \(GGZ 18\+\)$/))).click();
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.match(t.tekst(), /Schrijf eerst de rapportage/, 'alleen de aanhef telt niet als rapportage');
});

test('No show: eindtijd begintijd plus 1 minuut, 1 minuut direct, no-show bij elke cliënt; de rapportage hoeft dan niet', async () => {
  const t = opzet({ uursoort: { id: 77 } });
  (await wachtOp(() => t.knop(/^No show/))).click();
  await wachtOp(() => t.reg.client_declarations.every((c) => c.no_show === true) && t.reg.direct_time === 1);
  assert.deepEqual(t.reg.client_declarations.map((c) => c.no_show), [true, true]);
  assert.equal(Object.prototype.toString.call(t.reg.end_time), '[object Date]', 'eindtijd als Date, zoals ONS hem doorgeeft');
  assert.equal(t.reg.end_time.getHours() + ':' + t.reg.end_time.getMinutes(), '13:6', '13:05 plus 1 minuut');
  assert.deepEqual([t.reg.direct_time, t.reg.indirect_time], [1, 0]);
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

test('staan de reistijdvelden al in beeld, dan klikt de hulp + Reistijd niet (dat zou ze weer kunnen verbergen)', async () => {
  const t = opzet({ labels: ['Huisbezoek'] });
  t.$('[data-qa="add-travel-times"]').insertAdjacentHTML('afterend', '<input data-qa="travel-before"><input data-qa="travel-after">');
  await wachtOp(() => /Indirecte tijd aanwezig/.test(t.tekst()));
  (await wachtOp(() => t.knop(/^Nee$/))).click();
  (await wachtOp(() => t.knop(/^10 min\.?$/))).click();
  await wachtOp(() => t.reg.travel_time_before === '5');
  assert.deepEqual([t.reg.travel_time_before, t.reg.travel_time_after], ['5', '5']);
  assert.ok(!t.ontvangen().some(([soort]) => soort === 'klik'), 'geen klik op + Reistijd');
});

test('reistijd 0: niets uitklappen', async () => {
  const t = opzet({ labels: ['Huisbezoek'], registratieUursoort: { external_id: '1145' } });
  await wachtOp(() => /Indirecte tijd aanwezig/.test(t.tekst()));
  (await wachtOp(() => t.knop(/^Nee$/))).click();
  (await wachtOp(() => t.knop(/^0 min\.?$/))).click();
  await wachtOp(() => t.paneel().querySelector('[data-registratievenster-indienen]'));
  assert.ok(!t.ontvangen().some(([soort]) => soort === 'klik'), 'de knop + Reistijd blijft dicht');
  assert.ok(t.$('[data-qa="add-travel-times"]'));
});

test('uursoort van de vorm: op naam gevonden in de lijst van het uursoortveld en gezet zoals dat veld; de controle is tevreden', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^Diagnostiek/))).click();
  await wachtOp(() => t.reg.hour_type);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1146' });
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.doesNotMatch(t.tekst(), /Kies de uursoort|Kies uursoort/, 'niet meer gevraagd');
});

test('lijst nog niet geladen bij het kiezen: Kies uursoort wacht erop; zodra ONS hem ophaalde, eerst de uursoort van de vorm (één keer)', async () => {
  const t = opzet({ uursoorten: false });
  (await wachtOp(() => t.knop(/^Diagnostiek/))).click();
  await wachtOp(() => /Kies uursoort/.test(t.tekst()), 3000);
  assert.equal(t.reg.hour_type, undefined, 'nog niets gezet');
  await t.laadUursoorten();
  await wachtOp(() => t.reg.hour_type, 3000);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1146' });
  // Kiest de medewerker daarna zelf een andere, dan blijft die staan.
  t.reg.hour_type = { external_id: '1145' };
  await tick(1300);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1145' });
});

test('uursoort van de vorm niet in de lijst: niets gezet, de medewerker kiest zelf', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^Overleg/))).click();
  await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Detachering$/), 3000);
  assert.equal(t.reg.hour_type, undefined);
  assert.ok(!t.ontvangen().some(([, x]) => x && 'hour_type' in x), 'niets gezet; de medewerker kiest in de lijst');
});

test('staat de uursoort er al (bijvoorbeeld uit de afspraak), dan geen Kies uursoort', async () => {
  const t = opzet({ registratieUursoort: { external_id: '1145' } });
  (await wachtOp(() => t.knop(/^MDO/))).click();
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.doesNotMatch(t.tekst(), /Kies uursoort|Kies de uursoort/);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1145' }, 'niet aangeraakt');
});

test('kiest de medewerker de uursoort in ONS zelf terwijl Kies uursoort openstaat, dan door naar de rapportage', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^MDO/))).click();
  await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Detachering$/));
  t.reg.hour_type = { external_id: '1089' }; // zoals ONS hem zet na een keuze in het uursoortveld
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.doesNotMatch(t.tekst(), /Kies uursoort|Kies de uursoort/);
});

test('nog geen cliënt: bovenaan Cliënt toevoegen, dat + Toevoegen van ONS klikt; met een cliënt verdwijnt de knop', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^Cliënt toevoegen$/))).click();
  assert.equal(t.toegevoegd(), 1, 'de knop Toevoegen bij Cliënten in het venster is geklikt');
  t.$('#rapport').insertAdjacentHTML('beforeend', '<div data-qa="client-declaration-0"></div>');
  await wachtOp(() => !t.knop(/^Cliënt toevoegen$/), 3000);
  assert.ok(!t.knop(/^Cliënt toevoegen$/));
  assert.ok(t.knop(/^MDO/), 'de vormen blijven');
});

test('uursoort kiezen loopt via het veld zelf (keuzelijst openen, optie kiezen), zodat het veld hem ook toont', async () => {
  const t = opzet({ metKeuzelijst: true });
  (await wachtOp(() => t.knop(/^MDO/))).click();
  (await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Diagnostiek \(GGZ 18\+\)$/))).click();
  await wachtOp(() => t.reg.hour_type, 6000);
  assert.deepEqual(t.gekozenInVeld(), ['Diagnostiek (GGZ 18+)'], 'de optie in het uursoortveld zelf gekozen');
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1146' });
  await wachtOp(() => /Schrijf eerst de rapportage/.test(t.tekst()), 3000);
  assert.doesNotMatch(t.tekst(), /toont hem nog niet/);
});

test('zonder keuzelijst in het veld: de uursoort via de koppeling, met de melding dat het veld hem nog niet toont', async () => {
  const t = opzet();
  (await wachtOp(() => t.knop(/^MDO/))).click();
  (await wachtOp(() => /Kies uursoort/.test(t.tekst()) && t.knop(/^Diagnostiek \(GGZ 18\+\)$/))).click();
  await wachtOp(() => t.reg.hour_type);
  assert.deepEqual(JSON.parse(JSON.stringify(t.reg.hour_type)), { external_id: '1146' });
  await wachtOp(() => /toont hem nog niet/.test(t.tekst()), 3000);
  assert.match(t.tekst(), /gezet, het veld Uursoort toont hem nog niet/);
});

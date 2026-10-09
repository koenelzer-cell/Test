// Rooktests voor de onderdelen buiten het content-script: de service worker,
// de popup en het zijpaneel. Ze laden de GEBOUWDE bestanden (dist/) met een
// nagebootste chrome-API en controleren de afspraken tussen de onderdelen:
// welke berichten er bestaan, wat er wordt opgeslagen en wat er getekend wordt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Minimale chrome-API die luisteraars en opslag bijhoudt.
function fakeChrome() {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { (listeners[name] = listeners[name] || []).push(fn); } });
  const store = { local: {}, sync: {}, managed: {} };
  const area = (name) => ({
    get: (keys, cb) => {
      const s = store[name];
      if (keys == null) return cb({ ...s });
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {}; list.forEach((k) => { if (k in s) out[k] = s[k]; });
      cb(out);
    },
    set: (obj, cb) => { Object.assign(store[name], obj); if (cb) cb(); },
  });
  const calls = { badge: [], menus: [], sent: [], alarms: [] };
  const chrome = {
    runtime: {
      id: 'test', lastError: undefined,
      getURL: (p) => 'chrome-extension://test/' + p,
      getManifest: () => ({ version: '0.0.0' }),
      onMessage: on('runtime.onMessage'), onConnect: on('runtime.onConnect'),
      onInstalled: on('runtime.onInstalled'), onStartup: on('runtime.onStartup'),
      sendMessage: (msg, cb) => { calls.sent.push(msg); if (cb) cb(null); },
      connect: () => ({}),
    },
    storage: { local: area('local'), sync: area('sync'), managed: area('managed'), onChanged: on('storage.onChanged') },
    action: { setBadgeBackgroundColor: () => {}, setBadgeText: (o) => calls.badge.push(o) },
    contextMenus: { removeAll: (cb) => { calls.menus.length = 0; cb(); }, create: (o) => calls.menus.push(o), onClicked: on('contextMenus.onClicked') },
    alarms: { clear: () => {}, create: (n, o) => calls.alarms.push({ n, o }), onAlarm: on('alarms.onAlarm') },
    notifications: { create: () => {}, clear: () => {}, onClicked: on('notifications.onClicked') },
    tabs: {
      query: (q, cb) => cb([]), sendMessage: (id, msg, cb) => { calls.sent.push({ tab: id, msg }); if (cb) cb(null); },
      update: () => {}, onActivated: on('tabs.onActivated'), onUpdated: on('tabs.onUpdated'),
    },
    windows: { onFocusChanged: on('windows.onFocusChanged') },
    sidePanel: { open: () => Promise.resolve() },
  };
  return { chrome, listeners, store, calls };
}

// Stuur een bericht naar de geregistreerde onMessage-luisteraars; wacht op een
// eventueel asynchroon antwoord.
function send(listeners, msg, sender = { tab: { id: 7 } }) {
  return new Promise((resolve) => {
    let answered = false;
    const reply = (r) => { answered = true; resolve(r); };
    const async = (listeners['runtime.onMessage'] || []).map((fn) => fn(msg, sender, reply)).some((r) => r === true);
    if (!async && !answered) setTimeout(() => resolve(undefined), 0);
  });
}
const tick = () => new Promise((r) => setTimeout(r, 10));

function loadWorker() {
  const env = fakeChrome();
  const ctx = vm.createContext({ chrome: env.chrome, setTimeout, clearTimeout, console, Date, Promise, JSON, Math, Object, Array, String, Number, isFinite, parseInt });
  vm.runInContext(read('dist/background.js'), ctx);
  return env;
}

test('service worker: badge-bericht zet het getal op het icoon van dat tabblad', async () => {
  const { listeners, calls } = loadWorker();
  await send(listeners, { type: 'badge', count: 3 });
  assert.deepEqual({ ...calls.badge.at(-1) }, { text: '3', tabId: 7 });
  await send(listeners, { type: 'badge', count: 0 });
  assert.equal(calls.badge.at(-1).text, '');
});

test('service worker: momentopname bewaart alleen getallen en datums', async () => {
  const { listeners, store } = loadWorker();
  await send(listeners, { type: 'summary', openDays: 2, openMinutes: 95.4, naam: 'Jan Jansen', days: [{ date: '2026-09-01', client: 30, titel: 'x' }, { date: 'geen datum' }] });
  await tick();
  const snap = store.local['onsHelper.snapshot'];
  assert.equal(snap.openDays, 2);
  assert.equal(snap.openMinutes, 95);
  assert.equal(snap.days.length, 1, 'een dag zonder geldige datum hoort te vervallen');
  assert.ok(!JSON.stringify(snap).includes('Jan'), 'onbekende velden (zoals een naam) horen niet opgeslagen te worden');
});

test('service worker: registratievormen worden het rechtermuismenu', async () => {
  const { listeners, store, calls } = loadWorker();
  await send(listeners, { type: 'forms', forms: ['Huisbezoek', 'MDO'] });
  await tick();
  assert.deepEqual(Array.from(store.local['onsHelper.forms']), ['Huisbezoek', 'MDO']);
  const titels = calls.menus.map((m) => m.title);
  assert.deepEqual(titels, ['Registreren als…', 'Huisbezoek', 'MDO', 'Agendahulp in zijpaneel']);
});

test('service worker: herinnering staat standaard uit en is aan te zetten', async () => {
  const { listeners, store, calls } = loadWorker();
  const start = await send(listeners, { type: 'reminder-get' });
  assert.equal(start.settings.enabled, false);
  const res = await send(listeners, { type: 'reminder-settings', enabled: true, hour: 99 });
  assert.equal(res.ok, true);
  assert.equal(res.settings.enabled, true);
  assert.equal(res.settings.hour, 15, 'een ongeldig uur hoort genegeerd te worden');
  assert.equal(store.local['onsHelper.reminders'].enabled, true);
  await tick();
  assert.ok(calls.alarms.length >= 1, 'de wekker hoort gezet te worden');
});

test('service worker: zonder open zijpaneel is het antwoord "dicht"', async () => {
  const { listeners } = loadWorker();
  assert.deepEqual({ ...(await send(listeners, { type: 'sidepanel-query' })) }, { open: false });
});

function loadPage(htmlFile, scriptFile, setup) {
  const html = read(htmlFile).replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://test/' + htmlFile });
  const env = fakeChrome();
  if (setup) setup(env);
  dom.window.chrome = env.chrome;
  dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(read('config.json'))) });
  dom.window.eval(read(scriptFile));
  return { dom, env, document: dom.window.document };
}

test('popup: toont de bedrijfsonderdelen uit config.json', async () => {
  const { document } = loadPage('pages/popup.html', 'dist/popup.js');
  await tick(); await tick();
  const knoppen = Array.from(document.querySelectorAll('button.choice'), (b) => b.textContent);
  const cfg = JSON.parse(read('config.json'));
  const sectoren = [...new Set(Object.values(cfg.profileSectors))];
  assert.deepEqual(knoppen, sectoren);
  assert.ok(document.body.textContent.includes('Probleem melden via TOPdesk'));
});

test('popup: een team kiezen bewaart sector en team in sync', async () => {
  const { document, env } = loadPage('pages/popup.html', 'dist/popup.js');
  await tick(); await tick();
  const cfg = JSON.parse(read('config.json'));
  const [team, sector] = Object.entries(cfg.profileSectors)[0];
  [...document.querySelectorAll('button.choice')].find((b) => b.textContent === sector).click();
  await tick();
  const teamKnop = [...document.querySelectorAll('button.choice')].find((b) => b.textContent === team);
  if (teamKnop) teamKnop.click();
  await tick();
  assert.equal(env.store.sync.sector, sector);
  assert.equal(env.store.sync.colorProfile, team);
});

test('zijpaneel: zonder ONS-tabblad een duidelijke melding', async () => {
  const { document } = loadPage('pages/sidepanel.html', 'dist/sidepanel.js');
  await tick();
  assert.match(document.body.textContent, /Geen ONS-scherm open/);
});

test('zijpaneel: toont de vragenlijst als het tabblad die meldt', async () => {
  const { document } = loadPage('pages/sidepanel.html', 'dist/sidepanel.js', (env) => {
    env.chrome.tabs.query = (q, cb) => cb([{ id: 5, active: true, url: 'https://impegno.ons-dossier.nl/x' }]);
    env.chrome.tabs.sendMessage = (id, msg, cb) => {
      if (msg.type === 'survey-get-state') cb({ state: { title: 'Vragenlijst', items: [], signalen: [] } });
      else if (cb) cb(null);
    };
  });
  await tick();
  assert.doesNotMatch(document.body.textContent, /Geen ONS-scherm open/);
});

// Regressie: createAgendaPanel werd gebruikt zonder import, waardoor het
// zijpaneel op de agenda leeg bleef.
const AGENDA_STATE = { enabled: true, profileLabel: null, view: 'week', past: {}, future: { client: 0, overig: 0 }, windowStatus: {}, unfinished: [], legend: [], windowLabel: '', version: '1', week: null, weekError: '', weekLoading: false };

function zijpaneelMetAgenda(extra) {
  return loadPage('pages/sidepanel.html', 'dist/sidepanel.js', (env) => {
    env.chrome.tabs.query = (q, cb) => cb([{ id: 5, active: true, windowId: 1, url: 'https://impegno.onsagenda.nl/invitees/1' }]);
    env.chrome.tabs.sendMessage = (id, msg, cb) => {
      if (msg.type === 'ag-get-state') cb({ state: AGENDA_STATE });
      else if (cb) cb(null);
    };
    env.chrome.windows.getCurrent = (cb) => cb({ id: 1 });
    if (extra) extra(env);
  });
}

test('zijpaneel: toont de Agendahulp als het tabblad op de agenda staat', async () => {
  const { document } = zijpaneelMetAgenda();
  await tick();
  assert.match(document.querySelector('#paneel').textContent, /Agendahulp/, 'het agendapaneel hoort getekend te zijn');
  assert.doesNotMatch(document.body.textContent, /Geen ONS-scherm open|Niets om te tonen|Kon het tabblad niet vinden/);
});

test('zijpaneel: blijft open bij een ander tabblad (melding) en staat er weer bij terugkeer in ONS', async () => {
  let gesloten = 0;
  const tabs = { 5: 'https://impegno.onsagenda.nl/invitees/1', 9: undefined };
  const { dom, env, document } = zijpaneelMetAgenda((e) => {
    e.chrome.tabs.get = (id, cb) => cb({ id, active: true, windowId: 1, url: tabs[id] });
  });
  dom.window.close = () => { gesloten++; };
  await tick();
  env.listeners['tabs.onActivated'][0]({ tabId: 9, windowId: 1 });
  await tick();
  assert.equal(gesloten, 0, 'ander tabblad: niet sluiten');
  assert.match(document.body.textContent, /Niet in ONS/);
  env.listeners['tabs.onActivated'][0]({ tabId: 5, windowId: 1 });
  await tick();
  assert.match(document.querySelector('#paneel').textContent, /Agendahulp/, 'terug in ONS: agendapaneel weer zichtbaar');
  assert.equal(gesloten, 0);
});

test('zijpaneel: ONS-scherm zonder agenda (afspraakformulier) sluit snel', async () => {
  let gesloten = 0;
  let opAgenda = true;
  const { dom, env } = zijpaneelMetAgenda((e) => {
    e.chrome.tabs.sendMessage = (id, msg, cb) => {
      if (msg.type === 'ag-get-state') cb({ state: opAgenda ? AGENDA_STATE : null });
      else if (cb) cb(undefined);
    };
  });
  dom.window.close = () => { gesloten++; };
  await tick();
  opAgenda = false;
  const tab = { id: 5, active: true, windowId: 1, url: 'https://impegno.onsagenda.nl/events/new?invitee_ids%5B%5D=1' };
  const t0 = Date.now();
  env.listeners['tabs.onUpdated'][0](5, { url: tab.url }, tab);
  while (!gesloten && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 50));
  assert.equal(gesloten, 1);
  assert.ok(Date.now() - t0 < 1800, 'binnen ~1,5 s dicht (was 5 s): ' + (Date.now() - t0) + ' ms');
});

test('zijpaneel: blijft open bij navigeren binnen de agenda, en negeert andere vensters', async () => {
  let gesloten = 0;
  const { dom, env } = zijpaneelMetAgenda();
  dom.window.close = () => { gesloten++; };
  await tick();
  const tab = { id: 5, active: true, windowId: 1, url: 'https://impegno.onsagenda.nl/invitees/1?date=2026-10-12' };
  env.listeners['tabs.onUpdated'][0](5, { url: tab.url }, tab);
  env.listeners['tabs.onUpdated'][0](8, { status: 'loading' }, { id: 8, active: true, windowId: 2 });
  await tick();
  // Het content-script meldt zijn toestand: het sluiten is van de baan.
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-state', state: AGENDA_STATE }, { tab }));
  await new Promise((r) => setTimeout(r, 5200));
  assert.equal(gesloten, 0);
});

test('service worker: zet het venster-brede zijpaneel aan bij het starten', () => {
  const env = fakeChrome();
  const opties = [];
  env.chrome.sidePanel.setOptions = (o) => { opties.push({ ...o }); return Promise.resolve(); };
  const ctx = vm.createContext({ chrome: env.chrome, setTimeout, clearTimeout, console, Date, Promise, JSON, Math, Object, Array, String, Number, isFinite, parseInt });
  vm.runInContext(read('dist/background.js'), ctx);
  assert.deepEqual(opties, [{ path: 'pages/sidepanel.html', enabled: true }], 'geen instellingen per tabblad meer');
  env.listeners['tabs.onUpdated'][0](3, { url: 'https://example.org/' }, { id: 3, url: undefined });
  assert.equal(opties.length, 1);
});

test('service worker: opent alleen https-adressen in een nieuw tabblad naast het huidige', async () => {
  const { listeners, chrome } = loadWorker();
  const gemaakt = [];
  chrome.tabs.create = (o, cb) => { gemaakt.push(o); cb({}); };
  const sender = { tab: { id: 7, index: 3, windowId: 2 } };
  assert.deepEqual({ ...(await send(listeners, { type: 'open-tab', url: 'https://login.afasonline.com/83031/Apps' }, sender)) }, { ok: true });
  assert.deepEqual({ ...gemaakt[0] }, { url: 'https://login.afasonline.com/83031/Apps', active: true, index: 4, windowId: 2 });
  assert.deepEqual({ ...(await send(listeners, { type: 'open-tab', url: 'javascript:alert(1)' }, sender)) }, { ok: false });
  assert.equal(gemaakt.length, 1);
});

/* ── Zijpaneel-pagina's en het randlipje ──────────────────────────────── */

const AGENDA_STATE_TOOLS = { ...AGENDA_STATE, rangeDefaultFrom: '2026-08-10', today: '2026-10-07' };
const knop = (document, tekst) => [...document.querySelectorAll('button')].find((b) => b.textContent === tekst);
const navKnop = (document, kop) => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith(kop));

// Een nieuwe toestand aan het zijpaneel geven (zoals het content-script doet).
let _laatsteEnv = null;
function env_update(document, state) {
  _laatsteEnv.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-state', state }, { tab: { id: 5 } }));
}

function zijpaneelMetTools(antwoord, state = AGENDA_STATE_TOOLS) {
  const verzonden = [];
  const r = loadPage('pages/sidepanel.html', 'dist/sidepanel.js', (env) => {
    env.chrome.tabs.query = (q, cb) => cb([{ id: 5, active: true, windowId: 1, url: 'https://impegno.onsagenda.nl/invitees/1' }]);
    env.chrome.tabs.sendMessage = (id, msg, cb) => {
      verzonden.push(msg);
      if (msg.type === 'ag-get-state') cb({ state });
      else if (antwoord && antwoord[msg.type]) antwoord[msg.type](msg, cb);
      else if (cb) cb(null);
    };
    env.chrome.windows.getCurrent = (cb) => cb({ id: 1 });
    _laatsteEnv = env;
  });
  return { ...r, verzonden };
}

const zichtbaar = (node) => { for (let n = node; n; n = n.parentElement) if (n.style && n.style.display === 'none') return false; return true; };
const RESULT = (items) => ({ from: '2026-08-10', to: '2026-10-07', totalMinutes: 0, totalCount: items.length, lateCount: 0,
  days: items.length ? [{ date: '2026-10-05', client: 0, overig: 0, count: items.length, lateCount: 0, items }] : [] });
const ITEM_A = { key: 'a|2026-10-05|1', start: Date.parse('2026-10-05T09:00:00'), minutes: 60, client: true, uursoort: 'JG Huisbezoek', late: true };
const ITEM_B = { key: 'b|2026-10-05|2', start: Date.parse('2026-10-05T11:00:00'), minutes: 30, client: false, uursoort: 'Overleg *', late: false };

test('zijpaneel: geen "ongeregistreerde tijd per dag", geen teller en geen "Bekijk declarabiliteit"', async () => {
  const state = { ...AGENDA_STATE_TOOLS, past: { '2026-10-05': { client: 60, overig: 0, lateMin: 0, lateCount: 0 } } };
  const { document } = zijpaneelMetTools(null, state);
  await tick();
  assert.doesNotMatch(document.body.textContent, /Ongeregistreerde tijd per dag/);
  assert.doesNotMatch(document.body.textContent, /volgens ONS/);
  assert.doesNotMatch(document.body.textContent, /Bekijk declarabiliteit/);
});

test('zijpaneel: zonder weekoverzicht nooit een leeg vak', async () => {
  const { document } = zijpaneelMetTools(null, { ...AGENDA_STATE_TOOLS, week: null, weekLoading: false });
  await tick();
  assert.match(document.body.textContent, /Weekoverzicht/);
  assert.match(document.body.textContent, /Wordt opgehaald zodra de agenda/);
});

test('zijpaneel: de knoppen naar de pagina\'s staan onder het weekoverzicht', async () => {
  const { document } = zijpaneelMetTools();
  await tick();
  const knoppen = ['Verhouding per uursoort', 'Open registraties', 'Snel registreren', 'Planhulp'].map((k) => navKnop(document, k));
  assert.ok(knoppen.every(Boolean), 'drie knoppen');
  const navBox = knoppen[0].parentElement;
  assert.equal(navBox.previousElementSibling.children.length, 2, 'direct erboven staat het weekoverzicht (laadstrook + overzicht)');
});

test('zijpaneel: open registraties is een eigen pagina met terug-knop', async () => {
  let opgevangen;
  const { document, env, verzonden } = zijpaneelMetTools({
    'ag-check-range': (msg, cb) => { opgevangen = cb; },
  });
  await tick();
  navKnop(document, 'Open registraties').click();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Open registraties', 'paginatitel');
  assert.equal(zichtbaar(navKnop(document, 'Snel registreren')), false, 'hoofdpagina is verborgen');
  assert.equal(zichtbaar(knop(document, 'Verlof aanvragen')), false);
  const datums = [...document.querySelectorAll('[data-datum]')].map((i) => i.getAttribute('data-datum'));
  assert.deepEqual(datums, ['2026-08-10', '2026-10-07'], 'standaard: begin aanpasvenster t/m vandaag');
  assert.match(document.body.textContent, /ma 10 aug 2026/, 'datum voluit in het veld');
  assert.equal(document.querySelectorAll('input[type="date"]').length, 0, 'geen keuzevenster van de browser');
  // De controle start vanzelf bij het openen (vooraf geladen = meteen klaar).
  const vraag = verzonden.find((m) => m.type === 'ag-check-range');
  assert.deepEqual({ from: vraag.from, to: vraag.to }, { from: '2026-08-10', to: '2026-10-07' });
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-range-progress', kind: 'open', done: 2, total: 9 }, { tab: { id: 5 } }));
  assert.match(document.body.textContent, /Week 2 van 9 opgehaald/);
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-state', state: AGENDA_STATE_TOOLS }, { tab: { id: 5 } }));
  assert.match(document.body.textContent, /Week 2 van 9 opgehaald/, 'een pagina-update laat de pagina staan');
  opgevangen({ ok: true, result: RESULT([ITEM_A, ITEM_B]) });
  assert.match(document.body.textContent, /2 afspraken open · 1 u 30 m/);
  assert.match(document.body.textContent, /0 van 2/);
  [...document.querySelectorAll('[role="button"]')].find((d) => d.title === 'Klik om naar deze dag te gaan').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-jump-day', date: '2026-10-05', always: true });
  knop(document, 'Terug').click();
  assert.equal(zichtbaar(navKnop(document, 'Snel registreren')), true);
  assert.equal(zichtbaar(knop(document, 'Verlof aanvragen')), true);
});

test('zijpaneel: open registraties wordt een afwerklijst, ook na een paginawissel in ONS', async () => {
  let controles = 0;
  const { document, env, dom } = zijpaneelMetTools({
    'ag-check-range': (msg, cb) => { controles++; cb({ ok: true, result: RESULT(controles === 1 ? [ITEM_A, ITEM_B] : [ITEM_B]) }); },
  });
  await tick();
  navKnop(document, 'Open registraties').click();
  assert.match(document.body.textContent, /0 van 2/, 'start vanzelf bij het openen');
  // Naar een registratieformulier: de agenda is even weg, het paneel wordt opnieuw opgebouwd.
  const tab = { id: 5, url: 'https://impegno.onsagenda.nl/invitees/1/registrations/new' };
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-gone' }, { tab }));
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-state', state: AGENDA_STATE_TOOLS }, { tab }));
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Open registraties', 'terug op dezelfde pagina');
  assert.equal(controles, 2, 'meteen opnieuw gecontroleerd');
  assert.match(document.body.textContent, /1 van 2/);
  assert.match(document.body.textContent, /1 afspraak open · 30 m/);
  assert.equal(document.querySelectorAll('[data-afgewerkt]').length, 1, 'de geregistreerde afspraak is afgevinkt');
  // Terug in het zijpaneel (focus) werkt de lijst ook bij, hooguit eens per paar seconden.
  dom.window.dispatchEvent(new dom.window.Event('focus'));
  assert.equal(controles, 2);
});

test('zijpaneel: cliënttijd is een pagina met opbouw en productieverloop (lijngrafiek direct en indirect)', async () => {
  const weken = [40, 41, 42].map((w, i) => ({ planned: i === 2, week: w, weekStart: i ? '2026-10-05' : '2026-09-28', directMinutes: 600 + i * 60, indirectMinutes: 120, travelMinutes: 30, clientMinutes: 800, nonClientMinutes: 0, totalMinutes: 800, declarabelPct: 100, count: 3 }));
  const state = { ...AGENDA_STATE_TOOLS, productionDefaultFrom: '2026-08-19', week: {
    summary: { clientMinutes: 690, nonClientMinutes: 5, totalMinutes: 695, directMinutes: 480, indirectMinutes: 150, travelMinutes: 60, unknownMinutes: 5, byType: [] },
    opts: { week: 41, embedded: true, scope: 'week' }, clientRows: [{ type: 'JW GGZ', minutes: 690, direct: 480, indirect: 150, travel: 60 }], overigRows: [] } };
  const { document, verzonden } = zijpaneelMetTools({ 'ag-production': (msg, cb) => cb({ ok: true, result: { from: msg.from, to: msg.to, weeks: weken } }) }, state);
  // De React-bundel tekent het weekoverzicht en de opbouw.
  document.defaultView.eval(read('dist/react-bundle.js'));
  env_update(document, state);
  await tick();
  document.querySelector('[data-ons-week-panel] [role="button"]').click();
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Cliënttijd');
  assert.match(document.body.textContent, /Opbouw week 41/);
  assert.match(document.body.textContent, /Direct8 u/);
  knop(document, 'Productieverloop berekenen').click();
  assert.deepEqual({ from: verzonden.at(-1).from, to: verzonden.at(-1).to }, { from: '2026-08-19', to: '2026-11-04' }, 'standaard vier weken vooruit');
  const svg = document.querySelector('svg[role="img"]');
  assert.ok(svg, 'grafiek getekend');
  assert.equal(svg.querySelectorAll('path[stroke="#2a78d6"]').length, 2, 'lijn direct');
  assert.equal(svg.querySelectorAll('path[stroke="#cc087d"]').length, 2, 'lijn indirect');
  assert.equal(svg.querySelectorAll('path[stroke="#1baf7a"]').length, 2, 'lijn reistijd: geregistreerd + gepland');
  assert.equal(svg.querySelectorAll('path[data-gepland]').length, 3, 'geplande weken gestippeld');
  assert.match(document.body.textContent, /gepland/);
  assert.equal(svg.querySelectorAll('rect').length, 3, 'geen staven; alleen hover-vlakken per week');
  assert.match(document.body.textContent, /DirectIndirectReistijd/, 'legenda');
  assert.equal(document.querySelector('table'), null, 'tabel standaard ingeklapt');
  knop(document, 'Tabel tonen').click();
  assert.match(document.body.textContent, /42gepland12 u2 u30 m13 u 20 m4111 u2 u30 m13 u 20 m/, 'tabel met dezelfde getallen, nieuwste week bovenaan');
  assert.ok(knop(document, 'Tabel verbergen'));
});

test('zijpaneel: verhouding per uursoort is een pagina waarin je per week kunt bladeren', async () => {
  const state = { ...AGENDA_STATE_TOOLS, nonClientMarker: '*', viewDate: '2026-10-07', week: {
    summary: { clientMinutes: 690, byType: [] }, opts: { week: 41, embedded: true, scope: 'week' }, clientRows: [], overigRows: [] } };
  const gevraagd = [];
  const { document, verzonden } = zijpaneelMetTools({ 'ag-week-ratio': (msg, cb) => {
    gevraagd.push(msg.date);
    const toekomst = msg.date > '2026-10-11';
    cb({ ok: true, result: { weekStart: toekomst ? '2026-10-12' : '2026-10-05', week: toekomst ? 42 : 41, mode: toekomst ? 'gepland' : 'geregistreerd',
      rows: [{ type: 'JW GGZ', minutes: 700, direct: 480, indirect: 150, travel: 60, other: 10 }] } });
  } }, state);
  document.defaultView.eval(read('dist/react-bundle.js'));
  env_update(document, state);
  await tick();
  navKnop(document, 'Verhouding per uursoort').click();
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Verhouding per uursoort');
  assert.deepEqual(gevraagd, ['2026-10-07'], 'begint bij de bekeken week');
  assert.match(document.body.textContent, /Week 41geregistreerd/);
  assert.match(document.body.textContent, /JW GGZ11 u 40 m/, 'totaal = direct + indirect + reistijd + overig');
  assert.match(document.body.textContent, /Overig10 m · 1%/);
  document.querySelector('button[aria-label="Volgende week"]').click();
  await tick();
  assert.equal(gevraagd.at(-1), '2026-10-14');
  assert.match(document.body.textContent, /Week 42gepland/);
  assert.match(document.body.textContent, /zonder label maar met een cliënt telt de afspraak als direct/);
  assert.equal(knop(document, 'Naar de bekeken week'), undefined);
  document.querySelector('button[aria-label="Vorige week"]').click();
  document.querySelector('button[aria-label="Vorige week"]').click();
  assert.equal(gevraagd.at(-1), '2026-09-30');
  assert.ok(!verzonden.some((m) => /open-(breakdown|calc)/.test(m.type)), 'geen dialoog meer in de ONS-pagina');
});

test('zijpaneel: afwerklijst werkt zichzelf bij als de agenda verandert', async () => {
  let controles = 0;
  const { document } = zijpaneelMetTools({
    'ag-check-range': (msg, cb) => { controles++; cb({ ok: true, result: RESULT(controles === 1 ? [ITEM_A, ITEM_B] : [ITEM_B]) }); },
  });
  await tick();
  navKnop(document, 'Open registraties').click();
  await new Promise((r) => setTimeout(r, 3100)); // niet vaker dan eens per paar seconden
  // ONS markeert een afspraak als geregistreerd: de toestand van de pagina verandert.
  env_update(document, { ...AGENDA_STATE_TOOLS, past: { '2026-10-05': { client: 30, overig: 0, lateMin: 0, lateCount: 0 } } });
  env_update(document, { ...AGENDA_STATE_TOOLS, past: { '2026-10-05': { client: 0, overig: 0, lateMin: 0, lateCount: 0 } } });
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(controles, 2, 'zonder klikken bijgewerkt');
  assert.match(document.body.textContent, /1 van 2/);
});

test('zijpaneel: een andere medewerker in de URL begint opnieuw', async () => {
  let controles = 0;
  const { document } = zijpaneelMetTools({ 'ag-check-range': (msg, cb) => { controles++; cb({ ok: true, result: RESULT(controles === 1 ? [ITEM_A] : []) }); } },
    { ...AGENDA_STATE_TOOLS, inviteeId: '1' });
  await tick();
  navKnop(document, 'Open registraties').click();
  assert.match(document.body.textContent, /1 afspraak open/);
  env_update(document, { ...AGENDA_STATE_TOOLS, inviteeId: '2' });
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Agendahulp', 'terug naar de hoofdpagina');
  navKnop(document, 'Open registraties').click();
  assert.equal(controles, 2, 'opnieuw gecontroleerd voor de nieuwe medewerker');
  assert.doesNotMatch(document.body.textContent, /1 afspraak open/, 'geen resultaten van de vorige medewerker');
});

test('zijpaneel: het weekoverzicht toont geen lijst per uursoort meer (staat op Verhouding)', async () => {
  const state = { ...AGENDA_STATE_TOOLS, week: { summary: { clientMinutes: 690, nonClientMinutes: 5, totalMinutes: 695, byType: [] },
    opts: { week: 41, embedded: true, scope: 'week', perLabel: 'Per uursoort' }, clientRows: [{ type: 'JW GGZ', minutes: 690 }], overigRows: [{ type: 'Overleg *', minutes: 5 }] } };
  const { document } = zijpaneelMetTools(null, state);
  document.defaultView.eval(read('dist/react-bundle.js'));
  env_update(document, state);
  await tick();
  assert.match(document.body.textContent, /Totaal 11 u 35 m/);
  assert.doesNotMatch(document.body.textContent, /Per uursoort|Overig \(/);
});

test('zijpaneel: controle zonder open afspraken meldt dat alles geregistreerd is', async () => {
  const { document } = zijpaneelMetTools({ 'ag-check-range': (msg, cb) => cb({ ok: true, result: RESULT([]) }) });
  await tick();
  navKnop(document, 'Open registraties').click();
  knop(document, 'Controleren').click();
  assert.match(document.body.textContent, /Alles geregistreerd van/);
});

test('zijpaneel: datumkiezer in de stijl van de hulp', async () => {
  let gevraagd;
  const { document } = zijpaneelMetTools({ 'ag-check-range': (msg, cb) => { gevraagd = msg; cb({ ok: true, result: RESULT([]) }); } });
  await tick();
  navKnop(document, 'Open registraties').click();
  const veld = document.querySelector('[data-datum="2026-08-10"]');
  veld.click();
  assert.equal(veld.getAttribute('aria-expanded'), 'true');
  assert.match(document.body.textContent, /augustus 2026/);
  document.querySelector('[aria-label="Volgende maand"]').click();
  assert.match(document.body.textContent, /september 2026/);
  document.querySelector('[data-ymd="2026-09-14"]').click();
  assert.match(document.body.textContent, /ma 14 sep 2026/);
  assert.equal(document.querySelector('[role="dialog"]'), null, 'kiezer sluit na kiezen');
  knop(document, 'Controleren').click();
  assert.equal(gevraagd.from, '2026-09-14');
});

test('zijpaneel: verhouding toont een laadscherm met het juiste weeknummer', async () => {
  const state = { ...AGENDA_STATE_TOOLS, viewDate: '2026-10-07' };
  const { document } = zijpaneelMetTools({ 'ag-week-ratio': () => {} }, state);
  await tick();
  navKnop(document, 'Verhouding per uursoort').click();
  assert.match(document.body.textContent, /Week 41ophalen…/);
  assert.ok(document.querySelector('[role="progressbar"]'), 'laadbalk');
  document.querySelector('button[aria-label="Volgende week"]').click();
  assert.match(document.body.textContent, /Week 42ophalen…/, 'weeknummer klopt meteen, ook tijdens het laden');
});

test('zijpaneel: planhulp A - instellingen in één regel, per dag begintijden kiezen, ONS-controle, weekraster', async () => {
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, windowStart: 480, windowEnd: 1020, gaps: [
      { date: '2026-10-08', startMin: 630, endMin: 720, minutes: 90 },
    ] } }),
    'ag-new-event': (msg, cb) => cb({ ok: true }),
    'ag-slot-check': (msg, cb) => cb({ ok: true, status: 'ready', overlap: msg.startMin === 645 }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Planhulp');
  assert.match(document.body.textContent, /1 u · komende 2 weken/, 'instellingen in één regel');
  assert.equal(knop(document, '4 weken'), undefined, 'ingeklapt');
  document.querySelector('[data-plan-wijzig]').click();
  knop(document, '4 weken').click();
  await tick();
  assert.deepEqual({ minutes: verzonden.at(-1).minutes, weeks: verzonden.at(-1).weeks }, { minutes: 60, weeks: 4 }, 'wijzigen = meteen opnieuw zoeken');
  document.querySelector('[data-plan-wijzig]').click();
  assert.match(document.body.textContent, /do 8 okt10:30 – 12:00/);
  const starts = [...document.querySelectorAll('[data-dag="2026-10-08"][data-start]')].map((b) => b.getAttribute('data-start'));
  assert.deepEqual(starts, ['10:30', '10:45', '11:00'], 'alleen begintijden waarop 1 u nog past, zonder tussenpagina');
  assert.equal(document.querySelector('[data-selectie]'), null, 'nog niets gekozen: geen balk');
  document.querySelector('[data-start="10:45"]').click();
  assert.equal(document.querySelector('[data-start="10:45"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[data-selectie]').getAttribute('data-selectie'), '1');
  await tick();
  assert.match(document.body.textContent, /ONS meldt overlap op 10:45/);
  assert.ok(document.querySelector('[data-start="10:45"][data-ons-overlap]'));
  assert.deepEqual({ ...verzonden.find((m) => m.type === 'ag-slot-check' && m.startMin === 645) }, { type: 'ag-slot-check', date: '2026-10-08', startMin: 645, minutes: 60 });
  document.querySelector('[data-start="10:45"]').click();
  assert.equal(document.querySelector('[data-selectie]'), null, 'nog eens tikken: eruit');
  document.querySelector('[data-start="11:00"]').click();
  await tick();
  assert.doesNotMatch(document.body.textContent, /ONS meldt/, 'geen overlap: geen melding');
  knop(document, 'Naar dag').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-jump-day', date: '2026-10-08', always: true });
  // Weekraster: zelfde keuzes, tik in het groen.
  document.querySelector('[data-plan-weergave="raster"]').click();
  assert.ok(document.querySelector('[data-raster]'));
  assert.match(document.querySelector('[data-week-titel]').textContent, /^week 41 · 5 – 9 okt$/);
  assert.ok(document.querySelector('[data-raster-gekozen="2026-10-08 11:00"]'), 'gekozen moment roze in het raster');
  assert.ok(document.querySelector('[data-raster-vrij="10:30-12:00"]'));
  document.querySelector('[data-raster] [data-dag="2026-10-08"][data-start="10:30"]').click();
  assert.ok(document.querySelector('[data-raster-gekozen="2026-10-08 10:30"]'), 'overlappend moment vervangen');
  assert.equal(document.querySelector('[data-raster-gekozen="2026-10-08 11:00"]'), null);
  knop(document, 'Afspraak maken').click();
  assert.deepEqual(JSON.parse(JSON.stringify(verzonden.at(-1))), { type: 'ag-new-event', date: '2026-10-08', time: '10:30', minutes: 60, extra: [], eigen: [] });
});

test('zijpaneel: planhulp A - meerdere momenten, reserveringen (R), wissen in de balk, kopieën (zonder direct maken)', async () => {
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, to: '', gaps: [
      { date: '2026-10-08', startMin: 630, endMin: 720, minutes: 90 },
      { date: '2026-10-13', startMin: 480, endMin: 600, minutes: 120, reservations: [{ date: '2026-10-13', startMin: 480, endMin: 540, label: 'JG Verslaglegging' }] },
    ] } }),
    'ag-new-event': (msg, cb) => cb({ ok: true }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  const r = document.querySelector('[data-dag="2026-10-13"][data-start="08:00"]');
  assert.equal(r.getAttribute('data-reservering'), 'JG Verslaglegging', 'begintijd in een reservering krijgt R');
  assert.match(r.textContent, /08:00R/);
  assert.equal(document.querySelector('[data-dag="2026-10-13"][data-start="09:00"]').getAttribute('data-reservering'), null, '09:00 valt erbuiten');
  assert.match(document.body.textContent, /R = valt in een reservering/);
  const kies = (d, t) => document.querySelector('[data-dag="' + d + '"][data-start="' + t + '"]').click();
  kies('2026-10-08', '10:45'); kies('2026-10-08', '11:00');
  assert.deepEqual([...document.querySelectorAll('[data-dag="2026-10-08"][aria-pressed="true"]')].map((b) => b.getAttribute('data-start')), ['11:00'], 'overlappende momenten op dezelfde dag vervangen elkaar');
  kies('2026-10-08', '10:30');
  kies('2026-10-13', '09:00');
  const balk = document.querySelector('[data-selectie]');
  assert.equal(balk.getAttribute('data-selectie'), '2');
  assert.equal(knop(document, 'Alles wissen'), undefined, 'wissen pas na openklappen');
  document.querySelector('[data-teller]').click();
  assert.match(document.querySelector('[data-selectie]').textContent, /do 8 okt10:30 – 11:30.*di 13 okt09:00 – 10:00/s);
  assert.ok(knop(document, 'Alles wissen'));
  // Zonder direct maken: in de balk 'Apart formulier' (niet bij het eerste moment).
  assert.equal(document.querySelector('[data-eigen="2026-10-08 10:30"]'), null, 'eerste moment: geen vinkje');
  const vink = document.querySelector('[data-eigen="2026-10-13 09:00"]');
  vink.checked = true; vink.dispatchEvent(new document.defaultView.Event('change'));
  knop(document, 'Afspraak maken op 2 momenten').click();
  assert.deepEqual(JSON.parse(JSON.stringify(verzonden.at(-1))), { type: 'ag-new-event', date: '2026-10-08', time: '10:30', minutes: 60, extra: [], eigen: [{ date: '2026-10-13', time: '09:00' }] });
  _laatsteEnv.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'ag-duplicates-done', made: [{ date: '2026-10-13', startMin: 540 }], failed: [], reason: '' }, { tab: { id: 5 } }));
  assert.match(document.body.textContent, /Afspraak ook gemaakt op di 13 okt 09:00/);
  assert.equal(document.querySelector('[data-selectie]'), null, 'selectie leeg na gelukte kopieën');
});

test('zijpaneel: route van de dag - lijst op volgorde, adres onbekend gemeld, route openen', async () => {
  const geopend = [];
  const { document, verzonden, dom } = zijpaneelMetTools({
    'ag-day-route': (msg, cb) => cb({ ok: true, result: { date: msg.date, persons: [{ id: '1', name: '', missing: 1,
      stops: [{ start: '09:00', address: 'Teststraat 1, Stad' }, { start: '11:00', address: '' }, { start: '13:30', address: 'Laan 5, Stad' }],
      urls: ['https://www.google.com/maps/dir/?api=1&destination=Laan%205%2C%20Stad&waypoints=Teststraat%201%2C%20Stad&travelmode=driving'] }] } }),
  }, { ...AGENDA_STATE_TOOLS, viewDate: '2026-10-12' });
  dom.window.open = (u) => { geopend.push(u); };
  await tick();
  navKnop(document, 'Route van de dag').click();
  await tick();
  assert.deepEqual({ type: verzonden.at(-1).type, date: verzonden.at(-1).date }, { type: 'ag-day-route', date: '2026-10-12' }, 'start meteen voor de bekeken dag');
  assert.match(document.body.textContent, /09:00Teststraat 1, Stad.*11:00Adres onbekend.*13:30Laan 5, Stad/s);
  assert.match(document.body.textContent, /1 afspraak zonder adres staat niet in de route/);
  knop(document, 'Route openen in Google Maps').click();
  assert.match(geopend[0], /^https:\/\/www\.google\.com\/maps\/dir\//);
  const v = document.querySelector('[data-vertrekpunt]');
  v.value = 'Kantoor 1, Stad'; v.dispatchEvent(new dom.window.Event('change'));
  await tick();
  assert.equal(verzonden.at(-1).origin, 'Kantoor 1, Stad', 'vertrekpunt gaat mee en wordt onthouden');
});

test('zijpaneel: route van de dag staat uit als beheer hem uitzet', async () => {
  const { document } = zijpaneelMetTools({}, { ...AGENDA_STATE_TOOLS, routeEnabled: false });
  await tick();
  assert.equal(navKnop(document, 'Route van de dag'), undefined);
});

test('zijpaneel: geen melding "Gekleurde dagindeling staat aan", wel als hij uit staat', async () => {
  const { document } = zijpaneelMetTools({}, { ...AGENDA_STATE_TOOLS, enabled: true, profileLabel: 'JGGZ' });
  await tick();
  assert.doesNotMatch(document.body.textContent, /Gekleurde dagindeling staat aan/);
  const uit = zijpaneelMetTools({}, { ...AGENDA_STATE_TOOLS, enabled: false, profileLabel: 'JGGZ' });
  await tick();
  assert.match(uit.document.body.textContent, /Gekleurde dagindeling staat uit/);
});

test('zijpaneel: functies die beheer uitzet verdwijnen uit het zijpaneel', async () => {
  const features = { weekRatio: false, openRegistrations: false, quickRegister: true, planner: false, plannerCopies: true, plannerDistance: true, production: false, routeLink: false };
  const { document } = zijpaneelMetTools({}, { ...AGENDA_STATE_TOOLS, features });
  await tick();
  for (const uit of ['Verhouding per uursoort', 'Open registraties', 'Planhulp', 'Route van de dag']) assert.equal(navKnop(document, uit), undefined, uit);
  assert.ok(navKnop(document, 'Snel registreren'), 'wat aan staat blijft');
});

test('zijpaneel: planhulp zonder kopieën (beheer): één moment tegelijk', async () => {
  const { document } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [{ date: '2026-10-08', startMin: 630, endMin: 720, minutes: 90 }] } }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerCopies: false, plannerDistance: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  document.querySelector('[data-start="10:30"]').click();
  document.querySelector('[data-start="11:00"]').click();
  assert.equal(document.querySelector('[data-selectie]').getAttribute('data-selectie'), '1', 'kopieën uit: één moment tegelijk');
});

test('zijpaneel: route van de dag - kaart meteen zichtbaar, kortste volgorde via de eigen server', async () => {
  const geopend = [], proxy = [];
  const { document, dom } = zijpaneelMetTools({
    'ag-day-route': (msg, cb) => cb({ ok: true, result: { date: msg.date, persons: [{ id: '1', name: '', missing: 0,
      stops: [{ start: '09:00', address: 'Teststraat 1, 2611EB, Delft' }, { start: '11:00', address: 'Laan 5, 2613RR, Delft' }],
      urls: ['https://www.google.com/maps/dir/?api=1&destination=x'] }] } }),
  }, { ...AGENDA_STATE_TOOLS, viewDate: '2026-10-12', mapsEmbedKey: 'EMBEDSLEUTEL_alleen_embed_123', routesProxy: { url: 'https://proxy.example', token: 'geheim' } });
  dom.window.open = (u) => { geopend.push(u); };
  dom.window.fetch = (url, init) => { proxy.push({ url, init }); return Promise.resolve({ ok: true, json: () => Promise.resolve({ order: [1, 0], m: 24000, s: 1800 }) }); };
  await tick();
  navKnop(document, 'Route van de dag').click();
  await tick();
  const kaart = document.querySelector('[data-kaart]');
  assert.match(kaart.src, /^https:\/\/www\.google\.com\/maps\/embed\/v1\/directions\?key=EMBEDSLEUTEL_alleen_embed_123&origin=Teststraat/);
  assert.match(document.body.textContent, /Vul een vertrekpunt met postcode in voor de kortste volgorde/);
  const v = document.querySelector('[data-vertrekpunt]');
  v.value = 'Hoge Mosten 58, 4822 NH Breda'; v.dispatchEvent(new dom.window.Event('change'));
  await tick();
  knop(document, 'Kortste volgorde berekenen').click();
  await tick();
  assert.equal(proxy[0].url, 'https://proxy.example/optimize');
  assert.equal(proxy[0].init.headers['X-Agendahulp-Token'], 'geheim');
  assert.deepEqual(JSON.parse(proxy[0].init.body), { origin: '4822NH', stops: ['2611EB', '2613RR'] }, 'alleen postcodes naar de server');
  assert.equal(document.querySelector('[data-kortste]').getAttribute('data-kortste'), '11:00 → 09:00');
  assert.match(document.body.textContent, /Kortste rondrit: ≈ 24 km · 30 min/);
  assert.match(document.querySelector('[data-kaart]').src, /origin=Hoge%20Mosten.*destination=Teststraat/, 'kaart volgt de kortste volgorde');
  knop(document, 'Kortste volgorde openen in Google Maps').click();
  assert.match(geopend.at(-1), /origin=Hoge%20Mosten.*destination=Hoge%20Mosten.*waypoints=Laan/, 'rondrit, kortste volgorde');
});

test('zijpaneel: zonder server - kortste volgorde rechtstreeks via Google Routes (alleen postcodes)', async () => {
  const google = [];
  const { document, dom } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [{ date: '2026-10-12', startMin: 600, endMin: 720, minutes: 120 }],
      visits: { '2026-10-12': [{ startMin: 540, endMin: 600, pc: '2611EB', soort: 'client' }] } } }),
    'ag-day-route': (msg, cb) => cb({ ok: true, result: { date: msg.date, persons: [{ id: '1', name: '', missing: 0,
      stops: [{ start: '09:00', address: 'Teststraat 1, 2611EB, Delft' }, { start: '11:00', address: 'Laan 5, 2613RR, Delft' }], urls: [] }] } }),
  }, { ...AGENDA_STATE_TOOLS, viewDate: '2026-10-12', routesProxy: { key: 'ROUTESSLEUTEL_alleen_routes_1' } });
  dom.window.fetch = (url, init) => {
    if (/routes\.googleapis\.com/.test(url)) {
      google.push({ url, key: init.headers['X-Goog-Api-Key'], body: JSON.parse(init.body) });
      if (/computeRouteMatrix/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { originIndex: 0, destinationIndex: 0, distanceMeters: 1500, duration: '300s', condition: 'ROUTE_EXISTS' }]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ routes: [{ optimizedIntermediateWaypointIndex: [1, 0], distanceMeters: 24000, duration: '1800s' }] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: { docs: [{ centroide_ll: 'POINT(4.3571 52.0116)' }] } }) });
  };
  await tick();
  navKnop(document, 'Route van de dag').click();
  await tick();
  const v = document.querySelector('[data-vertrekpunt]');
  v.value = 'Hoge Mosten 58, 4822 NH Breda'; v.dispatchEvent(new dom.window.Event('change'));
  await tick();
  knop(document, 'Kortste volgorde berekenen').click();
  await tick();
  const opt = google.at(-1);
  assert.match(opt.url, /directions\/v2:computeRoutes$/);
  assert.deepEqual([opt.body.origin.address, ...opt.body.intermediates.map((i) => i.address)], ['4822NH, Nederland', '2611EB, Nederland', '2613RR, Nederland']);
  assert.match(document.body.textContent, /Kortste rondrit: ≈ 24 km · 30 min \(11:00 → 09:00\)/);
});

test('zijpaneel: meerdere collega\'s - weekoverzicht, opbouw en productieverloop per collega', async () => {
  const sum = (c) => ({ clientMinutes: c, nonClientMinutes: 10, totalMinutes: c + 10, directMinutes: c - 60, indirectMinutes: 60, travelMinutes: 0, unknownMinutes: 10, byType: [] });
  const state = { ...AGENDA_STATE_TOOLS, inviteeCount: 2, week: {
    summary: sum(600), opts: { week: 41, embedded: true, scope: 'week', headerHint: 'geregistreerd' }, clientRows: [], overigRows: [],
    perInvitee: [{ id: '13970', name: 'Anna', summary: sum(600) }, { id: '45267', name: 'Bram', summary: sum(300) }] } };
  const week = (w, d) => ({ week: w, weekStart: '2026-10-05', directMinutes: d, indirectMinutes: 60, travelMinutes: 0, clientMinutes: d + 60 });
  const { document } = zijpaneelMetTools({ 'ag-production': (msg, cb) => cb({ ok: true, result: { from: msg.from, to: msg.to, weeks: [week(41, 500)],
    persons: [{ id: '13970', name: 'Anna', weeks: [week(40, 400), week(41, 500)] }, { id: '45267', name: 'Bram', weeks: [week(40, 200), week(41, 250)] }] } }) }, state);
  document.defaultView.eval(read('dist/react-bundle.js'));
  env_update(document, state);
  await tick();
  const blokken = document.querySelectorAll('[data-ons-week-panel] [data-persoon]');
  assert.equal(blokken.length, 2, 'per collega een blok in het weekoverzicht');
  assert.match(blokken[0].textContent, /AnnaCliënttijd10 u/);
  assert.match(blokken[1].textContent, /BramCliënttijd5 u/);
  blokken[0].querySelector('[role="button"]').click();
  await tick();
  assert.match(document.body.textContent, /Anna.*Cliënttijd10 u.*Bram.*Cliënttijd5 u/s, 'opbouw per collega');
  knop(document, 'Productieverloop berekenen').click();
  const grafieken = document.querySelectorAll('[data-grafiek-persoon]');
  assert.equal(grafieken.length, 2, 'een grafiek per collega');
  assert.match(grafieken[0].textContent, /^Anna/);
  assert.match(grafieken[1].textContent, /^Bram/);
  assert.equal(document.querySelectorAll('table').length, 0, 'tabellen ingeklapt');
  [...grafieken[1].querySelectorAll('button')].find((b) => b.textContent === 'Tabel tonen').click();
  assert.equal(document.querySelectorAll('table').length, 1, 'alleen de tabel van Bram open');
});

test('nergens hoofdletterstijl in de extensie', () => {
  const bestanden = ['dist/content.js', 'dist/sidepanel.js', 'dist/react-bundle.js', 'dist/survey.js', 'dist/edge-tab.js', 'admin/beheer_u.html'];
  for (const b of bestanden) assert.doesNotMatch(read(b), /uppercase/, b);
});

test('zijpaneel: snel registreren is een eigen pagina; waarschuwt bij overlap en kan daarna toch openen', async () => {
  const { document, verzonden } = zijpaneelMetTools({
    'ag-quick-register': (msg, cb) => cb(msg.force ? { ok: true } : { ok: false, overlap: 'Let op: op deze dag staat al een registratie van 10:00 tot 11:00.' }),
  });
  await tick();
  navKnop(document, 'Snel registreren').click();
  [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Kies een tijd')).click();
  const kolommen = document.querySelectorAll('[role="listbox"]');
  assert.equal(kolommen.length, 2, 'twee scrollbare kolommen: uur en minuten');
  assert.equal(kolommen[0].style.overflowY, 'auto');
  [...kolommen[0].querySelectorAll('button')].find((b) => b.textContent === '10').click();
  [...document.querySelectorAll('[role="listbox"]')[1].querySelectorAll('button')].find((b) => b.textContent === '30').click();
  assert.equal(document.querySelectorAll('input[type="time"]').length, 0, 'geen keuzevenster van de browser');
  knop(document, 'Formulier openen').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-quick-register', date: '2026-10-07', time: '10:30', minutes: '15', force: false });
  assert.match(document.body.textContent, /10:00 tot 11:00/);
  knop(document, 'Toch openen').click();
  assert.equal(verzonden.at(-1).force, true);
  assert.doesNotMatch(document.body.textContent, /10:00 tot 11:00/);
});

function laadLipje(setup) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', url: 'https://impegno.onsagenda.nl/invitees/1/calendar/week', pretendToBeVisual: true });
  const env = fakeChrome();
  if (setup) setup(env);
  dom.window.chrome = env.chrome;
  dom.window.eval(read('dist/edge-tab.js'));
  return { dom, document: dom.window.document, env };
}

test('randlipje: het vertrouwde smalle lipje, met een korte animatie bij verschijnen', () => {
  const { document } = laadLipje();
  const tab = document.getElementById('onsah-edge-tab');
  assert.ok(tab, 'het lipje staat in de pagina');
  assert.equal(tab.style.width, '26px');
  assert.equal(tab.getAttribute('aria-label'), 'Zijpaneel openen');
  assert.ok(tab.classList.contains('onsah-in'), 'schuift uit de rand bij verschijnen');
  const stijl = document.getElementById('onsah-edge-tab-stijl').textContent;
  assert.match(stijl, /@keyframes onsahEdgeIn/);
  assert.match(stijl, /#onsah-edge-tab svg\{animation:onsahEdgeRust 5s ease-in-out infinite\}/, 'pijl beweegt ook in rust');
  assert.match(stijl, /prefers-reduced-motion: reduce/);
});

test('randlipje: wiebelt één keer per sessie', async () => {
  const { dom, document } = laadLipje();
  const tab = document.getElementById('onsah-edge-tab');
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(tab.classList.contains('onsah-nudge'));
  assert.equal(dom.window.sessionStorage.getItem('onsHelper.edgeTabNudged'), '1');
});

test('randlipje: verdwijnt als het zijpaneel open is en komt terug met animatie', () => {
  const { document, env } = laadLipje();
  const tab = document.getElementById('onsah-edge-tab');
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'sidepanel-state', open: true }));
  assert.equal(tab.style.display, 'none');
  tab.classList.remove('onsah-in');
  env.listeners['runtime.onMessage'].forEach((fn) => fn({ type: 'sidepanel-state', open: false }));
  assert.equal(tab.style.display, 'flex');
  assert.ok(tab.classList.contains('onsah-in'));
});

// Twee momenten kiezen in de planhulp (ma 12 en di 13 okt, 10:00) en naar 'Afspraak maken'.
// Ligging (lon, lat) voor de nep-rijtijden van Google Routes: rijtijd ~ afstand.
const LIGGING = { '2611EB': [4.3571, 52.0116], '2613RR': [4.3650, 52.0050], '5015TA': [5.0700, 51.5600], '5017AB': [5.0750, 51.5620] };
const CLIENTEN = { Tamara: { id: '11142', name: 'Tamara Test', pc: '2611EB', number: '106839', birth: '01-01-1990' }, Bram: { id: '222', name: 'Bram Proef', pc: '5015TA', number: '2', birth: '02-02-2002' } };
function maakPaneel(extra = {}, state = { ...AGENDA_STATE_TOOLS, routesProxy: { key: 'ROUTESSLEUTEL_1' } }) {
  const r = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [
      { date: '2026-10-12', startMin: 540, endMin: 1020, minutes: 480 }, { date: '2026-10-13', startMin: 540, endMin: 1020, minutes: 480 },
    ], visits: msg.visits ? { '2026-10-12': [{ startMin: 480, endMin: 540, pc: '5017AB', soort: 'client' }], '2026-10-13': [{ startMin: 480, endMin: 540, pc: '2613RR', soort: 'client' }] } : undefined } }),
    'ag-client-search': (msg, cb) => cb({ ok: true, clients: Object.keys(CLIENTEN).filter((k) => k.startsWith(msg.term)).map((k) => CLIENTEN[k]) }),
    'ag-event-options': (msg, cb) => cb({ ok: true, metaKnown: true, labels: [{ id: 46, name: 'Huisbezoek' }, { id: 47, name: 'Face to face' }, { id: 48, name: 'Beeldbellen' }],
      hourTypes: Object.fromEntries((msg.clientIds || []).map((c) => [c, [{ id: 5, name: 'JW BG H10 Individuele BG midde', recent: true }, { id: 1135, name: 'Behandeling (GGZ 18+)', recent: false }]])) }),
    'ag-create-events': (msg, cb) => cb({ ok: true, results: msg.events.map(() => ({ ok: true })) }),
    'ag-new-event': (msg, cb) => cb({ ok: true }),
    ...extra,
  }, state);
  r.google = [];
  r.dom.window.fetch = (url, init) => {
    if (!/routes\.googleapis\.com\/distanceMatrix/.test(url)) return Promise.reject(new Error('onverwacht: ' + url));
    const body = JSON.parse(init.body);
    r.google.push({ key: init.headers['X-Goog-Api-Key'], body });
    const pcs = body.origins.map((o) => o.waypoint.address.slice(0, 6));
    const rijen = [];
    pcs.forEach((a, i) => pcs.forEach((b, j) => {
      const [x1, y1] = LIGGING[a], [x2, y2] = LIGGING[b];
      const km = Math.hypot((x2 - x1) * 68, (y2 - y1) * 111) * 1.3;
      rijen.push({ originIndex: i, destinationIndex: j, distanceMeters: Math.round(km * 1000), duration: Math.round(km * 60) + 's', condition: 'ROUTE_EXISTS' });
    }));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(rijen) });
  };
  return r;
}
async function tweeMomenten(document) {
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  document.querySelector('[data-dag="2026-10-12"][data-start="10:00"]').click();
  document.querySelector('[data-dag="2026-10-13"][data-start="10:00"]').click();
  knop(document, 'Afspraak maken op 2 momenten').click();
  await tick();
}
async function kiesClient(document, dom, sleutel, naam) {
  const z = document.querySelector('[data-maak-zoek="' + sleutel + '"]');
  z.value = naam; z.dispatchEvent(new dom.window.Event('input'));
  await new Promise((r) => setTimeout(r, 420));
  document.querySelector('[data-client-id="' + CLIENTEN[naam].id + '"]').click();
}
const kies = (document, dom, sel, v) => { const s = document.querySelector(sel); s.value = v; s.dispatchEvent(new dom.window.Event('change')); };

test('zijpaneel: planhulp is één scherm zonder cliënt en huisbezoek', async () => {
  const { document } = maakPaneel();
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  assert.equal(document.querySelector('[data-plan-modus]'), null, 'geen tabbladen');
  assert.equal(document.querySelector('[data-plan-client]'), null, 'geen cliënt');
  assert.equal(document.querySelector('[data-huisbezoek]'), null, 'geen huisbezoek');
});

test('zijpaneel: afspraak maken A - gedeelde keuzes eerst (cliënten + uursoort, type), compacte regels met eigen type', async () => {
  const { document, dom, verzonden } = maakPaneel();
  await tweeMomenten(document);
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Afspraak maken');
  assert.equal(document.querySelector('[data-maak-modus="dup"]').getAttribute('aria-pressed'), 'true');
  assert.match(document.querySelector('[data-maak-modus="dup"]').textContent, /Zelfde cliënt\(en\)/);
  assert.match(document.body.textContent, /Voor alle 2 afspraken/);
  await kiesClient(document, dom, 'dup0', 'Tamara');
  assert.match(document.querySelector('[data-maak-client="dup0"]').textContent, /TTTamara Testnr\. 106839 · 2611 EB/, 'compacte regel met initialen, nummer en postcode');
  assert.equal(document.querySelector('[data-maak-knop]').disabled, true, 'eerst uursoort kiezen');
  kies(document, dom, '[data-maak-uursoort="11142"]', '1135');
  document.querySelector('[data-maak-plus]').click();
  await kiesClient(document, dom, 'dup1', 'Bram');
  kies(document, dom, '[data-maak-uursoort="222"]', '5');
  assert.equal(document.querySelector('[data-maak-type-alle]').value, '47', 'standaard Face to face');
  kies(document, dom, '[data-maak-type-alle]', '46');
  assert.match(document.querySelector('[data-maak-regel="1"]').textContent, /Huisbezoek - Tamara & Bram/, 'type voor alle afspraken');
  document.querySelector('[data-maak-regel="1"]').click();
  kies(document, dom, '[data-maak-type="1"]', '48');
  assert.ok(document.querySelector('[data-eigen-type="1"]'), 'afwijking als label');
  kies(document, dom, '[data-maak-type-alle]', '47');
  assert.equal(document.querySelector('[data-maak-type="1"]').value, '48', 'eigen keuze blijft staan');
  assert.match(document.querySelector('[data-maak-regel="0"]').textContent, /Face to face - Tamara & Bram/);
  assert.ok(document.querySelector('[data-maak-ons]'), 'ONS Afspraakformulier onderin');
  document.querySelector('[data-maak-knop]').click();
  await tick();
  const ev = JSON.parse(JSON.stringify(verzonden.find((m) => m.type === 'ag-create-events'))).events;
  assert.deepEqual(ev.map((e) => [e.date, e.startMin, e.labelId, e.clients]), [
    ['2026-10-12', 600, 47, [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }]],
    ['2026-10-13', 600, 48, [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }]],
  ]);
  assert.equal(ev[1].name, 'Beeldbellen - Tamara & Bram');
  assert.match(document.body.textContent, /2 afspraken gemaakt in ONS\./);
  assert.ok(knop(document, 'Agenda verversen'));
});

test('zijpaneel: afspraak maken A - per afspraak anders + geavanceerd: efficiënter indelen (Google Routes), overnemen, reistijd; ONS Afspraakformulier per cliënt', async () => {
  const { document, dom, verzonden, google } = maakPaneel();
  await tweeMomenten(document);
  document.querySelector('[data-maak-modus="los"]').click();
  await kiesClient(document, dom, 'los0-0', 'Tamara');   // ma 12 okt, maar die dag zit je in Tilburg
  await kiesClient(document, dom, 'los1-0', 'Bram');     // di 13 okt, die dag zit je in Delft
  document.querySelector('[data-maak-regel="0"]').click();
  assert.equal(document.querySelector('[data-maak-heen="0"]'), null, 'reistijd pas bij Geavanceerd');
  const adv = document.querySelector('[data-maak-geavanceerd]');
  assert.match(adv.parentElement.textContent, /^Geavanceerd/);
  adv.checked = true; adv.dispatchEvent(new dom.window.Event('change'));
  kies(document, dom, '[data-maak-type-alle]', '46');
  const knopEff = document.querySelector('[data-maak-efficient]');
  assert.match(knopEff.textContent, /Efficiënter indelen/);
  assert.ok(knopEff.querySelector('svg'), 'met padicoon');
  knopEff.click();
  await tick(); await tick(); await tick();
  const vs = verzonden.filter((m) => m.type === 'ag-free-slots').at(-1);
  assert.equal(vs.visits, true); assert.equal(vs.many, true);
  assert.equal(google.length, 1, 'één matrix bij Google Routes');
  assert.equal(google[0].key, 'ROUTESSLEUTEL_1');
  assert.deepEqual(google[0].body.origins.map((o) => o.waypoint.address).sort(), ['2611EB, Nederland', '2613RR, Nederland', '5015TA, Nederland', '5017AB, Nederland'], 'alleen postcodes');
  assert.match(document.querySelector('[data-eff-voorstel]').textContent, /Efficiënter: ≈ \d+ min minder rijden \(\d+ km\)/);
  assert.match(document.body.textContent, /Tamara Test: ma 12 okt 10:00 → di 13 okt/);
  document.querySelector('[data-eff-overnemen]').click();
  // Nu: ma 12 okt Bram (bij Tilburg), di 13 okt Tamara (bij Delft).
  assert.match(document.querySelector('[data-maak-client="los0-0"]').textContent, /Bram Proef/);
  assert.match(document.querySelector('[data-maak-client="los1-0"]').textContent, /Tamara Test/);
  assert.equal(document.querySelector('[data-maak-regel="0"]').getAttribute('aria-expanded'), 'true', 'staat nog open');
  assert.ok(+document.querySelector('[data-maak-heen="0"]').value > 0, 'reistijd heen ingevuld');
  assert.match(document.querySelector('[data-maak-afspraak="1"]').textContent, /reistijd \d+ \/ \d+ min/, 'ingeklapt: reistijd in de regel');
  // Ook meerdere cliënten in één afspraak (Bram erbij bij Tamara).
  document.querySelector('[data-maak-plus="los1-"]').click();
  await kiesClient(document, dom, 'los1-1', 'Bram');
  knop(document, 'ONS Afspraakformulier').click();
  const form = JSON.parse(JSON.stringify(verzonden.filter((m) => m.type === 'ag-new-event').at(-1)));
  assert.equal(form.multi, true);
  assert.deepEqual(form.clientIds, ['222']);
  assert.deepEqual(form.eigen.map((e) => e.clientIds), [['11142', '222']]);
  kies(document, dom, '[data-maak-uursoort="222"]', '5');
  kies(document, dom, '[data-maak-uursoort="11142"]', '1135');
  document.querySelector('[data-maak-knop]').click();
  await tick();
  const ev = JSON.parse(JSON.stringify(verzonden.find((m) => m.type === 'ag-create-events'))).events;
  assert.deepEqual(ev.map((e) => [e.date, e.clients, e.labelId, e.name]), [
    ['2026-10-12', [{ id: '222', hourTypeId: 5 }], 46, 'Huisbezoek - Bram'],
    ['2026-10-13', [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }], 46, 'Huisbezoek - Tamara & Bram'],
  ]);
  assert.ok(ev[0].travelBefore > 0);
});

test('zijpaneel: geavanceerd zonder Routes-sleutel - uitleg in plaats van de knop, geen aanvragen', async () => {
  const { document, dom, google } = maakPaneel({}, AGENDA_STATE_TOOLS);
  await tweeMomenten(document);
  const adv = document.querySelector('[data-maak-geavanceerd]');
  adv.checked = true; adv.dispatchEvent(new dom.window.Event('change'));
  assert.equal(document.querySelector('[data-maak-efficient]'), null);
  assert.match(document.body.textContent, /vul in het beheerscherm \(Functies → Google Maps\) een Routes-sleutel in/);
  document.querySelector('[data-maak-regel="0"]').click();
  assert.ok(document.querySelector('[data-maak-heen="0"]'), 'reistijd wel zelf in te vullen');
  assert.equal(google.length, 0);
});

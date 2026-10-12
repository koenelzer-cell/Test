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
  assert.ok(knoppen.every(Boolean), 'knoppen naar de pagina\'s');
  const lijst = knoppen[0].parentElement;
  assert.ok(lijst.hasAttribute('data-hulpmiddelen'), 'samen in één lijst');
  assert.deepEqual([...lijst.querySelectorAll('[data-hulp]')].map((b) => b.textContent), ['Open registraties', 'Planhulp', 'Snel registreren', 'Route van de dag', 'Verhouding per uursoort'], 'zonder ondertitels, in deze volgorde');
  assert.equal(lijst.previousElementSibling.textContent, 'Hulpmiddelen');
  assert.equal(lijst.parentElement.previousElementSibling.children.length, 2, 'direct erboven staat het weekoverzicht (laadstrook + overzicht)');
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
  assert.match(document.body.textContent, /2 afspraken open, samen 1 u 30 m/);
  assert.match(document.body.textContent, /0 van 2/);
  [...document.querySelectorAll('[role="button"]')].find((d) => d.title === 'Klik om naar deze dag te gaan').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-jump-day', date: '2026-10-05', always: true });
  document.querySelector('[data-terug]').click();
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
  assert.match(document.body.textContent, /1 afspraak open, samen 30 m/);
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
  assert.equal(svg.querySelectorAll('path[stroke="#2f5d7c"]').length, 2, 'lijn direct');
  assert.equal(svg.querySelectorAll('path[stroke="#b4507a"]').length, 2, 'lijn indirect');
  assert.equal(svg.querySelectorAll('path[stroke="#d6a24c"]').length, 2, 'lijn reistijd: geregistreerd + gepland');
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
  assert.match(document.body.textContent, /Overig10 m1%/);
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
  assert.match(document.body.textContent, /Totaal\s*11 u 35 m/);
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
    // Lijst: vast blok op do 8 okt. Weekraster (from/to): een blok op de eerste dag van die week.
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, windowStart: 480, windowEnd: 1020, gaps: [
      { date: msg.from || '2026-10-08', startMin: 630, endMin: 720, minutes: 90 },
    ] } }),
    'ag-new-event': (msg, cb) => cb({ ok: true }),
    'ag-slot-check': (msg, cb) => cb({ ok: true, status: 'ready', overlap: msg.startMin === 645 }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Planhulp');
  assert.match(document.querySelector('[data-plan-instellingen]').textContent, /^Duur30m45m1u1,5u2uVooruit1 wk2 wk4 wkDagenmadiwodovr$/, 'compacte tabel: korte teksten, Tot datum als kalendertje');
  assert.equal(document.querySelector('[data-plan-duur="60"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[data-plan-duur="90"]').getAttribute('aria-label'), '1,5 uur', 'voluit voor schermlezers');
  assert.equal(document.querySelector('[data-plan-tot]').getAttribute('aria-label'), 'Tot een datum');
  assert.ok(document.querySelector('[data-plan-tot] svg'), 'kalendericoon');
  assert.equal(document.querySelector('[data-plan-instellingen]').querySelectorAll(':scope > div').length, 3, 'drie regels');
  const dag1 = document.querySelector('[data-plan-dag="1"]'), duur60 = document.querySelector('[data-plan-duur="60"]');
  assert.equal(dag1.style.background, duur60.style.background, 'gekozen dagen in hetzelfde roze als de andere keuzes');
  document.querySelector('[data-plan-weken="4"]').click();
  await tick();
  assert.deepEqual({ minutes: verzonden.at(-1).minutes, weeks: verzonden.at(-1).weeks }, { minutes: 60, weeks: 4 }, 'wijzigen = meteen opnieuw zoeken');
  document.querySelector('[data-plan-tot]').click();
  assert.match(document.body.textContent, /Zoek tot en met/, 'Tot datum: datumveld');
  knop(document, 'Wissen').click();
  await tick();
  assert.match(document.body.textContent, /Donderdag 8 oktoberVrij van 10:30 tot 12:00Naar dag/);
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
  // Weekraster: eigen gegevens per week, vanaf de huidige week, zonder maximum.
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nu = new Date(), ma = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ((nu.getDay() + 6) % 7));
  const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const vandaag = ymd(nu), vanaf = ymd(ma) > vandaag ? ymd(ma) : vandaag;
  document.querySelector('[data-plan-weergave="raster"]').click();
  await tick();
  const eerste = verzonden.filter((m) => m.type === 'ag-free-slots').at(-1);
  assert.deepEqual([eerste.from, eerste.to, eerste.weeks], [vanaf, ymd(plusDagen(ma, 4)), 1], 'één week opgehaald, vanaf vandaag');
  assert.ok(document.querySelector('[data-raster]'));
  assert.equal(document.querySelector('[data-week-terug]').style.visibility, 'hidden', 'niet terug voor deze week');
  const dag = document.querySelector('[data-raster-dag="' + vanaf + '"]');
  assert.ok(dag.querySelector('[data-raster-vrij="10:30-12:00"]'));
  assert.equal([...dag.children].filter((c) => c.style.height === '1px').length, 8, 'een streepje op elk uur (9 t/m 16)');
  const leeg = ymd(plusDagen(new Date(vanaf + 'T00:00:00'), 1));
  if (leeg <= ymd(plusDagen(ma, 4))) assert.match(document.querySelector('[data-raster-dag="' + leeg + '"]').textContent, /Bezet/, 'dag zonder vrije tijd: Bezet');
  // Tien weken vooruit klikken: geen maximum, elke week een eigen aanvraag.
  for (let i = 0; i < 10; i++) { document.querySelector('[data-week-verder]').click(); await tick(); }
  const later = verzonden.filter((m) => m.type === 'ag-free-slots').at(-1);
  const ma10 = plusDagen(ma, 70);
  assert.deepEqual([later.from, later.to], [ymd(ma10), ymd(plusDagen(ma10, 4))]);
  assert.match(document.querySelector('[data-week-titel]').textContent, /tot en met/);
  document.querySelector('[data-raster] [data-dag="' + ymd(ma10) + '"][data-start="10:30"]').click();
  assert.ok(document.querySelector('[data-raster-gekozen="' + ymd(ma10) + ' 10:30"]'), 'kiezen in een week ver vooruit');
  knop(document, 'Afspraak maken op 2 momenten').click();
  assert.deepEqual(JSON.parse(JSON.stringify(verzonden.at(-1))), { type: 'ag-new-event', date: '2026-10-08', time: '11:00', minutes: 60, extra: [{ date: ymd(ma10), time: '10:30' }], eigen: [] });
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
  assert.match(document.querySelector('[data-selectie]').textContent, /do 8 okt10:30 tot 11:30.*di 13 okt09:00 tot 10:00/s);
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

test('zijpaneel: route van de dag - eerst de kaart, QR-code tonen op dezelfde plek, kortste volgorde via de eigen server', async () => {
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
  assert.match(kaart.src, /^https:\/\/www\.google\.com\/maps\/embed\/v1\/directions\?key=EMBEDSLEUTEL_alleen_embed_123&origin=Teststraat/, 'eerst de kaart');
  assert.equal(document.querySelector('[data-route-qr]'), null);
  knop(document, 'QR-code tonen').click();
  assert.equal(document.querySelector('[data-kaart]'), null, 'QR-code in plaats van de kaart');
  const qr = document.querySelector('[data-route-qr] svg');
  assert.equal(qr.getAttribute('data-qr-url'), 'https://www.google.com/maps/dir/?api=1&destination=x', 'QR-code met de route-link');
  assert.ok(document.querySelector('[data-route-qr]').compareDocumentPosition(document.querySelector('[data-route-url]')) & 4, 'op de plek van de kaart (boven de knoppen)');
  knop(document, 'Kaart tonen').click();
  assert.ok(document.querySelector('[data-kaart]'), 'terug naar de kaart');
  knop(document, 'QR-code tonen').click();
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
  assert.match(document.body.textContent, /Kortste rondrit: ≈ 24 km en 30 min/);
  assert.match(document.querySelector('[data-route-qr] svg').getAttribute('data-qr-url'), /origin=Hoge%20Mosten.*destination=Hoge%20Mosten.*waypoints=Laan.*Teststraat/, 'QR-code volgt de kortste volgorde');
  assert.match(document.querySelector('[data-route-qr]').textContent, /in de kortste volgorde/);
  knop(document, 'Kaart tonen').click();
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
  assert.match(document.body.textContent, /Kortste rondrit: ≈ 24 km en 30 min \(11:00 → 09:00\)/);
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
  assert.match(document.querySelector('[data-maak-client="dup0"]').textContent, /TTTamara TestCl 1068392611 EB/, 'compacte regel met initialen en labels Cl en postcode');
  assert.equal(document.querySelector('[data-maak-knop]').disabled, true, 'eerst uursoort kiezen');
  assert.ok(document.querySelector('[data-uursoort-ontbreekt="11142"]'), 'uitroepteken achter de uursoort');
  assert.equal(document.querySelector('[data-maak-uursoort="11142"]').style.background, 'rgb(255, 255, 255)', 'niet oranje');
  kies(document, dom, '[data-maak-uursoort="11142"]', '1135');
  assert.equal(document.querySelector('[data-uursoort-ontbreekt="11142"]'), null, 'gekozen: geen uitroepteken');
  document.querySelector('[data-maak-plus]').click();
  await kiesClient(document, dom, 'dup1', 'Bram');
  kies(document, dom, '[data-maak-uursoort="222"]', '5');
  assert.equal(document.querySelector('[data-maak-type-alle]').value, '47', 'standaard Face to face');
  kies(document, dom, '[data-maak-type-alle]', '46');
  assert.match(document.querySelector('[data-maak-regel="1"]').textContent, /^Di 13 oktober10:00 tot 11:00HuisbezoekTamara en Bram/, 'type voor alle afspraken, cliënten eronder');
  document.querySelector('[data-maak-regel="1"]').click();
  kies(document, dom, '[data-maak-type="1"]', '48');
  assert.ok(document.querySelector('[data-eigen-type="1"]'), 'afwijking als label');
  kies(document, dom, '[data-maak-type-alle]', '47');
  assert.equal(document.querySelector('[data-maak-type="1"]').value, '48', 'eigen keuze blijft staan');
  assert.match(document.querySelector('[data-maak-regel="0"]').textContent, /Face to faceTamara en Bram/);
  assert.ok(document.querySelector('[data-maak-ons]'), 'ONS Afspraakformulier onderin');
  document.querySelector('[data-maak-knop]').click();
  await tick();
  const ev = JSON.parse(JSON.stringify(verzonden.find((m) => m.type === 'ag-create-events'))).events;
  assert.deepEqual(ev.map((e) => [e.date, e.startMin, e.labelId, e.clients]), [
    ['2026-10-12', 600, 47, [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }]],
    ['2026-10-13', 600, 48, [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }]],
  ]);
  assert.equal(ev[1].name, 'Beeldbellen Tamara en Bram');
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
    ['2026-10-12', [{ id: '222', hourTypeId: 5 }], 46, 'Huisbezoek Bram'],
    ['2026-10-13', [{ id: '11142', hourTypeId: 1135 }, { id: '222', hourTypeId: 5 }], 46, 'Huisbezoek Tamara en Bram'],
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

test('zijpaneel: route van de dag - QR-code tonen: per routedeel, in de extensie gemaakt (geen netwerk)', async () => {
  const gevraagd = [];
  const { document, dom } = zijpaneelMetTools({
    'ag-day-route': (msg, cb) => cb({ ok: true, result: { date: msg.date, persons: [{ id: '1', name: '', missing: 0,
      stops: [{ start: '09:00', address: 'Teststraat 1, 2611EB, Delft' }, { start: '11:00', address: 'Laan 5, 2613RR, Delft' }],
      urls: ['https://www.google.com/maps/dir/?api=1&destination=Laan%205&travelmode=driving', 'https://www.google.com/maps/dir/?api=1&origin=Laan%205&destination=Teststraat%201&travelmode=driving'] }] } }),
  }, { ...AGENDA_STATE_TOOLS, viewDate: '2026-10-12' });
  dom.window.fetch = (url) => { gevraagd.push(url); return Promise.reject(new Error('geen netwerk')); };
  await tick();
  navKnop(document, 'Route van de dag').click();
  await tick();
  assert.equal(document.querySelector('[data-route-qr]'), null, 'pas na klikken');
  knop(document, 'QR-code tonen').click();
  const box = document.querySelector('[data-route-qr]');
  assert.equal(box.querySelectorAll('svg').length, 2, 'per deel van de route een QR-code');
  assert.match(box.textContent, /Deel 1 van 2.*Deel 2 van 2.*Scan met de camera van je telefoon/s);
  assert.deepEqual(gevraagd, [], 'geen QR-dienst of ander netwerkverzoek');
});

test('zijpaneel: afspraak maken - ONS-controle met de cliënt erbij, reistijd die niet past, daarna opnieuw zoeken', async () => {
  const { document, dom, verzonden } = maakPaneel({
    'ag-slot-check': (msg, cb) => cb({ ok: true, status: 'ready', overlap: (msg.clientIds || []).includes('222') }),
  });
  await tweeMomenten(document);
  await kiesClient(document, dom, 'dup0', 'Bram');
  await tick();
  const check = verzonden.filter((m) => m.type === 'ag-slot-check' && m.clientIds).at(-1);
  assert.deepEqual(JSON.parse(JSON.stringify(check)), { type: 'ag-slot-check', date: '2026-10-13', startMin: 600, minutes: 60, clientIds: ['222'] }, 'controle met de cliënt');
  assert.ok(document.querySelector('[data-maak-ons-overlap="0"]'), 'label ONS: overlap in de regel');
  assert.match(document.body.textContent, /ONS meldt overlap: de cliënt\(en\) hebben op dit tijdstip al een afspraak/);
  // Reistijd: het vrije blok begint om 9:00, de afspraak om 10:00.
  const adv = document.querySelector('[data-maak-geavanceerd]');
  adv.checked = true; adv.dispatchEvent(new dom.window.Event('change'));
  document.querySelector('[data-maak-regel="0"]').click();
  const heen = document.querySelector('[data-maak-heen="0"]');
  heen.value = '90'; heen.dispatchEvent(new dom.window.Event('input')); heen.dispatchEvent(new dom.window.Event('change'));
  assert.match(document.querySelector('[data-maak-reis-conflict="0"]').textContent, /Reistijd heen \(90 min\) past niet: er is 60 min vrij voor 10:00\./);
  const heen2 = document.querySelector('[data-maak-heen="0"]');
  heen2.value = '45'; heen2.dispatchEvent(new dom.window.Event('input')); heen2.dispatchEvent(new dom.window.Event('change'));
  assert.equal(document.querySelector('[data-maak-reis-conflict="0"]'), null, '45 min past wel');
  // Maken; daarna zoekt de planhulp de vrije tijd opnieuw.
  kies(document, dom, '[data-maak-uursoort="222"]', '5');
  document.querySelector('[data-maak-knop]').click();
  await tick();
  const voor = verzonden.filter((m) => m.type === 'ag-free-slots').length;
  document.querySelector('[data-terug]').click();
  await tick();
  assert.equal(verzonden.filter((m) => m.type === 'ag-free-slots').length, voor + 1, 'na het maken opnieuw zoeken');
});

test('zijpaneel: planhulp - agenda erbij of eraf: zonder keuzes meteen opnieuw zoeken, met keuzes eerst vragen', async () => {
  const een = { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false }, inviteeId: '13970', inviteeIds: '13970', inviteeCount: 1 };
  const twee = { ...een, inviteeIds: '13970,45267', inviteeCount: 2 };
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [{ date: '2026-10-08', startMin: 630, endMin: 720, minutes: 90 }] } }),
  }, een);
  const zoekvragen = () => verzonden.filter((m) => m.type === 'ag-free-slots').length;
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  const start = zoekvragen();
  // Agenda erbij, nog niets gekozen: meteen opnieuw zoeken.
  env_update(document, twee);
  await tick();
  assert.equal(zoekvragen(), start + 1, 'opnieuw gezocht');
  assert.equal(document.querySelector('[data-agenda-melding]'), null, 'geen vraag zonder keuzes');
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Planhulp', 'blijft op de planhulp');
  // Moment kiezen, dan agenda sluiten: eerst vragen.
  document.querySelector('[data-start="10:30"]').click();
  env_update(document, een);
  await tick();
  assert.equal(zoekvragen(), start + 1, 'niet vanzelf opnieuw');
  assert.match(document.querySelector('[data-agenda-melding]').textContent, /Er is een agenda gesloten\..*Opnieuw beginnen.*Negeren/s);
  document.querySelector('[data-agenda-negeren]').click();
  assert.equal(document.querySelector('[data-agenda-melding]'), null);
  assert.equal(document.querySelector('[data-selectie]').getAttribute('data-selectie'), '1', 'keuze blijft staan');
  assert.equal(zoekvragen(), start + 1, 'negeren = niet verversen');
  // Weer een agenda erbij: opnieuw beginnen wist de keuze en zoekt opnieuw.
  env_update(document, twee);
  await tick();
  assert.match(document.querySelector('[data-agenda-melding]').textContent, /Er is een agenda geopend \(nu 2 agenda’s\)\./);
  document.querySelector('[data-agenda-opnieuw]').click();
  await tick();
  assert.equal(document.querySelector('[data-selectie]'), null, 'keuzes gewist');
  assert.equal(zoekvragen(), start + 2, 'opnieuw gezocht');
  assert.equal(document.querySelector('[data-agenda-melding]'), null);
});

test('zijpaneel: planhulp - feestdagen met eigen ontwerp in weekraster en lijst', async () => {
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nu = new Date(), ma = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ((nu.getDay() + 6) % 7) + 7);
  const dag = (n) => ymd(new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + n));
  const { document } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, windowStart: 480, windowEnd: 1020,
      gaps: [{ date: dag(1), startMin: 540, endMin: 660, minutes: 120 }, { date: dag(3), startMin: 540, endMin: 660, minutes: 120 }],
      holidays: [{ date: dag(0), name: 'Tweede kerstdag' }, { date: dag(2), name: 'Koningsdag' }, { date: dag(4), name: ' Goede Vrijdag' }, { date: dag(5), name: 'Zaterdagfeest' }] } }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  // Lijst: feestdag als eigen regel tussen de dagen, zonder tijden; geen weekend.
  const regels = [...document.querySelectorAll('[data-feestdag]')];
  assert.deepEqual(regels.map((r) => [r.getAttribute('data-feestdag'), r.getAttribute('data-feestdag-stijl')]), [[dag(0), 'kerst2'], [dag(2), 'koning']]);
  assert.match(regels[1].textContent, /Koningsdag, geen tijden$/);
  assert.equal(regels[1].querySelector('svg').getAttribute('viewBox'), '0 0 48 48');
  assert.equal(document.querySelectorAll('[data-dag="' + dag(2) + '"]').length, 0);
  // Weekraster: de hele kolom is de feestdag, met tekening en naam, zonder groet.
  document.querySelector('[data-plan-weergave="raster"]').click();
  await tick();
  document.querySelector('[data-week-verder]').click();
  await tick();
  const kol = document.querySelector('[data-raster-feestdag="Koningsdag"]');
  assert.ok(kol, 'Koningsdag in het raster');
  assert.equal(kol.getAttribute('data-raster-dag'), dag(2));
  assert.equal(kol.getAttribute('data-feestdag-stijl'), 'koning');
  assert.equal(kol.textContent, 'Koningsdag', 'alleen de naam, geen extra tekst');
  assert.equal(kol.querySelectorAll('svg').length, 2, 'tekening en vlaggetjes');
  assert.equal(kol.querySelectorAll('[data-start]').length, 0, 'niets te kiezen');
  assert.match(kol.style.background, /data:image\/svg\+xml/);
  assert.equal(document.querySelector('[data-raster-feestdag="Tweede kerstdag"]').getAttribute('data-feestdag-stijl'), 'kerst2');
  assert.match(document.querySelector('[data-raster]').parentNode.textContent, /Feestdag/, 'in de legenda');
  assert.ok(document.querySelector('[data-raster-dag="' + dag(1) + '"] [data-raster-vrij]'), 'gewone dag blijft gewoon');
});

test('zijpaneel: weekraster - Vandaag-knop en vandaag herkenbaar (roze kop, nu-lijn)', async () => {
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nu = new Date(), vandaag = ymd(nu);
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, windowStart: 0, windowEnd: 1439, gaps: [] } }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  document.querySelector('[data-plan-weergave="raster"]').click();
  await tick();
  const knopV = () => document.querySelector('[data-week-vandaag]');
  assert.equal(knopV().disabled, true, 'in de week van vandaag: grijs');
  assert.match(knopV().textContent, /^Vandaag$/);
  const werkdag = nu.getDay() > 0 && nu.getDay() < 6;
  if (werkdag) {
    assert.equal(document.querySelectorAll('[data-raster]').length, 1, 'raster');
    assert.equal(document.querySelectorAll('[data-raster-vandaag]').length, 1, 'één kop is vandaag');
    const kol = document.querySelector('[data-raster-dag="' + vandaag + '"]');
    assert.ok(kol.querySelector('[data-raster-voorbij]'), 'wat voorbij is, is gestreept');
    assert.ok(kol.querySelector('[data-raster-nu]'), 'lijn op nu');
  }
  document.querySelector('[data-week-verder]').click(); await tick();
  document.querySelector('[data-week-verder]').click(); await tick();
  assert.equal(knopV().disabled, false);
  assert.equal(document.querySelectorAll('[data-raster-vandaag]').length, 0, 'andere week: geen vandaag');
  const voor = verzonden.filter((m) => m.type === 'ag-free-slots').length;
  knopV().click(); await tick();
  assert.equal(knopV().disabled, true, 'terug in de week van vandaag');
  assert.ok(verzonden.filter((m) => m.type === 'ag-free-slots').length > voor, 'week opnieuw opgehaald');
});

test('zijpaneel: cliënt zoeken met vinkje Inclusief cliënten uit zorg', async () => {
  const UIT = { id: '999', name: 'Tim Oud', pc: '', number: '77', birth: '03-03-1970', outOfCare: true };
  const { document, dom, verzonden } = maakPaneel({
    'ag-client-search': (msg, cb) => cb({ ok: true, clients: [CLIENTEN.Tamara].concat(msg.outOfCare ? [UIT] : []) }),
  });
  await tweeMomenten(document);
  const vink = document.querySelector('[data-client-uit-zorg]');
  assert.ok(vink, 'vinkje bij het zoekveld');
  assert.equal(vink.checked, false, 'standaard uit');
  assert.match(vink.parentNode.textContent, /^Inclusief cliënten uit zorg$/);
  const z = document.querySelector('[data-maak-zoek]');
  z.value = 'T'; z.value = 'Ti'; z.dispatchEvent(new dom.window.Event('input'));
  await new Promise((r) => setTimeout(r, 420));
  const zoek = () => verzonden.filter((m) => m.type === 'ag-client-search');
  assert.deepEqual([zoek().at(-1).term, zoek().at(-1).outOfCare], ['Ti', false]);
  assert.equal(document.querySelector('[data-client-id="999"]'), null);
  vink.checked = true; vink.dispatchEvent(new dom.window.Event('change'));
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual([zoek().at(-1).term, zoek().at(-1).outOfCare], ['Ti', true], 'aanvinken zoekt meteen opnieuw, met uit zorg');
  const tim = document.querySelector('[data-client-id="999"]');
  assert.ok(tim, 'cliënt uit zorg in de lijst');
  assert.match(tim.textContent, /Uit zorg/);
  tim.click();
  await tick();
  assert.match(document.querySelector('[data-maak-client]').textContent, /Tim Oud/);
});

test('zijpaneel: planhulp - dagenfilter: meteen zichtbaar, vlot tijdens laden, ook in het weekraster', async () => {
  const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
  const open = [];   // antwoorden die nog niet gegeven zijn (traag ONS)
  const antwoord = (msg) => ({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, windowStart: 480, windowEnd: 1020, gaps: [
    { date: '2026-10-12', startMin: 540, endMin: 660, minutes: 120 }, { date: '2026-10-16', startMin: 540, endMin: 660, minutes: 120 },
  ].filter((g) => !msg.days || msg.days.includes(new Date(g.date + 'T00:00:00').getDay())) } });
  let traag = false;
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => { if (traag && !msg.from) open.push(() => cb(antwoord(msg))); else cb(antwoord(msg)); },
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  const zoek = () => verzonden.filter((m) => m.type === 'ag-free-slots' && !m.from);
  assert.equal(zoek().at(-1).days, undefined, 'standaard alle dagen: geen filter');
  assert.deepEqual([...document.querySelectorAll('[data-plan-dag]')].map((b) => b.getAttribute('aria-pressed')), ['true', 'true', 'true', 'true', 'true']);
  assert.ok(document.querySelector('[data-dag="2026-10-12"]'));
  // Maandag uit: meteen weg uit de lijst, zoeken pas na een korte pauze.
  traag = true;
  const voor = zoek().length;
  document.querySelector('[data-plan-dag="1"]').click();
  assert.equal(document.querySelector('[data-dag="2026-10-12"]'), null, 'maandag meteen weg');
  assert.ok(document.querySelector('[data-dag="2026-10-16"]'), 'vrijdag blijft staan');
  // Tijdens het wachten en laden nog meer dagen uitvinken: blijft werken.
  document.querySelector('[data-plan-dag="2"]').click();
  await wacht(350);
  assert.equal(zoek().length, voor + 1, 'één zoekactie voor beide klikken');
  document.querySelector('[data-plan-dag="3"]').click();
  assert.equal(document.querySelector('[data-plan-dag="3"]').getAttribute('aria-pressed'), 'false', 'klikken tijdens het laden werkt');
  assert.ok(document.querySelector('[data-dag="2026-10-16"]'), 'lijst blijft zichtbaar tijdens het laden');
  await wacht(350);
  assert.deepEqual([...zoek().at(-1).days], [4, 5]);
  // Het oude antwoord komt later: telt niet; het nieuwe wel.
  open.shift()(); await tick();
  open.shift()(); await tick();
  assert.equal(document.querySelector('[data-dag="2026-10-12"]'), null);
  assert.ok(document.querySelector('[data-dag="2026-10-16"]'));
  traag = false;
  // Laatste dag kan niet uit.
  ['4'].forEach((d) => document.querySelector('[data-plan-dag="' + d + '"]').click());
  await wacht(350);
  const n = zoek().length;
  document.querySelector('[data-plan-dag="5"]').click(); await wacht(350);
  assert.equal(zoek().length, n, 'de laatste dag kan niet uit');
  // Weekraster: uitgevinkte dagen zonder vrije tijd, met 'Uit'.
  document.querySelector('[data-plan-weergave="raster"]').click();
  await tick();
  assert.ok(document.querySelector('[data-plan-dag]'), 'Dagen ook bij het weekraster');
  const uit = [...document.querySelectorAll('[data-raster-uit]')];
  assert.equal(uit.length, 4, 'ma t/m do uit');
  assert.ok(uit.every((k) => !k.querySelector('[data-start]')));
  assert.ok(document.querySelector('[data-raster-dag]:not([data-raster-uit]) [data-raster-vrij]'), 'vrijdag wel');
});

test('zijpaneel: planhulp - Meer laden onderaan de lijst', async () => {
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => {
      const n = Math.min(msg.limit || 12, msg.to ? 60 : 30);
      const gaps = Array.from({ length: n }, (_, i) => ({ date: '2026-10-' + String(12 + Math.floor(i / 6)).padStart(2, '0'), startMin: 480 + (i % 6) * 60, endMin: 540 + (i % 6) * 60, minutes: 60 }));
      cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, to: msg.to, lastDate: msg.to || '2026-10-25', gaps } });
    },
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  const zoek = () => verzonden.filter((m) => m.type === 'ag-free-slots');
  assert.equal(zoek().at(-1).limit, 24, 'standaard 24 blokken');
  const meer = () => document.querySelector('[data-plan-meer]');
  assert.ok(meer(), 'knop Meer laden');
  meer().click(); await tick(); await tick();
  assert.equal(zoek().at(-1).limit, 48, 'meer blokken');
  // Nu minder dan gevraagd (periode op): twee weken verder zoeken.
  meer().click(); await tick(); await tick();
  assert.equal(zoek().at(-1).to, '2026-11-08', 'twee weken verder');
  assert.equal(document.querySelector('[data-plan-tot]').textContent, '8 nov', 'gekozen datum kort naast het kalendertje');
  assert.equal(document.querySelector('[data-plan-tot]').getAttribute('aria-label'), 'Tot en met 8 november');
});

test('zijpaneel: rondleiding zijpaneel via de i-knop, stap voor stap', async () => {
  const { document } = zijpaneelMetTools(null);
  await tick();
  document.querySelector('[aria-label="Legenda en versie"]').click();
  await tick();
  document.querySelector('[data-info-rondleiding="zijpaneel"]').click();
  await new Promise((r) => setTimeout(r, 100));
  const tour = () => document.querySelector('[data-rondleiding="zijpaneel"]');
  assert.ok(tour(), 'rondleiding open');
  assert.match(tour().textContent, /Welkom bij Agendahulp/);
  const titels = [];
  for (let n = 0; n < 12 && tour(); n++) {
    titels.push(tour().querySelector('[data-rondleiding-titel]').textContent);
    tour().querySelector('[data-rondleiding-volgende]').click();
    for (let w = 0; w < 30 && tour() && tour().hasAttribute('data-rondleiding-bezig'); w++) await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(tour(), null, 'na Klaar dicht');
  assert.ok(titels.includes('Aan of uit') && titels.includes('Planhulp') && titels.includes('Later nog eens?'), titels.join(' | '));
  assert.ok(!titels.some((t) => /[·–—]/.test(t)), 'geen puntjes of streepjes');
  assert.ok(document.querySelector('[data-paneel-titel]') === null || !/Legenda/.test(document.querySelector('[data-paneel-titel]').textContent), 'terug op de hoofdpagina');
});

test('zijpaneel: rondleiding Planhulp met knop, weekraster en afspraak maken, daarna alles terug', async () => {
  const { document } = maakPaneel();
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  assert.equal(document.querySelector('[data-selectie]'), null, 'nog niets gekozen');
  document.querySelector('[data-plan-rondleiding]').click();
  await new Promise((r) => setTimeout(r, 100));
  const tour = () => document.querySelector('[data-rondleiding="planhulp"]');
  assert.match(tour().textContent, /Welkom in de Planhulp/);
  const gezien = [];
  for (let n = 0; n < 14 && tour(); n++) {
    const t = tour().querySelector('[data-rondleiding-titel]').textContent;
    gezien.push(tour().textContent);
    if (/^De weekplanning$/.test(t)) assert.ok(document.querySelector('[data-raster]'), 'raster getoond');
    if (/^Cliënt zoeken$/.test(t)) assert.ok(document.querySelector('[data-maak-zoek]'), 'op Afspraak maken');
    if (/^Je gekozen momenten$/.test(t)) assert.ok(document.querySelector('[data-selectie]'), 'voorbeeldmoment');
    tour().querySelector('[data-rondleiding-volgende]').click();
    for (let w = 0; w < 30 && tour() && tour().hasAttribute('data-rondleiding-bezig'); w++) await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(tour(), null);
  assert.ok(gezien.some((t) => /Planhulp, stap 1 van/.test(t)));
  assert.ok(gezien.some((t) => /Afspraak maken/.test(t)));
  await tick();
  assert.equal(document.querySelector('[data-plan-weergave="lijst"]').getAttribute('aria-pressed'), 'true', 'terug in de lijst');
  assert.equal(document.querySelector('[data-selectie]'), null, 'voorbeeldmoment weer weg');
  // Sluiten met Escape.
  document.querySelector('[data-plan-rondleiding]').click();
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(tour());
  document.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(tour(), null, 'Escape sluit');
});

test('zijpaneel: elke feestdag een eigen kleine animatie, één keer per week en bij muis erover', async () => {
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nu = new Date(), ma = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ((nu.getDay() + 6) % 7) + 7);
  const dag = (n) => ymd(new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + n));
  const namen = ['Koningsdag', 'Bevrijdingsdag', 'Hemelvaartsdag', 'Eerste kerstdag', 'Nieuwjaarsdag'];
  const { document, dom } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [], holidays: namen.map((name, i) => ({ date: dag(i), name })) } }),
  }, { ...AGENDA_STATE_TOOLS, features: { plannerDirect: false } });
  const gespeeld = [];
  dom.window.Element.prototype.animate = function (frames, opts) { gespeeld.push({ el: this, frames: JSON.stringify(frames), opts }); return {}; };
  await tick();
  navKnop(document, 'Planhulp').click();
  await tick();
  document.querySelector('[data-plan-weergave="raster"]').click();
  await tick();
  document.querySelector('[data-week-verder]').click();
  await tick(); await tick();
  const kolommen = namen.map((n) => document.querySelector('[data-raster-feestdag="' + n + '"]'));
  assert.ok(kolommen.every((k) => k && k.querySelector('[data-feestdag-animatie]')), 'elke feestdag geanimeerd');
  const perStijl = new Set(gespeeld.map((g) => g.frames));
  assert.equal(perStijl.size, namen.length, 'elke feestdag een eigen beweging');
  const aantal = gespeeld.length;
  // Opnieuw tekenen (andere duur kiezen en terug): niet nog eens van voren af.
  document.querySelector('[data-plan-duur="30"]').click(); await tick();
  document.querySelector('[data-plan-duur="60"]').click(); await tick();
  await new Promise((r) => setTimeout(r, 1900));
  document.querySelector('[data-plan-weergave="lijst"]').click(); await tick();
  document.querySelector('[data-plan-weergave="raster"]').click(); await tick();
  const naHertekenen = gespeeld.length;
  // Muis erover: nog een keer.
  document.querySelector('[data-raster-feestdag="Koningsdag"]').dispatchEvent(new dom.window.Event('mouseenter'));
  assert.equal(gespeeld.length, naHertekenen + 1, 'muis erover speelt hem nog eens');
  assert.ok(aantal >= namen.length);
});

test('zijpaneel: startscherm - weekkaart met datums en label, hulpmiddelen met teller, terugpijl in de kop', async () => {
  const sum = { clientMinutes: 690, nonClientMinutes: 5, totalMinutes: 695, directMinutes: 480, indirectMinutes: 150, travelMinutes: 60, byType: [] };
  const state = { ...AGENDA_STATE_TOOLS, openCount: 3, week: { summary: sum, opts: { week: 41, date: '2026-10-07', scope: 'week', headerHint: 'geregistreerd' }, clientRows: [], overigRows: [] } };
  const { document } = zijpaneelMetTools(null, state);
  document.defaultView.eval(read('dist/react-bundle.js'));
  env_update(document, state);
  await tick();
  const paneel = document.querySelector('[data-ons-week-panel]');
  assert.match(paneel.textContent, /^Week 415 tot en met 9 oktobergeregistreerd/, 'week, datums en label');
  assert.match(paneel.textContent, /Cliënttijd11 u 30 mNiet-cliënttijd5 mTotaal11 u 35 m/);
  assert.match(paneel.textContent, /Direct8 uIndirect2 u 30 mReistijd1 u/);
  assert.equal(paneel.querySelectorAll('[data-week-balk] i').length, 3, 'balk direct, indirect, reistijd');
  const opbouw = paneel.querySelector('[role="button"]');
  assert.equal(opbouw.textContent, 'Opbouw en productieverloop');
  assert.notEqual(opbouw.style.color, 'rgb(204, 8, 125)', 'in tekstkleur, niet roze');
  assert.equal(document.querySelector('[data-hulp="open"] [data-hulp-teller]').textContent, '3', 'teller bij Open registraties');
  assert.equal(document.querySelectorAll('[data-hulp-teller]').length, 1, 'alleen daar');
  assert.equal(document.querySelector('[data-terug]').style.display, 'none', 'geen terugpijl op het startscherm');
  opbouw.click();
  await tick();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Cliënttijd');
  assert.equal(document.querySelector('[data-terug]').style.display, 'inline-flex', 'terugpijl in de kop');
  assert.match(document.body.textContent, /Opbouw week 41geregistreerd/);
  document.querySelector('[data-terug]').click();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Agendahulp');
  // Zonder bekend aantal: geen teller.
  env_update(document, { ...state, openCount: null });
  await tick();
  assert.equal(document.querySelectorAll('[data-hulp-teller]').length, 0);
});

test('zijpaneel: open registraties - knop Registreren per afspraak opent hem in ONS', async () => {
  let antwoord = (msg, cb) => cb({ ok: true });
  const { document, verzonden } = zijpaneelMetTools({
    'ag-check-range': (msg, cb) => cb({ ok: true, result: RESULT([ITEM_A, ITEM_B, { ...ITEM_A, key: 'x|2026-10-05|9', start: ITEM_A.start + 3600000 }]) }),
    'ag-register-item': (msg, cb) => antwoord(msg, cb),
  });
  await tick();
  navKnop(document, 'Open registraties').click();
  await tick();
  const knoppen = [...document.querySelectorAll('[data-registreer]')];
  assert.equal(knoppen.length, 2, 'alleen bij afspraken met een id');
  assert.equal(knoppen[0].textContent, 'Registreren');
  const springen = verzonden.filter((m) => m.type === 'ag-jump-day').length;
  knoppen[0].click();
  await tick();
  assert.deepEqual({ ...verzonden.find((m) => m.type === 'ag-register-item') }, { type: 'ag-register-item', id: 'a', date: '2026-10-05' });
  assert.equal(verzonden.filter((m) => m.type === 'ag-jump-day').length, springen, 'niet ook naar de dag springen');
  // Mislukt: uitleg bij die afspraak.
  antwoord = (msg, cb) => cb({ ok: false, error: 'De afspraak staat niet (meer) in de agenda.' });
  document.querySelector('[data-registreer]').click();
  await tick();
  assert.match(document.body.textContent, /De afspraak staat niet \(meer\) in de agenda\./);
});

test('zijpaneel: route van de dag - nette melding met knop als ONS niet antwoordt, en bij geen bezoeken', async () => {
  let herladen = 0;
  let route = null;   // geen antwoord: de pagina reageert niet
  const r = zijpaneelMetTools({ 'ag-day-route': (msg, cb) => (route ? route(msg, cb) : cb(null)) });
  r.env.chrome.tabs.reload = () => { herladen++; };
  const { document } = r;
  await tick();
  navKnop(document, 'Route van de dag').click();
  await tick();
  const staat = document.querySelector('[data-staat]');
  assert.ok(staat, 'nette melding');
  assert.match(staat.textContent, /De agenda is even niet bereikbaar/);
  assert.doesNotMatch(document.body.textContent, /Herlaad de pagina en probeer het opnieuw/, 'geen technische tekst');
  staat.querySelector('[data-staat-knop]').click();
  assert.equal(herladen, 1, 'ONS-pagina herladen');
  // Wel antwoord, maar geen bezoeken: rustige lege staat.
  route = (msg, cb) => cb({ ok: true, result: { date: msg.date, persons: [{ id: '', name: '', stops: [], urls: [] }] } });
  document.querySelector('[data-terug]').click();
  navKnop(document, 'Route van de dag').click();
  await new Promise((r2) => setTimeout(r2, 4100));
  assert.match(document.body.textContent, /Geen huisbezoeken/);
});

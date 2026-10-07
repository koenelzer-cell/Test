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

test('zijpaneel: sluit zichzelf als je in dit venster naar een site buiten ONS gaat', async () => {
  let gesloten = 0;
  const { dom, env } = zijpaneelMetAgenda((e) => {
    e.chrome.tabs.get = (id, cb) => cb({ id, active: true, windowId: 1, url: undefined }); // geen ONS: Chrome geeft de URL niet
  });
  dom.window.close = () => { gesloten++; };
  await tick();
  env.listeners['tabs.onActivated'][0]({ tabId: 9, windowId: 1 });
  await tick();
  assert.equal(gesloten, 1);
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
  const knoppen = ['Verhouding per uursoort', 'Open registraties', 'Snel registreren'].map((k) => navKnop(document, k));
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
  knop(document, 'Controleren').click();
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
  knop(document, 'Controleren').click();
  assert.match(document.body.textContent, /0 van 2/);
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
  assert.match(document.body.textContent, /42gepland12 u2 u30 m13 u 20 m4111 u2 u30 m13 u 20 m/, 'tabel met dezelfde getallen, nieuwste week bovenaan');
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
  knop(document, 'Controleren').click();
  await new Promise((r) => setTimeout(r, 3100)); // niet vaker dan eens per paar seconden
  // ONS markeert een afspraak als geregistreerd: de toestand van de pagina verandert.
  env_update(document, { ...AGENDA_STATE_TOOLS, past: { '2026-10-05': { client: 30, overig: 0, lateMin: 0, lateCount: 0 } } });
  env_update(document, { ...AGENDA_STATE_TOOLS, past: { '2026-10-05': { client: 0, overig: 0, lateMin: 0, lateCount: 0 } } });
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(controles, 2, 'zonder klikken bijgewerkt');
  assert.match(document.body.textContent, /1 van 2/);
});

test('zijpaneel: een andere medewerker in de URL begint opnieuw', async () => {
  const { document } = zijpaneelMetTools({ 'ag-check-range': (msg, cb) => cb({ ok: true, result: RESULT([ITEM_A]) }) },
    { ...AGENDA_STATE_TOOLS, inviteeId: '1' });
  await tick();
  navKnop(document, 'Open registraties').click();
  knop(document, 'Controleren').click();
  assert.match(document.body.textContent, /1 afspraak open/);
  env_update(document, { ...AGENDA_STATE_TOOLS, inviteeId: '2' });
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Agendahulp', 'terug naar de hoofdpagina');
  navKnop(document, 'Open registraties').click();
  assert.doesNotMatch(document.body.textContent, /afspraak open/, 'geen resultaten van de vorige medewerker');
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

test('zijpaneel: planhulp zoekt vrije tijd en geeft opties per vrij blok', async () => {
  const { document, verzonden } = zijpaneelMetTools({
    'ag-free-slots': (msg, cb) => cb({ ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, gaps: [
      { date: '2026-10-08', startMin: 630, endMin: 720, minutes: 90 },
    ] } }),
    'ag-new-event': (msg, cb) => cb({ ok: true }),
  });
  await tick();
  assert.match(document.body.textContent, /Planhulp/);
  knop(document, '1 u').click();
  knop(document, '4 weken').click();
  knop(document, 'Vrije tijd zoeken').click();
  assert.deepEqual({ minutes: verzonden.at(-1).minutes, weeks: verzonden.at(-1).weeks }, { minutes: 60, weeks: 4 });
  assert.match(document.body.textContent, /do 8 okt10:30 – 12:001 u 30 m vrij/);
  [...document.querySelectorAll('[role="button"]')].find((c) => c.title === 'Opties voor dit vrije blok').click();
  assert.equal(document.querySelector('[data-paneel-titel]').textContent, 'Vrij blok');
  const starts = [...document.querySelectorAll('[data-start]')].map((b) => b.getAttribute('data-start'));
  assert.deepEqual(starts, ['10:30', '10:45', '11:00'], 'alleen begintijden waarop 1 u nog past');
  document.querySelector('[data-start="10:45"]').click();
  assert.match(document.body.textContent, /Afspraak 10:45 – 11:45/);
  knop(document, 'Afspraak maken op dit tijdstip').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-new-event', date: '2026-10-08', time: '10:45', minutes: 60 });
  knop(document, 'Naar deze dag in de agenda').click();
  assert.deepEqual({ ...verzonden.at(-1) }, { type: 'ag-jump-day', date: '2026-10-08', always: true });
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

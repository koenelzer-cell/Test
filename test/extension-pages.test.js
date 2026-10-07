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

// De uitgepakte extensie in een echte Chromium: manifest, service worker en
// content-scripts samen. ONS zelf is er niet; elke aanvraag naar een ONS-adres
// krijgt een vaste pagina (een document) of een lege 404 (al het andere).
//
// Wat hier vastligt:
//  - de extensie laadt zonder fouten, op ONS Agenda en op ONS Dossier;
//  - de content-scripts draaien en antwoorden het zijpaneel;
//  - de service worker overleeft het afsluiten door de browser: na een
//    herstart antwoordt hij weer, en menu, wekker en badge staan er nog.
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const AGENDA = 'https://impegno.onsagenda.nl/calendar/invitee/123/day?date=2026-10-21';
const FORMULIER = 'https://impegno.onsagenda.nl/events/new?date=2026-10-21';
const DOSSIER = 'https://impegno.ons-dossier.nl/clients/1/survey';
const LEGE_PAGINA = '<!doctype html><html lang="nl"><head><title>ONS</title></head><body><div id="app"></div></body></html>';
const FORMULIER_HTML = fs.readFileSync(path.join(ROOT, 'test/fixtures/afspraak-twee-clienten.html'), 'utf8');

// Zonder eigen Chromium (PW_CHROMIUM) het volledige Chromium-kanaal: de
// kale headless-variant laadt geen extensies.
async function startBrowser(map = fs.mkdtempSync(path.join(os.tmpdir(), 'agendahulp-'))) {
  const context = await chromium.launchPersistentContext(map, {
    headless: true,
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chromium' }),
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });
  await context.route(/^https:\/\/impegno(-[a-z-]+)?\.ons(agenda|-dossier)\.nl\//, (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    const html = new URL(req.url()).pathname.startsWith('/events/new') ? FORMULIER_HTML : LEGE_PAGINA;
    return route.fulfill({ contentType: 'text/html', body: html });
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  return {
    context, id, map,
    stop: () => context.close(),
    sluit: () => context.close().finally(() => fs.rmSync(map, { recursive: true, force: true })),
  };
}

// Fouten uit alle scriptwerelden van een tabblad, dus ook uit de
// content-scripts (die Playwright's pageerror niet ziet).
async function volgFouten(context, page) {
  const fouten = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Runtime.exceptionThrown', (e) => fouten.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled', (e) => {
    if (e.type === 'error') fouten.push(e.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable');
  return fouten;
}

// Een extensiepagina om de chrome-API's mee aan te spreken, en om de service
// worker te volgen (fouten, status).
async function extensiePagina(context, id) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/pages/popup.html`);
  const cdp = await context.newCDPSession(page);
  const status = { draait: false, fouten: [] };
  cdp.on('ServiceWorker.workerVersionUpdated', (e) => {
    for (const v of e.versions) if (v.scriptURL.endsWith('/dist/background.js')) status.draait = v.runningStatus === 'running';
  });
  cdp.on('ServiceWorker.workerErrorReported', (e) => status.fouten.push(e.errorMessage.errorMessage));
  await cdp.send('ServiceWorker.enable');
  return { page, cdp, status };
}

const naarTab = (ext, url, bericht) => ext.page.evaluate(async ({ url, bericht }) => {
  const [tab] = await chrome.tabs.query({ url });
  return chrome.tabs.sendMessage(tab.id, bericht);
}, { url, bericht });

const naarWorker = (ext, bericht) => ext.page.evaluate((b) => chrome.runtime.sendMessage(b), bericht);

// Het badgegetal staat per tabblad: het tabblad dat het bericht stuurde (hier
// de extensiepagina zelf, op de ONS-pagina het content-script).
const badge = (ext) => ext.page.evaluate(async () => chrome.action.getBadgeText({ tabId: (await chrome.tabs.getCurrent()).id }));

const menuBestaat = (ext, menuId) => ext.page.evaluate((m) => new Promise((klaar) => {
  chrome.contextMenus.update(m, {}, () => klaar(!chrome.runtime.lastError));
}), menuId);

test('laadt zonder fouten op ONS Agenda en ONS Dossier', async () => {
  const { context, id, sluit } = await startBrowser();
  try {
    const ext = await extensiePagina(context, id);
    const fouten = {};
    for (const url of [AGENDA, FORMULIER, DOSSIER]) {
      const page = await context.newPage();
      fouten[url] = await volgFouten(context, page);
      await page.goto(url);
      await page.waitForTimeout(1500);
    }
    // Content-scripts draaien: de agendahulp en de vragenlijst antwoorden het zijpaneel.
    expect(await naarTab(ext, AGENDA.replace(/\?.*/, '*'), { type: 'ag-get-state' })).toHaveProperty('state');
    expect(await naarTab(ext, DOSSIER, { type: 'survey-get-state' })).toHaveProperty('state');
    // Het randlipje (edge-tab) en de main-world staan op de pagina.
    const agenda = context.pages().find((p) => p.url().startsWith(AGENDA.replace(/\?.*/, '')));
    await expect(agenda.locator('#onsah-edge-tab')).toHaveCount(1);
    expect(await agenda.evaluate(() => window.__onsAgendahulpMW === true)).toBe(true);
    expect(fouten).toEqual({ [AGENDA]: [], [FORMULIER]: [], [DOSSIER]: [] });
    expect(ext.status.fouten).toEqual([]);
  } finally {
    await sluit();
  }
});

test('service worker werkt na afsluiten en herstarten', async () => {
  const { context, id, sluit } = await startBrowser();
  try {
    const ext = await extensiePagina(context, id);
    const page = await context.newPage();
    await page.goto(AGENDA);
    await expect.poll(() => menuBestaat(ext, 'onsHelper.panel')).toBe(true);
    await naarWorker(ext, { type: 'reminder-settings', enabled: true, weekday: 5, hour: 15, minute: 0 });
    await naarWorker(ext, { type: 'badge', count: 3 });
    await expect.poll(() => badge(ext)).toBe('3');
    const wekker = await ext.page.evaluate(() => chrome.alarms.get('onsHelper.reminder'));
    expect(wekker).toBeTruthy();

    // Wat de browser doet als de worker een tijd niets te doen heeft.
    await ext.cdp.send('ServiceWorker.stopAllWorkers');
    await expect.poll(() => ext.status.draait).toBe(false);

    // Een bericht wekt hem; de listeners staan er meteen weer.
    const antwoord = await naarWorker(ext, { type: 'reminder-get' });
    expect(antwoord.settings.enabled).toBe(true);
    await expect.poll(() => ext.status.draait).toBe(true);
    expect(await menuBestaat(ext, 'onsHelper.panel')).toBe(true);
    expect(await ext.page.evaluate(() => chrome.alarms.get('onsHelper.reminder'))).toEqual(wekker);
    expect(await badge(ext)).toBe('3');
    expect(await ext.page.evaluate(() => chrome.sidePanel.getOptions({}))).toMatchObject({ enabled: true, path: 'pages/sidepanel.html' });
    expect(await naarTab(ext, AGENDA.replace(/\?.*/, '*'), { type: 'ag-get-state' })).toHaveProperty('state');
    expect(ext.status.fouten).toEqual([]);
  } finally {
    await sluit();
  }
});

test('menu en wekker staan er na een herstart van de browser', async () => {
  const eerste = await startBrowser();
  let tweede;
  try {
    const ext = await extensiePagina(eerste.context, eerste.id);
    await naarWorker(ext, { type: 'reminder-settings', enabled: true, weekday: 5, hour: 15, minute: 0 });
    await eerste.stop();

    tweede = await startBrowser(eerste.map);
    const opnieuw = await extensiePagina(tweede.context, tweede.id);
    await expect.poll(() => menuBestaat(opnieuw, 'onsHelper.panel')).toBe(true);
    await expect.poll(() => opnieuw.page.evaluate(() => chrome.alarms.get('onsHelper.reminder'))).toBeTruthy();
    expect(opnieuw.status.fouten).toEqual([]);
  } finally {
    await (tweede || eerste).sluit();
  }
});

test('UI-inspector: laadt pas op verzoek en is uit te zetten', async () => {
  const { context, id, sluit } = await startBrowser();
  try {
    const ext = await extensiePagina(context, id);
    const page = await context.newPage();
    const fouten = await volgFouten(context, page);
    const scripts = [];
    page.on('request', (r) => { if (r.url().endsWith('/dist/ui-inspector.js')) scripts.push(r.url()); });

    await page.goto(AGENDA);
    await page.waitForTimeout(1000);
    expect(scripts).toEqual([]);

    // De knop in het beheerscherm opent ONS met #ons-ui-inspector.
    await page.goto(AGENDA + '#ons-ui-inspector');
    await expect(page.locator('#__ons-ins-root')).toHaveCount(1);
    expect(page.url()).toBe(AGENDA);
    expect(scripts.length).toBeGreaterThan(0);
    // Hij blijft open na herladen, tot hij gesloten wordt.
    await page.reload();
    await expect(page.locator('#__ons-ins-root')).toHaveCount(1);

    // features.uiInspector: false zet hem uit, ook als hij openstond.
    await ext.page.evaluate(() => chrome.storage.local.set({ onsHelperConfig: { features: { uiInspector: false } } }));
    await page.goto('about:blank');
    await page.goto(AGENDA + '#ons-ui-inspector');
    await page.waitForTimeout(1500);
    await expect(page.locator('#__ons-ins-root')).toHaveCount(0);
    expect(fouten).toEqual([]);
  } finally {
    await sluit();
  }
});

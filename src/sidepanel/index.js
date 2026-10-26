// Het zijpaneel: de Agendahulp (agenda-panel.js) op de agendaschermen.
//
// Het content-script van de ONS-pagina zendt zijn toestand uit; dit bestand
// geeft die door aan het paneel. Het paneel tekent zelf; dit bestand doet
// alleen de koppeling. Klikken gaan terug naar het content-script, want alleen
// dat kan de ONS-pagina lezen en aansturen.

import { MSG, SIDEPANEL_PORT } from '../shared/messages.js';
import { ONS_URL_PATTERNS, isOnsUrl } from '../shared/ons-hosts.js';
import { create as createAgendaPanel } from './agenda-panel.js';
import { formulierTitel } from './bewaard.js';

const NIETS_KOP = 'Niets om te tonen';
const NIETS_TEKST = 'Ga in ONS naar de agenda; het paneel vult zich dan vanzelf.';

const host = document.getElementById('paneel');
let huidig = null;        // { soort: 'agenda', paneel }
let onsTabId = null;

function leeg() {
  if (huidig) { huidig.paneel.destroy(); huidig = null; }
  host.innerHTML = '';
}

function toonMelding(kop, tekst) {
  leeg();
  const d = document.createElement('div');
  d.className = 'melding';
  const b = document.createElement('b');
  b.textContent = kop;
  d.appendChild(b);
  d.appendChild(document.createTextNode(tekst));
  host.appendChild(d);
}

function naarTab(msg) {
  if (onsTabId == null) return;
  try { chrome.tabs.sendMessage(onsTabId, msg, function () { void chrome.runtime.lastError; }); } catch (e) {}
}

// Een vraag aan het tabblad waar een antwoord op komt (controle, snel
// registreren). Komt er geen antwoord, dan krijgt de aanroeper een foutmelding
// in plaats van eeuwig te wachten.
function vraagAanTab(msg, cb) {
  if (onsTabId == null) { cb({ ok: false, error: 'Geen ONS-tabblad gevonden.' }); return; }
  try {
    chrome.tabs.sendMessage(onsTabId, msg, function (res) {
      if (chrome.runtime.lastError || !res) { cb({ ok: false, geenAntwoord: true, error: 'De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw.' }); return; }
      cb(res);
    });
  } catch (e) { cb({ ok: false, geenAntwoord: true, error: 'De ONS-pagina reageert niet.' }); }
}

/* ── De twee panelen ───────────────────────────────────────────────────── */

const agendaActies = {
  onToggleEnabled: function (aan) { naarTab({ type: MSG.AGENDA_TOGGLE_ENABLED, value: aan }); },
  onJumpToDay: function (date, always) { naarTab({ type: MSG.AGENDA_JUMP_DAY, date: date, always: !!always }); },
  onJumpToWeek: function () { naarTab({ type: MSG.AGENDA_JUMP_WEEK }); },
  onOpenOccurrence: function (id) { naarTab({ type: MSG.AGENDA_OPEN_OCCURRENCE, id: id }); },
  onRequestLeave: function () { naarTab({ type: MSG.AGENDA_OPEN_LEAVE }); },
  onCheckRange: function (from, to, cb, vers) { vraagAanTab({ type: MSG.AGENDA_CHECK_RANGE, from: from, to: to, vers: !!vers }, cb); },
  onNewEvent: function (req, cb) { vraagAanTab(Object.assign({ type: MSG.AGENDA_NEW_EVENT }, req), cb); },
  onDayRoute: function (date, origin, cb) { vraagAanTab({ type: MSG.AGENDA_DAY_ROUTE, date: date, origin: origin || '' }, cb); },
  onSlotCheck: function (req, cb) { vraagAanTab(Object.assign({ type: MSG.AGENDA_SLOT_CHECK }, req), cb); },
  onFreeSlots: function (minutes, weeks, cb, to, visits, many, from, days, limit) {
    const m = { type: MSG.AGENDA_FREE_SLOTS, minutes: minutes, weeks: weeks, to: to || '', visits: !!visits, many: !!many, from: from || '' };
    if (Array.isArray(days) && days.length && days.length < 5) m.days = days.slice();
    if (limit > 0) m.limit = limit;
    vraagAanTab(m, cb);
  },
  onEventOptions: function (clientIds, cb, opts) {
    vraagAanTab(Object.assign({ type: MSG.AGENDA_EVENT_OPTIONS, clientIds: clientIds }, opts && opts.medewerker ? { medewerker: true } : {}), cb);
  },
  onCreateEvents: function (events, cb) { vraagAanTab({ type: MSG.AGENDA_CREATE_EVENTS, events: events }, cb); },
  onReloadAgenda: function () { vraagAanTab({ type: MSG.AGENDA_RELOAD }, function () {}); },
  // Het ONS-tabblad zelf herladen (ook als het content-script niet meer antwoordt).
  onReloadTab: function () { if (onsTabId == null) return; try { chrome.tabs.reload(onsTabId); } catch (e) {} },
  onRegisterItem: function (id, date, cb, extra) {
    extra = extra || {};
    vraagAanTab({ type: MSG.AGENDA_REGISTER_ITEM, id: id, date: date, occurrenceId: extra.occurrenceId || '', inviteeId: extra.inviteeId || '' }, cb);
  },
  onClientSearch: function (term, cb, outOfCare) { vraagAanTab({ type: MSG.AGENDA_CLIENT_SEARCH, term: term, outOfCare: !!outOfCare }, cb); },
  onWeekRatio: function (date, cb) { vraagAanTab({ type: MSG.AGENDA_WEEK_RATIO, date: date }, cb); },
  onProduction: function (from, to, cb) { vraagAanTab({ type: MSG.AGENDA_PRODUCTION, from: from, to: to }, cb); },
  onQuickRegister: function (req, cb) { vraagAanTab(Object.assign({ type: MSG.AGENDA_QUICK_REGISTER }, req), cb); },
};

// De eerste keer bouwt het paneel op; daarna is het een gewone update, zodat
// in/uitklappen en scrollpositie blijven staan.
function toon(soort, state) {
  if (!huidig || huidig.soort !== soort) {
    leeg();
    huidig = { soort: soort, paneel: createAgendaPanel(host, agendaActies) };
  }
  huidig.paneel.update(state);
}

/* ── De juiste tab vinden en om de eerste toestand vragen ──────────────── */

// Het zijpaneel zegt ZELF tegen het tabblad dat het open is, in plaats van dat
// alleen aan de boekhouding van de worker over te laten. Die weg is korter en
// kan niet misgaan door een gemiste of te vroege melding — en juist als die
// melding uitbleef, stond de oude Agendahulp ineens naast het zijpaneel.
function meldStand(tabId, open) {
  if (tabId == null) return;
  try {
    chrome.tabs.sendMessage(tabId, { type: MSG.SIDEPANEL_STATE, open: open, bron: 'zijpaneel' },
      function () { void chrome.runtime.lastError; });
  } catch (e) {}
}
// Zolang het zijpaneel open is, zegt het dat elke paar seconden tegen zijn
// tabblad. Een gemiste melding of een herstartte worker kan het randlipje dan
// niet meer naast het open zijpaneel laten staan (het lipje rekent een
// 'open' van het zijpaneel 5 seconden als geldig). Gaat het zijpaneel dicht,
// dan meldt het dat nog; komt dat niet aan, dan stoppen de meldingen en komt
// het lipje na die 5 seconden vanzelf terug.
const HARTSLAG_MS = 2000;
setInterval(function () { if (onsTabId != null) meldStand(onsTabId, true); }, HARTSLAG_MS);
try { window.addEventListener('pagehide', function () { if (onsTabId != null) meldStand(onsTabId, false); }); } catch (e) {}

function vraagToestand(tabId) {
  if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
  onsTabId = tabId;
  meldStand(tabId, true);
  chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function (res) {
    void chrome.runtime.lastError;
    if (res && res.state) { toon('agenda', res.state); return; }
    if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
  });
}

function zoekOnsTab() {
  try {
    chrome.tabs.query({ url: ONS_URL_PATTERNS }, function (tabs) {
      void chrome.runtime.lastError;
      if (!tabs || !tabs.length) {
        if (onsTabId != null) meldStand(onsTabId, false);
        onsTabId = null;
        toonMelding('Geen ONS-scherm open',
          'Open ONS in een tabblad; de Agendahulp verschijnt hier dan vanzelf.');
        return;
      }
      const actief = tabs.find(function (t) { return t.active; });
      vraagToestand((actief || tabs[0]).id);
    });
  } catch (e) {
    toonMelding('Kon het tabblad niet vinden', 'Herlaad het zijpaneel.');
  }
}

/* ── Live meelopen ─────────────────────────────────────────────────────── */

function onMessage(msg, sender, sendResponse) {
  if (!msg) return;
  const vanTab = sender && sender.tab && sender.tab.id;
  // Alleen het tabblad dat we volgen mag iets zeggen. De worker markeert daar
  // maar één tabblad voor, maar een late melding van een vorig tabblad mag het
  // paneel niet alsnog omgooien.
  if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
  if (vanTab != null) onsTabId = vanTab;
  // Het ONS-formulier uit Afspraak maken is open: de titel van dat moment.
  if (msg.type === MSG.AGENDA_FORM_TITLE) {
    try { sendResponse({ title: formulierTitel(String(msg.date || ''), String(msg.time || '')) }); } catch (e) {}
    return;
  }
  if (msg.type === MSG.AGENDA_STATE) annuleerSluiten();

  if (msg.type === MSG.AGENDA_DUPLICATES_DONE) {
    if (huidig && huidig.soort === 'agenda' && huidig.paneel.setDuplicates) huidig.paneel.setDuplicates(msg);
    return;
  }
  if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
    if (huidig && huidig.soort === 'agenda' && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.kind || 'open', msg.done | 0, msg.total | 0);
    return;
  }

  if (msg.type === MSG.AGENDA_STATE && msg.state) {
    toon('agenda', msg.state);
    return;
  }

  // De agenda is weg (ander scherm in hetzelfde tabblad): kijken of er nog
  // iets te tonen is, anders sluit het paneel.
  if (msg.type === MSG.AGENDA_GONE) {
    toonMelding(NIETS_KOP, NIETS_TEKST);
    naNavigatie(sender && sender.tab);
  }
}

chrome.runtime.onMessage.addListener(onMessage);

/* ── Automatisch sluiten bij een andere pagina ─────────────────────────── */

// Ga je in het venster van dit zijpaneel naar een andere pagina (ander
// tabblad, andere site, of een ONS-scherm zonder agenda), dan
// sluit het zijpaneel zichzelf. Een ONS-pagina die net laadt krijgt eerst
// even de tijd om zijn toestand te melden; komt er binnen die tijd niets, dan
// gaat het paneel dicht. Bij het openen zelf sluiten we nooit: dan zie je de
// melding 'Niets om te tonen'.
const SLUIT_NA_MS = 5000;
let mijnVenster = null;
let sluitTimer = null;

function annuleerSluiten() {
  if (sluitTimer) { clearTimeout(sluitTimer); sluitTimer = null; }
}

function sluitZijpaneel() {
  annuleerSluiten();
  if (onsTabId != null) meldStand(onsTabId, false);
  try {
    if (chrome.sidePanel && typeof chrome.sidePanel.close === 'function' && mijnVenster != null) {
      const r = chrome.sidePanel.close({ windowId: mijnVenster });
      if (r && typeof r.catch === 'function') r.catch(function () { window.close(); });
      return;
    }
  } catch (e) {}
  window.close();
}

// Na een navigatie of tabwissel: is er iets te tonen?
//  - Ander tabblad of site buiten ONS: het paneel blijft open met een korte
//    melding. Zo staat het meteen weer klaar als je terugkomt in ONS (Chrome
//    laat een extensie het paneel niet zelf heropenen).
//  - ONS-scherm zonder agenda (bijv. een afspraakformulier):
//    dicht, zodra de pagina antwoordt dat er niets is (meestal binnen ~1 s).
//    Antwoordt de pagina nog niet (nog aan het laden), dan wachten we tot
//    SLUIT_NA_MS.
const KIJK_ELKE_MS = 500;
function naNavigatie(tab) {
  annuleerSluiten();
  if (!tab || !isOnsUrl(tab.url)) {
    if (onsTabId != null) meldStand(onsTabId, false);
    onsTabId = null;
    toonMelding('Niet in ONS', 'Ga terug naar je ONS-tabblad; de Agendahulp staat dan meteen weer klaar.');
    return;
  }
  onsTabId = tab.id;
  vraagToestand(tab.id);
  const begin = Date.now();
  let leegAchterElkaar = 0;
  const kijk = function () {
    sluitTimer = null;
    chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function (res) {
      void chrome.runtime.lastError;
      if (res && res.state) return;
      // De agendahulp draait op elk ONS-scherm en antwoordt altijd; zegt hij
      // twee keer achter elkaar 'niets' (één keer kan een tussenstap bij het
      // wisselen van scherm zijn), dan dicht. Geen antwoord = nog aan het laden.
      if (res && typeof res === 'object') leegAchterElkaar++;
      else leegAchterElkaar = 0;
      if (leegAchterElkaar >= 2 || Date.now() - begin >= SLUIT_NA_MS) { sluitZijpaneel(); return; }
      sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
    });
  };
  sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
}

function inMijnVenster(windowId) {
  return mijnVenster == null || windowId == null || windowId === mijnVenster;
}

try {
  chrome.windows.getCurrent(function (w) { void chrome.runtime.lastError; if (w) mijnVenster = w.id; });
} catch (e) {}

// Van tabblad wisselen of binnen een tabblad navigeren. Zonder dit blijft het
// paneel hangen op het vorige scherm.
try {
  chrome.tabs.onActivated.addListener(function (info) {
    if (!inMijnVenster(info && info.windowId)) return;
    if (onsTabId != null && onsTabId !== info.tabId) meldStand(onsTabId, false);
    onsTabId = null;
    chrome.tabs.get(info.tabId, function (tab) {
      void chrome.runtime.lastError;
      naNavigatie(tab);
    });
  });
  chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
    if (!tab || !tab.active || !inMijnVenster(tab.windowId)) return;
    // Alleen een echte paginawissel telt: een nieuwe URL, of het begin van
    // laden (naar een site buiten ONS geeft Chrome ons de URL niet door).
    if (info && (info.url || info.status === 'loading')) naNavigatie(tab);
  });
} catch (e) {}

// Zolang deze poort openstaat weten de pagina's dat het zijpaneel actief is:
// het pagina-paneel blijft dan weg en het randlipje verbergt zich.
// Herstart de worker (dat doet Chrome geregeld), dan valt de poort weg: opnieuw
// verbinden, anders denkt de ONS-pagina dat het paneel dicht is (of open, en
// blijft het randlipje weg).
function verbind() {
  try {
    const p = chrome.runtime.connect({ name: SIDEPANEL_PORT });
    if (p && p.onDisconnect && p.onDisconnect.addListener) {
      p.onDisconnect.addListener(function () { void chrome.runtime.lastError; setTimeout(verbind, 300); });
    }
  } catch (e) {}
}
verbind();
zoekOnsTab();

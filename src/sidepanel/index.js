// Het zijpaneel.
//
// Twee panelen delen deze plek:
//   - de Agendahulp   (agenda-panel.js)  op de agendaschermen;
//   - de Vragenlijst  (survey-panel.js)  op een cliëntvragenlijst.
//
// Welke je ziet volgt de pagina waar je bent: het content-script dat iets te
// melden heeft, zendt zijn toestand uit en dit bestand wisselt daarop. Er is
// dus geen keuzemenu — je krijgt wat bij het scherm hoort.
//
// De panelen zelf tekenen; dit bestand doet alleen de koppeling. Klikken gaan
// terug naar het betreffende content-script, want alleen dat kan de ONS-pagina
// lezen en aansturen.

import { MSG, SIDEPANEL_PORT } from '../shared/messages.js';
import { ONS_URL_PATTERNS, isOnsUrl } from '../shared/ons-hosts.js';
import { create as createAgendaPanel } from './agenda-panel.js';
import { create as createSurveyPanel } from './survey-panel.js';

const NIETS_KOP = 'Niets om te tonen';
const NIETS_TEKST = 'Ga in ONS naar de agenda of open een cliëntvragenlijst; het paneel vult zich dan vanzelf.';

const host = document.getElementById('paneel');
let huidig = null;        // { soort: 'agenda' | 'vragenlijst', paneel }
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
      if (chrome.runtime.lastError || !res) { cb({ ok: false, error: 'De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw.' }); return; }
      cb(res);
    });
  } catch (e) { cb({ ok: false, error: 'De ONS-pagina reageert niet.' }); }
}

/* ── De twee panelen ───────────────────────────────────────────────────── */

const agendaActies = {
  onToggleEnabled: function (aan) { naarTab({ type: MSG.AGENDA_TOGGLE_ENABLED, value: aan }); },
  onJumpToDay: function (date, always) { naarTab({ type: MSG.AGENDA_JUMP_DAY, date: date, always: !!always }); },
  onJumpToWeek: function () { naarTab({ type: MSG.AGENDA_JUMP_WEEK }); },
  onOpenOccurrence: function (id) { naarTab({ type: MSG.AGENDA_OPEN_OCCURRENCE, id: id }); },
  onRequestLeave: function () { naarTab({ type: MSG.AGENDA_OPEN_LEAVE }); },
  onCheckRange: function (from, to, cb) { vraagAanTab({ type: MSG.AGENDA_CHECK_RANGE, from: from, to: to }, cb); },
  onWeekRatio: function (date, cb) { vraagAanTab({ type: MSG.AGENDA_WEEK_RATIO, date: date }, cb); },
  onProduction: function (from, to, cb) { vraagAanTab({ type: MSG.AGENDA_PRODUCTION, from: from, to: to }, cb); },
  onQuickRegister: function (req, cb) { vraagAanTab(Object.assign({ type: MSG.AGENDA_QUICK_REGISTER }, req), cb); },
};

const vragenlijstActies = {
  onOpenItem: function (index) { naarTab({ type: MSG.SURVEY_OPEN_ITEM, index: index }); },
};

// Wisselen van paneel bouwt opnieuw op; binnen hetzelfde paneel is het een
// gewone update, zodat in/uitklappen en scrollpositie blijven staan.
function toon(soort, state) {
  if (!huidig || huidig.soort !== soort) {
    leeg();
    const paneel = (soort === 'vragenlijst')
      ? createSurveyPanel(host, vragenlijstActies)
      : createAgendaPanel(host, agendaActies);
    huidig = { soort: soort, paneel: paneel };
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
    chrome.tabs.sendMessage(tabId, { type: MSG.SIDEPANEL_STATE, open: open },
      function () { void chrome.runtime.lastError; });
  } catch (e) {}
}

function vraagToestand(tabId) {
  if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
  onsTabId = tabId;
  meldStand(tabId, true);
  // Eerst de vragenlijst: sta je op een vragenlijst, dan is dát wat je wilt zien.
  chrome.tabs.sendMessage(tabId, { type: MSG.SURVEY_GET_STATE }, function (res) {
    void chrome.runtime.lastError;
    if (res && res.state) { toon('vragenlijst', res.state); return; }
    chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function (res2) {
      void chrome.runtime.lastError;
      if (res2 && res2.state) { toon('agenda', res2.state); return; }
      if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
    });
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
          'Open ONS in een tabblad; de Agendahulp of de vragenlijst-checklist verschijnt hier dan vanzelf.');
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

function onMessage(msg, sender) {
  if (!msg) return;
  const vanTab = sender && sender.tab && sender.tab.id;
  // Alleen het tabblad dat we volgen mag iets zeggen. De worker markeert daar
  // maar één tabblad voor, maar een late melding van een vorig tabblad mag het
  // paneel niet alsnog omgooien.
  if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
  if (vanTab != null) onsTabId = vanTab;
  if (msg.type === MSG.SURVEY_STATE || msg.type === MSG.AGENDA_STATE) annuleerSluiten();

  if (msg.type === MSG.SURVEY_STATE && msg.state) { toon('vragenlijst', msg.state); return; }

  if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
    if (huidig && huidig.soort === 'agenda' && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.kind || 'open', msg.done | 0, msg.total | 0);
    return;
  }

  if (msg.type === MSG.AGENDA_STATE && msg.state) {
    // Een vragenlijst gaat voor: die is specifiek voor dit scherm, terwijl de
    // Agendahulp op alle ONS-schermen meedraait.
    if (huidig && huidig.soort === 'vragenlijst') return;
    toon('agenda', msg.state);
    return;
  }

  // De vragenlijst is weg (ander scherm): niet op een oude lijst blijven staan,
  // maar opnieuw kijken wat dit tabblad nu te bieden heeft.
  if (msg.type === MSG.SURVEY_GONE) {
    if (huidig && huidig.soort === 'vragenlijst') { leeg(); naNavigatie(sender && sender.tab); }
    return;
  }
  // De agenda is weg (ander scherm in hetzelfde tabblad): kijken of er nog
  // iets te tonen is, anders sluit het paneel.
  if (msg.type === MSG.AGENDA_GONE && (!huidig || huidig.soort === 'agenda')) {
    toonMelding(NIETS_KOP, NIETS_TEKST);
    naNavigatie(sender && sender.tab);
  }
}

chrome.runtime.onMessage.addListener(onMessage);

/* ── Automatisch sluiten bij een andere pagina ─────────────────────────── */

// Ga je in het venster van dit zijpaneel naar een andere pagina (ander
// tabblad, andere site, of een ONS-scherm zonder agenda of vragenlijst), dan
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

// Na een navigatie: is er iets te tonen? Zo ja, dan blijft het paneel open
// (een binnenkomende toestand annuleert het sluiten). Zo niet, dan dicht.
function naNavigatie(tab) {
  annuleerSluiten();
  if (!tab || !isOnsUrl(tab.url)) { sluitZijpaneel(); return; }
  onsTabId = tab.id;
  vraagToestand(tab.id);
  sluitTimer = setTimeout(function () {
    sluitTimer = null;
    // Laatste kans: misschien is het content-script net klaar.
    chrome.tabs.sendMessage(tab.id, { type: MSG.SURVEY_GET_STATE }, function (res) {
      void chrome.runtime.lastError;
      if (res && res.state) return;
      chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function (res2) {
        void chrome.runtime.lastError;
        if (!(res2 && res2.state)) sluitZijpaneel();
      });
    });
  }, SLUIT_NA_MS);
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
try { chrome.runtime.connect({ name: SIDEPANEL_PORT }); } catch (e) {}

zoekOnsTab();

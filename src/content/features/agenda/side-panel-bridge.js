// Koppeling met het zijpaneel: toestand uitzenden en de acties uitvoeren die
// daar worden aangeklikt.

import { schedulePaint } from './painting.js';
import { activeLegend, PROFILES, workdayWindowLabel } from './zones.js';
import { agendaPage, STORE_GREY_ENABLED } from './state.js';
import { openOccurrence } from './occurrences.js';
import { computeTotals, computeTotalsApi, listUnfinished } from './unregistered-time.js';
import { editableWindowStart, windowStatusForDate } from './edit-window.js';
import { currentCalendarView, currentInviteeIds, jumpToDay, jumpToWeek } from './navigation.js';
import { safe } from '../../screen/status.js';
import { storageSet } from '../../storage/page-prefs.js';
import { leaveRequestEnabled, openLeaveDialog } from '../leave/leave-request.js';
import { checkOpenRange, defaultRangeFrom } from './open-range.js';
import { computeProduction, defaultProductionFrom } from './production.js';
import { fetchWeekRatio } from './week-ratio.js';
import { findFreeSlots } from './free-slots.js';
import { _nonClientMarker } from '../../domain/registrations.js';
import { openNewEvent, quickRegister } from './quick-register.js';
import { agendaYmd } from '../../core/datetime.js';
import { currentAgendaDate } from '../../ons/agenda-location.js';
import { SCRIPT_VERSION } from '../../../shared/version.js';
import { MSG } from '../../../shared/messages.js';

const VERSION = SCRIPT_VERSION;
/* ===== De Agendahulp in het zijpaneel =====
   Het zijpaneel tekent hetzelfde paneel (agendapanel.js), maar kan de
   ONS-pagina niet lezen of aansturen. Daarom stuurt dit script de toestand
   uit en voert het de acties uit die daar worden aangeklikt.

   Zolang het zijpaneel open is, verbergen we het pagina-paneel: anders kijk
   je naar twee exemplaren van hetzelfde. Verbergen, niet opruimen — de
   berekeningen blijven gewoon lopen, want die voeden het zijpaneel.
   ========================================================================== */

// Alles wat het paneel nodig heeft, als platte waarden: het gaat als bericht
// de extensie door, dus er mogen geen DOM-elementen of functies in.
function agPanelState() {
  var res = (agendaPage._agLastEntries && agendaPage._agLastEntries.length) ? computeTotalsApi() : computeTotals();
  var view = currentCalendarView();
  var windowStart = editableWindowStart();
  var windowStatus = {};
  Object.keys(res.past || {}).forEach(function (d) {
    var st = windowStatusForDate(d, windowStart);
    if (st) windowStatus[d] = st;
  });
  var profLabel = null;
  if (agendaPage.currentProfile) profLabel = (PROFILES[agendaPage.currentProfile] && PROFILES[agendaPage.currentProfile].label) || agendaPage.currentProfile;
  return {
    enabled: !!agendaPage.greyEnabled,
    profileLabel: profLabel,
    view: view,
    past: res.past || {},
    future: res.future || { client: 0, overig: 0 },
    windowStatus: windowStatus,
    // Alleen in dagweergave getoond; buiten die weergave niet berekenen.
    unfinished: (view === 'day') ? listUnfinished().map(function (i) {
      return { id: i.id, time: i.time, name: i.name, client: !!i.client };
    }) : [],
    legend: (activeLegend() || []).map(function (l) { return { color: l.color, text: l.text }; }),
    windowLabel: workdayWindowLabel(),
    version: VERSION,
    week: agendaPage._agLastWeek,
    weekError: agendaPage._agWeekError || '',
    // Zodat het zijpaneel kan laten zien dat er herrekend wordt; zonder dit
    // lijkt een weekwissel te blijven hangen op de vorige cijfers.
    weekLoading: !!agendaPage._agWeekBusy,
    // Toont het zijpaneel de knop 'Verlof aanvragen'? (uit te zetten door beheer)
    leaveRequest: leaveRequestEnabled(),
    // Welke agenda (invitee) er bekeken wordt: wisselt die, dan begint het
    // zijpaneel opnieuw (resultaten van de vorige medewerker horen er niet).
    inviteeId: agendaPage._agLastInviteeId != null ? String(agendaPage._agLastInviteeId) : null,
    // De bekeken datum: startpunt voor bladeren per week.
    viewDate: currentAgendaDate(),
    // Hoeveel agenda's er naast elkaar open staan (planhulp zoekt dan gezamenlijke tijd).
    inviteeCount: currentInviteeIds().length || 1,
    // Standaardperiode voor 'Open registraties controleren'.
    rangeDefaultFrom: defaultRangeFrom(),
    productionDefaultFrom: defaultProductionFrom(),
    // Markering van niet-cliënturen, voor de uitleg op de pagina 'Verhouding per uursoort'.
    nonClientMarker: _nonClientMarker(),
    today: agendaYmd(new Date())
  };
}
// Uitzenden bij een echte wijziging. Dit hangt aan dezelfde 300ms-tik als de
// badge, dus zonder deze vergelijking zou het drie keer per seconde zenden.
export function pushPanelState(force) {
  if (!agendaPage.sidePanelOpen) return;   // niemand luistert
  try {
    var st = agPanelState();
    var sig = JSON.stringify(st);
    if (!force && sig === agendaPage._agStateSig) return;
    agendaPage._agStateSig = sig;
    chrome.runtime.sendMessage({ type: MSG.AGENDA_STATE, state: st });
  } catch (e) {}
}
// De Agendahulp staat in het zijpaneel; in de pagina tekent dit script
// alleen nog de gekleurde dagindeling. Er valt hier dus niets te verbergen.
function setSidePanelOpen(open) {
  if (agendaPage.sidePanelOpen === !!open) return;
  agendaPage.sidePanelOpen = !!open;
  if (agendaPage.sidePanelOpen) { agendaPage._agStateSig = ''; safe(function () { pushPanelState(true); }); }
}
// Acties vanuit het zijpaneel + de vraag om de huidige toestand.
// Opstarten: acties vanuit het zijpaneel + de vraag om de huidige toestand.
export function listenForSidePanelMessages() {
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || typeof msg.type !== 'string') return;
      switch (msg.type) {
        case MSG.SIDEPANEL_STATE:
          setSidePanelOpen(!!msg.open);
          return;
        case MSG.AGENDA_GET_STATE:
          // Het zijpaneel vraagt dit meteen bij openen; dan weten we ook dat
          // het er is, ook als het poortbericht ons nog niet bereikt had.
          agendaPage.sidePanelOpen = true;
          try { sendResponse({ state: agendaPage.active ? agPanelState() : null }); } catch (e) {}
          return true;
        case MSG.AGENDA_TOGGLE_ENABLED:
          safe(function () {
            agendaPage.greyEnabled = !!msg.value;
            storageSet(STORE_GREY_ENABLED, agendaPage.greyEnabled ? '1' : '0');
            schedulePaint();
            pushPanelState(true);
          });
          return;
        case MSG.AGENDA_JUMP_DAY:   safe(function () { jumpToDay(msg.date, !!msg.always); }); return;
        case MSG.AGENDA_JUMP_WEEK:  safe(function () { jumpToWeek(); }); return;
        case MSG.AGENDA_OPEN_OCCURRENCE:
          safe(function () {
            var item = listUnfinished().find(function (i) { return i.id && i.id === msg.id; });
            if (item) openOccurrence(item.el);
          });
          return;
        case MSG.AGENDA_OPEN_LEAVE:
          // De dialoog draait in de pagina: alleen daar zijn de ONS-sessie en
          // het CSRF-token beschikbaar.
          safe(function () { if (leaveRequestEnabled()) openLeaveDialog(); });
          return;
        case MSG.AGENDA_CHECK_RANGE:
          checkOpenRange(msg.from, msg.to, function (done, total) {
            try { chrome.runtime.sendMessage({ type: MSG.AGENDA_RANGE_PROGRESS, kind: 'open', done: done, total: total }); } catch (e) {}
          }).then(function (result) {
            try { sendResponse({ ok: true, result: result }); } catch (e) {}
          }, function (e) {
            try { sendResponse({ ok: false, error: (e && e.message) || 'Controleren mislukt.' }); } catch (e2) {}
          });
          return true;
        case MSG.AGENDA_NEW_EVENT:
          try { sendResponse(openNewEvent(msg)); } catch (e) { try { sendResponse({ ok: false, error: 'Openen mislukt.' }); } catch (e2) {} }
          return;
        case MSG.AGENDA_FREE_SLOTS:
          findFreeSlots(msg.minutes, msg.weeks).then(function (result) {
            try { sendResponse({ ok: true, result: result }); } catch (e) {}
          }, function (e) {
            try { sendResponse({ ok: false, error: (e && e.message) || 'Zoeken mislukt.' }); } catch (e2) {}
          });
          return true;
        case MSG.AGENDA_WEEK_RATIO:
          fetchWeekRatio(msg.date).then(function (result) {
            try { sendResponse({ ok: true, result: result }); } catch (e) {}
          }, function (e) {
            try { sendResponse({ ok: false, error: (e && e.message) || 'Ophalen mislukt.' }); } catch (e2) {}
          });
          return true;
        case MSG.AGENDA_PRODUCTION:
          computeProduction(msg.from, msg.to, function (done, total) {
            try { chrome.runtime.sendMessage({ type: MSG.AGENDA_RANGE_PROGRESS, kind: 'productie', done: done, total: total }); } catch (e) {}
          }).then(function (result) {
            try { sendResponse({ ok: true, result: result }); } catch (e) {}
          }, function (e) {
            try { sendResponse({ ok: false, error: (e && e.message) || 'Berekenen mislukt.' }); } catch (e2) {}
          });
          return true;
        case MSG.AGENDA_QUICK_REGISTER:
          quickRegister(msg).then(function (r) {
            try { sendResponse(r); } catch (e) {}
          }, function () {
            try { sendResponse({ ok: false, error: 'Openen mislukt.' }); } catch (e) {}
          });
          return true;
        default: return;
      }
    });
  } catch (e) {}
}
// Bij het laden weten we nog niet of het zijpaneel openstaat; even vragen.
// Opstarten: bij het laden weten we nog niet of het zijpaneel openstaat; even vragen.
export function askSidePanelState() {
  try {
    chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function (r) {
      void chrome.runtime.lastError;
      if (r && r.open) setSidePanelOpen(true);
    });
  } catch (e) {}
}

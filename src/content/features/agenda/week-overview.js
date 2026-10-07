// Het weekoverzicht (declarabiliteit, tijd per uursoort/type) ophalen voor het
// zijpaneel.

import { pushPanelState } from './side-panel-bridge.js';
import { agendaPage } from './state.js';
import { currentCalendarView, currentInviteeId } from './navigation.js';
import { updateTotals } from './extension-sync.js';
import { currentAgendaDate, resolveInviteeId } from '../../ons/agenda-location.js';
import { ACTIVE_PROFILE } from '../../config/app-config.js';
import { _agIsFutureWeek, agendaWeekNumber } from '../../core/datetime.js';
import { declarabiliteitPct } from '../../domain/declarabiliteit.js';
import { _isClientUursoortName } from '../../domain/hour-types.js';
import {
  fetchInviteeWeek,
  fetchWeekRegistrationDeclarabiliteit,
} from '../../services/ons-api/calendar.js';
import { safe } from '../../screen/status.js';
import { summarizeAgendaWeek } from '../../domain/agenda-entries.js';

// Zoekt in de laatst opgehaalde API-entries of bij een DOM-afspraak (data-id) een
// cliënt gekoppeld is. Geeft true/false, of null als de afspraak niet gevonden is.
export function apiClientPresentById(id) {
  if (id == null || !agendaPage._agLastEntries.length) return null;
  var key = String(id);
  for (var i = 0; i < agendaPage._agLastEntries.length; i++) {
    if (String(agendaPage._agLastEntries[i].id) === key) return !!agendaPage._agLastEntries[i].clientPresent;
  }
  return null;
}
// Haalt het weekoverzicht op en bewaart het voor het zijpaneel. Tekent
// niets: dat doet agendapanel.js in het zijpaneel.
export function refreshAgendaWeekApi() {
  // De invitee-id uit de URL; anders uit de pagina; anders de laatst bekende.
  // Tijdens een wissel van weergave staat hij soms even nergens, en dan viel het
  // weekoverzicht weg.
  const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
  if (id) agendaPage._agLastInviteeId = id;
  const view = currentCalendarView();
  const date = currentAgendaDate();
  if (!id) { agendaPage._agWeekKey = null; agendaPage._agWeekLoaded = false; agendaPage._agLastWeek = null; agendaPage._agWeekError = ''; return; }
  const key = id + '|' + date + '|' + view;
  if (key === agendaPage._agWeekKey && agendaPage._agWeekLoaded) return;   // niets veranderd
  if (agendaPage._agWeekBusy && key === agendaPage._agWeekKey) return;      // al bezig met deze
  const andereWeek = (key !== agendaPage._agWeekKey);
  agendaPage._agWeekBusy = true; agendaPage._agWeekKey = key;
  if (andereWeek) {
    // Cijfers van de vorige week onder een nieuw weeknummer tonen is
    // misleidender dan een laadscherm.
    agendaPage._agLastWeek = null;
    agendaPage._agWeekError = '';
  }
  try { pushPanelState(true); } catch (e) {}   // 'bezig' meteen zichtbaar

  var prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
  var bewaar = function (summary, extraOpts) {
    var o = { week: agendaWeekNumber(date), embedded: true, scope: (view === 'day' ? 'dag' : 'week'), profile: prof, date: date };
    try { agendaPage._agLastDeclarabiliteit = declarabiliteitPct(summary, prof); } catch (e) { agendaPage._agLastDeclarabiliteit = null; }
    if (extraOpts) { for (var k in extraOpts) if (Object.prototype.hasOwnProperty.call(extraOpts, k)) o[k] = extraOpts[k]; }
    var allRows = summary.byType || [];
    var clientRows = [], overigRows = [];
    allRows.forEach(function (r) { if (r && r.type && !_isClientUursoortName(r.type)) overigRows.push(r); else clientRows.push(r); });
    agendaPage._agLastWeek = { summary: summary, opts: o, clientRows: clientRows, overigRows: overigRows };
    agendaPage._agWeekError = '';
    agendaPage._agWeekLoaded = true;
  };
  var errHandler = function (e) {
    if (agendaPage._agWeekKey !== key) return;
    agendaPage._agWeekLoaded = false;
    agendaPage._agLastWeek = null;
    // De fout hoort zichtbaar te zijn in het zijpaneel, niet stil te blijven.
    agendaPage._agWeekError = 'Overzicht kon niet laden: ' + ((e && e.message) || 'fout');
  };
  var klaar = function () { agendaPage._agWeekBusy = false; try { pushPanelState(true); } catch (e) {} };

  if (!_agIsFutureWeek(date)) {
    // DEZE WEEK of VERLEDEN: de ECHT geschreven tijd per uursoort uit de
    // registratie-details. De afspraken halen we óók op, zodat
    // 'Ongeregistreerde tijd per dag' blijft werken.
    fetchInviteeWeek(id, date).then(function (entries) { if (agendaPage._agWeekKey === key) agendaPage._agLastEntries = (entries || []).slice(); }, function () {}).then(function () { if (agendaPage._agWeekKey === key) safe(updateTotals); });
    fetchWeekRegistrationDeclarabiliteit(id, date).then(function (summary) {
      if (agendaPage._agWeekKey !== key) return;
      bewaar(summary, { perLabel: 'Per uursoort', headerHint: 'geregistreerd', scope: 'week', unknownLabel: 'Overig' });
    }).catch(errHandler).then(klaar);
  } else {
    // TOEKOMSTIGE week: planning per afspraaktype, alleen aankomende afspraken.
    fetchInviteeWeek(id, date).then(function (entries) {
      if (agendaPage._agWeekKey !== key) return; // ondertussen genavigeerd
      agendaPage._agLastEntries = entries.slice();
      if (view === 'day') entries = entries.filter(function (e) { return e.date === date; });
      var now = Date.now();
      entries = entries.filter(function (e) { return e.startMs == null || e.startMs >= now; });
      bewaar(summarizeAgendaWeek(entries));
    }).catch(errHandler).then(klaar);
  }
}

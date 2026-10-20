// Het weekoverzicht (declarabiliteit, tijd per uursoort/type) ophalen voor het
// zijpaneel.

import { pushPanelState } from './side-panel-bridge.js';
import { agendaPage } from './state.js';
import { currentCalendarView, currentInviteeId, currentInviteeIds, inviteeName } from './navigation.js';
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

// Haalt het weekoverzicht op en bewaart het voor het zijpaneel. Tekent
// niets: dat doet het zijpaneel (src/sidepanel/agenda-panel.js).
export function refreshAgendaWeekApi() {
  // De invitee-id uit de URL; anders uit de pagina; anders de laatst bekende.
  // Tijdens een wissel van weergave staat hij soms even nergens, en dan viel het
  // weekoverzicht weg.
  const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
  if (id) agendaPage._agLastInviteeId = id;
  // Meerdere agenda's naast elkaar: het overzicht per collega.
  const ids = currentInviteeIds().length > 1 ? currentInviteeIds() : (id ? [String(id)] : []);
  const view = currentCalendarView();
  const date = currentAgendaDate();
  if (!id) { agendaPage._agWeekKey = null; agendaPage._agWeekLoaded = false; agendaPage._agLastWeek = null; agendaPage._agWeekError = ''; return; }
  const key = ids.join(',') + '|' + date + '|' + view;
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

  const prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
  const toekomst = _agIsFutureWeek(date);
  const basisOpts = function () {
    return toekomst ? { week: agendaWeekNumber(date), embedded: true, scope: (view === 'day' ? 'dag' : 'week'), profile: prof, date: date }
      : { week: agendaWeekNumber(date), embedded: true, scope: 'week', profile: prof, date: date, perLabel: 'Per uursoort', headerHint: 'geregistreerd', unknownLabel: 'Overig' };
  };
  const splits = function (summary) {
    const clientRows = [], overigRows = [];
    (summary.byType || []).forEach(function (r) { if (r && r.type && !_isClientUursoortName(r.type)) overigRows.push(r); else clientRows.push(r); });
    return { clientRows: clientRows, overigRows: overigRows };
  };
  // Eén medewerker: geregistreerd (deze week en eerder) of gepland (later).
  const haal = function (inv, eerste) {
    if (!toekomst) {
      if (eerste) {
        // De afspraken ook ophalen, zodat de ongeregistreerde tijd per dag blijft werken.
        fetchInviteeWeek(inv, date).then(function (entries) { if (agendaPage._agWeekKey === key) agendaPage._agLastEntries = (entries || []).slice(); }, function () {}).then(function () { if (agendaPage._agWeekKey === key) safe(updateTotals); });
      }
      return fetchWeekRegistrationDeclarabiliteit(inv, date);
    }
    return fetchInviteeWeek(inv, date).then(function (entries) {
      if (eerste && agendaPage._agWeekKey === key) agendaPage._agLastEntries = entries.slice();
      if (view === 'day') entries = entries.filter(function (e) { return e.date === date; });
      const now = Date.now();
      entries = entries.filter(function (e) { return e.startMs == null || e.startMs >= now; });
      return summarizeAgendaWeek(entries);
    });
  };
  const errHandler = function (e) {
    if (agendaPage._agWeekKey !== key) return;
    agendaPage._agWeekLoaded = false;
    agendaPage._agLastWeek = null;
    // De fout hoort zichtbaar te zijn in het zijpaneel, niet stil te blijven.
    agendaPage._agWeekError = 'Overzicht kon niet laden: ' + ((e && e.message) || 'fout');
  };
  const klaar = function () { agendaPage._agWeekBusy = false; try { pushPanelState(true); } catch (e) {} };

  Promise.all(ids.map(function (inv, i) { return haal(inv, i === 0); })).then(function (summaries) {
    if (agendaPage._agWeekKey !== key) return;
    const o = basisOpts();
    try { agendaPage._agLastDeclarabiliteit = declarabiliteitPct(summaries[0], prof); } catch (e) { agendaPage._agLastDeclarabiliteit = null; }
    const eerste = splits(summaries[0]);
    agendaPage._agLastWeek = {
      summary: summaries[0], opts: o, clientRows: eerste.clientRows, overigRows: eerste.overigRows,
      // Per collega (ook bij één medewerker, dan met één element).
      perInvitee: summaries.map(function (s, i) { return { id: ids[i], name: ids.length > 1 ? inviteeName(ids[i]) : '', summary: s }; })
    };
    agendaPage._agWeekError = '';
    agendaPage._agWeekLoaded = true;
  }).catch(errHandler).then(klaar);
}

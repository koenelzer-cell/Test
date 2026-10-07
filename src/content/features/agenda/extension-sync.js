// Badge op het extensie-icoon en de momentopname voor de service worker
// (alleen getallen en datums).

import { pushPanelState } from './side-panel-bridge.js';
import { agendaPage } from './state.js';
import { computeTotals, computeTotalsApi } from './unregistered-time.js';
import { agendaWeekNumber } from '../../core/datetime.js';
import { currentAgendaDate } from '../../ons/agenda-location.js';
import { MSG } from '../../../shared/messages.js';

// Badge op het extensie-icoon: aantal openstaande verleden-dagen.
let _lastBadge = -1;
export function pushBadge(count) {
  if (count === _lastBadge) return;
  _lastBadge = count;
  try { chrome.runtime.sendMessage({ type: MSG.BADGE, count: count }); } catch (e) {}
}
// Laatst berekende declarabiliteit (gezet zodra het weekpaneel tekent), zodat
// de momentopname hem kan meenemen.
// Momentopname naar de service worker: die bewaart hem voor het zijpaneel en
// de herinnering, want die twee draaien ook als de agenda dicht is.
//
// PRIVACY: uitsluitend getallen en datums. Geen cliëntnamen, geen titels,
// geen labels — het zijpaneel hoeft niet te weten WIE er op de agenda staat,
// alleen hoeveel tijd er nog open staat.
let _lastSummaryKey = '';
function pushSummary(res) {
  try {
    const past = (res && res.past) || {};
    const days = Object.keys(past).map(function (d) {
      return { date: d, client: past[d].client | 0, overig: past[d].overig | 0, late: past[d].lateMin | 0 };
    }).filter(function (d) { return (d.client + d.overig) > 0; });
    const openMinutes = days.reduce(function (t, d) { return t + d.client + d.overig; }, 0);
    const lateMinutes = days.reduce(function (t, d) { return t + d.late; }, 0);
    const fut = (res && res.future) || { client: 0, overig: 0 };
    const dec = agendaPage._agLastDeclarabiliteit;
    const msg = {
      type: MSG.SUMMARY,
      openDays: days.length,
      openMinutes: openMinutes,
      lateMinutes: lateMinutes,
      futureMinutes: (fut.client | 0) + (fut.overig | 0),
      directPct: dec ? dec.pct : null,
      normPct: dec ? dec.targetPct : null,
      week: agendaWeekNumber(currentAgendaDate()) || null,
      days: days
    };
    // Alleen sturen bij een echte wijziging: dit draait elke 300 ms.
    const key = JSON.stringify(msg);
    if (key === _lastSummaryKey) return;
    _lastSummaryKey = key;
    chrome.runtime.sendMessage(msg);
  } catch (e) {}
}
// Rekent de ongeregistreerde tijd per dag door en geeft het resultaat
// door: badge, momentopname en het zijpaneel. Tekent zelf niets meer — de
// Agendahulp woont in het zijpaneel, niet in de pagina.
export function updateTotals(res) {
  res = res || ((agendaPage._agLastEntries && agendaPage._agLastEntries.length) ? computeTotalsApi() : computeTotals());
  var past = res.past || {};
  var dagen = Object.keys(past).filter(function (d) { return (past[d].client + past[d].overig) > 0; });
  pushBadge(dagen.length);
  pushSummary(res);
  pushPanelState();
}

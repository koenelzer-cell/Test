// Aan/uit op de agendapagina: alleen op /invitees en niet terwijl de
// afspraak-/registratiehulp actief is. Beheert observer en timers.

import { CLASS, removeAll, schedulePaint } from './painting.js';
import { agendaPage } from './state.js';
import { loadProfileFromStorage } from './profile.js';
import { computeTotals } from './unregistered-time.js';
import { pushBadge, updateTotals } from './extension-sync.js';
import { refreshAgendaWeekApi } from './week-overview.js';
import { preloadPanelData } from './preload.js';
import { APP_CONFIG, CONFIG } from '../../config/app-config.js';
import { MSG } from '../../../shared/messages.js';
import { clearPendingRegistration } from '../registration/pending-store.js';

const NEEDLE = '/invitees';
// Mag de agenda nu rekenen? Normaal alleen als het tabblad focus heeft. Maar
// klik je in het zijpaneel (bijv. 'Naar weekweergave'), dan heeft het zijpaneel
// de focus en niet de pagina; zonder deze uitzondering bleef het weekoverzicht
// dan leeg tot je in de pagina klikte.
function paginaActief() {
  if (document.hasFocus()) return true;
  return !!agendaPage.sidePanelOpen && document.visibilityState === 'visible';
}
function activateAgendaPage() {

  if (agendaPage.active) return;
  agendaPage.active = true;
  // Terug op de agenda: een onthouden (afgeronde/vorige) registratievorm vergeten,
  // zodat een volgende nieuwe registratie schoon begint.
  try { clearPendingRegistration(); } catch (e) {}
  loadProfileFromStorage();
  schedulePaint();
  agendaPage.observer = new MutationObserver((muts) => {
    // negeer onze eigen overlay-mutaties
    const own = muts.every((m) => {
      const t = m.target;
      return t && t.classList && t.classList.contains(CLASS);
    });
    if (!own) schedulePaint();
  });
  agendaPage.observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', schedulePaint);
  // De MutationObserver hierboven vangt vrijwel alle wijzigingen op; een
  // rustige 250ms-fallback dekt gevallen die geen DOM-mutatie geven
  // (bijv. layout-only). 20×/sec verven is niet nodig.
  if (!agendaPage.pollTimer) agendaPage.pollTimer = setInterval(function () { if (paginaActief()) schedulePaint(); }, 250);
  // Elke 300 ms de ongeregistreerde tijd per dag herberekenen (+ badge,
  // ook als de popup is ingeklapt).
  if (!agendaPage.totalsTimer) agendaPage.totalsTimer = setInterval(function () {
    if (!paginaActief()) return; // niets doen als het tabblad niet actief is (zijpaneel open telt als actief)
    try {
      // Eén berekening per tik: badge en totalen delen dezelfde uitkomst.
      const res = computeTotals();
      const cnt = Object.keys(res.past).filter((d) => (res.past[d].client + res.past[d].overig) > 0).length;
      pushBadge(cnt);
      updateTotals(res);
      refreshAgendaWeekApi(); // API-weekoverzicht (dedupe: haalt alleen bij wijziging)
      // Daarna rustig vooraf laden voor het zijpaneel (hooguit eens per 2 min).
      if (agendaPage._agWeekLoaded && !agendaPage._agWeekBusy) preloadPanelData();
    } catch (e) {}
  }, 300);
}
export function deactivateAgendaPage() {
  if (!agendaPage.active) return;
  agendaPage.active = false;
  if (agendaPage.observer) { agendaPage.observer.disconnect(); agendaPage.observer = null; }
  if (agendaPage.pollTimer) { clearInterval(agendaPage.pollTimer); agendaPage.pollTimer = null; }
  if (agendaPage.totalsTimer) { clearInterval(agendaPage.totalsTimer); agendaPage.totalsTimer = null; }
  pushBadge(0); // badge wissen zodra we de agenda verlaten
  // Het zijpaneel toont anders een bevroren overzicht van een pagina die we
  // net verlaten hebben.
  try { agendaPage._agStateSig = ''; if (agendaPage.sidePanelOpen) chrome.runtime.sendMessage({ type: MSG.AGENDA_GONE }); } catch (e) {}
  window.removeEventListener('resize', schedulePaint);
  removeAll();
}
function helperScreenActive() {
  // Afspraak-/registratiehulp draait op deze routes.
  return location.href.includes(CONFIG.urlNeedle) || location.href.includes(CONFIG.registrationNeedle);
}
export function syncAgendaPage() {
  if (APP_CONFIG.features && APP_CONFIG.features.dayColoring === false) deactivateAgendaPage();
  else if (location.href.includes(NEEDLE) && !helperScreenActive()) activateAgendaPage();
  else deactivateAgendaPage();
}

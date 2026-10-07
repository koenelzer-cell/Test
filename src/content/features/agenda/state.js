import { storageGet } from '../../storage/page-prefs.js';
import { PAGE_LOCAL } from '../../../shared/storage-keys.js';

// Gedeelde toestand van de agendapagina.

export const STORE_GREY_ENABLED = PAGE_LOCAL.GREY_ENABLED;
/* Toestand van de agendapagina. Gedeeld door de inkleuring, de totalen, het
   weekoverzicht en de koppeling met het zijpaneel. */
export const agendaPage = {
  active: false,              // draait de agendahulp op deze pagina?
  observer: null,             // MutationObserver die de inkleuring bijwerkt
  pollTimer: null,            // rustige terugval-tik voor de inkleuring
  totalsTimer: null,          // 300 ms-tik: ongeregistreerde tijd, badge, zijpaneel
  greyEnabled: storageGet(STORE_GREY_ENABLED, '1') !== '0', // gekleurde dagindeling aan/uit
  // Het gekozen profiel komt uit de extensie-popup (chrome.storage.sync, zodat
  // de keuze meereist naar andere apparaten). Async geladen, live bijgewerkt.
  currentProfile: null,
  // Weekoverzicht (API) voor het zijpaneel
  _agLastWeek: null,          // laatst opgehaalde weekoverzicht
  _agWeekError: '',           // laatste ophaalfout, zodat het zijpaneel hem kan tonen
  _agWeekKey: null, _agWeekBusy: false, _agWeekLoaded: false,
  _agLastEntries: [],         // laatst opgehaalde week-entries (voor cliënt-check "nog te registreren")
  // Laatst berekende declarabiliteit (gezet zodra het weekoverzicht er is), zodat
  // de momentopname hem kan meenemen.
  _agLastDeclarabiliteit: null,
  sidePanelOpen: false,
  // Open registraties volgens ONS zelf (teller-endpoint); null = onbekend.
  onsOpenCount: null,
  _onsOpenCountTs: 0,         // tijdstip van de laatste ophaalpoging
  _agStateSig: '',            // laatst uitgezonden toestand (alleen bij wijziging zenden)
};

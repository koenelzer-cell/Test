// Gedeelde toestand van de hulp: het paneel, de afspraakhulp en de
// registratiehulp. Elke module die deze toestand leest of schrijft, importeert
// hem hier.

import { storageGet, STORE_HELPER_ENABLED } from './storage/page-prefs.js';

export let agendaHelperDeactivate = null; // wordt door startDayColoring gezet
export function setAgendaHelperDeactivate(fn) { agendaHelperDeactivate = fn; }
/* ===== Gedeelde toestand van de hulp =====
   Alle toestand die door meerdere onderdelen gelezen én geschreven wordt,
   staat in deze drie objecten — niet meer als losse variabelen verspreid door
   het bestand. Zo is zichtbaar WAT er gedeeld wordt en wie de eigenaar is.

     helperPanel      — het zwevende hulppaneel op de pagina (in de code ook
                        "popup" genoemd; NIET de extensiepopup) en de modus.
     appointmentFlow  — de afspraakhulp (/events/new).
     registrationFlow — de registratiehulp (/registrations/…).

   Alles wordt bij deactivate() teruggezet; zie aldaar.
   ========================================================================== */
export const helperPanel = {
  popupEl: null,              // het paneel-element, of null als het niet staat
  observer: null,             // MutationObserver die het paneel herstelt (zie activate)
  active: false,              // hulp actief op deze pagina
  activeMode: null,           // 'events' | 'registrations' | null
  repositionTimer: null,
  // Slepen + positie
  userPos: null, dragging: false, dragDX: 0, dragDY: 0, popupDragMoved: false,
  // Stabiliteit van de standaard rechterpositie: zie defaultPopupRight().
  _lastRightPanel: null, _lastRightValue: null,
  popupCollapsed: false,
  helperEnabled: storageGet(STORE_HELPER_ENABLED, '1') !== '0',   // aan/uit-schakelaar van de medewerker
  // Korte periode waarin de automatische refresh NIET van scherm mag wisselen,
  // zodat een handmatige klik (bv. Terug op de opslaanpagina) blijft staan i.p.v.
  // meteen weer overschreven te worden.
  suppressAutoUntil: 0,
  lastDomMutationAt: 0,       // laatste NIET-eigen DOM-mutatie (voor "pagina rustig?")
  // Scherm om naar terug te keren na het info-/uitgeschakeld-/beschikbaarheidsscherm.
  _infoPanelRestore: null, _disabledRestore: null, _availabilityRestore: null,
};
export const appointmentFlow = {
  pendingChoice: null,        // gekozen afspraaktype (choice) in behandeling
  planhulpVullenSinds: 0,     // > 0: het formulier uit de planhulp wordt nog ingevuld (tijdstip)
  planhulpVerder: null,       // formulier uit de planhulp wacht op een cliënt: deze functie gaat verder zodra die er is
  clientWaitTimer: null,
  activeAppointmentDurationMinutes: null,
  activeAppointmentStartTimeText: '',
  appointmentTimeGuardTimers: [],
  // Eindtijd-guard: `helperEndText` = de laatste eindtijd die de hulp zelf schreef.
  // Wijkt de eindtijd daar later van af, dan heeft de medewerker hem handmatig
  // aangepast (`appointmentEndTimeUserOwned`) en zet de hulp hem NIET meer terug
  // (bv. bij het toevoegen van een herhaling, dat de opslaanpagina herbouwt).
  helperEndText: '',
  appointmentEndTimeUserOwned: false,
  // True zodra een afspraaktype ECHT is toegepast (handleChoice draaide: titel/
  // label/uursoort gezet). Alleen dán de andere types blokkeren. Klik je Huisbezoek
  // en ga je meteen terug (geen duur gekozen), dan is dit nog false -> geen blokkade.
  appointmentTypeApplied: false,
  appointmentFlowBusy: false,
  // Actief zolang de per-cliënt uursoort-keuzelijst getoond wordt (kan bij
  // meerdere cliënten langer duren dan de appointmentFlowBusy-timeout). Zolang
  // dit aan staat mag de periodieke refresh het scherm niet terugzetten.
  uursoortQueueActive: false,
  // Generatie van de uursoort-wachtrij. clearSettings en (her)mount verhogen dit,
  // zodat een lopende wachtrij (die op eigen timers draait) zichzelf afbreekt.
  uursoortQueueGen: 0,
  // Expliciete schermstatus i.p.v. tekstherkenning: voorkomt dat de 250ms-refresh
  // de opslaanpagina (en zijn Terug-knop) onder de muis herbouwt.
  appointmentSaveScreenActive: false,
  // 'Afspraak doorplannen?'-intentie op de opslaanpagina. De bijbehorende
  // waarschuwing loopt via het algemene meldingenkanaal (helperQualityIssues);
  // een lichte bewaking hertekent de opslaanpagina zodra de blokkade omslaat
  // (herhaling gekozen/weggehaald), zodat knop en status live meelopen.
  appointmentDoorplannen: false, doorplannenLastBlocked: null, doorplannenSuppressAutoUntil: 0,
  doorplannenLastRecurrenceSet: false, doorplannenLastExpanded: false,
  knownClientNames: new Set(), autoSelectingNewClient: false,
  appointmentAvailabilityConfirmedPeople: new Set(), appointmentForceChoiceOnce: false,
  // Alleen true tijdens de bewuste "Cliënt toevoegen"-knop van de helper. Alle
  // andere synthetische kliks op de ONS "+ Toevoegen"-knop worden geweerd, zodat
  // een blinde klik (dropdown sluiten e.d.) niet per ongeluk de zoek-genodigden
  // modal opent.
  intentionalAddClientClick: false,
  // Tijdstip tot wanneer het openen van de zoek-genodigden-modal is toegestaan:
  // gezet door een echte gebruikersklik op de ONS "+ Toevoegen"-knop of door de
  // bewuste helper-knop. Buiten dit venster geldt een geopende modal als een
  // ongewenst neveneffect en wordt hij automatisch gesloten.
  allowInviteeModalUntil: 0,
  // Vrije/grijze dag: als de afspraak vanuit een grijs gemarkeerde kolom is
  // geopend, mag de afspraakhulp niet optreden (geen keuzes, geen opslaanblokkade).
  appointmentFreeDay: false, appointmentFreeDayDate: null,
  appointmentClearingSettings: false, appointmentAwaitingManualUursoort: false,
  // Niet-cliëntgebonden afspraken
  activeNonClientOption: null,
  nonClientBusy: false,
  nonClientFreeTitleScreenActive: false,   // 'Overig': vrij-titel-scherm actief
  nonClientNoUursoortActive: false,        // niet-client uursoort niet gevonden: foutpagina actief
};
export const registrationFlow = {
  registrationTravelClicked: false,
  registrationNoShowPromptOpen: false, registrationNoShowPromptSuppressed: false, registrationNoShowPromptAfterNo: null,
  registrationEpisodesPromptOpen: false, registrationEpisodesPromptSuppressed: false,
  registrationHourTypeBusy: false,   // voorkomt glitch: screen niet overschrijven terwijl uursoorten laden
  registrationFlowBusy: false,       // voorkomt glitch: screen niet overschrijven terwijl flow navigeert (reistijd → uursoort e.d.)
  activeRegistrationChoice: null, reapplyRegistrationSplitTimer: null, activeRegistrationHourTypeIndex: null,
  activeRegistrationPortionMinutes: null, // tegen-tijd (indirect/direct) in minuten, of null
  // Registratie gestart vanuit een afspraak: het afspraaklabel bepaalt de
  // registratievorm (en dus direct/indirect), zodat de vorm-keuze wordt
  // overgeslagen. Zonder afspraak blijven deze null/false en verandert er niets.
  registrationAutoChoice: null,        // gekoppelde REGISTRATION_CHOICES-entry, of null
  registrationFromAppointment: false,  // label van een afspraak is uitgelezen
  registrationAutoApplied: false,      // vorm al één keer automatisch toegepast
  registrationRestoredToReport: false, // na refresh hersteld: direct naar het rapportagescherm
  registrationExtrasRestored: false,   // direct/indirect + reistijd al één keer teruggezet na refresh
  registrationSettleTimer: null,       // her-check terwijl we wachten tot de pagina rustig is
  registrationRestoreHoldStart: 0,     // start van het wachten-op-laden (veiligheidscap)
};

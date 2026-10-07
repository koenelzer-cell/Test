// Registratie vanuit een afspraak: het afspraaklabel onthouden
// (sessionStorage) en na navigatie/refresh terugzetten.

import { ONS } from '../../ons/selectors.js';
import { APP_CONFIG, REGISTRATION_CHOICES } from '../../config/app-config.js';
import { laatsteDetailsLabels, warmPopoverDetails } from '../../services/ons-api/event-details.js';
import { clean } from '../../ons/dom.js';
import { inputTextValue } from '../../ons/form-controls.js';
import { registrationFlow } from '../../state.js';
import { safe } from '../../screen/status.js';
import {
  clickRegistrationTravelTimeButton,
  registrationDirectTimeInput,
  registrationIndirectTimeInput,
  registrationTravelInput,
  scheduleReapplyRegistrationSplit,
  setRegistrationTimeSplit,
  setRegistrationTravelTotalMinutes,
} from './fields.js';
import { _regToMin } from './completeness.js';
import { ensureActiveRegistrationReportPrefix } from './report.js';
import { ctxForcedVorm } from './context-menu.js';
import { PAGE_SESSION } from '../../../shared/storage-keys.js';

// ===== Afspraaklabel -> registratievorm =====
export const PENDING_REG_KEY = PAGE_SESSION.PENDING_REGISTRATION;
// Id (occurrence) van de HUIDIGE registratie uit de URL — robuust voor beide vormen:
// /registrations/{id}/edit én /calendar/invitee/{x}/registrations/{id}/...
let _regIdOverride = null; // testhaak
export function setRegistrationIdOverride(v) { _regIdOverride = (v == null ? null : String(v)); }
export function currentRegistrationId() {
  if (_regIdOverride != null) return _regIdOverride;
  const m = (location.pathname || '').match(/\/registrations\/([^/?#]+)/);
  return m ? m[1] : null;
}
// Vergeet de onthouden registratievorm/tijden (bij indienen of terug naar de agenda).
export function clearPendingRegistration() { try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} }
// Koppelt een ONS-afspraaklabel (bv. "JG Huisbezoek") aan een registratievorm
// uit REGISTRATION_CHOICES. Onbekende labels (bv. Telefonisch/Digitaal, dat
// geen eigen registratievorm heeft) geven null -> geen automatische route.
export function matchRegistrationChoiceByLabel(label) {
  const c = clean(label);
  if (!c) return null;
  // Koppeling zit nu in de registratievorm zelf (APP_CONFIG.registrationForms[].labels).
  // Een vorm matcht als het afspraaklabel één van zijn gekoppelde labels bevat.
  for (const form of (APP_CONFIG.registrationForms || [])) {
    const labels = Array.isArray(form.labels) ? form.labels : [];
    const hit = labels.some((w) => { const cw = clean(w); return !!cw && c.indexOf(cw) !== -1; });
    if (hit) return REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(form.vorm)) || null;
  }
  return null;
}
// Het afspraaklabel uit de OPMAAK van de detailpopup. Vangnet voor als de
// details-API niets opleverde. Kent drie opmaken:
//   1) oud:    <div class="labels"><span class="label" title="JG Huisbezoek">
//   2) nieuw:  <section data-qa="occurrence-popover-details"> … <uc-tag>
//              <span class="agenda-icon-home"></span> JG Huisbezoek</uc-tag>
//   3) heel oud: de '.description' ("Huisbezoek - Tamara").
// Bij (2) staat er een icoon-<span> vóór de tekst; die is leeg, maar we halen
// 'm er expliciet uit zodat een icoonlettertype nooit in het label belandt.
export function popoverLabelFromDom(scope) {
  const root = scope || document;
  // Alleen witruimte normaliseren: het label wordt bewaard en later getoond,
  // dus de eigen schrijfwijze ("JG Huisbezoek") blijft staan. Het vergelijken
  // met de ingestelde etiketten gebeurt verderop hoofdletterongevoelig.
  const trim = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const withTitle = root.querySelector(ONS.labelWithTitle);
  if (withTitle) {
    const t = trim(withTitle.getAttribute('title'));
    if (t) return t;
  }
  for (const tag of root.querySelectorAll(ONS.popoverLabelTag)) {
    let txt = '';
    for (const node of tag.childNodes) {
      if (node.nodeType === 3) txt += node.textContent;                       // tekst
      else if (node.nodeType === 1 && !/^agenda-icon-/.test(node.className || '')) txt += node.textContent;
    }
    const c = trim(txt);
    if (c) return c;
  }
  const desc = root.querySelector('.description');
  if (desc) return trim((desc.textContent || '').split(' - ')[0]);
  return '';
}
// Vangt het label + registratie-id van een geopende afspraak-detailpopup zodra
// 'Registreren' wordt geklikt en bewaart dit (sessionStorage) tot de
// registratiepagina laadt.
//
// BRONVOLGORDE: eerst de details-API (labels[].name uit de LAATSTE
// /events/{occurrence}/details-call — dat is de popup die nu open staat),
// daarna pas de opmaak. ONS herbouwt de popup regelmatig; het API-veld is
// stabiel gebleven. Zonder deze volgorde viel de koppeling afspraak ->
// tijdsverdeling weg zodra de detailpagina veranderde.
export function capturePendingRegistrationLabel(fromEl) {
  try {
    const scope = (fromEl && fromEl.closest && fromEl.closest(ONS.popoverRoot)) || document;
    // 1) API: de eerste labelnaam die naar een registratievorm te herleiden is,
    //    anders gewoon de eerste labelnaam.
    const apiLabels = laatsteDetailsLabels();
    let label = apiLabels.find((l) => !!matchRegistrationChoiceByLabel(l)) || apiLabels[0] || '';
    // 2) De opmaak van de popup: vangnet én controle. De popup die op het
    //    scherm staat is de afspraak die je registreert; de API-bron kan (tot
    //    vijf minuten) nog van een eerder geopende afspraak zijn. Wijzen ze
    //    naar een ANDERE registratievorm, dan wint het scherm.
    const domLabel = popoverLabelFromDom(scope);
    if (!label) label = domLabel;
    else if (domLabel) {
      const a = matchRegistrationChoiceByLabel(label), b = matchRegistrationChoiceByLabel(domLabel);
      if (b && (!a || a.label !== b.label)) label = domLabel;
    }
    // Zonder label én zonder eigen keuze valt er niets te onthouden. MET een
    // eigen keuze juist wel: een afspraak zónder label is precies waarvoor het
    // rechtermuismenu bedoeld is.
    const forcedVooraf = ctxForcedVorm();
    if (!label && !forcedVooraf) return;
    let id = null;
    const declare = scope.querySelector('[data-qa="declare_button"][data-qa-url], [data-qa-url*="/registrations/"]');
    const urlAttr = declare && declare.getAttribute('data-qa-url');
    const mm = urlAttr && urlAttr.match(/\/registrations\/([^/]+)\/edit/);
    if (mm) id = mm[1];
    // Een expliciete keuze uit het rechtermuismenu wint van het afspraaklabel:
    // de gebruiker heeft net zelf gezegd welke vorm het moet zijn.
    const bewaard = { id: id, label: label, ts: Date.now() };
    if (forcedVooraf) bewaard.forcedVorm = forcedVooraf;
    sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(bewaard));
  } catch (e) {}
}
// Laadt (en verbruikt) het bewaarde afspraaklabel voor de huidige registratie.
// Zet registrationAutoChoice/-FromAppointment als het label bij deze
// registratie hoort en matcht met een registratievorm.
export function loadPendingRegistrationLabel() {
  registrationFlow.registrationAutoChoice = null;
  registrationFlow.registrationFromAppointment = false;
  registrationFlow.registrationAutoApplied = false;
  registrationFlow.registrationRestoredToReport = false;
  registrationFlow.registrationExtrasRestored = false;
  let raw = null; try { raw = sessionStorage.getItem(PENDING_REG_KEY); } catch (e) { return; }
  if (!raw) return;
  let data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
  if (!data || (!data.label && !data.vorm && !data.forcedVorm)) return;
  const curId = currentRegistrationId();
  // Andere registratie dan waarvoor we iets onthielden -> vergeten. Zo herstelt een
  // net afgeronde/vorige registratie NIET op een nieuwe, lege registratie.
  if (data.id && curId) { if (data.id !== curId) { clearPendingRegistration(); return; } }
  else if (!data.ts || (Date.now() - data.ts) > 10 * 60 * 1000) { return; }
  // Expliciet gekozen via het rechtermuismenu: dit is een VERSE koppeling, geen
  // herstel. Daarom via registrationAutoChoice -> de volledige auto-apply
  // (reistijd, rapportageprefix, portievragen) draait gewoon. Staat bewust
  // vóór de data.vorm-tak hieronder, want die herstelt alleen.
  if (data.forcedVorm) {
    const gekozen = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(data.forcedVorm));
    if (gekozen) { registrationFlow.registrationAutoChoice = gekozen; registrationFlow.registrationFromAppointment = true; return; }
  }
  // De koppeling wordt NIET meer weggegooid, zodat de gekozen vorm een pagina-
  // refresh overleeft (anders "zijn de instellingen voor de vorm weg").
  if (data.vorm) {
    // Al eerder toegepast: licht herstellen zodat de hulp de vorm weer kent en de
    // directe/indirecte verdeling opnieuw (idempotent) toepast — ZONDER de volledige
    // flow opnieuw te draaien (geen dubbele reistijd/rapportage-prefix).
    const restored = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(data.vorm));
    if (restored) {
      registrationFlow.activeRegistrationChoice = restored;
      registrationFlow.registrationFromAppointment = true;
      registrationFlow.registrationAutoApplied = true;
      registrationFlow.registrationRestoredToReport = true; // hulp herkent de vorm -> rapportagescherm i.p.v. keuzemenu
      registrationFlow.registrationRestoreHoldStart = Date.now(); // start "wachten tot de pagina rustig is"
      scheduleReapplyRegistrationSplit();
      // Rapportage-prefix meteen (opnieuw) zetten; het veld is bij mount niet altijd
      // direct klaar, dus kort herproberen (idempotent: dubbelt de prefix niet).
      [0, 200, 500, 1000].forEach((d) => setTimeout(() => safe(() => ensureActiveRegistrationReportPrefix()), d));
    }
    return;
  }
  // Eerste keer vanuit de afspraak: label -> vorm, daarna éénmalige volledige auto-apply.
  const choice = matchRegistrationChoiceByLabel(data.label);
  if (choice) { registrationFlow.registrationAutoChoice = choice; registrationFlow.registrationFromAppointment = true; }
}
// Onthoud de gekozen registratievorm (per registratie-id) zodat een refresh 'm
// kan herstellen. Overschrijft de eerste label-koppeling zodra een vorm is toegepast.
export function persistRegistrationForm(choice) {
  if (!choice) return;
  try {
    const rid = currentRegistrationId();
    // Verse keuze: de vorm bewaren en de tijd-extra's (direct/indirect/reistijd) resetten;
    // de flow vult ze zo weer via persistRegistrationTimes().
    sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({ id: rid, vorm: choice.label, ts: Date.now() }));
  } catch (e) {}
}
// Merge een deel in het bewaarde registratierecord (alleen als er al een vorm/label bij hoort).
function updatePendingReg(patch) {
  try {
    let cur = null; const raw = sessionStorage.getItem(PENDING_REG_KEY);
    if (raw) { try { cur = JSON.parse(raw); } catch (e) { cur = null; } }
    if (!cur || (!cur.vorm && !cur.label)) return;
    sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(Object.assign(cur, patch, { ts: Date.now() })));
  } catch (e) {}
}
// Onthoud de HUIDIGE directe/indirecte tijd + totale reistijd. Dit zijn deels
// handmatige keuzes die ONS bij een refresh leegt; zo kunnen we ze terugzetten.
export function persistRegistrationTimes() {
  try {
    const d = _regToMin(inputTextValue(registrationDirectTimeInput()));
    const i = _regToMin(inputTextValue(registrationIndirectTimeInput()));
    const th = _regToMin(inputTextValue(registrationTravelInput('heen')));
    const tt = _regToMin(inputTextValue(registrationTravelInput('terug')));
    updatePendingReg({ direct: (d == null ? null : d), indirect: (i == null ? null : i), travel: (th || 0) + (tt || 0) });
  } catch (e) {}
}
// Zet de bewaarde directe/indirecte verdeling + reistijd terug na een refresh,
// één keer, met retries (de velden zijn net na 'settle' nog niet altijd klaar).
export function restoreRegistrationExtras() {
  if (registrationFlow.registrationExtrasRestored) return;
  registrationFlow.registrationExtrasRestored = true;
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem(PENDING_REG_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) return;
  const dMin = (typeof data.direct === 'number') ? data.direct : null;
  const iMin = (typeof data.indirect === 'number') ? data.indirect : null;
  if (dMin != null || iMin != null) {
    [0, 250, 700].forEach((ms) => setTimeout(() => safe(() => setRegistrationTimeSplit({ directMinutes: dMin, indirectMinutes: iMin })), ms));
  }
  if (typeof data.travel === 'number' && data.travel > 0) {
    const applyTravel = () => {
      // Reistijdrij toevoegen als die na de refresh weg is, daarna de totale reistijd zetten.
      if (!registrationTravelInput('heen') && !registrationTravelInput('terug')) clickRegistrationTravelTimeButton();
      setRegistrationTravelTotalMinutes(data.travel);
    };
    [0, 300, 800, 1400].forEach((ms) => setTimeout(() => safe(applyTravel), ms));
  }
}
// Vang het afspraaklabel zodra vanaf de agenda op 'Registreren' wordt geklikt
// (detailpopup van een afspraak). Globaal, want dit gebeurt op de agenda waar
// de afspraak-/registratiehulp nog niet actief is.
//
// De Registreren-knop is in de nieuwe popup een <uc-button> met een eigen
// shadow root. Een klik op de knop ín die shadow root komt bij een listener op
// document aan met e.target = de <uc-button> zelf (event-retargeting), dus
// closest() op de host-selector volstaat.
// Opstarten: klik op Registreren / een afspraak in de agenda opvangen.
export function installDeclareClickCapture() {
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const btn = t.closest(ONS.declareTrigger);
    if (btn) { capturePendingRegistrationLabel(btn); return; }
    // Klik op een afspraak in de agenda: de detailpopup gaat open. Warm de
    // labels alvast op, zodat ze klaarstaan als er daarna op Registreren wordt
    // geklikt (no-op als ONS' eigen details-call al is gezien).
    if (t.closest(ONS.occurrenceBase)) {
      [120, 500].forEach((d) => setTimeout(() => safe(() => {
        const pop = document.querySelector(ONS.popoverRoot);
        if (pop) warmPopoverDetails(pop);
      }), d));
    }
  }, true);
}

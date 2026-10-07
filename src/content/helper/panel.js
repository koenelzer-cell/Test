// Het zwevende hulppaneel zelf: opbouwen, positioneren, slepen,
// in-/uitklappen, aan de ONS-modal hangen.

import { rect, visible } from '../ons/dom.js';
import { invalidateClientEntries } from '../ons/appointment-form.js';
import { setSubmitBlocked, updateSubmitGuard } from '../features/appointment/submit-guard.js';
import {
  refreshFreeDayFromBackgroundCalendar,
  showFreeDayInactive,
} from '../features/appointment/free-day.js';
import { ensureClientExpanded, hasClientInAppointment } from '../features/appointment/clients.js';
import { handleClientListChanges } from '../features/appointment/uursoort-queue.js';
import { storageSet, STORE_HELPER_ENABLED } from '../storage/page-prefs.js';
import { guardInviteeAddButton } from '../features/appointment/invitee-guard.js';
import { appointmentFlow, helperPanel } from '../state.js';
import { safe, showDisabledState, showLoadingState } from '../screen/status.js';
import { createCurrentScreenRestore, refreshMainScreen } from './screen-restore.js';
import {
  refreshAppointmentPrereqScreen,
  resumeAppointmentHelperAfterEnable,
} from '../features/appointment/prereqs.js';
import { onsahFocusRing } from '../ui/theme.js';
import { setChevronIcon, svgInfoIcon, svgSpineCheck, svgSpinePause } from '../ui/icons.js';
import { toggleInfoPanel } from './info-panel.js';
import { findModal } from '../ons/modal.js';
import { refreshRegistrationPrereqScreen } from '../features/registration/prereqs.js';
import {
  setRegistrationSubmitBlocked,
  updateRegistrationSubmitGuard,
} from '../features/registration/report.js';
import {
  checkRegistrationEpisodesText,
  checkRegistrationNoShowText,
} from '../features/registration/prompts.js';
import { SCRIPT_VERSION } from '../../shared/version.js';

// Klapt het paneel ZIJWAARTS in/uit (breedte naar 0, spine blijft altijd
// zichtbaar) i.p.v. het oude verticaal inklappen van de inhoud.
function setPopupCollapsed(collapsed) {
  helperPanel.popupCollapsed = collapsed;
  if (!helperPanel.popupEl) return;
  const mainCol = helperPanel.popupEl.querySelector('[data-popup-maincol]');
  const toggle = helperPanel.popupEl.querySelector('[data-collapse-toggle]');
  const spine = helperPanel.popupEl.querySelector('[data-popup-spine]');
  if (mainCol) {
    mainCol.style.width = collapsed ? '0' : '280px';
    mainCol.style.minWidth = collapsed ? '0' : '280px';
    mainCol.style.opacity = collapsed ? '0' : '1';
    mainCol.style.pointerEvents = collapsed ? 'none' : 'auto';
  }
  if (toggle) {
    setChevronIcon(toggle, collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Hulp uitklappen' : 'Hulp inklappen');
  }
  if (spine) spine.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  // Na de animatie (of meteen als er niet geanimeerd wordt) opnieuw binnen
  // het scherm klemmen: de breedte is veranderd, dus de rand kan anders vallen.
  requestAnimationFrame(() => safe(reclampToViewport));
}
function clampPos(left, top) {
  const w = (helperPanel.popupEl && helperPanel.popupEl.offsetWidth) || 280;
  const h = (helperPanel.popupEl && helperPanel.popupEl.offsetHeight) || 200;
  const maxLeft = Math.max(8, window.innerWidth - w - 8);
  const maxTop = Math.max(8, window.innerHeight - h - 8);
  return {
    left: Math.min(Math.max(8, left), maxLeft),
    top: Math.min(Math.max(8, top), maxTop),
  };
}
// Vaste afstand tot de bovenkant van het scherm: de hulp opent bovenaan
// (10% van de vensterhoogte), niet onderaan — zo is er maximale ruimte
// voor de inhoud (bv. alle afspraaktypes in één keer zichtbaar).
function defaultPopupTop() { return Math.round(window.innerHeight * 0.10); }
// Maximale hoogte: de onderkant van de hulp komt nooit lager dan 90% van
// de vensterhoogte (dus 10% marge boven én onder). Past de inhoud niet
// binnen die 80%, dan scrollt de hulp intern (zie de body-stijl in buildPopup).
function popupMaxHeight() {
  return Math.max(160, Math.round(window.innerHeight * 0.90) - defaultPopupTop());
}
// Berekend als CSS `right` (afstand tot de rechterkant van het venster) —
// bewust NIET via `left` + de eigen breedte: die breedte verandert continu
// tijdens het zijwaarts in-/uitklappen, en `reposition()` draait zeer vaak
// (elke mutatie/scroll). Een op-breedte-gebaseerde `left` gaf daardoor af en
// toe een verkeerde tussentijdse positie ("naar links springen"). `right`
// is onafhankelijk van de eigen breedte, dus altijd stabiel — de hulp klapt
// zo altijd naar rechts (tegen de ONS-modal aan) in en uit.
//
// Extra robuustheid, want findModal()'s heuristiek zoekt/sorteert bij elke
// aanroep opnieuw en kan tijdens een korte overgang (bv. terwijl de ONS-
// modal zelf nog aan het open-animeren is, of een ander dialoogje even
// meetelt) een net iets ander paneel/rect teruggeven dan de vorige keer —
// dat gaf soms een plotselinge sprong ("verspringt buiten de modal").
// Daarom: (1) hergebruik hetzelfde gevonden paneel zolang het nog bestaat
// en zichtbaar is i.p.v. elke keer opnieuw te zoeken, (2) negeer kleine
// schommelingen (< 4px) in de berekende waarde, en (3) klem de uitkomst
// altijd binnen het zichtbare scherm, zodat de spine nooit echt van het
// scherm af kan vallen, wat er ook misgaat in de berekening.
function defaultPopupRight() {
  let panel = helperPanel._lastRightPanel;
  if (!panel || !panel.isConnected || !visible(panel)) {
    const m = findModal();
    panel = (m && m.panel) || null;
    helperPanel._lastRightPanel = panel;
  }
  let raw = 24;
  if (panel) {
    const r = rect(panel);
    if (r.width > 0) raw = Math.round(window.innerWidth - r.right + 24);
  }
  const clamped = Math.max(8, Math.min(raw, window.innerWidth - 40));
  if (helperPanel._lastRightValue != null && Math.abs(clamped - helperPanel._lastRightValue) < 4) return helperPanel._lastRightValue;
  helperPanel._lastRightValue = clamped;
  return clamped;
}
// Herpositioneer na een layout-/inhoudswijziging, met verse hoogtemeting.
function reclampToViewport() {
  if (!helperPanel.popupEl) return;
  if (!helperPanel.userPos) { reposition(); return; }
  const r = rect(helperPanel.popupEl);
  const h = helperPanel.popupEl.offsetHeight || r.height || 200;
  let top = r.top;
  const maxTop = Math.max(8, window.innerHeight - h - 8);
  if (top > maxTop) top = maxTop;
  const p = clampPos(r.left, top);
  helperPanel.popupEl.style.left = p.left + 'px';
  helperPanel.popupEl.style.top = p.top + 'px';
  helperPanel.popupEl.style.right = 'auto';
  helperPanel.popupEl.style.bottom = 'auto';
  helperPanel.popupEl.style.maxHeight = popupMaxHeight() + 'px';
  if (helperPanel.userPos) helperPanel.userPos = p;
}
function buildPopup() {
  helperPanel.popupEl = document.createElement('div');
  // top+right (i.p.v. bottom+left): de hulp opent bovenaan (10% marge) en
  // tegen de ONS-modal aan; zie reposition()/popupMaxHeight() voor de
  // exacte, doorlopend herberekende waarden.
  // transition op `right` (niet `top`/`left`): die laatste twee worden ook
  // continu bijgewerkt tijdens het slepen en zouden dan hortend aanvoelen.
  // `right` verandert alleen via reposition() (default plek), dus een kleine
  // resterende correctie schuift altijd vloeiend naar rechts i.p.v. te springen.
  Object.assign(helperPanel.popupEl.style, { position: 'fixed', zIndex: '2147483647', top: defaultPopupTop() + 'px', right: '24px', bottom: 'auto', maxHeight: popupMaxHeight() + 'px', transition: 'right .18s cubic-bezier(.2,.8,.2,1)', background: '#fff', color: '#201d1f', pointerEvents: 'auto', border: '1px solid #ece7e5', borderRadius: '16px', boxShadow: '0 14px 40px rgba(32,20,15,.24)', font: '14px/1.4 system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch' });
  // De spine: gekleurde balk die de assistent herkenbaar maakt, de aan/uit-
  // status draagt (roze werkend, grijs uitgeschakeld), het sleepgebied vormt
  // én zelf klikbaar is om het paneel zijwaarts in/uit te klappen (net als
  // de kopregel-knop, maar altijd zichtbaar — ook als het paneel dicht is).
  const spine = document.createElement('div');
  spine.setAttribute('data-popup-spine', '');
  spine.setAttribute('role', 'button');
  spine.setAttribute('tabindex', '0');
  spine.title = 'Klik om in/uit te klappen';
  Object.assign(spine.style, { width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', cursor: 'pointer', userSelect: 'none' });
  const spineChip = document.createElement('span');
  Object.assign(spineChip.style, { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' });
  spine.appendChild(spineChip);
  // Kleine stippenrij: geeft een globale indruk van de voortgang (kiezen ->
  // invullen -> klaar om op te slaan), bijgewerkt door updateSpineProgress().
  const spineDots = document.createElement('span');
  spineDots.setAttribute('data-spine-dots', '');
  Object.assign(spineDots.style, { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' });
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('i');
    Object.assign(dot.style, { display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,.35)' });
    spineDots.appendChild(dot);
  }
  spine.appendChild(spineDots);
  const onSpineMousedown = (e) => {
    if (e.target.closest && e.target.closest('[data-popup-control]')) return;
    helperPanel.popupDragMoved = false;
    helperPanel.dragging = true; const r = rect(helperPanel.popupEl); helperPanel.dragDX = e.clientX - r.left; helperPanel.dragDY = e.clientY - r.top; e.preventDefault();
  };
  spine.addEventListener('mousedown', onSpineMousedown);
  spine.addEventListener('click', (e) => {
    if (helperPanel.popupDragMoved) { helperPanel.popupDragMoved = false; return; } // dit was slepen, geen klik
    e.preventDefault(); e.stopPropagation();
    setPopupCollapsed(!helperPanel.popupCollapsed);
  });
  spine.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPopupCollapsed(!helperPanel.popupCollapsed); }
  });
  const mainCol = document.createElement('div');
  mainCol.setAttribute('data-popup-maincol', '');
  Object.assign(mainCol.style, { width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: '1', transition: 'width .22s cubic-bezier(.2,.8,.2,1), opacity .15s ease' });
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', color: '#201d1f', padding: '11px 12px', fontWeight: '700', cursor: 'move', userSelect: 'none', borderBottom: '1px solid #f1ecea' });
  const title = document.createElement('span');
  title.textContent = helperPanel.activeMode === 'registrations' ? 'Registratiehulp' : 'Afspraakhulp';
  Object.assign(title.style, { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  header.appendChild(title);
  const enabledToggle = document.createElement('button');
  enabledToggle.setAttribute('data-enabled-toggle', '');
  enabledToggle.setAttribute('data-popup-control', '');
  Object.assign(enabledToggle.style, { position: 'relative', background: 'transparent', border: '0', borderRadius: '999px', color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px', fontWeight: '700', overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit' });
  const switchTrack = document.createElement('span');
  Object.assign(switchTrack.style, { position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)', transition: 'background .16s ease, box-shadow .16s ease, opacity .16s ease' });
  const switchText = document.createElement('span');
  Object.assign(switchText.style, { position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: '700', letterSpacing: '0', color: '#fff', opacity: '.95', transition: 'left .16s ease, right .16s ease', pointerEvents: 'none' });
  const switchKnob = document.createElement('span');
  Object.assign(switchKnob.style, { position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease' });
  enabledToggle.appendChild(switchTrack);
  enabledToggle.appendChild(switchText);
  enabledToggle.appendChild(switchKnob);
  onsahFocusRing(enabledToggle);
  const updateEnabledToggle = () => {
    switchText.textContent = helperPanel.helperEnabled ? 'Aan' : 'Uit';
    switchTrack.style.background = helperPanel.helperEnabled ? '#1b7f3b' : '#a3241f';
    switchTrack.style.boxShadow = helperPanel.helperEnabled ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'inset 0 0 0 1px rgba(255,255,255,.10)';
    switchTrack.style.opacity = helperPanel.helperEnabled ? '1' : '.82';
    switchKnob.style.left = helperPanel.helperEnabled ? '37px' : '3px';
    switchText.style.left = helperPanel.helperEnabled ? '9px' : '27px';
    switchText.style.right = helperPanel.helperEnabled ? '25px' : '7px';
    enabledToggle.setAttribute('aria-label', helperPanel.helperEnabled ? 'Hulp uitschakelen' : 'Hulp inschakelen');
    enabledToggle.setAttribute('aria-pressed', helperPanel.helperEnabled ? 'true' : 'false');
    enabledToggle.title = helperPanel.helperEnabled ? 'Aan' : 'Uit';
    spine.style.background = helperPanel.helperEnabled ? '#cc087d' : '#9a9296';
    spineChip.innerHTML = '';
    spineChip.appendChild(helperPanel.helperEnabled ? svgSpineCheck() : svgSpinePause());
  };
  updateEnabledToggle();
  enabledToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    helperPanel.helperEnabled = !helperPanel.helperEnabled;
    storageSet(STORE_HELPER_ENABLED, helperPanel.helperEnabled ? '1' : '0');
    updateEnabledToggle();
    if (helperPanel.helperEnabled) {
      // Herstel meteen de opslaanblokkade die bij uitschakelen is opgeheven,
      // passend bij de actieve modus (afspraak vs. registratie).
      const reapplyGuard = () => {
        if (helperPanel.activeMode === 'registrations') updateRegistrationSubmitGuard();
        else updateSubmitGuard();
      };
      const restore = helperPanel._disabledRestore;
      helperPanel._disabledRestore = null;
      if (restore) {
        // Terug naar het laatst geopende scherm (afspraak én registratie).
        if (helperPanel.activeMode !== 'registrations' && hasClientInAppointment()) {
          ensureClientExpanded(() => { restore(); reapplyGuard(); });
        } else {
          restore();
          reapplyGuard();
        }
      } else if (helperPanel.activeMode !== 'registrations') {
        resumeAppointmentHelperAfterEnable();
      } else {
        refreshMainScreen();
      }
      // Vangnet: forceer de blokkade nogmaals nadat het scherm is opgebouwd,
      // ook als een van de bovenstaande takken de guard niet raakte.
      reapplyGuard();
    } else {
      helperPanel._disabledRestore = helperPanel._infoPanelRestore || createCurrentScreenRestore();
      helperPanel._infoPanelRestore = null;
      setSubmitBlocked(false);
      setRegistrationSubmitBlocked(false);
      showDisabledState();
    }
  });
  const infoBtn = document.createElement('button');
  infoBtn.setAttribute('data-info-toggle', '');
  infoBtn.setAttribute('data-popup-control', '');
  infoBtn.setAttribute('aria-label', `Info en versie ${SCRIPT_VERSION}`);
  infoBtn.title = `Info en versie ${SCRIPT_VERSION}`;
  infoBtn.appendChild(svgInfoIcon());
  Object.assign(infoBtn.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', lineHeight: '1', padding: '5px 7px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
  infoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (helperPanel.popupCollapsed) setPopupCollapsed(false);
    safe(toggleInfoPanel);
  });
  onsahFocusRing(infoBtn);
  const close = document.createElement('button');
  close.setAttribute('data-collapse-toggle', '');
  close.setAttribute('data-popup-control', '');
  close.setAttribute('aria-label', helperPanel.popupCollapsed ? 'Hulp uitklappen' : 'Hulp inklappen');
  Object.assign(close.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', lineHeight: '1', padding: '3px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
  setChevronIcon(close, helperPanel.popupCollapsed);
  close.addEventListener('click', () => setPopupCollapsed(!helperPanel.popupCollapsed));
  onsahFocusRing(close);
  const controls = document.createElement('div');
  controls.setAttribute('data-popup-control', '');
  Object.assign(controls.style, { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });
  controls.appendChild(enabledToggle);
  controls.appendChild(infoBtn);
  controls.appendChild(close);
  header.appendChild(controls);
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('[data-popup-control]')) return;
    helperPanel.popupDragMoved = false;
    helperPanel.dragging = true; const r = rect(helperPanel.popupEl); helperPanel.dragDX = e.clientX - r.left; helperPanel.dragDY = e.clientY - r.top; e.preventDefault();
  });
  mainCol.appendChild(header);
  const body = document.createElement('div');
  body.setAttribute('data-body', '');
  // flex:1 + minHeight:0 i.p.v. een vaste calc(100vh - ...): de body krimpt
  // mee binnen de door popupMaxHeight() begrensde hoogte (header/status
  // blijven op hun natuurlijke grootte) en scrollt zelf als de inhoud niet past.
  Object.assign(body.style, { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minHeight: '0', overflowY: 'auto' });
  mainCol.appendChild(body);
  const status = document.createElement('div');
  status.setAttribute('data-status', '');
  Object.assign(status.style, { padding: '0 12px 12px' });
  mainCol.appendChild(status);
  // De spine zit links (herkenbaar, vast onderdeel van het concept); het
  // paneel klapt ernaast open. Bij inklappen verdwijnt mainCol (breedte 0)
  // en schuift de spine, omdat de hele popup rechts verankerd is (zie
  // defaultPopupRight hierboven), vanzelf mee tot tegen de rechterrand aan
  // — precies zoals bedoeld: het roze lipje blijft altijd rechts liggen.
  helperPanel.popupEl.appendChild(spine);
  helperPanel.popupEl.appendChild(mainCol);
  refreshMainScreen();
  setPopupCollapsed(helperPanel.popupCollapsed);
  // Houd de popup volledig in beeld zodra de inhoud (en dus de hoogte) verandert.
  try {
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { safe(reclampToViewport); });
      ro.observe(helperPanel.popupEl);
      helperPanel.popupEl.__onsResizeObserver = ro;
    }
  } catch (e) {}
}
// Opstarten: sleep-listeners voor het paneel (een keer).
export function installPanelDragListeners() {
  window.addEventListener('mousemove', (e) => {
    if (!helperPanel.dragging || !helperPanel.popupEl) return;
    helperPanel.popupDragMoved = true; // onderscheidt slepen van een klik-op-de-spine
    const p = clampPos(e.clientX - helperPanel.dragDX, e.clientY - helperPanel.dragDY);
    helperPanel.userPos = p;
    helperPanel.popupEl.style.left = p.left + 'px'; helperPanel.popupEl.style.top = p.top + 'px';
    helperPanel.popupEl.style.right = 'auto'; helperPanel.popupEl.style.bottom = 'auto';
  });
  window.addEventListener('mouseup', () => { helperPanel.dragging = false; });
}
export function reposition() {
  if (!helperPanel.popupEl) return;
  helperPanel.popupEl.style.maxHeight = popupMaxHeight() + 'px';
  if (helperPanel.userPos) { const p = clampPos(helperPanel.userPos.left, helperPanel.userPos.top); helperPanel.popupEl.style.left = p.left + 'px'; helperPanel.popupEl.style.top = p.top + 'px'; helperPanel.popupEl.style.right = 'auto'; helperPanel.popupEl.style.bottom = 'auto'; return; }
  // Standaardplek: rechts tegen de ONS-modal, bovenkant op een vaste
  // afstand van de vensterbovenkant (zie defaultPopupRight/-Top hierboven).
  helperPanel.popupEl.style.right = defaultPopupRight() + 'px';
  helperPanel.popupEl.style.left = 'auto';
  helperPanel.popupEl.style.top = defaultPopupTop() + 'px';
  helperPanel.popupEl.style.bottom = 'auto';
}
export function ensureMounted() {
  if (!helperPanel.active) return;
  if (!helperPanel.popupEl) buildPopup();
  const m = findModal();
  const host = (m && m.host) || document.body;
  if (helperPanel.popupEl.parentNode !== host) { try { host.appendChild(helperPanel.popupEl); } catch (e) { document.body.appendChild(helperPanel.popupEl); } }
  if (!helperPanel.helperEnabled) {
    showDisabledState();
    reposition();
    return;
  }
  if (appointmentFlow.appointmentClearingSettings) {
    showLoadingState('Instellingen verwijderen...');
    reposition();
    return;
  }
  if (helperPanel.activeMode === 'registrations') {
    refreshRegistrationPrereqScreen();
    checkRegistrationNoShowText();
    checkRegistrationEpisodesText();
    updateRegistrationSubmitGuard();
    reposition();
    return;
  }
  safe(guardInviteeAddButton);
  // Elke render verse cliëntgegevens lezen: de MutationObserver vuurt tijdens
  // het toevoegen van een cliënt, en anders zou een <250ms oude (nog lege)
  // cache blijven hangen tot een volgende, ongerelateerde mutatie.
  invalidateClientEntries();
  refreshFreeDayFromBackgroundCalendar();
  if (appointmentFlow.appointmentFreeDay) { showFreeDayInactive(); reposition(); return; }
  refreshAppointmentPrereqScreen();
  if (hasClientInAppointment()) ensureClientExpanded(() => {});
  handleClientListChanges();
  updateSubmitGuard();
  reposition();
}
// Eerst de React-root netjes afbouwen, dán pas het paneel uit de DOM halen.
// Een element uit de DOM trekken is voor React geen signaal: zonder deze
// unmount blijven de opruimacties van de schermen (o.a. hun controle-lussen)
// achterwege en tikt er een timer door op een paneel dat niet meer bestaat.
export function removePopup() {
  if (!helperPanel.popupEl) return;
  try {
    const body = helperPanel.popupEl.querySelector('[data-body]');
    if (body && window.__onsahReact) window.__onsahReact.unmount(body);
  } catch (e) {}
  // De grootte-observer hangt aan het paneel dat we nu weggooien; zonder
  // disconnect blijft hij actief op een losgekoppeld element.
  try { if (helperPanel.popupEl.__onsResizeObserver) { helperPanel.popupEl.__onsResizeObserver.disconnect(); helperPanel.popupEl.__onsResizeObserver = null; } } catch (e) {}
  helperPanel.popupEl.remove();
  helperPanel.popupEl = null;
}
/*  activeren per route  */
let _mountRaf = 0;
export const scheduleMount = () => {
  if (_mountRaf) return;
  _mountRaf = requestAnimationFrame(() => { _mountRaf = 0; safe(ensureMounted); });
};

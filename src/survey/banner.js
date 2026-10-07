// Het paneel in de pagina: opbouwen, rechts vastzetten (de pagina schuift in),
// breedte, leeftijdsvraag.

import { PANEL_MAX, PANEL_MIN, PANEL_W_KEY, surveyState } from './state.js';
import { saveManualAge } from './client-age.js';
import { clearChecklist, loadChecklist, saveChecklist } from './checklist.js';
import { hideBanner, renderChecklist } from './checklist-view.js';
import { SCRIPT_VERSION } from '../shared/version.js';

// Opstarten: de onthouden paneelbreedte.
export function loadPanelWidth() {
  try { const w = parseInt(localStorage.getItem(PANEL_W_KEY), 10); if (w >= PANEL_MIN && w <= PANEL_MAX) surveyState.PANEL_W = w; } catch (e) {}
}
function applyPanelWidth(w) {
  surveyState.PANEL_W = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(w)));
  if (surveyState.bannerEl) {
    surveyState.bannerEl.style.width = surveyState.PANEL_W + 'px';
    surveyState.bannerEl.style.minWidth = surveyState.PANEL_W + 'px';
    surveyState.bannerEl.style.maxWidth = surveyState.PANEL_W + 'px';
  }
  // Herbereken de pagina-inschuiving (body-padding + max-width van de shells)
  // met de nieuwe breedte, zodat inhoud nooit achter het paneel valt.
  if (surveyState.docked && typeof pushPage === 'function') pushPage(true);
}
// Consistente SVG-iconen (lijn/stip/vinkje) i.p.v. emoji (⚠ℹ✕) en tekstglyphs
// (?/✓) — zelfde vormtaal als de andere onderdelen van de extensie.
export const SURVEY_ICON_SVG = {
  warn: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="3" x2="7" y2="8"/><circle cx="7" cy="10.6" r=".9" fill="currentColor" stroke="none"/></svg>',
  info: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="6.2" x2="7" y2="10.4"/><circle cx="7" cy="3.6" r=".9" fill="currentColor" stroke="none"/></svg>',
  vraag: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.3 5.1a1.7 1.7 0 1 1 2.6 1.9c-.6.5-.9 1-.9 1.7"/><circle cx="7" cy="10.6" r=".9" fill="currentColor" stroke="none"/></svg>',
  ok: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.2l2.6 2.6L11 4"/></svg>',
  sluiten: '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>',
};
export function ensureBanner() {
  if (surveyState.bannerEl && document.body.contains(surveyState.bannerEl)) return surveyState.bannerEl;
  surveyState.bannerEl = document.createElement('div');
  Object.assign(surveyState.bannerEl.style, {
    position: 'fixed', zIndex: '2147483647', right: '16px', top: '80px', left: 'auto', bottom: 'auto', transform: 'none',
    width: surveyState.PANEL_W + 'px', minWidth: surveyState.PANEL_W + 'px', maxWidth: surveyState.PANEL_W + 'px', maxHeight: 'calc(100vh - 100px)',
    background: '#ffffff', color: '#201d1f', border: '1px solid #ece7e5', borderRadius: '14px', overflow: 'hidden',
    boxShadow: '0 14px 36px rgba(32,20,15,.24)', font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    display: 'none', flexDirection: 'row', alignItems: 'stretch', pointerEvents: 'auto',
  });
  // Spine: zelfde herkenningsbalk als Afspraak-/Registratiehulp en
  // Agendahulp, draagt hier ook de status (roze/amber/groen).
  const spine = document.createElement('div');
  spine.setAttribute('data-survey-spine', '');
  Object.assign(spine.style, { width: '14px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', background: '#cc087d' });
  const icon = document.createElement('span');
  icon.innerHTML = SURVEY_ICON_SVG.warn;
  icon.setAttribute('data-survey-drag-handle', '');
  icon.title = 'Sleep de melding';
  Object.assign(icon.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', flex: '0 0 auto', color: '#fff' });
  spine.appendChild(icon);
  const mainCol = document.createElement('div');
  Object.assign(mainCol.style, { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column' });
  const header = document.createElement('div');
  header.setAttribute('data-survey-header', '');
  Object.assign(header.style, {
    display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto',
    background: '#fff', color: '#201d1f', padding: '10px 12px', userSelect: 'none', borderBottom: '1px solid #f1ecea',
  });
  const title = document.createElement('span');
  title.setAttribute('data-survey-title', '');
  Object.assign(title.style, { flex: '1 1 auto', minWidth: '0', fontSize: '13px', fontWeight: '700' });
  const version = document.createElement('span');
  version.setAttribute('data-survey-version', '');
  version.textContent = 'v' + SCRIPT_VERSION;
  version.title = 'Geladen versie van de vragenlijstcontrole';
  Object.assign(version.style, { flex: '0 0 auto', fontSize: '10px', fontWeight: '700', color: '#a49a9d' });
  const ctrlStyle = { flex: '0 0 auto', width: '24px', height: '24px', padding: '0', border: '1px solid #ece7e5', borderRadius: '7px', background: '#f6f2f0', color: '#6b6367', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.setAttribute('data-survey-collapse', '');
  collapse.setAttribute('aria-label', 'Melding inklappen');
  Object.assign(collapse.style, ctrlStyle, { font: '700 15px/1 system-ui, sans-serif' });
  const close = document.createElement('button');
  close.type = 'button';
  close.innerHTML = SURVEY_ICON_SVG.sluiten;
  close.setAttribute('aria-label', 'Melding sluiten');
  Object.assign(close.style, ctrlStyle);
  collapse.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const state = loadChecklist();
    if (!state) return;
    state.collapsed = !state.collapsed;
    saveChecklist(state);
    renderChecklist(state);
  });
  close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearChecklist(); hideBanner(); });
  header.appendChild(title);
  header.appendChild(version);
  header.appendChild(collapse);
  header.appendChild(close);
  // Witte, scrollbare inhoud.
  const msg = document.createElement('div');
  msg.setAttribute('data-survey-msg', '');
  Object.assign(msg.style, { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '10px 12px 12px' });
  mainCol.appendChild(header);
  mainCol.appendChild(msg);
  surveyState.bannerEl.appendChild(spine);
  surveyState.bannerEl.appendChild(mainCol);
  (document.body || document.documentElement).appendChild(surveyState.bannerEl);
  let moving = false, dragDX = 0, dragDY = 0, prevUserSelect = '';
  surveyState.bannerEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (surveyState.docked) return; // gedockt paneel is niet sleepbaar
    const r = surveyState.bannerEl.getBoundingClientRect();
    // De volledige bovenste strook is een sleepgreep; links en knoppen
    // behouden hun normale klikgedrag.
    if (e.clientY > r.top + 44) return;
    if (e.target && e.target.closest && e.target.closest('a,button,input,textarea,select')) return;
    moving = true;
    dragDX = e.clientX - r.left;
    dragDY = e.clientY - r.top;
    surveyState.bannerEl.style.left = r.left + 'px';
    surveyState.bannerEl.style.top = r.top + 'px';
    surveyState.bannerEl.style.right = 'auto';
    surveyState.bannerEl.style.bottom = 'auto';
    surveyState.bannerEl.style.transform = 'none';
    // Tekstselectie/auto-scroll uitzetten tijdens het slepen (anders "scrollt"
    // de pagina i.p.v. dat de melding meebeweegt).
    prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!moving || !surveyState.bannerEl) return;
    e.preventDefault();
    const r = surveyState.bannerEl.getBoundingClientRect();
    const left = Math.min(Math.max(8, e.clientX - dragDX), Math.max(8, window.innerWidth - r.width - 8));
    const top = Math.min(Math.max(8, e.clientY - dragDY), Math.max(8, window.innerHeight - r.height - 8));
    surveyState.bannerEl.style.left = left + 'px';
    surveyState.bannerEl.style.top = top + 'px';
  }, { passive: false });
  window.addEventListener('mouseup', () => {
    if (!moving || !surveyState.bannerEl) return;
    moving = false;
    document.body.style.userSelect = prevUserSelect;
    const r = surveyState.bannerEl.getBoundingClientRect();
    const state = loadChecklist();
    if (state) { state.position = { left: Math.round(r.left), top: Math.round(r.top) }; saveChecklist(state); }
  });
  // Resize-greep aan de linkerrand (console-achtig). Cursor = ew-resize
  // (dubbele horizontale pijl). Slepen past de breedte + de pagina-marge aan.
  const grip = document.createElement('div');
  grip.setAttribute('data-survey-resize', '');
  Object.assign(grip.style, {
    position: 'absolute', left: '0', top: '0', bottom: '0', width: '8px',
    cursor: 'ew-resize', zIndex: '5', background: 'transparent', touchAction: 'none'
  });
  surveyState.bannerEl.appendChild(grip);
  let resizing = false, startX = 0, startW = 0, prevUS2 = '';
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !surveyState.docked) return;   // alleen het gedockte paneel is resizebaar
    resizing = true; startX = e.clientX; startW = surveyState.PANEL_W;
    prevUS2 = document.body.style.userSelect; document.body.style.userSelect = 'none';
    e.preventDefault(); e.stopPropagation();
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    e.preventDefault();
    // Naar links slepen = breder (paneel zit rechts).
    applyPanelWidth(startW + (startX - e.clientX));
  }, { passive: false });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = prevUS2;
    try { localStorage.setItem(PANEL_W_KEY, String(surveyState.PANEL_W)); } catch (e) {}
  });
  return surveyState.bannerEl;
}
// Duw de pagina-inhoud opzij voor het gedockte paneel. Bewust ALLEEN via
// padding op <body> (met border-box): dat verkleint de beschikbare ruimte
// voor de app-inhoud zonder de eigen layout-containers te forceren (dat brak
// de app / maakte het scherm leeg). Vaste balken schuiven niet mee, daarom
// begint het paneel onder de bovenbalk.
function pushPage(on) {
  const body = document.body;
  if (!body) return;
  const avail = 'calc(100vw - ' + surveyState.PANEL_W + 'px)';
  // Layout-containers die de inhoud dragen; die begrenzen we met MAX-width
  // (niet width/right — dat maakte het scherm eerder leeg), zodat brede inhoud
  // niet achter het paneel valt.
  const shells = document.querySelectorAll('.unify-layout,[class*="unify-layout"],[class*="_columns_" i],form');
  if (on) {
    try {
      body.style.setProperty('box-sizing', 'border-box', 'important');
      body.style.setProperty('padding-right', surveyState.PANEL_W + 'px', 'important');
    } catch (e) {}
    for (const el of shells) {
      try {
        el.style.setProperty('max-width', avail, 'important');
        el.style.setProperty('box-sizing', 'border-box', 'important');
        el.setAttribute('data-ons-helper-pushed', '1');
      } catch (e) {}
    }
  } else {
    try { body.style.removeProperty('padding-right'); body.style.removeProperty('box-sizing'); } catch (e) {}
    for (const el of document.querySelectorAll('[data-ons-helper-pushed]')) {
      try { el.style.removeProperty('max-width'); el.style.removeProperty('box-sizing'); el.removeAttribute('data-ons-helper-pushed'); } catch (e) {}
    }
  }
}
// Dock de melding rechts (zoals de DevTools-console): eigen kolom onder de
// bovenbalk, en de pagina-inhoud schuift ernaast. Uit -> kleine 'pill'.
export function setDock(on) {
  surveyState.docked = !!on;
  if (!surveyState.bannerEl) return;
  if (on) {
    // Volledige hoogte: de body-padding maakt de rechterstrook over de héle
    // hoogte vrij (ook de bovenbalk schuift mee naar links), dus het paneel
    // begint bovenaan om die strook helemaal te vullen — geen grijze ruimte.
    Object.assign(surveyState.bannerEl.style, {
      top: '0', right: '0', bottom: '0', left: 'auto', transform: 'none',
      width: surveyState.PANEL_W + 'px', minWidth: surveyState.PANEL_W + 'px', maxWidth: surveyState.PANEL_W + 'px', height: 'auto', maxHeight: 'none',
      borderRadius: '0', boxShadow: '-4px 0 24px rgba(0,0,0,.18)'
    });
  } else {
    Object.assign(surveyState.bannerEl.style, {
      top: '80px', right: '16px', bottom: 'auto', left: 'auto', transform: 'none',
      width: surveyState.PANEL_W + 'px', minWidth: surveyState.PANEL_W + 'px', maxWidth: surveyState.PANEL_W + 'px', height: 'auto',
      maxHeight: 'calc(100vh - 100px)', borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.28)'
    });
  }
  pushPage(on);
  const handle = surveyState.bannerEl.querySelector('[data-survey-drag-handle]');
  if (handle) handle.style.cursor = on ? 'default' : 'move';
}
export function showBanner(text) {
  const b = ensureBanner();
  const spine = b.querySelector('[data-survey-spine]');
  const title = b.querySelector('[data-survey-title]');
  const icon = b.querySelector('[data-survey-drag-handle]');
  const msg = b.querySelector('[data-survey-msg]');
  if (spine) spine.style.background = '#cc087d';
  if (icon) icon.innerHTML = SURVEY_ICON_SVG.info;
  if (title) title.textContent = text;
  if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
  setDock(false);
  b.style.display = 'flex';
}
// Herbruikbare actieknop in het paneel (leeftijdkeuze, 'toch doorgaan').
export function surveyActionButton(label, kind, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  const bg = kind === 'primary' ? '#cc087d' : (kind === 'warn' ? '#b45309' : '#f6f2f0');
  const fg = kind === 'ghost' ? '#4a4448' : '#fff';
  Object.assign(btn.style, {
    appearance: 'none', border: kind === 'ghost' ? '1px solid #ece7e5' : '0', borderRadius: '999px',
    padding: '9px 16px', fontWeight: '700', cursor: 'pointer',
    background: bg, color: fg, font: '700 13px/1 system-ui, sans-serif',
    boxShadow: kind === 'ghost' ? 'none' : '0 4px 12px -5px rgba(0,0,0,.4)'
  });
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
  return btn;
}
// (#1/#9) Vraag de respondent-leeftijd wanneer die niet eenduidig is bepaald.
// Zolang deze vlag aan staat, mag de periodieke refresh de prompt niet
// overschrijven met de checklist.
export let _awaitingAgeChoice = false;
export function showAgePrompt(reason, onPick) {
  _awaitingAgeChoice = true;
  const pick = (age) => { _awaitingAgeChoice = false; onPick(age); };
  const b = ensureBanner();
  const spine = b.querySelector('[data-survey-spine]');
  const title = b.querySelector('[data-survey-title]');
  const icon = b.querySelector('[data-survey-drag-handle]');
  const msg = b.querySelector('[data-survey-msg]');
  if (spine) spine.style.background = '#b45309';
  if (icon) icon.innerHTML = SURVEY_ICON_SVG.vraag;
  if (title) title.textContent = 'Leeftijd van de cliënt bevestigen';
  setDock(false);
  msg.textContent = '';
  msg.style.display = 'block';
  const p = document.createElement('div');
  p.textContent = reason || 'De leeftijd kon niet automatisch worden bepaald. Is de cliënt jonger dan 12 jaar?';
  Object.assign(p.style, { margin: '2px 0 10px', lineHeight: '1.4' });
  msg.appendChild(p);
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' });
  row.appendChild(surveyActionButton('Ja, jonger dan 12', 'primary', () => { saveManualAge(true); pick(6); }));
  row.appendChild(surveyActionButton('Nee, 12 jaar of ouder', 'warn', () => { saveManualAge(false); pick(15); }));
  msg.appendChild(row);
  b.style.display = 'flex';
}

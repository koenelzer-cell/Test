// Selector-overrides uit de UI-inspector: centraal (config.json, uiSelectors)
// + lokaal herstel (chrome.storage.local). Overschrijft waar nodig de
// selectors in ons/selectors.js.

import { ONS } from './selectors.js';
import { APP_CONFIG, CONFIG } from '../config/app-config.js';
import { deepQueryAll, isOwnPopup, visible } from './dom.js';
import { LOCAL } from '../../shared/storage-keys.js';

// Alle door de UI-inspector aangewezen selector-overrides (per hook-sleutel).
// Bron: centrale config (APP_CONFIG.uiSelectors) als basis; een lokaal
// 'herstel' (storage.local, hieronder) overschrijft dit per sleutel.
export const UI_OVERRIDES = {};
let CONFIG_UI_SELECTORS = {};   // uit config.json (APP_CONFIG.uiSelectors)
let LOCAL_UI_SELECTORS = {};    // uit storage.local (UI-inspector 'herstel'); wint over config
function _pickStringSelectors(u) { const out = {}; if (u && typeof u === 'object') for (const k of Object.keys(u)) if (typeof u[k] === 'string' && u[k]) out[k] = u[k]; return out; }
// Eerste zichtbare element voor de override van deze hook-sleutel (of null).
export function overrideEl(key) {
  const sel = UI_OVERRIDES[key];
  if (!sel || typeof sel !== 'string') return null;
  try { return deepQueryAll(sel).find((el) => visible(el) && !isOwnPopup(el)) || null; } catch (e) { return null; }
}
// ALLE zichtbare elementen voor de override van deze hook-sleutel. Geeft null
// (niet []) terug als er geen override is, zodat de aanroeper zijn eigen
// heuristiek kan gebruiken. Nodig voor hooks die met meerdere elementen matchen
// (bv. de labelchips), die de beheerder via de UI-inspector kan herstellen.
export function overrideAll(key) {
  const sel = UI_OVERRIDES[key];
  if (!sel || typeof sel !== 'string') return null;
  try { return deepQueryAll(sel).filter((el) => visible(el) && !isOwnPopup(el)); } catch (e) { return null; }
}
// De drie 'klassieke' velden houden hun eigen CONFIG-veld (backward compatible).
function applyCentralUiSelectors() {
  CONFIG.etiketFieldSelector = UI_OVERRIDES.etiketFieldSelector || '';
  CONFIG.uursoortFieldSelector = UI_OVERRIDES.uursoortFieldSelector || '';
  CONFIG.modalPanelSelector = UI_OVERRIDES.modalPanelSelector || '';
}
// Agenda-selectors lopen centraal via het ONS-object; een override vervangt de
// waarde daar rechtstreeks, zodat ALLE consumenten (dagkleuring, totalen) de
// herstelde selector gebruiken zonder verdere codewijziging.
function applyAgendaSelectorOverrides() {
  const map = { agDayColumn: 'dayColumn', agDayCell: 'dayColumnCell', agOccurrence: 'occurrenceBase', agOccurrenceTitle: 'occurrenceTitle', agApptTitle: 'appointmentTitle', agLabelTitle: 'labelWithTitle', agPopover: 'popoverRoot', agPopoverLabel: 'popoverLabelTag', agDeclare: 'declareTrigger' };
  for (const key in map) if (UI_OVERRIDES[key]) ONS[map[key]] = UI_OVERRIDES[key];
}
// Herbouw UI_OVERRIDES: config.json (basis) + lokale inspector-overrides (winnen).
function recomputeUiOverrides() {
  for (const k in UI_OVERRIDES) delete UI_OVERRIDES[k];
  Object.assign(UI_OVERRIDES, CONFIG_UI_SELECTORS, LOCAL_UI_SELECTORS);
  applyCentralUiSelectors(); applyAgendaSelectorOverrides();
}
// Neem de in config.json gepubliceerde uiSelectors over (ook ná de async
// config-load — dat ging eerder mis: UI_OVERRIDES bleef leeg).
export function seedUiOverridesFromConfig() { CONFIG_UI_SELECTORS = _pickStringSelectors(APP_CONFIG.uiSelectors); recomputeUiOverrides(); }
// UI-inspector selector-overrides (géén diagnostiek): lokale overrides winnen per
// sleutel over de centrale config en worden LIVE toegepast (geen herladen nodig).
// Opstarten: lokale UI-inspector-overrides inlezen en live volgen.
export function watchLocalUiOverrides() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const applyUiOverrides = (o) => { LOCAL_UI_SELECTORS = _pickStringSelectors(o); recomputeUiOverrides(); };
      chrome.storage.local.get([LOCAL.UI_OVERRIDES], (res) => { applyUiOverrides(res && res[LOCAL.UI_OVERRIDES]); });
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes[LOCAL.UI_OVERRIDES]) applyUiOverrides(changes[LOCAL.UI_OVERRIDES].newValue);
        });
      }
    }
  } catch (e) {}
}

// Herstelde selectors uit de beheerconfig (config.json, uiSelectors).
// Overschrijven waar nodig de selectors in ons/selectors.js, zodat een
// ONS-wijziging met een nieuwe config te verhelpen is zonder nieuwe versie.

import { ONS } from './selectors.js';
import { APP_CONFIG, CONFIG } from '../config/app-config.js';
import { deepQueryAll, isOwnPopup, visible } from './dom.js';

// De herstelde selectors per hook-sleutel (uit APP_CONFIG.uiSelectors).
export const UI_OVERRIDES = {};
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
// (bv. de labelchips).
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
// Neem de in config.json gepubliceerde uiSelectors over. Ook na het laden van
// de configuratie (async) aanroepen, anders blijft UI_OVERRIDES leeg.
export function seedUiOverridesFromConfig() {
  for (const k in UI_OVERRIDES) delete UI_OVERRIDES[k];
  Object.assign(UI_OVERRIDES, _pickStringSelectors(APP_CONFIG.uiSelectors));
  applyCentralUiSelectors(); applyAgendaSelectorOverrides();
}

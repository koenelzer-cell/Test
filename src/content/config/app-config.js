// De ACTIEVE configuratie (APP_CONFIG) en de daarvan afgeleide lijsten:
// afspraaktypes en registratievormen voor het gekozen team, labels,
// niet-cliëntcategorieën.

import { DEFAULT_APP_CONFIG, NONCLIENT_CATEGORIES } from './defaults.js';
import { runConfigHook } from './hooks.js';

// Actieve config (begint als de standaard; wordt door een override vervangen).
function _cloneConfig(c) { try { return JSON.parse(JSON.stringify(c)); } catch (e) { return c; } }
export const APP_CONFIG = _cloneConfig(DEFAULT_APP_CONFIG);
export let ACTIVE_SECTOR = null;
export let ACTIVE_PROFILE = null; // het gekozen team (kleurprofiel)
// Het gekozen team (popup: 'colorProfile') en bedrijfsonderdeel ('sector').
export function setActiveTeam(profile, sector) { ACTIVE_PROFILE = profile; ACTIVE_SECTOR = sector; }
export function setActiveProfileForTest(p) { ACTIVE_PROFILE = p || null; } // testhaak
function anyTeamsDefined() { try { return !!(APP_CONFIG.profileSectors && Object.keys(APP_CONFIG.profileSectors).length); } catch (e) { return false; } }
// De hulp vereist een gekozen team: zonder team (terwijl er wél teams bestaan)
// blokkeert de UI (showNeedsTeamChoice) — dan zie je geen afspraaktypes/
// registraties. De onderstaande filtering geldt zodra er wél een team is:
// 'relevantForTeams' leeg = alle teams, anders alleen het gekozen team. Zonder
// team filteren we intern niet (labelherkenning e.d. blijft werken; de UI is
// toch geblokkeerd).
function relevantForActiveTeam(item) {
  if (!ACTIVE_PROFILE) return true;
  const teams = item && item.relevantForTeams;
  if (!Array.isArray(teams) || teams.length === 0) return true;
  return teams.indexOf(ACTIVE_PROFILE) >= 0;
}
export function helperNeedsTeamChoice() { return !ACTIVE_PROFILE && anyTeamsDefined(); }
// Stabiele sortering op 'volgorde' (0..oneindig; ingesteld in het beheerscherm).
// Ontbrekend/leeg -> achteraan, met behoud van de bestaande volgorde.
function sortByVolgorde(arr) {
  return (arr || []).map(function (x, i) { return [x, i]; }).sort(function (a, b) {
    var av = (a[0] && a[0].volgorde != null && a[0].volgorde !== '') ? +a[0].volgorde : Infinity;
    var bv = (b[0] && b[0].volgorde != null && b[0].volgorde !== '') ? +b[0].volgorde : Infinity;
    if (!isFinite(av)) av = Infinity; if (!isFinite(bv)) bv = Infinity;
    return av === bv ? a[1] - b[1] : av - bv;
  }).map(function (p) { return p[0]; });
}
export function effectiveChoices() {
  return sortByVolgorde((APP_CONFIG.choices || []).filter(relevantForActiveTeam));
}
export function effectiveRegistrationForms() {
  return sortByVolgorde((APP_CONFIG.registrationForms || []).filter(relevantForActiveTeam));
}
export function refreshEffectiveConfig() {
  try { CONFIG.choices = effectiveChoices(); } catch (e) {}
  try { REGISTRATION_CHOICES = buildRegistrationChoices(); } catch (e) {}
  // Het rechtermuismenu wordt uit deze vormen gebouwd; hernoemt een beheerder
  // er een, dan moet het menu meelopen.
  runConfigHook('formsChanged');
}
// Pas een 'helperConfig'-override toe (per sectie volledige vervanging).
export function applyHelperConfig(hc) {
  if (!hc || typeof hc !== 'object') return;
  if (Array.isArray(hc.choices)) APP_CONFIG.choices = hc.choices;
  if (Array.isArray(hc.extraKnownLabels)) APP_CONFIG.extraKnownLabels = hc.extraKnownLabels;
  if (Array.isArray(hc.registrationForms)) APP_CONFIG.registrationForms = hc.registrationForms;
  if (hc.zoneProfiles && typeof hc.zoneProfiles === 'object') APP_CONFIG.zoneProfiles = hc.zoneProfiles;
  if (hc.profileSectors && typeof hc.profileSectors === 'object') APP_CONFIG.profileSectors = hc.profileSectors;
  if (hc.palette && typeof hc.palette === 'object') APP_CONFIG.palette = hc.palette;
  if (hc.texts && typeof hc.texts === 'object') APP_CONFIG.texts = Object.assign({}, APP_CONFIG.texts, hc.texts);
  if (hc.compatibility && typeof hc.compatibility === 'object') APP_CONFIG.compatibility = hc.compatibility;
  if (hc.features && typeof hc.features === 'object') APP_CONFIG.features = Object.assign({}, APP_CONFIG.features, hc.features);
  if (Array.isArray(hc.nonClientCategories)) APP_CONFIG.nonClientCategories = hc.nonClientCategories;
  if (Array.isArray(hc.offices) && hc.offices.length) APP_CONFIG.offices = hc.offices;
  if (hc.routesProxy && typeof hc.routesProxy === 'object') APP_CONFIG.routesProxy = Object.assign({}, APP_CONFIG.routesProxy, hc.routesProxy);
  if (hc.generalSettings && typeof hc.generalSettings === 'object') APP_CONFIG.generalSettings = Object.assign({}, APP_CONFIG.generalSettings, hc.generalSettings);
  if (hc.apiEndpoints && typeof hc.apiEndpoints === 'object') APP_CONFIG.apiEndpoints = Object.assign({}, APP_CONFIG.apiEndpoints, hc.apiEndpoints);
  if (Array.isArray(hc.declarabiliteitRules)) APP_CONFIG.declarabiliteitRules = hc.declarabiliteitRules;
  if (hc.support && typeof hc.support === 'object') APP_CONFIG.support = Object.assign({}, APP_CONFIG.support, hc.support);
  if (hc.leaveRequest && typeof hc.leaveRequest === 'object') APP_CONFIG.leaveRequest = Object.assign({}, APP_CONFIG.leaveRequest, hc.leaveRequest);
  if (hc.activation && typeof hc.activation === 'object') {
    APP_CONFIG.activation = Object.assign({}, APP_CONFIG.activation, hc.activation);
    if (APP_CONFIG.activation.appointmentNeedle) CONFIG.urlNeedle = APP_CONFIG.activation.appointmentNeedle;
    if (APP_CONFIG.activation.registrationNeedle) CONFIG.registrationNeedle = APP_CONFIG.activation.registrationNeedle;
  }
  if (hc.rollout && typeof hc.rollout === 'object') {
    APP_CONFIG.rollout = Object.assign({}, APP_CONFIG.rollout, hc.rollout);
    runConfigHook('rolloutChanged', APP_CONFIG.rollout);
  }
  if (hc.uiSelectors && typeof hc.uiSelectors === 'object') { APP_CONFIG.uiSelectors = Object.assign({}, APP_CONFIG.uiSelectors, hc.uiSelectors); runConfigHook('selectorsChanged'); }
  // Afgeleide lijst (tabel 3) opnieuw opbouwen.
  refreshEffectiveConfig();
  runConfigHook('configApplied');
  try { if (typeof onHelperConfigChanged === 'function') onHelperConfigChanged(); } catch (e) {}
}
// Instelbaar meldkanaal (TOPdesk) uit de config; met veilige fallback.
export function supportTopdeskUrl() {
  try {
    const u = APP_CONFIG.support && APP_CONFIG.support.topdeskUrl;
    if (u && /^https?:\/\//i.test(u)) return u;
  } catch (e) {}
  return 'https://impegno.topdesk.net/';
}
// Haak die de agenda-inkleuring laat verversen na een config-wijziging.
let onHelperConfigChanged = null;
export function setOnHelperConfigChanged(fn) { onHelperConfigChanged = fn; }
export const CONFIG = {
  urlNeedle: '/events/new',
  registrationNeedle: '/registrations',
  debug: false,
  clientPresentMatcher: (txt) => txt.includes('client') && txt.includes('aanwezig'),
  // Afspraaktypes komen uit de beheerbare config (APP_CONFIG.choices).
  choices: effectiveChoices(),
  uursoortIgnore: ['onlangs gebruikt', 'geadviseerd', 'toegestaan', 'geen resultaten', 'voer minstens', 'toont ', 'bekijk agenda', 'verwijder uit selectie', 'client', 'medewerker', 'toevoegen'],
  etiketFieldSelector: '',
  uursoortFieldSelector: '',
  modalPanelSelector: '',
};
// Globale numerieke instelling uit generalSettings, met terugval op de
// meegeleverde standaard (geen losse magische getallen meer in de flows).
export function gsNum(key, def) { const g = APP_CONFIG.generalSettings || {}; return (g[key] > 0) ? g[key] : def; }
// Alle labels/etiketten van één afspraaktype. Backward-compatible: het enkele
// 'etiket' blijft het primaire label, 'etiketten' (array) voegt extra labels toe.
// Volgorde: primair etiket eerst, daarna de extra's; dubbelen worden ontdubbeld.
export function choiceLabels(c) {
  const out = [];
  const push = (v) => { v = (v == null ? '' : String(v)).trim(); if (v && out.indexOf(v) === -1) out.push(v); };
  if (c) { push(c.etiket); if (Array.isArray(c.etiketten)) c.etiketten.forEach(push); }
  return out;
}
export function allKnownLabels() {
  const labels = [];
  CONFIG.choices.forEach(function (c) { choiceLabels(c).forEach(function (l) { if (labels.indexOf(l) === -1) labels.push(l); }); });
  for (const extra of (APP_CONFIG.extraKnownLabels || [])) if (labels.indexOf(extra) === -1) labels.push(extra);
  return labels;
}
// Actieve niet-cliëntcategorieën: beheerlijst uit config heeft voorrang; leeg =
// ingebouwde lijst. Zo komen o.a. het informatielabel en de duur uit de config.
export function nonClientCategoriesActive() {
  const c = APP_CONFIG.nonClientCategories;
  const base = (Array.isArray(c) && c.length) ? c : NONCLIENT_CATEGORIES;
  // Categorieën op volgorde; per categorie de types (opties) op hun eigen volgorde.
  return sortByVolgorde(base).map(function (cat) {
    if (cat && Array.isArray(cat.options) && cat.options.length) {
      return Object.assign({}, cat, { options: sortByVolgorde(cat.options) });
    }
    return cat;
  });
}
export function allNonClientHourTypes() {
  const out = [];
  nonClientCategoriesActive().forEach(function (cat) {
    if (cat.directOption && cat.directOption.uursoort) out.push(cat.directOption.uursoort);
    (cat.options || []).forEach(function (opt) { if (opt.uursoort) out.push(opt.uursoort); });
  });
  return out;
}
// Knoptekst-label o.b.v. een startverdeling "N% direct/indirect": bij 100%
// enkel het woord, anders het hoofdwoord eerst met het andere erachter
// (bv. "80% direct" -> "direct/indirect", "80% indirect" -> "indirect/direct").
export function directIndirectLabel(sv) {
  const m = String(sv == null ? '' : sv).match(/(\d+)\s*%\s*(direct|indirect)/i);
  if (!m) return '';
  const pct = Math.max(0, Math.min(100, parseInt(m[1], 10) || 0));
  const word = m[2].toLowerCase();
  return pct >= 100 ? word : (word === 'direct' ? 'direct/indirect' : 'indirect/direct');
}
// REGISTRATION_CHOICES wordt uit de beheerbare config gebouwd (tabel 3).
function buildRegistrationChoices() {
  return effectiveRegistrationForms().map(function (f) {
    const o = { label: f.vorm };
    if (f.uursoort) o.hourType = f.uursoort;
    if (f.eindtijdBeginPlusMin) o.endPlusOneMinute = true;
    // Startverdeling "N% direct/indirect": bij 100% een volledige verdeling,
    // anders een percentage-split (bv. 75% indirect -> 25% direct).
    const sv = String(f.startVerdeling || '').match(/(\d+)\s*%\s*(direct|indirect)/i);
    if (sv) {
      const pct = Math.max(0, Math.min(100, parseInt(sv[1], 10) || 0));
      const word = sv[2].toLowerCase();
      const directPct = word === 'indirect' ? (100 - pct) : pct;
      if (directPct === 100) o.directFullDuration = true;
      else if (directPct === 0) o.indirectFullDuration = true;
      else o.startSplit = { directPct: directPct, indirectPct: 100 - directPct };
      o.directIndirectLabel = directIndirectLabel(f.startVerdeling);
    }
    if (f.vraagDirecteTijd) o.askDirectPortion = true;
    if (f.vraagIndirecteTijd) o.askIndirectPortion = true;
    if (f.vraagReistijd) o.addTravelTime = true;
    if (f.rapportagePrefix) o.reportPrefix = f.rapportagePrefix;
    return o;
  });
}
export let REGISTRATION_CHOICES = buildRegistrationChoices();

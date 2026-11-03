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
    let av = (a[0] && a[0].volgorde != null && a[0].volgorde !== '') ? +a[0].volgorde : Infinity;
    let bv = (b[0] && b[0].volgorde != null && b[0].volgorde !== '') ? +b[0].volgorde : Infinity;
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
// Eén laag (config.json, testconfig of beleid) op een configuratie leggen.
// Puur: alleen `doel` verandert, geen haken. Een lijst of een hele sectie
// vervangt wat er stond; texts, features en de objecten met losse sleutels
// (routesProxy, generalSettings …) vullen aan.
export function legLaag(doel, hc) {
  if (!doel || !hc || typeof hc !== 'object') return doel;
  if (Array.isArray(hc.choices)) doel.choices = hc.choices;
  if (Array.isArray(hc.extraKnownLabels)) doel.extraKnownLabels = hc.extraKnownLabels;
  if (Array.isArray(hc.registrationForms)) doel.registrationForms = hc.registrationForms;
  if (hc.zoneProfiles && typeof hc.zoneProfiles === 'object') doel.zoneProfiles = hc.zoneProfiles;
  if (hc.profileSectors && typeof hc.profileSectors === 'object') doel.profileSectors = hc.profileSectors;
  if (hc.palette && typeof hc.palette === 'object') doel.palette = hc.palette;
  if (hc.texts && typeof hc.texts === 'object') doel.texts = Object.assign({}, doel.texts, hc.texts);
  if (hc.compatibility && typeof hc.compatibility === 'object') doel.compatibility = hc.compatibility;
  if (hc.features && typeof hc.features === 'object') doel.features = Object.assign({}, doel.features, hc.features);
  if (Array.isArray(hc.nonClientCategories)) doel.nonClientCategories = hc.nonClientCategories;
  if (Array.isArray(hc.offices) && hc.offices.length) doel.offices = hc.offices;
  ['routesProxy', 'generalSettings', 'apiEndpoints', 'support', 'debug', 'leaveRequest', 'activation', 'uiSelectors'].forEach(function (k) {
    if (hc[k] && typeof hc[k] === 'object' && !Array.isArray(hc[k])) doel[k] = Object.assign({}, doel[k], hc[k]);
  });
  if (Array.isArray(hc.declarabiliteitRules)) doel.declarabiliteitRules = hc.declarabiliteitRules;
  return doel;
}
// De hele configuratie vanaf de standaard opbouwen, laag na laag (oplopend in
// voorrang). Puur: zo werkt een sleutel die een beheerder uit het beleid
// haalt meteen niet meer, en blijft er niets van een vorige ronde hangen.
export function bouwConfig(lagen) {
  const c = _cloneConfig(DEFAULT_APP_CONFIG);
  (lagen || []).forEach(function (l) { legLaag(c, _cloneConfig(l)); });
  return c;
}
function naConfigWijziging(selectorsOok) {
  const a = APP_CONFIG.activation || {};
  CONFIG.urlNeedle = a.appointmentNeedle || '/events/new';
  CONFIG.registrationNeedle = a.registrationNeedle || '/registrations';
  if (selectorsOok) runConfigHook('selectorsChanged');
  // Afgeleide lijsten opnieuw (en het rechtermuismenu via formsChanged).
  refreshEffectiveConfig();
  runConfigHook('configApplied');
  try { if (typeof onHelperConfigChanged === 'function') onHelperConfigChanged(); } catch (e) {}
}
// Een opgebouwde configuratie actief maken: APP_CONFIG in zijn geheel
// vervangen (hetzelfde object, want iedereen houdt het vast) en daarna de
// haken één keer.
export function zetConfig(nieuw) {
  Object.keys(APP_CONFIG).forEach(function (k) { delete APP_CONFIG[k]; });
  Object.assign(APP_CONFIG, nieuw);
  naConfigWijziging(true);
}
// Eén laag bovenop de huidige configuratie (tests en de simulator).
export function applyHelperConfig(hc) {
  if (!hc || typeof hc !== 'object') return;
  legLaag(APP_CONFIG, hc);
  naConfigWijziging(!!(hc.uiSelectors && typeof hc.uiSelectors === 'object'));
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

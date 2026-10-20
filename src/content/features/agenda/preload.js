// Vooraf laden: wat het zijpaneel nodig heeft, wordt al opgehaald zodra de
// agenda open is, zodat een pagina in het zijpaneel meteen gevuld is.
//
// - Elke berekening wordt even onthouden (per collega's + periode). Vraagt het
//   zijpaneel hetzelfde op terwijl het vooraf laden nog bezig is, dan wacht het
//   op diezelfde berekening (en krijgt het de voortgang) in plaats van alles
//   opnieuw te doen.
// - Vooraf laden gebeurt rustig na elkaar, alleen als het tabblad zichtbaar is,
//   en hooguit eens per paar minuten.
// - 'vers' (bijv. de afwerklijst bijwerken) slaat het onthouden over.

import { viewedInviteeIds } from './navigation.js';
import { checkOpenRange, defaultRangeFrom } from './open-range.js';
import { computeProduction, defaultProductionFrom } from './production.js';
import { fetchWeekRatio } from './week-ratio.js';
import { findFreeSlots, weekdagen } from './free-slots.js';
import { vergeetWeken } from '../../services/ons-api/week-cache.js';
import { resolveInviteeId, currentAgendaDate } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { APP_CONFIG } from '../../config/app-config.js';

// Schakelaar uit het beheerscherm (features.x === false = uit).
function aan(k) { return !(APP_CONFIG.features && APP_CONFIG.features[k] === false); }

// Hoe lang een resultaat bruikbaar blijft. Afgelopen weken veranderen nauwelijks
// (productie lang); open registraties toont het paneel direct maar werkt het
// meteen daarna vers bij.
const TTL = { ratio: 5 * 60000, plan: 5 * 60000, open: 10 * 60000, productie: 30 * 60000 };
// Hooguit zo vaak vooraf laden (en dan alleen wat verlopen is).
const VOORAF_INTERVAL = 5 * 60000;
// Hoeveel vrije blokken de lijst in het zijpaneel eerst vraagt (PLAN_STAP daar).
const PLAN_STANDAARD_AANTAL = 24;
const _cache = Object.create(null);

function idsSleutel() { return viewedInviteeIds(resolveInviteeId()).join(','); }

// Is dit al (of nog) onthouden? Voor het zijpaneel: dan was het resultaat er
// meteen.
export function isCached(soort, sleutel) {
  const c = _cache[soort + '|' + idsSleutel() + '|' + sleutel];
  return !!(c && !c.bezig && (Date.now() - c.ts) < TTL[soort]);
}
// Onthoud het resultaat van `werk(onProgress)` onder `sleutel`. onProgress van
// elke aanvrager krijgt de voortgang, ook als hij later aanhaakt.
function onthouden(soort, sleutel, werk, onProgress, vers) {
  const k = soort + '|' + idsSleutel() + '|' + sleutel;
  const c = _cache[k];
  const geldig = c && (c.bezig || (Date.now() - c.ts) < TTL[soort]);
  if (geldig && !vers) {
    if (onProgress) {
      if (c.bezig) { c.luisteraars.push(onProgress); if (c.laatst) onProgress(c.laatst[0], c.laatst[1]); }
    }
    return c.promise;
  }
  const nieuw = { ts: Date.now(), bezig: true, luisteraars: onProgress ? [onProgress] : [], laatst: null, promise: null };
  nieuw.promise = werk(function (d, t) {
    nieuw.laatst = [d, t];
    nieuw.luisteraars.forEach(function (fn) { try { fn(d, t); } catch (e) {} });
  }).then(function (r) { nieuw.bezig = false; nieuw.ts = Date.now(); return r; },
    function (e) { delete _cache[k]; throw e; });
  _cache[k] = nieuw;
  return nieuw.promise;
}

// Aantal open afspraken per periode (voor de teller op het startscherm van
// het zijpaneel): alleen als de lijst er al is, nooit een extra controle.
const _openAantal = Object.create(null);
export function cachedOpenRange(from, to, onProgress, vers) {
  const k = idsSleutel() + '|' + from + '|' + to;
  return onthouden('open', from + '|' + to, function (p) {
    return checkOpenRange(from, to, p).then(function (r) {
      _openAantal[k] = ((r && r.days) || []).reduce(function (t, d) { return t + ((d && d.items) || []).length; }, 0);
      return r;
    });
  }, onProgress, vers);
}
export function openAantal(from, to) {
  if (!isCached('open', from + '|' + to)) return null;
  const n = _openAantal[idsSleutel() + '|' + from + '|' + to];
  return n == null ? null : n;
}
export function cachedProduction(from, to, onProgress) {
  return onthouden('productie', from + '|' + to, function (p) { return computeProduction(from, to, p); }, onProgress);
}
export function cachedWeekRatio(date) {
  return onthouden('ratio', String(date), function () { return fetchWeekRatio(date); });
}
export function cachedFreeSlots(minutes, weeks, tot, metBezoeken, veel, van, dagen, limiet) {
  var d = weekdagen(dagen), l = parseInt(limiet, 10) > 0 ? Math.min(400, parseInt(limiet, 10)) : 0;
  return onthouden('plan', minutes + '|' + weeks + '|' + (tot || '') + '|' + (metBezoeken ? 'b' : '') + (veel ? 'v' : '') + (van ? '|' + van : '') + (d ? '|d' + d.join('') : '') + (l ? '|l' + l : ''), function () { return findFreeSlots(minutes, weeks, tot, metBezoeken, veel, van, d, l); });
}

// Standaardperiodes: gelijk aan wat het zijpaneel als standaard invult, zodat
// het vooraf geladen resultaat ook echt gebruikt wordt.
export function defaultProductionTo() {
  const d = new Date(); d.setDate(d.getDate() + 28);
  return agendaYmd(d);
}

let _laatstVooraf = 0, _voorafSleutel = '', _bezig = false;
// Rustig na elkaar: eerst wat het snelst klaar is.
export function preloadPanelData(force) {
  if (_bezig) return;
  if (!aan('preload')) return;
  if (document.visibilityState !== 'visible') return;
  const sleutel = idsSleutel() + '|' + currentAgendaDate();
  if (!force && sleutel === _voorafSleutel && (Date.now() - _laatstVooraf) < VOORAF_INTERVAL) return;
  if (!idsSleutel()) return;
  _bezig = true; _voorafSleutel = sleutel; _laatstVooraf = Date.now();
  const vandaag = agendaYmd(new Date());
  const stap = (fn) => () => new Promise((klaar) => setTimeout(klaar, 400)).then(fn).catch(() => {});
  Promise.resolve()
    .then(stap(() => aan('weekRatio') && cachedWeekRatio(currentAgendaDate())))
    // Zoals het zijpaneel standaard zoekt (1 uur, 2 weken, 24 blokken), zodat
    // de Planhulp meteen gevuld is.
    .then(stap(() => aan('planner') && cachedFreeSlots(60, 2, '', false, false, '', null, PLAN_STANDAARD_AANTAL)))
    .then(stap(() => aan('openRegistrations') && cachedOpenRange(defaultRangeFrom(), vandaag)))
    .then(stap(() => aan('production') && cachedProduction(defaultProductionFrom(), defaultProductionTo())))
    .then(() => { _bezig = false; }, () => { _bezig = false; });
}

// Na het maken of opslaan van afspraken: de vrije tijd klopt niet meer, dus
// opnieuw ophalen (ook de onthouden weken).
export function forgetFreeSlots() { Object.keys(_cache).forEach((k) => { if (k.indexOf('plan|') === 0) delete _cache[k]; }); vergeetWeken(); }
// Alleen voor de tests.
export function _clearPreloadCache() { Object.keys(_cache).forEach((k) => delete _cache[k]); vergeetWeken(); _laatstVooraf = 0; _voorafSleutel = ''; _bezig = false; }

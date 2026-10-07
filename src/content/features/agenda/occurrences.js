import { ONS } from '../../ons/selectors.js';
import { APP_CONFIG } from '../../config/app-config.js';

// Afspraken (occurrences) in de agenda lezen: cliënt of overig, geregistreerd
// of niet, verleden of toekomst.

// ===== Classificatie: cliënttijd vs overig =====
// Een echte CLIËNTAFSPRAKEN heeft in de agenda-tegel zowel een '.name'
// (cliëntnaam, bv. "Co Test") als een '.title' (uursoort, bv. "Huisbezoek -
// Co"). Niet-cliëntgebonden afspraken (Acquisitie, Overig, verlof, pauze…)
// hebben alleen een '.name' en géén '.title'. Zo hangt de classificatie NIET
// af van de (soms afwijkende) titeltekst.
const SKIP_RE = /vaste vrije dag|vrije dag/;
// Cliënt-uursoorten (labels) — extra vangnet.
const CLIENT_LABEL_RE = /huisbezoek|telefonisch|face ?(to|2) ?face|\bmdo\b|verslaglegging|zorgco|no ?show|behandel|consult|gesprek/i;
function _hasText(el) { return !!(el && (el.textContent || '').trim()); }
export function isClientAppointment(occ) {
  // De titel-occurrence bevat de content (.name + .title).
  const main = occ.querySelector(ONS.occurrenceTitle) || occ;
  // 1) primair: zowel cliëntnaam (.name) als uursoort (.title) aanwezig.
  if (_hasText(main.querySelector('.name')) && _hasText(main.querySelector('.title'))) return true;
  // 2) oude UI: aparte appointment-title (bv. "Huisbezoek - Tinus").
  const at = occ.querySelector(ONS.appointmentTitle);
  if (_hasText(at)) return true;
  // 3) vangnet: een label met een cliënt-uursoort (bv. "JG Huisbezoek"),
  //    maar niet "JG Overig".
  let labels; try { labels = occ.querySelectorAll(ONS.labelWithTitle); } catch (e) { labels = []; }
  for (const l of labels) {
    const t = l.getAttribute('title') || '';
    if (/\boverig\b/i.test(t)) continue;
    if (CLIENT_LABEL_RE.test(t)) return true;
  }
  return false;
}
// Nette naam van een afspraak (voor de 'nog te registreren'-lijst).
export function occurrenceName(occ) {
  const at = occ.querySelector(ONS.appointmentTitle);
  if (_hasText(at)) return at.textContent.trim();
  const tt = occ.querySelector('.title');
  if (_hasText(tt)) return tt.textContent.trim();
  const nm = occ.querySelector('.name');
  if (_hasText(nm)) return nm.textContent.trim();
  return '(zonder titel)';
}
// Retourneert 'client' | 'overig' | 'skip'.
export function classifyOccurrence(occ) {
  const tt = occ.querySelector('.title');
  const txt = ((tt && tt.textContent) || '').toLowerCase();
  if (SKIP_RE.test(txt)) return 'skip';
  return isClientAppointment(occ) ? 'client' : 'overig';
}
// Een afspraak is geregistreerd als de titel-occurrence de klasse 'declared'
// heeft (en niet 'not-declared'). De reistijd-subblokjes dragen altijd
// 'not-declared' en zijn dus geen betrouwbaar signaal — kijk naar de titel.
export function isDeclared(occ) {
  const main = occ.querySelector(ONS.occurrenceTitle) || occ;
  const cl = ' ' + (main.className || '') + ' ';
  if (ONS.notDeclaredRe.test(cl)) return false;
  return ONS.declaredRe.test(cl);
}
// Ongeregistreerde tijd per dag: som van de duur van nog niet geregistreerde
// afspraken (pauze/vrije dag tellen niet mee). Onbekende types apart.
// Ligt de afspraak (volledig) in het verleden t.o.v. NU? Op basis van datum
// + begintijd + duur; telt zodra de afspraak is afgelopen.
export function occurrenceIsPast(occ, date) {
  const time = occ.getAttribute('data-time') || '00:00';
  const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
  const start = new Date(date + 'T' + (/^\d{2}:\d{2}$/.test(time) ? time : '00:00') + ':00');
  if (isNaN(start)) return false;
  return (start.getTime() + dur * 60000) <= Date.now();
}
// Afgelopen én meer dan N uur geleden -> "te laat geregistreerd" (N uit config).
export function occurrenceOverdue24h(occ, date) {
  const time = occ.getAttribute('data-time') || '00:00';
  const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
  const start = new Date(date + 'T' + (/^\d{2}:\d{2}$/.test(time) ? time : '00:00') + ':00');
  if (isNaN(start)) return false;
  const lateH = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0) ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
  return (start.getTime() + dur * 60000) <= (Date.now() - lateH * 60 * 60 * 1000);
}
// Splitst de zichtbare week op 'nu': verleden (ongeregistreerd, per dag) en
// toekomst (aankomende afspraken, totaal). Elk met direct/indirect/overig.
export function isWontDeclare(occ) {
  return !!(occ.querySelector('.wont-declare') || (occ.className || '').indexOf('wont-declare') !== -1);
}
// Opent de afspraak (klik op de occurrence → ONS opent het detail/registratie).
export function openOccurrence(occ) {
  if (!occ) return;
  try { occ.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
  const target = occ.querySelector(ONS.occurrenceTitle) || occ;
  try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  try { target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  try { target.click(); } catch (e) {}
}

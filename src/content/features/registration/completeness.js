// Controle op een volledige registratie vóór indienen.

import { fetchOnsOverlap, knownOnsOverlap } from '../../services/ons-api/open-registrations.js';
import { fetchWeekTijdvakken, huidigRegistratieTijdvak, overlapMelding, overlappendTijdvak } from '../overlap.js';
import { safe } from '../../screen/status.js';
import { helperPanel } from '../../state.js';
import { mkPillButton } from '../../ui/controls.js';
import { submitRegistrationFromHelper } from './report.js';
import { currentRegistrationId } from './pending.js';
import { _regToMin } from './fields.js';

// (B) Registratie-compleetheid vóór indienen — zelfde controles als de geteste
// registrationModel-reader, op bevestigde ankers uit REG-B (geen geometrie).
export function _regCareFlags() {
  let text = '';
  let scripts; try { scripts = document.querySelectorAll('script'); } catch (e) { return {}; }
  for (const s of scripts) { const t = s.textContent || ''; if (t.indexOf('initialStoreState') !== -1 && t.indexOf('careProvider') !== -1) { text = t; break; } }
  const bool = (k) => { const m = text.match(new RegExp('"' + k + '"\\s*:\\s*(true|false)')); return m ? m[1] === 'true' : false; };
  return { requireReport: bool('require_report_per_client'), timeDistribution: bool('time_distribution_enabled') };
}
export function activeRegistrationClientForms() {
  return Array.prototype.slice.call(document.querySelectorAll('div.client_form[data-invitee-id]'))
    .filter((r) => !registrationClientFormIsRemoved(r));
}
export function registrationCompletenessIssues() {
  const issues = [];
  const rows = activeRegistrationClientForms();
  const flags = _regCareFlags();
  for (const row of rows) {
    const id = row.getAttribute('data-invitee-id') || '';
    const name = (row.getAttribute('data-invitee-name') || '').trim() || 'cliënt';
    const cont = document.getElementById('select2-declaration_client_information_' + id + '__hour_type_id-container');
    let uSet = false;
    if (cont) {
      const ph = cont.querySelector('.select2-selection__placeholder');
      const title = cont.getAttribute('title') || '';
      const txt = (cont.textContent || '').trim();
      uSet = !ph && !!txt && !/zoek naar uursoorten|selecteer uursoort/i.test(title || txt);
    }
    if (!uSet) { const sel = document.getElementById('declaration_client_information_' + id + '__hour_type_id'); if (sel && sel.value && sel.value.trim()) uSet = true; }
    if (!uSet) issues.push({ sev: 'error', msg: 'Uursoort ontbreekt voor ' + name });
    const cb = document.getElementById('declaration_client_information_' + id + '__no_show');
    const noShow = !!(cb && cb.checked);
    const ta = document.getElementById('declaration_client_information_' + id + '__dossier_report_comment');
    const report = ta ? String(ta.value || ta.textContent || '').trim() : '';
    if (flags.requireReport && !noShow && !report) issues.push({ sev: 'error', msg: 'Schrijf eerst de rapportage voor ' + name });
    if (noShow && report) issues.push({ sev: 'warn', msg: 'No-show maar wel rapportage voor ' + name });
  }
  const startMin = _regToMin(_regFieldVal('#declaration_start_time') || _regFieldVal('#declaration_start_time_display'));
  const endMin = _regToMin(_regFieldVal('#declaration_end_time') || _regFieldVal('#declaration_end_time_display'));
  const dur = (startMin != null && endMin != null) ? endMin - startMin : null;
  if (dur != null && dur <= 0) issues.push({ sev: 'error', msg: 'Eindtijd ligt niet na begintijd' });
  if (flags.timeDistribution && dur != null && dur > 0) {
    const di = _regToMin(_regFieldVal('#declaration_direct_time')) || 0;
    const ind = _regToMin(_regFieldVal('#declaration_indirect_time')) || 0;
    if ((di + ind) > 0 && (di + ind) !== dur) issues.push({ sev: 'warn', msg: 'Direct + indirect (' + (di + ind) + ' min) komt niet overeen met de duur (' + dur + ' min)' });
  }
  // Overlap met een bestaande registratie, vóórdat ONS het bij opslaan meldt.
  try {
    const tv = huidigRegistratieTijdvak();
    if (tv.ymd && tv.startMin != null && tv.eindMin != null) {
      fetchWeekTijdvakken('registraties', tv.ymd); // laadt en cachet; melding volgt bij de volgende tekening
      const regId = currentRegistrationId();
      const hit = overlappendTijdvak('registraties', tv.ymd, tv.startMin, tv.eindMin, regId);
      // Bij een NIEUWE registratie vragen we het ook aan ONS zelf (detect_overlap);
      // bij bewerken niet, want dan telt ONS de registratie mogelijk mee met
      // zichzelf. ONS vult de eigen vergelijking aan: een 'ja' van ONS geeft een
      // melding ook als wij niets vonden. Een 'nee' onderdrukt onze melding niet,
      // omdat de vorm van dat antwoord niet gedocumenteerd is.
      let ons;
      if (!regId) {
        fetchOnsOverlap(tv.ymd, tv.startMin, tv.eindMin, '');
        ons = knownOnsOverlap(tv.ymd, tv.startMin, tv.eindMin, '');
      }
      if (hit) issues.push({ sev: 'warn', msg: overlapMelding(hit, 'een registratie') });
      else if (ons === true) issues.push({ sev: 'warn', msg: 'Let op: ONS meldt dat dit tijdvak overlapt met een bestaande registratie.' });
    }
  } catch (e) {}
  return issues;
}
// De Indienen-knop blijft een vanilla-knoop: updateRegistrationReportSubmitButton
// werkt hem live bij (tekst/kleur volgen de rapportagestatus). React plaatst hem
// alleen; zou React hem zelf tekenen, dan overschreef de volgende render dat.
export function mkRegistrationSubmitNode() {
  const submit = mkPillButton('Indienen', () => safe(submitRegistrationFromHelper));
  submit.style.width = '100%';
  submit.setAttribute('data-registration-helper-submit', '');
  return submit;
}
// Wat nog moet voor indienen, onder de Indienen-knop: per punt één regel met
// een icoon (compact, zoals de meldingen in het zijpaneel), geen gekleurd
// vak. De kwaliteitsmodule (features/quality.js) houdt de lijst elke seconde
// bij zolang het paneel open is; dan staat dezelfde melding niet ook nog
// linksonder op de pagina.
export const REGISTRATIE_CONTROLES = 'data-registration-helper-checks';
export function mkRegistrationCompletenessNode() {
  const holder = document.createElement('div');
  holder.setAttribute(REGISTRATIE_CONTROLES, '');
  let issues = [];
  try { issues = registrationCompletenessIssues(); } catch (e) { issues = []; }
  vulRegistratieControles(holder, issues);
  return holder;
}
const SVG = 'http://www.w3.org/2000/svg';
function letOpIcoon(kleur) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', kleur); svg.setAttribute('stroke-width', '2.2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  Object.assign(svg.style, { flex: '0 0 auto', marginTop: '2px' });
  ['M12 3.8 2.8 19.8h18.4z', 'M12 10v4.2', 'M12 17.2v.01'].forEach(function (d) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); svg.appendChild(p); });
  return svg;
}
// issues: [{ sev, msg }] -> regels in holder (leeg = niets).
export function vulRegistratieControles(holder, issues) {
  const sleutel = (issues || []).map(function (i) { return i.sev + '|' + i.msg; }).join('\n');
  if (holder.getAttribute('data-inhoud') === sleutel && holder.childNodes.length === (issues || []).length) return;
  holder.setAttribute('data-inhoud', sleutel);
  while (holder.firstChild) holder.removeChild(holder.firstChild);
  (issues || []).forEach(function (it) {
    const kleur = '#8a5a00';
    const regel = document.createElement('div');
    regel.setAttribute('data-registration-check', it.sev);
    Object.assign(regel.style, { display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '8px', fontSize: '12.5px', lineHeight: '1.45', color: kleur });
    const tekst = document.createElement('span');
    tekst.textContent = it.msg;
    tekst.style.minWidth = '0';
    regel.append(letOpIcoon(kleur), tekst);
    holder.appendChild(regel);
  });
}
// De lijst in het open paneel, of null (paneel dicht of een ander scherm).
export function registratieControlesInPaneel() {
  const p = helperPanel.popupEl;
  if (!p || helperPanel.popupCollapsed || !p.isConnected) return null;
  return p.querySelector('[' + REGISTRATIE_CONTROLES + ']');
}
function _regFieldVal(sel) { const el = document.querySelector(sel); if (!el) return ''; return (el.value != null && el.value !== '' ? el.value : el.getAttribute('value')) || ''; }
// Een uit de registratie verwijderde cliënt: ONS zet de klasse 'removed' op de
// client_form (en/of data-state removed/destroy; de velden staan disabled). De
// hulp moet zo'n cliënt volledig negeren — geen uursoort-/rapportagemelding,
// geen episodes-doorschakeling, enz.
export function registrationClientFormIsRemoved(row) {
  if (!row) return true;
  try {
    if (row.classList && row.classList.contains('removed')) return true;
    const st = (row.getAttribute('data-state') || '').toLowerCase();
    if (st === 'removed' || st === 'destroy') return true;
  } catch (e) {}
  return false;
}

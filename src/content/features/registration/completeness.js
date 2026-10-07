// Controle op een volledige registratie vóór indienen.

import { fetchOnsOverlap, knownOnsOverlap } from '../../services/ons-api/open-registrations.js';
import {
  fetchWeekTijdvakken,
  huidigRegistratieTijdvak,
  overlapMelding,
  overlappendTijdvak,
} from '../overlap.js';
import { safe } from '../../screen/status.js';
import { mkPillButton } from '../../ui/controls.js';
import { submitRegistrationFromHelper } from './report.js';
import { currentRegistrationId } from './pending.js';

// (B) Registratie-compleetheid vóór indienen — zelfde controles als de geteste
// registrationModel-reader, op bevestigde ankers uit REG-B (geen geometrie).
export function _regCareFlags() {
  let text = '';
  let scripts; try { scripts = document.querySelectorAll('script'); } catch (e) { return {}; }
  for (const s of scripts) { const t = s.textContent || ''; if (t.indexOf('initialStoreState') !== -1 && t.indexOf('careProvider') !== -1) { text = t; break; } }
  const bool = (k) => { const m = text.match(new RegExp('"' + k + '"\\s*:\\s*(true|false)')); return m ? m[1] === 'true' : false; };
  return { requireReport: bool('require_report_per_client'), timeDistribution: bool('time_distribution_enabled') };
}
export function _regToMin(raw) { const s = (raw == null ? '' : String(raw)).trim(); if (!s) return null; const hm = s.match(/^(\d{1,2}):(\d{2})$/); if (hm) return +hm[1] * 60 + +hm[2]; if (/^\d{1,4}$/.test(s)) return +s; return null; }
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
    if (flags.requireReport && !noShow && !report) issues.push({ sev: 'error', msg: 'Rapportage ontbreekt voor ' + name });
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
// Compleetheidsvak als losse knoop (null als er niets te melden is).
export function mkRegistrationCompletenessNode() {
  const holder = document.createElement('div');
  appendRegistrationCompleteness(holder);
  return holder.firstChild ? holder.firstChild : null;
}
function appendRegistrationCompleteness(body) {
  let issues = [];
  try { issues = registrationCompletenessIssues(); } catch (e) { return; }
  if (!issues.length) return;
  const box = document.createElement('div');
  Object.assign(box.style, { margin: '0 0 8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f0c0c0', background: '#fdecec' });
  const h = document.createElement('div');
  h.textContent = 'Controleer voor indienen:';
  Object.assign(h.style, { fontSize: '12px', fontWeight: '700', color: '#9b1c1c', marginBottom: '4px' });
  box.appendChild(h);
  const ul = document.createElement('ul');
  Object.assign(ul.style, { margin: '0', padding: '0 0 0 16px' });
  for (const it of issues) {
    const li = document.createElement('li');
    li.textContent = it.msg;
    Object.assign(li.style, { fontSize: '12px', lineHeight: '1.35', color: it.sev === 'error' ? '#9b1c1c' : '#7a5200' });
    ul.appendChild(li);
  }
  box.appendChild(ul);
  body.appendChild(box);
}

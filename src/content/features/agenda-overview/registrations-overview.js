// Declarabiliteit-paneel op de /registrations-overzichtspagina.

import { ACTIVE_PROFILE } from '../../config/app-config.js';
import { currentAgendaDate, isRegistrationOverviewPage } from '../../ons/agenda-location.js';
import { _agDateLabel, _agFmtMin, agendaWeekNumber } from '../../core/datetime.js';
import { fetchDeclarabiliteitSummary } from '../../services/ons-api/calendar.js';
import { declarabiliteitPct } from '../../domain/declarabiliteit.js';
import { RUNTIME_CONFIG } from '../../config/loader.js';
import { ONSAH_TOKENS, onsahFocusRing } from '../../ui/theme.js';
import { onsahEmptyState } from '../../ui/controls.js';
import { svgCloseIcon } from '../../ui/icons.js';

// Kleine gekleurde chip (label + waarde).
function _agChip(label, value, bg, fg) {
  var c = document.createElement('span');
  c.style.cssText = 'display:inline-flex;align-items:baseline;gap:4px;background:' + bg + ';color:' + fg + ';border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap';
  c.innerHTML = '<span style="font-weight:600;opacity:.8">' + label + '</span> ' + value;
  return c;
}
// Sectie 'Afgerond (geregistreerd)' — de ECHTE directe/indirecte/reistijd uit de
// registratie-widget (sessie-gebruiker, per dag).
export function agendaRegistrationsSectionEl(rs, dateLabel, profile) {
  var wrap = document.createElement('div'); wrap.style.cssText = 'margin-top:10px;border-top:2px solid #f0e0ea;padding-top:8px';
  var h = document.createElement('div');
  h.innerHTML = 'Afgerond · geregistreerd' + (dateLabel ? ' <span style="font-weight:400;color:#999;font-size:10px">· ' + dateLabel + '</span>' : '');
  h.style.cssText = 'font-weight:700;font-size:11px;color:' + ONSAH_TOKENS.brand + ';text-transform:uppercase;letter-spacing:.03em;margin-bottom:5px';
  wrap.appendChild(h);
  if (!rs || !rs.count) {
    wrap.appendChild(onsahEmptyState('Nog niets geregistreerd in deze week.'));
    return wrap;
  }
  // Declarabiliteit uit de ECHTE geregistreerde tijd (profielafhankelijk), in u:m.
  var dec = declarabiliteitPct(rs, profile);
  var hero = document.createElement('div');
  hero.innerHTML = '<span style="font-size:18px;font-weight:800;color:#166a37">' + _agFmtMin(dec.declarabelMinutes) + ' <span style="font-size:11px;font-weight:700;color:#777">declarabel</span></span>' +
    ' <span style="font-size:10px;color:#999">· ' + dec.baseLabel + '</span>';
  hero.style.cssText = 'margin-bottom:5px'; wrap.appendChild(hero);
  var chips = document.createElement('div'); chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
  chips.append(
    _agChip('Totaal', _agFmtMin(rs.totalMinutes), '#fbe4f1', '#a1005f'),
    _agChip('Direct', _agFmtMin(rs.directMinutes), '#e6f4ea', '#166a37'),
    _agChip('Indirect', _agFmtMin(rs.indirectMinutes), '#fff2df', '#8a5a00'),
    _agChip('Reistijd', _agFmtMin(rs.travelMinutes), '#e7edf7', '#3457a5')
  );
  wrap.appendChild(chips);
  return wrap;
}
// ---- Declarabiliteit-paneel op de /registrations-overzichtspagina ----
let _regOvPanel = null, _regOvKey = null;
export function removeRegistrationsOverviewPanel() { if (_regOvPanel) { try { _regOvPanel.remove(); } catch (e) {} _regOvPanel = null; } _regOvKey = null; }
function buildRegistrationsOverviewPanel() {
  if (_regOvPanel) return _regOvPanel;
  const p = document.createElement('div'); _regOvPanel = p; p.setAttribute('data-ons-reg-overview', '1');
  p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;width:308px;max-height:75vh;background:#fff;color:#201d1f;border:1px solid #ece7e5;border-radius:16px;box-shadow:0 14px 40px rgba(32,20,15,.24);font:13px/1.4 system-ui,sans-serif;overflow:hidden;display:flex;flex-direction:row;align-items:stretch';
  const spine = document.createElement('div');
  spine.style.cssText = 'width:14px;flex:0 0 auto;background:#cc087d';
  const mainCol = document.createElement('div');
  mainCol.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#fff;color:#201d1f;padding:10px 12px;font-weight:700;border-bottom:1px solid #f1ecea';
  const t = document.createElement('span'); t.textContent = 'Declarabiliteit';
  const x = document.createElement('button'); x.type = 'button'; x.setAttribute('data-popup-control', '');
  x.title = 'Sluiten'; x.setAttribute('aria-label', 'Sluiten'); x.style.cssText = 'border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px';
  x.appendChild(svgCloseIcon());
  x.addEventListener('click', function () { removeRegistrationsOverviewPanel(); });
  onsahFocusRing(x);
  header.append(t, x); mainCol.appendChild(header);
  const body = document.createElement('div'); body.setAttribute('data-reg-ov-body', ''); body.style.cssText = 'padding:10px 12px';
  mainCol.appendChild(body);
  p.appendChild(spine); p.appendChild(mainCol);
  (document.body || document.documentElement).appendChild(p);
  return p;
}
export function updateRegistrationsOverviewPanel() {
  try {
    if (!RUNTIME_CONFIG.enabled || !isRegistrationOverviewPage()) { removeRegistrationsOverviewPanel(); return; }
    const date = currentAgendaDate();
    const prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
    const key = date + '|' + prof;
    const panel = buildRegistrationsOverviewPanel();
    if (key === _regOvKey) return; // niets veranderd
    _regOvKey = key;
    const body = panel.querySelector('[data-reg-ov-body]');
    body.textContent = 'Declarabiliteit laden…';
    var wkNr = agendaWeekNumber(date);
    var wkLabel = wkNr ? ('week ' + wkNr) : _agDateLabel(date);
    fetchDeclarabiliteitSummary(date).then(function (rs) {
      if (_regOvKey !== key || !_regOvPanel) return;
      body.innerHTML = '';
      body.appendChild(agendaRegistrationsSectionEl(rs, wkLabel, prof));
    }, function (e) {
      if (_regOvKey !== key || !_regOvPanel) return;
      body.textContent = 'Kon declarabiliteit niet laden: ' + ((e && e.message) || 'fout');
    });
  } catch (e) {}
}

// Zelfdiagnose: ontbrekende ONS-velden en aandachtspunten, getoond in het
// meldingenkanaal (modules.js).

import { APP_CONFIG, supportTopdeskUrl } from '../config/app-config.js';
import { mkText } from '../ui/managed-text.js';
import { hasClientInAppointment } from './appointment/clients.js';
import { doorplannenWarnText, recurrenceIsSet } from './appointment/recurrence.js';
import { appointmentFlow, helperPanel } from '../state.js';
import { OnsAdapter, onsGemisteVelden, onsVergeetGemist } from './appointment/ons-adapter.js';
import { registrationCompletenessIssues } from './registration/completeness.js';
import { ModuleBase, register } from '../platform/module-host.js';

// De zelftest gebruikt nu de adapter: elk veld dat de hulp probeerde te lezen
// en niet vond, komt hier automatisch in. Voorheen stonden hier drie
// hardgecodeerde controles, waardoor bv. een verdwenen uursoort-veld niet werd
// gemeld.
export function appointmentMissingHooks() {
  onsVergeetGemist();
  OnsAdapter.afspraak.labelVeld();
  OnsAdapter.afspraak.datumVeld();
  OnsAdapter.afspraak.begintijdVeld();
  // BEWUST NIET: het uursoort-veld per cliënt. Dat veld bestaat pas zodra de
  // cliëntkaart is uitgeklapt, en de wachtrij klapt die zelf op het juiste
  // moment open. Meenemen leverde een waarschuwing op terwijl de hulp de
  // uursoort even later gewoon invulde — een melding over een probleem dat
  // er niet was. Gemiste uitlezingen komen nog wél in het register
  // (onsGemisteVelden), alleen niet in de banner voor de medewerker.
  return onsGemisteVelden();
}
// Bundelt de kwaliteitssignalen (onvolledige registratie) en zelfdiagnose
// (kern-hook niet herkend) voor het altijd-zichtbare meldingenkanaal, zodat de
// gebruiker ze ziet zonder het hulppaneel te openen. Levert [{sev,msg}].
export function helperQualityIssues() {
  const out = [];
  try {
    if (helperPanel.activeMode === 'events' && hasClientInAppointment()) {
      const miss = appointmentMissingHooks();
      if (miss.length) out.push({ sev: 'error', msg: 'Afspraakhulp herkent niet: ' + miss.join(', ') + '.' });
    }
    // Doorplannen aangevinkt maar herhaling nog op 'Niet': aandachtspunt in het
    // algemene meldingenkanaal (verdwijnt zodra een herhaling is gekozen).
    if (helperPanel.activeMode === 'events' && appointmentFlow.appointmentDoorplannen && appointmentFlow.appointmentSaveScreenActive
        && !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)
        && !recurrenceIsSet()) {
      out.push({ sev: 'warn', msg: doorplannenWarnText() });
    }
    if (helperPanel.activeMode === 'registrations') {
      registrationCompletenessIssues().forEach((it) => out.push(it));
    }
  } catch (e) {}
  return out;
}
// #3 - Markeer een veld visueel zodat de gebruiker weet waar te handelen.
export function highlightField(el, ms) {
  try {
    if (!el || el.nodeType !== 1) return;
    const prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
    el.style.outline = '2px solid #cc087d';
    el.style.outlineOffset = '2px';
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    setTimeout(() => { try { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; } catch (e) {} }, ms || 6000);
  } catch (e) {}
}
// #2 - Waarschuwingsbanner met instelbare tekst + doorklik naar het meldkanaal.
export function mkProblemBanner(missing) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { border: '1px solid #b3261e', background: '#fdecea', borderRadius: '8px', padding: '8px 10px', margin: '0 0 8px' });
  wrap.appendChild(mkText('probleem_hulp_werkt_niet',
    'Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via \'Meld probleem\' in de extensie.',
    { color: '#b3261e', fontWeight: '700', fontSize: '13px', lineHeight: '1.35' }));
  const sub = document.createElement('div');
  Object.assign(sub.style, { marginTop: '4px', fontSize: '12px', color: '#b3261e' });
  if (missing && missing.length) sub.appendChild(document.createTextNode('Niet herkend: ' + missing.join(', ') + '. '));
  const a = document.createElement('a');
  a.textContent = 'Meld probleem';
  a.href = supportTopdeskUrl(); a.target = '_blank'; a.rel = 'noopener noreferrer';
  Object.assign(a.style, { color: '#b3261e', textDecoration: 'underline', fontWeight: '700' });
  sub.appendChild(a);
  wrap.appendChild(sub);
  return wrap;
}
// Kwaliteits- en zelfdiagnosemeldingen naar het altijd-zichtbare
// meldingenkanaal tillen. Draait als kleine module op het framework; wist de
// melding zodra er niets te melden is of de hulp uit staat.
// Opstarten: kwaliteitsmeldingen als module in het meldingenkanaal
// (platform/module-host.js).
export function registerQualityModule() {
  register(ModuleBase.create(
    { id: 'kwaliteit', urls: ['https://*.onsagenda.nl/*', 'https://*.ons-dossier.nl/*'] },
    { run: function (ctx, api) {
        let issues = [];
        try { if (helperPanel.helperEnabled) issues = helperQualityIssues(); } catch (e) { issues = []; }
        if (!issues.length) { api.clearMessage(); return; }
        const errs = issues.filter((i) => i.sev === 'error').length;
        // Gestructureerde melding (tekst, geen HTML): het meldingenkanaal
        // rendert dit veilig met textContent.
        api.setMessage({
          title: errs ? 'Controleer voor opslaan' : 'Aandachtspunt',
          items: issues.map((i) => ({ text: i.msg, sev: i.sev })),
        });
      } }
  ));
}

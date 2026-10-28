// Zelfdiagnose: ontbrekende ONS-velden en aandachtspunten, getoond in het
// meldingenkanaal (modules.js).

import { APP_CONFIG, supportTopdeskUrl } from '../config/app-config.js';
import { mkText } from '../ui/managed-text.js';
import { hasClientInAppointment } from './appointment/clients.js';
import { doorplannenWarnText, recurrenceIsSet } from './appointment/recurrence.js';
import { appointmentFlow, helperPanel } from '../state.js';
import { OnsAdapter, onsGemisteVelden, onsVergeetGemist } from './appointment/ons-adapter.js';
import { registratieControlesInPaneel, registrationCompletenessIssues, vulRegistratieControles } from './registration/completeness.js';
import { ModuleBase, register } from '../platform/module-host.js';
import { ONS_URL_PATTERNS } from '../../shared/ons-hosts.js';

// De zelftest gebruikt de adapter: elk veld dat de hulp probeerde te lezen en
// niet vond, komt hier automatisch in (ook bijv. een verdwenen uursoortveld).
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
// Waarschuwingsbanner met instelbare tekst + doorklik naar het meldkanaal.
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
// Wat het meldingenkanaal toont: { title, items } of null. Registratie met
// het paneel open op de controles: die lijst bijwerken en niet ook nog
// linksonder melden. Paneel dicht (of een ander scherm): wel linksonder.
export function kwaliteitsMelding() {
  let issues = [];
  try { if (helperPanel.helperEnabled) issues = helperQualityIssues(); } catch (e) { issues = []; }
  const inPaneel = helperPanel.activeMode === 'registrations' ? registratieControlesInPaneel() : null;
  if (inPaneel) { vulRegistratieControles(inPaneel, issues); return null; }
  if (!issues.length) return null;
  const errs = issues.filter((i) => i.sev === 'error').length;
  // Gestructureerde melding (tekst, geen HTML): het meldingenkanaal rendert
  // dit veilig met textContent.
  return { title: errs ? 'Controleer voor opslaan' : 'Aandachtspunt', items: issues.map((i) => ({ text: i.msg, sev: i.sev })) };
}
// Kwaliteits- en zelfdiagnosemeldingen naar het altijd-zichtbare
// meldingenkanaal tillen. Draait als kleine module op het framework; wist de
// melding zodra er niets te melden is of de hulp uit staat.
// Opstarten: kwaliteitsmeldingen als module in het meldingenkanaal
// (platform/module-host.js).
export function registerQualityModule() {
  register(ModuleBase.create(
    { id: 'kwaliteit', urls: ONS_URL_PATTERNS },
    { run: function (api) {
        const m = kwaliteitsMelding();
        if (m) api.setMessage(m); else api.clearMessage();
      } }
  ));
}

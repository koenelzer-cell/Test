// Waarschuwing als een genodigde niet beschikbaar is.

import { mkModalShell } from '../../ui/modal-shell.js';
import { clean, isOwnPopup } from '../../ons/dom.js';
import { firstNameFromName } from '../../ons/appointment-form.js';
import { appointmentInSaveStage, showAppointmentReadyToSave } from './save.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { createCurrentScreenRestore } from '../../helper/screen-restore.js';
import { onsahFocusRing } from '../../ui/theme.js';
import { mkButton, mkPillButton } from '../../ui/controls.js';
import { resetBody } from '../../screen/screen-state.js';
import { closeOnsModal } from '../../ons/modal.js';
import { showChoices } from './choices.js';
import { deepQueryAll } from '../../ons/dom.js';

function unavailableInvitees() {
  const out = [];
  const seen = new Set();
  // ONS zet voor elke onbeschikbare genodigde een verborgen span met de tekst
  // "X heeft al een afspraak". Dat is betrouwbaarder dan geometrie-gebaseerde
  // badge-detectie.
  for (const el of deepQueryAll('span, div')) {
    if (isOwnPopup(el)) continue;
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt.includes('heeft al een afspraak')) continue;
    // Naam staat vóór "heeft al een afspraak"
    const name = txt.replace(/\s*heeft al een afspraak.*$/i, '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, firstName: firstNameFromName(name), role: '' });
  }
  return out.sort((a, b) => a.firstName.localeCompare(b.firstName));
}
function availabilityPersonKey(entry) {
  // Eén sleutel per persoon (genormaliseerde naam). De rol-tekst kan tussen
  // renders licht verschillen; door alleen de naam te gebruiken verschijnt de
  // "heeft al een afspraak"-melding maximaal één keer per gekoppelde persoon.
  return clean(entry.name || entry.firstName || '').toLowerCase().replace(/\s+/g, ' ');
}
export function appointmentNeedsAvailabilityConfirmation() {
  // Uitgeschakeld op verzoek: de melding "heeft al een afspraak, alsnog
  // doorgaan?" liet het scherm heen en weer springen en las soms onzin-namen.
  // De afspraakhulp bemoeit zich niet met beschikbaarheid.
  return false;
}
// Onderbrekende dialoog (spine-modal) i.p.v. een inline Ja/Nee-prompt in het
// paneel: dit is een besluit met risico (mogelijk dubbel boeken), dus dat
// verdient dezelfde nadruk als de andere onderbrekende dialogen.
export function showAvailabilityWarning() {
  const body = $body(); if (!body) return;
  const entries = unavailableInvitees().filter((entry) => !appointmentFlow.appointmentAvailabilityConfirmedPeople.has(availabilityPersonKey(entry)));
  if (!entries.length) { showChoices(); return; }
  if (!helperPanel._availabilityRestore) helperPanel._availabilityRestore = createCurrentScreenRestore();
  const names = entries.map((entry) => entry.firstName).filter(Boolean);
  const nameText = names.length <= 1 ? (names[0] || 'Deze genodigde') : `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
  setStatus('Let op: al een afspraak', false);
  const shell = mkModalShell('onsAvailabilityWarningModal', 'Toch doorgaan?', { spineColor: '#b45309', maxWidth: '360px' });
  const msg = document.createElement('div');
  msg.textContent = `${nameText} ${names.length === 1 ? 'heeft' : 'hebben'} op dit moment al een afspraak.`;
  Object.assign(msg.style, { fontSize: '13.5px', color: '#4a4448', lineHeight: '1.45', margin: '0 0 16px' });
  shell.body.appendChild(msg);
  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
  const noBtn = document.createElement('button');
  noBtn.type = 'button'; noBtn.textContent = 'Nee';
  Object.assign(noBtn.style, { appearance: 'none', border: '1px solid #ece7e5', background: 'transparent', color: '#6b6367', borderRadius: '999px', padding: '9px 16px', font: '600 12.5px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: 'pointer' });
  onsahFocusRing(noBtn);
  noBtn.addEventListener('click', () => safe(() => {
    shell.close();
    helperPanel._availabilityRestore = null;
    resetBody(body);
    const msg2 = document.createElement('div');
    msg2.textContent = 'Plan een andere datum/tijdstip in of sluit het scherm af.';
    Object.assign(msg2.style, { fontSize: '13px', color: '#333', lineHeight: '1.45', padding: '4px 0 8px' });
    body.appendChild(msg2);
    body.appendChild(mkButton('Afsluiten', () => safe(closeOnsModal)));
    body.appendChild(mkButton('Terug', () => safe(showChoices)));
    setStatus('Niet doorgaan gekozen', false);
  }));
  const yesBtn = mkPillButton('Ja, doorgaan', () => safe(() => {
    shell.close();
    entries.forEach((entry) => appointmentFlow.appointmentAvailabilityConfirmedPeople.add(availabilityPersonKey(entry)));
    helperPanel._availabilityRestore = null;
    // Door naar de juiste vervolgpagina: bij een ingevulde 'Overig'-titel of een
    // verder complete afspraak rechtstreeks naar de opslaanpagina, anders het keuzescherm.
    if (appointmentInSaveStage()) {
      if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) appointmentFlow.nonClientFreeTitleScreenActive = false;
      showAppointmentReadyToSave();
    } else {
      appointmentFlow.appointmentForceChoiceOnce = true;
      showChoices();
    }
    setStatus('');
  }), { from: '#b45309', to: '#8a3d05', shadowRgb: '180,83,9' });
  actions.append(noBtn, yesBtn);
  shell.body.appendChild(actions);
}

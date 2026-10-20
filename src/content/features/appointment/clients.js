// Cliëntkaarten in het afspraakformulier vinden en openklappen.

import { clean, deepQueryAll, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { clickOption, uiText } from '../../ons/form-controls.js';
import { entryUursoortIsSet, findClientEntries, findClientNameText, findClientUursoortTrigger, invalidateClientEntries } from '../../ons/appointment-form.js';
import { findClientFirstName } from './client-name.js';
import { clickAt, isAddInviteeControl } from '../../ons/interaction.js';
import { UI_OVERRIDES } from '../../ons/selector-overrides.js';

export function clickInviteeToggle(btn) {
  if (isAddInviteeControl(btn)) { return; }
  try { btn.focus && btn.focus(); } catch (e) {}
  const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
  if (inner) clickOption(inner);
  else clickOption(btn);
}
export function inviteeToggleExpanded(btn) {
  if (!btn) return null;
  const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
  const nodes = [btn, inner].filter(Boolean);
  for (const node of nodes) {
    const expanded = node.getAttribute && node.getAttribute('aria-expanded');
    if (expanded === 'true') return true;
    if (expanded === 'false') return false;
    const label = clean((node.getAttribute && node.getAttribute('aria-label')) || '');
    if (label.includes('verbergen')) return true;
    if (label.includes('weergeven') || label.includes('tonen')) return false;
  }
  return null;
}
// Eén centrale, benoemde toestand voor de cliënt-uursoort-flow. Dit is de
// "waarheidsbron" die 1-op-1 overeenkomt met de los geteste agendaModel-reader
// (agendaModel.js / agendaModel.test.js). De wachtrij en de gereed-checks
// baseren zich hierop i.p.v. op losse ad-hoc checks.
//   NEEDS_PREREQS  - nog geen cliënten in de modal
//   CHOICE         - cliënten aanwezig, niemand heeft een uursoort -> keuze tonen
//   MIXED          - sommige cliënten gezet, andere nog niet -> deel resteert
//   READY_TO_SAVE  - cliënten aanwezig en allemaal een uursoort
export function computeAppointmentUursoortState() {
  invalidateClientEntries();
  const entries = findClientEntries();
  if (!entries.length) return 'NEEDS_PREREQS';
  const setCount = entries.filter(entryUursoortIsSet).length;
  if (setCount === 0) return 'CHOICE';
  if (setCount === entries.length) return 'READY_TO_SAVE';
  return 'MIXED';
}
function findClientExpandButton() {
  const fullName = findClientNameText();
  const inviteeNames = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
    .filter((el) => visible(el) && !isOwnPopup(el) && (!fullName || (el.textContent || '').trim() === fullName));
  const exactButtons = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]')
    .filter((btn) => visible(btn) && !isOwnPopup(btn));
  if (fullName) {
    const byLabel = exactButtons.find((btn) => clean(btn.getAttribute('aria-label') || '').includes(clean(fullName)));
    if (byLabel) return byLabel;
  }
  for (const nameEl of inviteeNames) {
    const nr = rect(nameEl);
    const rowButton = exactButtons
      .map((btn) => ({ btn, r: rect(btn) }))
      .filter(({ r }) => r.left > nr.left + 250 && r.top >= nr.top - 80 && r.top <= nr.top + 70)
      .sort((a, b) => Math.abs((a.r.top + a.r.height / 2) - (nr.top + nr.height / 2)) - Math.abs((b.r.top + b.r.height / 2) - (nr.top + nr.height / 2)))[0];
    if (rowButton) return rowButton.btn;
  }
  const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
  let best = null, bestScore = Infinity;
  for (const label of clientLabels) {
    const lr = rect(label);
    for (const btn of deepQueryAll('button,[role="button"],[tabindex]')) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      const t = clean(uiText(btn));
      if (/toevoegen|verwijder|agenda|beschikbaar|niet beschikbaar|clienten zijn aanwezig/.test(t)) continue;
      const br = rect(btn);
      if (br.width < 22 || br.width > 78 || br.height < 22 || br.height > 78) continue;
      if (br.left < lr.left + 250) continue;
      if (br.top < lr.top - 90 || br.top > lr.top + 70) continue;
      const centerY = br.top + br.height / 2;
      const score = -br.left * 5 + Math.abs(centerY - (lr.top - 12)) * 10 + (t ? 15 : 0);
      if (score < bestScore) { best = btn; bestScore = score; }
    }
  }
  return best;
}
export function hasClientInAppointment() {
  if (findClientEntries().length > 0 || !!findClientNameText() || !!findClientFirstName() || !!findClientExpandButton()) return true;
  return deepQueryAll('span[class*="_invitee-info_"], span[class*="_invitee-name_"], ._invitee-info_sohx9_34, ._invitee-name_sohx9_40')
    .some(function (el) {
      if (!visible(el) || isOwnPopup(el)) return false;
      const txt = clean(el.textContent || '');
      if (!txt || txt.includes('medewerker')) return false;
      const r = rect(el);
      return deepQueryAll('div,span,p').some(function (role) {
        if (!visible(role) || isOwnPopup(role) || clean(role.textContent || '') !== 'client') return false;
        const rr = rect(role);
        return rr.top >= r.bottom - 12 && rr.top <= r.bottom + 70 && Math.abs(rr.left - r.left) <= 190;
      });
    });
}
function clickClientRowChevronFallback() {
  const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
  let best = null, bestY = null, bestScore = Infinity;
  for (const label of clientLabels) {
    const lr = rect(label);
    for (const section of deepQueryAll('div')) {
      if (!visible(section) || isOwnPopup(section)) continue;
      const sr = rect(section);
      if (sr.left > lr.left - 90 || sr.right < lr.left + 300) continue;
      if (sr.top > lr.top - 70 || sr.bottom < lr.bottom + 20) continue;
      if (sr.width < 260 || sr.width > 760 || sr.height < 60 || sr.height > 240) continue;
      const score = Math.abs(sr.top - (lr.top - 54)) + Math.abs(sr.left - (lr.left - 55));
      if (score < bestScore) { best = section; bestY = lr.top - 13; bestScore = score; }
    }
  }
  if (!best) return false;
  const r = rect(best);
  const x = Math.round(r.right - 28);
  const y = Math.round(bestY || (r.top + 42));
  // Blinde coördinaatklik: NOOIT op de "+ Toevoegen"-knop (Genodigden) landen,
  // anders opent de zoek-genodigden-modal i.p.v. het uitklappen van de kaart.
  if (isAddInviteeControlAtPoint(x, y)) { return false; }
  clickAt(x, y);
  return true;
}
// Ligt onder dit punt de knop die genodigden/cliënten toevoegt? Zowel de
// "+ Toevoegen"-knop als de zoek-genodigden-trigger tellen mee.
function isAddInviteeControlAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  const host = el.closest && el.closest('button,a,[role="button"],uc-button,[data-qa*="add" i],[data-qa*="invitee" i]');
  if (!host) return false;
  const t = clean(uiText(host) || host.textContent || '');
  const qa = clean((host.getAttribute && host.getAttribute('data-qa')) || '');
  return /toevoegen|genodigd/.test(t) || /add|invitee|attendee/.test(qa);
}
export function ensureClientExpanded(onResult, attempt = 0) {
  invalidateClientEntries();
  const entries = findClientEntries();
  // Klaar zodra elke clientkaart open staat (toggle uitgeklapt) OF er al een
  // uursoort-veld zichtbaar is. We wachten NIET tot het uursoort-veld gevuld is,
  // want dat wordt handmatig gedaan en zou de helper ~5s laten hangen.
  const allOpen = entries.length && entries.every((entry) =>
    !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true);
  if (allOpen) { onResult(true); return; }
  // Alleen klikken als de kaart ECHT dichtgeklapt is (aria-expanded="false").
  // Tijdens het kiezen van sommige uursoorten (bv. "Behandeling 18+") herbouwt
  // ONS de genodigde-rij: het uursoort-veld verdwijnt heel even én aria-expanded
  // is dan onbepaald (null). Met de oude test (`!== true`) telde die tussenstand
  // als "dicht" en klikte de helper de genodigdenkaart open/dicht. Bij uursoorten
  // die de rij niet herbouwen (bv. "GGZ No Show factuur") gebeurde dat niet -
  // vandaar het verschil per uursoort.
  const closed = entries.filter((entry) => !entry.uursoortTrigger && entry.toggle && inviteeToggleExpanded(entry.toggle) === false);
  if (attempt % 2 === 0) {
    if (closed.length) closed.forEach((entry) => clickInviteeToggle(entry.toggle));
    else if (!entries.length) {
      const btn = findClientExpandButton();
      if (btn) clickInviteeToggle(btn);
      else clickClientRowChevronFallback();
    }
  }
  if (attempt < 12) setTimeout(() => ensureClientExpanded(onResult, attempt + 1), 140);
  else {
    const finalEntries = findClientEntries();
    onResult(finalEntries.length
      ? finalEntries.every((entry) => !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true)
      : !!findClientUursoortTrigger());
  }
}

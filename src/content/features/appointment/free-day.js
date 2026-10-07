// Vrije dag: op een grijze (vrije) dag treedt de afspraakhulp niet op.

import { ONS } from '../../ons/selectors.js';
import { isOwnPopup } from '../../ons/dom.js';
import { setSubmitBlocked } from './submit-guard.js';
import { appointmentFlow } from '../../state.js';
import { $body, setStatus } from '../../screen/status.js';
import { clearScreenMark } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';

// ===== Vrije dag: detectie via de 'unavailability'-occurrence =====
// Een dag geldt als vrij zodra er een onbeschikbaarheids-occurrence
// (data-type="unavailability" / class "unavailable") voor die datum bestaat.
function elementIsFreeDayUnavailability(el) {
  if (!el || isOwnPopup(el)) return false;
  const type = (el.getAttribute && el.getAttribute('data-type')) || '';
  const cls = (el.className || '') + '';
  // Aanwezigheid van een onbeschikbaarheids-occurrence is genoeg (ongeacht tekst).
  return type === 'unavailability' || /\bunavailable\b/.test(cls);
}
// Alleen een GROTE onbeschikbaarheid (> 4 uur, bv. een vrije dag) schakelt de
// gekleurde indeling uit; een kleine onbeschikbaarheid niet.
const FREE_DAY_MIN_MINUTES = 240;
function unavailabilityMinutes(el, col) {
  let mins = parseInt(el.getAttribute('data-duration'), 10);
  if (mins > 0) return mins;
  // Fallback: schat uit de gerenderde hoogte t.o.v. de 24-uurs dag-kolom.
  const h = col && (col.clientHeight || (col.getBoundingClientRect && col.getBoundingClientRect().height)) || 0;
  if (h > 0 && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) return (r.height / h) * 24 * 60;
  }
  return 0;
}
function columnUnavailabilityMinutes(col) {
  if (!col) return 0;
  let total = 0; const seen = new Set();
  const add = (el) => {
    if (!elementIsFreeDayUnavailability(el)) return;
    const id = el.getAttribute('data-id') || (el.getAttribute('data-time') + '|' + el.getAttribute('data-date'));
    if (seen.has(id)) return; seen.add(id);
    total += unavailabilityMinutes(el, col);
  };
  try { col.querySelectorAll(ONS.unavailability).forEach(add); } catch (e) {}
  const date = col.getAttribute('data-date');
  if (date) {
    try { document.querySelectorAll('[data-type="unavailability"][data-date="' + date + '"], .js_calendar_occurrence.unavailable[data-date="' + date + '"]').forEach(add); } catch (e) {}
  }
  return total;
}
function dateHasFreeDayUnavailability(date) {
  const col = document.querySelector(ONS.dayColumn + '[data-date="' + date + '"]');
  return columnUnavailabilityMinutes(col || { getAttribute: () => date }) > FREE_DAY_MIN_MINUTES;
}
export function dayColumnLooksFree(col) {
  if (!col) return false;
  return columnUnavailabilityMinutes(col) > FREE_DAY_MIN_MINUTES;
}
// Onthoud bij een klik op de agenda of de betrokken dag-kolom grijs/vrij is.
// Deze klik gaat vooraf aan het openen van het nieuwe-afspraak-scherm.
function trackCalendarClickForFreeDay(e) {
  const t = e.target;
  if (!t || (t.closest && isOwnPopup(t))) return;
  const col = t.closest && t.closest(ONS.dayColumn);
  if (!col) return;
  appointmentFlow.appointmentFreeDay = dayColumnLooksFree(col);
  appointmentFlow.appointmentFreeDayDate = col.getAttribute('data-date') || null;
}
// Opstarten: klikken op de agenda volgen voor de vrije-dagdetectie.
export function installFreeDayTracking() {
  document.addEventListener('click', trackCalendarClickForFreeDay, true);
}
// Vangnet: bepaal (opnieuw) of de actieve afspraakdatum een grijze kolom is,
// door in de achtergrond-agenda de kolom met dezelfde datum te controleren.
export function refreshFreeDayFromBackgroundCalendar() {
  if (!appointmentFlow.appointmentFreeDayDate) return;
  // Alleen upgraden naar 'vrij'; het wissen gebeurt via een klik op een
  // gewone dag-kolom (trackCalendarClickForFreeDay). Zo overschrijft een
  // achter-de-modal niet-gerenderde kolom nooit een terechte detectie.
  const col = document.querySelector('.day.js_day[data-date="' + appointmentFlow.appointmentFreeDayDate + '"]');
  if (col && dayColumnLooksFree(col)) appointmentFlow.appointmentFreeDay = true;
  else if (dateHasFreeDayUnavailability(appointmentFlow.appointmentFreeDayDate)) appointmentFlow.appointmentFreeDay = true;
}
export function showFreeDayInactive() {
  const body = $body(); if (!body) return;
  clearScreenMark();
  renderScreen(body, 'infoScreen', {
    title: 'Vrije dag',
    titleStyle: { fontWeight: 700, fontSize: 14, color: '#555', padding: '4px 0 2px' },
    body: 'Deze dag is grijs gemarkeerd. De afspraakhulp is hier niet actief.',
    bodyStyle: { lineHeight: 1.35 },
  });
  setSubmitBlocked(false);
  setStatus('Vrije dag — hulp inactief', false);
}

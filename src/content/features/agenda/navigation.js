import { ONS } from '../../ons/selectors.js';

// Naar een dag of week in de agenda springen (via de router van ONS).

export function currentInviteeId(date) {
  const m = location.href.match(/\/invitees\/(\d+)\/calendar/);
  if (m) return m[1];
  const col = document.querySelector(ONS.dayColumn + (date ? '[data-date="' + date + '"]' : ''));
  return col ? col.getAttribute('data-invitee-id') : null;
}
function calendarUrl(view, date, inviteeId) {
  return location.origin + '/invitees/' + inviteeId + '/calendar/' + view + '?date=' + date;
}
export function currentCalendarView() {
  const m = location.href.match(/\/calendar\/(\w+)/);
  return m ? m[1] : '';
}
// Navigeert via een echte <a>-klik zodat ONS' eigen SPA-router het kan
// afvangen (client-side, snel) i.p.v. een volledige paginaherlaad.
export function spaNavigate(url) {
  try {
    const a = document.createElement('a');
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) { location.href = url; }
}
// Navigeert naar de dag-weergave van die datum voor de huidige invitee.
// Zonder `always` gebeurt er niets als je al in dagweergave staat (de
// dagkaarten zijn dan de dag zelf); de periodecontrole springt wel altijd.
export function jumpToDay(date, always) {
  if (!always && currentCalendarView() === 'day') return; // al in dagweergave: niets doen
  const id = currentInviteeId(date);
  if (!id) return;
  spaNavigate(calendarUrl('day', date, id));
}
// Navigeert naar de werkweek-weergave (van de eerste zichtbare dag, of vandaag).
export function jumpToWeek() {
  const firstCol = document.querySelector(ONS.dayColumn + '[data-date]');
  const date = (firstCol && firstCol.getAttribute('data-date')) || new Date().toISOString().slice(0, 10);
  const id = currentInviteeId(date);
  if (!id) return;
  spaNavigate(calendarUrl('workweek', date, id));
}

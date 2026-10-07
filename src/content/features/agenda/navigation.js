import { ONS } from '../../ons/selectors.js';

// Naar een dag of week in de agenda springen (via de router van ONS).

// Alle invitees in de URL: /invitees/13970,45267/calendar/day toont meerdere
// agenda's naast elkaar.
export function currentInviteeIds() {
  const m = location.href.match(/\/invitees\/(\d+(?:,\d+)*)\/calendar/);
  return m ? m[1].split(',') : [];
}
// Naam van een medewerker in een gedeelde agenda, voor de kopjes per collega
// in het zijpaneel. Uit de pagina (data-invitee-name of een title/aria-label
// bij dat id); lukt dat niet, dan 'Medewerker <id>'.
export function inviteeName(id) {
  try {
    const kand = document.querySelectorAll('[data-invitee-id="' + id + '"]');
    for (const el of kand) {
      const n = el.getAttribute('data-invitee-name') || el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const t = String(n).replace(/\s+/g, ' ').trim();
      if (t && t.length <= 60) return t;
    }
    const naam = document.querySelector('[data-invitee-name][data-invitee-id="' + id + '"], [data-employee-id="' + id + '"][data-employee-name]');
    if (naam) return (naam.getAttribute('data-invitee-name') || naam.getAttribute('data-employee-name') || '').trim() || ('Medewerker ' + id);
  } catch (e) {}
  return 'Medewerker ' + id;
}
// De (eerste) invitee: voor onderdelen die over één medewerker gaan, zoals het
// weekoverzicht.
export function currentInviteeId(date) {
  const ids = currentInviteeIds();
  if (ids.length) return ids[0];
  const col = document.querySelector(ONS.dayColumn + (date ? '[data-date="' + date + '"]' : ''));
  return col ? col.getAttribute('data-invitee-id') : null;
}
// Alle bekeken invitees, met als terugval de ene uit de pagina of `fallback`.
export function viewedInviteeIds(fallback) {
  const ids = currentInviteeIds();
  if (ids.length) return ids;
  const een = currentInviteeId(null) || fallback;
  return een != null ? [String(een)] : [];
}
// Bij meerdere invitees blijven ze allemaal in beeld na het springen.
function calendarUrl(view, date, inviteeId) {
  const ids = currentInviteeIds();
  const deel = ids.length > 1 ? ids.join(',') : inviteeId;
  return location.origin + '/invitees/' + deel + '/calendar/' + view + '?date=' + date;
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

// Wat de ONS-URL zegt: welke agenda (invitee) en datum de medewerker bekijkt,
// en of dit een registratieformulier of het registratieoverzicht is.

import { agendaYmd } from '../core/datetime.js';
import { deepQueryAll } from '../ons/dom.js';

// ===== Ons Agenda-API (route B: same-origin, sessiecookie) =====
// Haalt de weekafspraken van één invitee op via /calendar/invitee/{id}/entries/week.
// Die endpoint levert de herhalingen al uitgerold per dag (elk item is één concreet
// voorval), dus we hoeven client-side geen herhalingen uit te rollen.
let _inviteeIdOverride = null; // testhaak / handmatige override
export function setInviteeIdOverride(v) { _inviteeIdOverride = (v == null ? null : v); }
function _agInt(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
// Leest de invitee-id uit een pad/URL zoals /calendar/invitee/45267/entries/week.
export function parseInviteeIdFromPath(path) {
  const m = String(path == null ? '' : path).match(/\/calendar\/invitee\/(\d+)\b/);
  return m ? _agInt(m[1]) : null;
}
export function resolveInviteeId() {
  if (_inviteeIdOverride != null) return _inviteeIdOverride;
  // 1) De agenda staat op .../calendar/invitee/{id}/... -> uit de huidige URL.
  const fromUrl = parseInviteeIdFromPath((location && (location.pathname + location.search + location.hash)) || '');
  if (fromUrl != null) return fromUrl;
  // 2) Fallback: een detail-/agenda-link in de DOM (meta.detailsUrl-vorm).
  try {
    const a = deepQueryAll('a').find(function (el) { return /\/calendar\/invitee\/\d+\//.test((el.getAttribute && el.getAttribute('href')) || ''); });
    if (a) { const id = parseInviteeIdFromPath(a.getAttribute('href')); if (id != null) return id; }
  } catch (e) {}
  return null;
}
// Datum ('YYYY-MM-DD') uit de huidige agenda-URL (?date=...), anders vandaag. Zo
// ververst het overzicht mee met de week die de gebruiker bekijkt.
export function currentAgendaDate() {
  const m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec((location && (location.search || location.href)) || '');
  return m ? m[1] : agendaYmd(new Date());
}
// De registratie-INVUL/edit-flow: /registrations/{id}/edit of .../registrations/new.
export function isRegistrationEditOrNew(path) {
  return /\/registrations\/([^/]+\/edit|new)(?:$|[/?#])/.test(path != null ? path : (location.pathname || ''));
}
// De registratie-OVERZICHTSPAGINA: kale /registrations (evt. ?date=), zonder id/new.
export function isRegistrationOverviewPage(path) {
  return /\/registrations\/?$/.test(path != null ? path : (location.pathname || ''));
}

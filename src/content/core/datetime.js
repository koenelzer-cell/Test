// Datum- en tijdhulpjes: YYYY-MM-DD, weeknummers, verleden/toekomstige week,
// kloktijd <-> minuten en weergave voor de medewerker ("1 u 30 m", "ma 3-9").
// Datums met date-fns (src/shared/datum.js): ISO-weken, Nederlandse notatie.

import { format, getISOWeek, startOfISOWeek, startOfToday } from 'date-fns';
import { nl } from 'date-fns/locale/nl';
import { uitYmd, ymd } from '../../shared/datum.js';

// Datum -> 'YYYY-MM-DD' (lokale kalenderdag; de endpoint verwacht een dag in de week).
export function agendaYmd(d) {
  const dt = (d instanceof Date) ? d : (d != null && d !== '' ? new Date(d) : new Date());
  return ymd(dt);
}
// Ligt de bekeken week VOLLEDIG in de toekomst (maandag na vandaag)? Dan tonen we de
// planning per afspraaktype. Anders (deze week of eerder) tonen we de echte registraties
// per uursoort — zodat registraties die begin van de week al zijn gedaan óók verschijnen.
export function _agIsFutureWeek(dag) {
  const base = uitYmd(dag) || new Date(dag || Date.now());
  if (isNaN(base.getTime())) return false;
  return startOfISOWeek(base).getTime() > startOfToday().getTime();
}
// ---- Weekoverzicht-paneel op de agenda (gebaseerd op de API-data) ----
export function _agFmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
// 'YYYY-MM-DD' -> 'ma 3-9'
export function _agDateLabel(dag) {
  const d = uitYmd(dag);
  return d ? format(d, 'EEEEEE d-M', { locale: nl }) : String(dag || '');
}
// ISO-8601 weeknummer voor de titel ("week 36").
export function agendaWeekNumber(dag) {
  const d = uitYmd(dag) || new Date(dag || Date.now());
  return isNaN(d.getTime()) ? null : getISOWeek(d);
}
export function addOneHourText(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  const d = new Date();
  if (m) {
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  } else {
    d.setSeconds(0, 0);
  }
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function addMinutesText(value, minutes) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function timeTextToMinutes(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
export function minutesToDurationText(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  return String(Math.round(minutes));
}
export function registrationDurationLabel(minutes) {
  if (minutes < 60) return `${minutes} min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} uur${rest ? ` ${rest} min.` : ''}`;
}

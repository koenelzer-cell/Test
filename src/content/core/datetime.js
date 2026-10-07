// Datum- en tijdhulpjes: YYYY-MM-DD, weeknummers, verleden/toekomstige week,
// kloktijd <-> minuten en weergave voor de medewerker ("1 u 30 m", "ma 3-9").

// Datum -> 'YYYY-MM-DD' (lokale kalenderdag; de endpoint verwacht een dag in de week).
export function agendaYmd(d) {
  var dt = (d instanceof Date) ? d : (d != null && d !== '' ? new Date(d) : new Date());
  if (isNaN(dt.getTime())) return null;
  var mm = ('0' + (dt.getMonth() + 1)).slice(-2), dd = ('0' + dt.getDate()).slice(-2);
  return dt.getFullYear() + '-' + mm + '-' + dd;
}
// Ligt de bekeken week VOLLEDIG in de toekomst (maandag na vandaag)? Dan tonen we de
// planning per afspraaktype. Anders (deze week of eerder) tonen we de echte registraties
// per uursoort — zodat registraties die begin van de week al zijn gedaan óók verschijnen.
export function _agIsFutureWeek(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  var base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(ymd || Date.now());
  if (isNaN(base.getTime())) return false;
  base.setHours(0, 0, 0, 0);
  var day = base.getDay() || 7;
  var monday = new Date(base); monday.setDate(base.getDate() - (day - 1)); monday.setHours(0, 0, 0, 0);
  var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  return monday.getTime() > todayStart.getTime();
}
// ---- Weekoverzicht-paneel op de agenda (gebaseerd op de API-data) ----
export function _agFmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
var _AG_WKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
export function _agDateLabel(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); if (!m) return String(ymd || '');
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return _AG_WKDAG[d.getDay()] + ' ' + (+m[3]) + '-' + (+m[2]);
}
// ISO-8601 weeknummer voor de titel ("week 36").
export function agendaWeekNumber(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  var d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(ymd || Date.now());
  if (isNaN(d.getTime())) return null;
  var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
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

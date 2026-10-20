// Datums zoals ONS ze gebruikt ('YYYY-MM-DD') en zoals de medewerker ze leest
// (Nederlands), met date-fns: weeknummers volgens ISO, rekenen met dagen over
// de wissel naar zomer- of wintertijd heen, en één plek voor de notatie.
// Datums zonder tijd zijn lokale middernacht.

import { addDays, eachWeekOfInterval, format, getISOWeek, isValid, parseISO, startOfISOWeek } from 'date-fns';
import { nl } from 'date-fns/locale/nl';

const NL = { locale: nl };
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Date -> 'YYYY-MM-DD' (null bij een ongeldige datum).
export function ymd(d) { return d instanceof Date && isValid(d) ? format(d, 'yyyy-MM-dd') : null; }
// 'YYYY-MM-DD' -> Date (lokale middernacht), of null.
export function uitYmd(s) {
  if (!YMD.test(String(s || ''))) return null;
  const d = parseISO(String(s));
  return isValid(d) ? d : null;
}
// ISO-weeknummer (week 1 bevat de eerste donderdag van het jaar).
export function isoWeek(s) { const d = uitYmd(s); return d ? getISOWeek(d) : null; }
// Maandag van de week van die dag, als 'YYYY-MM-DD'.
export function maandagVan(s) { const d = uitYmd(s); return d ? ymd(startOfISOWeek(d)) : null; }
// n dagen later (of eerder bij een negatief getal).
export function plusDagen(s, n) { const d = uitYmd(s); return d ? ymd(addDays(d, n)) : null; }
// Alle maandagen van de weken die [van, tot] raken; [] bij een ongeldige of omgekeerde periode.
export function maandagenTussen(van, tot) {
  const a = uitYmd(van), b = uitYmd(tot);
  if (!a || !b || a > b) return [];
  return eachWeekOfInterval({ start: a, end: b }, { weekStartsOn: 1 }).map(ymd);
}

function hoofdletter(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
// 'Dinsdag 13 oktober', kort 'Di 13 oktober'.
export function dagLang(s, kort) {
  const d = uitYmd(s);
  return d ? hoofdletter(format(d, kort ? 'EEEEEE d MMMM' : 'EEEE d MMMM', NL)) : String(s == null ? '' : s);
}
// 'di 13 okt', met jaar 'di 13 okt 2026' (afkortingen zonder punt).
export function dagKort(s, metJaar) {
  const d = uitYmd(s);
  return d ? format(d, metJaar ? 'EEEEEE d MMM yyyy' : 'EEEEEE d MMM', NL).replace(/\./g, '') : String(s == null ? '' : s);
}
// 'oktober 2026'
export function maandJaar(d) { return d instanceof Date && isValid(d) ? format(d, 'LLLL yyyy', NL) : ''; }
// Werkweek van die dag: '5 tot en met 9 oktober', over de maand heen
// '29 september tot en met 3 oktober'. metJaar: het jaar erachter als het
// niet dit jaar is.
export function werkweekTekst(s, metJaar) {
  const d = uitYmd(s);
  if (!d) return '';
  const ma = startOfISOWeek(d), vr = addDays(ma, 4);
  let tekst = format(ma, ma.getMonth() !== vr.getMonth() ? 'd MMMM' : 'd', NL) + ' tot en met ' + format(vr, 'd MMMM', NL);
  if (metJaar && ma.getFullYear() !== new Date().getFullYear()) tekst += ' ' + ma.getFullYear();
  return tekst;
}

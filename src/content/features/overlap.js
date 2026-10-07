// Waarschuwing vóór opslaan als het tijdvak overlapt met een bestaande
// afspraak/registratie.

import { resolveInviteeId } from '../ons/agenda-location.js';
import { timeTextToMinutes } from '../core/datetime.js';
import { mapAgendaWeekResponse } from '../domain/agenda-entries.js';
import { _apiUrl } from '../services/ons-api/endpoints.js';
import { inputTextValue } from '../ons/form-controls.js';
import { getDateInput, getEndTimeInput } from '../ons/appointment-form.js';
import { appointmentCurrentStartTimeText } from './appointment/fields.js';
import {
  registrationDateInput,
  registrationLiveTimeValue,
  registrationTimeInput,
} from './registration/fields.js';
import { getJson } from '../services/ons-api/http.js';

// Het tijdvak dat NU op het afspraakformulier staat.
export function huidigAfspraakTijdvak() {
  var d = getDateInput();
  var ruw = d ? String(inputTextValue(d) || '') : '';
  var m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(ruw);
  var ymd = m ? (m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)) : null;
  var start = timeTextToMinutes(appointmentCurrentStartTimeText() || '');
  var e = getEndTimeInput();
  var eind = timeTextToMinutes(e ? String(inputTextValue(e) || '').trim() : '');
  return { ymd: ymd, startMin: start, eindMin: eind };
}
// Idem voor het registratieformulier.
export function huidigRegistratieTijdvak() {
  var d = registrationDateInput();
  var ruw = d ? String(inputTextValue(d) || '') : '';
  var m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(ruw);
  var ymd = m ? (m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)) : null;
  var start = timeTextToMinutes(registrationLiveTimeValue(registrationTimeInput('declaration_start_time_display')));
  var eind = timeTextToMinutes(registrationLiveTimeValue(registrationTimeInput('declaration_end_time_display')));
  return { ymd: ymd, startMin: start, eindMin: eind };
}
/* ===== Overlapcontrole vóór opslaan =====
   ONS meldt een overlap pas als je opslaat, en alleen bij registraties. Dit
   waarschuwt eerder én ook bij het inplannen van een afspraak, zodat je het
   ziet vóórdat je het formulier hebt ingevuld.

   Eén lichte aanroep per week: alleen begin- en eindtijden uit de bestaande
   week-endpoints. Geen details per registratie, geen cliëntgegevens — de
   vergelijking gaat puur over tijd.
   ========================================================================== */
export var _tijdvakCache = Object.create(null);
function _klokMinuten(v) {
  if (!v) return null;
  var m = /T(\d{2}):(\d{2})/.exec(String(v));
  if (m) return (+m[1]) * 60 + (+m[2]);
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
}
// Overlappen twee tijdvakken? Vakken die alleen op elkaar aansluiten
// (10:00-11:00 en 11:00-12:00) tellen niet mee.
export function _tijdvakkenOverlappen(aStart, aEind, bStart, bEind) {
  if (aStart == null || aEind == null || bStart == null || bEind == null) return false;
  if (aEind <= aStart || bEind <= bStart) return false;
  return aStart < bEind && bStart < aEind;
}
// Haalt de tijdvakken van één week op. `laag` is 'afspraken' of 'registraties'.
export function fetchWeekTijdvakken(laag, ymd) {
  var id = resolveInviteeId();
  if (id == null || !ymd) return Promise.resolve([]);
  var key = laag + '|' + id + '|' + ymd;
  var c = _tijdvakCache[key];
  if (c && (Date.now() - c.ts) < 60000) return Promise.resolve(c.rows);
  var url = _apiUrl(laag === 'registraties' ? 'weekRegistrations' : 'weekEvents', { inviteeId: id, date: ymd });
  return getJson(url)
    .then(function (j) {
      var rows = (mapAgendaWeekResponse(j) || []).map(function (e) {
        if (!e) return null;
        var st = _klokMinuten(e.start), et = _klokMinuten(e.end);
        if (e.allDay || st == null || et == null) return null;
        // Bewust GEEN titel: mapAgendaEntry laat die weg omdat hij bij
        // registraties de cliëntnaam bevat. De uursoort is wel neutraal.
        return { id: e.id != null ? String(e.id) : null, ymd: e.date, startMin: st, endMin: et, uursoort: e.hourType || '' };
      }).filter(Boolean);
      _tijdvakCache[key] = { ts: Date.now(), rows: rows };
      return rows;
    })
    .catch(function () { return []; });
}
// Wat er al geladen is voor deze week (synchroon leesbaar).
export function geladenTijdvakken(laag, ymd) {
  var id = resolveInviteeId();
  if (id == null || !ymd) return null;
  var c = _tijdvakCache[laag + '|' + id + '|' + ymd];
  return c ? c.rows : null;
}
// Het eerste tijdvak dat overlapt, of null. Geeft ook null als de weekgegevens
// nog niet geladen zijn: liever zwijgen dan melden op onvolledige gegevens.
export function overlappendTijdvak(laag, ymd, startMin, eindMin, negeerId) {
  var rijen = geladenTijdvakken(laag, ymd);
  if (!rijen || !rijen.length || startMin == null || eindMin == null) return null;
  for (var i = 0; i < rijen.length; i++) {
    var r = rijen[i];
    if (r.ymd !== ymd) continue;
    if (negeerId && String(r.id) === String(negeerId)) continue;
    if (_tijdvakkenOverlappen(startMin, eindMin, r.startMin, r.endMin)) return r;
  }
  return null;
}
function _klokTekst(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
// De melding zoals de medewerker hem ziet.
export function overlapMelding(hit, watStaatEr) {
  if (!hit) return '';
  return 'Let op: op deze dag staat al ' + watStaatEr + ' van ' +
    _klokTekst(hit.startMin) + ' tot ' + _klokTekst(hit.endMin) +
    (hit.uursoort ? ' (' + hit.uursoort + ')' : '') + '.';
}

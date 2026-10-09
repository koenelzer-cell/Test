// Snel registreren: opent het registratieformulier van ONS met datum,
// begintijd en duur al ingevuld. ONS controleert en bewaart zelf; de extensie
// vult niets in en post niets.
//
// Vooraf kijken we of het tijdvak overlapt met een bestaande registratie: we
// vergelijken zelf met de registraties van die week én vragen het ONS
// (detect_overlap). Zegt een van beide 'overlap', dan krijg je eerst een
// waarschuwing.

import { currentInviteeId, currentInviteeIds, newEventUrl, spaNavigate } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { timeTextToMinutes } from '../../core/datetime.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { fetchOnsOverlap } from '../../services/ons-api/open-registrations.js';
import { fetchWeekTijdvakken, overlapMelding, overlappendTijdvak } from '../overlap.js';
import { storePendingAppointment } from '../appointment/prefill.js';
import { storePendingDuplicates } from '../appointment/duplicate.js';

// Planhulp: het afspraakformulier van ONS openen en datum en begintijd laten
// invullen zodra het er staat (features/appointment/prefill.js). De
// afspraakhulp neemt het daar over (die start op /events/new).
export function openNewEvent(req) {
  req = req || {};
  var ymd = String(req.date || ''), hhmm = String(req.time || ''), minutes = parseInt(req.minutes, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) || !(minutes > 0)) return { ok: false, error: 'Ongeldig tijdstip.' };
  var ids = currentInviteeIds();
  if (!ids.length) { var id = currentInviteeId(ymd) || resolveInviteeId(); if (id != null) ids = [String(id)]; }
  if (!ids.length) return { ok: false, error: 'Open eerst je agenda in ONS.' };
  storePendingAppointment({ date: ymd, time: hhmm, minutes: minutes });
  // Meerdere momenten gekozen: de rest krijgt een kopie zodra deze is opgeslagen.
  // Momenten met eigen instellingen krijgen daarna elk een nieuw formulier.
  // Cliënt(en) uit de planhulp (interne id's): komen meteen in het formulier.
  var clientLijst = function (l) { return (Array.isArray(l) ? l : []).map(String).filter(function (c) { return /^\d+$/.test(c); }).slice(0, 10); };
  var lees = function (lijst) {
    return (Array.isArray(lijst) ? lijst : []).map(function (m) {
      var t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String((m && m.time) || ''));
      if (!(t && /^\d{4}-\d{2}-\d{2}$/.test(String(m.date || '')))) return null;
      var uit = { date: String(m.date), startMin: +t[1] * 60 + +t[2] };
      // Eigen duur (meerdere afspraken plannen): eindtijd vooraf ingevuld.
      var mm = parseInt(m.minutes, 10);
      if (mm > 0 && mm <= 24 * 60) uit.minutes = mm;
      var cl = clientLijst(m.clientIds);
      if (cl.length) uit.clientIds = cl;
      return uit;
    }).filter(Boolean);
  };
  // Kopieën uit (beheer): alleen dit ene formulier.
  var f = APP_CONFIG.features || {};
  var kopieen = f.plannerCopies !== false;
  // Meerdere afspraken plannen: elk een eigen formulier (eigen schakelaar).
  var eigenOk = req.multi ? (f.plannerMulti !== false && f.plannerDistance !== false) : kopieen;
  storePendingDuplicates(kopieen && !req.multi ? lees(req.extra) : [], eigenOk ? lees(req.eigen) : []);
  spaNavigate(location.origin + newEventUrl(ids, clientLijst(req.clientIds), ymd));
  return { ok: true };
}
export function quickRegisterUrl(inviteeId, ymd, hhmm, minutes) {
  return _apiUrl('newRegistration', { inviteeId: inviteeId, date: ymd, startTime: hhmm, durationSec: minutes * 60 });
}

// -> Promise<string|null>: de overlapmelding, of null als er niets overlapt.
function overlapCheck(ymd, startMin, endMin) {
  return fetchOnsOverlap(ymd, startMin, endMin, '').then(function (ons) {
    // De eigen vergelijking levert ook de tijden voor de melding.
    return fetchWeekTijdvakken('registraties', ymd).then(function () {
      var hit = overlappendTijdvak('registraties', ymd, startMin, endMin, null);
      if (hit) return overlapMelding(hit, 'een registratie');
      if (ons === true) return 'Let op: ONS meldt dat dit tijdvak overlapt met een bestaande registratie.';
      return null;
    });
  });
}

// { date: 'YYYY-MM-DD', time: 'HH:MM', minutes, force } -> { ok, overlap?, error? }
export function quickRegister(req) {
  req = req || {};
  var ymd = String(req.date || '');
  var hhmm = String(req.time || '').trim();
  var minutes = parseInt(req.minutes, 10);
  var startMin = timeTextToMinutes(hhmm);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return Promise.resolve({ ok: false, error: 'Kies een datum.' });
  if (startMin == null || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(hhmm)) return Promise.resolve({ ok: false, error: 'Vul een begintijd in (uu:mm).' });
  if (!(minutes > 0) || minutes > 24 * 60) return Promise.resolve({ ok: false, error: 'Vul een duur in minuten in.' });
  if (startMin + minutes > 24 * 60) return Promise.resolve({ ok: false, error: 'De registratie loopt over middernacht.' });
  var id = currentInviteeId(ymd) || resolveInviteeId();
  if (id == null) return Promise.resolve({ ok: false, error: 'Open eerst je agenda in ONS.' });
  hhmm = ('0' + Math.floor(startMin / 60)).slice(-2) + ':' + ('0' + (startMin % 60)).slice(-2);
  var go = function () { spaNavigate(location.origin + quickRegisterUrl(id, ymd, hhmm, minutes)); return { ok: true }; };
  if (req.force) return Promise.resolve(go());
  return overlapCheck(ymd, startMin, startMin + minutes).then(function (msg) {
    return msg ? { ok: false, overlap: msg } : go();
  });
}

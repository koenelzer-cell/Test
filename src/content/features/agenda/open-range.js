// Open registraties in een zelfgekozen periode: haalt de week-afspraken van
// alle weken tussen 'van' en 'tot' op en telt per dag wat er nog niet
// geregistreerd is. Dezelfde regel als het weekoverzicht
// (domain/open-registrations.js), maar over meerdere weken.

import { currentInviteeId } from './navigation.js';
import { editableWindowStart } from './edit-window.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { summarizeOpenRange } from '../../domain/open-registrations.js';
import { fetchEntriesForRange } from '../../services/ons-api/open-registrations.js';

function lateHours() {
  var g = APP_CONFIG.generalSettings;
  return (g && g.lateThresholdHours > 0) ? g.lateThresholdHours : 24;
}

// Standaard 'van': de oudste dag die ONS nog laat aanpassen. Alles daarvóór is
// vergrendeld; daar valt niets meer te registreren. Zonder die datum: vier
// weken terug.
export function defaultRangeFrom() {
  var w = editableWindowStart();
  if (w) return agendaYmd(w);
  var d = new Date(); d.setDate(d.getDate() - 28);
  return agendaYmd(d);
}

export function checkOpenRange(fromYmd, toYmd, onProgress) {
  var id = currentInviteeId(null) || resolveInviteeId();
  if (id == null) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  if (!fromYmd || !toYmd) return Promise.reject(new Error('Kies een begin- en einddatum.'));
  if (fromYmd > toYmd) return Promise.reject(new Error('De begindatum ligt na de einddatum.'));
  return fetchEntriesForRange(id, fromYmd, toYmd, onProgress).then(function (entries) {
    var r = summarizeOpenRange(entries, { from: fromYmd, to: toYmd, lateHours: lateHours() });
    r.from = fromYmd; r.to = toYmd;
    return r;
  });
}

// Startscherm van het zijpaneel, Detail: de afspraken van de bekeken week per
// dag (zie domain/week-dagen.js voor wat er wel en niet in staat). Uit het
// weekgeheugen (week-cache.js), dus meestal zonder nieuw verzoek; vers: opnieuw
// ophalen (het zijpaneel vraagt dat als het weekoverzicht veranderde).

import { haalWeek } from '../../services/ons-api/week-cache.js';
import { weekDagen } from '../../domain/week-dagen.js';
import { agendaPage } from './state.js';
import { currentInviteeId } from './navigation.js';
import { currentAgendaDate, resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';

export function weekDagenVoor(date, vers) {
  const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
  if (!id) return Promise.reject(new Error('Geen agenda gevonden.'));
  const d = agendaYmd(date) || currentAgendaDate();
  return haalWeek('weekEvents', id, d, { vers: !!vers }).then(function (entries) {
    return weekDagen(entries, { datum: d });
  });
}

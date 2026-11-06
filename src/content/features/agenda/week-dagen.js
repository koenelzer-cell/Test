// Planhulp, Weekplanning met Detail: alles wat in de bekeken week tijd bezet
// houdt, per dag (zie domain/week-dagen.js voor wat er wel en niet in staat).
// Dezelfde lagen als de vrije tijd (free-slots.js): afspraken, afwezigheid,
// Outlook en geplande bezoeken. Uit het weekgeheugen (week-cache.js), dus
// meestal zonder nieuw verzoek; vers: opnieuw ophalen. Een laag die ONS hier
// niet heeft (of die mislukt), behalve de afspraken zelf: dan zonder.

import { haalWeek } from '../../services/ons-api/week-cache.js';
import { weekDagen } from '../../domain/week-dagen.js';
import { agendaPage } from './state.js';
import { currentInviteeId } from './navigation.js';
import { currentAgendaDate, resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';

const LAGEN = [['weekEvents', 'events'], ['weekUnavailabilities', 'unavailabilities'], ['weekOutlook', 'outlook_appointments'], ['weekPlannedVisits', 'planned_visits']];

export function weekDagenVoor(date, vers) {
  const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
  if (!id) return Promise.reject(new Error('Geen agenda gevonden.'));
  const d = agendaYmd(date) || currentAgendaDate();
  return Promise.all(LAGEN.map(function (l, i) {
    const p = haalWeek(l[0], id, d, { vers: !!vers }).then(function (lijst) {
      return lijst.map(function (e) { e.layer = l[1]; return e; });
    });
    return i === 0 ? p : p.catch(function () { return []; });
  })).then(function (lagen) {
    return weekDagen([].concat.apply([], lagen), { datum: d });
  });
}

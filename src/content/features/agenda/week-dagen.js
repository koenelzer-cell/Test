// Planhulp, Weekplanning met Detail: alles wat in de bekeken week tijd bezet
// houdt, per dag (zie domain/week-dagen.js voor wat er wel en niet in staat).
// Dezelfde lagen als de vrije tijd (free-slots.js): afspraken, afwezigheid,
// Outlook en geplande bezoeken. Uit het weekgeheugen (week-cache.js), dus
// meestal zonder nieuw verzoek; vers: opnieuw ophalen. Afspraken en
// afwezigheid altijd vers, met bij die zonder cliënt de titel (die komt niet in
// het weekgeheugen). Een laag die ONS hier niet heeft (of die mislukt),
// behalve de afspraken zelf: dan zonder.

import { haalWeek, haalWeekMetTitels } from '../../services/ons-api/week-cache.js';
import { weekDagen } from '../../domain/week-dagen.js';
import { agendaPage } from './state.js';
import { currentInviteeId } from './navigation.js';
import { currentAgendaDate, resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';

// [endpoint, laag, met titel (zonder cliënt; vers, niet uit het geheugen)]
const LAGEN = [['weekEvents', 'events', true], ['weekUnavailabilities', 'unavailabilities', true], ['weekOutlook', 'outlook_appointments', false], ['weekPlannedVisits', 'planned_visits', false]];

export function weekDagenVoor(date, vers) {
  const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
  if (!id) return Promise.reject(new Error('Geen agenda gevonden.'));
  const d = agendaYmd(date) || currentAgendaDate();
  return Promise.all(LAGEN.map(function (l, i) {
    const p = (l[2] ? haalWeekMetTitels(l[0], id, d) : haalWeek(l[0], id, d, { vers: !!vers })).then(function (lijst) {
      return lijst.map(function (e) { e.layer = l[1]; return e; });
    });
    return i === 0 ? p : p.catch(function () { return []; });
  })).then(function (lagen) {
    return weekDagen([].concat.apply([], lagen), { datum: d });
  });
}

// ONS-endpoints als sjablonen. Alleen relatieve same-origin paden: de extensie
// praat nooit met andere servers.

import { APP_CONFIG } from '../../config/app-config.js';

// API-endpoint-sjablonen (instelbaar in het beheerscherm via config.apiEndpoints).
// ALLEEN relatieve, same-origin paden zijn toegestaan (moeten met '/' beginnen) — zo
// blijft de garantie 'geen externe calls' overeind. {var}-plaatshouders worden veilig
// ingevuld (encodeURIComponent).
//
// Wie gebruikt wat:
//   weekEvents, weekRegistrations     agenda-overzicht, overlapcontrole   (calendar.js, overlap)
//   registrationDetails               declarabiliteit per week             (calendar.js)
//   employeeRegistrations             declarabiliteit, terugval            (calendar.js)
//   eventDetails                      afspraaklabel bij registreren        (event-details.js)
//   calendarVariables                 medewerker-id                        (employee.js)
//   searchClients                     interne cliënt-id                    (clients.js)
//   productList                       uursoorten bij een afspraak          (products.js)
//   unavailabilities                  verlof vastleggen (POST)             (unavailability.js)
//   detectOverlap                     overlapcontrole door ONS zelf        (open-registrations.js)
//   newRegistration                   registratieformulier, vooraf ingevuld (paginaroute, geen API)
const _API_DEFAULTS = {
  weekEvents: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=events',
  weekRegistrations: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=registrations&sub_layers[]=registrations/created',
  registrationDetails: '/calendar/invitee/{inviteeId}/registrations/{occurrenceId}/details',
  eventDetails: '/calendar/invitee/{inviteeId}/events/{occurrenceId}/details',
  searchClients: '/search_panel/clients?term={term}&usage=event&out_of_care={outOfCare}&page=1',
  productList: '/product_selection/product_list?date={date}&employee_ids[]={employeeId}&client_ids[]={clientId}',
  calendarVariables: '/calendar/calendar_variables?date={date}',
  unavailabilities: '/calendar/unavailabilities',
  employeeRegistrations: '/gateway/api/v0/agenda/user/widgets/employee_registrations_overview/registrations'
    + '?date={date}&open=false&includeUnregistered=false&withoutClient=false&offset={offset}&limit={limit}',
  detectOverlap: '/worksheet/registrations/detect_overlap?date={date}&start_time={startTime}&end_time={endTime}&hour_type_id={hourTypeId}',
  // duration in SECONDEN (900 = 15 minuten), start_time als HH:MM.
  newRegistration: '/invitees/{inviteeId}/registrations/new?declaration%5Bstart_date%5D={date}'
    + '&declaration%5Bstart_time%5D={startTime}&declaration%5Bduration%5D={durationSec}&redirect_to_calendar=true',
};
function _apiTemplate(name) {
  try {
    var eps = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.apiEndpoints) || {};
    var t = eps[name];
    if (typeof t === 'string' && t.charAt(0) === '/') return t; // same-origin, relatief pad
  } catch (e) {}
  return _API_DEFAULTS[name];
}
export function _apiUrl(name, vars) {
  vars = vars || {};
  return _apiTemplate(name).replace(/\{(\w+)\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(vars, k) ? encodeURIComponent(vars[k]) : m;
  });
}

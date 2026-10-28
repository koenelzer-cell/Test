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
//   searchEmployees                   collega zoeken bij Afspraak maken      (client-lookup.js)
//   locationsTree                     locatie kiezen bij Afspraak maken      (event-create.js)
//   productList                       uursoorten bij een afspraak          (products.js)
//   unavailabilities                  verlof vastleggen (POST)             (unavailability.js)
//   detectOverlap                     overlapcontrole door ONS zelf        (open-registrations.js)
//   weekUnavailabilities              afwezigheid, voor de planhulp         (free-slots.js)
//   weekOutlook, weekPlannedVisits    Outlook-afspraken en geplande bezoeken (free-slots.js)
//   availableLabels / createEvent / productOptions  afspraak maken vanuit de planhulp (event-create.js)
//   employeeProductOptions            uursoorten zonder cliënt (niet cliëntgebonden afspraak)
//   holidays                          feestdagen: geen vrije tijd in de planhulp (free-slots.js)
//   weekReservations                  reserveringen: tijd vastgehouden voor een soort werk (free-slots.js)
//   newEvent                          nieuw afspraakformulier (planhulp)     (paginaroute, geen API)
//   newRegistration                   registratieformulier, vooraf ingevuld (paginaroute, geen API)
const _API_DEFAULTS = {
  weekEvents: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=events',
  weekUnavailabilities: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=unavailabilities',
  weekOutlook: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=outlook_appointments',
  weekPlannedVisits: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=planned_visits',
  weekReservations: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=reservations',
  weekRegistrations: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=registrations&sub_layers[]=registrations/created',
  registrationDetails: '/calendar/invitee/{inviteeId}/registrations/{occurrenceId}/details',
  eventDetails: '/calendar/invitee/{inviteeId}/events/{occurrenceId}/details',
  searchClients: '/search_panel/clients?term={term}&usage=event&out_of_care={outOfCare}&page=1',
  searchEmployees: '/search_panel/employees?term={term}&usage=event&page=1',
  locationsTree: '/search_panel/locations/tree',
  holidays: '/calendar/holidays',
  availableLabels: '/calendar/events/available_labels',
  createEvent: '/calendar/events',
  productOptions: '/product_selection/product_list?employee_ids%5B%5D={employeeId}&client_ids%5B%5D={clientId}',
  employeeProductOptions: '/product_selection/product_list?employee_ids%5B%5D={employeeId}',
  productList: '/product_selection/product_list?date={date}&employee_ids[]={employeeId}&client_ids[]={clientId}',
  calendarVariables: '/calendar/calendar_variables?date={date}',
  unavailabilities: '/calendar/unavailabilities',
  employeeRegistrations: '/gateway/api/v0/agenda/user/widgets/employee_registrations_overview/registrations'
    + '?date={date}&open=false&includeUnregistered=false&withoutClient=false&offset={offset}&limit={limit}',
  detectOverlap: '/worksheet/registrations/detect_overlap?date={date}&start_time={startTime}&end_time={endTime}&hour_type_id={hourTypeId}',
  // duration in SECONDEN (900 = 15 minuten), start_time als HH:MM.
  // Nieuw afspraakformulier, zoals ONS het zelf opent. Datum en begintijd
  // vult de hulp daarna in het formulier in (features/appointment/prefill.js).
  // Meer invitees: {inviteeId} wordt herhaald (zie newEventUrl).
  newEvent: '/events/new?invitee_ids%5B%5D={inviteeId}&redirect_to_calendar=true',
  newRegistration: '/invitees/{inviteeId}/registrations/new?declaration%5Bstart_date%5D={date}'
    + '&declaration%5Bstart_time%5D={startTime}&declaration%5Bduration%5D={durationSec}&redirect_to_calendar=true',
};
function _apiTemplate(name) {
  try {
    const eps = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.apiEndpoints) || {};
    const t = eps[name];
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

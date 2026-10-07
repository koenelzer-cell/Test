// Onbeschikbaarheid (zoals verlof) in de ONS-agenda vastleggen, precies zoals
// ONS het zelf verstuurt bij 'Onbeschikbaarheid toevoegen':
//   POST /calendar/unavailabilities
//   { unavailability: { employee_id, description, valid_from, start_time, end_time,
//                       [recurrence_type, cycle_interval, valid_to, monday … sunday] } }
// De velden zelf stelt domain/leave.js samen.

import { _apiUrl } from './endpoints.js';
import { postJson } from './http.js';

export async function createUnavailability(employeeId, unavailability) {
  await postJson(_apiUrl('unavailabilities'), {
    unavailability: Object.assign({ employee_id: Number(employeeId) }, unavailability),
  });
}

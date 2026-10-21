// Welke medewerker gebruikt de hulp? Nodig voor de product-API (uursoorten).
//
// Vier bronnen, in deze volgorde; de eerste die iets oplevert wint:
//   1. de URL (/invitees/{id}/… of employee_id[]=…)
//   2. een veld in de pagina (employee_id, agenda_owner_id, …)
//   3. de ONS-API /calendar/calendar_variables (invitee van type 'employee')
//   4. onsContext() van de pagina, via de main-world

import { agendaYmd } from '../../core/datetime.js';
import { vraagMainWorld } from '../../core/page-bridge.js';
import { PAGE_COMMAND } from '../../../shared/messages.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';

export async function getEmployeeIdAsync() {
  return employeeIdFromUrl()
    || employeeIdFromDom()
    || (await employeeIdFromCalendarVariables())
    || (await employeeIdFromPage());
}

function employeeIdFromUrl() {
  const href = String(location.href || '');
  const m = href.match(/\/invitees\/(\d+)/i) ||
            href.match(/(?:employee_id|invitee_id)[s]?(?:%5B%5D|\[\])=(\d+)/i);
  return m ? m[1] : null;
}

function employeeIdFromDom() {
  const input = document.querySelector('input[name*="employee_id"], [data-employee-id], input[name="agenda_owner_id"], input[name*="invitee_id"]');
  return (input && (input.value || input.getAttribute('data-employee-id'))) || null;
}

async function employeeIdFromCalendarVariables() {
  try {
    const json = await getJson(_apiUrl('calendarVariables', { date: agendaYmd(new Date()) }));
    const employee = json && Array.isArray(json.invitees)
      ? json.invitees.find((i) => i.type === 'employee' && i.id != null)
      : null;
    return employee ? String(employee.id) : null;
  } catch (e) {
    return null;
  }
}

// Laatste redmiddel: onsContext() van de pagina zelf, die alleen de main-world
// kan aanroepen. Komt er geen antwoord (geen main-world, of onsContext bestaat
// niet), dan na een korte wachttijd null: het ophalen van de uursoorten mag
// daar niet op blijven hangen.
const PAGE_TIMEOUT_MS = 1500;
async function employeeIdFromPage() {
  const d = await vraagMainWorld(PAGE_COMMAND.READ_USER, PAGE_COMMAND.USER_READ, {}, PAGE_TIMEOUT_MS);
  return d && d.ok === true && /^\d{1,12}$/.test(String(d.userId)) ? String(d.userId) : null;
}

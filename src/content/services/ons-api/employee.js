// Welke medewerker gebruikt de hulp? Nodig voor de product-API (uursoorten).
//
// Vier bronnen, in deze volgorde; de eerste die iets oplevert wint:
//   1. de URL (/invitees/{id}/… of employee_id[]=…)
//   2. een veld in de pagina (employee_id, agenda_owner_id, …)
//   3. de ONS-API /calendar/calendar_variables (invitee van type 'employee')
//   4. een klein script in de pagina-context (zie employeeIdFromPageScript)

import { agendaYmd } from '../../core/datetime.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';

export async function getEmployeeIdAsync() {
  return employeeIdFromUrl()
    || employeeIdFromDom()
    || (await employeeIdFromCalendarVariables())
    || (await employeeIdFromPageScript());
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

// Laatste redmiddel: een inline-script in de pagina-context vraagt een globale
// onsContext() van de pagina om een userId. Blokkeert de pagina inline-scripts
// (CSP), dan komt er nooit antwoord; daarom geeft dit na
// PAGE_SCRIPT_TIMEOUT_MS null terug. Zonder die grens bleef het ophalen van de
// uursoorten eeuwig hangen en kwam de DOM-terugval nooit aan bod.
const PAGE_SCRIPT_TIMEOUT_MS = 1500;
function employeeIdFromPageScript() {
  return new Promise((resolve) => {
    const eventId = 'ons_data_' + Math.random().toString(36).slice(2, 11);
    const script = document.createElement('script');
    script.textContent = `
      try {
        let empId = null;
        if (typeof onsContext === "function") {
          let ctx = onsContext();
          if (ctx && ctx.userId) empId = ctx.userId;
        }
        window.dispatchEvent(new CustomEvent("${eventId}", { detail: { empId: empId } }));
      } catch(e) {
        window.dispatchEvent(new CustomEvent("${eventId}", { detail: {} }));
      }
    `;
    let settled = false;
    const finish = (id) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener(eventId, listener);
      script.remove();
      resolve(id);
    };
    const listener = (e) => finish(e.detail && e.detail.empId ? String(e.detail.empId) : null);
    const timer = setTimeout(() => finish(null), PAGE_SCRIPT_TIMEOUT_MS);
    window.addEventListener(eventId, listener);
    document.documentElement.appendChild(script);
  });
}

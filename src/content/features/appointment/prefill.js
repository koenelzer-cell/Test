// Afspraakformulier vooraf invullen vanuit de planhulp in het zijpaneel.
//
// ONS opent een nieuwe afspraak op /events/new?invitee_ids[]=… en kent (voor
// zover bekend) geen URL-parameters voor datum en tijd. Daarom zet de planhulp
// datum en begintijd klaar in de sessie van dit tabblad; zodra het formulier
// er staat, typt de hulp ze in de velden, net zoals hij de eindtijd schrijft.
// De duur kiest de medewerker daarna in de afspraakhulp.

import { getDateInput, getStartTimeInput } from '../../ons/appointment-form.js';
import { inputTextValue, typeIntoSearchField } from '../../ons/form-controls.js';
import { PAGE_SESSION } from '../../../shared/storage-keys.js';

const KEY = PAGE_SESSION.PENDING_APPOINTMENT;
const GELDIG_MS = 2 * 60 * 1000;   // een klaargezet tijdstip geldt twee minuten

export function storePendingAppointment(req) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ date: req.date, time: req.time, ts: Date.now() })); } catch (e) {}
}
function readPending() {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!p || !p.date || !p.time || (Date.now() - p.ts) > GELDIG_MS) return null;
    return p;
  } catch (e) { return null; }
}
function clearPending() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

// 'YYYY-MM-DD' -> 'dd-mm-jjjj' (zoals het datumveld van ONS hem toont).
export function onsDateText(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? (m[3] + '-' + m[2] + '-' + m[1]) : '';
}

function schrijf(inp, text) {
  typeIntoSearchField(inp, text);
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })); // eventuele kalender dicht
  inp.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  try { inp.blur && inp.blur(); } catch (e) {}
  const root = inp.getRootNode && inp.getRootNode();
  const host = root && root.host;
  if (host) {
    try { host.value = text; } catch (e) {}
    try { host.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
}

let _bezig = false;
// Aanroepen zodra de afspraakhulp op /events/new start. Wacht tot het
// formulier er staat (hooguit ~12 s) en vult dan datum en begintijd in.
export function applyPendingAppointment() {
  if (_bezig) return;
  const p = readPending();
  if (!p) return;
  _bezig = true;
  const datum = onsDateText(p.date);
  let pogingen = 0;
  const tik = () => {
    pogingen++;
    const d = getDateInput(), s = getStartTimeInput();
    if (d && s) {
      if (datum && inputTextValue(d) !== datum) schrijf(d, datum);
      // De begintijd pas na de datum: ONS kan bij een datumwissel de tijden herberekenen.
      setTimeout(() => {
        const s2 = getStartTimeInput();
        if (s2 && inputTextValue(s2) !== p.time) schrijf(s2, p.time);
        clearPending();
        _bezig = false;
      }, 250);
      return;
    }
    if (pogingen < 48) setTimeout(tik, 250);
    else { clearPending(); _bezig = false; }
  };
  setTimeout(tik, 300);
}

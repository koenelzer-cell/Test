// Open registraties in het zijpaneel: een afspraak meteen registreren.
//
// Precies wat je zelf in ONS zou doen: naar de dag van de afspraak, de
// afspraak openen en op Registreren klikken. Zo loopt het verder door de
// gewone flow van ONS (en de registratiehulp); we bouwen geen tweede weg naar
// het registratiescherm. De afspraak vinden we aan zijn id in de agenda
// (data-id, hetzelfde id als in de week-API).

import { ONS } from '../../ons/selectors.js';
import { jumpToDay } from './navigation.js';
import { openOccurrence } from './occurrences.js';

const REGISTREER_KNOP = '[data-qa="occurrence-popover-primary"], [data-qa="declare_button"], #declare-option-link';

function vindAfspraak(id, date) {
  try {
    const kandidaten = document.querySelectorAll(ONS.occurrenceBase + '[data-id="' + id + '"]');
    for (const occ of kandidaten) if (!date || occ.getAttribute('data-date') === date) return occ;
  } catch (e) {}
  return null;
}
function vindKnop() {
  try {
    const pop = document.querySelector(ONS.popoverRoot);
    return (pop && pop.querySelector(REGISTREER_KNOP)) || document.querySelector(REGISTREER_KNOP);
  } catch (e) { return null; }
}
// Wacht tot vind() iets geeft (of tot de tijd om is).
export function wachtOp(vind, ms, stap) {
  return new Promise(function (klaar) {
    const tot = Date.now() + ms;
    (function kijk() {
      const r = vind();
      if (r || Date.now() >= tot) { klaar(r || null); return; }
      setTimeout(kijk, stap || 150);
    })();
  });
}

// id: id van de afspraak; date: 'YYYY-MM-DD'. -> Promise<{ ok, error? }>
export function registerOpenItem(id, date, opts) {
  opts = opts || {};
  id = String(id || '');
  if (!/^[\w-]+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return Promise.resolve({ ok: false, error: 'Deze afspraak is niet te openen.' });
  let occ = vindAfspraak(id, date);
  const naarDag = occ ? Promise.resolve(occ) : (function () {
    jumpToDay(date, true);
    return wachtOp(function () { return vindAfspraak(id, date); }, opts.wachtDag || 8000);
  })();
  return naarDag.then(function (o) {
    if (!o) return { ok: false, error: 'De afspraak staat niet (meer) in de agenda. Ververs de lijst en probeer het opnieuw.' };
    openOccurrence(o);
    return wachtOp(vindKnop, opts.wachtKnop || 3000).then(function (knop) {
      if (!knop) return { ok: false, error: 'De afspraak is geopend, maar de knop Registreren is niet gevonden. Registreer hem in ONS.' };
      knop.click();
      return { ok: true };
    });
  });
}

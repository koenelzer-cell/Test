// Open registraties in het zijpaneel: een afspraak meteen registreren.
//
// Eerst rechtstreeks: de details van de afspraak (dezelfde call die ONS doet
// als je de afspraak opent) geven in meta.declareUrl ONS' eigen link naar het
// registratieformulier, bijvoorbeeld
//   /registrations/07eaa0c43ea6c/edit?redirect_to_calendar=true
// Daar gaan we meteen heen; na opslaan stuurt ONS je terug naar de agenda.
// We maken die link niet zelf: alleen wat ONS aanbiedt, en alleen een
// relatief pad op dezelfde site.
//
// Lukt dat niet (geen occurrence-id, details niet op te halen of geen
// declareUrl), dan zoals je het zelf zou doen: naar de dag, de afspraak
// openen en op Registreren klikken. De afspraak vinden we dan aan zijn id in
// de agenda (data-id, hetzelfde id als in de week-API).

import { ONS } from '../../ons/selectors.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { jumpToDay, spaNavigate } from './navigation.js';
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

// meta.declareUrl uit een details-respons ({event:{meta:{declareUrl}}}), mits
// een relatief pad op dezelfde site. Anders null.
export function declareUrlUitDetails(json) {
  const body = json && typeof json === 'object' ? (json.event || json.data || json) : null;
  const url = body && body.meta && body.meta.declareUrl;
  if (typeof url !== 'string' || !/^\/(?![\/\\])/.test(url)) return null;
  return url;
}
function haalDeclareUrl(occurrenceId, opts) {
  const occ = String(occurrenceId || '');
  if (!/^[\w-]+$/.test(occ)) return Promise.resolve(null);
  const inv = /^\d+$/.test(String(opts.inviteeId || '')) ? String(opts.inviteeId) : resolveInviteeId();
  if (inv == null) return Promise.resolve(null);
  const haal = opts.haal || getJson;
  return Promise.resolve()
    .then(function () { return haal(_apiUrl('eventDetails', { inviteeId: inv, occurrenceId: occ })); })
    .then(declareUrlUitDetails, function () { return null; });
}

// id: id van de afspraak; date: 'YYYY-MM-DD'.
// opts: { occurrenceId, inviteeId } voor de rechtstreekse weg. -> Promise<{ ok, direct?, error? }>
export function registerOpenItem(id, date, opts) {
  opts = opts || {};
  id = String(id || '');
  if (!/^[\w-]+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return Promise.resolve({ ok: false, error: 'Deze afspraak is niet te openen.' });
  return haalDeclareUrl(opts.occurrenceId, opts).then(function (url) {
    if (!url) return viaAgenda(id, date, opts);
    // Pas na het antwoord aan het zijpaneel weg van deze pagina.
    const naar = opts.navigeer || function (u) { setTimeout(function () { spaNavigate(location.origin + u); }, 0); };
    naar(url);
    return { ok: true, direct: true };
  });
}
// Terugval: naar de dag, de afspraak openen en op Registreren klikken.
function viaAgenda(id, date, opts) {
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

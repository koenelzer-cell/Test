// Afspraakformulier vooraf invullen vanuit de planhulp in het zijpaneel.
//
// ONS opent een nieuwe afspraak op /events/new?invitee_ids[]=… en kent (voor
// zover bekend) geen URL-parameters voor datum en tijd. Daarom zet de planhulp
// datum en begintijd klaar in de sessie van dit tabblad; zodra het formulier
// er staat, typt de hulp ze in de velden, net zoals hij de eindtijd schrijft.
// De duur kiest de medewerker daarna in de afspraakhulp.
//
// Sneller en zonder typen: ONS bouwt het formulier op uit een leeg
// afspraakmodel (GET /calendar/events/new). De main-world vult dat model aan
// met wat hier klaarstaat (model: datum, begin- en eindtijd, afspraaktype),
// voordat ONS het formulier tekent. Het typen hieronder blijft de terugval:
// het slaat velden over die al goed staan.

import { findNonClientUursoortTrigger, getDateInput, getStartTimeInput } from '../../ons/appointment-form.js';
import { deepQueryAll } from '../../ons/dom.js';
import { wachtTot } from '../../core/wacht.js';
import { inputTextValue, typeIntoSearchField } from '../../ons/form-controls.js';
import { PAGE_SESSION } from '../../../shared/storage-keys.js';
import { setAppointmentEndTimePlusMinutes } from './end-time.js';
import { isoLocalWithOffset } from '../../domain/open-registrations.js';
import { zetUursoortViaFormulier, zetUursoortVoorClient } from '../../ons/form-model.js';

const KEY = PAGE_SESSION.PENDING_APPOINTMENT;
const GELDIG_MS = 2 * 60 * 1000;   // een klaargezet tijdstip geldt twee minuten

// minutes (optioneel): de duur uit de planhulp. Dan vult de hulp ook de
// eindtijd in en slaat de afspraakhulp de duurvraag over. Zonder minutes
// (een apart afspraakformulier) vraagt de afspraakhulp de duur zoals altijd.
// label (optioneel): { id, name } van het afspraaktype uit de planhulp.
export function storePendingAppointment(req) {
  const minutes = parseInt(req.minutes, 10);
  const klaar = { date: req.date, time: req.time, minutes: minutes > 0 ? minutes : null, ts: Date.now() };
  const model = modelVelden(req, minutes);
  if (model) klaar.model = model;
  // Gekozen uursoorten (alleen id's en de naam van de uursoort).
  if (Array.isArray(req.uursoorten) && req.uursoorten.length) klaar.uursoorten = req.uursoorten;
  if (req.uursoortAfspraak) klaar.uursoortAfspraak = req.uursoortAfspraak;
  try { sessionStorage.setItem(KEY, JSON.stringify(klaar)); } catch (e) {}
}
// Velden voor het lege afspraakmodel van ONS, in de vorm van ONS zelf:
// valid_from 'YYYY-MM-DD', tijden als '2026-10-20T10:00:00+02:00', labels
// [{ id, name }]. Alleen id's, tijden en de naam van het afspraaktype.
export function modelVelden(req, minutes) {
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String((req && req.time) || ''));
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(req.date || ''))) return null;
  const start = +t[1] * 60 + +t[2];
  const m = { valid_from: req.date, start_time: isoLocalWithOffset(req.date, start) };
  if (minutes > 0 && start + minutes < 24 * 60) m.end_time = isoLocalWithOffset(req.date, start + minutes);
  const l = req.label;
  const naam = String((l && l.name) || '').trim();
  if (l && Number(l.id) > 0 && naam) m.labels = [{ id: Number(l.id), name: naam.slice(0, 100) }];
  return m;
}

// Duur die de planhulp voor het open afspraakformulier heeft gekozen, of null.
let _geplandeDuur = null;
export function plannedAppointmentMinutes() {
  if (!_geplandeDuur) return null;
  if (!/\/events\/new(?:[/?#]|$)/.test(location.pathname + location.search)) { _geplandeDuur = null; return null; }
  return _geplandeDuur;
}
export function clearPlannedAppointmentMinutes() { _geplandeDuur = null; }
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
// klaar (optioneel): krijgt { velden, uursoorten } (true = gelukt) als datum,
// tijden en uursoorten zijn ingevuld of de hulp het opgeeft.
// -> het klaargezette moment (of null als er niets klaarstond).
export function applyPendingAppointment(klaar) {
  if (_bezig) return null;
  const p = readPending();
  if (!p) return null;
  _bezig = true;
  _geplandeDuur = p.minutes > 0 ? p.minutes : null;
  const uursoorten = vulUursoorten(Array.isArray(p.uursoorten) ? p.uursoorten : [], p.uursoortAfspraak || null);
  const velden = vulDatumEnTijd(p).then((ok) => { clearPending(); _bezig = false; return ok; });
  if (klaar) Promise.all([velden, uursoorten]).then((r) => klaar({ velden: r[0], uursoorten: r[1] }));
  return p;
}
// Datum, begintijd en (met een duur) de eindtijd. Velden die al goed staan
// (bijv. uit het lege afspraakmodel) worden niet opnieuw getypt. Elke stap
// wacht tot de vorige zichtbaar is: ONS kan bij een datumwissel de tijden
// herberekenen. -> Promise<boolean>
function vulDatumEnTijd(p) {
  const datum = onsDateText(p.date);
  const toont = (veld, tekst) => { const inp = veld(); return !!inp && inputTextValue(inp) === tekst; };
  return wachtTot(() => getDateInput() && getStartTimeInput(), { max: 12000 }).then((klaarVoor) => {
    if (!klaarVoor) return false;
    if (datum && !toont(getDateInput, datum)) schrijf(getDateInput(), datum);
    return wachtTot(() => !datum || toont(getDateInput, datum), { max: 1500 }).then(() => {
      const s = getStartTimeInput();
      if (s && inputTextValue(s) !== p.time) schrijf(s, p.time);
      return wachtTot(() => toont(getStartTimeInput, p.time), { max: 1500 });
    }).then(() => {
      // Eindtijd = begintijd + duur uit de planhulp.
      if (p.minutes > 0) { try { setAppointmentEndTimePlusMinutes(p.minutes); } catch (e) {} }
      return true;
    });
  });
}

// De uursoorten uit de planhulp in het formulier zetten, via de Vue-koppeling
// van het uursoortveld (geen dropdown). De velden verschijnen pas als de
// cliënten in het formulier staan: zo nodig een paar keer opnieuw proberen
// (hooguit ~10 s). Wat niet lukt, vraagt de afspraakhulp zoals altijd.
// -> Promise<boolean>: true als alles is gezet.
function vulUursoorten(perClient, opAfspraak) {
  let rest = perClient.slice();
  let afspraak = opAfspraak && opAfspraak.hourTypeId > 0 ? opAfspraak : null;
  if (!rest.length && !afspraak) return Promise.resolve(true);
  // Zoveel uursoortvelden als er cliënten zijn (of het veld op afspraakniveau).
  const veldenEr = () => afspraak ? !!findNonClientUursoortTrigger() : deepQueryAll('uc-select[data-qa="hour_type_select"]').length >= rest.length;
  const ronde = (n) => wachtTot(veldenEr, { max: 8000 }).then(() => {
    const werk = rest.map((u) => zetUursoortVoorClient(u.clientId, u.hourTypeId, u.name).then((ok) => (ok ? u : null)));
    if (afspraak) {
      const veld = findNonClientUursoortTrigger();
      werk.push(veld ? zetUursoortViaFormulier(veld, afspraak.hourTypeId, afspraak.name).then((ok) => (ok ? 'afspraak' : null)) : Promise.resolve(null));
    }
    return Promise.all(werk);
  }).then((gelukt) => {
    rest = rest.filter((u) => gelukt.indexOf(u) < 0);
    if (gelukt.indexOf('afspraak') >= 0) afspraak = null;
    // Een veld kan net opnieuw zijn opgebouwd: nog één ronde.
    if ((rest.length || afspraak) && n < 2) return ronde(n + 1);
    return !rest.length && !afspraak;
  });
  return ronde(0);
}

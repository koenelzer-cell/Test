// Weekgegevens van ONS (entries/week) per laag, medewerker en week, een paar
// minuten in het geheugen van deze pagina (weg na herladen). Alleen de
// neutrale velden uit mapAgendaEntry.
//
// De planhulp leest eruit. Het weekoverzicht, de verhouding en het
// productieverloop halen altijd vers op, maar zetten hun antwoord er ook in:
// zo haalt de planhulp de week die je in ONS bekijkt niet nog eens op.
//
// Een week wordt altijd op de maandag gevraagd: dezelfde week heeft zo één
// sleutel, wie hem ook vraagt.

import { maandagVan } from '../../../shared/datum.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';
import { weekEntries } from './formaat.js';

const WEEK_TTL = 5 * 60000;
let geheugen = Object.create(null);

// Na het maken of opslaan van afspraken klopt het niet meer.
export function vergeetWeken() { geheugen = Object.create(null); }

// Elke aanvrager een eigen kopie: de planhulp schrijft de laag erbij.
const kopie = (lijst) => lijst.map((e) => Object.assign({}, e));

// sjabloon: endpointnaam (weekEvents, weekOutlook, …); dag: 'YYYY-MM-DD' in die week.
// opties.vers: niet uit het geheugen halen (wel erin zetten).
// opties.wachtrij: een begrenzer (createLimiter) voor het verzoek.
// -> Promise<entries[]>. Mislukt het, dan wordt niets onthouden.
export function haalWeek(sjabloon, inviteeId, dag, opties) {
  const o = opties || {};
  const maandag = maandagVan(dag) || dag;
  const k = sjabloon + '|' + inviteeId + '|' + maandag;
  const nu = Date.now();
  const c = geheugen[k];
  if (!o.vers && c && nu - c.ts < WEEK_TTL) return c.belofte.then(kopie);
  for (const x of Object.keys(geheugen)) if (nu - geheugen[x].ts >= WEEK_TTL) delete geheugen[x];
  const haal = () => getJson(_apiUrl(sjabloon, { inviteeId, date: maandag }));
  const nieuw = { ts: nu, belofte: null };
  nieuw.belofte = (o.wachtrij ? o.wachtrij(haal) : haal()).then(weekEntries);
  nieuw.belofte.catch(() => { if (geheugen[k] === nieuw) delete geheugen[k]; });
  geheugen[k] = nieuw;
  return nieuw.belofte.then(kopie);
}

// De afspraken van één week per dag, voor Detail in de Weekplanning van de
// planhulp (zijpaneel). Alles wat daar tijd bezet houdt, dezelfde regels als
// de vrije tijd (domain/free-slots.js): afspraken (met en zonder label),
// afwezigheid, Outlook (behalve 'vrij' en 'elders aan het werk') en geplande
// bezoeken. Reserveringen niet: die houden tijd vast maar bezetten hem niet.
//
// PRIVACY: per afspraak alleen tijden, reistijd, de soort (direct, indirect of
// niet-cliënttijd), of hij geregistreerd is, en een naam: bij een afspraak het
// label uit ONS, zonder label 'Cliëntafspraak'; alleen als er geen cliënt aan
// zit mag de titel (teamoverleg, scholing), bij afwezigheid ook. Anders de
// soort ('Afwezig', 'Outlook', 'Gepland bezoek'). Nooit de titel van een
// afspraak met een cliënt, nooit het onderwerp van Outlook, geen cliënt, geen
// opmerking.

import { _agEntryLabels, _entryMinutes, computeDirectIndirect } from './agenda-entries.js';
import { classifyAgendaEntry } from './open-registrations.js';
import { maandagVan, plusDagen } from '../../shared/datum.js';

const DAG = 24 * 60;
const LAAG_NAAM = { unavailabilities: 'Afwezig', outlook_appointments: 'Outlook', planned_visits: 'Gepland bezoek' };

// De titel van een afspraak zoals ONS hem stuurt (ruwe rij), maar alleen als
// er geen cliënt aan zit: met een cliënt kan de titel een cliëntnaam bevatten.
// Anders ''.
export function titelZonderClient(rij) {
  if (!rij || typeof rij !== 'object') return '';
  if (Array.isArray(rij.clients) && rij.clients.length) return '';
  return String(rij.name || rij.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// De laag in ONS: uit het ophalen (e.layer), anders uit het soort.
export function laagVan(e) {
  if (e.layer) return e.layer;
  if (e.type === 'unavailability') return 'unavailabilities';
  if (e.type === 'outlook_appointment') return 'outlook_appointments';
  if (e.type === 'planned_visit') return 'planned_visits';
  if (e.type === 'reservation') return 'reservations';
  return 'events';
}

function minutenVanDag(ms, dagStart) {
  const d = new Date(ms);
  if (dagStart != null) return Math.round((ms - dagStart) / 60000);
  return d.getHours() * 60 + d.getMinutes();
}

// Eén afspraak voor één dag, of null als hij niets bezet (reservering,
// feestdag, Outlook 'vrij', geen tijd).
//   -> { startMin, minutes, travelBefore, travelAfter, soort, status, naam, bron, heleDag }
export function weekDagItem(e, opts) {
  opts = opts || {};
  if (!e || !e.date || e.type === 'holiday') return null;
  const laag = laagVan(e);
  if (laag === 'reservations') return null;
  const toon = String(e.showAs || '').toLowerCase();
  if (toon === 'free' || toon === 'workingelsewhere') return null;
  const heleDag = !!e.allDay || (laag === 'unavailabilities' && (e.startMs == null || e.endMs == null));
  let startMin = 0, minuten = DAG;
  if (!heleDag) {
    if (e.startMs == null) return null;
    minuten = Math.round(opts.minuten != null ? opts.minuten : _entryMinutes(e));
    if (!(minuten > 0)) return null;
    startMin = opts.startMin != null ? opts.startMin : minutenVanDag(e.startMs);
  }
  // Een titel alleen zonder cliënt (zie titelZonderClient); Outlook nooit.
  const titel = !e.clientPresent && laag !== 'outlook_appointments' && e.titel ? String(e.titel).slice(0, 80) : '';
  if (laag !== 'events') {
    return { startMin: startMin, minutes: minuten, travelBefore: 0, travelAfter: 0, soort: 'overig', status: '', naam: titel || LAAG_NAAM[laag] || 'Bezet', bron: laag, heleDag: heleDag };
  }
  const di = computeDirectIndirect(e, opts.forms);
  const soort = !e.clientPresent ? 'overig' : (di.indirectMin > di.directMin ? 'indirect' : 'direct');
  // Telt hij mee als registreerbaar (cliënt of uursoort, werkdag)? Dan:
  // voorbij en geregistreerd, voorbij en nog open, of nog gepland.
  const c = heleDag ? null : classifyAgendaEntry(Object.assign({}, e, { type: 'event' }), opts.now != null ? opts.now : Date.now(), 24 * 3600000);
  const status = !c ? '' : (!c.past ? 'gepland' : (c.declared ? 'ok' : 'open'));
  // De naam: het label uit ONS; zonder label 'Cliëntafspraak', of zonder
  // cliënt de titel (anders 'Afspraak'). Met een cliënt nooit de titel.
  const naam = _agEntryLabels(e)[0] || (e.clientPresent ? 'Cliëntafspraak' : (titel || 'Afspraak'));
  return {
    startMin: startMin, minutes: minuten,
    travelBefore: heleDag ? 0 : Math.max(0, Math.round(Number(e.travelBefore) || 0)),
    travelAfter: heleDag ? 0 : Math.max(0, Math.round(Number(e.travelAfter) || 0)),
    soort: soort, status: status, naam: String(naam).slice(0, 60), bron: 'events', heleDag: heleDag
  };
}

// entries (alle lagen van entries/week) -> { maandag, startMin, endMin, days: [{ date, open, items }] }.
// Maandag tot en met vrijdag altijd; zaterdag en zondag alleen met afspraken.
// Afwezigheid over meerdere dagen staat op elke dag die hij raakt.
// startMin/endMin: het venster voor het rooster, op hele uren, minstens 8 tot 17.
export function weekDagen(entries, opts) {
  opts = opts || {};
  const maandag = maandagVan(opts.datum) || opts.datum;
  const dagen = [], perDatum = Object.create(null), gezien = Object.create(null);
  for (let i = 0; i < 7; i++) {
    const d = { date: plusDagen(maandag, i), open: 0, items: [] };
    dagen.push(d); perDatum[d.date] = d;
  }
  const zet = function (dag, it) {
    if (!dag || !it) return;
    dag.items.push(it);
    if (it.status === 'open') dag.open++;
  };
  (Array.isArray(entries) ? entries : []).forEach(function (e) {
    if (!e || !e.date) return;
    if (e.id != null) { const k = laagVan(e) + '|' + String(e.id) + '|' + e.date; if (gezien[k]) return; gezien[k] = 1; }
    // Over meer dagen (afwezigheid): per kalenderdag knippen.
    if (!e.allDay && e.startMs != null && e.endMs != null && new Date(e.endMs - 1).toDateString() !== new Date(e.startMs).toDateString()) {
      const d0 = new Date(e.startMs);
      for (let k = 0; k < 62; k++) {
        const dag = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k);
        const dStart = dag.getTime();
        if (dStart >= e.endMs) break;
        const datum = plusDagen(e.date, k);
        if (!perDatum[datum]) continue;
        const s = Math.max(0, minutenVanDag(e.startMs, dStart)), en = Math.min(DAG, minutenVanDag(e.endMs, dStart));
        if (en <= s) continue;
        zet(perDatum[datum], weekDagItem(Object.assign({}, e, { date: datum }), Object.assign({}, opts, { startMin: s, minuten: en - s })));
      }
      return;
    }
    zet(perDatum[e.date], weekDagItem(e, opts));
  });
  let van = 8 * 60, tot = 17 * 60;
  dagen.forEach(function (d) {
    d.items.sort(function (a, b) { return a.startMin - b.startMin; });
    d.items.forEach(function (it) {
      if (it.heleDag) return;
      van = Math.min(van, Math.floor(Math.max(0, it.startMin - it.travelBefore) / 60) * 60);
      tot = Math.max(tot, Math.ceil(Math.min(DAG, it.startMin + it.minutes + it.travelAfter) / 60) * 60);
    });
  });
  return {
    maandag: maandag, startMin: van, endMin: tot,
    days: dagen.filter(function (d, i) { return i < 5 || d.items.length > 0; })
  };
}

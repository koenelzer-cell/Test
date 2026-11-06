// De afspraken van één week per dag, voor Detail op het startscherm van het
// zijpaneel (de dagen die uitklappen).
//
// PRIVACY: per afspraak alleen tijden, reistijd, de soort (direct, indirect of
// niet-cliënttijd), of hij geregistreerd is, en een naam: het afspraaktype uit
// het beheerscherm (via het label) of anders de uursoort. Nooit de vrije titel,
// geen cliënt, geen opmerking.

import { _entryMinutes, agendaEntryType, computeDirectIndirect } from './agenda-entries.js';
import { classifyAgendaEntry } from './open-registrations.js';
import { maandagVan, plusDagen } from '../../shared/datum.js';

function minutenVanDag(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

// Eén afspraak voor het zijpaneel, of null als hij niet in de dagweergave hoort
// (geen afspraak, hele dag, geen tijd).
export function weekDagItem(e, opts) {
  opts = opts || {};
  if (!e || e.type !== 'event' || e.allDay || !e.date || e.startMs == null) return null;
  const minuten = Math.round(_entryMinutes(e));
  if (!(minuten > 0)) return null;
  const di = computeDirectIndirect(e, opts.forms);
  const soort = !e.clientPresent ? 'overig' : (di.indirectMin > di.directMin ? 'indirect' : 'direct');
  // Telt hij mee als registreerbaar (cliënt of uursoort, werkdag)? Dan:
  // voorbij en geregistreerd, voorbij en nog open, of nog gepland.
  const c = classifyAgendaEntry(e, opts.now != null ? opts.now : Date.now(), 24 * 3600000);
  const status = !c ? '' : (!c.past ? 'gepland' : (c.declared ? 'ok' : 'open'));
  let naam = agendaEntryType(e, opts.choices);
  if (naam === 'Niet-gedefinieerd') naam = (e.hourType && String(e.hourType).trim()) || (e.clientPresent ? 'Cliëntafspraak' : 'Afspraak');
  return {
    startMin: minutenVanDag(e.startMs), minutes: minuten,
    travelBefore: Math.max(0, Math.round(Number(e.travelBefore) || 0)),
    travelAfter: Math.max(0, Math.round(Number(e.travelAfter) || 0)),
    soort: soort, status: status, naam: String(naam).slice(0, 60)
  };
}

// entries van entries/week -> { maandag, startMin, endMin, days: [{ date, open, items }] }.
// Maandag tot en met vrijdag altijd; zaterdag en zondag alleen met afspraken.
// startMin/endMin: het venster voor het rooster, op hele uren, minstens 8 tot 17.
export function weekDagen(entries, opts) {
  opts = opts || {};
  const maandag = maandagVan(opts.datum) || opts.datum;
  const dagen = [], perDatum = Object.create(null), gezien = Object.create(null);
  for (let i = 0; i < 7; i++) {
    const d = { date: plusDagen(maandag, i), open: 0, items: [] };
    dagen.push(d); perDatum[d.date] = d;
  }
  (Array.isArray(entries) ? entries : []).forEach(function (e) {
    if (!e) return;
    if (e.id != null) { const k = String(e.id) + '|' + (e.date || ''); if (gezien[k]) return; gezien[k] = 1; }
    const dag = perDatum[e.date];
    if (!dag) return;
    const it = weekDagItem(e, opts);
    if (!it) return;
    dag.items.push(it);
    if (it.status === 'open') dag.open++;
  });
  let van = 8 * 60, tot = 17 * 60;
  dagen.forEach(function (d) {
    d.items.sort(function (a, b) { return a.startMin - b.startMin; });
    d.items.forEach(function (it) {
      van = Math.min(van, Math.floor(Math.max(0, it.startMin - it.travelBefore) / 60) * 60);
      tot = Math.max(tot, Math.ceil(Math.min(24 * 60, it.startMin + it.minutes + it.travelAfter) / 60) * 60);
    });
  });
  return {
    maandag: maandag, startMin: van, endMin: tot,
    days: dagen.filter(function (d, i) { return i < 5 || d.items.length > 0; })
  };
}

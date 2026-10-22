// Planhulp: vrije tijd in de agenda vinden voor een afspraak van een bepaalde
// duur. Pure rekenlogica op genormaliseerde agenda-entries.
//
// Vrij = binnen het werkvenster, op een werkdag, na 'nu', en niet bezet door
// wat er echt in de agenda staat:
//   - een afspraak (inclusief reistijd ervoor en erna),
//   - onbeschikbaarheid (verlof e.d.): met tijden alleen dat stuk, zonder
//     tijden of als hele dag de hele dag,
//   - een Outlook-afspraak die bezet, afwezig (oof) of voorlopig is; 'free' en
//     'workingElsewhere' houden je beschikbaar,
//   - een gepland bezoek.
// Geen vaste pauzes of andere aannames: de kleurzones van de dagindeling
// tellen niet mee.

import { _excludeWeekendYmd } from './registrations.js';

function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function minutenVanDag(ms, dagStartMs) { return Math.round((ms - dagStartMs) / 60000); }

// entries: genormaliseerde entries (mapAgendaEntry). opts:
//   now (ms), days (aantal kalenderdagen vooruit), minMinutes, stepMin (15),
//   windowStart/windowEnd (minuten sinds middernacht), blocked [{from,to}] (minuten, optioneel),
//   maxResults, skipDates { 'YYYY-MM-DD': true } (bijv. feestdagen: geen vrije tijd),
//   weekdays [1..5] (optioneel: alleen deze dagen, 1 = maandag; zoals Date.getDay),
//   dayWindow(weekday) (optioneel: het werkvenster van die dag, { start, end } in
//   minuten, of null als het geen werkdag is; zonder: windowStart/windowEnd)
// -> [{ date, startMin, endMin, minutes }]
export function findFreeGaps(entries, opts) {
  opts = opts || {};
  const now = opts.now != null ? opts.now : Date.now();
  const stap = opts.stepMin || 15;
  const min = opts.minMinutes || 60;
  const wS = opts.windowStart != null ? opts.windowStart : 8 * 60;
  const wE = opts.windowEnd != null ? opts.windowEnd : 17 * 60;
  const blocked = opts.blocked || [];
  const max = opts.maxResults || 12;
  const dagen = opts.days || 14;
  const overslaan = opts.skipDates || {};
  const alleenDagen = Array.isArray(opts.weekdays) && opts.weekdays.length ? opts.weekdays : null;

  // Bezet per dag (minuten), plus dagen die helemaal bezet zijn.
  const bezet = Object.create(null), heleDag = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e || !e.date) return;
    // Outlook: alleen wat je agenda echt bezet. 'free' en 'workingElsewhere'
    // (op een andere plek aan het werk) laten de tijd vrij.
    const toon = String(e.showAs || '').toLowerCase();
    if (toon === 'free' || toon === 'workingelsewhere') return;
    if (e.allDay || e.layer === 'unavailabilities') {
      if (e.allDay || e.startMs == null || e.endMs == null) { heleDag[e.date] = true; return; }
    }
    if (e.startMs == null || e.endMs == null) return;
    const d0 = new Date(e.startMs);
    // Afwezigheid kan over meerdere dagen lopen: per kalenderdag opknippen
    // (niet per 24 uur: rond de wissel van zomer- naar wintertijd is een dag
    // 23 of 25 uur).
    for (let k = 0; k < 62; k++) {
      const dag = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k);
      const dStart = dag.getTime();
      if (dStart >= e.endMs) break;
      const key = ymd(dag);
      const voor = e.travelBefore || 0, na = e.travelAfter || 0; // reistijd staat al in minuten
      const s = Math.max(0, minutenVanDag(e.startMs, dStart) - voor);
      const en = Math.min(24 * 60, minutenVanDag(e.endMs, dStart) + na);
      if (en > s) (bezet[key] = bezet[key] || []).push([s, en]);
    }
  });

  const uit = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < dagen && uit.length < max; i++) {
    const dag = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(dag);
    if (_excludeWeekendYmd(key) || heleDag[key] || overslaan[key] === true) continue;
    if (alleenDagen && alleenDagen.indexOf(dag.getDay()) < 0) continue;
    const venster = opts.dayWindow ? opts.dayWindow(dag.getDay()) : { start: wS, end: wE };
    if (!venster) continue;
    const dS = venster.start, dE = venster.end;
    const dStart = dag.getTime();
    let vanaf = dS;
    if (i === 0) {
      // Vandaag: pas vanaf nu, afgerond op de volgende stap.
      const nu = minutenVanDag(now, dStart);
      vanaf = Math.max(dS, Math.ceil(nu / stap) * stap);
    }
    const bezig = (bezet[key] || []).concat(blocked.map(function (b) { return [b.from, b.to]; }))
      .filter(function (b) { return b[1] > vanaf && b[0] < dE; })
      .sort(function (a, b) { return a[0] - b[0]; });
    let cur = vanaf;
    const leeg = function (tot) {
      // Begin afronden naar boven op de stap; eind blijft zoals het is.
      const b = Math.ceil(cur / stap) * stap;
      if (tot - b >= min && uit.length < max) uit.push({ date: key, startMin: b, endMin: tot, minutes: tot - b });
    };
    for (let j = 0; j < bezig.length; j++) {
      if (bezig[j][0] > cur) leeg(Math.min(bezig[j][0], dE));
      cur = Math.max(cur, bezig[j][1]);
      if (cur >= dE) break;
    }
    if (cur < dE) leeg(dE);
  }
  return uit;
}

/* ── Reserveringen ───────────────────────────────────────────────────────
   Een reservering (laag 'reservations') houdt tijd vast voor een soort werk,
   bijv. 'JG Verslaglegging' 08:00–09:00. Je kunt er wel iets in plannen, dus
   ze tellen niet als bezet; ONS' overlapcontrole ziet ze wel als overlap.
   Daarom geven we bij een vrij blok aan welke reserveringen erin vallen, zodat
   de planhulp 'Reservering' kan tonen in plaats van een kale overlap. */

// Genormaliseerde entries -> [{ date, startMin, endMin, label }] per kalenderdag.
export function reservationBlocks(entries) {
  const uit = [], gezien = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e || e.startMs == null || e.endMs == null || !(e.endMs > e.startMs)) return;
    const d0 = new Date(e.startMs);
    const dStart = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
    const s = minutenVanDag(e.startMs, dStart), en = Math.min(24 * 60, minutenVanDag(e.endMs, dStart));
    const label = (Array.isArray(e.labels) ? e.labels : []).map(function (l) {
      return String((l && l.name != null) ? l.name : (typeof l === 'string' ? l : '')).trim();
    }).filter(Boolean)[0] || '';
    const key = ymd(d0) + '|' + s + '|' + en + '|' + label;
    if (gezien[key]) return; gezien[key] = 1;
    uit.push({ date: ymd(d0), startMin: s, endMin: en, label: label });
  });
  return uit.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
}

// Reserveringen die [startMin, endMin) op die dag raken.
export function reservationsOverlapping(blocks, date, startMin, endMin) {
  return (blocks || []).filter(function (r) { return r.date === date && r.startMin < endMin && r.endMin > startMin; });
}

// Planhulp: vrije tijd in de agenda vinden voor een afspraak van een bepaalde
// duur. Pure rekenlogica op genormaliseerde agenda-entries.
//
// Vrij = binnen het werkvenster, op een werkdag, na 'nu', en niet bezet door
// wat er echt in de agenda staat:
//   - een afspraak (inclusief reistijd ervoor en erna),
//   - onbeschikbaarheid (verlof e.d.): met tijden alleen dat stuk, zonder
//     tijden of als hele dag de hele dag.
// Geen vaste pauzes of andere aannames: de kleurzones van de dagindeling
// tellen niet mee.

import { _excludeWeekendYmd } from './registrations.js';

function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function minutenVanDag(ms, dagStartMs) { return Math.round((ms - dagStartMs) / 60000); }

// entries: genormaliseerde entries (mapAgendaEntry). opts:
//   now (ms), days (aantal kalenderdagen vooruit), minMinutes, stepMin (15),
//   windowStart/windowEnd (minuten sinds middernacht), blocked [{from,to}] (minuten, optioneel),
//   maxResults
// -> [{ date, startMin, endMin, minutes }]
export function findFreeGaps(entries, opts) {
  opts = opts || {};
  var now = opts.now != null ? opts.now : Date.now();
  var stap = opts.stepMin || 15;
  var min = opts.minMinutes || 60;
  var wS = opts.windowStart != null ? opts.windowStart : 8 * 60;
  var wE = opts.windowEnd != null ? opts.windowEnd : 17 * 60;
  var blocked = opts.blocked || [];
  var max = opts.maxResults || 12;
  var dagen = opts.days || 14;

  // Bezet per dag (minuten), plus dagen die helemaal bezet zijn.
  var bezet = Object.create(null), heleDag = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e || !e.date) return;
    if (e.allDay || e.layer === 'unavailabilities') {
      if (e.allDay || e.startMs == null || e.endMs == null) { heleDag[e.date] = true; return; }
    }
    if (e.startMs == null || e.endMs == null) return;
    var d0 = new Date(e.startMs);
    // Afwezigheid kan over meerdere dagen lopen: per kalenderdag opknippen
    // (niet per 24 uur: rond de wissel van zomer- naar wintertijd is een dag
    // 23 of 25 uur).
    for (var k = 0; k < 62; k++) {
      var dag = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k);
      var dStart = dag.getTime();
      if (dStart >= e.endMs) break;
      var key = ymd(dag);
      var voor = (e.travelBefore || 0) / 60, na = (e.travelAfter || 0) / 60; // seconden -> minuten
      var s = Math.max(0, minutenVanDag(e.startMs, dStart) - voor);
      var en = Math.min(24 * 60, minutenVanDag(e.endMs, dStart) + na);
      if (en > s) (bezet[key] = bezet[key] || []).push([s, en]);
    }
  });

  var uit = [];
  var start = new Date(now); start.setHours(0, 0, 0, 0);
  for (var i = 0; i < dagen && uit.length < max; i++) {
    var dag = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    var key = ymd(dag);
    if (_excludeWeekendYmd(key) || heleDag[key]) continue;
    var dStart = dag.getTime();
    var vanaf = wS;
    if (i === 0) {
      // Vandaag: pas vanaf nu, afgerond op de volgende stap.
      var nu = minutenVanDag(now, dStart);
      vanaf = Math.max(wS, Math.ceil(nu / stap) * stap);
    }
    var bezig = (bezet[key] || []).concat(blocked.map(function (b) { return [b.from, b.to]; }))
      .filter(function (b) { return b[1] > vanaf && b[0] < wE; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var cur = vanaf;
    var leeg = function (tot) {
      // Begin afronden naar boven op de stap; eind blijft zoals het is.
      var b = Math.ceil(cur / stap) * stap;
      if (tot - b >= min && uit.length < max) uit.push({ date: key, startMin: b, endMin: tot, minutes: tot - b });
    };
    for (var j = 0; j < bezig.length; j++) {
      if (bezig[j][0] > cur) leeg(Math.min(bezig[j][0], wE));
      cur = Math.max(cur, bezig[j][1]);
      if (cur >= wE) break;
    }
    if (cur < wE) leeg(wE);
  }
  return uit;
}

// Momentopname: de laatst bekende weekstand, zodat de herinnering iets kan
// melden als de agenda niet openstaat.
//
// PRIVACY: de momentopname bevat alleen getallen (minuten, aantallen, een
// percentage) en datums. Geen cliëntnamen, geen afspraaktitels, geen labels.

import { LOCAL } from '../shared/storage-keys.js';
import { readLocal, writeLocal } from '../shared/chrome-storage.js';

// Alleen getallen overnemen, en alleen als ze ook echt een getal zijn. Zo kan
// een onverwacht bericht niets anders in de opslag zetten dan deze vorm.
export function sanitizeSnapshot(msg) {
  const num = function (v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.round(v) : 0; };
  let days = [];
  if (Array.isArray(msg.days)) {
    days = msg.days.slice(0, 31).map(function (d) {
      return {
        date: (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) ? d.date : '',
        client: num(d.client),
        overig: num(d.overig),
        late: num(d.late),
      };
    }).filter(function (d) { return d.date; });
  }
  return {
    openDays: num(msg.openDays),
    openMinutes: num(msg.openMinutes),
    lateMinutes: num(msg.lateMinutes),
    futureMinutes: num(msg.futureMinutes),
    directPct: (typeof msg.directPct === 'number' && isFinite(msg.directPct)) ? Math.round(msg.directPct) : null,
    normPct: (typeof msg.normPct === 'number' && isFinite(msg.normPct)) ? Math.round(msg.normPct) : null,
    week: num(msg.week) || null,
    days: days,
    ts: Date.now(),
  };
}

export function saveSnapshot(msg) {
  return writeLocal({ [LOCAL.SNAPSHOT]: sanitizeSnapshot(msg) });
}

export function loadSnapshot() {
  return readLocal([LOCAL.SNAPSHOT]).then(function (v) { return v[LOCAL.SNAPSHOT] || null; });
}

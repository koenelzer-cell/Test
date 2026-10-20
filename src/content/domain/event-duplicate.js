// Een afspraak kopiëren naar andere momenten (planhulp: meerdere momenten).
//
// De medewerker maakt de afspraak één keer zelf in ONS (POST /calendar/events).
// Dat verzoek is het voorbeeld: per gekozen moment dezelfde inhoud, alleen
// valid_from, start_time en end_time schuiven mee. De duur blijft die van de
// opgeslagen afspraak (eind − begin), ook als die in het formulier nog is
// aangepast.
//
// PRIVACY: het voorbeeld bevat cliëntgegevens zoals ONS ze zelf verstuurt. Deze
// module bewaart niets; ze maakt alleen kopieën om meteen terug te sturen naar
// dezelfde ONS-omgeving.

import { isoLocalWithOffset } from './open-registrations.js';

// Velden die op herhaling wijzen: een herhalende afspraak kopiëren we niet
// (ONS maakt dan zelf al een reeks; een kopie zou die reeks verdubbelen).
const HERHALING = /recurr|repeat|rrule|frequen|interval|valid_until|herhal/i;

function heeftWaarde(v) {
  if (v == null || v === false || v === '' || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).some(function (k) { return heeftWaarde(v[k]); });
  return true;
}

function lokaleDagEnMinuut(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? { date: m[1], min: +m[2] * 60 + +m[3] } : null;
}

// Is dit het verzoek waarmee een afspraak wordt aangemaakt, en is het te kopiëren?
//   -> { ok: true, date, startMin, minutes } of { ok: false, reason }
export function inspectEventPayload(payload) {
  const ev = payload && payload.event;
  if (!ev || typeof ev !== 'object') return { ok: false, reason: 'geen afspraak' };
  const s = Date.parse(ev.start_time), e = Date.parse(ev.end_time);
  if (!(e > s)) return { ok: false, reason: 'geen begin- en eindtijd' };
  const herhaald = Object.keys(ev).some(function (k) { return HERHALING.test(k) && heeftWaarde(ev[k]); });
  if (herhaald) return { ok: false, reason: 'herhalende afspraak' };
  const b = lokaleDagEnMinuut(ev.start_time);
  if (!b) return { ok: false, reason: 'onbekende tijdnotatie' };
  return { ok: true, date: b.date, startMin: b.min, minutes: Math.round((e - s) / 60000) };
}

// Kopie van het verzoek op een ander moment.
//   moment: { date: 'YYYY-MM-DD', startMin } -> nieuw verzoek, of null als het
//   niet kan (ongeldig moment, of de afspraak zou over middernacht lopen).
export function duplicateEventPayload(payload, moment) {
  const info = inspectEventPayload(payload);
  if (!info.ok || !moment || !/^\d{4}-\d{2}-\d{2}$/.test(String(moment.date || ''))) return null;
  const start = moment.startMin, eind = start + info.minutes;
  if (!(start >= 0) || eind > 24 * 60) return null;
  const van = isoLocalWithOffset(moment.date, start);
  const tot = eind === 24 * 60 ? null : isoLocalWithOffset(moment.date, eind);
  if (!van || !tot) return null;
  const kopie = JSON.parse(JSON.stringify(payload));
  const ev = kopie.event;
  // Een id hoort bij een bestaande afspraak; de kopie is nieuw.
  delete ev.id; delete ev.occurrence_id;
  ev.start_time = van;
  ev.end_time = tot;
  ev.valid_from = moment.date;
  return kopie;
}

// De momenten die nog een kopie nodig hebben: zonder het moment van de
// opgeslagen afspraak zelf, zonder dubbele, op volgorde.
export function remainingMoments(payload, moments) {
  const info = inspectEventPayload(payload);
  const gezien = Object.create(null);
  if (info.ok) gezien[info.date + '|' + info.startMin] = true;
  return (moments || []).filter(function (m) {
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.date || '')) || !(m.startMin >= 0)) return false;
    const k = m.date + '|' + m.startMin;
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
}

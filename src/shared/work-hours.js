// De eigen werktijden van de medewerker, ingesteld in de popup en bewaard in
// chrome.storage.sync (SYNC.WORK_HOURS). Ze bepalen waar de agenda kleurt en
// waar de planhulp vrije tijd zoekt.
//
// Opgeslagen vorm: { '1': { start: '08:30', end: '17:00' }, '3': … } met als
// sleutel de weekdag (1 = maandag t/m 5 = vrijdag). Een dag die ontbreekt, is
// geen werkdag. Geen waarde (of geen enkele geldige dag) = niet ingesteld: dan
// geldt de dagindeling van het team.

export const WORKDAYS = [1, 2, 3, 4, 5];
export const DAY_NAMES = { 1: 'ma', 2: 'di', 3: 'wo', 4: 'do', 5: 'vr' };

// '08:30' -> 510, anders null.
export function hmToMinutes(hm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hm || ''));
  return m ? +m[1] * 60 + +m[2] : null;
}

// 510 -> '08:30'
export function minutesToHm(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

// Opgeslagen waarde -> { 1: { start, end } (minuten) of null, … }, of null
// als er niets geldigs is ingesteld. Een dag met een begin na het einde telt
// niet.
export function normalizeWorkHours(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hours = {};
  let any = false;
  for (const day of WORKDAYS) {
    const start = raw[day] ? hmToMinutes(raw[day].start) : null;
    const end = raw[day] ? hmToMinutes(raw[day].end) : null;
    hours[day] = start != null && end != null && end > start ? { start, end } : null;
    if (hours[day]) any = true;
  }
  return any ? hours : null;
}

// Het werkvenster van een dag (weekdag zoals Date.getDay: 0 = zondag).
// -> undefined: niet ingesteld (de dagindeling van het team geldt);
//    null: geen werkdag; anders { start, end } in minuten.
export function workWindowFor(hours, weekday) {
  if (!hours) return undefined;
  return hours[weekday] || null;
}

// Vroegste begin en laatste einde over de week, of null.
export function weekRange(hours) {
  const days = hours ? WORKDAYS.map((day) => hours[day]).filter(Boolean) : [];
  if (!days.length) return null;
  return { start: Math.min(...days.map((d) => d.start)), end: Math.max(...days.map((d) => d.end)) };
}

// Korte omschrijving: 'ma t/m do 08:30 tot 17:00, vr 08:30 tot 12:30'.
// Opeenvolgende dagen met dezelfde tijden worden samengenomen.
export function describeWorkHours(hours) {
  if (!hours) return '';
  const groups = [];
  for (const day of WORKDAYS) {
    const w = hours[day];
    if (!w) continue;
    const last = groups[groups.length - 1];
    if (last && last.to === day - 1 && last.start === w.start && last.end === w.end) last.to = day;
    else groups.push({ from: day, to: day, start: w.start, end: w.end });
  }
  return groups.map((g) => {
    const days = g.from === g.to ? DAY_NAMES[g.from]
      : g.to === g.from + 1 ? DAY_NAMES[g.from] + ' en ' + DAY_NAMES[g.to]
        : DAY_NAMES[g.from] + ' t/m ' + DAY_NAMES[g.to];
    return days + ' ' + minutesToHm(g.start) + ' tot ' + minutesToHm(g.end);
  }).join(', ');
}

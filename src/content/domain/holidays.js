// Feestdagen uit ONS (/calendar/holidays): { data: [{ type: 'holiday', name,
// date: 'YYYY-MM-DD', time_slot: { all_day } }] } -> [{ date, name }].
// Alleen hele dagen; ONS zet soms een spatie voor de naam. Goede Vrijdag
// telt niet mee: dan wordt gewoon gewerkt (vrije tijd zoals elke dag).
const GEEN_VRIJE_DAG = /goede\s*vrijdag/i;
export function parseHolidays(json) {
  const lijst = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
  const uit = [], gezien = Object.create(null);
  lijst.forEach(function (h) {
    if (!h || (h.type && h.type !== 'holiday')) return;
    const date = String(h.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (h.time_slot && h.time_slot.all_day === false) return;
    const name = String(h.name == null ? '' : h.name).trim().replace(/\s+/g, ' ').slice(0, 80) || 'Feestdag';
    if (GEEN_VRIJE_DAG.test(name)) return;
    if (gezien[date]) return;
    gezien[date] = true;
    uit.push({ date: date, name: name });
  });
  return uit.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// Feestdagen tussen twee datums (beide inbegrepen).
export function holidaysBetween(holidays, from, to) {
  return (holidays || []).filter(function (h) { return h.date >= from && h.date <= to; });
}
